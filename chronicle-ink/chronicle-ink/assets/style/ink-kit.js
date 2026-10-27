/* Ink-scroll drawing kit (browser, Canvas 2D). Everything a scene needs to paint in the chronicle-ink
 * style without images or models: seeded noise, brush strokes (wet, dry, tapered), washes, ink bleeds,
 * xuan paper, composition guides for wide / medium / close / detail, 2.5D parallax layers and a library
 * of motifs (mountains, water, boat, pavilion, scroll, bamboo, moon, inkstone, brush, seal, plum, geese,
 * robed figure silhouette, text reveal, map route without borders, timeline, count-up).
 *
 * Rules: deterministic (seeded rng only; no Math.random, no clock), no network, no realistic faces —
 * people are silhouettes seen from behind or far away. Draw static layers once with s.cache().
 * Exposed as window.CI_KIT; scenes receive it as s.kit. */
(function () {
  'use strict'
  var TAU = Math.PI * 2
  var PAL = { paper: '#EFE6D2', paperShadow: '#D9CDB2', ink: '#1D1B18', inkSoft: '#4A453D', cinnabar: '#B5332A', ochre: '#A87C4F', indigo: '#3E5566', mist: '#C9C2B2' }
  // ---------- numbers ----------
  function rng(seed) {
    var a = (seed >>> 0) || 0x9e3779b9
    return function () {
      a = (a + 0x6d2b79f5) >>> 0
      var t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function hash2(x, y, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  function smooth(t) { return t * t * (3 - 2 * t) }
  /** Value noise in [0,1]. */
  function noise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
    var u = smooth(xf), v = smooth(yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  function fbm(x, y, seed, oct) {
    var s = 0, amp = 0.5, f = 1, n = 0
    for (var i = 0; i < (oct || 4); i++) { s += amp * noise(x * f, y * f, seed + i * 17); n += amp; amp *= 0.5; f *= 2 }
    return s / n
  }
  var ease = {
    in: function (t) { return t * t * t },
    out: function (t) { return 1 - Math.pow(1 - t, 3) },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 },
    back: function (t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) },
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x }
  /** 0..1 progress of t inside [a, b] (eased). */
  function prog(t, a, b, e) { var p = clamp((t - a) / Math.max(1e-6, b - a), 0, 1); return e ? ease[e](p) : p }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16)
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
  }
  // ---------- paper ----------
  /** Xuan paper: warm base, fibre flecks, soft mottling and a gentle vignette. Cache it. */
  function paper(g, W, H, seed, tone) {
    var r = rng(seed || 7)
    g.fillStyle = tone || PAL.paper
    g.fillRect(0, 0, W, H)
    var cell = 48
    for (var y = 0; y < H; y += cell) for (var x = 0; x < W; x += cell) {
      var n = fbm(x / 420, y / 420, seed || 7, 3)
      g.fillStyle = n > 0.5 ? 'rgba(120,96,60,' + ((n - 0.5) * 0.10).toFixed(3) + ')' : 'rgba(255,250,236,' + ((0.5 - n) * 0.16).toFixed(3) + ')'
      g.fillRect(x, y, cell, cell)
    }
    // Smooth the mottling into the paper with large faint washes.
    for (var i = 0; i < 26; i++) {
      var cx = r() * W, cy = r() * H, rad = (0.1 + r() * 0.25) * W
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
      gr.addColorStop(0, 'rgba(160,130,90,' + (0.035 * r()).toFixed(3) + ')')
      gr.addColorStop(1, 'rgba(160,130,90,0)')
      g.fillStyle = gr
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    }
    g.lineCap = 'round'
    for (var k = 0; k < 900; k++) {
      var fx = r() * W, fy = r() * H, len = 4 + r() * 18, ang = r() * TAU
      g.strokeStyle = 'rgba(90,70,40,' + (0.04 + r() * 0.08).toFixed(3) + ')'
      g.lineWidth = 0.5 + r() * 0.8
      g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + Math.cos(ang) * len * 0.5 + (r() - 0.5) * 4, fy + Math.sin(ang) * len * 0.5 + (r() - 0.5) * 4, fx + Math.cos(ang) * len, fy + Math.sin(ang) * len); g.stroke()
    }
    var v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
    v.addColorStop(0, 'rgba(80,60,30,0)')
    v.addColorStop(1, 'rgba(80,60,30,0.22)')
    g.fillStyle = v
    g.fillRect(0, 0, W, H)
  }
  // ---------- brush ----------
  /** Resamples a polyline to points every `step` px: [[x, y, t(0..1)]]. */
  function resample(pts, step) {
    var out = [], total = 0, segs = []
    for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l }
    if (!total) return [[pts[0][0], pts[0][1], 0]]
    var n = Math.max(2, Math.ceil(total / step))
    var si = 0, acc = 0
    for (var k = 0; k <= n; k++) {
      var d = (k / n) * total
      while (si < segs.length - 1 && acc + segs[si] < d) { acc += segs[si]; si++ }
      var f = segs[si] ? (d - acc) / segs[si] : 0
      out.push([pts[si][0] + (pts[si + 1][0] - pts[si][0]) * f, pts[si][1] + (pts[si + 1][1] - pts[si][1]) * f, k / n])
    }
    return out
  }
  /** Smooth curve through control points (Catmull-Rom) -> dense polyline. */
  function curve(ctrl, perSeg) {
    var out = [], m = perSeg || 12
    for (var i = 0; i < ctrl.length - 1; i++) {
      var p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
      for (var k = 0; k < m; k++) {
        var t = k / m, t2 = t * t, t3 = t2 * t
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ])
      }
    }
    out.push(ctrl[ctrl.length - 1])
    return out
  }
  /**
   * Brush stroke along a polyline.
   * o: { w (max width), color, alpha, dry (0 wet .. 1 dry), taper ([start, end] 0..1), p (draw progress), seed, bristles }
   * Wet strokes are a solid tapered ribbon with a soft darker spine; dry strokes break into bristle
   * tracks with gaps driven by noise (feibai, the "flying white").
   */
  function stroke(g, pts, o) {
    o = o || {}
    var w = o.w || 8, col = o.color || PAL.ink, alpha = o.alpha == null ? 0.9 : o.alpha, dry = o.dry || 0, seed = o.seed || 1
    var p = o.p == null ? 1 : o.p
    if (p <= 0) return
    var taper = o.taper || [0.15, 0.35]
    var path = resample(pts, Math.max(1.5, w / 5))
    var last = Math.max(2, Math.floor(path.length * p))
    var widthAt = function (t) {
      var a = taper[0] ? clamp(t / taper[0], 0, 1) : 1
      var b = taper[1] ? clamp((1 - t) / taper[1], 0, 1) : 1
      return w * (0.25 + 0.75 * Math.sqrt(a)) * (0.15 + 0.85 * Math.sqrt(b)) * (0.85 + 0.3 * noise(t * 6, 0, seed))
    }
    var norm = function (i) {
      var a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)]
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      return [-dy / l, dx / l]
    }
    if (dry < 0.5) {
      // Ribbon fill.
      var left = [], right = []
      for (var i = 0; i < last; i++) {
        var n = norm(i), hw = widthAt(path[i][2]) / 2
        left.push([path[i][0] + n[0] * hw, path[i][1] + n[1] * hw])
        right.push([path[i][0] - n[0] * hw, path[i][1] - n[1] * hw])
      }
      g.fillStyle = rgba(col, alpha * (1 - dry * 0.6))
      g.beginPath()
      g.moveTo(left[0][0], left[0][1])
      for (var k = 1; k < left.length; k++) g.lineTo(left[k][0], left[k][1])
      for (var j = right.length - 1; j >= 0; j--) g.lineTo(right[j][0], right[j][1])
      g.closePath()
      g.fill()
      // Wet edge: the pigment pools along the rim.
      g.strokeStyle = rgba(col, alpha * 0.25)
      g.lineWidth = Math.max(0.6, w * 0.06)
      g.stroke()
    }
    if (dry > 0) {
      var br = o.bristles || Math.max(5, Math.round(w / 2.2))
      g.lineCap = 'round'
      for (var b = 0; b < br; b++) {
        var off = (b / (br - 1) - 0.5)
        var bw = Math.max(0.6, (w / br) * 1.3)
        g.strokeStyle = rgba(col, alpha * (0.55 + 0.4 * hash2(b, 3, seed)))
        g.lineWidth = bw
        var drawing = false
        g.beginPath()
        for (var q = 0; q < last; q++) {
          var t = path[q][2]
          var gap = noise(t * (8 + 10 * dry), b * 1.7, seed) < dry * (0.25 + 0.6 * t)
          if (gap) { drawing = false; continue }
          var nn = norm(q), hw2 = widthAt(t)
          var x = path[q][0] + nn[0] * off * hw2, y = path[q][1] + nn[1] * off * hw2
          if (!drawing) { g.moveTo(x, y); drawing = true } else g.lineTo(x, y)
        }
        g.stroke()
      }
    }
  }
  /** Soft wash blob (layered radial gradients with a noisy outline). */
  function wash(g, x, y, rx, ry, o) {
    o = o || {}
    var col = o.color || PAL.ink, a = o.alpha == null ? 0.12 : o.alpha, r = rng(o.seed || 3)
    for (var i = 0; i < (o.layers || 6); i++) {
      var cx = x + (r() - 0.5) * rx * 0.5, cy = y + (r() - 0.5) * ry * 0.5
      var rr = Math.max(rx, ry) * (0.6 + r() * 0.5)
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr)
      gr.addColorStop(0, rgba(col, a))
      gr.addColorStop(0.6, rgba(col, a * 0.5))
      gr.addColorStop(1, rgba(col, 0))
      g.save()
      g.translate(cx, cy); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-cx, -cy)
      g.fillStyle = gr
      g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2)
      g.restore()
    }
  }
  /** Ink drop spreading on paper: irregular blot with a darker tide line. p = spread 0..1. */
  function bleed(g, x, y, r, o) {
    o = o || {}
    var p = o.p == null ? 1 : o.p, col = o.color || PAL.ink, seed = o.seed || 5
    if (p <= 0) return
    var R = r * ease.out(p)
    var rings = 5
    for (var k = rings; k >= 1; k--) {
      var rr = R * (k / rings)
      g.beginPath()
      for (var i = 0; i <= 64; i++) {
        var a = (i / 64) * TAU
        var n = fbm(Math.cos(a) * 1.5 + k, Math.sin(a) * 1.5, seed, 3)
        var d = rr * (0.75 + 0.5 * n)
        if (i) g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
        else g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
      }
      g.closePath()
      g.fillStyle = rgba(col, (o.alpha || 0.5) * (0.12 + 0.1 * (rings - k) / rings))
      g.fill()
      if (k === rings) { g.strokeStyle = rgba(col, (o.alpha || 0.5) * 0.35); g.lineWidth = Math.max(1, r * 0.02); g.stroke() }
    }
  }
  /** Horizontal mist band that fades the layers behind it. */
  function mist(g, W, y, h, o) {
    o = o || {}
    var gr = g.createLinearGradient(0, y - h, 0, y + h)
    var c = o.color || PAL.paper
    gr.addColorStop(0, rgba(c, 0))
    gr.addColorStop(0.5, rgba(c, o.alpha == null ? 0.85 : o.alpha))
    gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr
    g.fillRect(-W, y - h, W * 3, h * 2)
  }
  // ---------- composition ----------
  /**
   * Composition guides by shot size: horizon (y), focal point, subject scale, margins.
   *   wide: tiny subject, high negative space, horizon at 0.62 H (the Song "level distance")
   *   medium: subject ~ 0.45 H, horizon low; close: subject fills ~0.8 H; detail: macro objects
   */
  function frame(size, W, H, side) {
    var right = side !== 'left'
    var fx = right ? 0.64 : 0.36
    switch (size) {
      case 'wide': return { horizon: H * 0.62, fx: W * fx, fy: H * 0.5, scale: 0.18, margin: W * 0.06 }
      case 'medium': return { horizon: H * 0.74, fx: W * fx, fy: H * 0.55, scale: 0.45, margin: W * 0.08 }
      case 'close': return { horizon: H * 0.88, fx: W * (right ? 0.6 : 0.4), fy: H * 0.55, scale: 0.8, margin: W * 0.1 }
      default: return { horizon: H * 0.9, fx: W * 0.5, fy: H * 0.5, scale: 1.2, margin: W * 0.12 }
    }
  }
  /**
   * 2.5D parallax layer: depth 0 = paper (fixed), 1 = mid ground, >1 foreground. Uses s.cam.
   */
  function layer(g, s, depth, fn) {
    var c = s.cam || { zoom: 1, x: 0, y: 0 }
    g.save()
    g.translate(s.W / 2, s.H / 2)
    var z = 1 + (c.zoom - 1) * depth
    g.scale(z, z)
    g.translate(-s.W / 2 + c.x * depth, -s.H / 2 + c.y * depth)
    fn(g)
    g.restore()
  }
  // ---------- motifs ----------
  /** Mountain range: fbm ridge, ink gradient fading into mist, cun texture strokes on the slopes. */
  function mountains(g, o) {
    var W = o.W, base = o.base, h = o.height, seed = o.seed || 11, col = o.color || PAL.ink
    var x0 = o.x0 == null ? -W * 0.2 : o.x0, x1 = o.x1 == null ? W * 1.2 : o.x1
    var peaks = o.peaks || 3
    var pts = []
    for (var x = x0; x <= x1; x += 6) {
      var u = (x - x0) / (x1 - x0)
      var env = Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.6)
      var ridge = 0.55 * Math.pow(Math.abs(Math.sin(u * Math.PI * peaks + seed)), 1.6) + 0.45 * fbm(u * 6, 0, seed, 5)
      pts.push([x, base - h * env * ridge])
    }
    var top = base - h
    var gr = g.createLinearGradient(0, top, 0, base)
    gr.addColorStop(0, rgba(col, o.alpha == null ? 0.75 : o.alpha))
    gr.addColorStop(0.55, rgba(col, (o.alpha == null ? 0.75 : o.alpha) * 0.35))
    gr.addColorStop(1, rgba(col, 0))
    g.fillStyle = gr
    g.beginPath(); g.moveTo(x0, base)
    for (var i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
    g.lineTo(x1, base); g.closePath(); g.fill()
    // Ridge line in dry brush.
    stroke(g, pts, { w: o.line || 3, color: col, alpha: (o.alpha == null ? 0.75 : o.alpha) * 0.9, dry: 0.35, taper: [0.05, 0.05], seed: seed })
    // Cun strokes: short dry hemp-fibre strokes under the ridge.
    if (o.texture !== false) {
      var r = rng(seed + 3)
      for (var k = 0; k < (o.cun || 40); k++) {
        var pi = Math.floor(r() * pts.length)
        var px = pts[pi][0], py = pts[pi][1] + 6 + r() * h * 0.35
        if (py > base - 4) continue
        var len = 10 + r() * 28
        stroke(g, [[px, py], [px - len * 0.3, py + len * 0.6], [px - len * 0.2, py + len]], { w: 1.5 + r() * 2.5, alpha: 0.25 + 0.25 * r(), dry: 0.7, seed: seed + k, taper: [0.2, 0.6] })
      }
    }
    return pts
  }
  /** Water: thin ripple strokes; t animates the drift. */
  function water(g, o) {
    var r = rng(o.seed || 21), t = o.t || 0
    for (var i = 0; i < (o.lines || 26); i++) {
      var y = o.y0 + (o.y1 - o.y0) * Math.pow(r(), 0.8)
      var depth = (y - o.y0) / Math.max(1, o.y1 - o.y0)
      var len = (40 + r() * 140) * (0.5 + depth)
      var x = ((r() * (o.W + 400) + t * (12 + 20 * depth)) % (o.W + 400)) - 200
      var pts = []
      for (var k = 0; k <= 8; k++) pts.push([x + (k / 8) * len, y + Math.sin(k * 0.9 + t * 1.3 + i) * 1.4])
      stroke(g, pts, { w: 1 + depth * 2.2, alpha: 0.18 + 0.25 * depth, dry: 0.4, seed: i + 3, taper: [0.4, 0.4] })
    }
  }
  /** Small boat (sampan) with an optional seated figure silhouette under a hat. */
  function boat(g, x, y, s, o) {
    o = o || {}
    g.save(); g.translate(x, y); g.scale(s, s)
    stroke(g, curve([[-60, -4], [-30, 6], [30, 6], [64, -8]]), { w: 9, alpha: 0.88, taper: [0.2, 0.3], seed: 3 })
    stroke(g, [[-40, 0], [44, 0]], { w: 4, alpha: 0.5, dry: 0.5, seed: 4 })
    if (o.awning !== false) { g.fillStyle = rgba(PAL.ink, 0.72); g.beginPath(); g.moveTo(-26, -2); g.quadraticCurveTo(-8, -30, 14, -2); g.closePath(); g.fill() }
    if (o.figure !== false) figure(g, 30, -2, 0.42, { pose: 'seated', hat: 'straw' })
    if (o.pole) stroke(g, [[44, -6], [80, -70]], { w: 2, alpha: 0.8, seed: 6, taper: [0, 0.2] })
    g.restore()
  }
  /** Pavilion (ting) with upturned eaves. */
  function pavilion(g, x, y, s, o) {
    o = o || {}
    g.save(); g.translate(x, y); g.scale(s, s)
    var a = o.alpha == null ? 0.85 : o.alpha
    stroke(g, curve([[-70, -78], [-40, -88], [0, -110], [40, -88], [70, -78]]), { w: 7, alpha: a, taper: [0.1, 0.1], seed: 31 })
    stroke(g, [[-78, -72], [-66, -80]], { w: 5, alpha: a, seed: 32 })
    stroke(g, [[66, -80], [78, -72]], { w: 5, alpha: a, seed: 33 })
    stroke(g, [[0, -110], [0, -128]], { w: 3, alpha: a, seed: 34 })
    for (var i = -1; i <= 1; i += 2) stroke(g, [[i * 42, -82], [i * 42, 0]], { w: 4, alpha: a, dry: 0.3, seed: 35 + i, taper: [0, 0] })
    stroke(g, [[-56, 0], [56, 0]], { w: 5, alpha: a * 0.8, dry: 0.5, seed: 38 })
    stroke(g, [[-44, -36], [44, -36]], { w: 2, alpha: a * 0.6, dry: 0.6, seed: 39 })
    g.restore()
  }
  /** Handscroll with wooden rods; open = 0..1 unroll. Returns the inner rect. */
  function scroll(g, x, y, w, h, o) {
    o = o || {}
    var open = o.open == null ? 1 : o.open
    var cw = w * open
    g.save()
    g.fillStyle = '#F3EBD8'
    g.shadowColor = 'rgba(0,0,0,0)'
    g.fillRect(x, y, cw, h)
    g.strokeStyle = rgba(PAL.ochre, 0.6); g.lineWidth = 2
    g.strokeRect(x + 10, y + 10, Math.max(0, cw - 20), h - 20)
    g.restore()
    rod(g, x, y, h)
    rod(g, x + cw, y, h)
    return { x: x + 18, y: y + 18, w: Math.max(0, cw - 36), h: h - 36 }
  }
  function rod(g, x, y, h) {
    var gr = g.createLinearGradient(x - 9, 0, x + 9, 0)
    gr.addColorStop(0, '#3B2A1C'); gr.addColorStop(0.5, '#7A5634'); gr.addColorStop(1, '#2A1D12')
    g.fillStyle = gr
    g.fillRect(x - 9, y - 16, 18, h + 32)
    g.fillStyle = '#1D1B18'
    g.fillRect(x - 11, y - 22, 22, 8); g.fillRect(x - 11, y + h + 14, 22, 8)
  }
  /** Scroll rod at a vertical edge (the scroll-pan transition). */
  function scrollRod(g, x, H, shade) {
    g.save()
    var sh = g.createLinearGradient(x - 60, 0, x, 0)
    sh.addColorStop(0, 'rgba(30,20,10,0)'); sh.addColorStop(1, 'rgba(30,20,10,' + (0.25 * (shade == null ? 1 : shade)).toFixed(3) + ')')
    g.fillStyle = sh
    g.fillRect(x - 60, 0, 60, H)
    rod(g, x, 0, H)
    g.restore()
  }
  /** Bamboo stalks with leaves; t sways the leaves. */
  function bamboo(g, x, y, h, o) {
    o = o || {}
    var r = rng(o.seed || 41), t = o.t || 0, a = o.alpha == null ? 0.85 : o.alpha
    var segs = o.segments || 6
    var sway = Math.sin(t * 0.9 + (o.seed || 0)) * 4
    for (var i = 0; i < segs; i++) {
      var y0 = y - (i / segs) * h, y1 = y - ((i + 1) / segs) * h + 6
      var bx = x + sway * (i / segs)
      stroke(g, [[bx, y0], [bx + sway / segs, y1]], { w: o.w || 12, alpha: a * (0.75 + 0.2 * r()), taper: [0.02, 0.02], dry: 0.25, seed: 50 + i })
      stroke(g, [[bx - (o.w || 12) * 0.7, y1 + 3], [bx + (o.w || 12) * 0.7, y1 + 1]], { w: 3, alpha: a, seed: 70 + i, taper: [0.3, 0.3] })
    }
    var leaves = o.leaves || 9
    for (var k = 0; k < leaves; k++) {
      var ly = y - h * (0.45 + 0.55 * r())
      var dir = r() < 0.5 ? -1 : 1
      var len = 50 + r() * 50
      var ang = (0.2 + r() * 0.6) * dir + Math.sin(t * 1.4 + k) * 0.06
      var lx = x + sway
      stroke(g, [[lx, ly], [lx + Math.cos(ang) * len * 0.5 * dir, ly + Math.sin(Math.abs(ang)) * len * 0.3], [lx + Math.cos(ang) * len * dir, ly + Math.sin(Math.abs(ang)) * len * 0.55]], { w: 10 + r() * 6, alpha: a * (0.6 + 0.4 * r()), taper: [0.15, 0.85], seed: 90 + k })
    }
  }
  /** Moon: pale disc with a soft halo; `ink` true draws it as an ink circle on paper. */
  function moon(g, x, y, r, o) {
    o = o || {}
    var gr = g.createRadialGradient(x, y, r * 0.8, x, y, r * 3)
    gr.addColorStop(0, 'rgba(255,250,235,0.55)'); gr.addColorStop(1, 'rgba(255,250,235,0)')
    g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6)
    g.fillStyle = o.color || '#FBF6E8'
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
    g.strokeStyle = rgba(PAL.ink, 0.35); g.lineWidth = 1.5; g.stroke()
  }
  /** Inkstone with a pool of ink. */
  function inkstone(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s)
    g.fillStyle = '#2B2925'
    roundRect(g, -110, -60, 220, 120, 26); g.fill()
    g.fillStyle = '#121110'
    g.beginPath(); g.ellipse(-30, 8, 52, 30, 0, 0, TAU); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.08)'
    g.beginPath(); g.ellipse(-42, -2, 20, 7, -0.3, 0, TAU); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2
    roundRect(g, -100, -50, 200, 100, 20); g.stroke()
    g.restore()
  }
  /** Writing brush (maobi) lying at an angle. */
  function brush(g, x, y, s, angle) {
    g.save(); g.translate(x, y); g.rotate(angle || 0); g.scale(s, s)
    var gr = g.createLinearGradient(0, -6, 0, 6)
    gr.addColorStop(0, '#6E4A2A'); gr.addColorStop(0.5, '#A8794A'); gr.addColorStop(1, '#5A3B20')
    g.fillStyle = gr
    roundRect(g, -160, -6, 260, 12, 6); g.fill()
    g.fillStyle = '#1D1B18'
    g.beginPath(); g.moveTo(100, -8); g.quadraticCurveTo(150, -6, 175, 0); g.quadraticCurveTo(150, 6, 100, 8); g.closePath(); g.fill()
    g.fillStyle = '#B5332A'; g.fillRect(-165, -7, 8, 14)
    g.restore()
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
  }
  /** Square cinnabar seal with carved text (1–4 characters). o: { alpha, font, rot, seed } */
  function seal(g, x, y, size, text, o) {
    o = o || {}
    var a = o.alpha == null ? 1 : o.alpha
    if (a <= 0) return
    g.save(); g.translate(x, y); g.rotate(o.rot == null ? -0.04 : o.rot); g.globalAlpha *= a
    var r = rng(o.seed || 9)
    g.fillStyle = PAL.cinnabar
    g.beginPath()
    var hs = size / 2
    var corners = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]
    for (var c = 0; c < 4; c++) {
      var p0 = corners[c], p1 = corners[(c + 1) % 4]
      for (var k = 0; k < 8; k++) {
        var f = k / 8
        var jx = (r() - 0.5) * size * 0.025, jy = (r() - 0.5) * size * 0.025
        var px = p0[0] + (p1[0] - p0[0]) * f + jx, py = p0[1] + (p1[1] - p0[1]) * f + jy
        if (c === 0 && k === 0) g.moveTo(px, py); else g.lineTo(px, py)
      }
    }
    g.closePath(); g.fill()
    g.globalCompositeOperation = 'destination-out'
    var chars = Array.from(String(text || '印'))
    g.fillStyle = '#000'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    var fam = o.font || '"LXGW WenKai", serif'
    if (chars.length === 1) { g.font = Math.round(size * 0.72) + 'px ' + fam; g.fillText(chars[0], 0, size * 0.03) }
    else {
      var cols = 2, rows = Math.ceil(chars.length / 2)
      g.font = Math.round(size * 0.42) + 'px ' + fam
      for (var i = 0; i < chars.length; i++) {
        var col = cols - 1 - Math.floor(i / rows), row = i % rows
        g.fillText(chars[i], (col - 0.5) * size * 0.44, (row - (rows - 1) / 2) * size * 0.44 + size * 0.02)
      }
    }
    // Worn specks.
    for (var s2 = 0; s2 < 30; s2++) { g.beginPath(); g.arc((r() - 0.5) * size, (r() - 0.5) * size, r() * size * 0.012, 0, TAU); g.fill() }
    g.restore()
  }
  /** Plum branch with blossoms (cinnabar dots); p grows it. */
  function plum(g, x, y, s, o) {
    o = o || {}
    var p = o.p == null ? 1 : o.p
    g.save(); g.translate(x, y); g.scale(s, s)
    var main = curve([[0, 0], [60, -40], [110, -50], [170, -110], [230, -120]])
    stroke(g, main, { w: 14, alpha: 0.85, dry: 0.45, p: p, seed: 12, taper: [0.02, 0.7] })
    stroke(g, curve([[110, -50], [140, -10], [190, 0]]), { w: 7, alpha: 0.8, dry: 0.4, p: clamp(p * 1.5 - 0.4, 0, 1), seed: 13, taper: [0.05, 0.8] })
    var r = rng(o.seed || 14)
    var flowers = [[175, -112], [230, -122], [140, -12], [192, 0], [86, -48], [205, -100], [60, -36]]
    for (var i = 0; i < flowers.length; i++) {
      var fp = clamp((p - 0.4 - i * 0.07) / 0.2, 0, 1)
      if (fp <= 0) continue
      for (var k = 0; k < 5; k++) {
        var a = (k / 5) * TAU + r()
        g.fillStyle = rgba(PAL.cinnabar, 0.75 * fp)
        g.beginPath(); g.arc(flowers[i][0] + Math.cos(a) * 6 * fp, flowers[i][1] + Math.sin(a) * 6 * fp, 5.5 * fp, 0, TAU); g.fill()
      }
      g.fillStyle = rgba(PAL.ink, 0.8 * fp); g.beginPath(); g.arc(flowers[i][0], flowers[i][1], 1.8, 0, TAU); g.fill()
    }
    g.restore()
  }
  /** A line of geese (simple brush chevrons); t moves them. */
  function geese(g, x, y, n, s, t) {
    for (var i = 0; i < n; i++) {
      var gx = x + i * 34 * s + (t || 0) * 30, gy = y + Math.abs(i - (n - 1) / 2) * 12 * s
      var flap = Math.sin((t || 0) * 6 + i) * 3 * s
      stroke(g, [[gx - 9 * s, gy - flap], [gx, gy + 3 * s], [gx + 9 * s, gy - flap]], { w: 2.4 * s, alpha: 0.75, seed: 60 + i, taper: [0.3, 0.3] })
    }
  }
  /**
   * Robed scholar silhouette, never with a face: seen from behind or in profile as a solid ink shape.
   * pose: standing | walking | seated | bowing; hat: tall (Dongpo-style square scholar's hat) | straw | none.
   */
  function figure(g, x, y, s, o) {
    o = o || {}
    var a = o.alpha == null ? 0.9 : o.alpha
    var col = o.color || PAL.ink
    g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s)
    g.fillStyle = rgba(col, a)
    var pose = o.pose || 'standing'
    var sway = o.t ? Math.sin(o.t * 1.6) * 3 : 0
    if (pose === 'seated') {
      g.beginPath(); g.moveTo(-34, 0); g.quadraticCurveTo(-30, -46, -12, -70); g.lineTo(14, -70); g.quadraticCurveTo(30, -40, 40, 0); g.closePath(); g.fill()
      g.beginPath(); g.arc(0, -84, 13, 0, TAU); g.fill()
    } else {
      var lean = pose === 'bowing' ? 0.25 : pose === 'walking' ? 0.08 : 0
      g.rotate(lean)
      // Robe: wide flowing hem, sleeves.
      g.beginPath()
      g.moveTo(-14, -150)
      g.quadraticCurveTo(-34, -110, -40 + sway, -40)
      g.quadraticCurveTo(-52 + sway, -6, -46 + sway * 1.5, 0)
      g.lineTo(46 + sway * 1.5, 0)
      g.quadraticCurveTo(44 + sway, -50, 30, -110)
      g.quadraticCurveTo(24, -140, 14, -150)
      g.closePath(); g.fill()
      // Sleeve.
      g.beginPath(); g.moveTo(16, -128); g.quadraticCurveTo(54, -96, 46 + sway, -60); g.quadraticCurveTo(30, -64, 18, -90); g.closePath(); g.fill()
      // Head (plain disc: no facial features).
      g.beginPath(); g.ellipse(0, -164, 13, 15, 0, 0, TAU); g.fill()
    }
    var hat = o.hat || 'tall'
    var hy = pose === 'seated' ? -96 : -176
    if (hat === 'tall') { g.fillRect(-12, hy - 22, 24, 26); g.fillRect(-15, hy - 2, 30, 5) }
    else if (hat === 'straw') { g.beginPath(); g.moveTo(-30, hy + 8); g.lineTo(0, hy - 14); g.lineTo(30, hy + 8); g.closePath(); g.fill() }
    // Robe sash in a dry stroke for texture.
    if (pose !== 'seated') stroke(g, [[-30, -78], [36, -72]], { w: 3, color: PAL.paper, alpha: 0.25, dry: 0.7, seed: 77 })
    g.restore()
  }
  /** Writes text in brush calligraphy with a wipe reveal. o: { size, p, font, color, vertical, align, bleed } */
  function textReveal(g, text, x, y, o) {
    o = o || {}
    var p = o.p == null ? 1 : o.p
    if (p <= 0) return
    var size = o.size || 96
    var chars = Array.from(String(text))
    g.save()
    g.font = (o.weight || '') + ' ' + size + 'px ' + (o.font || '"LXGW WenKai", "Noto Serif", serif')
    g.fillStyle = o.color || PAL.ink
    g.textBaseline = 'middle'
    if (o.vertical) {
      g.textAlign = 'center'
      for (var i = 0; i < chars.length; i++) {
        var cp = clamp(p * chars.length - i, 0, 1)
        if (cp <= 0) break
        g.save()
        g.beginPath(); g.rect(x - size, y + i * size * 1.08 - size * 0.55, size * 2, size * 1.1 * ease.out(cp)); g.clip()
        g.globalAlpha *= 0.4 + 0.6 * cp
        g.fillText(chars[i], x, y + i * size * 1.08)
        g.restore()
      }
    } else {
      g.textAlign = o.align || 'center'
      var w = g.measureText(text).width
      var left = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2
      g.beginPath(); g.rect(left - size * 0.1, y - size, (w + size * 0.2) * ease.out(p), size * 2); g.clip()
      g.fillText(text, x, y)
    }
    g.restore()
  }
  /**
   * Map route on an abstract terrain (rivers and hills only; never national or provincial borders).
   * stops: [{ x, y, label }] in pixels; p = route progress 0..1 (stops appear as the brush reaches them).
   */
  function route(g, stops, p, o) {
    o = o || {}
    var pts = curve(stops.map(function (s) { return [s.x, s.y] }), 16)
    stroke(g, pts, { w: o.w || 5, color: o.color || PAL.cinnabar, alpha: 0.85, dry: 0.3, p: p, seed: 81, taper: [0.02, 0.05] })
    var n = stops.length
    for (var i = 0; i < n; i++) {
      var at = n > 1 ? i / (n - 1) : 0
      var sp = clamp((p - at) / 0.06 + 1, 0, 1)
      if (sp <= 0) continue
      g.fillStyle = rgba(PAL.cinnabar, sp)
      g.beginPath(); g.arc(stops[i].x, stops[i].y, (o.dot || 9) * ease.back(sp), 0, TAU); g.fill()
      g.strokeStyle = rgba(PAL.ink, 0.7 * sp); g.lineWidth = 2; g.stroke()
      if (stops[i].label) {
        g.save()
        g.globalAlpha *= sp
        g.font = (o.labelSize || 34) + 'px ' + (o.font || '"LXGW WenKai", "Noto Serif", serif')
        g.fillStyle = PAL.ink
        g.textAlign = stops[i].align || 'left'; g.textBaseline = 'middle'
        var dx = stops[i].align === 'right' ? -18 : 18
        g.fillText(stops[i].label, stops[i].x + dx, stops[i].y + (stops[i].dy || 0))
        g.restore()
      }
    }
  }
  /** Rivers for an abstract map backdrop (wash lines). */
  function river(g, ctrl, o) {
    o = o || {}
    stroke(g, curve(ctrl, 16), { w: o.w || 10, color: o.color || PAL.indigo, alpha: o.alpha == null ? 0.35 : o.alpha, dry: 0.2, seed: o.seed || 90, taper: [0.1, 0.1] })
  }
  /** Timeline: brush line with year ticks; items [{ x, label, sub }]; p reveals left to right. */
  function timeline(g, x0, x1, y, items, p, o) {
    o = o || {}
    stroke(g, [[x0, y], [x1, y]], { w: 4, alpha: 0.8, dry: 0.4, p: p, seed: 101, taper: [0.02, 0.02] })
    for (var i = 0; i < items.length; i++) {
      var at = (items[i].x - x0) / (x1 - x0)
      var ip = clamp((p - at) / 0.08 + 1, 0, 1)
      if (ip <= 0) continue
      g.save(); g.globalAlpha *= ip
      stroke(g, [[items[i].x, y - 14], [items[i].x, y + 14]], { w: 4, alpha: 0.9, seed: 110 + i })
      g.font = (o.size || 40) + 'px ' + (o.font || '"LXGW WenKai", "Noto Serif", serif')
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'
      g.fillStyle = items[i].hot ? PAL.cinnabar : PAL.ink
      g.fillText(items[i].label, items[i].x, y - 30)
      if (items[i].sub) { g.font = Math.round((o.size || 40) * 0.7) + 'px ' + (o.font || '"LXGW WenKai", "Noto Serif", serif'); g.fillStyle = PAL.inkSoft; g.textBaseline = 'top'; g.fillText(items[i].sub, items[i].x, y + 28) }
      g.restore()
    }
  }
  /** Number string for a count-up at progress p (no grouping for years). */
  function countUp(value, p) {
    var v = value * ease.out(clamp(p, 0, 1))
    return String(Math.round(v))
  }
  /** Willow / grass strokes along the ground. */
  function grass(g, x0, x1, y, o) {
    o = o || {}
    var r = rng(o.seed || 121)
    for (var i = 0; i < (o.n || 40); i++) {
      var x = x0 + r() * (x1 - x0), h = 10 + r() * (o.h || 30)
      stroke(g, [[x, y], [x + (r() - 0.5) * 10 + (o.wind || 0), y - h]], { w: 2 + r() * 2, alpha: 0.5 + 0.3 * r(), seed: 130 + i, taper: [0, 0.9] })
    }
  }
  /** Rain streaks (deterministic in t). */
  function rain(g, W, H, t, o) {
    o = o || {}
    var r = rng(o.seed || 141)
    g.strokeStyle = rgba(PAL.ink, o.alpha || 0.18)
    g.lineWidth = 1.2
    g.beginPath()
    for (var i = 0; i < (o.n || 160); i++) {
      var x = r() * W, y = (r() * H + t * 900) % H
      g.moveTo(x, y); g.lineTo(x - 6, y + 26)
    }
    g.stroke()
  }
  /** Prison bars / window lattice in brush. */
  function lattice(g, x, y, w, h, o) {
    o = o || {}
    var n = o.n || 7
    for (var i = 0; i <= n; i++) stroke(g, [[x + (i / n) * w, y], [x + (i / n) * w + 2, y + h]], { w: o.w || 10, alpha: 0.85, dry: 0.35, seed: 150 + i, taper: [0.02, 0.02] })
    stroke(g, [[x - 10, y + 6], [x + w + 10, y + 2]], { w: 14, alpha: 0.9, dry: 0.3, seed: 170 })
    stroke(g, [[x - 10, y + h - 4], [x + w + 10, y + h]], { w: 14, alpha: 0.9, dry: 0.3, seed: 171 })
  }
  /** Cliff face (Red Cliff): a tall dark rock mass with ochre wash and vertical cun. */
  function cliff(g, x, y, w, h, o) {
    o = o || {}
    var seed = o.seed || 181
    var pts = []
    for (var i = 0; i <= 30; i++) {
      var u = i / 30
      pts.push([x + w * (0.2 * fbm(u * 4, 1, seed, 3) + (u < 0.5 ? 0 : 0)) + w * 0.8 * Math.pow(u, 1.4) * 0.0, y + h * u])
    }
    g.fillStyle = rgba(PAL.ink, 0.82)
    g.beginPath(); g.moveTo(x - w, y)
    for (var k = 0; k < pts.length; k++) g.lineTo(pts[k][0] + w * 0.25 * fbm(k / 6, 0, seed, 3), pts[k][1])
    g.lineTo(x - w, y + h); g.closePath(); g.fill()
    wash(g, x - w * 0.4, y + h * 0.4, w * 0.5, h * 0.4, { color: o.tint || PAL.cinnabar, alpha: 0.22, seed: seed + 1 })
    var r = rng(seed + 2)
    for (var c = 0; c < 26; c++) {
      var cx = x - w * r() * 0.9, cy = y + r() * h * 0.9
      stroke(g, [[cx, cy], [cx + 4, cy + 30 + r() * 60]], { w: 2 + r() * 3, color: PAL.paper, alpha: 0.18, dry: 0.8, seed: seed + 10 + c })
    }
  }
  /** Dry-brush fill of a rectangle: horizontal broken strokes plus a wet outline (walls, banks, slabs). */
  function dryFill(g, x, y, w, h, o) {
    o = o || {}
    var a = o.alpha == null ? 0.6 : o.alpha, seed = o.seed || 201
    var r = rng(seed)
    var rows = Math.max(3, Math.round(h / (o.row || 7)))
    for (var i = 0; i < rows; i++) {
      var yy = y + (i + 0.5) * (h / rows)
      stroke(g, [[x + r() * 6, yy + (r() - 0.5) * 2], [x + w - r() * 6, yy + (r() - 0.5) * 2]], { w: (h / rows) * 1.25, alpha: a * (0.45 + 0.35 * r()), dry: 0.55, seed: seed + i, taper: [0.02, 0.04] })
    }
    stroke(g, [[x, y], [x + w, y]], { w: Math.max(2, h * 0.08), alpha: a, dry: 0.25, seed: seed + 99, taper: [0.02, 0.02] })
    stroke(g, [[x, y + h], [x + w, y + h]], { w: Math.max(2, h * 0.06), alpha: a * 0.8, dry: 0.4, seed: seed + 98, taper: [0.02, 0.02] })
  }
  /** City wall with crenellations and dry-brush masonry. */
  function wall(g, x, y, w, h, o) {
    o = o || {}
    dryFill(g, x, y, w, h, { alpha: o.alpha == null ? 0.55 : o.alpha, seed: o.seed || 211 })
    var a = o.alpha == null ? 0.55 : o.alpha
    for (var cx = x; cx < x + w - 10; cx += h * 0.45) stroke(g, [[cx, y - h * 0.16], [cx + h * 0.22, y - h * 0.16]], { w: h * 0.18, alpha: a, dry: 0.3, seed: 221 + Math.round(cx), taper: [0, 0] })
  }
  /** Small house: plastered wall, dark tiled roof with upturned eave ends. */
  function house(g, x, y, s, o) {
    o = o || {}
    var a = o.alpha == null ? 0.8 : o.alpha
    g.save(); g.translate(x, y); g.scale(s, s)
    g.fillStyle = rgba(PAL.paper, 0.95)
    g.fillRect(-40, -34, 80, 34)
    stroke(g, [[-40, -34], [-40, 0]], { w: 2.5, alpha: a * 0.7, seed: 231 })
    stroke(g, [[40, -34], [40, 0]], { w: 2.5, alpha: a * 0.7, seed: 232 })
    stroke(g, [[-14, -20], [-14, 0], [2, 0], [2, -20]], { w: 2, alpha: a * 0.6, seed: 233 })
    g.fillStyle = rgba(PAL.ink, a)
    g.beginPath(); g.moveTo(-58, -30); g.quadraticCurveTo(-44, -36, -34, -56); g.lineTo(34, -56); g.quadraticCurveTo(44, -36, 58, -30); g.quadraticCurveTo(0, -38, -58, -30); g.closePath(); g.fill()
    stroke(g, [[-36, -57], [36, -57]], { w: 4, alpha: a, seed: 234, taper: [0, 0] })
    g.restore()
  }
  // ---------- city map (subject 'city'; data = s.geo from scripts/geo.mjs, OpenStreetMap) ----------
  /** Interpolated map view between a and b ({ x, y, km } = centre in km and half-width in km). */
  function geoView(a, b, p) {
    var e = ease.inOut(clamp(p, 0, 1))
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, km: Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * e) }
  }
  function geoLabel(item, lang) {
    var l = (item && item.label) || {}
    return l[lang] || l[String(lang).split('-')[0]] || l.en || l['zh-CN'] || ''
  }
  /** Organic ink-wash outline of radius r (px) around (cx, cy); p grows it from 0 to full. */
  function blobPath(g, cx, cy, r, seed) {
    g.beginPath()
    for (var i = 0; i <= 72; i++) {
      var a = (i / 72) * TAU
      var k = 0.78 + 0.34 * fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, seed, 3)
      var x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k
      if (i) g.lineTo(x, y); else g.moveTo(x, y)
    }
    g.closePath()
  }
  /**
   * Real-geography ink map of the city. Water, rivers and coast come from OpenStreetMap (s.geo); the
   * modern road and rail network fades in with o.roads (0..1) and must stay faint before modern times.
   * o.view { x, y, km } · o.areas [{ id | x,y,radius_km, p, color, label }] (historic extents are
   * approximate: the "AI illustration" tag is drawn on each) · o.places [{ id, p, hot, lost, label }]
   * · o.lang · o.water (alpha). Returns { px(xkm, ykm) -> [x, y], scale } for the scene's own marks.
   */
  function cityMap(g, s, o) {
    o = o || {}
    var geo = s.geo
    var W = s.W, H = s.H, v = o.view || { x: 0, y: 0, km: (geo && geo.radius_km) || 8 }
    var sc = W / (2 * v.km)
    var px = function (x, y) { return [W / 2 + (x - v.x) * sc, H / 2 - (y - v.y) * sc] }
    var lang = o.lang || s.lang
    var line = function (pts) { g.beginPath(); for (var i = 0; i < pts.length; i++) { var q = px(pts[i][0], pts[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) } }
    if (!geo) return { px: px, scale: sc }
    g.save()
    g.lineCap = 'round'; g.lineJoin = 'round'
    var wa = o.water == null ? 1 : o.water
    // water bodies: indigo wash with a darker bank line
    for (var i = 0; i < geo.water.length; i++) {
      line(geo.water[i]); g.closePath()
      g.fillStyle = rgba(PAL.indigo, 0.30 * wa); g.fill()
      g.strokeStyle = rgba(PAL.ink, 0.35 * wa); g.lineWidth = 1.4; g.stroke()
    }
    for (var c = 0; c < geo.coast.length; c++) {
      line(geo.coast[c]); g.strokeStyle = rgba(PAL.indigo, 0.25 * wa); g.lineWidth = Math.max(8, 0.35 * sc); g.stroke()
      line(geo.coast[c]); g.strokeStyle = rgba(PAL.ink, 0.6 * wa); g.lineWidth = 2; g.stroke()
    }
    // rivers: wide soft wash + ink centre line (canals thinner)
    for (var rI = 0; rI < geo.rivers.length; rI++) {
      var rv = geo.rivers[rI]
      line(rv.pts); g.strokeStyle = rgba(PAL.indigo, 0.26 * wa); g.lineWidth = Math.max(rv.canal ? 3 : 7, (rv.canal ? 0.03 : 0.12) * sc); g.stroke()
      line(rv.pts); g.strokeStyle = rgba(PAL.indigo, 0.7 * wa); g.lineWidth = rv.canal ? 1.2 : 2.4; g.stroke()
    }
    var ra = o.roads || 0
    if (ra > 0) {
      for (var k = 0; k < geo.roads.length; k++) {
        var rd = geo.roads[k]
        line(rd.pts); g.strokeStyle = rgba(PAL.ink, ra * [0.55, 0.45, 0.34, 0.2][rd.rank]); g.lineWidth = [3, 2.4, 1.7, 1.1][rd.rank]; g.stroke()
      }
      g.setLineDash([10, 8])
      for (var q = 0; q < geo.rail.length; q++) { line(geo.rail[q]); g.strokeStyle = rgba(PAL.inkSoft, 0.35 * ra); g.lineWidth = 1.6; g.stroke() }
      g.setLineDash([])
    }
    var byId = {}
    for (var a0 = 0; a0 < (geo.areas || []).length; a0++) byId['area:' + geo.areas[a0].id] = geo.areas[a0]
    for (var p0 = 0; p0 < (geo.places || []).length; p0++) byId[geo.places[p0].id] = geo.places[p0]
    // historic extents: approximate washes, always tagged as AI illustration
    var tag = /^zh/.test(lang) ? 'AI 示意' : 'AI illustration'
    var areas = o.areas || []
    for (var ai = 0; ai < areas.length; ai++) {
      var ar = areas[ai], base = ar.id ? byId['area:' + ar.id] || {} : {}
      var ap = ar.p == null ? 1 : clamp(ar.p, 0, 1)
      if (ap <= 0) continue
      var cx = ar.x != null ? ar.x : base.x || 0, cy = ar.y != null ? ar.y : base.y || 0
      var rk = (ar.radius_km || base.radius_km || 1) * ease.out(ap)
      var cc = px(cx, cy), rr = rk * sc
      var col = ar.color || PAL.ochre
      for (var w = 0; w < 3; w++) { blobPath(g, cc[0], cc[1], rr * (1 - w * 0.08), (ar.seed || 300 + ai) + w); g.fillStyle = rgba(col, 0.12 * ap); g.fill() }
      blobPath(g, cc[0], cc[1], rr, ar.seed || 300 + ai)
      g.setLineDash([14, 10]); g.strokeStyle = rgba(ar.color || PAL.ink, 0.7 * ap); g.lineWidth = 2.6; g.stroke(); g.setLineDash([])
      var al = ar.label || geoLabel(base, lang)
      // label sits on the top edge of the wash, kept inside the frame when the wash is larger than it
      var ty = Math.max(H * 0.1, cc[1] - rr * 0.98), tx = clamp(cc[0], W * 0.12, W * 0.88)
      g.font = '26px "LXGW WenKai", "Noto Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'
      g.globalAlpha = ap
      if (al) { g.lineWidth = 6; g.strokeStyle = rgba(PAL.paper, 0.85); g.strokeText(al, tx, ty - 22); g.fillStyle = PAL.ink; g.fillText(al, tx, ty - 22) }
      g.font = '20px "Noto Sans", "LXGW WenKai", sans-serif'; g.fillStyle = rgba(PAL.cinnabar, 0.9)
      g.lineWidth = 5; g.strokeStyle = rgba(PAL.paper, 0.85); g.strokeText(tag, tx, ty - (al ? 0 : 4))
      g.fillText(tag, tx, ty - (al ? 0 : 4))
      g.globalAlpha = 1
    }
    // places: cinnabar dots with labels on a paper halo; lost places are grey with a cross
    var places = o.places || []
    for (var pi = 0; pi < places.length; pi++) {
      var pl = places[pi], d = byId[pl.id]
      if (!d) continue
      var pp = pl.p == null ? 1 : clamp(pl.p, 0, 1)
      if (pp <= 0) continue
      var pt = px(d.x, d.y), lost = !!pl.lost
      var rad = (pl.hot ? 13 : 9) * ease.back(pp)
      g.fillStyle = lost ? rgba(PAL.inkSoft, 0.6 * pp) : rgba(PAL.cinnabar, pp)
      g.beginPath(); g.arc(pt[0], pt[1], rad, 0, TAU); g.fill()
      g.strokeStyle = rgba(PAL.ink, 0.75 * pp); g.lineWidth = 2; g.stroke()
      if (pl.hot) { g.strokeStyle = rgba(PAL.cinnabar, 0.5 * pp * (1 - (s.t % 1.4) / 1.4)); g.lineWidth = 3; g.beginPath(); g.arc(pt[0], pt[1], rad + 10 + 26 * ((s.t % 1.4) / 1.4), 0, TAU); g.stroke() }
      if (lost) { g.strokeStyle = rgba(PAL.ink, 0.8 * pp); g.lineWidth = 3; g.beginPath(); g.moveTo(pt[0] - 10, pt[1] - 10); g.lineTo(pt[0] + 10, pt[1] + 10); g.moveTo(pt[0] + 10, pt[1] - 10); g.lineTo(pt[0] - 10, pt[1] + 10); g.stroke() }
      var lb = pl.label || geoLabel(d, lang)
      if (!lb) continue
      var right = pl.align === 'left'
      g.save(); g.globalAlpha *= pp
      g.font = (pl.hot ? 36 : 30) + 'px "LXGW WenKai", "Noto Serif", serif'
      g.textAlign = right ? 'right' : 'left'; g.textBaseline = 'middle'
      var lx = pt[0] + (right ? -22 : 22), ly = pt[1] + (pl.dy || 0)
      g.lineWidth = 8; g.strokeStyle = rgba(PAL.paper, 0.9); g.strokeText(lb, lx, ly)
      g.fillStyle = lost ? PAL.inkSoft : PAL.ink; g.fillText(lb, lx, ly)
      g.restore()
    }
    g.restore()
    return { px: px, scale: sc }
  }
  /** Map scale bar (km) in the upper-left corner, kept clear of the caption band. */
  function scaleBar(g, s, view, o) {
    o = o || {}
    var sc = s.W / (2 * view.km)
    var steps = [0.2, 0.5, 1, 2, 5, 10, 20], km = steps[0]
    for (var i = 0; i < steps.length; i++) if (steps[i] * sc <= s.W * 0.14) km = steps[i]
    var x = o.x || s.W * 0.05, y = o.y || s.H * 0.1, w = km * sc
    g.save(); g.strokeStyle = rgba(PAL.ink, 0.75); g.lineWidth = 3
    g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y - 8); g.stroke()
    g.font = '22px "Noto Serif", serif'; g.fillStyle = PAL.ink; g.textBaseline = 'bottom'; g.textAlign = 'left'
    g.fillText(km + ' km', x + w + 10, y + 4)
    g.restore()
  }
  /** Large year marker (era stamp), e.g. "753 BCE" / "公元前753年", top-left under the scale bar. */
  function yearMark(g, s, text, p, o) {
    o = o || {}
    var a = clamp(p == null ? 1 : p, 0, 1)
    if (a <= 0 || !text) return
    g.save(); g.globalAlpha = a
    g.font = (o.size || 76) + 'px "LXGW WenKai", "Noto Serif", serif'
    g.textAlign = o.align || 'left'; g.textBaseline = 'top'
    var x = o.x == null ? s.W * 0.05 : o.x, y = o.y == null ? s.H * 0.13 : o.y
    g.lineWidth = 10; g.strokeStyle = rgba(PAL.paper, 0.85); g.strokeText(text, x, y)
    g.fillStyle = o.color || PAL.ink; g.fillText(text, x, y)
    g.restore()
  }
  window.CI_KIT = {
    cityMap: cityMap, geoView: geoView, geoLabel: geoLabel, scaleBar: scaleBar, yearMark: yearMark,
    dryFill: dryFill, wall: wall, house: house,
    PAL: PAL, rng: rng, noise: noise, fbm: fbm, ease: ease, clamp: clamp, prog: prog, rgba: rgba,
    paper: paper, stroke: stroke, curve: curve, wash: wash, bleed: bleed, mist: mist,
    frame: frame, layer: layer,
    mountains: mountains, water: water, boat: boat, pavilion: pavilion, scroll: scroll, scrollRod: scrollRod,
    bamboo: bamboo, moon: moon, inkstone: inkstone, brush: brush, seal: seal, plum: plum, geese: geese,
    figure: figure, textReveal: textReveal, route: route, river: river, timeline: timeline, countUp: countUp,
    grass: grass, rain: rain, lattice: lattice, cliff: cliff, roundRect: roundRect,
  }
})()
