#!/usr/bin/env node
// City basemap for `city` films: reads <project>/geo/places.json (written by the Agent), geocodes the
// centre and every place through OpenStreetMap Nominatim, fetches rivers, water, coastline, rail and
// the modern major-road network through Overpass, and writes <project>/geo/basemap.json in kilometres
// around the centre. Keyless public reads; no model is called. Scenes read the result as `s.geo` and
// draw it with `s.kit.cityMap()`. Every frame then carries "© OpenStreetMap contributors".
//
//   node scripts/geo.mjs --project <dir>
//
// places.json:
// { "center": { "query": "Rome, Italy" }, "radius_km": 9,
//   "places": [{ "id": "colosseum", "query": "Colosseum, Rome", "label": { "en": "Colosseum", "zh-CN": "罗马斗兽场" } }],
//   "hills": [{ "id": "palatine", "qid": "Q200642", "radius_km": 0.35, "label": {…} }],
//   "walls": [{ "id": "aurelian", "match": "Mura Aureliane", "label": {…} }],      // real OSM wall ways
//   "areas": [{ "id": "servian", "label": {…}, "polygon": [[lat, lon], …] }        // or "wall": "<walls id>"
//            ],                                                                    // or "around" + "radius_km"
//   "fabric": { "focus": "forum", "streets_km": 4.5, "buildings_km": 1.8, "builtup_km": 9 } }
// Historic areas are approximations (always tagged "AI illustration" on screen); each gets its km².
// A place (or the centre) may give "qid" (coordinates P625 from Wikidata, preferred: no geocoder
// guess), "query" (Nominatim) or "lat"/"lon" (marked source: "given").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { basemap, fabric, geocode, projector, ringArea, ringByAngle } from '../src/engine/geo/osm.mjs'

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1] }
const project = arg('project')
if (!project) { console.error('Usage: node scripts/geo.mjs --project <dir>'); process.exit(2) }
const dir = resolve(project)
const file = join(dir, 'geo', 'places.json')
if (!existsSync(file)) { console.error(`error geo_places_missing: write ${file} first (see references/narrative-city.md)`); process.exit(2) }
const spec = JSON.parse(readFileSync(file, 'utf8'))
const radius = Math.min(30, Math.max(2, Number(spec.radius_km) || 10))

const qids = [spec.center?.qid, ...(spec.places ?? []).map((p) => p.qid), ...(spec.hills ?? []).map((p) => p.qid)].filter((q) => /^Q\d+$/.test(q ?? ''))
const coords = {}
// public reads retried on network errors and 429/5xx (Wikidata connect timeouts are common)
const fetchRetry = async (u, opt, tries = 4) => {
  for (let i = 0; ; i++) {
    try { const r = await fetch(u, opt); if (r.ok || i >= tries - 1 || !(r.status === 429 || r.status >= 500)) return r } catch (e) { if (i >= tries - 1) throw e }
    await new Promise((ok) => setTimeout(ok, 2000 * (i + 1)))
  }
}
const qidHeight = {}, qidYears = {}
for (let i = 0; i < qids.length; i += 40) {
  const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.slice(i, i + 40).join('|')}&props=claims&format=json`
  const res = await fetchRetry(u, { headers: { 'User-Agent': 'sandbase-lab-chronicle-ink/0.4 (+https://www.sandbase.ai/lab/chronicle-ink)' } })
  if (!res.ok) { console.warn(`[geo] Wikidata HTTP ${res.status}`); continue }
  for (const [id, e] of Object.entries((await res.json()).entities ?? {})) {
    const v = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value
    if (v) coords[id] = { lat: v.latitude, lon: v.longitude, source: 'wikidata', osm: null, qid: id }
    // landmark height (P2048) in metres, applied to the landmark's own footprint below
    const hv = e?.claims?.P2048?.[0]?.mainsnak?.datavalue?.value
    if (hv && /Q11573$/.test(hv.unit ?? '')) qidHeight[id] = Math.abs(Number(hv.amount))
    // inception (P571) and dissolution (P576) years, for "built / lost" labels and buildings that rise on their year
    const yr = (pp) => { const t = e?.claims?.[pp]?.[0]?.mainsnak?.datavalue?.value?.time; const m = t && /^([+-])0*(\d+)-/.exec(t); return m ? (m[1] === '-' ? -Number(m[2]) : Number(m[2])) : null }
    qidYears[id] = { built: yr('P571'), lost: yr('P576') }
  }
}
const locate = async (p, box) => (p.qid && coords[p.qid]) || (p.lat != null ? { lat: +p.lat, lon: +p.lon, source: 'given' } : p.query ? await geocode(p.query, box).catch(() => null) : null)
const c = await locate(spec.center ?? {})
if (!c) { console.error(`error geo_center_not_found: ${spec.center?.query}`); process.exit(5) }
console.log(`[geo] centre ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}  radius ${radius} km`)
const P = projector(c.lat, c.lon)
const dLat = (radius * 1.2) / 110.574, dLon = (radius * 1.2) / (111.32 * Math.cos((c.lat * Math.PI) / 180))
const viewbox = [c.lon - dLon, c.lat + dLat, c.lon + dLon, c.lat - dLat]

const places = []
for (const p of spec.places ?? []) {
  const hit = await locate(p, viewbox)
  if (!hit) { console.warn(`[geo] not found: ${p.id} (${p.query}); give lat/lon in places.json`); continue }
  const [x, y] = P(hit.lat, hit.lon)
  const yrs = (hit.qid && qidYears[hit.qid]) || {}
  places.push({ id: p.id, label: p.label ?? {}, x, y, lat: +hit.lat.toFixed(5), lon: +hit.lon.toFixed(5), source: hit.source ?? 'nominatim', ...(hit.qid ? { qid: hit.qid } : {}), ...(hit.osm ? { osm: hit.osm } : {}), ...(yrs.built != null ? { built: yrs.built } : {}), ...(yrs.lost != null ? { lost: yrs.lost } : {}) })
  console.log(`[geo] ${p.id.padEnd(18)} ${x.toFixed(2).padStart(7)} km, ${y.toFixed(2).padStart(7)} km`)
}
const byId = Object.fromEntries(places.map((p) => [p.id, p]))
const hills = []
for (const h of spec.hills ?? []) {
  const hit = await locate(h, viewbox)
  if (!hit) { console.warn(`[geo] hill not found: ${h.id}`); continue }
  const [x, y] = P(hit.lat, hit.lon)
  hills.push({ id: h.id, label: h.label ?? {}, x, y, radius_km: +h.radius_km || 0.3 })
}
const layers = await basemap({ lat: c.lat, lon: c.lon, radiusKm: radius })
const fab = spec.fabric === false ? { streets: [], buildings: [], heights: [], holes: [], builtup: [], walls: [] } : await fabric({
  lat: c.lat, lon: c.lon,
  focus: (() => { const f = spec.fabric?.focus && byId[spec.fabric.focus]; return f ? { lat: f.lat, lon: f.lon } : { lat: c.lat, lon: c.lon } })(),
  streetsKm: spec.fabric?.streets_km ?? Math.min(radius, 4.5), buildingsKm: spec.fabric?.buildings_km ?? 1.8, builtupKm: spec.fabric?.builtup_km ?? radius, wallsKm: radius,
})
console.log(`[geo] wall names: ${[...new Set(fab.walls.map((w) => w.name).filter(Boolean))].slice(0, 30).join(' | ')}`)
console.log(`[geo] fabric: streets ${fab.streets.length}, buildings ${fab.buildings.length}, built-up ${fab.builtup.length}, wall ways ${fab.walls.length}`)
const walls = (spec.walls ?? []).map((w) => {
  // a vanished wall that OpenStreetMap does not map: the Agent gives its line ([[lat, lon], …]); it is
  // drawn as one path in the given order and recorded as an approximation
  if (!w.match && Array.isArray(w.line) && w.line.length >= 2) {
    const pts = w.line.map(([la, lo]) => P(la, lo))
    return { id: w.id, label: w.label ?? {}, segments: pts.slice(1).map((q, i) => [pts[i], q]), source: 'agent-line' }
  }
  const re = new RegExp(w.match, 'i')
  // segments ordered by the angle of their midpoint around the wall centre, so a wall draws in one sweep
  let segments = fab.walls.filter((x) => re.test(x.name)).map((x) => x.pts)
  const all = segments.flat(), cx = all.reduce((s, p) => s + p[0], 0) / (all.length || 1), cy = all.reduce((s, p) => s + p[1], 0) / (all.length || 1)
  const ang = (pts) => { const m = pts[Math.floor(pts.length / 2)]; return (Math.atan2(m[0] - cx, m[1] - cy) + 2 * Math.PI) % (2 * Math.PI) }
  segments = segments.sort((a, b) => ang(a) - ang(b))
  if (!segments.length && Array.isArray(w.line) && w.line.length >= 2) {
    console.warn(`[geo] no OpenStreetMap wall matches ${w.match}; using the given line`)
    const pts = w.line.map(([la, lo]) => P(la, lo))
    return { id: w.id, label: w.label ?? {}, segments: pts.slice(1).map((q, i) => [pts[i], q]), source: 'agent-line' }
  }
  if (!segments.length) console.warn(`[geo] no OpenStreetMap wall matches ${w.match}`)
  return { id: w.id, label: w.label ?? {}, segments }
})
const wallById = Object.fromEntries(walls.map((w) => [w.id, w]))
const areas = (spec.areas ?? []).map((a) => {
  let ring = null, source = 'radius'
  if (Array.isArray(a.polygon) && a.polygon.length >= 3) { ring = a.polygon.map(([la, lo]) => P(la, lo)); ring.push(ring[0]); source = 'agent-polygon' }
  else if (a.wall && wallById[a.wall]?.segments.length) { ring = ringByAngle(wallById[a.wall].segments.flat()); source = 'osm-wall' }
  const at = a.around ? byId[a.around] : null
  const out = { id: a.id, label: a.label ?? {}, source, note: 'AI illustration' }
  if (ring) {
    out.ring = ring
    out.x = +(ring.reduce((s, p) => s + p[0], 0) / ring.length).toFixed(3)
    out.y = +(ring.reduce((s, p) => s + p[1], 0) / ring.length).toFixed(3)
    out.km2 = +ringArea(ring).toFixed(2)
  } else {
    out.x = at?.x ?? 0; out.y = at?.y ?? 0; out.radius_km = +a.radius_km || 1
    out.km2 = +(Math.PI * out.radius_km ** 2).toFixed(2)
  }
  console.log(`[geo] area ${a.id.padEnd(12)} ${source.padEnd(14)} ≈ ${out.km2} km²`)
  return out
})
console.log(`[geo] rivers ${layers.rivers.length}, water ${layers.water.length}, coast ${layers.coast.length}, roads ${layers.roads.length}, rail ${layers.rail.length}`)
// World land (Natural Earth 1:50m, bundled) for the globe opening, and the film's chronology as written.
const world = JSON.parse(readFileSync(new URL('../assets/geo/world-land-50m.json', import.meta.url), 'utf8')).rings
const chronology = spec.chronology ?? null
// Wikidata heights of landmarks override missing or lower OSM heights on the footprint that holds the
// place (point in polygon, else the nearest footprint within 80 m).
const inPoly = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c } return c }
let landmarkHeights = 0
for (const pl of [...places, ...hills]) {
  const hm = pl.qid && qidHeight[pl.qid]
  if (!hm || hm > 400) continue
  let idx = fab.buildings.findIndex((b) => inPoly([pl.x, pl.y], b))
  if (idx < 0) { let best = 0.08; fab.buildings.forEach((b, i) => { const cx = b.reduce((t, q) => t + q[0], 0) / b.length, cy = b.reduce((t, q) => t + q[1], 0) / b.length, d = Math.hypot(cx - pl.x, cy - pl.y); if (d < best) { best = d; idx = i } }) }
  if (idx >= 0 && (fab.heights[idx] == null || fab.heights[idx] < hm)) { fab.heights[idx] = hm; landmarkHeights++ }
}
for (const pl of places) {
  let idx = fab.buildings.findIndex((b) => inPoly([pl.x, pl.y], b))
  if (idx < 0) { let best = 0.06; fab.buildings.forEach((b, i) => { const cx = b.reduce((t, q) => t + q[0], 0) / b.length, cy = b.reduce((t, q) => t + q[1], 0) / b.length, d = Math.hypot(cx - pl.x, cy - pl.y); if (d < best) { best = d; idx = i } }) }
  if (idx >= 0) pl.footprint = idx
}
console.log(`[geo] heights: ${fab.heights.filter((h) => h != null).length} of ${fab.heights.length} buildings mapped (OSM), ${landmarkHeights} landmark heights from Wikidata`)
// a heights shot is only honest where enough of the city is mapped: the share goes into the basemap
// (the heights legend prints it) and a low share is flagged so the Agent drops heights shots
const heightsShare = fab.heights.length ? fab.heights.filter((h) => h != null).length / fab.heights.length : 0
if (fab.heights.length && heightsShare < 0.2) console.warn(`[geo] warning heights_sparse: only ${Math.round(heightsShare * 100)}% of buildings have an OpenStreetMap height; avoid heights shots or say so in the caption`)
const out = {
  schema: 'chronicle-geo/2',
  world, chronology,
  attribution: '© OpenStreetMap contributors (ODbL)',
  center: { lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5) },
  radius_km: radius,
  places, hills, areas, walls, ...layers,
  streets: fab.streets, buildings: fab.buildings, heights: fab.heights, heights_share: +heightsShare.toFixed(3), holes: fab.holes ?? [], builtup: fab.builtup,
}
mkdirSync(join(dir, 'geo'), { recursive: true })
writeFileSync(join(dir, 'geo', 'basemap.json'), JSON.stringify(out))
console.log(`[geo] wrote ${join(dir, 'geo', 'basemap.json')} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`)
