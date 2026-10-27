// The baked poster data as the renderer needs it: decoded polylines and polygons in metres around the centre,
// per-layer lengths and counts, the sea mask, and the skyline, food and landmark records when they were baked. Built once; no DOM, so it also runs in Node tests.

export const CLASSES = ['path', 'minor', 'mid', 'major']

export function decodeLine(flat) {
  const pts = new Float32Array(flat.length)
  let x = 0, y = 0
  for (let i = 0; i < flat.length; i += 2) {
    x = i ? x + flat[i] : flat[i]
    y = i ? y + flat[i + 1] : flat[i + 1]
    pts[i] = x
    pts[i + 1] = y
  }
  return pts
}
function decodeMask(b64, n) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const mask = new Uint8Array(n * n)
  let p = 0
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const k = bin.charCodeAt(i), v = bin.charCodeAt(i + 1)
    mask.fill(v, p, p + k)
    p += k
  }
  return mask
}
const length = (pts) => {
  let L = 0
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
  return L
}

export function createWorld(poster) {
  if (poster?.schema !== 'city-poster/1' || !poster.roads || !Array.isArray(poster.water)) throw Object.assign(new Error('poster'), { code: 'data' })
  const roads = {}
  const stats = { roads: 0, roadKm: 0 }
  for (const c of CLASSES) {
    roads[c] = (poster.roads[c] ?? []).map(decodeLine)
    stats.roads += roads[c].length
    for (const p of roads[c]) stats.roadKm += length(p) / 1000
  }
  const rail = poster.rail.map(decodeLine)
  const rivers = poster.rivers.map((r) => ({ w: r.w, pts: decodeLine(r.pts) }))
  const water = poster.water.map((rings) => rings.map(decodeLine))
  const parks = poster.parks.map((rings) => rings.map(decodeLine))
  const sea = poster.sea ? { n: poster.sea.n, mask: decodeMask(poster.sea.rle, poster.sea.n) } : null
  // Skyline: four depth bands of heights (delta-encoded), caps and labels.
  let skyline = null
  if (poster.skyline?.bands?.length === 4) {
    const S = poster.skyline
    const bands = S.bands.map((d) => {
      const out = new Float32Array(d.length)
      let v = 0
      for (let i = 0; i < d.length; i++) out[i] = v += d[i]
      return out
    })
    let top = 1
    for (const b of bands) for (const v of b) if (v > top) top = v
    for (const c of S.caps) if (c[3] > top) top = c[3]
    skyline = { from: S.from, step: S.step, x0: S.x0, bands, caps: S.caps, labels: S.labels, top, mapped: S.mapped, buildings: S.buildings }
  }
  const food = poster.food?.pts ? { groups: poster.food.groups, pts: Int32Array.from(poster.food.pts), counts: poster.food.counts, total: poster.food.total, cuisines: poster.food.cuisines } : null
  const landmarks = (poster.landmarks ?? []).map((l) => ({ ...l, rings: l.rings.map((r) => Float32Array.from(r)), parts: l.parts.map((r) => Float32Array.from(r)), context: l.context.map((r) => Float32Array.from(r)) }))
  return {
    poster,
    radius: poster.radius,
    roads,
    rail,
    rivers,
    water,
    parks,
    sea,
    marks: poster.marks ?? [],
    skyline,
    food,
    landmarks,
    kinds: ['map', ...(skyline ? ['skyline'] : []), ...(food && food.total ? ['food'] : []), ...(landmarks.length ? ['landmark'] : [])],
    stats: { ...stats, roadKm: Math.round(stats.roadKm), water: water.length + rivers.length + (sea ? 1 : 0), parks: parks.length, rail: rail.length },
  }
}

/** Latitude and longitude of a point in metres around the poster centre (the bake's projection, inverted). */
export function latLonOf([lat0, lon0], x, y) {
  const ky = (Math.PI / 180) * 6371008.8
  const kx = ky * Math.cos((lat0 * Math.PI) / 180)
  return [lat0 + y / ky, lon0 + x / kx]
}

/** "48.8566° N · 2.3470° E" */
export function coordText([lat, lon]) {
  const f = (v, p, n) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? p : n}`
  return `${f(lat, 'N', 'S')} · ${f(lon, 'E', 'W')}`
}
