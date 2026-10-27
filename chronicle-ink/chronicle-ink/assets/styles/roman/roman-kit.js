/* Roman Atlas kit: extends the base kit (style/ink-kit.js, loaded first) with an antique city-atlas
 * look: parchment, Pompeian red, bronze gold, carved Cinzel capitals, hachured hills, real street and
 * building fabric from OpenStreetMap (s.geo), walls drawn as masonry, a laurel medallion instead of the
 * ink seal and a column instead of the scroll rod. Same rules as every kit: deterministic in s.t,
 * seeded randomness only, no network, no DOM except offscreen canvases from s.cache(). */
(function () {
  'use strict'
  var K = window.CI_KIT
  var TAU = Math.PI * 2
  var PAL = K.PAL
  // Shared palette object: the base functions read it, so they repaint in Roman colours.
  PAL.paper = '#EBDDBF'; PAL.paperShadow = '#D6C29B'; PAL.ink = '#2A1E14'; PAL.inkSoft = '#5A4632'
  PAL.cinnabar = '#9E2B1F'; PAL.ochre = '#B5793A'; PAL.indigo = '#3F6E78'; PAL.mist = '#CDBB96'
  PAL.gold = '#B08A3E'; PAL.terracotta = '#B4553A'; PAL.marble = '#F2EBDD'; PAL.laurel = '#5E6B3A'; PAL.water = '#7FA3A6'
  var rgba = K.rgba, clamp = K.clamp, ease = K.ease, rng = K.rng, fbm = K.fbm
  var SERIF = '"Noto Serif SC", "Noto Serif", serif'
  var DISPLAY = '"Cinzel", "Noto Serif SC", serif'

  /** Aged parchment: warm base, soft blotches, fibres and a darker burnt edge. Cache it. */
  function paper(g, W, H, seed, tone) {
    var r = rng(seed || 5)
    g.fillStyle = tone || PAL.paper
    g.fillRect(0, 0, W, H)
    var cell = 40
    for (var y = 0; y < H; y += cell) for (var x = 0; x < W; x += cell) {
      var n = fbm(x / 360, y / 360, seed || 5, 4)
      g.fillStyle = n > 0.5 ? 'rgba(140,96,48,' + ((n - 0.5) * 0.16).toFixed(3) + ')' : 'rgba(255,248,230,' + ((0.5 - n) * 0.14).toFixed(3) + ')'
      g.fillRect(x, y, cell, cell)
    }
    for (var i = 0; i < 18; i++) {
      var cx = r() * W, cy = r() * H, rad = (0.05 + r() * 0.18) * W
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
      gr.addColorStop(0, 'rgba(150,100,50,' + (0.05 * r()).toFixed(3) + ')')
      gr.addColorStop(1, 'rgba(150,100,50,0)')
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    }
    g.lineCap = 'round'
    for (var k = 0; k < 700; k++) {
      var fx = r() * W, fy = r() * H, len = 3 + r() * 12, a = r() * TAU
      g.strokeStyle = 'rgba(110,80,45,' + (0.03 + r() * 0.06).toFixed(3) + ')'; g.lineWidth = 0.5 + r() * 0.7
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * len, fy + Math.sin(a) * len); g.stroke()
    }
    var v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.72)
    v.addColorStop(0, 'rgba(90,55,20,0)'); v.addColorStop(1, 'rgba(90,55,20,0.32)')
    g.fillStyle = v; g.fillRect(0, 0, W, H)
  }

  /** Laurel branch: leaves along an arc from a0 to a1 around (cx, cy). */
  function laurel(g, cx, cy, r, o) {
    o = o || {}
    var a0 = o.a0 == null ? Math.PI * 0.62 : o.a0, a1 = o.a1 == null ? Math.PI * 1.38 : o.a1, n = o.n || 11
    g.save(); g.strokeStyle = o.color || PAL.laurel; g.fillStyle = o.color || PAL.laurel; g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    g.lineWidth = Math.max(1.5, r * 0.03)
    g.beginPath(); g.arc(cx, cy, r, a0, a1, a1 < a0); g.stroke()
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
      for (var side = -1; side <= 1; side += 2) {
        var la = a + side * 0.9 + (a1 > a0 ? 0.35 : -0.35), L = r * 0.22
        g.beginPath(); g.ellipse(px + Math.cos(la) * L * 0.5, py + Math.sin(la) * L * 0.5, L * 0.5, L * 0.18, la, 0, TAU); g.fill()
      }
    }
    g.restore()
  }
  /** Laurel medallion (replaces the ink seal): red disc, gold ring, carved letters, two laurel branches. */
  function seal(g, x, y, size, text, o) {
    o = o || {}
    var r = size * 0.5
    g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    g.translate(x, y); if (o.rot) g.rotate(o.rot * 0.4)
    laurel(g, 0, 0, r * 1.28, { a0: Math.PI * 0.55, a1: Math.PI * 1.45, n: 9 })
    laurel(g, 0, 0, r * 1.28, { a0: Math.PI * 0.45, a1: -Math.PI * 0.45, n: 9 })
    g.fillStyle = PAL.cinnabar; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill()
    g.strokeStyle = PAL.gold; g.lineWidth = Math.max(2, r * 0.09); g.stroke()
    g.strokeStyle = rgba(PAL.gold, 0.6); g.lineWidth = Math.max(1, r * 0.03); g.beginPath(); g.arc(0, 0, r * 0.84, 0, TAU); g.stroke()
    var t = String(text || 'SPQR')
    g.fillStyle = PAL.marble; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = (t.length > 2 ? r * 0.5 : r * 0.9) + 'px ' + DISPLAY
    g.fillText(t, 0, r * 0.04)
    g.restore()
  }
  /** Fluted column (the scroll-pan transition edge, and decoration). */
  function column(g, x, y, h, o) {
    o = o || {}
    var w = o.w || h * 0.09
    g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    var grd = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    grd.addColorStop(0, '#CBBFA8'); grd.addColorStop(0.45, PAL.marble); grd.addColorStop(1, '#B9AC93')
    g.fillStyle = grd; g.fillRect(x - w / 2, y - h, w, h)
    g.strokeStyle = 'rgba(90,70,45,0.35)'; g.lineWidth = 1.2
    for (var i = 1; i < 6; i++) { var fx = x - w / 2 + (w * i) / 6; g.beginPath(); g.moveTo(fx, y - h * 0.94); g.lineTo(fx, y - h * 0.04); g.stroke() }
    g.fillStyle = '#D8CDB6'; g.fillRect(x - w * 0.75, y - h - w * 0.32, w * 1.5, w * 0.34); g.fillRect(x - w * 0.7, y - w * 0.28, w * 1.4, w * 0.28)
    g.strokeStyle = 'rgba(90,70,45,0.45)'; g.strokeRect(x - w * 0.75, y - h - w * 0.32, w * 1.5, w * 0.34)
    g.restore()
  }
  function scrollRod(g, x, H) { column(g, x, H, H, { w: H * 0.07 }) }
  /** Round arch (aqueduct or gate). */
  function arch(g, x, y, w, h, o) {
    o = o || {}
    g.save(); g.fillStyle = o.color || rgba(PAL.terracotta, o.alpha == null ? 0.9 : o.alpha)
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.lineTo(x + w, y - h); g.lineTo(x + w, y)
    g.lineTo(x + w * 0.82, y); g.lineTo(x + w * 0.82, y - h * 0.55)
    g.arc(x + w / 2, y - h * 0.55, w * 0.32, 0, Math.PI, true)
    g.lineTo(x + w * 0.18, y); g.closePath(); g.fill()
    g.restore()
  }
  /** Cypress tree. */
  function cypress(g, x, y, h, o) {
    o = o || {}
    g.save(); g.fillStyle = o.color || rgba('#3E4A2A', o.alpha == null ? 0.9 : o.alpha)
    g.beginPath(); g.moveTo(x, y - h); g.quadraticCurveTo(x + h * 0.13, y - h * 0.45, x + h * 0.05, y); g.lineTo(x - h * 0.05, y); g.quadraticCurveTo(x - h * 0.13, y - h * 0.45, x, y - h); g.fill()
    g.restore()
  }
  /** Greek-key (meander) frame along the edges of the canvas. */
  function meander(g, W, H, o) {
    o = o || {}
    var u = o.u || 12, m = o.m || 14
    g.save(); g.strokeStyle = rgba(o.color || PAL.terracotta, o.alpha == null ? 0.75 : o.alpha); g.lineWidth = Math.max(2, u * 0.22)
    g.strokeRect(m, m, W - 2 * m, H - 2 * m)
    g.strokeRect(m + u * 3.2, m + u * 3.2, W - 2 * (m + u * 3.2), H - 2 * (m + u * 3.2))
    var key = function (x, y, d) {
      g.beginPath()
      if (d === 'h') { g.moveTo(x, y + u * 2); g.lineTo(x, y + u * 0.6); g.lineTo(x + u * 2, y + u * 0.6); g.lineTo(x + u * 2, y + u * 1.6); g.lineTo(x + u * 1, y + u * 1.6) }
      else { g.moveTo(x + u * 2, y); g.lineTo(x + u * 0.6, y); g.lineTo(x + u * 0.6, y + u * 2); g.lineTo(x + u * 1.6, y + u * 2); g.lineTo(x + u * 1.6, y + u) }
      g.stroke()
    }
    for (var x = m + u * 0.6; x < W - m - u * 3; x += u * 3) { key(x, m + u * 0.2, 'h'); key(x, H - m - u * 2.8, 'h') }
    for (var y = m + u * 3.4; y < H - m - u * 3.4; y += u * 3) { key(m + u * 0.2, y, 'v'); key(W - m - u * 2.8, y, 'v') }
    g.restore()
  }
  /** Eight-point wind rose with N. */
  function compass(g, x, y, r, o) {
    o = o || {}
    g.save(); g.translate(x, y); g.globalAlpha *= o.alpha == null ? 0.85 : o.alpha
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * TAU - Math.PI / 2, L = i % 2 ? r * 0.55 : r
      g.fillStyle = i % 2 ? rgba(PAL.gold, 0.9) : (i === 0 ? PAL.cinnabar : PAL.ink)
      g.beginPath(); g.moveTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.35) * r * 0.16, Math.sin(a + 0.35) * r * 0.16); g.lineTo(Math.cos(a - 0.35) * r * 0.16, Math.sin(a - 0.35) * r * 0.16); g.closePath(); g.fill()
    }
    g.strokeStyle = PAL.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.stroke()
    g.fillStyle = PAL.ink; g.font = Math.round(r * 0.42) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'bottom'
    g.fillText('N', 0, -r * 1.02)
    g.restore()
  }
  /** Carved stone plaque with a gold rule: big text, optional sub line. */
  function plaque(g, x, y, w, h, text, o) {
    o = o || {}
    g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    g.fillStyle = 'rgba(242,235,221,0.95)'; g.fillRect(x, y, w, h)
    g.strokeStyle = PAL.gold; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12)
    g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(x, y, w, h)
    g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = (o.size || h * 0.42) + 'px ' + (o.font || DISPLAY)
    g.fillText(text, x + w / 2, y + h * (o.sub ? 0.42 : 0.52))
    if (o.sub) { g.font = Math.round(h * 0.17) + 'px ' + SERIF; g.fillStyle = PAL.inkSoft; g.fillText(o.sub, x + w / 2, y + h * 0.78) }
    g.restore()
  }

  // ---------- atlas map ----------
  function labelOf(item, lang) { var l = (item && item.label) || {}; return l[lang] || l[String(lang).split('-')[0]] || l.en || l['zh-CN'] || '' }
  function ringPath(g, ring, px) { g.beginPath(); for (var i = 0; i < ring.length; i++) { var q = px(ring[i][0], ring[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) } g.closePath() }
  function linePath(g, pts, px) { g.beginPath(); for (var i = 0; i < pts.length; i++) { var q = px(pts[i][0], pts[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) } }
  /** World texture of a layer: km box [-R, R]² drawn once at size T (cached for the scene). */
  function texture(s, key, R, T, draw) {
    return s.cache('atlas-' + key, T, T, function (c) {
      var k = T / (2 * R)
      var px = function (x, y) { return [(x + R) * k, (R - y) * k] }
      c.lineCap = 'round'; c.lineJoin = 'round'
      draw(c, px, k)
    })
  }
  function textures(s) {
    var geo = s.geo, R = geo.radius_km, Rs = 5.2, Rb = 2.6
    var f = (geo.places || []).filter(function (p) { return p.id === 'navona' })[0]
    return {
      R: R, Rs: Rs, Rb: Rb, bx: f ? f.x : 0, by: f ? f.y : 0,
      builtup: texture(s, 'builtup', R, 4096, function (c, px) {
        c.fillStyle = rgba(PAL.terracotta, 0.55)
        for (var i = 0; i < geo.builtup.length; i++) { ringPath(c, geo.builtup[i], px); c.fill() }
        c.strokeStyle = rgba(PAL.ink, 0.5)
        for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; c.lineWidth = [2.4, 2, 1.5, 1.1][rd.rank]; linePath(c, rd.pts, px); c.stroke() }
      }),
      streets: texture(s, 'streets', Rs, 4096, function (c, px) {
        c.strokeStyle = rgba(PAL.ink, 0.7)
        for (var i = 0; i < geo.streets.length; i++) { var st = geo.streets[i]; c.lineWidth = [1.6, 1.15, 0.7][st.rank]; linePath(c, st.pts, px); c.stroke() }
        for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; c.lineWidth = [3.2, 2.8, 2.2, 1.8][rd.rank]; linePath(c, rd.pts, px); c.stroke() }
      }),
      buildings: texture(s, 'buildings', Rb, 4096, function (c, px) {
        var off = function (x, y) { return px(x - (f ? f.x : 0), y - (f ? f.y : 0)) }
        c.fillStyle = rgba(PAL.terracotta, 0.85); c.strokeStyle = rgba(PAL.ink, 0.55); c.lineWidth = 0.6
        for (var i = 0; i < geo.buildings.length; i++) { ringPath(c, geo.buildings[i], off); c.fill(); c.stroke() }
      }),
    }
  }
  /** Draws a cached world texture through the current view. */
  function blit(g, tex, R, cx, cy, px, alpha) {
    if (alpha <= 0) return
    var a = px(cx - R, cy + R), b = px(cx + R, cy - R)
    g.save(); g.globalAlpha *= alpha
    g.drawImage(tex, a[0], a[1], b[0] - a[0], b[1] - a[1])
    g.restore()
  }
  /** Hachured hill: short radial strokes, darker on the lower right (light from the upper left). */
  function hill(g, x, y, r, seed, alpha) {
    var rr = rng(seed)
    g.save(); g.globalAlpha *= alpha
    for (var i = 0; i < 64; i++) {
      var a = (i / 64) * TAU + rr() * 0.05, inner = r * (0.45 + 0.15 * rr()), outer = r * (0.92 + 0.12 * rr())
      var shade = 0.35 + 0.45 * Math.max(0, Math.cos(a - Math.PI * 0.25))
      g.strokeStyle = rgba(PAL.inkSoft, shade); g.lineWidth = 1.3
      g.beginPath(); g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); g.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); g.stroke()
    }
    var gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r)
    gr.addColorStop(0, 'rgba(250,240,215,0.35)'); gr.addColorStop(1, 'rgba(120,90,50,0.10)')
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.95, 0, TAU); g.fill()
    g.restore()
  }
  function textHalo(g, text, x, y, color, halo) {
    g.lineWidth = halo || 6; g.strokeStyle = rgba(PAL.paper, 0.92); g.lineJoin = 'round'; g.strokeText(text, x, y)
    g.fillStyle = color || PAL.ink; g.fillText(text, x, y)
  }

  /**
   * The Roman atlas map. o: {
   *   view { x, y, km }, lang,
   *   hills: 0..1 (hachured hills with Latin names), latin: bool (Latin sub-labels),
   *   areas [{ id, p (0..1 growth), from: place id (growth origin), fade (0..1 fabric), color: 'scar'|'faded', label: bool, km2: bool }],
   *   walls [{ id, p (0..1 drawn), label: bool }],
   *   modern: 0..1 (today's built-up land, roads and every street),
   *   places [{ id, p, hot, lost, align, dy }], water: 0..1, river: 0..1 (glow) }
   * Returns { px, scale }. Historic areas are approximations: each is tagged "AI 示意 / AI illustration".
   */
  function atlasMap(g, s, o) {
    o = o || {}
    var geo = s.geo, W = s.W, H = s.H, v = o.view || { x: 0, y: 0, km: 4 }, lang = o.lang || s.lang
    var sc = W / (2 * v.km)
    var px = function (x, y) { return [W / 2 + (x - v.x) * sc, H / 2 - (y - v.y) * sc] }
    if (!geo) return { px: px, scale: sc }
    var T = textures(s)
    var zh = /^zh/.test(lang)
    var byId = {}
    ;(geo.places || []).forEach(function (p) { byId[p.id] = p })
    ;(geo.hills || []).forEach(function (p) { byId['hill:' + p.id] = p })
    ;(geo.areas || []).forEach(function (a) { byId['area:' + a.id] = a })
    ;(geo.walls || []).forEach(function (w) { byId['wall:' + w.id] = w })
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
    // countryside: faint field strips so the land outside the city is never blank
    g.drawImage(s.cache('fields', W, H, function (c) {
      var r = rng(91)
      for (var i = 0; i < 260; i++) {
        var x = r() * W, y = r() * H, w = 30 + r() * 90, h = 14 + r() * 40, a = r() * Math.PI
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(120,110,60,' + (0.035 + r() * 0.05).toFixed(3) + ')'; c.fillRect(-w / 2, -h / 2, w, h)
        c.strokeStyle = 'rgba(110,90,50,0.08)'; c.lineWidth = 1; for (var k = -w / 2; k < w / 2; k += 7) { c.beginPath(); c.moveTo(k, -h / 2); c.lineTo(k, h / 2); c.stroke() }
        c.restore()
      }
    }), 0, 0)
    // hills
    var ha = o.hills == null ? 1 : o.hills
    if (ha > 0) for (var hi = 0; hi < (geo.hills || []).length; hi++) { var hh = geo.hills[hi], hp = px(hh.x, hh.y); hill(g, hp[0], hp[1], hh.radius_km * sc, 400 + hi, ha) }
    // today's city
    var md = o.modern || 0
    if (md > 0) {
      blit(g, T.builtup, T.R, 0, 0, px, md * 0.85)
      blit(g, T.streets, T.Rs, 0, 0, px, md * 0.55)
      blit(g, T.buildings, T.Rb, T.bx, T.by, px, md * 0.5)
    }
    // a morphing extent (chronology): the real fabric shows through the city of that year
    if (o.extent && o.extent.ring) {
      var ex = o.extent, ea = ex.alpha == null ? 1 : ex.alpha
      g.save(); ringPath(g, ex.ring, px); g.clip()
      g.fillStyle = rgba(ex.scar ? PAL.cinnabar : PAL.terracotta, (ex.scar ? 0.34 : 0.26) * ea); g.fillRect(0, 0, W, H)
      blit(g, T.streets, T.Rs, 0, 0, px, 0.65 * ea)
      blit(g, T.buildings, T.Rb, T.bx, T.by, px, 0.75 * ea)
      g.restore()
      g.save(); ringPath(g, ex.ring, px); g.strokeStyle = rgba(ex.scar ? PAL.cinnabar : '#6B4A2E', 0.85 * ea); g.lineWidth = 3; g.stroke(); g.restore()
    }
    // historic areas: the real street and building fabric shows through each extent as it grows
    var areas = o.areas || []
    var later = []
    for (var ai = 0; ai < areas.length; ai++) {
      var ar = areas[ai], A = byId['area:' + ar.id]
      if (!A || !A.ring) continue
      var ap = ar.p == null ? 1 : clamp(ar.p, 0, 1)
      if (ap <= 0) continue
      var origin = ar.from && (byId[ar.from] || byId['hill:' + ar.from]) ? (byId[ar.from] || byId['hill:' + ar.from]) : { x: A.x, y: A.y }
      var maxD = 0
      for (var q = 0; q < A.ring.length; q++) maxD = Math.max(maxD, Math.hypot(A.ring[q][0] - origin.x, A.ring[q][1] - origin.y))
      var o0 = px(origin.x, origin.y), rad = ease.out(ap) * maxD * sc * 1.02
      var scar = ar.color === 'scar', faded = ar.color === 'faded'
      var fill = scar ? PAL.cinnabar : faded ? '#9C8A6A' : PAL.terracotta
      g.save()
      ringPath(g, A.ring, px); g.clip()
      if (ap < 1) { g.beginPath(); g.arc(o0[0], o0[1], rad, 0, TAU); g.clip() }
      g.fillStyle = rgba(fill, faded ? 0.16 : 0.26); g.fillRect(0, 0, W, H)
      var fab = ar.fade == null ? 1 : ar.fade
      if (fab > 0) {
        blit(g, T.streets, T.Rs, 0, 0, px, (faded ? 0.25 : 0.65) * fab)
        blit(g, T.buildings, T.Rb, T.bx, T.by, px, (faded ? 0.2 : 0.75) * fab)
      }
      g.restore()
      // boundary
      g.save(); g.globalAlpha *= Math.min(1, ap * 1.6)
      ringPath(g, A.ring, px)
      g.setLineDash(A.source === 'osm-wall' ? [] : [16, 9]); g.strokeStyle = rgba(scar ? PAL.cinnabar : PAL.ink, 0.8); g.lineWidth = A.source === 'osm-wall' ? 2 : 3; g.stroke(); g.setLineDash([])
      g.restore()
      if (ar.label !== false && ap > 0.25) later.push((function (A, ar, ap) { return function () {
        var top = A.ring.reduce(function (m, p) { return p[1] > m[1] ? p : m }, A.ring[0])
        var tp = px(A.x, top[1]), ty = Math.max(H * 0.12, tp[1] - 14), tx = clamp(tp[0], W * 0.14, W * 0.86)
        g.save(); g.globalAlpha *= clamp((ap - 0.25) * 3, 0, 1); g.textAlign = 'center'; g.textBaseline = 'bottom'
        g.font = '30px ' + SERIF; textHalo(g, labelOf(A, lang), tx, ty - 26, PAL.ink)
        var meta = ar.km2 !== false ? '≈ ' + A.km2 + ' km²' : ''
        g.font = '22px ' + SERIF; textHalo(g, meta, tx, ty, PAL.cinnabar, 5)
        g.restore()
      } })(A, ar, ap))
    }
    // water over the fabric
    var wa = o.water == null ? 1 : o.water
    for (var wi = 0; wi < geo.water.length; wi++) { ringPath(g, geo.water[wi], px); g.fillStyle = rgba(PAL.water, 0.95 * wa); g.fill(); g.strokeStyle = rgba(PAL.indigo, 0.8 * wa); g.lineWidth = 1.6; g.stroke() }
    for (var ri = 0; ri < geo.rivers.length; ri++) {
      var rv = geo.rivers[ri]
      linePath(g, rv.pts, px); g.strokeStyle = rgba(PAL.water, 0.9 * wa); g.lineWidth = Math.max(rv.canal ? 2 : 5, (rv.canal ? 0.02 : 0.09) * sc); g.stroke()
      if (o.river) { linePath(g, rv.pts, px); g.strokeStyle = rgba('#CFE6E4', 0.6 * o.river); g.lineWidth = Math.max(10, 0.16 * sc); g.stroke() }
    }
    // walls as masonry with tower ticks
    var walls = o.walls || []
    for (var wj = 0; wj < walls.length; wj++) {
      var wl = walls[wj], Wd = byId['wall:' + wl.id]
      if (!Wd) continue
      var wp = wl.p == null ? 1 : clamp(wl.p, 0, 1)
      var nseg = Math.ceil(Wd.segments.length * ease.inOut(wp))
      g.save()
      for (var si = 0; si < nseg; si++) {
        var seg = Wd.segments[si]
        linePath(g, seg, px); g.strokeStyle = rgba('#6B4A2E', 0.95); g.lineWidth = Math.max(4, 0.03 * sc); g.stroke()
        linePath(g, seg, px); g.strokeStyle = rgba(PAL.gold, 0.9); g.lineWidth = Math.max(1.2, 0.008 * sc); g.stroke()
        for (var ti = 0; ti < seg.length; ti += 3) { var tq = px(seg[ti][0], seg[ti][1]); g.fillStyle = '#6B4A2E'; g.fillRect(tq[0] - 3.5, tq[1] - 3.5, 7, 7) }
      }
      g.restore()
      if (wl.label && wp > 0.6 && Wd.segments.length) {
        var pts = Wd.segments.flat(), ex = pts.reduce(function (m, p) { return p[0] > m[0] ? p : m }, pts[0]), ep = px(ex[0], ex[1])
        g.save(); g.globalAlpha *= clamp((wp - 0.6) * 3, 0, 1); g.font = '28px ' + SERIF; g.textAlign = 'left'; g.textBaseline = 'middle'
        textHalo(g, labelOf(Wd, lang), Math.min(ep[0] + 16, W * 0.8), clamp(ep[1], H * 0.15, H * 0.7), '#6B4A2E'); g.restore()
      }
    }
    for (var li = 0; li < later.length; li++) later[li]()
    // hill names
    if (ha > 0 && o.latin !== false) for (var hn = 0; hn < (geo.hills || []).length; hn++) {
      var H2 = geo.hills[hn], hq = px(H2.x, H2.y)
      if (hq[0] < 0 || hq[0] > W || hq[1] < 0 || hq[1] > H * 0.8) continue
      g.save(); g.globalAlpha *= ha; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '20px ' + DISPLAY; textHalo(g, (H2.label && H2.label.la) || labelOf(H2, 'en').toUpperCase(), hq[0], hq[1] + 14, PAL.inkSoft, 5)
      if (o.hillNames) { g.font = '24px ' + SERIF; textHalo(g, labelOf(H2, lang), hq[0], hq[1] - 14, PAL.ink, 5) }
      g.restore()
    }
    // places
    var places = o.places || []
    for (var pi = 0; pi < places.length; pi++) {
      var pl = places[pi], d = byId[pl.id] || byId['hill:' + pl.id]
      if (!d) continue
      var pp = pl.p == null ? 1 : clamp(pl.p, 0, 1)
      if (pp <= 0) continue
      var pt = px(d.x, d.y), lost = !!pl.lost
      g.save(); g.globalAlpha *= pp
      var r0 = (pl.hot ? 12 : 8) * ease.back(pp)
      g.fillStyle = lost ? '#8A7B66' : PAL.cinnabar; g.beginPath(); g.moveTo(pt[0], pt[1] - r0 * 1.3); g.lineTo(pt[0] + r0, pt[1]); g.lineTo(pt[0], pt[1] + r0 * 1.3); g.lineTo(pt[0] - r0, pt[1]); g.closePath(); g.fill()
      g.strokeStyle = PAL.gold; g.lineWidth = 2; g.stroke()
      if (pl.hot) { var ph = (s.t % 1.6) / 1.6; g.strokeStyle = rgba(PAL.cinnabar, 0.6 * (1 - ph)); g.lineWidth = 3; g.beginPath(); g.arc(pt[0], pt[1], r0 + 8 + 30 * ph, 0, TAU); g.stroke() }
      var lb = labelOf(d, lang), left = pl.align === 'left'
      g.textAlign = left ? 'right' : 'left'; g.textBaseline = 'middle'
      var lx = pt[0] + (left ? -20 : 20), ly = pt[1] + (pl.dy || 0)
      g.font = (pl.hot ? 36 : 30) + 'px ' + SERIF; textHalo(g, lb, lx, ly, lost ? '#7A6A55' : PAL.ink, 7)
      if (o.latin && d.label && d.label.la) { g.font = '19px ' + DISPLAY; textHalo(g, d.label.la, lx, ly + 28, PAL.inkSoft, 5) }
      g.restore()
    }
    g.restore()
    return { px: px, scale: sc }
  }
  /** Area meter: "城区面积（示意）≈ 12.3 km²" with a bar, bottom-left above the caption band. */
  function areaMeter(g, s, km2, max, o) {
    o = o || {}
    if (km2 == null) return
    var zh = /^zh/.test(s.lang), x = o.x || s.W * 0.045, y = o.y || s.H * 0.72, w = s.W * 0.2
    g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    g.fillStyle = 'rgba(242,235,221,0.9)'; g.fillRect(x - 14, y - 52, w + 28, 92)
    g.strokeStyle = PAL.gold; g.lineWidth = 2; g.strokeRect(x - 14, y - 52, w + 28, 92)
    g.fillStyle = PAL.inkSoft; g.font = '22px ' + SERIF; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    g.fillText(zh ? '城区面积（约）' : 'City area (approx.)', x, y - 22)
    g.fillStyle = PAL.ink; g.font = '34px ' + DISPLAY
    g.font = '34px ' + SERIF; g.fillText('≈ ' + km2.toFixed(1) + ' km²', x, y + 16)
    g.fillStyle = rgba(PAL.terracotta, 0.25); g.fillRect(x, y + 26, w, 8)
    g.fillStyle = PAL.terracotta; g.fillRect(x, y + 26, w * clamp(km2 / (max || km2 || 1), 0, 1), 8)
    g.restore()
  }
  /** Era plaque: year and era name, top-left. */
  function eraPlaque(g, s, year, era, p) {
    var a = clamp(p == null ? 1 : p, 0, 1)
    if (a <= 0 || (!year && !era)) return
    var x = s.W * 0.045, y = s.H * 0.07, w = s.W * 0.22, h = s.H * 0.13
    g.save(); g.globalAlpha *= a
    plaque(g, x, y + (1 - ease.out(a)) * -20, w, h, year || era, { size: h * 0.4, sub: year ? era : null, font: /^zh/.test(s.lang) ? SERIF : DISPLAY })
    g.restore()
  }
  /** Map scale bar in km (top-right under the card area is busy; bottom-right above the credit). */
  function scaleBar(g, s, view, o) {
    o = o || {}
    var sc = s.W / (2 * view.km), steps = [0.1, 0.2, 0.5, 1, 2, 5, 10], km = steps[0]
    for (var i = 0; i < steps.length; i++) if (steps[i] * sc <= s.W * 0.12) km = steps[i]
    var w = km * sc, x = o.x == null ? s.W * 0.93 - w : o.x, y = o.y || s.H * 0.9
    g.save(); g.fillStyle = PAL.ink
    g.fillRect(x, y, w / 2, 6); g.fillStyle = PAL.paper; g.fillRect(x + w / 2, y, w / 2, 6); g.strokeStyle = PAL.ink; g.lineWidth = 1.5; g.strokeRect(x, y, w, 6)
    g.fillStyle = PAL.ink; g.font = '20px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(km + ' km', x + w / 2, y - 4)
    g.restore()
  }
  // ---------- chronology: one continuous map driven by a year ----------
  /** Ring resampled to n points by arc length, counter-clockwise, starting at its northernmost point. */
  function resample(ring, n) {
    var r = ring.slice()
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop()
    var area = 0
    for (var i = 0; i < r.length; i++) { var p = r[i], q = r[(i + 1) % r.length]; area += p[0] * q[1] - q[0] * p[1] }
    if (area < 0) r.reverse()
    var top = 0
    for (var j = 1; j < r.length; j++) if (r[j][1] > r[top][1]) top = j
    r = r.slice(top).concat(r.slice(0, top))
    var seg = [], total = 0
    for (var k = 0; k < r.length; k++) { var a = r[k], b = r[(k + 1) % r.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); total += d }
    var out = [], idx = 0, acc = 0
    for (var m = 0; m < n; m++) {
      var target = (m / n) * total
      while (idx < seg.length - 1 && acc + seg[idx] < target) { acc += seg[idx]; idx++ }
      var u = seg[idx] ? (target - acc) / seg[idx] : 0, A = r[idx], B = r[(idx + 1) % r.length]
      out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u])
    }
    return out
  }
  var resampled = {}
  /** City extent at a year: rings of the chronology keyframes morphed into each other. */
  function extentAt(geo, year) {
    var ch = geo.chronology, keys = (ch && ch.extent) || []
    if (!keys.length) return null
    var areas = {}
    ;(geo.areas || []).forEach(function (a) { areas[a.id] = a })
    var ring = function (id) { if (!resampled[id] && areas[id] && areas[id].ring) resampled[id] = resample(areas[id].ring, 240); return resampled[id] }
    if (year <= keys[0].year) return { ring: ring(keys[0].area), id: keys[0].area }
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1]
      if (year >= a.year && year < b.year) {
        var A = ring(a.area), B = ring(b.area)
        if (!A || !B) return null
        var t = ease.inOut((year - a.year) / (b.year - a.year))
        if (a.area === b.area) return { ring: A, id: a.area }
        return { ring: A.map(function (p, k) { return [p[0] + (B[k][0] - p[0]) * t, p[1] + (B[k][1] - p[1]) * t] }), id: t < 0.5 ? a.area : b.area }
      }
    }
    var last = keys[keys.length - 1]
    return { ring: ring(last.area), id: last.area }
  }
  function ringKm2(r) { var a = 0; for (var i = 0; i < r.length; i++) { var p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1] } return Math.abs(a) / 2 }
  /** 0..1 visibility of [from, to] at a year with soft edges of `fade` years. */
  function window01(year, from, to, fade) {
    var f = fade || 40
    var a = clamp((year - from) / f + 1, 0, 1)
    var b = to == null ? 1 : clamp((to - year) / f + 1, 0, 1)
    return Math.min(a, b)
  }
  /** Year label: zh 公元前753年 / 公元275年; en 753 BC / AD 275. */
  function yearText(y, lang) {
    var n = Math.round(y)
    if (/^zh/.test(lang)) return n < 0 ? '公元前' + -n + '年' : (n < 1000 ? '公元' + n + '年' : n + '年')
    return n < 0 ? -n + ' BC' : (n < 1000 ? 'AD ' + n : String(n))
  }
  /** Orthographic globe centred on (lat0, lon0) with radius R px; land from the bundled world rings. */
  function globe(g, s, o) {
    var W = s.W, H = s.H, R = o.R, lat0 = o.lat * Math.PI / 180, lon0 = o.lon * Math.PI / 180
    var cx = W / 2, cy = H / 2
    var proj = function (lon, lat) {
      var l = lon * Math.PI / 180 - lon0, p = lat * Math.PI / 180
      var cosc = Math.sin(lat0) * Math.sin(p) + Math.cos(lat0) * Math.cos(p) * Math.cos(l)
      return [cx + R * Math.cos(p) * Math.sin(l), cy - R * (Math.cos(lat0) * Math.sin(p) - Math.sin(lat0) * Math.cos(p) * Math.cos(l)), cosc]
    }
    g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha
    // deep background and ocean
    g.fillStyle = '#20262B'; g.fillRect(0, 0, W, H)
    var halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.15)
    halo.addColorStop(0, 'rgba(176,138,62,0.35)'); halo.addColorStop(1, 'rgba(176,138,62,0)')
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.15, 0, TAU); g.fill()
    var sea = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    sea.addColorStop(0, '#9DBDBB'); sea.addColorStop(1, '#4F7479')
    g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill()
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip()
    // graticule
    g.strokeStyle = 'rgba(235,221,191,0.25)'; g.lineWidth = 1
    for (var la = -60; la <= 60; la += 30) { g.beginPath(); var on = false; for (var lo = -180; lo <= 180; lo += 4) { var q = proj(lo, la); if (q[2] > 0) { if (on) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); on = true } else on = false } g.stroke() }
    for (var lo2 = -180; lo2 < 180; lo2 += 30) { g.beginPath(); var on2 = false; for (var la2 = -88; la2 <= 88; la2 += 4) { var q2 = proj(lo2, la2); if (q2[2] > 0) { if (on2) g.lineTo(q2[0], q2[1]); else g.moveTo(q2[0], q2[1]); on2 = true } else on2 = false } g.stroke() }
    // land
    var world = (s.geo && s.geo.world) || []
    g.fillStyle = PAL.paper; g.strokeStyle = 'rgba(90,70,45,0.7)'; g.lineWidth = 1.2
    for (var i = 0; i < world.length; i++) {
      var ring = world[i], vis = false
      g.beginPath()
      for (var j = 0; j < ring.length; j++) {
        var p = proj(ring[j][0], ring[j][1])
        if (p[2] < 0) { var k = R / Math.hypot(p[0] - cx, p[1] - cy || 1e-6); p = [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k] } else vis = true
        if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1])
      }
      if (vis) { g.closePath(); g.fill(); g.stroke() }
    }
    var shade = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.2, cx, cy, R)
    shade.addColorStop(0, 'rgba(255,250,235,0.12)'); shade.addColorStop(1, 'rgba(40,30,20,0.35)')
    g.fillStyle = shade; g.fillRect(cx - R, cy - R, 2 * R, 2 * R)
    g.restore()
    g.strokeStyle = PAL.gold; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke()
    // the city pin
    if (o.pin) {
      var c = proj(o.pin.lon, o.pin.lat)
      if (c[2] > 0) {
        var pulse = (s.t % 1.4) / 1.4
        g.strokeStyle = rgba(PAL.cinnabar, 0.8 * (1 - pulse)); g.lineWidth = 3; g.beginPath(); g.arc(c[0], c[1], 10 + 30 * pulse, 0, TAU); g.stroke()
        g.fillStyle = PAL.cinnabar; g.beginPath(); g.arc(c[0], c[1], 9, 0, TAU); g.fill(); g.strokeStyle = PAL.gold; g.lineWidth = 2.5; g.stroke()
        if (o.pin.label) { g.font = '40px ' + SERIF; g.textAlign = 'left'; g.textBaseline = 'middle'; textHalo(g, o.pin.label, c[0] + 22, c[1] - 4, PAL.ink, 8) }
        if (o.pin.sub) { g.font = '22px ' + DISPLAY; g.textAlign = 'left'; textHalo(g, o.pin.sub, c[0] + 24, c[1] + 30, PAL.inkSoft, 6) }
      }
    }
    g.restore()
  }
  /** Timeline across the top: ticks spaced evenly (piecewise-linear years), progress fill and marker. */
  function timelineBar(g, s, year, o) {
    var ch = s.geo && s.geo.chronology
    if (!ch) return
    var ticks = ch.ticks || [ch.range[0], ch.range[1]], lang = s.lang
    var x0 = s.W * 0.33, x1 = s.W * 0.9, y = s.H * 0.085
    var pos = function (yr) {
      if (yr <= ticks[0]) return x0
      for (var i = 0; i < ticks.length - 1; i++) if (yr <= ticks[i + 1]) return x0 + (x1 - x0) * ((i + (yr - ticks[i]) / (ticks[i + 1] - ticks[i])) / (ticks.length - 1))
      return x1
    }
    g.save(); g.globalAlpha *= o && o.alpha != null ? o.alpha : 1
    g.fillStyle = 'rgba(242,235,221,0.88)'; g.fillRect(s.W * 0.03, y - 58, s.W * 0.92, 104)
    g.strokeStyle = PAL.gold; g.lineWidth = 2; g.strokeRect(s.W * 0.03, y - 58, s.W * 0.92, 104)
    g.strokeStyle = rgba(PAL.ink, 0.35); g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke()
    var xp = pos(year)
    g.strokeStyle = PAL.terracotta; g.beginPath(); g.moveTo(x0, y); g.lineTo(xp, y); g.stroke()
    g.font = '18px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'top'
    for (var t = 0; t < ticks.length; t++) {
      var tx = pos(ticks[t]), past = year >= ticks[t]
      g.fillStyle = past ? PAL.terracotta : rgba(PAL.ink, 0.45); g.beginPath(); g.arc(tx, y, past ? 7 : 5, 0, TAU); g.fill()
      g.fillStyle = past ? PAL.ink : rgba(PAL.ink, 0.55); g.fillText(yearText(ticks[t], lang).replace('公元', ''), tx, y + 14)
    }
    g.fillStyle = PAL.cinnabar; g.beginPath(); g.arc(xp, y, 11, 0, TAU); g.fill(); g.strokeStyle = PAL.gold; g.lineWidth = 3; g.stroke()
    // year readout and era
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = PAL.ink
    g.font = '50px ' + (/^zh/.test(lang) ? SERIF : DISPLAY); g.fillText(yearText(year, lang), s.W * 0.045, y - 10)
    var era = null
    ;(ch.eras || []).forEach(function (e) { if (year >= e.from) era = e })
    if (era) { g.font = '24px ' + SERIF; g.fillStyle = PAL.inkSoft; g.fillText(labelOf(era, lang), s.W * 0.047, y + 30) }
    g.restore()
  }
  /** Event card next to its place (or the left margin): title, sub line and a medallion for people. */
  function eventCard(g, s, ev, a, px) {
    if (a <= 0) return
    var lang = s.lang, W = s.W, H = s.H
    var title = labelOf({ label: ev.title }, lang), sub = ev.sub ? labelOf({ label: ev.sub }, lang) : ''
    var anchor = null
    if (ev.place && s.geo) { var p = (s.geo.places || []).concat(s.geo.hills || []).filter(function (q) { return q.id === ev.place })[0]; if (p) anchor = px(p.x, p.y) }
    g.save(); g.globalAlpha *= ease.out(a)
    g.font = '34px ' + SERIF
    var w = Math.max(g.measureText(title).width, (g.font = '22px ' + SERIF, g.measureText(sub).width)) + (ev.kind === 'person' ? 120 : 48), h = sub ? 96 : 66
    var bx = anchor ? clamp(anchor[0] + 60, W * 0.04, W * 0.96 - w) : W * 0.045, by = anchor ? clamp(anchor[1] - h - 70, H * 0.2, H * 0.68) : H * 0.62
    by += (1 - ease.out(a)) * 16
    if (anchor) { g.strokeStyle = rgba(PAL.ink, 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(anchor[0], anchor[1]); g.lineTo(bx + 20, by + h); g.stroke() }
    g.fillStyle = ev.kind === 'scar' ? 'rgba(110,32,24,0.92)' : 'rgba(242,235,221,0.95)'; g.fillRect(bx, by, w, h)
    g.strokeStyle = PAL.gold; g.lineWidth = 2.5; g.strokeRect(bx + 4, by + 4, w - 8, h - 8)
    var tx = bx + 24
    if (ev.kind === 'person') { seal(g, bx + 50, by + h / 2, 52, ev.initial || title.slice(0, 1), {}); tx = bx + 96 }
    g.textAlign = 'left'; g.textBaseline = 'middle'
    g.fillStyle = ev.kind === 'scar' ? PAL.marble : PAL.ink; g.font = '34px ' + SERIF; g.fillText(title, tx, by + (sub ? 34 : h / 2))
    if (sub) { g.fillStyle = ev.kind === 'scar' ? 'rgba(242,235,221,0.85)' : PAL.inkSoft; g.font = '22px ' + SERIF; g.fillText(sub, tx, by + 70) }
    g.restore()
  }
  K.resample = resample; K.extentAt = extentAt; K.ringKm2 = ringKm2; K.window01 = window01; K.yearText = yearText
  K.globe = globe; K.timelineBar = timelineBar; K.eventCard = eventCard
  K.paper = paper; K.seal = seal; K.scrollRod = scrollRod; K.scaleBar = scaleBar
  K.laurel = laurel; K.column = column; K.arch = arch; K.cypress = cypress; K.meander = meander; K.compass = compass; K.plaque = plaque
  K.atlasMap = atlasMap; K.areaMeter = areaMeter; K.eraPlaque = eraPlaque
  K.FONT = { serif: SERIF, display: DISPLAY }
})()
