// Small planar geometry helpers in local metres (x east, y north) around a centre point.

/** Returns (lat, lon) → [x, y] metres from the centre (equirectangular; fine for a few km). */
export function projector([lat0, lon0]) {
  const R = 6378137, k = Math.cos((lat0 * Math.PI) / 180)
  return (lat, lon) => [((lon - lon0) * Math.PI / 180) * R * k, ((lat - lat0) * Math.PI / 180) * R]
}

/** Signed area of a ring (positive counter-clockwise). */
export function signedArea(ring) {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  return -s / 2
}
export const area = (ring) => Math.abs(signedArea(ring))

export function centroid(ring) {
  let x = 0, y = 0
  const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0)
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1] }
  return [x / n, y / n]
}

/** Point in polygon (even-odd). */
export function inside([x, y], ring) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Douglas-Peucker on a closed ring; keeps it closed and at least 4 points. */
export function simplify(ring, tol) {
  if (ring.length <= 5) return ring
  const pts = ring.slice(0, -1), keep = new Uint8Array(pts.length)
  keep[0] = 1; keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let best = -1, bi = -1
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > best) { best = d; bi = i } }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]) }
  }
  const out = pts.filter((_, i) => keep[i])
  if (out.length < 3) return ring
  out.push(out[0])
  return out
}
