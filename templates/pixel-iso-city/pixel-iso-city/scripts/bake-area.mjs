#!/usr/bin/env node
// Bakes a real city area into area.json for the isometric pixel city. Zero dependencies (Node 22 fetch).
//
//   node scripts/bake-area.mjs --bbox "south,west,north,east" --out src/city/area.json
//        [--title "Harbour Grid"] [--english] [--pin "landmark name"]... [--cell 2] [--overpass URL]
//
// One Overpass query (OpenStreetMap): building footprints and parts with heights, roads, railways, water,
// coastline, parks and named landmarks inside the box. Please respect the service's usage policy: one bake at a
// time; the answer is cached next to the output. Set PIXEL_CITY_USER_AGENT="name/1.0 (contact)".
// Map data © OpenStreetMap contributors (ODbL). The baked file is a derived database: share it under the ODbL.
//
// Exit codes: 0 written, 1 the service failed, 2 invalid input.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { msg, resolveLang } from './lib/i18n.mjs'

const R = 6371008.8
// Ground codes of the grid.
export const GROUND = { land: 0, water: 1, green: 2, major: 3, minor: 4, path: 5, rail: 6, plaza: 7 }
const ROAD = {
  motorway: ['major', 16], trunk: ['major', 14], primary: ['major', 12], secondary: ['major', 11], tertiary: ['major', 9],
  motorway_link: ['major', 8], trunk_link: ['major', 8], primary_link: ['major', 8], secondary_link: ['major', 7], tertiary_link: ['major', 7],
  residential: ['minor', 7], unclassified: ['minor', 7], living_street: ['minor', 6], service: ['minor', 4.5],
  pedestrian: ['plaza', 6], footway: ['path', 2.4], path: ['path', 2], cycleway: ['path', 2.2], steps: ['path', 2],
}
export const KINDS = ['house', 'terrace', 'apartments', 'office', 'shop', 'civic', 'church', 'industrial', 'warehouse', 'tower']
const KIND_H = { house: 7, terrace: 11, apartments: 18, office: 26, shop: 8, civic: 15, church: 16, industrial: 9, warehouse: 9, tower: 60 }

// ── Pure helpers (exported for tests) ──────────────────────────────────────────────────────────────
export function projector([south, west]) {
  const ky = (Math.PI / 180) * R
  const kx = ky * Math.cos((south * Math.PI) / 180)
  return { fwd: (lat, lon) => [(lon - west) * kx, (lat - south) * ky] }
}
export function kindOf(t) {
  const b = t.building ?? t['building:part'] ?? 'yes'
  const levels = Number.parseFloat(t['building:levels'])
  if (['church', 'cathedral', 'chapel', 'temple', 'mosque', 'synagogue'].includes(b) || t.amenity === 'place_of_worship') return 'church'
  if (['house', 'detached', 'semidetached_house', 'bungalow'].includes(b)) return 'house'
  if (b === 'terrace') return 'terrace'
  if (['retail', 'supermarket', 'kiosk'].includes(b) || t.shop) return 'shop'
  if (['civic', 'public', 'government', 'school', 'university', 'hospital', 'museum', 'train_station', 'transportation'].includes(b)) return 'civic'
  if (['industrial', 'factory', 'hangar'].includes(b)) return 'industrial'
  if (['warehouse', 'garage', 'garages', 'shed', 'roof', 'storage_tank', 'service'].includes(b)) return 'warehouse'
  const h = Number.parseFloat(t.height)
  if (levels >= 15 || h >= 50) return 'tower'
  if (['office', 'commercial'].includes(b)) return 'office'
  if (['apartments', 'residential', 'hotel', 'dormitory'].includes(b) || levels >= 5) return 'apartments'
  return 'terrace'
}
export function heightOf(t, kind) {
  const num = (v) => Number.parseFloat(String(v ?? '').replace(/[^\d.]/g, ''))
  const h = num(t.height)
  if (h > 1 && h < 700) return h
  const l = num(t['building:levels'])
  if (l > 0 && l < 200) return l * 3.3 + (t['roof:levels'] ? num(t['roof:levels']) * 2.5 : 0)
  return KIND_H[kind]
}
export function minHeightOf(t) {
  const num = (v) => Number.parseFloat(String(v ?? '').replace(/[^\d.]/g, ''))
  const h = num(t.min_height)
  if (h > 0 && h < 700) return h
  const l = num(t['building:min_level'])
  return l > 0 && l < 200 ? l * 3.3 : 0
}
/** Douglas–Peucker simplification of a closed ring (first point not repeated). */
export function simplify(ring, tol = 0.6) {
  if (ring.length < 5) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let best = -1, bd = 0
    const [ax, ay] = ring[a], [bx, by] = ring[b]
    const L = Math.hypot(bx - ax, by - ay) || 1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - ring[i][1]) - (ax - ring[i][0]) * (by - ay)) / L
      if (d > bd) {
        bd = d
        best = i
      }
    }
    if (best >= 0 && bd > tol) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return ring.filter((_, i) => keep[i])
}
/** Scanline fill of a polygon into the grid (cells whose centre lies inside). */
export function fillPolygon(grid, W, H, cell, ring, code, only = null) {
  let y0 = Infinity, y1 = -Infinity
  for (const [, y] of ring) {
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  const r0 = Math.max(0, Math.floor(y0 / cell)), r1 = Math.min(H - 1, Math.ceil(y1 / cell))
  for (let r = r0; r <= r1; r++) {
    const yc = (r + 0.5) * cell
    const xs = []
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(xs[k] / cell - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[k + 1] / cell - 0.5))
      for (let c = c0; c <= c1; c++) if (only === null || only.includes(grid[r * W + c])) grid[r * W + c] = code
    }
  }
}
/** Marks the cells within width/2 of a polyline. */
export function strokeLine(grid, W, H, cell, pts, width, code) {
  const half = width / 2
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - half) / cell)), c1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + half) / cell))
    const r0 = Math.max(0, Math.floor((Math.min(ay, by) - half) / cell)), r1 = Math.min(H - 1, Math.ceil((Math.max(ay, by) + half) / cell))
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * cell, y = (r + 0.5) * cell
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
      if ((ax + k * dx - x) ** 2 + (ay + k * dy - y) ** 2 <= half * half) grid[r * W + c] = code
    }
  }
}
/** Even-odd point-in-polygon test. */
export function insideRing(x, y, ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) hit = !hit
  }
  return hit
}
/** Run-length encoding (count ≤ 255, code) → base64. */
export function encodeGrid(grid) {
  const out = []
  for (let i = 0; i < grid.length;) {
    let n = 1
    while (n < 255 && i + n < grid.length && grid[i + n] === grid[i]) n++
    out.push(n, grid[i])
    i += n
  }
  return Buffer.from(out).toString('base64')
}
export function decodeGrid(b64, size) {
  const bytes = Buffer.from(b64, 'base64')
  const grid = new Uint8Array(size)
  let p = 0
  for (let i = 0; i < bytes.length; i += 2) {
    grid.fill(bytes[i + 1], p, p + bytes[i])
    p += bytes[i]
  }
  return grid
}
const ascii = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim()

/** Turns an Overpass answer into the area record. */
export function bakeFrom({ osm, bbox, title, english, pins = [], cell = 2 }) {
  const [south, west, north, east] = bbox
  const P = projector([south, west])
  const [width, height] = P.fwd(north, east)
  const W = Math.ceil(width / cell), H = Math.ceil(height / cell)
  const grid = new Uint8Array(W * H)
  const ringOf = (geom) => geom.map((g) => P.fwd(g.lat, g.lon))
  const name = (t) => ascii((english && t['name:en']) || t.name || '') || (english ? '' : String(t.name ?? '').trim())
  const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry)
  const rels = osm.elements.filter((e) => e.type === 'relation' && e.members)
  const polys = (e) => (e.type === 'way' ? [ringOf(e.geometry)] : e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => ringOf(m.geometry)))

  // Sea from the coastline: water lies to the right of a coastline way; each cell takes the side of its
  // nearest coastline segment (only when there is a coastline in the box).
  const coast = ways.filter((w) => w.tags?.natural === 'coastline').map((w) => ringOf(w.geometry))
  if (coast.length) {
    const segs = []
    for (const c of coast) for (let i = 1; i < c.length; i++) segs.push([c[i - 1], c[i]])
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const x = (c + 0.5) * cell, y = (r + 0.5) * cell
      let best = Infinity, side = 0
      for (const [[ax, ay], [bx, by]] of segs) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
        const d = (ax + k * dx - x) ** 2 + (ay + k * dy - y) ** 2
        if (d < best) {
          best = d
          side = (x - ax) * dy - (y - ay) * dx
        }
      }
      if (side > 0) grid[r * W + c] = GROUND.water
    }
  }
  for (const e of [...ways, ...rels]) {
    const t = e.tags ?? {}
    if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'basin' || t.landuse === 'reservoir') for (const r of polys(e)) fillPolygon(grid, W, H, cell, r, GROUND.water)
  }
  for (const e of [...ways, ...rels]) {
    const t = e.tags ?? {}
    if (['park', 'garden', 'pitch', 'golf_course', 'playground'].includes(t.leisure) || ['grass', 'forest', 'meadow', 'recreation_ground', 'village_green', 'cemetery'].includes(t.landuse) || ['wood', 'scrub', 'grassland'].includes(t.natural)) for (const r of polys(e)) fillPolygon(grid, W, H, cell, r, GROUND.green, [GROUND.land])
    if (t.place === 'square' || (t.highway === 'pedestrian' && t.area === 'yes')) for (const r of polys(e)) fillPolygon(grid, W, H, cell, r, GROUND.plaza, [GROUND.land, GROUND.green])
  }
  // Roads (minor first, so major roads draw over them), then rail.
  const roads = []
  const order = (w) => ({ path: 0, plaza: 1, minor: 2, major: 3 })[ROAD[w.tags.highway]?.[0]] ?? -1
  for (const w of ways.filter((w) => w.tags?.highway && ROAD[w.tags.highway] && w.tags.area !== 'yes' && !w.tags.tunnel).sort((a, b) => order(a) - order(b))) {
    const [cls, wd] = ROAD[w.tags.highway]
    const lanes = Number.parseFloat(w.tags.lanes)
    const width = cls === 'major' && lanes > 0 ? Math.max(wd * 0.7, lanes * 3.4) : wd
    const pts = ringOf(w.geometry)
    strokeLine(grid, W, H, cell, pts, width, GROUND[cls])
    if (cls === 'major' || cls === 'minor') roads.push({ c: cls, w: Math.round(width), oneway: w.tags.oneway === 'yes', pts: simplify(pts, 1).map(([x, y]) => [Math.round(x), Math.round(y)]) })
  }
  for (const w of ways.filter((w) => ['rail', 'light_rail', 'tram'].includes(w.tags?.railway) && !w.tags.tunnel)) strokeLine(grid, W, H, cell, ringOf(w.geometry), w.tags.railway === 'tram' ? 2 : 4, GROUND.rail)

  // Buildings and building parts as prisms.
  const prisms = []
  const addPrism = (t, ring, part) => {
    let r = ring
    if (r.length > 2 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r = r.slice(0, -1)
    r = simplify(r, 0.5)
    if (r.length < 3) return
    let area = 0, cx = 0, cy = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) area += r[j][0] * r[i][1] - r[i][0] * r[j][1]
    if (Math.abs(area) / 2 < 6) return
    for (const [x, y] of r) {
      cx += x
      cy += y
    }
    cx /= r.length
    cy /= r.length
    if (cx < -20 || cy < -20 || cx > width + 20 || cy > height + 20) return
    const kind = kindOf(t)
    const h = heightOf(t, kind)
    const minH = part ? minHeightOf(t) : 0
    if (h <= minH + 0.5) return
    const flat = []
    for (const [x, y] of r) flat.push(Math.round(x * 2) / 2, Math.round(y * 2) / 2)
    prisms.push({ part, ring: r, cx, cy, row: [flat, Math.round(h * 10) / 10, Math.round(minH * 10) / 10, KINDS.indexOf(kind), ascii(t['building:colour'] ?? ''), ascii(t['roof:colour'] ?? ''), t.name ? name(t) : ''] })
  }
  for (const w of ways) {
    const t = w.tags ?? {}
    if (t.building && t.building !== 'no' && !t['building:part']) addPrism(t, ringOf(w.geometry), false)
    else if (t['building:part'] && t['building:part'] !== 'no') addPrism(t, ringOf(w.geometry), true)
  }
  for (const r of rels) {
    const t = r.tags ?? {}
    if (t.building || t['building:part']) for (const ring of polys(r)) addPrism(t, ring, !!t['building:part'] && !t.building)
  }

  // Simple 3D buildings: an outline that holds building parts is not drawn itself (the parts carry the shape).
  const parts = prisms.filter((p) => p.part)
  const buildings = prisms.filter((p) => p.part || !parts.some((q) => insideRing(q.cx, q.cy, p.ring))).map((p) => p.row)

  // Named landmarks, pinned names first.
  const pinned = pins.map((p) => ascii(p).toLowerCase())
  const seen = new Map()
  const lms = []
  for (const e of osm.elements) {
    const t = e.tags ?? {}
    const nm = name(t)
    if (!nm) continue
    // A pin matches a name exactly, or failing that as a substring; each pin claims one landmark.
    const low = nm.toLowerCase()
    const exact = pinned.indexOf(low)
    const part = exact >= 0 ? exact : pinned.findIndex((p) => low.includes(p))
    const pin = part >= 0
    const tall = Number.parseFloat(t.height) || (Number.parseFloat(t['building:levels']) || 0) * 3.3
    const kindish = t.tourism === 'attraction' || t.tourism === 'museum' || ['monument', 'memorial', 'castle', 'building'].includes(t.historic) || t.man_made === 'tower' || t.amenity === 'place_of_worship' || (t.building && tall >= 120)
    if (!pin && !kindish) continue
    if (['plaque', 'bust', 'statue', 'stone'].includes(t.memorial)) continue
    let c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon } : null)
    if (!c && e.geometry?.length) c = { lat: e.geometry.reduce((a, g) => a + g.lat, 0) / e.geometry.length, lon: e.geometry.reduce((a, g) => a + g.lon, 0) / e.geometry.length }
    if (!c) continue
    const [x, y] = P.fwd(c.lat, c.lon)
    if (x < 0 || y < 0 || x > width || y > height) continue
    // A building landmark is as tall as the tallest prism standing inside its footprint (parts included).
    let top = tall
    if (t.building || t['building:part']) for (const ring of e.geometry || e.members ? polys(e) : []) for (const q of prisms) if (insideRing(q.cx, q.cy, ring)) top = Math.max(top, q.row[1])
    const score = (exact >= 0 ? 200 : pin ? 100 : 0) + (t.wikidata ? 3 : 0) + (t.tourism === 'attraction' ? 2 : 0) + Math.min(4, tall / 80)
    // The same name on several elements (outline, address point, parts): keep the pinned, then the tallest.
    const prev = seen.get(nm)
    if (prev && (prev.score >= 100) - (score >= 100) + (prev.h >= top) * 0.5 > 0) continue
    if (prev) lms.splice(lms.indexOf(prev), 1)
    const entry = { name: nm, x: Math.round(x), y: Math.round(y), h: Math.round(top), wikidata: t.wikidata ?? null, score, pin: part }
    seen.set(nm, entry)
    lms.push(entry)
  }
  lms.sort((a, b) => b.score - a.score)
  const landmarks = []
  const claimed = new Set()
  for (const l of lms) {
    if (landmarks.length >= 8) break
    if (l.pin >= 0 && claimed.has(l.pin)) continue
    // Unpinned extras only fill the list when there are no pins at all.
    if (l.pin < 0 && pinned.length) continue
    if (landmarks.some((o) => Math.hypot(o.x - l.x, o.y - l.y) < 90)) continue
    if (l.pin >= 0) claimed.add(l.pin)
    landmarks.push(l)
  }
  for (const l of landmarks) {
    delete l.score
    delete l.pin
  }
  return {
    schema: 'pixel-area/1',
    title: title || 'City Area',
    bbox,
    size: [Math.round(width), Math.round(height)],
    cell,
    grid: { w: W, h: H, rle: encodeGrid(grid) },
    buildings,
    roads,
    landmarks,
    osmBase: osm.osm3s?.timestamp_osm_base ?? null,
    credits: 'Map data © OpenStreetMap contributors (ODbL)',
  }
}

const UA = process.env.PIXEL_CITY_USER_AGENT || 'sandbase-pixel-iso-city/0.1 (area bake)'
async function main() {
  const argv = process.argv.slice(2)
  const { lang, invalid } = resolveLang(argv)
  if (invalid !== null) console.error(msg(lang, 'langInvalid', { value: invalid }))
  const all = (k) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : a.startsWith(`--${k}=`) ? [a.slice(k.length + 3)] : []))
  const opt = (k) => all(k)[0]
  const fail = (key, vars) => {
    console.error(msg(lang, key, vars))
    process.exit(2)
  }
  const bbox = String(opt('bbox') ?? '').split(',').map(Number)
  const out = opt('out')
  const cell = Number(opt('cell') ?? 2)
  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v)) || !out || !(cell >= 1 && cell <= 5)) fail('bakeUsage')
  const [s, w, n, e] = bbox
  if (!(n > s && e > w) || Math.abs(s) > 85 || Math.abs(n) > 85) fail('bakeUsage')
  const P = projector([s, w])
  const [width, height] = P.fwd(n, e)
  if (width > 3500 || height > 3500) fail('bakeTooBig', { w: Math.round(width), h: Math.round(height) })
  const file = resolve(out)
  const cacheDir = `${file}.cache`
  mkdirSync(cacheDir, { recursive: true })
  const b = `${s},${w},${n},${e}`
  const q = `[out:json][timeout:200][bbox:${b}];(way[building];relation[building];way["building:part"];way[highway];way[railway];way[natural=water];relation[natural=water];way[waterway=riverbank];way[leisure];way[landuse];way[natural~"^(wood|scrub|grassland)$"];way[place=square];);out geom;way[natural=coastline](${s - 0.02},${w - 0.02},${n + 0.02},${e + 0.02});out geom;(nwr[name][tourism~"^(attraction|museum)$"];nwr[name][historic];nwr[name][man_made=tower];nwr[name][amenity=place_of_worship];);out center tags;`
  const hosts = opt('overpass') ? [opt('overpass')] : ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter']
  const key = createHash('sha256').update(q).digest('hex').slice(0, 24)
  const cached = join(cacheDir, `${key}.json`)
  let osm = existsSync(cached) ? JSON.parse(readFileSync(cached, 'utf8')) : null
  console.log(msg(lang, 'bakeOsm'))
  for (let attempt = 0; !osm && attempt < hosts.length * 2; attempt++) {
    try {
      const res = await fetch(hosts[attempt % hosts.length], { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(260000) })
      const text = await res.text()
      if (!res.ok || !text.trimStart().startsWith('{')) throw new Error(`Overpass HTTP ${res.status}`)
      const j = JSON.parse(text)
      if (!j.elements?.some((x) => x.tags?.building)) throw new Error('Overpass returned an empty answer')
      writeFileSync(cached, text)
      osm = j
    } catch (err) {
      console.error(`  ${err.message}`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  if (!osm) {
    console.error(msg(lang, 'bakeService', { error: 'no answer with buildings' }))
    process.exit(1)
  }
  const baked = bakeFrom({ osm, bbox, title: opt('title'), english: argv.includes('--english'), pins: all('pin'), cell })
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(baked)}\n`)
  console.log(msg(lang, 'bakeWroteArea', { file: out, buildings: baked.buildings.length, roads: baked.roads.length, landmarks: baked.landmarks.length }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) await main()
