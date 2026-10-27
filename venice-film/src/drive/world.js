// The world of one drive, built once from route.json (baked from OpenStreetMap) and style.json (the city's
// look). Positions along the road are s (metres from the start) and d (metres from the road centre, + right).
// Nothing here draws; render.js asks for what is in view.

export const KINDS = ['house', 'terrace', 'apartments', 'office', 'shop', 'civic', 'church', 'industrial', 'warehouse', 'tower']
export const ROAD_HALF = 7.2 // two lanes each way
export const WALK = 4.2 // sidewalk width
const BUCKET = 50

/** Deterministic 32-bit hash of two integers → [0, 1). */
export function hash01(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function createWorld(route, style) {
  if (route?.schema !== 'pixel-route/1' || !Array.isArray(route.path) || route.path.length < 4) throw Object.assign(new Error('route'), { code: 'data' })
  const step = route.step
  // Mapped centre lines zig-zag by a metre or two; a ±15 m moving average keeps lane lines straight.
  const pts = route.path.map((_, i, a) => {
    let x = 0, y = 0, n = 0
    for (let j = Math.max(0, i - 3); j <= Math.min(a.length - 1, i + 3); j++) {
      x += a[j][0]
      y += a[j][1]
      n++
    }
    return [x / n, y / n]
  })
  const length = (pts.length - 1) * step
  const n = pts.length

  // Smoothed unit headings: the tangent over ±20 m, so a mapped zig-zag at a junction does not jerk the view.
  const head = new Float64Array(n * 2)
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 4)], b = pts[Math.min(n - 1, i + 4)]
    const hx = b[0] - a[0], hy = b[1] - a[1], l = Math.hypot(hx, hy) || 1
    head[i * 2] = hx / l
    head[i * 2 + 1] = hy / l
  }
  /** Position, forward and right unit vectors at s (linear between samples). */
  function frame(s) {
    const f = clamp(s / step, 0, n - 1.0001)
    const i = Math.floor(f), k = f - i
    const a = pts[i], b = pts[i + 1]
    let fx = head[i * 2] * (1 - k) + head[i * 2 + 2] * k
    let fy = head[i * 2 + 1] * (1 - k) + head[i * 2 + 3] * k
    const l = Math.hypot(fx, fy) || 1
    fx /= l
    fy /= l
    const ex = s < 0 ? s : s > length ? s - length : 0 // beyond the ends the road carries straight on
    return { x: a[0] + (b[0] - a[0]) * k + fx * ex, y: a[1] + (b[1] - a[1]) * k + fy * ex, fx, fy, rx: fy, ry: -fx }
  }
  const at = (s, d) => {
    const f = frame(s)
    return [f.x + f.rx * d, f.y + f.ry * d]
  }

  // Land per side every 10 m: w water, p park, f/q open water further out, - built land.
  const landAt = (side, s) => {
    const str = side < 0 ? route.land.left : route.land.right
    return str[clamp(Math.round(s / 10), 0, str.length - 1)] ?? '-'
  }

  const palette = style.facades
  const buckets = new Map()
  const put = (s, item) => {
    const k = Math.floor(s / BUCKET)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(item)
  }

  // Buildings: a front wall along the road in pieces of up to 10 m (it bends with the road) and two end walls.
  const buildings = route.fronts.map((f, id) => {
    const [s0, s1, side, d, depth, h, kindIndex, colour, name] = f
    const kind = KINDS[kindIndex] ?? 'terrace'
    const r = hash01(id, 7)
    const tone = colour && /^#?[0-9a-f]{6}$/i.test(colour) ? Number.parseInt(colour.replace('#', ''), 16) : palette[kind]?.[Math.floor(r * (palette[kind]?.length ?? 1))] ?? palette.terrace[0]
    const b = { id, s0, s1, side, d, depth, h: Math.max(5, h), kind, tone, name, seed: Math.floor(hash01(id, 3) * 1e6), pattern: style.patterns?.[kind] && hash01(id, 11) < style.patterns[kind].share ? style.patterns[kind].name : null }
    const len = s1 - s0
    const pieces = Math.max(1, Math.ceil(len / 10))
    for (let p = 0; p < pieces; p++) {
      const a = s0 + (len * p) / pieces, c = s0 + (len * (p + 1)) / pieces
      put((a + c) / 2, { type: 'wall', b, sa: a, sb: c, da: side * d, db: side * d, u0: a - s0, len: c - a, face: 'front' })
    }
    // End walls run from the front back into the block; u continues the facade rhythm.
    put(s0, { type: 'wall', b, sa: s0, sb: s0, da: side * (d + depth), db: side * d, u0: 0, len: depth, face: 'end' })
    put(s1, { type: 'wall', b, sa: s1, sb: s1, da: side * d, db: side * (d + depth), u0: 0, len: depth, face: 'end' })
    return b
  })

  // Street trees and lamps where there is room: no front wall within 9 m of the kerb, not over water.
  const kerb = ROAD_HALF + WALK
  const frontAt = new Map()
  for (const b of buildings) for (let s = Math.floor(b.s0 / 5); s <= Math.floor(b.s1 / 5); s++) {
    const k = `${b.side}:${s}`
    frontAt.set(k, Math.min(frontAt.get(k) ?? Infinity, b.d))
  }
  const near = (side, s) => frontAt.get(`${side}:${Math.floor(s / 5)}`) ?? Infinity
  for (const side of [-1, 1]) {
    for (let s = 6; s < length; s += 16) {
      const land = landAt(side, s)
      if (land === 'w') continue
      const room = near(side, s) - kerb
      if (room > 5 || land === 'p') {
        const jitter = hash01(Math.round(s), side + 5)
        put(s, { type: 'tree', s: s + jitter * 4, d: side * (kerb - 1.2 + (room > 9 ? jitter * 3 : 0)), h: 6 + jitter * 3, w: 4.5 + jitter * 2, seed: Math.round(s * 7 + side) })
      }
      if (land === 'p' && room > 14) {
        const j = hash01(Math.round(s), side + 9)
        put(s + 8, { type: 'tree', s: s + 8, d: side * (kerb + 6 + j * 8), h: 7 + j * 4, w: 5 + j * 3, seed: Math.round(s * 13 + side) })
      }
    }
    for (let s = 20; s < length; s += 34) put(s, { type: 'lamp', s, d: side * (ROAD_HALF + 0.6), seed: Math.round(s) })
  }

  // Signs: a street-name sign after every change of street, a brown sign before each landmark.
  const signs = []
  route.streets.forEach(([s, name], i) => {
    if (i === 0 && route.streets.length > 1 && route.streets[1][0] < 120) return
    signs.push({ type: 'sign', s: Math.max(30, s + 25), d: (route.drive === 'left' ? -1 : 1) * (ROAD_HALF + 1.4), text: name, colour: 'street' })
  })
  for (const l of route.landmarks) signs.push({ type: 'sign', s: Math.max(40, l.s - 230), d: (route.drive === 'left' ? -1 : 1) * (ROAD_HALF + 2.6), text: `${l.d < 0 ? '<' : ''}${l.name}${l.d < 0 ? '' : '>'}`, colour: 'landmark' })
  signs.sort((a, b) => a.s - b.s)
  for (let i = 1; i < signs.length; i++) if (signs[i].s - signs[i - 1].s < 45) signs[i].s = signs[i - 1].s + 45
  for (const g of signs) put(g.s, g)

  const LM_SCALE = style.landmarkScale ?? 1.6 // landmarks stand back from the road; drawn larger so they read
  const landmarks = route.landmarks.map((l, i) => ({ type: 'landmark', ...l, h: l.h * LM_SCALE, id: i, w: LM_SCALE * ({ tower: 20, lighthouse: 9, fort: 56, church: 64, monument: 22, museum: 110, palace: 84 }[l.kind] ?? 30) }))
  const bridges = route.bridges.map((b, i) => ({ type: 'bridge', ...b, id: i, water: [-1, 1].find((sd) => /[wfq]/.test(landAt(sd, b.s))) ?? 0 }))

  /** Everything within [s0, s1], plus landmarks and bridges up to `far` ahead. */
  function query(s0, s1) {
    const out = []
    for (let k = Math.floor(s0 / BUCKET); k <= Math.floor(s1 / BUCKET); k++) for (const it of buckets.get(k) ?? []) out.push(it)
    return out
  }
  const streetAt = (s) => route.streets.filter(([at]) => at <= s + 1).at(-1)?.[1] ?? route.streets[0]?.[1] ?? ''
  const districtAt = (s) => (route.districts ?? []).filter(([at]) => at <= s + 1).at(-1)?.[1] ?? ''

  /**
   * How far the view turns toward a landmark at s (radians, + right): a pure function of the position, so
   * the film and free driving both glance at each landmark while passing it, then look back down the road.
   */
  function lookAt(s, lane = 0) {
    let best = 0, weight = 0
    for (const l of landmarks) {
      const ds = l.s - s
      if (ds < -60 || ds > 460) continue
      const w = ds > 300 ? 1 - (ds - 300) / 160 : ds < 0 ? 1 + ds / 60 : 1
      const k = w * w * (3 - 2 * w)
      if (k <= weight) continue
      const angle = Math.atan2(l.d - lane, Math.max(ds + 40, 40))
      best = clamp(angle * 0.8, -0.62, 0.62) * k
      weight = k
    }
    return best
  }

  return { lookAt, route, style, length, step, frame, at, landAt, query, landmarks, bridges, buildings, signs, streetAt, districtAt }
}
