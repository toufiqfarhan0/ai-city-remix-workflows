/* White-model projection kit (style `model`): the city as a white plaster table model seen in
 * perspective in a dark studio; history is projected onto it as light (soft spotlights for uncertain
 * early settlements, coloured era extents, glowing walls, thin outlines), with a data HUD, a timeline
 * and callouts. Extends the base kit (style/ink-kit.js, loaded first). Deterministic in s.t, no network,
 * no DOM except canvases from s.cache(). Geography: s.geo (OpenStreetMap fabric, Natural Earth land). */
(function () {
  'use strict'
  var K = window.CI_KIT
  var TAU = Math.PI * 2
  var rgba = K.rgba, clamp = K.clamp, ease = K.ease, rng = K.rng
  var SANS = '"Noto Sans SC", "Noto Sans", sans-serif'
  var MONO = '"JetBrains Mono", "Noto Sans SC", monospace'
  var C = { bg: '#0E0F11', model: '#DCDAD5', modelHi: '#F1EFEA', modelLo: '#B9B6AF', groove: 'rgba(40,40,40,0.20)', water: '#141619', text: '#F3F1EC', soft: '#A9A7A1', gold: '#E8C27A' }
  K.PAL.ink = C.text; K.PAL.inkSoft = C.soft; K.PAL.paper = C.bg; K.PAL.cinnabar = '#E2553F'; K.PAL.gold = C.gold

  function labelOf(item, lang) { var l = (item && item.label) || item || {}; return l[lang] || l[String(lang).split('-')[0]] || l.en || l['zh-CN'] || '' }
  /**
   * Perspective camera over the model. view { x, y, km, pitch (deg, 90 = top-down), yaw (deg),
   * ox, oy (screen position of the look-at point as a fraction of W and H; default 0.5, 0.52) }.
   */
  function camera(s, v) {
    var W = s.W, H = s.H
    var pitch = ((v.pitch == null ? 52 : v.pitch) * Math.PI) / 180, yaw = ((v.yaw || 0) * Math.PI) / 180
    var D = v.km * 2.4, f = (W / 2) * D / v.km
    var cs = Math.cos(yaw), sn = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch)
    var ox = W * (v.ox == null ? 0.5 : v.ox), oy = H * (v.oy == null ? 0.52 : v.oy)
    var proj = function (x, y, z) {
      var dx = x - v.x, dy = y - v.y
      var xr = dx * cs - dy * sn, yr = dx * sn + dy * cs
      var depth = D + yr * cp - (z || 0) * sp
      if (depth < D * 0.05) depth = D * 0.05
      return [ox + (f * xr) / depth, oy - (f * (yr * sp + (z || 0) * cp)) / depth, depth]
    }
    return { proj: proj, scale: f / D, pitch: pitch }
  }
  function path(g, pts, P, close) {
    g.beginPath()
    for (var i = 0; i < pts.length; i++) { var q = P(pts[i][0], pts[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) }
    if (close) g.closePath()
  }
  /** Studio background: near-black with a soft pool of light. Cache it. */
  function studio(g, W, H) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H)
    var gr = g.createRadialGradient(W * 0.55, H * 0.55, H * 0.1, W * 0.55, H * 0.55, W * 0.7)
    gr.addColorStop(0, 'rgba(60,62,66,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
  }
  /**
   * The white model: base plate with a side face, water cut out dark, hills shaded, streets as grooves,
   * building blocks raised slightly (light top, darker offset). o.detail 0..1 fades buildings in.
   */
  function model(g, s, cam, o) {
    o = o || {}
    var geo = s.geo, P = cam.proj, R = Math.min(geo.radius_km, o.plate || 6.5), cx = o.cx || 0, cy = o.cy || 0
    var corners = [[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R]]
    // side faces (thickness) then top
    var th = R * 0.04
    g.fillStyle = '#5E5C58'
    for (var i = 0; i < 4; i++) {
      var a = corners[i], b = corners[(i + 1) % 4]
      var p1 = P(a[0], a[1], 0), p2 = P(b[0], b[1], 0), p3 = P(b[0], b[1], -th), p4 = P(a[0], a[1], -th)
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.closePath(); g.fill()
    }
    var top = g.createLinearGradient(0, P(cx, cy + R)[1], 0, P(cx, cy - R)[1])
    top.addColorStop(0, C.modelLo); top.addColorStop(1, C.modelHi)
    g.fillStyle = top; path(g, corners, P, true); g.fill()
    g.save(); path(g, corners, P, true); g.clip()
    // hills: soft shading blobs
    for (var h = 0; h < (geo.hills || []).length; h++) {
      var hl = geo.hills[h], c0 = P(hl.x, hl.y), r = hl.radius_km * cam.scale * (cam.pitch > 0 ? 1 : 1)
      var gr = g.createRadialGradient(c0[0] - r * 0.3, c0[1] - r * 0.3, r * 0.1, c0[0], c0[1], r * 1.1)
      gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.7, 'rgba(120,118,112,0.12)'); gr.addColorStop(1, 'rgba(120,118,112,0)')
      g.fillStyle = gr; g.beginPath(); g.ellipse(c0[0], c0[1], r * 1.1, r * 1.1 * Math.sin(cam.pitch), 0, 0, TAU); g.fill()
    }
    // streets as grooves (LOD by zoom)
    var sc = cam.scale
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.strokeStyle = 'rgba(60,58,54,0.30)'
    for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; g.lineWidth = Math.max(0.6, [0.03, 0.025, 0.018, 0.012][rd.rank] * sc); path(g, rd.pts, P); g.stroke() }
    if (sc > 90) {
      g.strokeStyle = 'rgba(60,58,54,' + (0.22 * clamp((sc - 90) / 120, 0, 1)).toFixed(3) + ')'
      for (var k = 0; k < geo.streets.length; k++) { var st = geo.streets[k]; if (st.rank === 2 && sc < 260) continue; g.lineWidth = Math.max(0.5, 0.008 * sc); path(g, st.pts, P); g.stroke() }
    }
    // buildings
    var bd = (o.detail == null ? 1 : o.detail) * clamp((sc - 120) / 160, 0, 1)
    if (bd > 0) {
      g.fillStyle = 'rgba(120,118,112,' + (0.35 * bd).toFixed(3) + ')'
      for (var m = 0; m < geo.buildings.length; m++) { path(g, geo.buildings[m], function (x, y) { var q = P(x, y); return [q[0] + 1.2, q[1] + 1.6] }, true); g.fill() }
      g.fillStyle = 'rgba(248,247,243,' + (0.9 * bd).toFixed(3) + ')'
      for (var n = 0; n < geo.buildings.length; n++) { path(g, geo.buildings[n], P, true); g.fill() }
    }
    // water: dark cut-outs
    g.fillStyle = C.water
    for (var w = 0; w < geo.water.length; w++) { path(g, geo.water[w], P, true); g.fill() }
    g.strokeStyle = C.water
    for (var rv = 0; rv < geo.rivers.length; rv++) { var river = geo.rivers[rv]; g.lineWidth = Math.max(2, (river.canal ? 0.02 : 0.08) * sc); path(g, river.pts, P); g.stroke() }
    g.restore()
  }
  /** Coloured light projected onto the model inside a ring (era extent). */
  function projectRing(g, s, cam, ring, color, a, o) {
    if (a <= 0 || !ring) return
    o = o || {}
    g.save()
    path(g, ring, cam.proj, true)
    g.globalAlpha = a * (o.fill == null ? 0.62 : o.fill); g.fillStyle = color; g.fill()
    g.globalAlpha = a; g.strokeStyle = o.edge || rgba('#FFFFFF', 0.85); g.lineWidth = 2; g.stroke()
    g.restore()
  }
  /** Soft spotlight on the model (uncertain early sites). */
  function spotlight(g, s, cam, x, y, rkm, color, a) {
    if (a <= 0) return
    var c0 = cam.proj(x, y), r = rkm * cam.scale
    g.save(); g.globalAlpha = a
    var gr = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], r)
    gr.addColorStop(0, rgba(color, 0.85)); gr.addColorStop(0.6, rgba(color, 0.45)); gr.addColorStop(1, rgba(color, 0))
    g.fillStyle = gr; g.beginPath(); g.ellipse(c0[0], c0[1], r, r * Math.sin(cam.pitch), 0, 0, TAU); g.fill()
    g.restore()
  }
  /** Glowing line (walls): wide faint strokes under a bright core. p = drawn fraction of the segments. */
  function glowLines(g, s, cam, segments, color, a, p) {
    if (a <= 0 || !segments) return
    var n = Math.ceil(segments.length * clamp(p == null ? 1 : p, 0, 1))
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
    var widths = [[14, 0.10], [8, 0.22], [3.5, 0.9]]
    for (var w = 0; w < widths.length; w++) {
      g.strokeStyle = rgba(color, widths[w][1] * a); g.lineWidth = widths[w][0]
      for (var i = 0; i < n; i++) { path(g, segments[i], cam.proj); g.stroke() }
    }
    g.restore()
  }
  /** Callout: a dot on the model, a leader line and a small two-line label box. */
  function callout(g, s, cam, x, y, title, sub, a, o) {
    if (a <= 0 || !title) return
    o = o || {}
    var q = cam.proj(x, y), W = s.W, H = s.H
    var dx = o.dx == null ? 70 : o.dx, dy = o.dy == null ? -90 : o.dy
    var bx = clamp(q[0] + dx, W * 0.05, W * 0.86), by = clamp(q[1] + dy, H * 0.16, H * 0.7)
    g.save(); g.globalAlpha = ease.out(a)
    g.fillStyle = o.color || C.gold; g.beginPath(); g.arc(q[0], q[1], 5, 0, TAU); g.fill()
    g.strokeStyle = rgba('#FFFFFF', 0.7); g.lineWidth = 1.2; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(bx, by + 30); g.stroke()
    g.font = '500 30px ' + SANS
    var w = Math.max(g.measureText(title).width, (g.font = '300 21px ' + SANS, g.measureText(sub || '').width)) + 32
    var hh = sub ? 76 : 50
    g.fillStyle = 'rgba(14,15,17,0.82)'; g.fillRect(bx, by, w, hh)
    g.strokeStyle = rgba('#FFFFFF', 0.35); g.lineWidth = 1; g.strokeRect(bx, by, w, hh)
    g.fillStyle = o.color || C.gold; g.fillRect(bx, by, 4, hh)
    g.textAlign = 'left'; g.textBaseline = 'middle'
    g.fillStyle = C.text; g.font = '500 30px ' + SANS; g.fillText(title, bx + 16, by + 25)
    if (sub) { g.fillStyle = C.soft; g.font = '300 21px ' + SANS; g.fillText(sub, bx + 16, by + 56) }
    g.restore()
  }
  /** Data HUD, top-left: monospace lines. */
  function hud(g, s, lines, a) {
    g.save(); g.globalAlpha = a == null ? 1 : a
    g.fillStyle = rgba(C.text, 0.85); g.font = '17px ' + MONO; g.textAlign = 'left'; g.textBaseline = 'top'
    for (var i = 0; i < lines.length; i++) { g.fillStyle = i ? rgba(C.text, 0.5) : rgba(C.text, 0.85); g.fillText(typeof lines[i] === 'string' ? lines[i] : labelOf(lines[i], s.lang), s.W * 0.035, s.H * 0.045 + i * 22) }
    g.restore()
  }
  function yearText(y, lang) {
    var n = Math.round(y)
    if (/^zh/.test(lang)) return n < 0 ? '前' + -n : String(n)
    return n < 0 ? -n + ' BC' : n < 1000 ? 'AD ' + n : String(n)
  }
  /** Big year with era name and one descriptive line, left middle. */
  function yearBlock(g, s, year, era, line, a) {
    if (a <= 0) return
    var x = s.W * 0.04, y = s.H * 0.42, zh = /^zh/.test(s.lang)
    g.save(); g.globalAlpha = a; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    if (era) { g.fillStyle = C.gold; g.fillRect(x, y - 108, 22, 2); g.fillStyle = rgba(C.text, 0.85); g.font = '18px ' + MONO; g.fillText(era.code || '', x, y - 118); g.font = '500 28px ' + SANS; g.fillText(labelOf(era, s.lang), x + 34, y - 98) }
    g.fillStyle = C.text; g.font = '400 104px ' + SANS
    var yt = yearText(year, s.lang)
    g.fillText(yt, x, y)
    if (zh && year < 0) { /* prefix already in text */ }
    if (line) { g.fillStyle = rgba(C.text, 0.9); g.font = '400 28px ' + SANS; g.fillText(line, x, y + 46) }
    g.restore()
  }
  /** Timeline above the caption: thin rule, node ticks, progress and marker. */
  function timeline(g, s, year, ch, a) {
    if (!ch || a <= 0) return
    var ticks = ch.ticks || [ch.range[0], ch.range[1]]
    var x0 = s.W * 0.06, x1 = s.W * 0.94, y = s.H * 0.8
    var pos = function (yr) {
      if (yr <= ticks[0]) return x0
      for (var i = 0; i < ticks.length - 1; i++) if (yr <= ticks[i + 1]) return x0 + (x1 - x0) * ((i + (yr - ticks[i]) / (ticks[i + 1] - ticks[i])) / (ticks.length - 1))
      return x1
    }
    g.save(); g.globalAlpha = a
    g.strokeStyle = rgba(C.text, 0.25); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke()
    var xp = pos(year)
    g.strokeStyle = C.gold; g.beginPath(); g.moveTo(x0, y); g.lineTo(xp, y); g.stroke()
    g.font = '17px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'top'
    for (var t = 0; t < ticks.length; t++) {
      var tx = pos(ticks[t]), past = year >= ticks[t] - 0.5
      g.fillStyle = past ? C.gold : rgba(C.text, 0.4); g.fillRect(tx - 1, y - 6, 2, 12)
      g.fillStyle = past ? rgba(C.text, 0.85) : rgba(C.text, 0.4); g.fillText(ticks[t] < 0 ? -ticks[t] + ' BC' : String(ticks[t]), tx, y + 10)
    }
    g.fillStyle = C.gold; g.beginPath(); g.arc(xp, y, 6, 0, TAU); g.fill()
    g.restore()
  }
  /** Dark globe (orthographic) with Natural Earth land in model white, for the fly-in and fly-out. */
  var LAND = null
  /** Equirectangular land mask (4096 × 2048, one byte per pixel) from Natural Earth rings, built once. */
  function landMask(world) {
    if (LAND) return LAND
    var Wt = 4096, Ht = 2048, c = document.createElement('canvas'); c.width = Wt; c.height = Ht
    var t = c.getContext('2d'); t.fillStyle = '#000'; t.fillRect(0, 0, Wt, Ht); t.fillStyle = '#fff'
    for (var off = -360; off <= 360; off += 360) {
      t.beginPath()
      for (var i = 0; i < world.length; i++) {
        var ring = world[i], prev = null
        for (var j = 0; j < ring.length; j++) {
          var lon = ring[j][0]
          if (prev != null) { while (lon - prev > 180) lon -= 360; while (prev - lon > 180) lon += 360 }
          prev = lon
          var x = ((lon + off + 180) / 360) * Wt, y = ((90 - ring[j][1]) / 180) * Ht
          if (j) t.lineTo(x, y); else t.moveTo(x, y)
        }
        t.closePath()
      }
      t.fill('evenodd')
    }
    var d = t.getImageData(0, 0, Wt, Ht).data, m = new Uint8Array(Wt * Ht)
    for (var k = 0; k < m.length; k++) m[k] = d[k * 4]
    LAND = { m: m, W: Wt, H: Ht }
    return LAND
  }
  /** A finer land mask (2048², 16° square, about 0.9 km per pixel) around one point, for the low flat map. */
  var LOCAL = {}
  function localMask(world, lat, lon) {
    var key = lat.toFixed(2) + ',' + lon.toFixed(2)
    if (LOCAL[key]) return LOCAL[key]
    var N = 2048, span = 16, lon0 = lon - span / 2, lat1 = lat + span / 2
    var c = document.createElement('canvas'); c.width = N; c.height = N
    var t = c.getContext('2d'); t.fillStyle = '#000'; t.fillRect(0, 0, N, N); t.fillStyle = '#fff'; t.beginPath()
    for (var i = 0; i < world.length; i++) {
      var ring = world[i], near = false
      for (var j = 0; j < ring.length && !near; j += 2) if (Math.abs(ring[j][0] - lon) < span && Math.abs(ring[j][1] - lat) < span) near = true
      if (!near) continue
      for (var q = 0; q < ring.length; q++) { var x = (ring[q][0] - lon0) / span * N, y = (lat1 - ring[q][1]) / span * N; if (q) t.lineTo(x, y); else t.moveTo(x, y) }
      t.closePath()
    }
    t.fill('evenodd')
    var d = t.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N)
    for (var k = 0; k < m.length; k++) m[k] = d[k * 4]
    LOCAL[key] = { m: m, N: N, lon0: lon0, lat1: lat1, span: span }
    return LOCAL[key]
  }
  function rasterLand(g, s, cx, cy, R, lat0, lon0) {
    var W = s.W, H = s.H, L = landMask((s.geo && s.geo.world) || [])
    var x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H, Math.ceil(cy + R))
    if (x1 <= x0 || y1 <= y0) return
    var buf = s.cache('globe-land', W, H, function () {}), bc = buf.getContext('2d')
    var img = bc.createImageData(x1 - x0, y1 - y0), px = img.data
    var sp0 = Math.sin(lat0), cp0 = Math.cos(lat0), iR = 1 / R, k2 = 180 / Math.PI
    var land = [207, 204, 198]
    for (var y = y0; y < y1; y++) {
      var Y = (cy - (y + 0.5)) * iR
      for (var x = x0; x < x1; x++) {
        var X = (x + 0.5 - cx) * iR, r2 = X * X + Y * Y, o = ((y - y0) * (x1 - x0) + (x - x0)) * 4
        if (r2 >= 1) { px[o + 3] = 0; continue }
        var Z = Math.sqrt(1 - r2)
        var lat = Math.asin(Y * cp0 + Z * sp0) * k2, lon = (lon0 + Math.atan2(X, Z * cp0 - Y * sp0)) * k2
        // bilinear lookup of the mask
        var u = ((((lon + 180) % 360) + 360) % 360) / 360 * L.W - 0.5, v = (90 - lat) / 180 * L.H - 0.5
        var iu = Math.floor(u), iv = Math.max(0, Math.min(L.H - 2, Math.floor(v))), fu = u - iu, fv = v - iv
        var a = (iu % L.W + L.W) % L.W, b = (a + 1) % L.W, row = iv * L.W, row2 = row + L.W
        var mval = ((L.m[row + a] * (1 - fu) + L.m[row + b] * fu) * (1 - fv) + (L.m[row2 + a] * (1 - fu) + L.m[row2 + b] * fu) * fv) / 255
        px[o] = land[0]; px[o + 1] = land[1]; px[o + 2] = land[2]; px[o + 3] = Math.round(255 * mval)
      }
    }
    bc.clearRect(0, 0, W, H); bc.putImageData(img, x0, y0)
    g.drawImage(buf, 0, 0)
  }
  function globe(g, s, o) {
    var W = s.W, H = s.H, R = o.R, lat0 = o.lat * Math.PI / 180, lon0 = o.lon * Math.PI / 180, cx = W / 2, cy = H / 2
    var proj = function (lon, lat) {
      var l = lon * Math.PI / 180 - lon0, p = lat * Math.PI / 180
      return [cx + R * Math.cos(p) * Math.sin(l), cy - R * (Math.cos(lat0) * Math.sin(p) - Math.sin(lat0) * Math.cos(p) * Math.cos(l)), Math.sin(lat0) * Math.sin(p) + Math.cos(lat0) * Math.cos(p) * Math.cos(l)]
    }
    g.save(); g.globalAlpha = o.alpha == null ? 1 : o.alpha
    var sea = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    sea.addColorStop(0, '#2B2E33'); sea.addColorStop(1, '#16181B')
    g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill()
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip()
    g.strokeStyle = 'rgba(243,241,236,0.10)'; g.lineWidth = 1
    for (var la = -60; la <= 60; la += 30) { g.beginPath(); var on = false; for (var lo = -180; lo <= 180; lo += 3) { var q = proj(lo, la); if (q[2] > 0) { if (on) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); on = true } else on = false } g.stroke() }
    for (var lo2 = -180; lo2 < 180; lo2 += 30) { g.beginPath(); var on2 = false; for (var la2 = -88; la2 <= 88; la2 += 3) { var q2 = proj(lo2, la2); if (q2[2] > 0) { if (on2) g.lineTo(q2[0], q2[1]); else g.moveTo(q2[0], q2[1]); on2 = true } else on2 = false } g.stroke() }
    // land is a raster: every visible pixel is projected back to lon/lat and looked up in an
    // equirectangular land mask, so coastlines stay whole however the globe is turned or scaled
    rasterLand(g, s, cx, cy, R, lat0, lon0)
    var shade = g.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.2, cx, cy, R)
    shade.addColorStop(0, 'rgba(255,255,255,0.10)'); shade.addColorStop(1, 'rgba(0,0,0,0.55)')
    g.fillStyle = shade; g.fillRect(cx - R, cy - R, 2 * R, 2 * R)
    g.restore()
    g.strokeStyle = 'rgba(243,241,236,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke()
    if (o.pin) {
      var c = proj(o.pin.lon, o.pin.lat)
      if (c[2] > 0) {
        var ph = (s.t % 1.4) / 1.4
        g.strokeStyle = rgba(C.gold, 0.85 * (1 - ph)); g.lineWidth = 2.5; g.beginPath(); g.arc(c[0], c[1], 8 + 34 * ph, 0, TAU); g.stroke()
        g.fillStyle = C.gold; g.beginPath(); g.arc(c[0], c[1], 6, 0, TAU); g.fill()
        g.strokeStyle = rgba('#FFFFFF', 0.7); g.lineWidth = 1.2; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0] + 90, c[1] - 70); g.lineTo(c[0] + 260, c[1] - 70); g.stroke()
        g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = C.text; g.font = '500 34px ' + SANS; g.fillText(o.pin.label || '', c[0] + 96, c[1] - 76)
        g.fillStyle = C.soft; g.font = '15px ' + MONO; g.textBaseline = 'top'; g.fillText(o.pin.sub || '', c[0] + 96, c[1] - 62)
      }
    }
    g.restore()
  }
  /**
   * Flat land map around a point (local equirectangular projection), for the part of the fly-in where
   * the globe is larger than the frame: no horizon, so coastlines never jump. km = visible width.
   */
  function flatMap(g, s, o) {
    var W = s.W, H = s.H, lat0 = o.lat * Math.PI / 180, kx = 111.32 * Math.cos(lat0), ky = 110.57
    g.save(); g.globalAlpha = o.alpha == null ? 1 : o.alpha
    // same raster land mask and palette as the globe, so the hand-over is seamless; the land darkens
    // towards the stage tone as the camera nears the city, so the 3D model (which fades into a dark
    // fog) emerges from it instead of sitting on a bright square
    var L = landMask((s.geo && s.geo.world) || []), w = Math.ceil(W / 2), h = Math.ceil(H / 2)
    var buf = s.cache('flat-land', w, h, function () {}), bc = buf.getContext('2d'), img = bc.createImageData(w, h), px = img.data
    var dk = o.dark == null ? 0 : clamp(o.dark, 0, 1)
    var land = [207 + (30 - 207) * dk, 204 + (30 - 204) * dk, 198 + (32 - 198) * dk], sea = [27 - 13 * dk, 29 - 14 * dk, 33 - 15 * dk]
    var kmPx = o.km / w
    // close in, a finer mask around the city keeps the coast sharp
    var Lc = o.local && o.km < 2500 ? localMask((s.geo && s.geo.world) || [], o.local.lat, o.local.lon) : null
    for (var y = 0; y < h; y++) {
      var lat = o.lat - ((y + 0.5) - h / 2) * kmPx / ky
      var v = (90 - lat) / 180 * L.H - 0.5, iv = Math.max(0, Math.min(L.H - 2, Math.floor(v))), fv = v - iv, row = iv * L.W, row2 = row + L.W
      var lv = Lc ? (Lc.lat1 - lat) / Lc.span * Lc.N - 0.5 : -1, ilv = Math.floor(lv), flv = lv - ilv
      for (var x = 0; x < w; x++) {
        var lon = o.lon + ((x + 0.5) - w / 2) * kmPx / kx, m
        var lu = Lc ? (lon - Lc.lon0) / Lc.span * Lc.N - 0.5 : -1
        if (Lc && lu >= 0 && lu < Lc.N - 1 && lv >= 0 && lv < Lc.N - 1) {
          var ilu = Math.floor(lu), flu = lu - ilu, r0 = ilv * Lc.N + ilu, r1 = r0 + Lc.N
          m = ((Lc.m[r0] * (1 - flu) + Lc.m[r0 + 1] * flu) * (1 - flv) + (Lc.m[r1] * (1 - flu) + Lc.m[r1 + 1] * flu) * flv) / 255
        } else {
          var u = ((((lon + 180) % 360) + 360) % 360) / 360 * L.W - 0.5, iu = Math.floor(u), fu = u - iu
          var a = (iu % L.W + L.W) % L.W, b = (a + 1) % L.W
          m = ((L.m[row + a] * (1 - fu) + L.m[row + b] * fu) * (1 - fv) + (L.m[row2 + a] * (1 - fu) + L.m[row2 + b] * fu) * fv) / 255
        }
        var p = (y * w + x) * 4
        px[p] = sea[0] + (land[0] - sea[0]) * m; px[p + 1] = sea[1] + (land[1] - sea[1]) * m; px[p + 2] = sea[2] + (land[2] - sea[2]) * m; px[p + 3] = 255
      }
    }
    bc.putImageData(img, 0, 0)
    g.imageSmoothingEnabled = true; g.drawImage(buf, 0, 0, w, h, 0, 0, W, H)
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)')
    g.fillStyle = vg; g.fillRect(0, 0, W, H)
    g.restore()
  }
  K.flatMap = flatMap
  K.window01 = function (year, from, to, fade) { var f = fade || 40; var a = clamp((year - from) / f + 1, 0, 1); var b = to == null ? 1 : clamp((to - year) / f + 1, 0, 1); return Math.min(a, b) }
  /**
   * The whole white model rendered once for a fixed camera at 2× resolution (cache it): plate with a
   * side face, soft hills, street grooves, every building extruded a little (lit top, shaded side) and
   * the river cut out dark. The film never moves this camera; shots zoom into parts of this image.
   */
  function renderModel(c, geo, v, W2, H2, plateKm) {
    var cam = camera({ W: W2, H: H2 }, v), P = cam.proj, R = plateKm, sc = cam.scale
    studio(c, W2, H2)
    var corners = [[-R, -R], [R, -R], [R, R], [-R, R]]
    var th = R * 0.035
    for (var i = 0; i < 4; i++) {
      var a = corners[i], b = corners[(i + 1) % 4]
      var p1 = P(a[0], a[1], 0), p2 = P(b[0], b[1], 0), p3 = P(b[0], b[1], -th), p4 = P(a[0], a[1], -th)
      c.fillStyle = i === 0 ? '#8C8A85' : '#55534F'
      c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); c.fill()
    }
    var near = P(0, -R), far = P(0, R)
    var top = c.createLinearGradient(0, near[1], 0, far[1])
    top.addColorStop(0, '#CFCCC6'); top.addColorStop(1, '#E9E7E2')
    c.fillStyle = top; path(c, corners, P, true); c.fill()
    c.save(); path(c, corners, P, true); c.clip()
    for (var h = 0; h < (geo.hills || []).length; h++) {
      var hl = geo.hills[h], c0 = P(hl.x, hl.y), r = hl.radius_km * sc
      var gr = c.createRadialGradient(c0[0] - r * 0.35, c0[1] - r * 0.3, r * 0.05, c0[0], c0[1], r * 1.2)
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(150,146,140,0.18)'); gr.addColorStop(1, 'rgba(150,146,140,0)')
      c.fillStyle = gr; c.beginPath(); c.ellipse(c0[0], c0[1], r * 1.2, r * 1.2 * Math.sin(cam.pitch), 0, 0, TAU); c.fill()
    }
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.strokeStyle = 'rgba(120,116,110,0.55)'
    for (var k = 0; k < geo.streets.length; k++) { var st = geo.streets[k]; c.lineWidth = [2.2, 1.5, 1][st.rank]; path(c, st.pts, P); c.stroke() }
    c.strokeStyle = 'rgba(95,92,87,0.75)'
    for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; c.lineWidth = [5, 4.2, 3.4, 2.6][rd.rank]; path(c, rd.pts, P); c.stroke() }
    // buildings: shadow footprint, then the roof lifted by a height that varies per block
    var hgt = function (r) { var x = r[0][0], y = r[0][1]; return 0.006 + 0.012 * ((Math.abs(Math.sin(x * 91.7 + y * 37.3)) * 1000) % 1) }
    var bs = geo.buildings
    c.fillStyle = 'rgba(70,68,64,0.45)'
    for (var m = 0; m < bs.length; m++) { path(c, bs[m], P, true); c.fill() }
    for (var n = 0; n < bs.length; n++) {
      var z = hgt(bs[n])
      path(c, bs[n], function (x, y) { return P(x, y, z) }, true)
      c.fillStyle = '#F7F6F2'; c.fill()
      c.strokeStyle = 'rgba(140,136,130,0.55)'; c.lineWidth = 0.8; c.stroke()
    }
    c.fillStyle = '#17191C'
    for (var w = 0; w < geo.water.length; w++) { path(c, geo.water[w], P, true); c.fill() }
    c.strokeStyle = '#17191C'
    for (var rv = 0; rv < geo.rivers.length; rv++) { var river = geo.rivers[rv]; c.lineWidth = Math.max(4, (river.canal ? 0.02 : 0.085) * sc); path(c, river.pts, P); c.stroke() }
    // fade the far edge of the plate into the studio light
    c.restore()
    var fog = c.createLinearGradient(0, far[1], 0, far[1] + H2 * 0.22)
    fog.addColorStop(0, 'rgba(14,15,17,0.55)'); fog.addColorStop(1, 'rgba(14,15,17,0)')
    c.fillStyle = fog; c.fillRect(0, 0, W2, far[1] + H2 * 0.22)
  }
  /** Screen transform of a zoom: the anchor (screen px) stays put while everything scales by z. */
  // With a target, the anchor moves to that screen point (used to bring a zoomed-in part into the
  // clear area right of the HUD and above the caption band).
  function zoomXf(anchor, z, target) { var t = target || anchor; return function (q) { return [t[0] + (q[0] - anchor[0]) * z, t[1] + (q[1] - anchor[1]) * z] } }
  /** Label with a dark halo-free plate: readable on the white model. */
  function tag(g, x, y, text, o) {
    o = o || {}
    var size = o.size || 26
    g.save(); g.font = (o.weight || 500) + ' ' + size + 'px ' + SANS; g.textBaseline = 'middle'; g.textAlign = 'left'
    var w = g.measureText(text).width
    var bx = x + (o.left ? -w - 26 : 14), by = y - size * 0.75
    g.fillStyle = o.bg || 'rgba(20,21,24,0.86)'; g.fillRect(bx, by, w + 16, size * 1.5)
    g.fillStyle = o.color || C.text; g.fillText(text, bx + 8, y)
    g.fillStyle = o.dot || C.gold; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.strokeStyle = '#141518'; g.lineWidth = 2; g.stroke()
    g.restore()
    return [bx, by, w + 16, size * 1.5]
  }
  /**
   * "Search and locate" on a point: crosshair lines sweep in, two rings shrink onto the target and a
   * pulse stays. p 0..1 over about one beat. Returns nothing.
   */
  function locate(g, s, q, p, color) {
    var W = s.W, H = s.H, col = color || C.gold
    if (p <= 0) return
    var e = ease.out(clamp(p, 0, 1))
    g.save()
    g.strokeStyle = rgba(col, 0.55 * (1 - e * 0.6)); g.lineWidth = 1.2
    g.beginPath(); g.moveTo(q[0] - W * (1 - e) - 30, q[1]); g.lineTo(q[0] - 30, q[1]); g.moveTo(q[0] + 30, q[1]); g.lineTo(q[0] + 30 + W * (1 - e), q[1])
    g.moveTo(q[0], q[1] - H * (1 - e) - 30); g.lineTo(q[0], q[1] - 30); g.moveTo(q[0], q[1] + 30); g.lineTo(q[0], q[1] + 30 + H * (1 - e)); g.stroke()
    for (var i = 0; i < 2; i++) {
      var r = 26 + (1 - e) * (220 + i * 160)
      g.strokeStyle = rgba(col, (0.9 - i * 0.35) * clamp(p * 3, 0, 1)); g.lineWidth = 2.5 - i
      g.beginPath(); g.arc(q[0], q[1], r, 0, TAU); g.stroke()
    }
    // corner brackets
    var b = 40 + (1 - e) * 60, L = 14
    g.strokeStyle = rgba(col, 0.95); g.lineWidth = 2.5
    ;[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      g.beginPath(); g.moveTo(q[0] + c[0] * b, q[1] + c[1] * (b - L)); g.lineTo(q[0] + c[0] * b, q[1] + c[1] * b); g.lineTo(q[0] + c[0] * (b - L), q[1] + c[1] * b); g.stroke()
    })
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(q[0], q[1], 7, 0, TAU); g.fill()
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1], 12, 0, TAU); g.stroke()
    g.restore()
  }
  /**
   * The photograph re-toned to sit on the white model in the dark studio, in code only (canvas filters
   * and blend modes, no pixel read-back, no image model): monochrome plaster tone with graphite
   * shadows, a soft wash of the accent colour, vignette and fine grain. Cached per photo and size.
   */
  function photoPlate(s, ph, img, sx, sy, sw, sh, w, h, accent) {
    var key = 'photo:' + (ph.id || ph.src || ph.credit) + ':' + Math.round(w) + 'x' + Math.round(h) + ':' + accent
    return s.cache(key, Math.round(w), Math.round(h), function (c) {
      c.filter = 'grayscale(1) contrast(1.1) brightness(1.16)'
      c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
      c.filter = 'none'
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#EEE8DC'; c.fillRect(0, 0, w, h)
      c.globalCompositeOperation = 'screen'; c.fillStyle = '#20242B'; c.fillRect(0, 0, w, h)
      var wash = c.createLinearGradient(0, h, w, 0)
      wash.addColorStop(0, rgba(accent, 0.55)); wash.addColorStop(0.6, rgba(accent, 0.12)); wash.addColorStop(1, rgba(accent, 0))
      c.globalCompositeOperation = 'soft-light'; c.fillStyle = wash; c.fillRect(0, 0, w, h)
      c.globalCompositeOperation = 'source-over'
      var vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.75)
      vg.addColorStop(0, 'rgba(14,15,17,0)'); vg.addColorStop(1, 'rgba(14,15,17,0.6)')
      c.fillStyle = vg; c.fillRect(0, 0, w, h)
      var r = rng(7), n = Math.round(w * h / 90)
      for (var i = 0; i < n; i++) { var v = r() < 0.5 ? 0 : 255; c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + r() * 0.06).toFixed(3) + ')'; c.fillRect(r() * w, r() * h, 1.2, 1.2) }
    })
  }
  /** Photo card (dark glass, gold rule): re-toned photo with its credit, Chinese name, English name. */
  function photoCard(g, s, q, ph, title, en, a, o) {
    if (a <= 0 || !ph) return
    o = o || {}
    var W = s.W, H = s.H, cw = o.w || 520
    var img = ph.img, ih = Math.round(cw * Math.min(0.68, img.naturalHeight / img.naturalWidth)), ch = ih + 112
    var right = q[0] < W * 0.62
    var bx = clamp(right ? q[0] + 90 : q[0] - 90 - cw, W * 0.36, W * 0.97 - cw)
    var by = clamp(q[1] - ch - 40, H * 0.05, H * 0.72 - ch)
    var e = ease.out(clamp(a, 0, 1))
    g.save(); g.globalAlpha = e
    // leader
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6
    g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(right ? bx : bx + cw, by + ch - 36); g.stroke()
    var dy = (1 - e) * 24
    g.fillStyle = 'rgba(16,17,20,0.94)'; g.fillRect(bx, by + dy, cw, ch)
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + dy + 0.5, cw - 1, ch - 1)
    // photo cropped to the frame (cover)
    var ar = img.naturalWidth / img.naturalHeight, fw = cw - 16, fh = ih - 8
    var sw = img.naturalWidth, sh = img.naturalHeight
    if (sw / sh > fw / fh) { sw = sh * fw / fh } else { sh = sw * fh / fw }
    var px = bx + 8, py = by + dy + 8
    g.drawImage(photoPlate(s, ph, img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, fw, fh, o.color || C.gold), px, py, fw, fh)
    // corner brackets, the same mark the locate animation uses
    g.strokeStyle = rgba('#FFFFFF', 0.8); g.lineWidth = 2
    ;[[0, 0, 1, 1], [fw, 0, -1, 1], [fw, fh, -1, -1], [0, fh, 1, -1]].forEach(function (c) {
      g.beginPath(); g.moveTo(px + c[0] + c[2] * 6, py + c[1] + c[3] * 22); g.lineTo(px + c[0] + c[2] * 6, py + c[1] + c[3] * 6); g.lineTo(px + c[0] + c[2] * 22, py + c[1] + c[3] * 6); g.stroke()
    })
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(bx + 8, by + dy + ih - 30, fw, 30)
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.font = '15px ' + SANS; g.textAlign = 'left'; g.textBaseline = 'middle'
    g.fillText(ph.credit, bx + 18, by + dy + ih - 15)
    g.fillStyle = o.color || C.gold; g.fillRect(bx + 8, by + dy + ih + 16, 4, 78)
    g.fillStyle = C.text; g.font = '500 38px ' + SANS; g.textBaseline = 'alphabetic'; g.fillText(title, bx + 28, by + dy + ih + 56)
    if (en) { g.fillStyle = C.soft; g.font = '400 22px ' + SANS; g.fillText(en, bx + 28, by + dy + ih + 90) }
    g.restore()
  }
  /** Dashed outline around a hill with a soft lift, so "the hills by the river" is visible. */
  function hillMark(g, cam, P, hl, z, a, color) {
    if (a <= 0) return
    var c0 = P(hl.x, hl.y), r = hl.radius_km * cam.scale * z
    g.save(); g.globalAlpha = a
    g.fillStyle = rgba(color || C.gold, 0.18); g.beginPath(); g.ellipse(c0[0], c0[1], r, r * Math.sin(cam.pitch), 0, 0, TAU); g.fill()
    g.setLineDash([10, 7]); g.strokeStyle = rgba(color || C.gold, 0.95); g.lineWidth = 2.5
    g.beginPath(); g.ellipse(c0[0], c0[1], r, r * Math.sin(cam.pitch), 0, 0, TAU * clamp(a * 1.3, 0, 1)); g.stroke()
    g.restore()
  }
  // ───────────────────────── projection on a dark model (v2) ─────────────────────────
  var DARK = { void: '#050506', plateNear: '#24262A', plateFar: '#2E3035', side0: '#141517', side1: '#0E0F10', street: 'rgba(255,255,255,0.055)', road: 'rgba(255,255,255,0.10)', shadow: 'rgba(0,0,0,0.55)', roof: '#383A3F', edge: 'rgba(255,255,255,0.07)', water: '#060708' }
  /** Black void with a faint top light: the stage of the dark model. */
  function voidStage(g, W, H) {
    g.fillStyle = DARK.void; g.fillRect(0, 0, W, H)
    var gr = g.createRadialGradient(W * 0.6, H * 0.35, H * 0.1, W * 0.6, H * 0.35, W * 0.75)
    gr.addColorStop(0, 'rgba(40,42,46,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
  }
  /** Heights ramp (metres → colour): indigo → violet → magenta → pink, like a satellite height map. */
  function heightColor(h) {
    var st = [[0, [52, 38, 110]], [12, [96, 58, 196]], [24, [168, 70, 214]], [45, [236, 92, 196]], [90, [255, 170, 214]]]
    if (h == null) return 'rgb(58,60,66)'
    for (var i = 0; i < st.length - 1; i++) if (h <= st[i + 1][0]) { var t = (h - st[i][0]) / (st[i + 1][0] - st[i][0]), a = st[i][1], b = st[i + 1][1]; return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')' }
    return 'rgb(255,170,214)'
  }
  /**
   * The model for a fixed camera, rendered once (cache it). tone 'light' = white plaster (lit areas and
   * the opening), 'dark' = graphite (the stage history is projected on), 'heights' = graphite with every
   * building extruded to its OpenStreetMap height (× exaggerate) and coloured by height.
   */
  function renderModelTone(c, geo, v, W2, H2, plateKm, tone, exaggerate) {
    if (tone === 'light') return renderModel(c, geo, v, W2, H2, plateKm)
    var cam = camera({ W: W2, H: H2 }, v), P = cam.proj, R = plateKm, sc = cam.scale
    voidStage(c, W2, H2)
    var corners = [[-R, -R], [R, -R], [R, R], [-R, R]], th = R * 0.035
    for (var i = 0; i < 4; i++) {
      var a = corners[i], b = corners[(i + 1) % 4]
      var p1 = P(a[0], a[1], 0), p2 = P(b[0], b[1], 0), p3 = P(b[0], b[1], -th), p4 = P(a[0], a[1], -th)
      c.fillStyle = i === 0 ? DARK.side0 : DARK.side1
      c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); c.fill()
    }
    var near = P(0, -R), far = P(0, R)
    var top = c.createLinearGradient(0, near[1], 0, far[1])
    top.addColorStop(0, DARK.plateNear); top.addColorStop(1, DARK.plateFar)
    c.fillStyle = top; path(c, corners, P, true); c.fill()
    c.save(); path(c, corners, P, true); c.clip()
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.strokeStyle = DARK.street
    for (var k = 0; k < geo.streets.length; k++) { var st = geo.streets[k]; c.lineWidth = [2.2, 1.5, 1][st.rank]; path(c, st.pts, P); c.stroke() }
    c.strokeStyle = DARK.road
    for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; c.lineWidth = [5, 4.2, 3.4, 2.6][rd.rank]; path(c, rd.pts, P); c.stroke() }
    var bs = geo.buildings, hs = geo.heights || []
    var ex = exaggerate || 1
    var zOf = tone === 'heights'
      ? function (m) { return ((hs[m] == null ? 6 : hs[m]) / 1000) * ex }
      : function (m) { var r = bs[m]; return 0.006 + 0.012 * ((Math.abs(Math.sin(r[0][0] * 91.7 + r[0][1] * 37.3)) * 1000) % 1) }
    c.fillStyle = DARK.shadow
    for (var m = 0; m < bs.length; m++) { path(c, bs[m], P, true); c.fill() }
    // far to near so nearer blocks cover farther ones
    var order = []
    for (var o = 0; o < bs.length; o++) { var b0 = bs[o][0]; order.push([P(b0[0], b0[1])[2], o]) }
    order.sort(function (x, y) { return y[0] - x[0] })
    for (var q = 0; q < order.length; q++) {
      var n = order[q][1], ring = bs[n], z = zOf(n)
      if (tone === 'heights') {
        var col = heightColor(hs[n])
        // side walls: darker version of the roof colour
        c.fillStyle = hs[n] == null ? 'rgb(36,38,42)' : col.replace('rgb(', 'rgba(').replace(')', ',0.55)')
        for (var e = 0; e < ring.length - 1; e++) {
          var A = P(ring[e][0], ring[e][1], 0), B = P(ring[e + 1][0], ring[e + 1][1], 0), Bt = P(ring[e + 1][0], ring[e + 1][1], z), At = P(ring[e][0], ring[e][1], z)
          c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(Bt[0], Bt[1]); c.lineTo(At[0], At[1]); c.closePath(); c.fill()
        }
        path(c, ring, function (x, y) { return P(x, y, z) }, true)
        c.fillStyle = col; c.fill()
      } else {
        path(c, ring, function (x, y) { return P(x, y, z) }, true)
        c.fillStyle = DARK.roof; c.fill(); c.strokeStyle = DARK.edge; c.lineWidth = 0.8; c.stroke()
      }
    }
    c.fillStyle = DARK.water
    for (var w = 0; w < geo.water.length; w++) { path(c, geo.water[w], P, true); c.fill() }
    c.strokeStyle = DARK.water
    for (var rv = 0; rv < geo.rivers.length; rv++) { var river = geo.rivers[rv]; c.lineWidth = Math.max(4, (river.canal ? 0.02 : 0.085) * sc); path(c, river.pts, P); c.stroke() }
    c.restore()
    var fog = c.createLinearGradient(0, far[1] - H2 * 0.02, 0, far[1] + H2 * 0.25)
    fog.addColorStop(0, 'rgba(5,5,6,0.6)'); fog.addColorStop(1, 'rgba(5,5,6,0)')
    c.fillStyle = fog; c.fillRect(0, 0, W2, far[1] + H2 * 0.25)
  }
  /**
   * Coloured light projected onto the model: the white model, tinted by `color`, shows through a mask
   * (a polygon path, or a soft ellipse { x, y, rx, ry }) onto the dark one. `buf` is a scratch canvas
   * of the frame size; `draw(ctx)` draws the light model with the current zoom.
   */
  function projectLight(g, buf, drawLight, mask, color, alpha, boost) {
    if (alpha <= 0) return
    var o = buf.getContext('2d'), W = buf.width, H = buf.height
    o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, W, H)
    drawLight(o)
    o.globalCompositeOperation = 'multiply'; o.fillStyle = color; o.fillRect(0, 0, W, H)
    if (boost) { o.globalCompositeOperation = 'screen'; o.fillStyle = rgba(color, boost); o.fillRect(0, 0, W, H) }
    o.globalCompositeOperation = 'destination-in'
    if (mask.path) { o.fillStyle = '#fff'; o.fill(mask.path) }
    else {
      o.save(); o.translate(mask.x, mask.y); o.scale(1, mask.ry / mask.rx)
      var gr = o.createRadialGradient(0, 0, 0, 0, 0, mask.rx)
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
      o.fillStyle = gr; o.beginPath(); o.arc(0, 0, mask.rx, 0, TAU); o.fill(); o.restore()
    }
    o.restore()
    g.save(); g.globalAlpha *= alpha; g.drawImage(buf, 0, 0); g.restore()
  }
  /** Bright edge of a projected area: coloured glow plus a fine light line. */
  function glowEdge(g, p, color, a) {
    if (a <= 0) return
    g.save(); g.globalAlpha *= a; g.lineJoin = 'round'
    g.strokeStyle = rgba(color, 0.35); g.lineWidth = 9; g.stroke(p)
    g.strokeStyle = rgba(color, 0.9); g.lineWidth = 3; g.stroke(p)
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.stroke(p)
    g.restore()
  }
  /** A soft white ring sweeping outwards from a point (marks the moment an era begins). p 0..1. */
  function halo(g, x, y, r0, r1, flat, p) {
    if (p <= 0 || p >= 1) return
    var r = r0 + (r1 - r0) * ease.out(p), w = Math.max(30, r * 0.16), a = Math.sin(Math.PI * p) * 0.55
    g.save(); g.translate(x, y); g.scale(1, flat)
    var gr = g.createRadialGradient(0, 0, Math.max(0, r - w), 0, 0, r + w)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r + w, 0, TAU); g.fill(); g.restore()
  }
  /** Two-line callout: a dot on the point and a small dark plate with a title and a grey sub-line. */
  function callout2(g, x, y, title, sub, o) {
    o = o || {}
    var size = o.size || 22, dx = o.dx == null ? 16 : o.dx, dy = o.dy == null ? -18 : o.dy
    g.save(); g.textAlign = 'left'; g.textBaseline = 'top'
    g.font = '500 ' + size + 'px ' + SANS; var w1 = g.measureText(title).width
    g.font = '400 ' + Math.round(size * 0.68) + 'px ' + SANS; var w2 = sub ? g.measureText(sub).width : 0
    var w = Math.max(w1, w2) + 18, h = sub ? size * 2.05 : size * 1.45
    var bx = o.left ? x - dx - w : x + dx, by = y + dy - h * 0.5
    if (o.leader) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(o.leader[0], o.leader[1]); g.lineTo(x, y); g.stroke(); g.setLineDash([]) }
    g.fillStyle = 'rgba(12,13,15,0.86)'; g.fillRect(bx, by, w, h)
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1)
    g.fillStyle = C.text; g.font = '500 ' + size + 'px ' + SANS; g.fillText(title, bx + 9, by + size * 0.22)
    if (sub) { g.fillStyle = C.soft; g.font = '400 ' + Math.round(size * 0.68) + 'px ' + SANS; g.fillText(sub, bx + 9, by + size * 1.3) }
    g.fillStyle = o.dot || '#FFFFFF'; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill()
    g.restore()
    return [bx, by, w, h]
  }
  /** Left data block: "01 — era", a big thin year (or a figure), a white line and a grey note. */
  function dataBlock(g, s, o, a) {
    if (a <= 0) return
    var x = s.W * 0.035, y = s.H * 0.44
    g.save(); g.globalAlpha *= a; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    if (o.code || o.era) {
      g.fillStyle = rgba(C.text, 0.6); g.font = '15px ' + MONO; g.fillText(o.code || '', x, y - 112)
      if (o.color) { g.fillStyle = o.color; g.fillRect(x, y - 108, 18, 12) } else { g.fillStyle = rgba(C.text, 0.85); g.fillRect(x, y - 102, 18, 1.5) }
      g.fillStyle = rgba(C.text, 0.85)
      g.font = '400 22px ' + SANS; g.fillText(o.era || '', x + 28, y - 94)
    }
    g.fillStyle = C.text; g.font = '300 ' + (o.bigSize || 112) + 'px ' + SANS
    g.fillText(o.big, x, y)
    if (o.unit) { var bw = g.measureText(o.big).width; g.font = '300 44px ' + SANS; g.fillText(o.unit, x + bw + 10, y) }
    if (o.line) { g.fillStyle = rgba(C.text, 0.95); g.font = '500 24px ' + SANS; g.fillText(o.line, x, y + 40) }
    if (o.note) { g.fillStyle = rgba(C.text, 0.5); g.font = '400 17px ' + SANS; g.fillText(o.note, x, y + 68) }
    g.restore()
  }
  K.renderModelTone = renderModelTone; K.projectLight = projectLight; K.glowEdge = glowEdge; K.halo = halo
  K.callout2 = callout2; K.dataBlock = dataBlock; K.heightColor = heightColor; K.yearText = yearText
  K.locate = locate; K.photoCard = photoCard; K.hillMark = hillMark
  K.renderModel = renderModel; K.zoomXf = zoomXf; K.tag = tag
  K.camera = camera; K.studio = studio; K.model = model; K.projectRing = projectRing; K.spotlight = spotlight
  K.glowLines = glowLines; K.callout = callout; K.hud = hud; K.yearBlock = yearBlock; K.timeline = timeline; K.globe = globe
  K.labelOf = labelOf; K.FONT = { sans: SANS, mono: MONO }; K.COLORS = C
  // transitions: a thin bright line instead of the ink seal and the scroll rod
  K.seal = function (g, x, y, size, text, o) { o = o || {}; g.save(); g.globalAlpha *= o.alpha == null ? 1 : o.alpha; g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.arc(x, y, size * 0.5, 0, TAU); g.stroke(); g.fillStyle = C.text; g.font = Math.round(size * 0.22) + 'px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(text || ''), x, y); g.restore() }
  K.scrollRod = function (g, x, H) { g.save(); g.fillStyle = rgba(C.gold, 0.9); g.fillRect(x - 1.5, 0, 3, H); g.restore() }
  K.paper = function (g, W, H) { studio(g, W, H) }
})()
