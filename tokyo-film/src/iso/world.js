// The baked area as the renderer needs it: the decoded ground grid, building prisms with outward wall
// normals, car lanes along the major roads, trees in green cells and the landmarks. Built once.

export const GROUND = { land: 0, water: 1, green: 2, major: 3, minor: 4, path: 5, rail: 6, plaza: 7 }
export const KINDS = ['house', 'terrace', 'apartments', 'office', 'shop', 'civic', 'church', 'industrial', 'warehouse', 'tower']

/** Deterministic hash of two integers → [0, 1). */
export function hash01(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function decode(b64, size) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const grid = new Uint8Array(size)
  let p = 0
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const n = bin.charCodeAt(i), c = bin.charCodeAt(i + 1)
    grid.fill(c, p, p + n)
    p += n
  }
  return grid
}

const hex = (s) => (typeof s === 'number' ? s : Number.parseInt(String(s).replace('#', ''), 16))
const NAMED = { white: 0xf2f0ea, grey: 0xa9a9a6, gray: 0xa9a9a6, black: 0x4d535c, red: 0xb5513f, brown: 0x8a5a3c, beige: 0xe5d6b5, yellow: 0xe9cf7a, blue: 0x6f8fb5, green: 0x6f9a72, silver: 0xc2c6ca }
function colourOf(s) {
  if (!s) return null
  if (/^#?[0-9a-f]{6}$/i.test(s)) return hex(s)
  return NAMED[String(s).toLowerCase()] ?? null
}

export function createWorld(area, style) {
  if (area?.schema !== 'pixel-area/1' || !area.grid?.rle || !Array.isArray(area.buildings)) throw Object.assign(new Error('area'), { code: 'data' })
  const { w: GW, h: GH } = area.grid
  const cell = area.cell
  const grid = decode(area.grid.rle, GW * GH)
  const [width, height] = area.size
  const groundAt = (x, y) => {
    const c = Math.floor(x / cell), r = Math.floor(y / cell)
    if (c < 0 || r < 0 || c >= GW || r >= GH) return -1
    return grid[r * GW + c]
  }

  const buildings = area.buildings.map(([flat, h, minH, kindIndex, colour, roof, name], id) => {
    const ring = []
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]])
    let a2 = 0, cx = 0, cy = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a2 += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    for (const [x, y] of ring) {
      cx += x
      cy += y
    }
    const kind = KINDS[kindIndex] ?? 'terrace'
    const pal = style.facades[kind] ?? style.facades.terrace
    const tone = colourOf(colour) ?? hex(pal[Math.floor(hash01(id, 3) * pal.length)])
    const roofTone = colourOf(roof) ?? hex(style.roofs[kind] ?? style.roofs.default)
    // Outward normal of each edge (ring orientation from the signed area).
    const ccw = a2 > 0
    const edges = ring.map((p, i) => {
      const q = ring[(i + 1) % ring.length]
      const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1
      return { a: p, b: q, len, nx: (ccw ? dy : -dy) / len, ny: (ccw ? -dx : dx) / len }
    })
    cx /= ring.length
    cy /= ring.length
    let radius = 0
    for (const [x, y] of ring) radius = Math.max(radius, Math.hypot(x - cx, y - cy))
    return { id, ring, edges, h, minH, kind, tone, roofTone, name, cx, cy, radius, seed: Math.floor(hash01(id, 7) * 1e6) }
  })

  // Car lanes: every major road, both directions unless one-way.
  const lanes = []
  for (const r of area.roads) {
    if (r.c !== 'major' || r.pts.length < 2) continue
    let len = 0
    const cum = [0]
    for (let i = 1; i < r.pts.length; i++) {
      len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])
      cum.push(len)
    }
    if (len < 40) continue
    for (const dir of r.oneway ? [1] : [1, -1]) lanes.push({ pts: r.pts, cum, len, dir, offset: dir * Math.min(3, r.w / 4), cars: Math.max(1, Math.round(len / 45)), seed: lanes.length })
  }
  const pointOn = (lane, s) => {
    const d = lane.dir > 0 ? s : lane.len - s
    let i = 1
    while (i < lane.cum.length - 1 && lane.cum[i] < d) i++
    const a = lane.pts[i - 1], b = lane.pts[i]
    const seg = lane.cum[i] - lane.cum[i - 1] || 1
    const k = (d - lane.cum[i - 1]) / seg
    const ux = (b[0] - a[0]) / seg, uy = (b[1] - a[1]) / seg
    // Keep to the side of the road the city drives on (style.driveSide, right by default).
    const side = style.driveSide === 'left' ? -1 : 1
    const rx = uy * lane.dir * side, ry = -ux * lane.dir * side
    return [a[0] + (b[0] - a[0]) * k + rx * Math.abs(lane.offset), a[1] + (b[1] - a[1]) * k + ry * Math.abs(lane.offset)]
  }

  // Trees: a few per green cell block, deterministic; never on buildings' cells (buildings are drawn on top).
  const trees = []
  const step = Math.max(1, Math.round(7 / cell))
  for (let r = 0; r < GH; r += step) for (let c = 0; c < GW; c += step) {
    if (grid[r * GW + c] !== GROUND.green) continue
    const h = hash01(c, r)
    if (h > 0.62) continue
    trees.push({ x: (c + 0.5 + hash01(c, r + 9) * step * 0.6) * cell, y: (r + 0.5 + hash01(c + 3, r) * step * 0.6) * cell, s: 0.8 + h, seed: c * 7919 + r })
  }

  // Landmarks: height from the tallest building whose footprint holds the point (when the tag had none).
  const inside = (x, y, ring) => {
    let hit = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) hit = !hit
    }
    return hit
  }
  const landmarks = area.landmarks.map((l, i) => {
    let h = l.h
    for (const b of buildings) if (b.h > h && Math.abs(b.cx - l.x) < 120 && Math.abs(b.cy - l.y) < 120 && inside(l.x, l.y, b.ring)) h = b.h
    return { ...l, id: i, h: Math.max(h, 4), note: style.notes?.[l.name] ?? null }
  })

  return { area, style, width, height, cell, grid, GW, GH, groundAt, buildings, lanes, pointOn, trees, landmarks }
}
