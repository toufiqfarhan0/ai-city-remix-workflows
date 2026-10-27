#!/usr/bin/env node
/**
 * Turns the agent's story.json into the film's data:
 *   - outlines given as OSM references ({ "osm": { "name": "…" } }) become closed rings
 *     (or polylines for roads) from real OpenStreetMap geometry,
 *   - the basemap (streets, buildings, rivers) is fetched for the area the story covers.
 *
 *   node scripts/resolve.mjs <project-dir>
 *
 * Reads <project>/story.json; writes <project>/story.resolved.json and <project>/basemap.json.
 * Outlines: Overpass API (small queries). Basemap: OpenFreeMap vector tiles.
 * Cached: delete cache/ to fetch again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { overpass, bboxStr } from './lib/overpass.mjs'
import { tileFeatures } from './lib/tiles.mjs'
import { normalizeStory, validateStory } from './lib/story.mjs'
import { langFromArgs, messages } from './lib/i18n.mjs'

const msg = messages(langFromArgs(process.argv))
const dir = process.argv[2]
if (!dir || dir.startsWith('--')) { console.error(msg('usageResolve')); process.exit(2) }
const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
for (const f of normalizeStory(story)) console.error(`note: ${f}`)
const problems = validateStory(story, { resolved: false })
if (problems.length) { console.error(msg('storyProblems') + '\n- ' + problems.join('\n- ')); process.exit(1) }
mkdirSync(join(dir, 'cache'), { recursive: true })
const log = (m) => console.error(m)

const { lat: LAT0, lon: LON0 } = story.city
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KY = 110540
const toM = ([lat, lon]) => [(lon - LON0) * KX, (lat - LAT0) * KY]
const toLL = ([x, y]) => [+(LAT0 + y / KY).toFixed(5), +(LON0 + x / KX).toFixed(5)]
const around = (km) => [LAT0 - (km * 1000) / KY, LON0 - (km * 1000) / KX, LAT0 + (km * 1000) / KY, LON0 + (km * 1000) / KX]

function cached(key, fn) {
  const file = join(dir, 'cache', createHash('sha1').update(key).digest('hex').slice(0, 16) + '.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const v = fn(); writeFileSync(file, JSON.stringify(v)); return v
}

/** Overpass filter for an OSM reference: name (regex, case-insensitive) and/or exact tags. */
function filterOf(ref) {
  let f = ''
  if (ref.name) f += `["name"~${JSON.stringify(ref.name)},i]`
  for (const [k, v] of Object.entries(ref.tags ?? {})) f += v === true ? `[${JSON.stringify(k)}]` : `[${JSON.stringify(k)}=${JSON.stringify(String(v))}]`
  return f
}
function fetchRef(ref) {
  const box = bboxStr(around(ref.within_km ?? 25))
  const f = filterOf(ref)
  const els = cached(`ref:${box}:${f}`, () => overpass(`[out:json][timeout:180];(way${f}(${box});relation${f}(${box}););out geom qt;`, { log }))
  const lines = []
  for (const e of els) {
    if (e.type === 'way' && e.geometry) lines.push(e.geometry.map((g) => [g.lat, g.lon]))
    if (e.type === 'relation') for (const m of e.members ?? []) if (m.geometry) lines.push(m.geometry.map((g) => [g.lat, g.lon]))
  }
  return lines
}

/** A closed outline from scattered points: farthest point per bearing around the centroid, gaps filled. */
function radialRing(pointsLL, bins = 160) {
  const pts = pointsLL.map(toM)
  const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  const r = new Array(bins).fill(0)
  for (const [x, y] of pts) {
    const i = Math.floor(((Math.atan2(y - c[1], x - c[0]) + Math.PI) / (2 * Math.PI)) * bins) % bins
    r[i] = Math.max(r[i], Math.hypot(x - c[0], y - c[1]))
  }
  if (r.filter(Boolean).length < bins / 6) return null
  // Drop outliers (a same-named street elsewhere): clamp each bearing to 1.3× the local median.
  const med = r.map((_, i) => { const w = []; for (let k = -6; k <= 6; k++) { const v = r[(i + k + bins) % bins]; if (v) w.push(v) } w.sort((x, y) => x - y); return w[w.length >> 1] ?? 0 })
  for (let i = 0; i < bins; i++) if (r[i] > med[i] * 1.3) r[i] = med[i] * 1.3
  for (let i = 0; i < bins; i++) if (!r[i]) {
    let a = i, b = i
    while (!r[(a - 1 + bins) % bins]) a--
    while (!r[(b + 1) % bins]) b++
    const ra = r[(a - 1 + bins) % bins], rb = r[(b + 1) % bins]
    for (let k = a; k <= b; k++) r[(k + bins) % bins] = ra + (rb - ra) * ((k - a + 1) / (b - a + 2))
  }
  const sm = r.map((_, i) => (r[(i - 1 + bins) % bins] + 2 * r[i] + r[(i + 1) % bins]) / 4)
  return sm.map((d, i) => { const a = -Math.PI + ((i + 0.5) / bins) * 2 * Math.PI; return toLL([c[0] + d * Math.cos(a), c[1] + d * Math.sin(a)]) })
}
const thin = (line, step) => line.filter((_, i) => i % step === 0 || i === line.length - 1)

// ─── 1. outlines ─────────────────────────────────────────────
const sources = []
for (const era of story.eras) {
  const sh = era.shape
  const parts = []
  for (const ref of sh.osm ? [].concat(sh.osm) : []) {
    const lines = fetchRef(ref)
    const n = lines.reduce((s, l) => s + l.length, 0)
    if (ref.as === 'lines') {
      if (n >= 20) { parts.push({ lines: lines.map((l) => thin(l, 3)) }); sources.push(`${era.year}: ${ref.name ?? JSON.stringify(ref.tags)} → ${lines.length} OSM lines`) }
      else log(`warn: ${era.year} OSM lines for ${ref.name} not found (${n} points); using the fallback`)
    } else {
      const ring = n >= 30 ? radialRing(lines.flat()) : null
      if (ring) { parts.push({ polygons: [ring] }); sources.push(`${era.year}: ${ref.name ?? JSON.stringify(ref.tags)} → outline from ${n} OSM points`) }
      else log(`warn: ${era.year} OSM outline for ${ref.name} too sparse (${n} points); using the fallback`)
    }
  }
  const resolved = {}
  for (const p of parts) for (const [k, v] of Object.entries(p)) resolved[k] = [...(resolved[k] ?? []), ...v]
  if (!resolved.polygons && sh.polygons) resolved.polygons = sh.polygons
  if (!resolved.lines && sh.lines) resolved.lines = sh.lines
  if (!resolved.polygons && !resolved.lines && sh.glow) { resolved.glow = sh.glow; resolved.radius = sh.radius }
  if (sh.glow && (resolved.lines)) { resolved.glow = sh.glow; resolved.radius = sh.radius }
  if (!resolved.polygons && !resolved.lines && !resolved.glow) throw new Error(`${era.year}: no outline (OSM missing and no fallback polygons or glow)`)
  era.shape = resolved
}

// ─── 2. basemap ──────────────────────────────────────────────
const allLL = story.eras.flatMap((e) => [...(e.shape.polygons ?? []).flat(), ...(e.shape.lines ?? []).flat(), ...(e.shape.glow ? [e.shape.glow] : [])])
const xs = allLL.map((p) => toM(p)[0]), ys = allLL.map((p) => toM(p)[1])
const pad = 1500
const outer = [LAT0 + (Math.min(...ys) - pad) / KY, LON0 + (Math.min(...xs) - pad) / KX, LAT0 + (Math.max(...ys) + pad) / KY, LON0 + (Math.max(...xs) + pad) / KX]
// Buildings and small streets only where the historic city is (they are dense): a disc up to ~14 km across.
const coreLL = story.eras.flatMap((e) => (e.shape.polygons ?? []).flat())
const cx = coreLL.length ? coreLL.map((p) => toM(p)[0]) : [-2000, 2000], cy = coreLL.length ? coreLL.map((p) => toM(p)[1]) : [-2000, 2000]
const half = Math.min(7000, Math.max(Math.max(...cx) - Math.min(...cx), Math.max(...cy) - Math.min(...cy)) / 2 + 800)
const mx = (Math.max(...cx) + Math.min(...cx)) / 2, my = (Math.max(...cy) + Math.min(...cy)) / 2
const core = [LAT0 + (my - half) / KY, LON0 + (mx - half) / KX, LAT0 + (my + half) / KY, LON0 + (mx + half) / KX]
log(`basemap: outer ${bboxStr(outer)}, core ${bboxStr(core)}`)

const P = (lat, lon) => { const [x, y] = toM([lat, lon]); return [Math.round(x), Math.round(-y)] }
const simplify = (pts, tol) => { const out = [pts[0]]; for (const p of pts.slice(1, -1)) if (Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) >= tol) out.push(p); out.push(pts[pts.length - 1]); return out }
const flat = (pts) => pts.flat()

// Streets, buildings and rivers come from vector tiles (a CDN), not Overpass: the dense
// layers are too heavy for public Overpass servers, which are often at capacity.
const llPts = (ring) => ring.map(([lat, lon]) => P(lat, lon))
const majorEls = cached(`t-major:${bboxStr(outer)}`, () => tileFeatures(outer, 12, ['transportation'], (_, p) => /^(motorway|trunk|primary|secondary)$/.test(p.class) && !p.ramp, { log })
  .flatMap((f) => f.rings.map((r) => ({ class: f.props.class, pts: llPts(r) }))))
const minorEls = cached(`t-minor:${bboxStr(core)}`, () => tileFeatures(core, 14, ['transportation'], (_, p) => /^(tertiary|minor)$/.test(p.class), { log })
  .flatMap((f) => f.rings.map((r) => llPts(r))))
const bldEls = cached(`t-bld:${bboxStr(core)}`, () => tileFeatures(core, 14, ['building'], () => true, { log })
  .flatMap((f) => f.rings.filter((r) => r.length >= 4).map((r) => llPts(r))))
const riverEls = cached(`t-river:${bboxStr(outer)}`, () => tileFeatures(outer, 12, ['waterway'], (_, p) => p.class === 'river', { log })
  .flatMap((f) => f.rings.map((r) => r.map(([lat, lon]) => [+lat.toFixed(5), +lon.toFixed(5)]))))
const RANK = { motorway: 3, trunk: 3, primary: 2, secondary: 1 }
// Keep the disc inside the square so the lit city has a round, soft edge, not a tile edge.
const inDisc = (a) => Math.hypot(a[0] - mx, -a[1] - my) <= half
const basemap = {
  origin: [LAT0, LON0],
  major: majorEls.filter((e) => e.pts.length >= 2).map((e) => [RANK[e.class] ?? 1, ...flat(simplify(e.pts, 8))]),
  minor: minorEls.filter((e) => e.length >= 2 && inDisc(e[0])).map((e) => flat(simplify(e, 8))),
  buildings: bldEls.filter((e) => inDisc(e[0])).map((e) => flat(simplify(e, 1.5))).filter((a) => a.length >= 6),
}
writeFileSync(join(dir, 'basemap.json'), JSON.stringify(basemap))
if (!story.rivers?.length) story.rivers = riverEls.filter((l) => l.length >= 2).map((l) => thin(l, 2))
story.sources = sources
const after = validateStory(story, { resolved: true })
if (after.length) { console.error(msg('resolvedProblems') + '\n- ' + after.join('\n- ')); process.exit(1) }
writeFileSync(join(dir, 'story.resolved.json'), JSON.stringify(story, null, 1))
console.log(JSON.stringify({ outlines: sources, basemap: { major: basemap.major.length, minor: basemap.minor.length, buildings: basemap.buildings.length }, rivers: story.rivers.length }, null, 1))
