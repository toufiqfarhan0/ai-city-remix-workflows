#!/usr/bin/env node
/**
 * Builds the city data for the film: today's building footprints (OpenStreetMap, Overpass),
 * a height for each and, where a source has one, the year it was built.
 *
 *   node scripts/build-city.mjs <project-dir> [--colouring <buildings.csv>] [--victorian <footprints.gpkg>] [--lang en|zh-CN]
 *
 * Reads <project-dir>/story.json (city.bbox, landmarks). Writes <project-dir>/city.json:
 * buildings as local metre polygons with height, year (or null) and the source of the year.
 * Footprints are cached in <project-dir>/cache/ so a re-run needs no network.
 *
 * Years come only from recorded data: a Colouring Cities extract (date_year, or the middle
 * of date_lower..date_upper when both are given), OSM start_date, or a landmark in story.json.
 * A building with none of these keeps year null; the film shows it as "year not recorded".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { langFromArgs, messages } from './lib/i18n.mjs'
import { normalizeStory, validateStory } from './lib/story.mjs'
import { area, centroid, inside, projector, simplify } from './lib/geo.mjs'
import { readColouring } from './lib/colouring.mjs'
import { readVictorian } from './lib/gpkg.mjs'
import { tileFeatures } from './lib/tiles.mjs'

const args = process.argv.slice(2)
const msg = messages(langFromArgs(args))
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
if (!args[0] || args[0].startsWith('--')) { console.error(msg('usageBuild')); process.exit(2) }
const dir = resolve(args[0])
const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
normalizeStory(story)
const problems = validateStory(story)
if (problems.length) { console.error(msg('storyProblems')); for (const p of problems) console.error(`  - ${p}`); process.exit(1) }
const [S, W, N, E] = story.city.bbox
const P = projector(story.city.center ?? [(S + N) / 2, (W + E) / 2])
mkdirSync(join(dir, 'cache'), { recursive: true })

// ── today's footprints from OpenStreetMap, in tiles of at most 0.04° ──
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
function overpass(bbox, file) {
  if (existsSync(file)) { try { const d = JSON.parse(readFileSync(file, 'utf8')); if (d.elements) return d } catch { /* refetch */ } }
  const q = `[out:json][timeout:180];(way["building"](${bbox.join(',')});relation["building"](${bbox.join(',')}););out body geom qt;`
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length]
    const r = spawnSync('curl', ['-sS', '-m', '300', ...(process.platform === 'win32' ? ['--ssl-no-revoke'] : []), '-A', 'city-grows-3d/0.1', '--data-urlencode', `data=${q}`, url, '-o', file, '-w', '%{http_code}'], { encoding: 'utf8' })
    if (r.stdout === '200') { try { const d = JSON.parse(readFileSync(file, 'utf8')); if (d.elements) return d } catch { /* retry */ } }
    console.log(msg('overpassRetry', { url, code: r.stdout || r.status }))
    spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${20000 + attempt * 10000})`])
  }
  throw new Error(msg('overpassFailed'))
}
const tiles = []
for (let a = S; a < N - 1e-9; a += 0.02) for (let b = W; b < E - 1e-9; b += 0.04) tiles.push([+a.toFixed(5), +b.toFixed(5), +Math.min(N, a + 0.02).toFixed(5), +Math.min(E, b + 0.04).toFixed(5)])
const seen = new Set(), raw = []
for (const t of tiles) {
  const d = overpass(t, join(dir, 'cache', `osm-${t.join('_')}.json`))
  for (const e of d.elements) {
    const key = `${e.type}/${e.id}`
    if (seen.has(key)) continue
    seen.add(key)
    let rings = []
    if (e.type === 'way' && e.geometry?.length >= 4) rings = [e.geometry]
    else if (e.type === 'relation') rings = (e.members ?? []).filter((m) => m.role === 'outer' && m.geometry?.length >= 4).map((m) => m.geometry)
    for (const g of rings) raw.push({ key, tags: e.tags ?? {}, ll: g.map((p) => [p.lat, p.lon]) })
  }
}
console.log(msg('footprints', { n: raw.length, tiles: tiles.length }))

// ── heights and years ──
const col = opt('--colouring') ? readColouring(resolve(opt('--colouring')), [S, W, N, E]) : null
if (col) console.log(msg('colouring', { n: col.rows.length, dated: col.rows.filter((r) => r.year).length }))
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null }
const levelH = 3.4
const out = []
for (const r of raw) {
  const ring = simplify(r.ll.map(([la, lo]) => P(la, lo)), 0.4)
  if (ring.length < 4) continue
  const a = area(ring)
  if (a < 8) continue
  const [cx, cy] = centroid(ring)
  const t = r.tags
  const c = col?.byOsm.get(r.key.split('/')[1]) ?? col?.near(cx, cy, ring, P)
  let h = num(t.height) ?? (num(t['building:levels']) ? num(t['building:levels']) * levelH + 2 : null) ?? num(c?.height) ?? (c?.storeys ? c.storeys * levelH + 2 : null)
  const hSrc = h ? 'data' : 'estimate'
  if (!h) h = Math.min(30, Math.max(7, 6 + Math.sqrt(a) * 0.35))
  if (t.building === 'roof' || t.building === 'canopy') h = Math.min(h, 6)
  const sd = /^~?(\d{4})/.exec(t.start_date ?? '')
  let year = null, ySrc = null
  if (c?.year) { year = c.year; ySrc = 'colouring' }
  else if (sd) { year = +sd[1]; ySrc = 'osm' }
  out.push({ id: r.key, ring: ring.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]), h: +h.toFixed(1), hSrc, year, ySrc, name: t.name ?? c?.name ?? null })
}
// Landmarks from story.json override the year of the footprint they stand on.
for (const lm of story.landmarks ?? []) {
  if (!lm.at || !lm.year) continue
  const [x, y] = P(lm.at[0], lm.at[1])
  const hit = out.filter((b) => inside([x, y], b.ring)).sort((p, q) => area(p.ring) - area(q.ring))[0]
  if (hit) { hit.year = lm.year; hit.ySrc = 'landmark'; hit.name = lm.name; if (lm.height) { hit.h = lm.height; hit.hSrc = 'data' } hit.landmark = lm.id }
  else console.log(msg('landmarkMiss', { name: lm.name }))
}

// ── the 1890s city as surveyed (a layer of its own, never used to date today's buildings) ──
let victorian = null
if (opt('--victorian')) {
  const polys = readVictorian(resolve(opt('--victorian')), [S, W, N, E])
  victorian = polys.map((ll) => simplify(ll.map(([la, lo]) => P(la, lo)), 0.6)).filter((g) => g.length >= 4 && area(g) >= 10).map((g) => g.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]))
  console.log(msg('victorian', { n: victorian.length }))
}

const dated = out.filter((b) => b.year).length

// ── ground: water, parks and streets from OpenFreeMap vector tiles (© OpenMapTiles © OpenStreetMap) ──
const pad = 0.012, outer = [S - pad, W - pad * 1.6, N + pad, E + pad * 1.6]
const cacheJson = (name, fn) => { const f = join(dir, 'cache', `${name}.json`); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8')); const v = fn(); writeFileSync(f, JSON.stringify(v)); return v }
const toLocal = (rings) => rings.map((r) => r.map(([la, lo]) => P(la, lo)).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]))
const water = cacheJson('t-water', () => tileFeatures(outer, 14, ['water'], () => true)).filter((f) => f.type === 3).flatMap((f) => toLocal(f.rings))
const parks = cacheJson('t-park', () => tileFeatures(outer, 14, ['park', 'landcover'], (l, p) => l === 'park' || /^(grass|wood)$/.test(p.class))).filter((f) => f.type === 3).flatMap((f) => toLocal(f.rings))
const roads = cacheJson('t-roads', () => tileFeatures(outer, 14, ['transportation'], (_, p) => /^(motorway|trunk|primary|secondary|tertiary|minor)$/.test(p.class) && !p.ramp && p.brunnel !== 'tunnel'))
  .filter((f) => f.type === 2).map((f) => ({ cls: f.props.class, bridge: f.props.brunnel === 'bridge', lines: toLocal(f.rings) }))
console.log(msg('ground', { water: water.length, parks: parks.length, roads: roads.length }))
const city = {
  version: 1, center: story.city.center ?? [(S + N) / 2, (W + E) / 2], bbox: story.city.bbox,
  stats: { buildings: out.length, dated, heightData: out.filter((b) => b.hSrc === 'data').length },
  sources: { osm: 'Overpass API, © OpenStreetMap contributors (ODbL)', ground: 'OpenFreeMap vector tiles, © OpenMapTiles © OpenStreetMap contributors', colouring: col ? `Colouring London data extract, ${col.extract} (ODbL)` : null, victorian: victorian ? 'Petitpierre et al. 2026, A Layer of Late Victorian London (CC BY 4.0)' : null },
  ground: { water, parks, roads },
  buildings: out, victorian,
}
writeFileSync(join(dir, 'city.json'), JSON.stringify(city))
console.log(msg('cityWritten', { n: out.length, dated, pct: ((100 * dated) / Math.max(1, out.length)).toFixed(0) }))
