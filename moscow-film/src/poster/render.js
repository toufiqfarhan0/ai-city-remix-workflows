// Poster renderer (Canvas 2D). A frame is a pure function of the view: kind (map, skyline, food or landmark),
// theme (and a second kind, theme and shape with a wipe position while switching), format, map shape, camera
// (centre and span in metres), reveal progress per layer, the landmark shown, whether the marks are shown, and
// the localized type lines. Every kind fills the art area of the same poster frame and shares the type block
// (title, rule, subtitle, one or two detail lines) and the credits line.
import { coordText } from './world.js'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const FORMATS = { portrait: 3 / 4, square: 1, landscape: 16 / 9 }
export const SHAPES = ['full', 'circle']
export const KINDS = ['map', 'skyline', 'food', 'landmark']

/** Where the art and the type go on a W×H poster. */
export function layout(format, shape, W, H) {
  const m = Math.round(Math.min(W, H) * 0.065)
  let map, text
  if (format === 'landscape') {
    map = { x: m, y: m, w: Math.round(W * 0.64) - m, h: H - 2 * m }
    text = { align: 'left', x: Math.round(W * 0.7), y: H * 0.5, w: W * 0.26, size: H }
  } else {
    const mh = Math.round(H * (format === 'square' ? 0.72 : 0.76)) - m
    map = { x: m, y: m, w: W - 2 * m, h: mh }
    text = { align: 'center', x: W / 2, y: m + mh + (H - m - mh) * 0.46, w: W - 2 * m, size: W }
  }
  if (shape === 'circle') {
    const r = Math.min(map.w, map.h) / 2
    map.circle = { cx: map.x + map.w / 2, cy: map.y + map.h / 2, r }
  }
  return { m, map, text }
}

const hexRgb = (h) => [Number.parseInt(h.slice(1, 3), 16), Number.parseInt(h.slice(3, 5), 16), Number.parseInt(h.slice(5, 7), 16)]
/** Mixes two #rrggbb colours (k = 0 gives a). */
export function mix(a, b, k) {
  const A = hexRgb(a), B = hexRgb(b)
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`
}

export function createRenderer(world, style) {
  const themes = style.themes
  let paths = null
  const seaCanvas = new Map()
  const line = (list) => {
    const p = new Path2D()
    for (const pts of list) {
      p.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1])
    }
    return p
  }
  const area = (list) => {
    const p = new Path2D()
    for (const rings of list) for (const pts of rings) {
      p.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1])
      p.closePath()
    }
    return p
  }
  function build() {
    paths = { water: area(world.water), parks: area(world.parks), rail: line(world.rail), rivers: world.rivers.map((r) => ({ w: r.w, p: line([r.pts]) })) }
    for (const c of Object.keys(world.roads)) paths[c] = line(world.roads[c])
    paths.landmarks = world.landmarks.map((l) => {
      let len = 0
      for (const r of l.rings) for (let i = 2; i < r.length; i += 2) len += Math.hypot(r[i] - r[i - 2], r[i + 1] - r[i - 1])
      return { outline: area([l.rings]), outlineLine: line(l.rings.map((r) => Float32Array.from([...r, r[0], r[1]]))), len, parts: area(l.parts.map((r) => [r])), context: area(l.context.map((r) => [r])) }
    })
  }
  function sea(theme) {
    if (!world.sea) return null
    let c = seaCanvas.get(theme.water)
    if (!c) {
      const n = world.sea.n
      c = new OffscreenCanvas(n, n)
      const g = c.getContext('2d')
      const img = g.createImageData(n, n)
      const [R, G, B] = hexRgb(theme.water)
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        if (!world.sea.mask[r * n + k]) continue
        // Row 0 of the mask is the south edge; image rows run from the top.
        const o = ((n - 1 - r) * n + k) * 4
        img.data[o] = R
        img.data[o + 1] = G
        img.data[o + 2] = B
        img.data[o + 3] = 255
      }
      g.putImageData(img, 0, 0)
      seaCanvas.set(theme.water, c)
    }
    return c
  }

  // ── Map (and the faint base of the food poster) ──────────────────────────────────────────────
  function drawMap(ctx, view, theme, map, u, rev, faint = false) {
    const cam = view.camera
    const s = Math.max(map.w, map.h) / cam.span
    const ox = map.x + map.w / 2, oy = map.y + map.h / 2
    ctx.save()
    ctx.transform(s, 0, 0, -s, ox - cam.cx * s, oy + cam.cy * s)
    // Lines thicken a little as you zoom in (square root of the zoom), relative to the poster size.
    const zf = clamp(Math.sqrt((view.baseSpan ?? cam.span) / cam.span), 0.7, 2.4)
    const widthPx = (k) => (k * u * zf) / s
    const reach = Math.hypot(world.radius, world.radius) * 1.02
    const reveal = (k, fn) => {
      const p = rev(k)
      if (p <= 0) return
      if (p >= 1) return fn()
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, reach * p, 0, Math.PI * 2)
      ctx.clip()
      fn()
      ctx.restore()
    }
    if (faint) ctx.globalAlpha = 0.5
    reveal('water', () => {
      const sc = sea(theme)
      if (sc) {
        ctx.save()
        ctx.imageSmoothingEnabled = true
        // drawImage maps image rows downward, so flip back for the y-up world transform.
        ctx.translate(-world.radius, world.radius)
        ctx.scale(1, -1)
        ctx.drawImage(sc, 0, 0, 2 * world.radius, 2 * world.radius)
        ctx.restore()
      }
      ctx.fillStyle = theme.water
      ctx.fill(paths.water, 'evenodd')
      ctx.strokeStyle = theme.water
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const r of paths.rivers) {
        ctx.lineWidth = Math.max(r.w, (1.2 * u) / s)
        ctx.stroke(r.p)
      }
    })
    if (!faint) reveal('parks', () => {
      ctx.fillStyle = theme.park
      ctx.fill(paths.parks, 'evenodd')
    })
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (!faint) reveal('rail', () => {
      ctx.strokeStyle = theme.rail
      ctx.lineWidth = widthPx(0.7)
      ctx.setLineDash([widthPx(3), widthPx(2)])
      ctx.stroke(paths.rail)
      ctx.setLineDash([])
    })
    const W_ROAD = { path: 0.35, minor: 0.6, mid: 1.15, major: 2 }
    for (const c of ['path', 'minor', 'mid', 'major']) {
      if (!paths[c]) continue
      reveal(faint ? 'base' : c, () => {
        ctx.strokeStyle = faint ? theme.roads.path ?? theme.roads.minor : theme.roads[c] ?? theme.roads.minor
        ctx.lineWidth = widthPx(W_ROAD[c] * (theme.weight ?? 1) * (faint ? 0.8 : 1))
        ctx.stroke(paths[c])
      })
    }
    ctx.restore()
    return { s, ox, oy, zf }
  }

  // ── Skyline ───────────────────────────────────────────────────────────────────────────────────
  function drawSkyline(ctx, view, theme, map, u, rev) {
    const S = world.skyline
    const span = -2 * S.x0
    const left = map.x + map.w * 0.04, right = map.x + map.w * 0.96
    const xs = (right - left) / span
    const base = map.y + map.h * (map.circle ? 0.74 : 0.82)
    const ys = (map.h * 0.56) / S.top
    const X = (x) => left + (x - S.x0) * xs
    const p = rev('skyline')
    // Far bands first, fading toward the sky; each band rises a little after the one behind it.
    const ink = theme.roads.major
    const colour = (b) => mix(ink, theme.land, [0, 0.38, 0.6, 0.76][b])
    for (let b = 3; b >= 0; b--) {
      const k = clamp(p * 1.7 - (3 - b) * 0.23)
      if (k <= 0) continue
      const prof = S.bands[b]
      ctx.fillStyle = colour(b)
      ctx.beginPath()
      ctx.moveTo(X(S.x0), base)
      for (let i = 0; i < prof.length; i++) {
        const x0 = X(S.x0 + i * S.step), x1 = X(S.x0 + (i + 1) * S.step)
        const y = base - prof[i] * ys * k
        ctx.lineTo(x0, y)
        ctx.lineTo(x1, y)
      }
      ctx.lineTo(X(S.x0 + prof.length * S.step), base)
      ctx.closePath()
      ctx.fill()
      for (const [c0, c1, wall, top, kind, band] of S.caps) {
        if (band !== b) continue
        const a = X(c0), z = X(c1), w = z - a, mid = (a + z) / 2
        const yb = base - wall * ys * k, yt = base - top * ys * k
        ctx.beginPath()
        if (kind === 'dome') {
          ctx.moveTo(a, yb)
          ctx.bezierCurveTo(a, yb - (yb - yt) * 1.33, z, yb - (yb - yt) * 1.33, z, yb)
        } else if (kind === 'spire') {
          ctx.moveTo(a, yb)
          ctx.lineTo(mid, yt)
          ctx.lineTo(z, yb)
        } else {
          // A lattice tower: wide feet, concave sides, a narrow top and a mast.
          const hw = Math.max(w / 2, 1.5 * u), tw = Math.max(hw * 0.07, 0.8 * u)
          ctx.moveTo(mid - hw, yb)
          ctx.quadraticCurveTo(mid - hw * 0.18, yb - (yb - yt) * 0.38, mid - tw, yt + (yb - yt) * 0.06)
          ctx.lineTo(mid - tw * 0.4, yt)
          ctx.lineTo(mid + tw * 0.4, yt)
          ctx.lineTo(mid + tw, yt + (yb - yt) * 0.06)
          ctx.quadraticCurveTo(mid + hw * 0.18, yb - (yb - yt) * 0.38, mid + hw, yb)
        }
        ctx.closePath()
        ctx.fill()
      }
    }
    // Ground below the skyline, the ground line and the labels.
    ctx.fillStyle = mix(theme.land, ink, 0.07)
    ctx.fillRect(map.x, base, map.w, map.y + map.h - base)
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = Math.max(1, 1.6 * u)
    ctx.beginPath()
    ctx.moveTo(map.x, base + 0.5)
    ctx.lineTo(map.x + map.w, base + 0.5)
    ctx.stroke()
    const la = clamp((p - 0.75) / 0.25)
    if (la > 0 && view.marks) {
      ctx.save()
      ctx.globalAlpha = la
      ctx.font = `600 ${Math.round(14 * u)}px ${theme.font}`
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'center'
      const sorted = [...S.labels].sort((a, b) => a.x - b.x)
      sorted.forEach((l, i) => {
        const x = X(l.x), yTop = base - l.h * ys
        // Two staggered rows just above the tallest top.
        const row = Math.max(map.y + 24 * u, base - S.top * ys - 30 * u - (i % 2) * 26 * u)
        const label = `${l.name.toUpperCase()} · ${l.h} M`
        const half = ctx.measureText(label).width / 2
        // The usable width at this row: the whole art area, or the circle's chord.
        let lo = map.x, hi = map.x + map.w
        if (map.circle) {
          const dy = row - 5 * u - map.circle.cy
          const c = Math.sqrt(Math.max(0, map.circle.r ** 2 - dy * dy))
          lo = map.circle.cx - c
          hi = map.circle.cx + c
        }
        if (hi - lo < 2 * half + 12 * u || x < lo || x > hi) return
        const cx = clamp(x, lo + half + 6 * u, hi - half - 6 * u)
        ctx.strokeStyle = theme.text
        ctx.globalAlpha = la * 0.5
        ctx.lineWidth = Math.max(1, u)
        ctx.beginPath()
        ctx.moveTo(x, row + 6 * u)
        ctx.lineTo(x, Math.max(row + 6 * u, yTop - 4 * u))
        ctx.stroke()
        ctx.globalAlpha = la
        ctx.fillStyle = theme.text
        ctx.fillText(label, cx, row)
      })
      ctx.restore()
    }
    return { exaggeration: ys / xs }
  }

  // ── Food ──────────────────────────────────────────────────────────────────────────────────────
  function drawFood(ctx, view, theme, map, u, rev) {
    const t = drawMap(ctx, view, theme, map, u, (k) => (k === 'base' || k === 'water' ? 1 : 0), true)
    const F = world.food
    const cam = view.camera
    const p = rev('food')
    const reach = Math.hypot(world.radius, world.radius) * 1.02 * p
    const size = Math.max(1.6, 3.4 * u * Math.min(1.8, t.zf))
    const colours = theme.food ?? [theme.accent]
    for (let g = 0; g < F.groups.length; g++) {
      ctx.fillStyle = colours[g % colours.length]
      ctx.beginPath()
      for (let i = 0; i < F.pts.length; i += 3) {
        if (F.pts[i + 2] !== g) continue
        const x = F.pts[i], y = F.pts[i + 1]
        if (p < 1 && Math.hypot(x, y) > reach) continue
        const sx = t.ox + (x - cam.cx) * t.s, sy = t.oy - (y - cam.cy) * t.s
        if (sx < map.x - 4 || sy < map.y - 4 || sx > map.x + map.w + 4 || sy > map.y + map.h + 4) continue
        ctx.moveTo(sx + size / 2, sy)
        ctx.arc(sx, sy, size / 2, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }

  // ── Landmark ──────────────────────────────────────────────────────────────────────────────────
  function drawLandmark(ctx, view, theme, map, u, rev) {
    const i = clamp(Math.round(view.landmark ?? 0), 0, world.landmarks.length - 1)
    const l = world.landmarks[i]
    const P = paths.landmarks[i]
    const fit = (map.circle ? map.circle.r * 1.25 : Math.min(map.w, map.h) * 0.62) / 2
    const s = fit / Math.max(10, l.extent)
    const ox = map.x + map.w / 2, oy = map.y + map.h / 2
    const p = rev('landmark')
    ctx.save()
    ctx.transform(s, 0, 0, -s, ox, oy)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // Neighbours first, then the outline drawing itself, then its fill and parts.
    ctx.globalAlpha = clamp(p * 2)
    ctx.fillStyle = mix(theme.land, theme.roads.path ?? theme.roads.minor, 0.35)
    ctx.fill(P.context, 'evenodd')
    ctx.strokeStyle = theme.roads.path ?? theme.roads.minor
    ctx.lineWidth = (0.7 * u) / s
    ctx.stroke(P.context)
    ctx.globalAlpha = clamp((p - 0.55) / 0.45)
    ctx.fillStyle = mix(theme.land, theme.roads.major, 0.16)
    ctx.fill(P.outline, 'evenodd')
    ctx.strokeStyle = theme.roads.mid
    ctx.lineWidth = (0.9 * u) / s
    ctx.stroke(P.parts)
    ctx.globalAlpha = 1
    ctx.strokeStyle = theme.roads.major
    ctx.lineWidth = (2.4 * u) / s
    if (p < 1) ctx.setLineDash([P.len * clamp(p / 0.8), P.len])
    ctx.stroke(P.outlineLine)
    ctx.setLineDash([])
    ctx.restore()
    // North arrow and a scale bar of a round length.
    ctx.save()
    ctx.globalAlpha = clamp((p - 0.6) / 0.4)
    ctx.fillStyle = theme.text
    ctx.strokeStyle = theme.text
    ctx.lineWidth = Math.max(1, 1.4 * u)
    const pad = map.circle ? map.w * 0.08 : 22 * u
    const nx = map.x + map.w - pad - 10 * u, ny = map.y + pad + 14 * u
    ctx.beginPath()
    ctx.moveTo(nx, ny - 14 * u)
    ctx.lineTo(nx - 6 * u, ny + 4 * u)
    ctx.lineTo(nx, ny)
    ctx.lineTo(nx + 6 * u, ny + 4 * u)
    ctx.closePath()
    ctx.fill()
    ctx.font = `600 ${Math.round(11 * u)}px ${theme.font}`
    ctx.textAlign = 'center'
    ctx.fillText('N', nx, ny + 18 * u)
    const metres = [10, 20, 25, 50, 100, 200, 250, 500].find((m) => m * s > map.w * 0.12) ?? 500
    const bx = map.x + pad, by = map.y + map.h - pad
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + metres * s, by)
    ctx.moveTo(bx, by - 4 * u)
    ctx.lineTo(bx, by + 4 * u)
    ctx.moveTo(bx + metres * s, by - 4 * u)
    ctx.lineTo(bx + metres * s, by + 4 * u)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillText(`${metres} m`, bx, by - 8 * u)
    ctx.restore()
  }

  // ── One theme of the poster ───────────────────────────────────────────────────────────────────
  function drawTheme(ctx, W, H, view, theme) {
    const L = layout(view.format, view.shape, W, H)
    const u = Math.min(W, H) / 1000
    const rv = view.reveal ?? {}
    const rev = (k) => (rv[k] === undefined ? 1 : clamp(rv[k]))
    const kind = KINDS.includes(view.kind) && world.kinds.includes(view.kind) ? view.kind : 'map'
    ctx.save()
    ctx.fillStyle = theme.paper
    ctx.fillRect(0, 0, W, H)
    const { map } = L
    ctx.save()
    ctx.beginPath()
    if (map.circle) ctx.arc(map.circle.cx, map.circle.cy, map.circle.r, 0, Math.PI * 2)
    else ctx.rect(map.x, map.y, map.w, map.h)
    ctx.clip()
    ctx.fillStyle = theme.land
    ctx.fillRect(map.x, map.y, map.w, map.h)
    let mapT = null
    if (kind === 'map') mapT = drawMap(ctx, view, theme, map, u, rev)
    else if (kind === 'skyline') drawSkyline(ctx, view, theme, map, u, rev)
    else if (kind === 'food') drawFood(ctx, view, theme, map, u, rev)
    else drawLandmark(ctx, view, theme, map, u, rev)
    ctx.restore()
    // Marks (map only, screen space, above the map).
    const mk = rev('marks')
    if (mapT && view.marks && mk > 0) {
      const cam = view.camera
      ctx.save()
      ctx.globalAlpha = mk
      ctx.font = `600 ${Math.round(13 * u)}px ${theme.font}`
      ctx.textBaseline = 'middle'
      for (const m of world.marks) {
        const x = mapT.ox + (m.x - cam.cx) * mapT.s, y = mapT.oy - (m.y - cam.cy) * mapT.s
        const inside = map.circle ? Math.hypot(x - map.circle.cx, y - map.circle.cy) < map.circle.r - 4 * u : x > map.x && x < map.x + map.w && y > map.y && y < map.y + map.h
        if (!inside) continue
        ctx.fillStyle = theme.accent
        ctx.beginPath()
        ctx.arc(x, y, 4.2 * u, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 1.6 * u
        ctx.strokeStyle = theme.paper
        ctx.stroke()
        const label = m.label.toUpperCase()
        const tw = ctx.measureText(label).width
        const right = x + 10 * u + tw < (map.circle ? map.circle.cx + map.circle.r : map.x + map.w) - 4 * u
        const tx = right ? x + 9 * u : x - 9 * u - tw
        ctx.fillStyle = theme.paper
        ctx.globalAlpha = mk * 0.82
        ctx.fillRect(tx - 4 * u, y - 9 * u, tw + 8 * u, 18 * u)
        ctx.globalAlpha = mk
        ctx.fillStyle = theme.text
        ctx.fillText(label, tx, y + 0.5 * u)
      }
      ctx.restore()
    }
    if (!map.circle) {
      ctx.strokeStyle = theme.frame ?? theme.text
      ctx.globalAlpha = 0.5
      ctx.lineWidth = Math.max(1, 1.2 * u)
      ctx.strokeRect(map.x + 0.5, map.y + 0.5, map.w - 1, map.h - 1)
      ctx.globalAlpha = 1
    }
    drawType(ctx, view, theme, L, kind, rev('text'))
    // Credits: always visible (ODbL attribution).
    let cs = Math.max(7, 11 * u)
    ctx.font = `400 ${cs}px ${theme.font}`
    while (ctx.measureText(world.poster.credits).width > W - 2 * L.m && cs > 5) {
      cs *= 0.9
      ctx.font = `400 ${cs}px ${theme.font}`
    }
    ctx.fillStyle = theme.text
    ctx.globalAlpha = 0.6
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(world.poster.credits, W - L.m, H - L.m * 0.42)
    ctx.restore()
    return L
  }

  /** Title, rule, subtitle and detail lines. view.text[kind] = { title, subtitle, line, legend } overrides. */
  function drawType(ctx, view, theme, L, kind, ta) {
    if (ta <= 0) return
    const T = L.text
    const k = T.size / 1000
    const txt = (kind === 'landmark' ? view.text?.landmark?.[clamp(Math.round(view.landmark ?? 0), 0, world.landmarks.length - 1)] : view.text?.[kind]) ?? {}
    ctx.save()
    ctx.globalAlpha = ta
    ctx.fillStyle = theme.text
    ctx.textAlign = T.align
    ctx.textBaseline = 'alphabetic'
    const title = String(txt.title ?? world.poster.title).toUpperCase()
    let size = (view.format === 'landscape' ? 64 : 92) * k * (title.length > 12 ? 0.82 : 1)
    const setTitle = () => {
      ctx.font = `${theme.titleWeight ?? 700} ${size}px ${theme.font}`
      ctx.letterSpacing = `${Math.round(size * (title.length > 12 ? 0.16 : 0.32))}px`
    }
    setTitle()
    // Shrink long names to fit the column.
    while (ctx.measureText(title).width > T.w && size > 12) {
      size *= 0.92
      setTitle()
    }
    // letterSpacing adds a trailing gap after the last glyph; shift centred text back by half of it.
    const shift = T.align === 'center' ? Math.round(size * (title.length > 12 ? 0.08 : 0.16)) : 0
    const top = T.y - (view.format === 'landscape' ? 40 * k : 22 * k)
    ctx.fillText(title, T.x + shift, top)
    ctx.letterSpacing = '0px'
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = Math.max(1, 2 * k)
    const rw = 120 * k
    const rx = T.align === 'center' ? T.x - rw / 2 : T.x
    ctx.beginPath()
    ctx.moveTo(rx, top + 26 * k)
    ctx.lineTo(rx + rw, top + 26 * k)
    ctx.stroke()
    const sub = txt.subtitle ?? world.poster.subtitle
    let subSize = 28 * k
    ctx.font = `400 ${subSize}px ${theme.font}`
    ctx.letterSpacing = `${Math.round(7 * k)}px`
    while (sub && ctx.measureText(sub.toUpperCase()).width > T.w && subSize > 8) {
      subSize *= 0.92
      ctx.font = `400 ${subSize}px ${theme.font}`
    }
    if (sub) ctx.fillText(sub.toUpperCase(), T.x + (T.align === 'center' ? Math.round(3.5 * k) : 0), top + 70 * k)
    const detail = txt.line ?? coordText(world.poster.center)
    let dSize = 19 * k
    ctx.font = `400 ${dSize}px ${theme.mono ?? theme.font}`
    ctx.letterSpacing = `${Math.round(2 * k)}px`
    while (ctx.measureText(detail).width > T.w && dSize > 7) {
      dSize *= 0.92
      ctx.font = `400 ${dSize}px ${theme.mono ?? theme.font}`
    }
    ctx.globalAlpha = ta * 0.75
    ctx.fillText(detail, T.x + (T.align === 'center' ? Math.round(1 * k) : 0), top + 108 * k)
    ctx.letterSpacing = '0px'
    // Food legend: a dot per group with its label and count, centred on one row (or stacked in 16:9).
    if (txt.legend?.length) {
      ctx.globalAlpha = ta
      const ls = 19 * k
      ctx.font = `500 ${ls}px ${theme.font}`
      ctx.textAlign = 'left'
      const items = txt.legend.map((g) => ({ ...g, w: ctx.measureText(g.label).width + ls * 1.3 }))
      const gap = ls * 1.2
      const rows = view.format === 'landscape' ? items.map((g) => [g]) : [items.slice(0, 3), items.slice(3)].filter((r) => r.length)
      let y = top + 150 * k
      for (const row of rows) {
        let total = row.reduce((a, g) => a + g.w, 0) + gap * (row.length - 1)
        let scale = total > T.w ? T.w / total : 1
        let x = T.align === 'center' ? T.x - (total * scale) / 2 : T.x
        ctx.font = `500 ${ls * scale}px ${theme.font}`
        for (const g of row) {
          ctx.fillStyle = theme.food?.[g.group] ?? theme.accent
          ctx.beginPath()
          ctx.arc(x + ls * 0.4 * scale, y - ls * 0.32 * scale, ls * 0.34 * scale, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = theme.text
          ctx.fillText(g.label, x + ls * 1.05 * scale, y)
          x += (g.w + gap) * scale
        }
        y += ls * 1.6
      }
    }
    ctx.restore()
  }

  /** Draws the poster: one view, or two with a slanted wipe between them (view.next…, view.wipe 0..1). */
  function draw(ctx, W, H, view) {
    if (!paths) build()
    const A = themes[view.theme] ?? themes[0]
    const out = drawTheme(ctx, W, H, view, A)
    const p = clamp(view.wipe ?? 0)
    if (view.next !== undefined && view.next !== null && p > 0) {
      const B = themes[view.next] ?? themes[0]
      ctx.save()
      ctx.beginPath()
      const slant = H * 0.18
      const x = -slant + (W + 2 * slant) * p
      ctx.moveTo(0, 0)
      ctx.lineTo(x + slant, 0)
      ctx.lineTo(x - slant, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.clip()
      drawTheme(ctx, W, H, { ...view, shape: view.nextShape ?? view.shape, kind: view.nextKind ?? view.kind, landmark: view.nextLandmark ?? view.landmark, reveal: view.nextReveal ?? view.reveal }, B)
      ctx.restore()
      ctx.save()
      ctx.strokeStyle = B.accent
      ctx.lineWidth = Math.max(2, Math.min(W, H) / 300)
      ctx.beginPath()
      ctx.moveTo(x + slant, 0)
      ctx.lineTo(x - slant, H)
      ctx.stroke()
      ctx.restore()
    }
    return out
  }
  return { draw, layout }
}
