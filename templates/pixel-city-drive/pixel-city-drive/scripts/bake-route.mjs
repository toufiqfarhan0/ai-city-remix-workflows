#!/usr/bin/env node
// Bakes a real drive into route.json for the pixel city drive page. Zero dependencies (Node 22 fetch).
//
//   node scripts/bake-route.mjs --from "38.7036,-9.1757" --to "38.6929,-9.2142" [--via "lat,lon"]...
//        --out src/route.json [--title "Riverside Run"] [--english] [--drive right|left]
//        [--pin "landmark name"]... [--corridor 150] [--landmark-radius 650] [--osrm URL] [--overpass URL]
//
// Services (please respect their usage policies; one request at a time, every answer cached in <out>.cache/):
//   OSRM (car profile)   the route and the street name of every step
//   Overpass API (OSM)   buildings, water, parks, overhead bridges, districts and named landmarks near the route
// Set PIXEL_CITY_USER_AGENT="name/1.0 (contact)" so the services know who is asking.
// Map data © OpenStreetMap contributors (ODbL). The baked file is a derived database: share it under the ODbL.
//
// Exit codes: 0 written, 1 a service failed or no route, 2 invalid input.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { msg, resolveLang } from './lib/i18n.mjs'

export const STEP = 5 // metres between route samples
export const LAND_STEP = 10 // metres between land samples
const R = 6371008.8

// ── Pure geometry (exported for tests) ──────────────────────────────────────────────────────────────
/** Equirectangular projection around an origin, in metres (x east, y north). */
export function projector([lat0, lon0]) {
  const kx = (Math.PI / 180) * R * Math.cos((lat0 * Math.PI) / 180)
  const ky = (Math.PI / 180) * R
  return { fwd: (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky], inv: (x, y) => [y / ky + lat0, x / kx + lon0] }
}
/** Resamples a polyline (array of [x, y]) every `step` metres. Returns { pts, length }. */
export function resample(line, step = STEP) {
  const pts = [line[0]]
  let carry = 0
  let length = 0
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]
    const [bx, by] = line[i]
    const seg = Math.hypot(bx - ax, by - ay)
    if (seg === 0) continue
    let at = step - carry
    while (at <= seg) {
      const k = at / seg
      pts.push([ax + (bx - ax) * k, ay + (by - ay) * k])
      at += step
    }
    carry = seg - (at - step)
    length += seg
  }
  const last = line[line.length - 1]
  if (carry > 0.5) pts.push(last)
  return { pts, length }
}
/** Spatial index over route samples: nearest (s, d) for a point; d > 0 is to the right of travel. */
export function locator(pts, step = STEP, cell = 60) {
  const grid = new Map()
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`
  pts.forEach(([x, y], i) => {
    const k = key(x, y)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(i)
  })
  return function locate(x, y, reach = 2) {
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    let best = -1
    let bestD = Infinity
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        for (const n of grid.get(`${cx + i},${cy + j}`) ?? []) {
          const d = (pts[n][0] - x) ** 2 + (pts[n][1] - y) ** 2
          if (d < bestD) {
            bestD = d
            best = n
          }
        }
      }
    }
    if (best < 0) return null
    const a = pts[Math.max(0, best - 1)]
    const b = pts[Math.min(pts.length - 1, best + 1)]
    const hx = b[0] - a[0]
    const hy = b[1] - a[1]
    const hl = Math.hypot(hx, hy) || 1
    const ux = hx / hl
    const uy = hy / hl
    const rx = x - pts[best][0]
    const ry = y - pts[best][1]
    const along = rx * ux + ry * uy
    const side = rx * uy - ry * ux // right of travel is positive
    return { s: best * step + along, d: side }
  }
}
/** Ray-casting point in polygon. */
export function inside(x, y, ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) hit = !hit
  }
  return hit
}
function segHit(a, b, c, d) {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
  if (Math.abs(den) < 1e-9) return null
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

// Building kinds the renderer draws differently, and their default heights in metres.
export const KINDS = ['house', 'terrace', 'apartments', 'office', 'shop', 'civic', 'church', 'industrial', 'warehouse', 'tower']
const KIND_H = { house: 7, terrace: 11, apartments: 16, office: 22, shop: 9, civic: 15, church: 18, industrial: 9, warehouse: 10, tower: 45 }
export function kindOf(tags) {
  const b = tags.building ?? 'yes'
  const levels = Number.parseFloat(tags['building:levels'])
  if (['church', 'cathedral', 'chapel', 'mosque', 'temple', 'synagogue', 'monastery'].includes(b) || tags.amenity === 'place_of_worship') return 'church'
  if (['house', 'detached', 'semidetached_house', 'bungalow', 'residential_house'].includes(b)) return 'house'
  if (b === 'terrace') return 'terrace'
  if (['apartments', 'residential', 'dormitory', 'hotel'].includes(b)) return levels >= 14 ? 'tower' : 'apartments'
  if (['office', 'commercial'].includes(b)) return levels >= 14 ? 'tower' : 'office'
  if (['retail', 'supermarket', 'kiosk', 'shop'].includes(b) || tags.shop) return 'shop'
  if (['civic', 'public', 'government', 'school', 'university', 'hospital', 'museum', 'train_station', 'transportation', 'college'].includes(b) || tags.tourism === 'museum') return 'civic'
  if (['industrial', 'factory', 'manufacture', 'hangar'].includes(b)) return 'industrial'
  if (['warehouse', 'garage', 'garages', 'shed', 'roof', 'storage_tank', 'service'].includes(b)) return 'warehouse'
  if (levels >= 14) return 'tower'
  if (levels >= 5) return 'apartments'
  return 'terrace'
}
export function heightOf(tags, kind) {
  const h = Number.parseFloat(String(tags.height ?? '').replace(/[^\d.]/g, ''))
  if (h > 1 && h < 700) return h
  const levels = Number.parseFloat(tags['building:levels'])
  if (levels > 0 && levels < 200) return levels * 3.2 + (kind === 'shop' ? 1 : 0.6)
  return KIND_H[kind]
}
const SMALL_MEMORIAL = /plaque|bust|statue|inscription|stele|stone|sculpture|tile|graffiti|mural/
/** What a named feature draws as on the skyline, or null for things too small to see from the road. */
export function landmarkKind(tags) {
  const n = String(tags.name ?? '')
  if (tags.amenity === 'fountain' || tags.man_made === 'water_tap' || tags.historic === 'fountain' || tags.tourism === 'artwork') return null
  if (['memorial', 'monument'].includes(tags.historic) && SMALL_MEMORIAL.test(tags.memorial ?? 'plaque') && tags.building !== 'yes') return null
  if (tags.man_made === 'lighthouse' || /\b(farol|lighthouse|phare|faro)\b/i.test(n)) return 'lighthouse'
  if (/\b(torre|tower|turm|toren)\b/i.test(n) || tags.man_made === 'tower' || tags.historic === 'tower') return 'tower'
  if (/\b(mosteiro|monastery|convento|convent|igreja|church|cathedral|catedral|basilica|abbey|chapel|capela)\b/i.test(n) || ['church', 'cathedral', 'chapel', 'monastery'].includes(tags.building) || ['monastery', 'church'].includes(tags.historic) || tags.amenity === 'place_of_worship') return 'church'
  if (['castle', 'fort', 'citywalls'].includes(tags.historic) && /\b(forte?|fort|castle|castelo|bastion|baluarte)\b/i.test(n)) return 'fort'
  if (/\b(pal[aá]cio|palace|palais|palazzo)\b/i.test(n)) return 'palace'
  if (['monument', 'memorial'].includes(tags.historic)) return 'monument'
  if (tags.tourism === 'museum' || tags.building === 'museum') return 'museum'
  if (tags.historic === 'castle') return 'palace'
  if (tags.tourism === 'attraction' && tags.building) return 'monument'
  return null
}
/** A feature's centre: Overpass "center", a node position, or the mean of a way's geometry. */
export function centerOf(e) {
  if (e.center) return e.center
  if (e.lat !== undefined) return { lat: e.lat, lon: e.lon }
  const g = e.geometry ?? e.members?.flatMap((m) => m.geometry ?? [])
  if (!g?.length) return null
  return { lat: g.reduce((a, p) => a + p.lat, 0) / g.length, lon: g.reduce((a, p) => a + p.lon, 0) / g.length }
}
const ascii = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim()

// ── Services ─────────────────────────────────────────────────────────────────────────────────────
const UA = process.env.PIXEL_CITY_USER_AGENT || 'sandbase-pixel-city-drive/0.1 (route bake)'
async function polite(url, { cacheDir, body, label, accept = () => true }) {
  const key = createHash('sha256').update(body ? body : url).digest('hex').slice(0, 24)
  const file = join(cacheDir, `${key}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  let last
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 3000))
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'user-agent': UA, accept: 'application/json', ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
        body,
        signal: AbortSignal.timeout(240000),
      })
      const text = await res.text()
      if (!res.ok || !text.trimStart().startsWith('{')) throw new Error(`${label} HTTP ${res.status}`)
      if (!accept(JSON.parse(text))) throw new Error(`${label} returned an empty answer`)
      writeFileSync(file, text)
      await new Promise((r) => setTimeout(r, 1500))
      return JSON.parse(text)
    } catch (e) {
      last = e
    }
  }
  throw last
}
function parsePoint(text) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(text ?? ''))
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null
}

// ── Bake ─────────────────────────────────────────────────────────────────────────────────────────
export function bakeFrom({ osrm, osm, waypoints, title, english, drive, corridor, landmarkRadius, pins = [] }) {
  const route = osrm.routes?.[0]
  if (!route) throw Object.assign(new Error('no route'), { code: 'noRoute' })
  const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  const mid = coords[Math.floor(coords.length / 2)]
  const P = projector(mid)
  const line = coords.map(([lat, lon]) => P.fwd(lat, lon))
  const { pts, length } = resample(line)
  const locate = locator(pts)
  const name = (t) => ascii((english && t['name:en']) || t.name || '')

  // Street names: each OSRM step starts where the previous ones end.
  const streets = []
  let at = 0
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const n = ascii(step.name || step.ref || '')
      if (n && streets.at(-1)?.[1] !== n) streets.push([Math.round(at), n])
      at += step.distance
    }
  }
  const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry)
  const rel = osm.elements.filter((e) => e.type === 'relation' && e.members)
  const ringOf = (geom) => geom.map((g) => P.fwd(g.lat, g.lon))

  // Buildings that face the road: their near edge, span along the road and height.
  const fronts = []
  const bins = { [-1]: new Map(), [1]: new Map() }
  const cand = []
  const addBuilding = (tags, ring) => {
    let s0 = Infinity, s1 = -Infinity, dn = Infinity, df = 0, sideSum = 0, n = 0
    for (const [x, y] of ring) {
      const l = locate(x, y, 3)
      if (!l) continue
      s0 = Math.min(s0, l.s)
      s1 = Math.max(s1, l.s)
      dn = Math.min(dn, Math.abs(l.d))
      df = Math.max(df, Math.abs(l.d))
      sideSum += Math.sign(l.d)
      n++
    }
    if (!n || dn > corridor || s1 < 0 || s0 > length) return
    // A footprint that maps onto more road than its own size lies by a bend or a loop of the route; skip it.
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity
    for (const [x, y] of ring) {
      bx0 = Math.min(bx0, x)
      bx1 = Math.max(bx1, x)
      by0 = Math.min(by0, y)
      by1 = Math.max(by1, y)
    }
    if (s1 - s0 > Math.hypot(bx1 - bx0, by1 - by0) * 1.3 + 15) return
    if (Math.abs(sideSum) < n * 0.6) return // straddles the road (an overpass or a mapping error)
    const kind = kindOf(tags)
    const h = heightOf(tags, kind)
    const side = sideSum > 0 ? 1 : -1
    if (dn < 4) dn = 4
    s0 = Math.max(0, s0)
    s1 = Math.min(length, s1)
    if (s1 - s0 < 3) return
    cand.push({ s0, s1, side, d: dn, depth: Math.max(4, Math.min(60, df - dn)), h, kind, colour: ascii(tags['building:colour'] || ''), name: tags.name ? name(tags) : '' })
  }
  for (const w of ways) if (w.tags?.building) addBuilding(w.tags, ringOf(w.geometry))
  for (const r of rel) if (r.tags?.building) for (const m of r.members) if (m.role === 'outer' && m.geometry) addBuilding(r.tags, ringOf(m.geometry))
  // Keep the street wall (nearest buildings per 5 m bin) and tall buildings further back for the skyline.
  for (const b of cand) {
    for (let s = Math.floor(b.s0 / STEP); s <= Math.floor(b.s1 / STEP); s++) {
      const m = bins[b.side]
      m.set(s, Math.min(m.get(s) ?? Infinity, b.d))
    }
  }
  for (const b of cand) {
    let front = false
    for (let s = Math.floor(b.s0 / STEP); s <= Math.floor(b.s1 / STEP) && !front; s++) if (b.d <= bins[b.side].get(s) + 22) front = true
    if (front || b.h >= 30) fronts.push(b)
  }
  fronts.sort((a, b) => a.s0 - b.s0 || a.side - b.side || a.d - b.d)

  // Land on each side every 10 m: w water, p park/green, - anything else; f (or q beside a park) open water
  // further out behind the street wall.
  const water = []
  const green = []
  const coast = []
  const polyOf = (e) => (e.type === 'way' ? [ringOf(e.geometry)] : e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => ringOf(m.geometry)))
  for (const e of [...ways, ...rel]) {
    const t = e.tags ?? {}
    if (t.natural === 'coastline' && e.type === 'way') coast.push(ringOf(e.geometry))
    else if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'basin' || t.landuse === 'reservoir') water.push(...polyOf(e))
    else if (['park', 'garden', 'golf_course', 'pitch'].includes(t.leisure) || ['grass', 'forest', 'meadow', 'recreation_ground', 'village_green', 'cemetery'].includes(t.landuse) || ['wood', 'scrub', 'grassland'].includes(t.natural)) green.push(...polyOf(e))
  }
  const coastWater = (x, y) => {
    // Water lies to the right of a coastline way; use the nearest coastline segment within 400 m.
    let best = Infinity, sideOf = 0
    for (const c of coast) {
      for (let i = 1; i < c.length; i++) {
        const [ax, ay] = c[i - 1], [bx, by] = c[i]
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
        const d = (ax + k * dx - x) ** 2 + (ay + k * dy - y) ** 2
        if (d < best) {
          best = d
          sideOf = (x - ax) * dy - (y - ay) * dx
        }
      }
    }
    return best < 400 * 400 && sideOf > 0
  }
  const land = { left: '', right: '' }
  for (let s = 0; s <= length; s += LAND_STEP) {
    const i = Math.min(pts.length - 2, Math.floor(s / STEP))
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const hl = Math.hypot(bx - ax, by - ay) || 1
    const ux = (bx - ax) / hl, uy = (by - ay) / hl
    for (const [key, sg] of [['left', -1], ['right', 1]]) {
      let c = '-'
      for (const dd of [28, 60]) {
        const x = ax + uy * dd * sg, y = ay - ux * dd * sg
        if (water.some((r) => inside(x, y, r)) || coastWater(x, y)) {
          c = 'w'
          break
        }
        if (c === '-' && green.some((r) => inside(x, y, r))) c = 'p'
      }
      if (c !== 'w') {
        // Open water further out (a river or the sea behind the street wall) shows on the horizon.
        const x = ax + uy * 170 * sg, y = ay - ux * 170 * sg
        if (water.some((r) => inside(x, y, r)) || coastWater(x, y)) c = c === 'p' ? 'q' : 'f'
      }
      land[key] += c
    }
  }

  // Overhead bridges: a bridge way (road or rail, layer ≥ 1) that crosses the route.
  const bridges = []
  for (const w of ways) {
    const t = w.tags ?? {}
    if (!t.bridge || t.bridge === 'no' || !(t.highway || t.railway)) continue
    if (Number.parseFloat(t.layer ?? '1') < 1) continue
    if (['steps', 'corridor', 'construction', 'proposed'].includes(t.highway)) continue
    const g = ringOf(w.geometry)
    for (let i = 1; i < g.length; i++) {
      for (let j = 1; j < pts.length; j++) {
        const k = segHit(pts[j - 1], pts[j], g[i - 1], g[i])
        if (k === null) continue
        const s = Math.round((j - 1 + k) * STEP)
        if (bridges.some((b) => Math.abs(b.s - s) < 40)) continue
        const here = streets.filter((st) => st[0] <= s).at(-1)?.[1]
        if (t.name && here && name(t) === here) continue // the road we are driving on
        const suspension = /suspension|cable/.test(t['bridge:structure'] ?? '') || /25 de Abril|Golden Gate/i.test(t.name ?? '')
        const foot = ['footway', 'path', 'cycleway', 'pedestrian'].includes(t.highway)
        bridges.push({ s, name: name(t), kind: t.railway ? 'rail' : foot ? 'foot' : 'road', h: suspension ? 70 : foot ? 5.5 : 7, structure: suspension ? 'suspension' : 'beam' })
      }
    }
  }
  bridges.sort((a, b) => a.s - b.s)

  // Named landmarks near the route, ranked by tag weight and nearness; --pin names always win.
  const pinned = (pins ?? []).map((p) => ascii(p).toLowerCase())
  const lms = []
  for (const e of osm.elements) {
    const t = e.tags ?? {}
    const kind = landmarkKind(t)
    const nm = name(t)
    if (!kind || !nm) continue
    const c = centerOf(e)
    if (!c) continue
    const [x, y] = P.fwd(c.lat, c.lon)
    const l = locate(x, y, 14)
    if (!l || Math.abs(l.d) > landmarkRadius || l.s < 30 || l.s > length - 10) continue
    const pin = pinned.some((p) => nm.toLowerCase().includes(p))
    const tall = Number.parseFloat(t.height) || 0
    const score = (pin ? 100 : 0) + (t.wikidata ? 3 : 0) + (t.heritage ? 2 : 0) + (t.tourism === 'attraction' ? 2 : 0) + (t.tourism === 'museum' ? 1 : 0) + (t.building && t.building !== 'no' ? 1 : 0) + (tall > 20 ? 2 : 0) + ({ tower: 2, lighthouse: 1, church: 1, monument: 1, fort: 1, palace: 0, museum: 0 }[kind] ?? 0) - Math.abs(l.d) / 250
    const h = tall > 8 ? tall : { tower: 34, lighthouse: 22, fort: 26, church: 36, monument: 30, museum: 20, palace: 22 }[kind]
    lms.push({ s: Math.round(l.s), d: Math.round(l.d), name: nm, kind, h: Math.round(h), wikidata: t.wikidata ?? null, score })
  }
  lms.sort((a, b) => b.score - a.score)
  const landmarks = []
  for (const l of lms) {
    if (landmarks.length >= 10) break
    if (landmarks.some((o) => o.name === l.name || (o.wikidata && o.wikidata === l.wikidata) || (Math.abs(o.s - l.s) < 160 && Math.sign(o.d) === Math.sign(l.d)))) continue
    landmarks.push(l)
  }
  landmarks.sort((a, b) => a.s - b.s)
  for (const l of landmarks) delete l.score

  // Districts for the HUD: the nearest named quarter within 900 m, announced where it is closest.
  const places = []
  for (const e of osm.elements) {
    const t = e.tags ?? {}
    if (e.type !== 'node' || !['suburb', 'quarter', 'neighbourhood'].includes(t.place) || !t.name) continue
    const [x, y] = P.fwd(e.lat, e.lon)
    const l = locate(x, y, 16)
    if (!l || Math.abs(l.d) > 900 || l.s < 0 || l.s > length) continue
    places.push([Math.round(l.s), name(t), Math.round(Math.abs(l.d))])
  }
  places.sort((a, b) => a[0] - b[0])
  const district = []
  for (const p of places) {
    const prev = district.at(-1)
    if (prev && p[0] - prev[0] < 350) {
      if (p[2] < prev[2]) district[district.length - 1] = p
      continue
    }
    if (!district.some((q) => q[1] === p[1])) district.push(p)
  }
  if (district.length && district[0][0] > 0) district[0] = [0, district[0][1], district[0][2]]

  const r1 = (v) => Math.round(v * 10) / 10
  return {
    schema: 'pixel-route/1',
    title: title || `${streets[0]?.[1] ?? 'Start'} to ${streets.at(-1)?.[1] ?? 'End'}`,
    drive,
    length: Math.round(length),
    step: STEP,
    origin: mid.map((v) => Math.round(v * 1e6) / 1e6),
    waypoints,
    path: pts.map(([x, y]) => [r1(x), r1(y)]),
    streets,
    districts: district.map(([s, n]) => [s, n]),
    land,
    fronts: fronts.map((b) => [Math.round(b.s0), Math.round(b.s1), b.side, r1(b.d), Math.round(b.depth), Math.round(b.h), KINDS.indexOf(b.kind), b.colour, b.name]),
    bridges,
    landmarks,
    osmBase: osm.osm3s?.timestamp_osm_base ?? null,
    credits: 'Map data © OpenStreetMap contributors (ODbL) · Routing: OSRM',
  }
}

/** The Overpass query for one piece of the route (a "lat,lon,lat,lon…" polyline). */
export function queryFor(line, corridor, landmarkRadius) {
  return `[out:json][timeout:180];(
way[building](around:${corridor},${line});relation[building](around:${corridor},${line});
way[natural=water](around:200,${line});relation[natural=water](around:200,${line});way[waterway=riverbank](around:200,${line});way[natural=coastline](around:420,${line});
way[leisure~"^(park|garden|pitch)$"](around:120,${line});way[landuse~"^(grass|forest|meadow|recreation_ground|cemetery)$"](around:120,${line});way[natural~"^(wood|scrub)$"](around:120,${line});
way[bridge][highway](around:40,${line});way[bridge][railway](around:40,${line});
node[place~"^(suburb|quarter|neighbourhood)$"](around:1500,${line});
);out geom;
(nwr[name][tourism~"^(attraction|museum)$"](around:${landmarkRadius},${line});nwr[name][historic~"^(monument|memorial|castle|fort|tower|monastery|church|building)$"](around:${landmarkRadius},${line});nwr[name][man_made~"^(tower|lighthouse)$"](around:${landmarkRadius},${line});nwr[name][building~"^(cathedral|church|monastery)$"](around:${landmarkRadius},${line}););out center tags;`
}

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
  const from = parsePoint(opt('from'))
  const to = parsePoint(opt('to'))
  const via = all('via').map(parsePoint)
  if (!from || !to || via.some((v) => !v) || !opt('out')) fail('bakeUsage')
  const out = resolve(opt('out'))
  const corridor = Number(opt('corridor') ?? 150)
  const landmarkRadius = Number(opt('landmark-radius') ?? 650)
  if (!(corridor >= 30 && corridor <= 400) || !(landmarkRadius >= 100 && landmarkRadius <= 2000)) fail('bakeUsage')
  const drive = opt('drive') === 'left' ? 'left' : 'right'
  const cacheDir = `${out}.cache`
  mkdirSync(cacheDir, { recursive: true })
  const waypoints = [from, ...via, to]
  try {
    console.log(msg(lang, 'bakeRoute'))
    const osrmBase = opt('osrm') ?? 'https://router.project-osrm.org'
    const osrm = await polite(`${osrmBase}/route/v1/driving/${waypoints.map(([a, b]) => `${b},${a}`).join(';')}?overview=full&geometries=geojson&steps=true`, { cacheDir, label: 'OSRM' })
    const route = osrm.routes?.[0]
    if (!route) {
      console.error(msg(lang, 'bakeNoRoute'))
      process.exit(1)
    }
    if (route.distance > 30000) fail('bakeTooLong', { km: (route.distance / 1000).toFixed(1) })
    console.log(msg(lang, 'bakeDistance', { km: (route.distance / 1000).toFixed(2) }))
    // A thinned polyline for Overpass "around" (one point every ~40 m).
    const coords = route.geometry.coordinates
    const thin = []
    let acc = Infinity
    for (let i = 0; i < coords.length; i++) {
      if (i > 0) acc += Math.hypot((coords[i][0] - coords[i - 1][0]) * 85000, (coords[i][1] - coords[i - 1][1]) * 111000)
      if (acc >= 40 || i === coords.length - 1) {
        thin.push(`${coords[i][1].toFixed(6)},${coords[i][0].toFixed(6)}`)
        acc = 0
      }
    }
    // Query the corridor in pieces of about 1.2 km: smaller answers, and an empty answer (some Overpass
    // replicas answer with no elements while they resync) is retried on the next server.
    const hosts = opt('overpass') ? [opt('overpass')] : ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter']
    const seen = new Set()
    const osm = { elements: [], osm3s: null }
    const pieces = []
    for (let i = 0; i < thin.length - 1; i += 30) pieces.push(thin.slice(i, Math.min(thin.length, i + 31)))
    console.log(msg(lang, 'bakeOsm'))
    for (const [n, piece] of pieces.entries()) {
      const line = piece.join(',')
      const q = queryFor(line, corridor, landmarkRadius)
      let got = null
      for (let attempt = 0; attempt < hosts.length * 3 && !got; attempt++) {
        const host = hosts[attempt % hosts.length]
        try {
          const r = await polite(host, { cacheDir, body: `data=${encodeURIComponent(q)}`, label: 'Overpass', accept: (j) => j.elements?.some((e) => e.tags?.building) })
          got = r
        } catch (e) {
          if (attempt === hosts.length * 3 - 1) throw e
        }
      }
      for (const e of got.elements) {
        const k = `${e.type}${e.id}`
        if (seen.has(k)) continue
        seen.add(k)
        osm.elements.push(e)
      }
      osm.osm3s = got.osm3s
      console.log(msg(lang, 'bakePiece', { n: n + 1, total: pieces.length, elements: got.elements.length }))
    }
    const baked = bakeFrom({ osrm, osm, waypoints, title: opt('title'), english: argv.includes('--english'), drive, corridor, landmarkRadius, pins: all('pin') })
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(baked)}\n`)
    console.log(msg(lang, 'bakeWrote', { file: opt('out'), fronts: baked.fronts.length, landmarks: baked.landmarks.length, bridges: baked.bridges.length }))
  } catch (e) {
    if (e.code === 'noRoute') {
      console.error(msg(lang, 'bakeNoRoute'))
      process.exit(1)
    }
    console.error(msg(lang, 'bakeService', { error: String(e.message ?? e) }))
    process.exit(1)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) await main()
export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
