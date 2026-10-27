/* Chronicle film runtime (browser). Draws one frame for a time t on every HyperFrames `hf-seek`:
 *   picture   the active shot's scene code draws on an offscreen canvas; during a transition the outgoing
 *             and incoming shots are composited (ink-bleed dissolve, scroll pan, seal stamp, hard cut)
 *   overlays  captions, knowledge-point cards (count-up), title, AIGC badge and end card are DOM text,
 *             so every script (CJK, RTL, Indic) is shaped by the browser with the bundled fonts
 * Pure function of t: no clock, no randomness (the kit's rng is seeded), no network. Every page worker
 * renders an arbitrary subset of frames, so nothing may depend on the previous frame.
 * Globals: window.CI_TIMELINE (timeline.json), window.CI_WINDOW ({ from, to } seconds), window.CI_KIT. */
(function () {
  'use strict'
  var T = window.CI_TIMELINE
  var WIN = window.CI_WINDOW || { from: 0, to: T.seconds }
  var KIT = window.CI_KIT
  var W = T.width, H = T.height
  var stage = document.getElementById('stage')
  var main = document.getElementById('ci-canvas')
  var g = main.getContext('2d')
  var bufA = document.createElement('canvas'); bufA.width = W; bufA.height = H
  var bufB = document.createElement('canvas'); bufB.width = W; bufB.height = H
  var mask = document.createElement('canvas'); mask.width = Math.round(W / 4); mask.height = Math.round(H / 4)
  var scenes = (window.CI_SCENES = window.CI_SCENES || {})
  var errors = (window.CI_ERRORS = [])
  var cache = {}
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x }
  /** Camera of a shot at progress u: { zoom, x, y } (pixels at depth 1). */
  function camera(shot, u) {
    var e = KIT.ease.inOut(u)
    switch (shot.camera) {
      case 'push-in': return { zoom: 1 + 0.12 * e, x: 0, y: 0 }
      case 'pull-out': return { zoom: 1.12 - 0.12 * e, x: 0, y: 0 }
      case 'pan-left': return { zoom: 1.06, x: W * 0.05 * (1 - 2 * e), y: 0 }
      case 'pan-right': return { zoom: 1.06, x: -W * 0.05 * (1 - 2 * e), y: 0 }
      case 'rise': return { zoom: 1.06, x: 0, y: -H * 0.05 * (1 - 2 * e) }
      case 'parallax': return { zoom: 1.04, x: W * 0.04 * (1 - 2 * e), y: 0 }
      default: return { zoom: 1 + 0.02 * u, x: 0, y: 0 }
    }
  }
  function shotContext(shot, t) {
    var local = t - shot.start
    var dur = shot.end - shot.start
    var u = clamp(local / dur, 0, 1)
    var cues = T.sfx.filter(function (c) { return c.shot === shot.id }).map(function (c) { return { t: c.t - shot.start, kind: c.kind, tier: c.tier, dur: c.dur || 0, id: c.id } })
    var kp = null
    for (var i = 0; i < T.kp_cards.length; i++) if (T.kp_cards[i].shot === shot.id) kp = T.kp_cards[i]
    return {
      t: local, u: u, dur: dur, beat: local / T.beat_s, bar: local / T.bar_s, beat_s: T.beat_s, bar_s: T.bar_s,
      W: W, H: H, shot: shot, params: shot.params || {}, size: shot.size, lang: T.lang, dir: T.dir,
      cam: camera(shot, u), cues: cues,
      /** Local time of the i-th cue of a kind in this shot (null when absent). */
      cue: function (kind, i) { var list = cues.filter(function (c) { return c.kind === kind }); var c = list[i || 0]; return c ? c.t : null },
      kp: kp ? { title: kp.title, value: kp.value, count: kp.count, start: kp.start - shot.start, end: kp.end - shot.start } : null,
      title: T.title && T.title.shot === shot.id ? T.title.text : null,
      fonts: T.fonts,
      /** Memoised offscreen canvas (deterministic content only): cache(key, w, h, draw(g2)). */
      cache: function (key, w, h, draw) {
        var k = shot.scene + '|' + key + '|' + w + 'x' + h
        if (!cache[k]) {
          var c = document.createElement('canvas'); c.width = w; c.height = h
          draw(c.getContext('2d'))
          cache[k] = c
        }
        return cache[k]
      },
      /**
       * Memoised offscreen WebGL canvas: gl(key, w, h, init(gl) -> state) returns { canvas, gl, state }.
       * init runs once (build buffers and programs); draw into it every frame and blit with drawImage.
       * The context keeps its drawing buffer; the CPU render path rasterises it in software, so the
       * output stays identical between runs.
       */
      gl: function (key, w, h, init) {
        var k = 'gl|' + shot.scene + '|' + key + '|' + w + 'x' + h
        // a software context can be lost under memory pressure: build a fresh one instead of drawing black
        if (cache[k] && cache[k].gl.isContextLost()) delete cache[k]
        if (!cache[k]) {
          var c = document.createElement('canvas'); c.width = w; c.height = h
          var ctx = c.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false })
          if (!ctx) { errors.push('webgl_unavailable'); return null }
          cache[k] = { canvas: c, gl: ctx, state: init ? init(ctx) : null }
        }
        return cache[k]
      },
      kit: KIT,
      /** geo/basemap.json (OpenStreetMap, km around the city centre) or null. */
      geo: window.CI_GEO || null,
      /** A photograph from geo/photos.json: { img, credit } or null. */
      photo: function (id) { return PHOTOS[id] || null },
    }
  }
  function drawShot(shot, t, target) {
    var c = target.getContext('2d')
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    var scene = scenes[shot.scene]
    if (!scene) {
      errors.push('scene_missing:' + shot.scene)
      c.fillStyle = '#EFE6D2'; c.fillRect(0, 0, W, H)
      return
    }
    try {
      c.save()
      scene(c, shotContext(shot, t))
      c.restore()
    } catch (e) {
      errors.push('scene_error:' + shot.scene + ':' + String(e && e.message || e).slice(0, 200))
    }
  }
  function activeShot(t) {
    var s = T.shots
    for (var i = s.length - 1; i >= 0; i--) if (t >= s[i].start - 1e-6) return i
    return 0
  }
  // ---------- transitions ----------
  function inkBleed(p, seed) {
    // Soft ink-blot threshold over value noise, drawn at quarter resolution and scaled up (soft edge).
    var mw = mask.width, mh = mask.height
    var m = mask.getContext('2d')
    var img = m.createImageData(mw, mh)
    var d = img.data
    var cx = mw * 0.5, cy = mh * 0.55
    for (var y = 0; y < mh; y++) for (var x = 0; x < mw; x++) {
      var n = KIT.fbm(x / 22, y / 22, seed, 4)
      var r = Math.sqrt(((x - cx) / mw) * ((x - cx) / mw) * 1.6 + ((y - cy) / mh) * ((y - cy) / mh)) / 0.75
      var v = 0.55 * r + 0.45 * n
      var a = clamp((p * 1.35 - v) / 0.09, 0, 1)
      var o = (y * mw + x) * 4
      d[o] = d[o + 1] = d[o + 2] = 0
      d[o + 3] = Math.round(a * 255)
    }
    m.putImageData(img, 0, 0)
    return mask
  }
  function composite(t) {
    var i = activeShot(t)
    var shot = T.shots[i]
    var local = t - shot.start
    var tr = shot.transition, td = shot.transition_s
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    if (i === 0 || tr === 'cut' || !(local < td)) {
      drawShot(shot, t, bufB)
      g.drawImage(bufB, 0, 0)
      return
    }
    var prev = T.shots[i - 1]
    var p = clamp(local / td, 0, 1)
    drawShot(prev, t, bufA)
    drawShot(shot, t, bufB)
    if (tr === 'ink-bleed') {
      g.drawImage(bufA, 0, 0)
      var mk = inkBleed(KIT.ease.out(p), i * 131 + 7)
      var bctx = bufB.getContext('2d')
      bctx.save()
      bctx.globalCompositeOperation = 'destination-in'
      bctx.imageSmoothingEnabled = true
      bctx.drawImage(mk, 0, 0, W, H)
      bctx.restore()
      // Ink rim: a dark wash where the blot is spreading.
      g.save()
      g.globalAlpha = 0.18 * Math.sin(Math.PI * p)
      g.drawImage(mk, 0, 0, W, H)
      g.restore()
      g.drawImage(bufB, 0, 0)
    } else if (tr === 'scroll-pan') {
      var e = KIT.ease.inOut(p)
      var edge = W * (1 - e)
      g.drawImage(bufA, -W * 0.25 * e, 0)
      g.save()
      g.beginPath(); g.rect(edge, 0, W - edge, H); g.clip()
      g.drawImage(bufB, 0, 0)
      g.restore()
      KIT.scrollRod(g, edge, H, 1 - p)
    } else if (tr === 'seal-stamp') {
      g.drawImage(p < 0.5 ? bufA : bufB, 0, 0)
      var s = p < 0.5 ? 1.8 - 1.6 * KIT.ease.in(p * 2) : 1
      var a = p < 0.5 ? KIT.ease.out(p * 2) : 1 - KIT.ease.in((p - 0.5) * 2)
      KIT.seal(g, W / 2, H / 2, H * 0.16 * s, T.seal_text, { alpha: a })
    } else g.drawImage(bufB, 0, 0)
  }
  // ---------- overlays (DOM) ----------
  var capEl = document.getElementById('ci-caption')
  var cardEl = document.getElementById('ci-card')
  var titleEl = document.getElementById('ci-title')
  var badgeEl = document.getElementById('ci-badge')
  var endEl = document.getElementById('ci-endcard')
  var lastCap = -1
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function markup(line, em) {
    var html = esc(line)
    for (var k = 0; k < em.length; k++) if (em[k]) html = html.split(esc(em[k])).join('<span class="ci-em">' + esc(em[k]) + '</span>')
    return html
  }
  function countText(card, t) {
    if (card.count == null) return card.value
    var p = clamp((t - card.start) / Math.max(1e-3, card.count_s), 0, 1)
    if (p >= 1) return card.value
    var v = card.count * KIT.ease.out(p)
    var n = Math.abs(card.count) < 10000 ? String(Math.round(v)) : new Intl.NumberFormat(T.lang).format(Math.round(v))
    return n
  }
  function overlays(t) {
    var ci = -1
    for (var i = 0; i < T.captions.length; i++) if (t >= T.captions[i].start && t < T.captions[i].end) ci = i
    if (ci !== lastCap) {
      capEl.innerHTML = ci < 0 ? '' : T.captions[ci].lines.map(function (l) { return '<div class="ci-line">' + markup(l, T.captions[ci].em) + '</div>' }).join('')
      capEl.setAttribute('dir', ci < 0 ? T.dir : T.captions[ci].dir)
      lastCap = ci
    }
    var c = ci < 0 ? null : T.captions[ci]
    capEl.style.opacity = c ? String(clamp((t - c.start) / 0.18, 0, 1) * clamp((c.end - t) / 0.12, 0, 1)) : '0'
    capEl.style.transform = c ? 'translateY(' + (8 * (1 - KIT.ease.out(clamp((t - c.start) / 0.25, 0, 1)))).toFixed(2) + 'px)' : 'none'
    var card = null
    for (var k = 0; k < T.kp_cards.length; k++) if (t >= T.kp_cards[k].start && t < T.kp_cards[k].end) card = T.kp_cards[k]
    if (card) {
      cardEl.style.opacity = String(clamp((t - card.start) / 0.12, 0, 1) * clamp((card.end - t) / 0.2, 0, 1))
      var sp = clamp((t - card.start) / (T.beat_s * 0.5), 0, 1)
      cardEl.querySelector('.ci-card-seal').style.transform = 'scale(' + (1.5 - 0.5 * KIT.ease.in(sp)).toFixed(3) + ')'
      cardEl.querySelector('.ci-card-title').textContent = card.title
      cardEl.querySelector('.ci-card-value').textContent = countText(card, t)
    } else cardEl.style.opacity = '0'
    var ti = T.title
    if (ti && ti.start != null && t >= ti.start && t < ti.end) {
      var tp = clamp((t - ti.start) / (T.beat_s * 2), 0, 1)
      titleEl.style.opacity = String(KIT.ease.out(tp) * clamp((ti.end - t) / 0.3, 0, 1))
      titleEl.style.clipPath = 'inset(0 ' + ((1 - KIT.ease.out(tp)) * 100).toFixed(2) + '% 0 0)'
    } else titleEl.style.opacity = '0'
    badgeEl.style.opacity = t < T.badge.end ? '1' : '0'
    var ec = T.end_card
    endEl.style.opacity = t >= ec.start ? String(clamp((t - ec.start) / 0.6, 0, 1)) : '0'
  }
  function render(time) {
    var t = Math.min(WIN.to - 1e-6, WIN.from + time)
    composite(t)
    overlays(t)
    stage.setAttribute('data-ci-t', t.toFixed(3))
  }
  var ready = null
  // Photographs (geo/photos.json): decoded once before the first frame; scenes read s.photo(id).
  var PHOTOS = {}
  function photosReady() {
    return Promise.all((window.CI_PHOTOS || []).map(function (p) {
      return new Promise(function (ok) {
        var im = new window.Image(); im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { PHOTOS[p.id] = { id: p.id, img: im, credit: p.credit }; ok() }, function () { ok() }) }; im.onerror = function () { ok() }; im.src = p.src
      })
    }))
  }
  function fontsReady() {
    if (ready) return ready
    var loads = (T.fonts || []).map(function (f) { return document.fonts.load('40px "' + f + '"', T.font_sample || 'Aa') }).concat([photosReady()])
    ready = Promise.all(loads).then(function () { return document.fonts.ready }).catch(function () {})
    return ready
  }
  window.addEventListener('hf-seek', function (e) {
    var time = Number(e.detail && e.detail.time) || 0
    if (e.detail && typeof e.detail.waitUntil === 'function') e.detail.waitUntil(fontsReady().then(function () { render(time) }))
    else render(time)
  })
  window.CI_RENDER = function (time) { return fontsReady().then(function () { render(time) }) }
})()
