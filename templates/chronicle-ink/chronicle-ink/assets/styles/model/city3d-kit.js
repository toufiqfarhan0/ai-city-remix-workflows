/* City 3D kit (style `model`): the real city as a plaster table model in WebGL, so the camera can fly
 * through it continuously. Ground = OpenStreetMap streets, water and rail painted into a texture; every
 * OSM building footprint extruded to its mapped height (or the median of mapped neighbours); history
 * as coloured light from era masks, a halo, a focus glow and a scar tint, all in one shader. Overlays
 * (edges, walls, labels) are drawn on the 2D frame with the same camera (K.city3d.project).
 * Deterministic: no clock, no randomness; the WebGL context comes from s.gl() (software rasterised on
 * the CPU render path). Extends the base kit and model-kit.js (loaded first). */
(function () {
  'use strict'
  var K = window.CI_KIT
  var clamp = K.clamp
  var MAX_AREAS = 6
  // ───────── small math ─────────
  function persp(fovy, aspect, near, far) { var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0] }
  function lookAt(e, c, up) {
    var z0 = e[0] - c[0], z1 = e[1] - c[1], z2 = e[2] - c[2], l = Math.hypot(z0, z1, z2); z0 /= l; z1 /= l; z2 /= l
    var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0; l = Math.hypot(x0, x1, x2); x0 /= l; x1 /= l; x2 /= l
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0
    return [x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0, -(x0 * e[0] + x1 * e[1] + x2 * e[2]), -(y0 * e[0] + y1 * e[1] + y2 * e[2]), -(z0 * e[0] + z1 * e[1] + z2 * e[2]), 1]
  }
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s } return o }
  /**
   * Camera from a view { x, y (target, km), d (distance, km), pitch (deg above the ground), yaw (deg,
   * 0 = looking north), fov (deg) }. Returns { m (view-projection), eye, project(x, y, z) -> [px, py, w] }.
   */
  function camera(v, W, H) {
    var p = (v.pitch == null ? 45 : v.pitch) * Math.PI / 180, yw = (v.yaw || 0) * Math.PI / 180, d = v.d
    var eye = [v.x - Math.sin(yw) * Math.cos(p) * d, v.y - Math.cos(yw) * Math.cos(p) * d, Math.sin(p) * d]
    var up = p > 1.5 ? [Math.sin(yw), Math.cos(yw), 0] : [0, 0, 1]
    var m = mul(persp((v.fov || 34) * Math.PI / 180, W / H, Math.max(0.005, d * 0.03), d * 8 + 6), lookAt(eye, [v.x, v.y, 0], up))
    var project = function (x, y, z) {
      var X = m[0] * x + m[4] * y + m[8] * (z || 0) + m[12], Y = m[1] * x + m[5] * y + m[9] * (z || 0) + m[13], Wc = m[3] * x + m[7] * y + m[11] * (z || 0) + m[15]
      if (Wc <= 1e-6) return [NaN, NaN, -1]
      return [(X / Wc * 0.5 + 0.5) * W, (1 - (Y / Wc * 0.5 + 0.5)) * H, Wc]
    }
    return { m: m, eye: eye, project: project, view: v }
  }
  /** Catmull-Rom between views b and c (a before, d after), t 0..1; distance in log space, yaw unwrapped. */
  function pathView(a, b, c, d, t) {
    a = a || b; d = d || c
    var cr = function (p0, p1, p2, p3) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3) }
    var un = function (ref, y) { while (y - ref > 180) y -= 360; while (ref - y > 180) y += 360; return y }
    var yb = b.yaw || 0, ya = un(yb, a.yaw || 0), yc = un(yb, c.yaw || 0), yd = un(yc, d.yaw || 0)
    var L = Math.log
    return {
      x: cr(a.x, b.x, c.x, d.x), y: cr(a.y, b.y, c.y, d.y), d: Math.exp(cr(L(a.d), L(b.d), L(c.d), L(d.d))),
      pitch: clamp(cr(a.pitch, b.pitch, c.pitch, d.pitch), 5, 89.5), yaw: cr(ya, yb, yc, yd), fov: cr(a.fov || 34, b.fov || 34, c.fov || 34, d.fov || 34),
    }
  }
  // ───────── geometry ─────────
  /** Ear clipping of a simple polygon ([[x, y]...], open or closed); returns triangle index triples. */
  function earcut(pts) {
    var n = pts.length
    if (n > 3 && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1]) n--
    if (n < 3) return []
    var area = 0; for (var i = 0; i < n; i++) { var j = (i + 1) % n; area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1] }
    var idx = []; for (var q = 0; q < n; q++) idx.push(area > 0 ? q : n - 1 - q)
    var out = [], guard = 0
    var cross = function (a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) }
    var same = function (p, q) { return p[0] === q[0] && p[1] === q[1] }
    var inside = function (p, a, b, c) { if (same(p, a) || same(p, b) || same(p, c)) return false; return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0 }
    while (idx.length > 3 && guard++ < 5000) {
      var found = false
      for (var k = 0; k < idx.length; k++) {
        var i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length]
        var A = pts[i0], B = pts[i1], C = pts[i2]
        if (cross(A, B, C) <= 1e-14) continue
        var ok = true
        for (var m = 0; m < idx.length && ok; m++) { var t = idx[m]; if (t === i0 || t === i1 || t === i2) continue; if (inside(pts[t], A, B, C)) ok = false }
        if (!ok) continue
        out.push(i0, i1, i2); idx.splice(k, 1); found = true; break
      }
      if (!found) break
    }
    if (idx.length === 3) out.push(idx[0], idx[1], idx[2])
    // self-touching or degenerate footprints: close the rest with a fan so the roof is never missing
    else if (idx.length > 3) for (var fz = 1; fz < idx.length - 1; fz++) out.push(idx[0], idx[fz], idx[fz + 1])
    return out
  }
  var signedArea = function (r) { var a = 0; for (var i = 0; i < r.length; i++) { var j = (i + 1) % r.length; a += r[i][0] * r[j][1] - r[j][0] * r[i][1] } return a / 2 }
  var openRing = function (r) { var n = r.length; return n > 3 && r[0][0] === r[n - 1][0] && r[0][1] === r[n - 1][1] ? r.slice(0, n - 1) : r.slice() }
  /** One polygon from an outer ring and its holes, each hole joined to the outer ring by a bridge. */
  function bridge(outer, holes) {
    var poly = openRing(outer), oa = signedArea(poly)
    holes.forEach(function (h0) {
      var h = openRing(h0); if (signedArea(h) * oa > 0) h.reverse()
      var hi = 0; for (var i = 1; i < h.length; i++) if (h[i][0] > h[hi][0]) hi = i
      var best = 0, bd = Infinity; for (var j = 0; j < poly.length; j++) { var d = Math.hypot(poly[j][0] - h[hi][0], poly[j][1] - h[hi][1]); if (d < bd) { bd = d; best = j } }
      var loop = []; for (var k = 0; k <= h.length; k++) loop.push(h[(hi + k) % h.length])
      poly = poly.slice(0, best + 1).concat(loop, [poly[best]], poly.slice(best + 1))
    })
    return poly
  }
  /** Heights in metres: mapped OSM heights, else the median of mapped buildings in the same 300 m cell, else the global median. */
  function fillHeights(geo) {
    var bs = geo.buildings, hs = geo.heights || [], cell = 0.3, buckets = {}, known = []
    var cen = bs.map(function (b) { var x = 0, y = 0; for (var i = 0; i < b.length; i++) { x += b[i][0]; y += b[i][1] } return [x / b.length, y / b.length] })
    for (var i = 0; i < bs.length; i++) if (hs[i] != null) { var key = Math.floor(cen[i][0] / cell) + ',' + Math.floor(cen[i][1] / cell); (buckets[key] = buckets[key] || []).push(hs[i]); known.push(hs[i]) }
    var med = function (a) { a = a.slice().sort(function (p, q) { return p - q }); return a[a.length >> 1] }
    var gm = known.length ? med(known) : 14
    var mk = {}
    for (var k in buckets) if (buckets[k].length >= 3) mk[k] = med(buckets[k])
    var out = new Float32Array(bs.length), est = new Uint8Array(bs.length)
    for (var j = 0; j < bs.length; j++) {
      if (hs[j] != null) { out[j] = hs[j]; continue }
      var cx = Math.floor(cen[j][0] / cell), cy = Math.floor(cen[j][1] / cell), v = null
      for (var r = 0; r <= 2 && v == null; r++) for (var dx = -r; dx <= r && v == null; dx++) for (var dy = -r; dy <= r && v == null; dy++) if (mk[(cx + dx) + ',' + (cy + dy)] != null) v = mk[(cx + dx) + ',' + (cy + dy)]
      out[j] = v == null ? gm : v; est[j] = 1
    }
    return { h: out, est: est, centroids: cen, known: known.length }
  }
  // ───────── textures ─────────
  function groundCanvas(geo, R, size) {
    var c = document.createElement('canvas'); c.width = size; c.height = size
    var g = c.getContext('2d'), sc = size / (2 * R)
    var P = function (p) { return [(p[0] + R) * sc, (R - p[1]) * sc] }
    var path = function (pts, close) { g.beginPath(); for (var i = 0; i < pts.length; i++) { var q = P(pts[i]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) } if (close) g.closePath() }
    g.fillStyle = '#9C9890'; g.fillRect(0, 0, size, size)
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.strokeStyle = 'rgba(70,68,64,0.35)'
    for (var r = 0; r < (geo.rail || []).length; r++) { g.lineWidth = Math.max(1, 0.006 * sc); path(geo.rail[r].pts || geo.rail[r]); g.stroke() }
    for (var k = 0; k < geo.streets.length; k++) { var st = geo.streets[k]; g.strokeStyle = 'rgba(178,174,166,0.9)'; g.lineWidth = Math.max(1, [0.012, 0.008, 0.005][st.rank] * sc); path(st.pts); g.stroke() }
    for (var j = 0; j < geo.roads.length; j++) { var rd = geo.roads[j]; g.strokeStyle = 'rgba(190,186,178,0.95)'; g.lineWidth = Math.max(1.5, [0.026, 0.02, 0.016, 0.012][rd.rank] * sc); path(rd.pts); g.stroke() }
    g.fillStyle = '#2E3A40'
    var sea = seaCanvas(geo, R, 1024)
    if (sea) { g.imageSmoothingEnabled = true; g.drawImage(sea, 0, 0, size, size) }
    for (var w = 0; w < geo.water.length; w++) { path(geo.water[w], true); g.fill() }
    g.strokeStyle = '#2E3A40'
    for (var v = 0; v < geo.rivers.length; v++) { var rv = geo.rivers[v]; g.lineWidth = Math.max(2, (rv.canal ? 0.015 : 0.07) * sc); path(rv.pts); g.stroke() }
    return c
  }
  /**
   * The sea as a canvas (sea colour, transparent land) from OpenStreetMap coastlines, which only exist
   * as lines with the land on their left. Each coastline seeds a thin band of "land" on its left and
   * "sea" on its right; every other pixel takes the side of its nearest seed (a multi-source flood),
   * so open water far from the shore is sea and inland is land. Null when there is no coastline.
   */
  function seaCanvas(geo, R, N) {
    var coast = geo.coast || []
    if (!coast.length) return null
    var sc = N / (2 * R), lab = new Uint8Array(N * N), q = new Int32Array(N * N), qh = 0, qt = 0
    var put = function (x, y, v) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N) return; var o = y * N + x; if (!lab[o]) { lab[o] = v; q[qt++] = o } }
    for (var c = 0; c < coast.length; c++) {
      var pts = coast[c].pts || coast[c]
      for (var i = 1; i < pts.length; i++) {
        var ax = (pts[i - 1][0] + R) * sc, ay = (R - pts[i - 1][1]) * sc, bx = (pts[i][0] + R) * sc, by = (R - pts[i][1]) * sc
        var dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, n = Math.ceil(l)
        // canvas y points down, so the left of travel (land) is (dy, -dx) / l and the right (sea) its opposite
        var lx = dy / l, ly = -dx / l
        for (var t = 0; t <= n; t++) { var x = ax + (dx * t) / n, y = ay + (dy * t) / n; put(x + lx * 1.5, y + ly * 1.5, 1); put(x - lx * 1.5, y - ly * 1.5, 2) }
      }
    }
    while (qh < qt) {
      var o = q[qh++], v = lab[o], x0 = o % N, y0 = (o - x0) / N
      if (x0 > 0 && !lab[o - 1]) { lab[o - 1] = v; q[qt++] = o - 1 }
      if (x0 < N - 1 && !lab[o + 1]) { lab[o + 1] = v; q[qt++] = o + 1 }
      if (y0 > 0 && !lab[o - N]) { lab[o - N] = v; q[qt++] = o - N }
      if (y0 < N - 1 && !lab[o + N]) { lab[o + N] = v; q[qt++] = o + N }
    }
    var cv = document.createElement('canvas'); cv.width = N; cv.height = N
    var g = cv.getContext('2d'), img = g.createImageData(N, N), px = img.data
    for (var k = 0; k < lab.length; k++) if (lab[k] === 2) { px[k * 4] = 46; px[k * 4 + 1] = 58; px[k * 4 + 2] = 64; px[k * 4 + 3] = 255 }
    g.putImageData(img, 0, 0)
    return cv
  }
  /** Era masks: two RGB canvases (areas 0–2, 3–5); spot layers are soft radial light. */
  function maskCanvases(geo, layers, R, size) {
    var cs = [0, 1].map(function () { var c = document.createElement('canvas'); c.width = size; c.height = size; var g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, size, size); return c })
    var sc = size / (2 * R), areas = {}
    for (var a = 0; a < (geo.areas || []).length; a++) areas[geo.areas[a].id] = geo.areas[a]
    var chans = ['#FF0000', '#00FF00', '#0000FF']
    layers.forEach(function (L, i) {
      if (i >= MAX_AREAS) return
      var A = areas[L.area]; if (!A || !A.ring) return
      var c = cs[Math.floor(i / 3)], g = c.getContext('2d'), ch = i % 3
      var tmp = document.createElement('canvas'); tmp.width = size; tmp.height = size
      var t = tmp.getContext('2d')
      if (L.spot) {
        var r = Math.sqrt(A.km2 / Math.PI) * 2.4 * sc
        var cx = (A.x + R) * sc, cy = (R - A.y) * sc
        var gr = t.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
        t.fillStyle = gr; t.beginPath(); t.arc(cx, cy, r, 0, Math.PI * 2); t.fill()
      } else {
        t.filter = 'blur(' + Math.max(1, Math.round(size / 1400)) + 'px)'
        t.fillStyle = '#fff'; t.beginPath()
        A.ring.forEach(function (p, k) { var x = (p[0] + R) * sc, y = (R - p[1]) * sc; if (k) t.lineTo(x, y); else t.moveTo(x, y) })
        t.closePath(); t.fill(); t.filter = 'none'
      }
      // copy the white mask into one channel (lighter adds the channels)
      t.globalCompositeOperation = 'source-in'; t.fillStyle = chans[ch]; t.fillRect(0, 0, size, size)
      g.globalCompositeOperation = 'lighter'; g.drawImage(tmp, 0, 0); g.globalCompositeOperation = 'source-over'
    })
    return cs
  }
  // ───────── GL ─────────
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aCen; attribute float aTop; attribute float aH; attribute vec2 aLife;',
    'uniform mat4 uM; uniform float uScaleZ; uniform float uYear; uniform vec4 uSink;',
    'varying vec3 vNor; varying vec2 vCen; varying vec2 vXY; varying float vTop; varying float vH; varying float vDepth; varying float vAlive;',
    'void main(){ float alive = aLife.y > 0.0 ? smoothstep(aLife.x, aLife.x + aLife.y, uYear) : 1.0; vAlive = alive; vec3 p = vec3(aPos.xy, aPos.z * uScaleZ * max(alive, 0.04)); float skd = length(aCen - uSink.xy); p.z *= 1.0 - 0.88 * (1.0 - smoothstep(uSink.z * 0.82, uSink.z, skd)) * uSink.w; gl_Position = uM * vec4(p, 1.0); vNor = aNor; vCen = aCen; vXY = aPos.xy; vTop = aTop; vH = aH; vDepth = gl_Position.w; }',
  ].join('\n')
  var FS = [
    'precision highp float;',
    'varying vec3 vNor; varying vec2 vCen; varying vec2 vXY; varying float vTop; varying float vH; varying float vDepth; varying float vAlive;',
    'uniform float uT;',
    'uniform sampler2D uGround; uniform sampler2D uMaskA; uniform sampler2D uMaskB; uniform float uR; uniform float uIsGround;',
    'uniform vec4 uEraA; uniform vec4 uEraB; uniform vec3 uCol[6];',
    // extent morph: one era's light spreads from a seed extent at the same speed everywhere (a distance
    // field, 0 inside the seed, 1 at the farthest point of the target); uRev = (front, era index or -1,
    // active, 0)
    'uniform vec4 uRev; uniform sampler2D uMorph;',
    'uniform float uDim; uniform float uBright; uniform vec4 uHalo; uniform vec4 uFocus; uniform vec4 uScar; uniform float uHeightTint;',
    'uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform vec3 uSun;',
    'vec3 ramp(float h){ vec3 a = vec3(0.56,0.70,0.91); vec3 b = vec3(0.80,0.74,0.92); vec3 c = vec3(0.96,0.78,0.84); vec3 d = vec3(1.0,0.97,0.93);',
    '  if (h < 18.0) return mix(a, b, h / 18.0); if (h < 40.0) return mix(b, c, (h - 18.0) / 22.0); return mix(c, d, clamp((h - 40.0) / 60.0, 0.0, 1.0)); }',
    'void main(){',
    '  vec2 uvC = (vec2(vCen.x, -vCen.y) + uR) / (2.0 * uR);',
    '  vec2 uvP = (vec2(vXY.x, -vXY.y) + uR) / (2.0 * uR);',
    '  vec2 uv = uIsGround > 0.5 ? uvP : uvC;',
    '  bool inTex = uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0;',
    '  vec3 ma = inTex ? texture2D(uMaskA, uv).rgb : vec3(0.0); vec3 mb = inTex ? texture2D(uMaskB, uv).rgb : vec3(0.0);',
    '  float w[6]; w[0]=ma.r*uEraA.x; w[1]=ma.g*uEraA.y; w[2]=ma.b*uEraA.z; w[3]=mb.r*uEraB.x; w[4]=mb.g*uEraB.y; w[5]=mb.b*uEraB.z;',
    '  float mfront = 0.0;',
    '  if (uRev.y >= 0.0) {',
    '    float md = inTex ? texture2D(uMorph, uv).r : 1.0; float pe = uRev.x * 1.06 - 0.01;',
    '    float inside = 1.0 - smoothstep(pe, pe + 0.02, md);',
    '    for (int i = 0; i < 6; i++) { if (float(i) == uRev.y) { mfront = w[i] * exp(-pow((md - pe) / 0.018, 2.0)) * uRev.z * smoothstep(0.004, 0.03, md); w[i] *= inside; } }',
    '  }',
    '  vec3 tint = vec3(0.0); float sw = 0.0; float lit = 0.0;',
    '  for (int i = 0; i < 6; i++) { tint += uCol[i] * w[i]; sw += w[i]; lit = max(lit, w[i]); }',
    '  if (sw > 0.0) tint /= sw;',
    '  vec3 base; float wet = 0.0;',
    '  if (uIsGround > 0.5) {',
    '    vec3 tex = inTex ? texture2D(uGround, uvP).rgb : vec3(0.612,0.596,0.565);',
    '    float edge = inTex ? smoothstep(0.0, 0.14, min(min(uvP.x, 1.0 - uvP.x), min(uvP.y, 1.0 - uvP.y))) : 0.0;',
    '    base = mix(vec3(0.55,0.54,0.51), tex, edge);',
    // water (dark texels) takes no era light: an extent's outline may cross a harbour or a strait
    '    wet = 1.0 - smoothstep(0.26, 0.36, dot(tex, vec3(0.333)));',
    '  } else {',
    '    float diff = max(dot(normalize(vNor), normalize(uSun)), 0.0);',
    '    float shade = vNor.z > 0.5 ? 1.0 : 0.58 + 0.42 * diff;',
    '    float ao = mix(0.72, 1.0, vTop);',
    '    base = vec3(0.86,0.85,0.82) * shade * ao;',
    '    base = mix(base, vec3(0.70,0.69,0.66), smoothstep(7.0, 22.0, vDepth) * 0.7);',
    '    base = mix(base, ramp(vH) * shade * ao, uHeightTint);',
    '    base = mix(base * 0.62, base, vAlive);',
    '  }',
    '  lit *= 1.0 - wet;',
    '  vec3 col = base * uBright * (1.0 - uDim * (1.0 - lit));',
    '  vec3 litCol = base * mix(vec3(1.0), tint * 1.35, 0.78) + tint * 0.06;',
    '  col = mix(col, litCol * uBright, lit * (uIsGround > 0.5 ? 0.7 : 0.85));',
    '  float hd = length(vXY - uHalo.xy); float hb = uHalo.z > 0.0 ? exp(-pow((hd - uHalo.z) / max(uHalo.w, 0.001), 2.0)) : 0.0;',
    '  col += vec3(1.0, 0.98, 0.94) * hb * 0.55;',
    // the ground uses its own position (its vertices carry no building centroid)
    '  float fd = length((uIsGround > 0.5 ? vXY : vCen) - uFocus.xy); float fb = (1.0 - smoothstep(uFocus.z * 0.6, uFocus.z, fd)) * uFocus.w;',
    '  col = mix(col, vec3(1.0, 0.80, 0.48) * (base * 0.6 + 0.55), fb * (uIsGround > 0.5 ? 0.35 : 0.9));',
    '  float sd = length(vXY - uScar.xy); float nz = 0.5 + 0.5 * sin(vXY.x * 23.0 + sin(vXY.y * 31.0) * 1.7) * cos(vXY.y * 19.0 - uT * 0.8);',
    '  float rr = uScar.z * (0.86 + 0.22 * nz); float inner = (1.0 - smoothstep(rr * 0.88, rr, sd)) * uScar.w;',
    '  float front = exp(-pow((sd - rr) / (0.035 + 0.06 * uScar.z), 2.0)) * uScar.w * step(0.001, uScar.z);',
    '  col = mix(col, col * vec3(0.62, 0.38, 0.32), inner * 0.55);',
    '  col += vec3(1.0, 0.42, 0.10) * front * (0.75 + 0.25 * sin(uT * 11.0 + nz * 6.283)) * (uIsGround > 0.5 ? 0.6 : 1.0);',
    '  col += vec3(1.0, 0.98, 0.92) * mfront * (1.0 - wet) * (uIsGround > 0.5 ? 0.55 : 0.4);',
    '  float f = smoothstep(uFogNear, uFogFar, vDepth);',
    // a round edge: the model fades into the fog towards the data radius, so no square ever shows
    '  f = max(f, smoothstep(0.82, 0.99, length(vXY) / uR));',
    '  gl_FragColor = vec4(mix(col, uFog, f), 1.0);',
    '}',
  ].join('\n')
  function program(gl) {
    var sh = function (t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p))
    return p
  }
  // a large canvas can come back blank when the renderer is short of memory; that would upload a black
  // ground for a frame, so check a few pixels and let the caller redraw it
  function blank(canvas) {
    var c = canvas.getContext('2d'), n = canvas.width, any = 0
    for (var i = 1; i < 8; i++) { var d = c.getImageData(Math.floor(n * i / 8), Math.floor(n * (8 - i) / 8), 1, 1).data; any += d[3] }
    return any === 0
  }
  /**
   * Distance field for an extent morph, memoised by key: for the data square (2R km, 512 px) the
   * distance from the seed polygon (0 inside), divided by the largest distance reached inside the
   * target polygon, as a grey canvas; maxD in km. Chamfer 3-4 transform.
   */
  var FIELDS = {}
  function morphField(key, seed, target, R) {
    if (FIELDS[key]) return FIELDS[key]
    var N = 512, sc = N / (2 * R)
    var raster = function (ring) {
      var c = document.createElement('canvas'); c.width = N; c.height = N
      var t = c.getContext('2d'); t.fillStyle = '#000'; t.fillRect(0, 0, N, N); t.fillStyle = '#fff'; t.beginPath()
      for (var i = 0; i < ring.length; i++) { var x = (ring[i][0] + R) * sc, y = (R - ring[i][1]) * sc; if (i) t.lineTo(x, y); else t.moveTo(x, y) }
      t.closePath(); t.fill()
      var d = t.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N)
      for (var k = 0; k < m.length; k++) m[k] = d[k * 4] > 127 ? 1 : 0
      return m
    }
    var ms = raster(seed), mt = raster(target), D = new Float32Array(N * N), BIG = 1e9
    for (var i = 0; i < D.length; i++) D[i] = ms[i] ? 0 : BIG
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var o = y * N + x, v = D[o]
      if (x > 0) v = Math.min(v, D[o - 1] + 3)
      if (y > 0) { v = Math.min(v, D[o - N] + 3); if (x > 0) v = Math.min(v, D[o - N - 1] + 4); if (x < N - 1) v = Math.min(v, D[o - N + 1] + 4) }
      D[o] = v
    }
    for (var y2 = N - 1; y2 >= 0; y2--) for (var x2 = N - 1; x2 >= 0; x2--) {
      var o2 = y2 * N + x2, v2 = D[o2]
      if (x2 < N - 1) v2 = Math.min(v2, D[o2 + 1] + 3)
      if (y2 < N - 1) { v2 = Math.min(v2, D[o2 + N] + 3); if (x2 < N - 1) v2 = Math.min(v2, D[o2 + N + 1] + 4); if (x2 > 0) v2 = Math.min(v2, D[o2 + N - 1] + 4) }
      D[o2] = v2
    }
    var maxPx = 1
    for (var j = 0; j < D.length; j++) if (mt[j] && D[j] < BIG && D[j] > maxPx) maxPx = D[j]
    var c = document.createElement('canvas'); c.width = N; c.height = N
    var g = c.getContext('2d'), img = g.createImageData(N, N), px = img.data
    for (var q = 0; q < D.length; q++) { var val = Math.min(255, Math.round(255 * Math.min(1, D[q] / maxPx))); px[q * 4] = px[q * 4 + 1] = px[q * 4 + 2] = val; px[q * 4 + 3] = 255 }
    g.putImageData(img, 0, 0)
    FIELDS[key] = { canvas: c, maxD: (maxPx / 3) / sc }
    return FIELDS[key]
  }
  function tex(gl, canvas, unit) {
    var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    if (gl.getError() !== gl.NO_ERROR) {
      // retry at half size rather than leave an incomplete (black) texture
      var h = document.createElement('canvas'); h.width = canvas.width / 2; h.height = canvas.height / 2
      h.getContext('2d').drawImage(canvas, 0, 0, h.width, h.height)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, h)
    }
    // mipmaps: without them the street texture shimmers while the camera zooms
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.finish()
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  /** Builds the GL state for a geo (call once through s.gl(key, W, H, init)). o = { R, exaggerate, layers, minArea } */
  function init(gl, geo, o) {
    var R = o.R, ex = o.exaggerate || 1, layers = o.layers || []
    if (!gl.getExtension('OES_element_index_uint')) throw new Error('OES_element_index_uint missing')
    var hf = fillHeights(geo)
    var pos = [], nor = [], cen = [], top = [], hh = [], life = [], ind = []
    var bornOf = o.born || null, spanOf = o.span || null, curB = -1
    var holesBy = {}; (geo.holes || []).forEach(function (hb) { (holesBy[hb[0]] = holesBy[hb[0]] || []).push(hb[1]) })
    var push = function (x, y, z, nx, ny, nz, cx, cy, t, h) { pos.push(x, y, z); nor.push(nx, ny, nz); cen.push(cx, cy); top.push(t); hh.push(h); life.push(curB >= 0 && bornOf ? bornOf[curB] : 0, curB >= 0 && spanOf ? spanOf[curB] : 0); return pos.length / 3 - 1 }
    for (var b = 0; b < geo.buildings.length; b++) {
      var ring = geo.buildings[b], n = ring.length
      curB = b
      if (n > 3 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) n--
      if (n < 3) continue
      var hm = hf.h[b], z = hm / 1000 * ex, c = hf.centroids[b]
      var hs = holesBy[b] || []
      var roof = hs.length ? bridge(ring, hs) : openRing(ring)
      var tri = earcut(roof)
      if (!tri.length) continue
      var base = pos.length / 3
      for (var i = 0; i < roof.length; i++) push(roof[i][0], roof[i][1], z, 0, 0, 1, c[0], c[1], 1, hm)
      for (var t = 0; t < tri.length; t++) ind.push(base + tri[t])
      // walls of the courtyards (normals point into the courtyard)
      hs.forEach(function (h0) {
        var h = openRing(h0), ha = signedArea(h) > 0 ? -1 : 1
        for (var e2 = 0; e2 < h.length; e2++) {
          var a0 = h[e2], a1 = h[(e2 + 1) % h.length], ddx = a1[0] - a0[0], ddy = a1[1] - a0[1], ll = Math.hypot(ddx, ddy) || 1
          var w0 = push(a0[0], a0[1], 0, ha * ddy / ll, -ha * ddx / ll, 0, c[0], c[1], 0, hm), w1 = push(a1[0], a1[1], 0, ha * ddy / ll, -ha * ddx / ll, 0, c[0], c[1], 0, hm)
          var w2 = push(a1[0], a1[1], z, ha * ddy / ll, -ha * ddx / ll, 0, c[0], c[1], 1, hm), w3 = push(a0[0], a0[1], z, ha * ddy / ll, -ha * ddx / ll, 0, c[0], c[1], 1, hm)
          ind.push(w0, w1, w2, w0, w2, w3)
        }
      })
      // orientation for outward normals
      var ar = 0; for (var a = 0; a < n; a++) { var a2 = (a + 1) % n; ar += ring[a][0] * ring[a2][1] - ring[a2][0] * ring[a][1] }
      var sgn = ar > 0 ? 1 : -1
      for (var e = 0; e < n; e++) {
        var p0 = ring[e], p1 = ring[(e + 1) % n], dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1
        var nx = sgn * dy / l, ny = -sgn * dx / l
        var v0 = push(p0[0], p0[1], 0, nx, ny, 0, c[0], c[1], 0, hm), v1 = push(p1[0], p1[1], 0, nx, ny, 0, c[0], c[1], 0, hm)
        var v2 = push(p1[0], p1[1], z, nx, ny, 0, c[0], c[1], 1, hm), v3 = push(p0[0], p0[1], z, nx, ny, 0, c[0], c[1], 1, hm)
        ind.push(v0, v1, v2, v0, v2, v3)
      }
    }
    curB = -1
    // the ground is a grid over the data square (past it everything is fog anyway): two huge triangles
    // reaching tens of km behind the camera were dropped by the software rasteriser on some poses
    var GN = 24, G = R * 1.02, g0 = pos.length / 3
    for (var gy = 0; gy <= GN; gy++) for (var gx = 0; gx <= GN; gx++) push(-G + 2 * G * gx / GN, -G + 2 * G * gy / GN, -0.0005, 0, 0, 1, 0, 0, 0, 0)
    var groundIdx = ind.length
    for (var qy = 0; qy < GN; qy++) for (var qx = 0; qx < GN; qx++) { var a0 = g0 + qy * (GN + 1) + qx; ind.push(a0, a0 + 1, a0 + GN + 2, a0, a0 + GN + 2, a0 + GN + 1) }
    var groundCount = GN * GN * 6
    var prog = program(gl)
    var buf = function (arr, size, name) { var bfr = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bfr); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); var loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0) }
    gl.useProgram(prog)
    buf(pos, 3, 'aPos'); buf(nor, 3, 'aNor'); buf(cen, 2, 'aCen'); buf(top, 1, 'aTop'); buf(hh, 1, 'aH'); buf(life, 2, 'aLife')
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind), gl.STATIC_DRAW)
    var gc = groundCanvas(geo, R, 4096)
    if (blank(gc)) gc = groundCanvas(geo, R, 4096)
    if (blank(gc)) gc = groundCanvas(geo, R, 2048)
    var gt = tex(gl, gc, 0)
    var masks = maskCanvases(geo, layers, R, 2048)
    var ta = tex(gl, masks[0], 1), tb = tex(gl, masks[1], 2)
    var U = {}; ['uM', 'uScaleZ', 'uGround', 'uMaskA', 'uMaskB', 'uR', 'uIsGround', 'uEraA', 'uEraB', 'uCol', 'uDim', 'uBright', 'uHalo', 'uFocus', 'uScar', 'uHeightTint', 'uYear', 'uT', 'uFog', 'uFogNear', 'uFogFar', 'uSun', 'uRev', 'uMorph', 'uSink'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k) })
    gl.uniform1i(U.uGround, 0); gl.uniform1i(U.uMaskA, 1); gl.uniform1i(U.uMaskB, 2); gl.uniform1i(U.uMorph, 3); gl.uniform1f(U.uR, R)
    var cols = []; for (var ci = 0; ci < MAX_AREAS; ci++) { var L = layers[ci], hx = L ? L.color : '#FFFFFF'; cols.push(parseInt(hx.slice(1, 3), 16) / 255, parseInt(hx.slice(3, 5), 16) / 255, parseInt(hx.slice(5, 7), 16) / 255) }
    gl.uniform3fv(U.uCol, new Float32Array(cols))
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE)
    return { R: R, prog: prog, U: U, count: groundIdx, groundIdx: groundIdx, groundCount: groundCount, layers: layers, heights: hf, textures: [gt, ta, tb], exaggerate: ex }
  }
  /**
   * Draws a frame. f = { cam (from camera()), era: [alpha per layer], dim, bright, halo: {x,y,r,w}|null,
   * focus: {x,y,r,a}|null, scar: {x,y,r,a}|null, heightTint, scaleZ, fog: [r,g,b], fogNear, fogFar }
   */
  function draw(gl, st, f) {
    var U = st.U
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    var fog = f.fog || [0.03, 0.03, 0.035]
    // depth writes must be on for the clear to reset depth; otherwise last frame's buildings punch
    // holes in this frame's ground
    gl.depthMask(true); gl.clearDepth(1)
    gl.clearColor(fog[0], fog[1], fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(st.prog)
    gl.uniformMatrix4fv(U.uM, false, new Float32Array(f.cam.m))
    gl.uniform1f(U.uScaleZ, f.scaleZ == null ? 1 : f.scaleZ)
    var e = f.era || []; gl.uniform4f(U.uEraA, e[0] || 0, e[1] || 0, e[2] || 0, 0); gl.uniform4f(U.uEraB, e[3] || 0, e[4] || 0, e[5] || 0, 0)
    gl.uniform1f(U.uDim, f.dim || 0); gl.uniform1f(U.uBright, f.bright == null ? 1 : f.bright)
    var h = f.halo; gl.uniform4f(U.uHalo, h ? h.x : 0, h ? h.y : 0, h ? h.r : -1, h ? h.w : 0)
    var fo = f.focus; gl.uniform4f(U.uFocus, fo ? fo.x : 0, fo ? fo.y : 0, fo ? fo.r : 0.001, fo ? fo.a : 0)
    var sc = f.scar; gl.uniform4f(U.uScar, sc ? sc.x : 0, sc ? sc.y : 0, sc ? sc.r : 0.001, sc ? sc.a : 0)
    gl.uniform1f(U.uHeightTint, f.heightTint || 0); gl.uniform1f(U.uYear, f.year == null ? 3000 : f.year); gl.uniform1f(U.uT, f.t || 0)
    gl.uniform3f(U.uFog, fog[0], fog[1], fog[2]); gl.uniform1f(U.uFogNear, f.fogNear); gl.uniform1f(U.uFogFar, f.fogFar)
    gl.uniform3f(U.uSun, -0.45, -0.6, 0.66)
    var sk = f.sink; gl.uniform4f(U.uSink, sk ? sk.x : 0, sk ? sk.y : 0, sk ? sk.r : 0.001, sk ? sk.a : 0)
    var rv = f.reveal
    if (rv && st.morphKey !== rv.key) {
      if (st.morphTex) gl.deleteTexture(st.morphTex)
      st.morphTex = tex(gl, morphField(rv.key, rv.seed, rv.target, st.R).canvas, 3); st.morphKey = rv.key
    }
    gl.uniform4f(U.uRev, rv ? rv.p : 0, rv ? rv.layer : -1, rv && rv.active ? 1 : 0, 0)
    // the ground never writes depth, so flat (not yet risen) roofs can never fight it for a pixel
    // the ground goes first and under everything: no depth test, no depth writes
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.uniform1f(U.uIsGround, 1); gl.drawElements(gl.TRIANGLES, st.groundCount, gl.UNSIGNED_INT, st.groundIdx * 4)
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.uniform1f(U.uIsGround, 0); gl.drawElements(gl.TRIANGLES, st.count, gl.UNSIGNED_INT, 0)
  }
  /**
   * When each building stands: { born, span } per building (span 0 = always there). Landmarks
   * (places with a footprint) rise on their year: chronology.places[].born, else the place's Wikidata
   * inception (`built`); with chronology.modern { from, to, outside: <area id> } every building outside
   * that historic extent rises between from and to, nearer ones first (the modern city growing out).
   */
  function life(geo, ch) {
    var n = geo.buildings.length, born = new Float32Array(n), span = new Float32Array(n)
    var hf = fillHeights(geo), cen = hf.centroids
    var md = ch.modern, ids = md ? [].concat(md.outside) : [], rings = (geo.areas || []).filter(function (a) { return ids.indexOf(a.id) >= 0 && a.ring })
    var area = rings[0]
    if (area) {
      var inRing = function (pt, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c } return c }
      var inside = function (pt) { for (var r = 0; r < rings.length; r++) if (inRing(pt, rings[r].ring)) return true; return false }
      var maxD = 0, ds = new Float32Array(n)
      for (var b = 0; b < n; b++) { if (inside(cen[b])) { ds[b] = -1; continue } ds[b] = Math.hypot(cen[b][0] - area.x, cen[b][1] - area.y); if (ds[b] > maxD) maxD = ds[b] }
      for (var q = 0; q < n; q++) if (ds[q] >= 0) { var h = (Math.abs(Math.sin(cen[q][0] * 127.1 + cen[q][1] * 311.7)) * 43758.5) % 1; born[q] = md.from + (md.to - md.from) * Math.min(1, 0.75 * ds[q] / (maxD || 1) + 0.25 * h); span[q] = md.span || 6 }
      // `core { from, to }`: the old city's buildings also rise (outwards from its centre) instead of
      // standing from the start, for cities whose first town was small and low
      if (md.core) {
        var maxC = 0, dc = new Float32Array(n)
        for (var b2 = 0; b2 < n; b2++) if (ds[b2] < 0) { dc[b2] = Math.hypot(cen[b2][0] - area.x, cen[b2][1] - area.y); if (dc[b2] > maxC) maxC = dc[b2] }
        for (var q2 = 0; q2 < n; q2++) if (ds[q2] < 0) { var h2 = (Math.abs(Math.sin(cen[q2][0] * 127.1 + cen[q2][1] * 311.7)) * 43758.5) % 1; born[q2] = md.core.from + (md.core.to - md.core.from) * Math.min(1, 0.7 * dc[q2] / (maxC || 1) + 0.3 * h2); span[q2] = md.span || 6 }
      }
    }
    // `tall { min_m, from, to }`: mapped buildings above min_m rise later, the taller the later, so a
    // skyline grows instead of standing over the first town
    if (md && md.tall) {
      var T = md.tall, hmax = 0
      for (var b3 = 0; b3 < n; b3++) if (!hf.est[b3] && hf.h[b3] > hmax) hmax = hf.h[b3]
      for (var q3 = 0; q3 < n; q3++) {
        if (hf.est[q3] || hf.h[q3] < T.min_m) continue
        var f3 = Math.pow(Math.min(1, (hf.h[q3] - T.min_m) / Math.max(1, (T.max_m || hmax) - T.min_m)), 0.6)
        born[q3] = Math.max(born[q3], T.from + (T.to - T.from) * f3); span[q3] = 6
      }
    }
    var cp = {}; (ch.places || []).forEach(function (p) { cp[p.id] = p })
    ;(geo.places || []).forEach(function (pl) {
      if (pl.footprint == null) return
      var y = cp[pl.id] && cp[pl.id].born != null ? cp[pl.id].born : pl.built
      if (y == null || (cp[pl.id] && cp[pl.id].born === false)) return
      // `span` years to rise (a church built over a century and a half rises all film long)
      born[pl.footprint] = y; span[pl.footprint] = (cp[pl.id] && cp[pl.id].span) || 12
    })
    return { born: born, span: span }
  }
  K.city3d = { morphField: morphField, life: life, camera: camera, pathView: pathView, init: init, draw: draw, earcut: earcut, bridge: bridge, fillHeights: fillHeights }
})()
