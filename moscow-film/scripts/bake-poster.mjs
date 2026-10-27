#!/usr/bin/env node
// Bakes a real city into poster.json for the city map poster. Zero dependencies (Node 22 fetch).
//
//   node scripts/bake-poster.mjs --center "lat,lon" --out src/city/poster.json [--radius 3000]
//        [--title "Paris"] [--subtitle "France"] [--mark "lat,lon,Label"]... [--paths] [--english]
//        [--kinds map,skyline,food,landmark] [--skyline-from south|north|east|west] [--landmark "Name"]...
//        [--overpass URL]
//
// Overpass queries (OpenStreetMap) for a square of 2 × radius around the centre: one for the map (roads by
// class, railways, water areas, rivers and canals, coastline and parks); for the skyline and food posters one per
// tile of about 1.2 km (building bounds with heights, places to eat and drink); one per landmark (its outline
// and the buildings around it). Please respect the service's usage policy: one bake at a time; every answer is
// cached next to the output, so a failed bake resumes. Set CITY_POSTER_USER_AGENT="name/1.0 (contact)".
// Map data © OpenStreetMap contributors (ODbL). The baked file is a derived database: share it under the ODbL.
//
// Exit codes: 0 written, 1 the service failed, 2 invalid input.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { msg, resolveLang } from './lib/i18n.mjs'
import { bakeFood, bakeLandmark, bakeSkyline, VIEWS } from './lib/kinds.mjs'

const R = 6371008.8
// Road classes, drawn from thin to thick.
export const ROAD = {
  motorway: 'major', trunk: 'major', primary: 'major', motorway_link: 'major', trunk_link: 'major', primary_link: 'major',
  secondary: 'mid', tertiary: 'mid', secondary_link: 'mid', tertiary_link: 'mid',
  residential: 'minor', unclassified: 'minor', living_street: 'minor', pedestrian: 'minor', road: 'minor',
  footway: 'path', path: 'path', cycleway: 'path', steps: 'path', track: 'path', bridleway: 'path',
}
export const CLASSES = ['path', 'minor', 'mid', 'major']
const PARK = { leisure: ['park', 'garden', 'golf_course', 'pitch', 'nature_reserve'], landuse: ['grass', 'forest', 'recreation_ground', 'cemetery', 'meadow', 'village_green'], natural: ['wood', 'scrub', 'grassland', 'heath'] }

// ── Pure helpers (exported for tests) ──────────────────────────────────────────────────────────────
/** Metres east and north of the centre (equirectangular around it). */
export function projector([lat0, lon0]) {
  const ky = (Math.PI / 180) * R
  const kx = ky * Math.cos((lat0 * Math.PI) / 180)
  return { fwd: (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky], inv: (x, y) => [lat0 + y / ky, lon0 + x / kx] }
}
/** Douglas–Peucker simplification of an open polyline. */
export function simplify(pts, tol = 1) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let best = -1, bd = 0
    const [ax, ay] = pts[a], [bx, by] = pts[b]
    const L = Math.hypot(bx - ax, by - ay)
    for (let i = a + 1; i < b; i++) {
      const d = L < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L
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
  return pts.filter((_, i) => keep[i])
}
/** Splits a polyline into the pieces inside the square |x|, |y| ≤ h (Liang–Barsky per segment). */
export function clipLine(pts, h) {
  const out = []
  let cur = null
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    const dx = x1 - x0, dy = y1 - y0
    let t0 = 0, t1 = 1, ok = true
    for (const [p, q] of [[-dx, x0 + h], [dx, h - x0], [-dy, y0 + h], [dy, h - y0]]) {
      if (p === 0) {
        if (q < 0) ok = false
      } else {
        const r = q / p
        if (p < 0) t0 = Math.max(t0, r)
        else t1 = Math.min(t1, r)
      }
    }
    if (!ok || t0 > t1) {
      cur = null
      continue
    }
    const a = [x0 + dx * t0, y0 + dy * t0], b = [x0 + dx * t1, y0 + dy * t1]
    if (!cur || t0 > 0) {
      cur = [a]
      out.push(cur)
    }
    cur.push(b)
    if (t1 < 1) cur = null
  }
  return out.filter((p) => p.length > 1)
}
/** Flat delta encoding of a polyline in whole metres: [x0, y0, dx1, dy1, …]. */
export function encodeLine(pts) {
  const flat = []
  let px = 0, py = 0
  for (const [x, y] of pts) {
    const ix = Math.round(x), iy = Math.round(y)
    if (flat.length && ix === px && iy === py) continue
    flat.push(flat.length ? ix - px : ix, flat.length ? iy - py : iy)
    px = ix
    py = iy
  }
  return flat
}
export function decodeLine(flat) {
  const pts = []
  let x = 0, y = 0
  for (let i = 0; i < flat.length; i += 2) {
    x = i ? x + flat[i] : flat[i]
    y = i ? y + flat[i + 1] : flat[i + 1]
    pts.push([x, y])
  }
  return pts
}
/** Joins open ways that share end points into longer chains (for multipolygon rings and coastlines). */
export function joinWays(ways) {
  const key = ([x, y]) => `${Math.round(x * 10)},${Math.round(y * 10)}`
  const left = ways.map((w) => w.slice())
  const rings = []
  while (left.length) {
    let chain = left.pop()
    let grew = true
    while (grew && key(chain[0]) !== key(chain.at(-1))) {
      grew = false
      for (let i = 0; i < left.length; i++) {
        const w = left[i]
        if (key(w[0]) === key(chain.at(-1))) chain = chain.concat(w.slice(1))
        else if (key(w.at(-1)) === key(chain.at(-1))) chain = chain.concat(w.slice(0, -1).reverse())
        else if (key(w.at(-1)) === key(chain[0])) chain = w.slice(0, -1).concat(chain)
        else if (key(w[0]) === key(chain[0])) chain = w.slice(1).reverse().concat(chain)
        else continue
        left.splice(i, 1)
        grew = true
        break
      }
    }
    rings.push(chain)
  }
  return rings
}
/**
 * Sea mask from coastline ways: water lies to the right of a coastline. Coastline cells are marked, the rest is
 * split into connected regions, and each region takes the side of the coastline segment nearest to one of its
 * cells. Returns a Uint8Array (1 = sea) of n × n cells covering |x|, |y| ≤ h, or null without a coastline.
 */
export function seaMask(coast, h, n) {
  if (!coast.length) return null
  const cell = (2 * h) / n
  const mask = new Uint8Array(n * n)
  const segs = []
  for (const c of coast) for (let i = 1; i < c.length; i++) segs.push([c[i - 1], c[i]])
  const wall = new Uint8Array(n * n)
  for (const [[ax, ay], [bx, by]] of segs) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.5)) + 1
    for (let k = 0; k <= steps; k++) {
      const x = ax + ((bx - ax) * k) / steps, y = ay + ((by - ay) * k) / steps
      const c = Math.floor((x + h) / cell), r = Math.floor((y + h) / cell)
      if (c >= 0 && r >= 0 && c < n && r < n) wall[r * n + c] = 1
    }
  }
  const side = (x, y) => {
    let best = Infinity, s = 0
    for (const [[ax, ay], [bx, by]] of segs) {
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
      const d = (ax + k * dx - x) ** 2 + (ay + k * dy - y) ** 2
      if (d < best) {
        best = d
        s = (x - ax) * dy - (y - ay) * dx
      }
    }
    return s > 0 ? 1 : 0
  }
  const seen = new Uint8Array(n * n)
  const stack = []
  for (let start = 0; start < n * n; start++) {
    if (seen[start] || wall[start]) continue
    const region = []
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()
      region.push(i)
      const r = (i / n) | 0, c = i % n
      for (const j of [c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1, r > 0 ? i - n : -1, r < n - 1 ? i + n : -1]) {
        if (j >= 0 && !seen[j] && !wall[j]) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    const probe = region[0]
    const v = side(((probe % n) + 0.5) * cell - h, (((probe / n) | 0) + 0.5) * cell - h)
    if (v) for (const i of region) mask[i] = 1
  }
  // Coastline cells take the side of their own centre.
  for (let i = 0; i < n * n; i++) if (wall[i]) mask[i] = side(((i % n) + 0.5) * cell - h, (((i / n) | 0) + 0.5) * cell - h)
  return mask
}
/** Run-length encoding (count ≤ 255, value) → base64. */
export function encodeMask(mask) {
  const out = []
  for (let i = 0; i < mask.length;) {
    let k = 1
    while (k < 255 && i + k < mask.length && mask[i + k] === mask[i]) k++
    out.push(k, mask[i])
    i += k
  }
  return Buffer.from(out).toString('base64')
}

/** Turns an Overpass answer into the poster record. */
export function bakeFrom({ osm, center, radius, title, subtitle, marks = [], paths = false, maskCells = 400, features = null, landmarks = [], from = 'south', english = false }) {
  const P = projector(center)
  const h = radius
  const ringOf = (geom) => geom.map((g) => P.fwd(g.lat, g.lon))
  const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry)
  const rels = osm.elements.filter((e) => e.type === 'relation' && e.members)
  const roads = { path: [], minor: [], mid: [], major: [] }
  const rail = [], rivers = [], water = [], parks = []
  const inBox = (ring) => ring.some(([x, y]) => Math.abs(x) <= h * 1.2 && Math.abs(y) <= h * 1.2)
  const polygon = (rings) => rings.filter((r) => r.length > 3 && inBox(r)).map((r) => encodeLine(simplify(r, 1.5)))
  const relRings = (rel) => {
    const outer = joinWays(rel.members.filter((m) => m.role !== 'inner' && m.geometry).map((m) => ringOf(m.geometry)))
    const inner = joinWays(rel.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => ringOf(m.geometry)))
    return [...outer, ...inner]
  }
  const isPark = (t) => PARK.leisure.includes(t.leisure) || PARK.landuse.includes(t.landuse) || PARK.natural.includes(t.natural)
  const isWater = (t) => t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin'
  for (const w of ways) {
    const t = w.tags ?? {}
    const cls = ROAD[t.highway]
    const tunnel = t.tunnel && t.tunnel !== 'no'
    if (cls && t.area !== 'yes' && !tunnel && (cls !== 'path' || paths)) {
      for (const piece of clipLine(simplify(ringOf(w.geometry), 1.2), h)) {
        const enc = encodeLine(piece)
        if (enc.length >= 4) roads[cls].push(enc)
      }
    } else if (['rail', 'light_rail', 'subway', 'tram', 'narrow_gauge'].includes(t.railway) && !tunnel && t.railway !== 'subway') {
      for (const piece of clipLine(simplify(ringOf(w.geometry), 1.2), h)) rail.push(encodeLine(piece))
    } else if (['river', 'canal'].includes(t.waterway) && !tunnel) {
      for (const piece of clipLine(simplify(ringOf(w.geometry), 1.5), h)) rivers.push({ w: t.waterway === 'river' ? 12 : 6, pts: encodeLine(piece) })
    }
    if (isWater(t)) water.push(...polygon([ringOf(w.geometry)]).map((r) => [r]))
    else if (isPark(t)) parks.push(...polygon([ringOf(w.geometry)]).map((r) => [r]))
  }
  for (const r of rels) {
    const t = r.tags ?? {}
    if (t.type !== 'multipolygon' && t.type !== undefined) continue
    if (isWater(t)) {
      const p = polygon(relRings(r))
      if (p.length) water.push(p)
    } else if (isPark(t)) {
      const p = polygon(relRings(r))
      if (p.length) parks.push(p)
    }
  }
  const coast = joinWays(ways.filter((w) => w.tags?.natural === 'coastline').map((w) => ringOf(w.geometry)))
  const mask = seaMask(coast, h, maskCells)
  const markList = marks.map(({ lat, lon, label }) => {
    const [x, y] = P.fwd(lat, lon)
    return { label: String(label).normalize('NFC').replace(/\s+/g, ' ').trim(), x: Math.round(x), y: Math.round(y) }
  }).filter((m) => Math.abs(m.x) <= h && Math.abs(m.y) <= h)
  return {
    schema: 'city-poster/1',
    title: String(title || 'City').trim(),
    subtitle: String(subtitle || '').trim(),
    center: [Math.round(center[0] * 1e5) / 1e5, Math.round(center[1] * 1e5) / 1e5],
    radius: Math.round(h),
    roads,
    rail: rail.filter((l) => l.length >= 4),
    rivers: rivers.filter((l) => l.pts.length >= 4),
    water,
    parks,
    sea: mask ? { n: maskCells, rle: encodeMask(mask) } : null,
    marks: markList,
    ...(features ? { skyline: bakeSkyline(features, P, h, from, english), food: bakeFood(features, P, h) } : {}),
    ...(landmarks.length ? { landmarks: landmarks.map(({ name, answer }) => bakeLandmark(answer, P, name, english)).filter(Boolean) } : {}),
    credits: 'Map data © OpenStreetMap contributors (ODbL)',
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────
const UA = process.env.CITY_POSTER_USER_AGENT || 'sandbase-city-map-poster/0.1 (poster bake)'
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
  const center = String(opt('center') ?? '').split(',').map(Number)
  const out = opt('out')
  const radius = Number(opt('radius') ?? 3000)
  if (center.length !== 2 || center.some((v) => !Number.isFinite(v)) || Math.abs(center[0]) > 85 || Math.abs(center[1]) > 180 || !out) fail('bakeUsage')
  if (!(radius >= 500 && radius <= 6000)) fail('bakeRadius', { radius: opt('radius') })
  const marks = []
  for (const m of all('mark')) {
    const [lat, lon, ...rest] = String(m).split(',')
    const label = rest.join(',').trim()
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || !label) fail('bakeMark', { mark: m })
    marks.push({ lat: Number(lat), lon: Number(lon), label })
  }
  if (marks.length > 5) fail('bakeMarks')
  const P = projector(center)
  const [s, w] = P.inv(-radius * 1.05, -radius * 1.05)
  const [n, e] = P.inv(radius * 1.05, radius * 1.05)
  const b = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`
  const paths = argv.includes('--paths')
  const roadRe = paths ? Object.keys(ROAD).join('|') : Object.keys(ROAD).filter((k) => ROAD[k] !== 'path').join('|')
  const q = `[out:json][timeout:240][bbox:${b}];(way[highway~"^(${roadRe})$"];way[railway~"^(rail|light_rail|tram|narrow_gauge)$"];way[waterway~"^(river|canal|riverbank)$"];way[natural=water];relation[natural=water];way[landuse~"^(reservoir|basin|grass|forest|recreation_ground|cemetery|meadow|village_green)$"];relation[landuse~"^(forest|grass|cemetery|recreation_ground)$"];way[leisure~"^(park|garden|golf_course|pitch|nature_reserve)$"];relation[leisure~"^(park|garden|nature_reserve)$"];way[natural~"^(wood|scrub|grassland|heath)$"];relation[natural~"^(wood|water)$"];);out geom;way[natural=coastline](${(s - 0.05).toFixed(5)},${(w - 0.05).toFixed(5)},${(n + 0.05).toFixed(5)},${(e + 0.05).toFixed(5)});out geom;`
  const file = resolve(out)
  const cacheDir = `${file}.cache`
  mkdirSync(cacheDir, { recursive: true })
  const hosts = opt('overpass') ? [opt('overpass')] : ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter']
  const key = createHash('sha256').update(q).digest('hex').slice(0, 24)
  const cached = join(cacheDir, `${key}.json`)
  let osm = existsSync(cached) ? JSON.parse(readFileSync(cached, 'utf8')) : null
  if (!osm) console.log(msg(lang, 'bakeOsm'))
  for (let attempt = 0; !osm && attempt < hosts.length * 2; attempt++) {
    try {
      const res = await fetch(hosts[attempt % hosts.length], { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(300000) })
      const text = await res.text()
      if (!res.ok || !text.trimStart().startsWith('{')) throw new Error(`Overpass HTTP ${res.status}`)
      const j = JSON.parse(text)
      if (!j.elements?.some((x) => x.tags?.highway)) throw new Error('Overpass returned an answer without roads')
      writeFileSync(cached, text)
      osm = j
    } catch (err) {
      console.error(`  ${err.message}`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  if (!osm) {
    console.error(msg(lang, 'bakeService', { error: 'no answer with roads' }))
    process.exit(1)
  }
  const kinds = String(opt('kinds') ?? 'map,skyline,food,landmark').split(',').map((k) => k.trim())
  const from = opt('skyline-from') ?? 'south'
  if (!VIEWS.includes(from) || kinds.some((k) => !['map', 'skyline', 'food', 'landmark'].includes(k))) fail('bakeUsage')
  const names = all('landmark')
  if (names.length > 4) fail('bakeLandmarks')
  const english = argv.includes('--english')
  /** One Overpass answer, cached by query; retried across servers. */
  async function overpass(query, need) {
    const k = createHash('sha256').update(query).digest('hex').slice(0, 24)
    const f = join(cacheDir, `${k}.json`)
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
    for (let attempt = 0; attempt < hosts.length * 2; attempt++) {
      try {
        const res = await fetch(hosts[attempt % hosts.length], { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(300000) })
        const text = await res.text()
        if (!res.ok || !text.trimStart().startsWith('{')) throw new Error(`Overpass HTTP ${res.status}`)
        const j = JSON.parse(text)
        if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) throw new Error(`Overpass: ${j.remark.slice(0, 120)}`)
        if (need && !need(j)) throw new Error('Overpass returned an empty answer')
        writeFileSync(f, text)
        return j
      } catch (err) {
        console.error(`  ${err.message}`)
        await new Promise((r) => setTimeout(r, 4000))
      }
    }
    console.error(msg(lang, 'bakeService', { error: 'no usable answer' }))
    process.exit(1)
  }
  let features = null
  if (kinds.includes('skyline') || kinds.includes('food')) {
    const tiles = Math.max(1, Math.ceil((2 * radius * 1.05) / 1200))
    console.log(msg(lang, 'bakeTiles', { tiles: tiles * tiles }))
    features = []
    const seen = new Set()
    for (let r = 0; r < tiles; r++) for (let c = 0; c < tiles; c++) {
      const ts = s + ((n - s) * r) / tiles, tn = s + ((n - s) * (r + 1)) / tiles
      const tw = w + ((e - w) * c) / tiles, te = w + ((e - w) * (c + 1)) / tiles
      const tb = `${ts.toFixed(5)},${tw.toFixed(5)},${tn.toFixed(5)},${te.toFixed(5)}`
      const fq = `[out:json][timeout:240][bbox:${tb}];(way[building];way["building:part"];way[man_made~"^(tower|mast)$"];relation[building];);out tags bb qt;(nwr[amenity~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|marketplace|biergarten)$"];nwr[shop~"^(bakery|pastry|confectionery|chocolate|cheese|butcher|deli|greengrocer|seafood|wine|coffee|tea)$"];);out center tags qt;`
      const j = await overpass(fq, null)
      for (const el of j.elements) {
        const id = `${el.type}${el.id}`
        if (seen.has(id)) continue
        seen.add(id)
        features.push(el)
      }
      console.log(msg(lang, 'bakeTile', { done: r * tiles + c + 1, total: tiles * tiles }))
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  const landmarks = []
  if (kinds.includes('landmark')) for (const name of names) {
    // Exact tag matches use the name index; the neighbours come from a second query in a small box around the
    // match (an `around` filter over a dense centre times out on the public servers).
    const q1 = JSON.stringify(name)
    const found = await overpass(`[out:json][timeout:120][bbox:${b}];(way["name"=${q1}];relation["name"=${q1}];way["name:en"=${q1}];relation["name:en"=${q1}];);out geom;`, null)
    const pts = found.elements.flatMap((el) => el.geometry ?? el.members?.flatMap((m) => m.geometry ?? []) ?? [])
    let answer = found
    if (pts.length) {
      const lat0 = Math.min(...pts.map((p) => p.lat)), lat1 = Math.max(...pts.map((p) => p.lat))
      const lon0 = Math.min(...pts.map((p) => p.lon)), lon1 = Math.max(...pts.map((p) => p.lon))
      const dl = 330 / 111195, dn = dl / Math.cos((lat0 * Math.PI) / 180)
      const nb = `${(lat0 - dl).toFixed(5)},${(lon0 - dn).toFixed(5)},${(lat1 + dl).toFixed(5)},${(lon1 + dn).toFixed(5)}`
      const around = await overpass(`[out:json][timeout:120][bbox:${nb}];(way["building"];way["building:part"];);out geom;`, null)
      answer = { elements: [...found.elements, ...around.elements.filter((el) => !found.elements.some((f) => f.type === el.type && f.id === el.id))] }
    }
    landmarks.push({ name, answer })
  }
  const baked = bakeFrom({ osm, center, radius, title: opt('title'), subtitle: opt('subtitle'), marks, paths, features, landmarks, from, english })
  if (!kinds.includes('map')) Object.assign(baked, { roads: { path: [], minor: [], mid: [], major: [] } })
  for (const name of names) if (!baked.landmarks?.some((l) => l.query === name)) console.error(msg(lang, 'bakeLandmarkMissing', { name }))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(baked)}\n`)
  const count = CLASSES.reduce((a, c) => a + baked.roads[c].length, 0)
  console.log(msg(lang, 'bakeWrote', { file: out, roads: count, water: baked.water.length + baked.rivers.length, parks: baked.parks.length, kb: Math.round(JSON.stringify(baked).length / 1024) }))
  if (baked.skyline) console.log(msg(lang, 'bakeWroteKinds', { mapped: baked.skyline.mapped, buildings: baked.skyline.buildings, food: baked.food.total, landmarks: baked.landmarks?.length ?? 0 }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) await main()
