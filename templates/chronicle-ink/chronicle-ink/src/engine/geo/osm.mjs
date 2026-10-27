// Real geography for the map: OpenStreetMap via the public Nominatim and
// Overpass APIs (no key). Respect their usage policies: one run fetches the
// basemap once, geocoding is throttled to 1 request/second, and every map shows
// "© OpenStreetMap contributors".
import { writeFileSync } from 'node:fs'

const UA = 'sandbase-lab-city-life/1.0 (+https://www.sandbase.ai/lab/city-life)'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Local equirectangular projection around the city centre, in kilometres (y up). */
export function projector(lat0, lon0) {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.574
  return (lat, lon) => [+((lon - lon0) * kx).toFixed(3), +((lat - lat0) * ky).toFixed(3)]
}

async function getJson(url, init = {}, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } })
      if (res.ok) return await res.json()
      last = new Error(`HTTP ${res.status} from ${new URL(url).host}`)
      if (res.status !== 429 && res.status < 500) break
    } catch (e) { last = e }
    await sleep(2000 * (i + 1))
  }
  throw last
}

let lastGeocode = 0
/** Geocodes one place name, optionally inside a viewbox [west, south, east, north]. */
export async function geocode(query, viewbox) {
  const wait = lastGeocode + 1100 - Date.now()
  if (wait > 0) await sleep(wait)
  lastGeocode = Date.now()
  const u = new URL(NOMINATIM)
  u.searchParams.set('q', query); u.searchParams.set('format', 'jsonv2'); u.searchParams.set('limit', '1')
  if (viewbox) { u.searchParams.set('viewbox', viewbox.join(',')); u.searchParams.set('bounded', '1') }
  const list = await getJson(u.toString())
  const hit = list?.[0]
  return hit ? { lat: +hit.lat, lon: +hit.lon, osm: `${hit.osm_type}/${hit.osm_id}`, display: hit.display_name } : null
}

/** Douglas–Peucker simplification on [x, y] points. */
export function simplify(points, eps) {
  if (points.length < 3) return points
  const [fx, fy] = points[0], [lx, ly] = points[points.length - 1]
  if (points.length > 3 && Math.abs(fx - lx) < 1e-9 && Math.abs(fy - ly) < 1e-9) {
    // closed ring: split at the vertex farthest from the start so neither half is degenerate
    let far = 1, best = -1
    for (let i = 1; i < points.length - 1; i++) { const d = Math.hypot(points[i][0] - fx, points[i][1] - fy); if (d > best) { best = d; far = i } }
    return simplify(points.slice(0, far + 1), eps).concat(simplify(points.slice(far), eps).slice(1))
  }
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a], [bx, by] = points[b]
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9
    let best = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len
      if (d > best) { best = d; idx = i }
    }
    if (best > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
  }
  return points.filter((_, i) => keep[i])
}

/** Joins open way segments into closed rings (multipolygon members). */
export function assembleRings(segments) {
  const open = segments.map((s) => s.slice()).filter((s) => s.length > 1)
  const rings = []
  const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6
  while (open.length) {
    let ring = open.shift()
    let grew = true
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false
      for (let i = 0; i < open.length; i++) {
        const s = open[i]
        if (same(ring.at(-1), s[0])) ring = ring.concat(s.slice(1))
        else if (same(ring.at(-1), s.at(-1))) ring = ring.concat(s.slice(0, -1).reverse())
        else if (same(ring[0], s.at(-1))) ring = s.concat(ring.slice(1))
        else if (same(ring[0], s[0])) ring = s.slice().reverse().concat(ring.slice(1))
        else continue
        open.splice(i, 1); grew = true; break
      }
    }
    if (ring.length > 3) rings.push(ring)
  }
  return rings
}

/** Fetches water, coastline and the modern major-road network around the centre. */
export async function basemap({ lat, lon, radiusKm }) {
  const dLat = radiusKm / 110.574, dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(5)).join(',')
  const q = `[out:json][timeout:180];(
    way["waterway"~"^(river|canal)$"](${bbox});
    way["natural"="water"](${bbox});
    relation["natural"="water"](${bbox});
    way["natural"="coastline"](${bbox});
    way["highway"~"^(motorway|trunk|primary|secondary)$"](${bbox});
    way["railway"="rail"](${bbox});
  );out geom qt;`
  // same rounds and back-off as the fabric queries: a big city's box often times out once
  let data
  try { data = await overpass(q) } catch (e) { throw new Error(`Overpass basemap failed: ${e.message}`) }
  const P = projector(lat, lon)
  const line = (geom) => (geom ?? []).map((g) => P(g.lat, g.lon))
  const eps = Math.max(0.01, radiusKm / 2500)
  const out = { rivers: [], water: [], coast: [], roads: [], rail: [] }
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {}
    if (el.type === 'relation') {
      const outer = (el.members ?? []).filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => line(m.geometry))
      for (const r of assembleRings(outer)) out.water.push(simplify(r, eps))
      continue
    }
    const pts = simplify(line(el.geometry), eps)
    if (pts.length < 2) continue
    if (t.waterway) out.rivers.push({ name: t['name:en'] ?? t.name ?? '', canal: t.waterway === 'canal', pts })
    else if (t.natural === 'water') out.water.push(pts)
    else if (t.natural === 'coastline') out.coast.push(pts)
    else if (t.highway) out.roads.push({ rank: { motorway: 0, trunk: 1, primary: 2, secondary: 3 }[t.highway], pts })
    else if (t.railway) out.rail.push(pts)
  }
  // Fountains and garden ponds are noise at city scale: keep water bodies of at least 0.004 km².
  const area = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0) / 2)
  out.water = out.water.filter((r) => area(r) >= 0.004)
  return out
}

export function writeGeo(path, geo) { writeFileSync(path, JSON.stringify(geo)) }

/** Polygon area in km² (shoelace) of a ring of [x, y] km points. */
export function ringArea(r) {
  let a = 0
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1] }
  return Math.abs(a) / 2
}

/** A closed ring through scattered wall points: points ordered by angle around their centroid. */
export function ringByAngle(points, eps = 0.02) {
  if (points.length < 3) return []
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length
  // Outermost point per 2° bin, then a median filter on the radius: removes inner zig-zags and stray
  // fragments so the ring follows the wall line.
  const BINS = 180
  const bins = new Array(BINS).fill(null)
  for (const p of points) {
    const a = Math.atan2(p[1] - cy, p[0] - cx), r = Math.hypot(p[0] - cx, p[1] - cy)
    const i = Math.min(BINS - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS))
    if (!bins[i] || r > bins[i].r) bins[i] = { a, r }
  }
  const filled = bins.map((b, i) => b ?? null)
  for (let i = 0; i < BINS; i++) if (!filled[i]) {
    let j = 1
    while (j < BINS && !filled[(i + j) % BINS] && !filled[(i - j + BINS) % BINS]) j++
    const n = filled[(i + j) % BINS] ?? filled[(i - j + BINS) % BINS]
    filled[i] = { a: -Math.PI + ((i + 0.5) / BINS) * 2 * Math.PI, r: n.r }
  }
  const med = filled.map((b, i) => { const w = [-3, -2, -1, 0, 1, 2, 3].map((d) => filled[(i + d + BINS) % BINS].r).sort((x, y) => x - y); return { a: b.a, r: w[3] } })
  const ring = med.map((b) => [+(cx + Math.cos(b.a) * b.r).toFixed(3), +(cy + Math.sin(b.a) * b.r).toFixed(3)])
  return simplify([...ring, ring[0]], eps)
}

async function overpass(q) {
  let last
  for (let round = 0; round < 3; round++) {
    for (const endpoint of OVERPASS) {
      try { return await getJson(endpoint, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 2) }
      catch (e) { last = e }
    }
    await sleep(10000 * (round + 1))
  }
  throw new Error(`Overpass failed: ${last?.message}`)
}

/**
 * City fabric for the atlas styles: today's street network (streetsKm around the centre), building
 * footprints (buildingsKm around `focus`), built-up land use (builtupKm) and every city wall way with
 * its name. Coordinates in km around (lat, lon), y up; simplified to about a metre.
 */
/**
 * Building height in metres from OpenStreetMap tags: `height` (or `building:height`), else
 * `building:levels` × 3.2 m (+ roof levels), else null (unknown; renderers use a low default).
 */
/** Even-odd point in ring test (km coordinates). */
export function pointInRing(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c } return c }
export function buildingHeight(tags = {}) {
  const num = (v) => { const m = /^\s*(\d+(?:[.,]\d+)?)\s*(m)?\s*$/.exec(String(v ?? '')); return m ? Number(m[1].replace(',', '.')) : null }
  const h = num(tags.height) ?? num(tags['building:height'])
  if (h != null && h > 0 && h < 1000) return Math.round(h * 10) / 10
  const lv = num(tags['building:levels'])
  if (lv != null && lv > 0 && lv < 200) return Math.round((lv + (num(tags['roof:levels']) ?? 0) * 0.5) * 3.2 * 10) / 10
  return null
}
export async function fabric({ lat, lon, focus = { lat, lon }, streetsKm = 4.5, buildingsKm = 1.8, builtupKm = 9, wallsKm = 6 }) {
  const P = projector(lat, lon)
  const line = (geom) => (geom ?? []).map((g) => P(g.lat, g.lon))
  const out = { streets: [], buildings: [], heights: [], holes: [], builtup: [], walls: [] }
  const m = (km) => Math.round(km * 1000)
  const streets = await overpass(`[out:json][timeout:180];way["highway"~"^(tertiary|unclassified|residential|living_street|pedestrian|service)$"](around:${m(streetsKm)},${lat},${lon});out geom qt;`)
  for (const el of streets.elements ?? []) { const pts = simplify(line(el.geometry), 0.004); if (pts.length > 1) out.streets.push({ rank: ['tertiary', 'unclassified'].includes(el.tags?.highway) ? 0 : el.tags?.highway === 'service' ? 2 : 1, pts }) }
  const buildings = await overpass(`[out:json][timeout:180];way["building"](around:${m(buildingsKm)},${focus.lat},${focus.lon});out geom qt;`)
  for (const el of buildings.elements ?? []) { const pts = simplify(line(el.geometry), 0.0015); if (pts.length > 3) { out.buildings.push(pts); out.heights.push(buildingHeight(el.tags)) } }
  // multipolygon buildings (large landmarks such as amphitheatres and basilicas are relations, not ways)
  const rels = await overpass(`[out:json][timeout:180];relation["building"](around:${m(buildingsKm)},${focus.lat},${focus.lon});out geom qt;`)
  for (const el of rels.elements ?? []) {
    const h = buildingHeight(el.tags)
    const inner = assembleRings((el.members ?? []).filter((x) => x.type === 'way' && x.role === 'inner' && x.geometry).map((x) => line(x.geometry))).map((r) => simplify(r, 0.0015)).filter((r) => r.length > 3)
    for (const r of assembleRings((el.members ?? []).filter((x) => x.type === 'way' && x.role !== 'inner' && x.geometry).map((x) => line(x.geometry)))) {
      const pts = simplify(r, 0.0015)
      if (pts.length <= 3) continue
      out.buildings.push(pts); out.heights.push(h)
      // courtyards and arenas: inner rings inside this outer ring
      for (const hole of inner) if (pointInRing(hole[0], pts)) out.holes.push([out.buildings.length - 1, hole])
    }
  }
  const land = await overpass(`[out:json][timeout:180];(way["landuse"~"^(residential|commercial|retail|industrial)$"](around:${m(builtupKm)},${lat},${lon});relation["landuse"~"^(residential|commercial|retail|industrial)$"](around:${m(builtupKm)},${lat},${lon}););out geom qt;`)
  for (const el of land.elements ?? []) {
    if (el.type === 'relation') { for (const r of assembleRings((el.members ?? []).filter((x) => x.type === 'way' && x.role !== 'inner' && x.geometry).map((x) => line(x.geometry)))) out.builtup.push(simplify(r, 0.01)); continue }
    const pts = simplify(line(el.geometry), 0.01)
    if (pts.length > 3) out.builtup.push(pts)
  }
  out.builtup = out.builtup.filter((r) => ringArea(r) >= 0.002)
  const walls = await overpass(`[out:json][timeout:120];(way["barrier"="city_wall"](around:${m(wallsKm)},${lat},${lon});way["historic"="citywalls"](around:${m(wallsKm)},${lat},${lon}););out geom qt;`)
  for (const el of walls.elements ?? []) { const pts = simplify(line(el.geometry), 0.003); if (pts.length > 1) out.walls.push({ name: el.tags?.name ?? el.tags?.['name:en'] ?? '', pts }) }
  return out
}
