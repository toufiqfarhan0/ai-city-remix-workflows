// Reads a Colouring Cities building_attributes.csv (Colouring London and its sister platforms)
// for one bounding box, streaming, and indexes it by OSM id and by point.
import { readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { basename, dirname } from 'node:path'

/** Minimal RFC 4180 line splitter (quotes, doubled quotes; no newlines inside fields in this data). */
function split(line) {
  const out = []; let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/** Streams the file line by line with a fixed buffer (the London extract is over 2 GB). */
function* lines(file) {
  const fd = openSync(file, 'r'), buf = Buffer.alloc(1 << 22)
  let rest = ''
  try {
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null)
      if (!n) break
      const text = rest + buf.toString('utf8', 0, n)
      const parts = text.split('\n'); rest = parts.pop()
      for (const p of parts) yield p.replace(/\r$/, '')
    }
    if (rest) yield rest
  } finally { closeSync(fd) }
}

export function readColouring(file, [S, W, N, E]) {
  const it = lines(file)
  const head = split(it.next().value)
  const ix = Object.fromEntries(head.map((h, i) => [h, i]))
  for (const need of ['ref_osm_id', 'location_latitude', 'location_longitude', 'date_year']) if (!(need in ix)) throw new Error(`${basename(file)}: no ${need} column`)
  const rows = []
  for (const line of it) {
    if (!line) continue
    // Cheap reject before splitting: most of the country is outside the box.
    const f = split(line)
    const lat = +f[ix.location_latitude], lon = +f[ix.location_longitude]
    if (!(lat >= S && lat <= N && lon >= W && lon <= E)) continue
    const dy = parseFloat(f[ix.date_year]), lo = parseFloat(f[ix.date_lower]), up = parseFloat(f[ix.date_upper])
    const year = Number.isFinite(dy) ? Math.round(dy) : Number.isFinite(lo) && Number.isFinite(up) ? Math.round((lo + up) / 2) : null
    rows.push({ osm: f[ix.ref_osm_id] || null, lat, lon, year, name: f[ix.location_name] || null, height: parseFloat(f[ix.size_height_apex]) || null, storeys: parseInt(f[ix.size_storeys_core], 10) || null })
  }
  const byOsm = new Map(rows.filter((r) => r.osm).map((r) => [r.osm, r]))
  // Grid index of points for footprints that have no OSM id match.
  const cell = 0.0004, grid = new Map(), k = (a, b) => `${Math.floor(a / cell)},${Math.floor(b / cell)}`
  for (const r of rows) { const key = k(r.lat, r.lon); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(r) }
  const extract = /data-extract-(\d{4}-\d{2}-\d{2})/.exec(dirname(file))?.[1] ?? 'unknown date'
  return {
    rows, byOsm, extract,
    /** The dated record whose point lies inside the footprint (x, y local metres; P projects lat/lon). */
    near(cx, cy, ring, P, inside = pointIn) {
      const out = []
      // Search the cells around the footprint centre (about ±90 m).
      for (const r of candidates(grid, cell, cx, cy, P, rows)) { const [x, y] = P(r.lat, r.lon); if (inside([x, y], ring)) out.push(r) }
      return out.sort((a, b) => (b.year ? 1 : 0) - (a.year ? 1 : 0))[0] ?? null
    },
  }
}

let inv = null
function candidates(grid, cell, cx, cy, P, rows) {
  // Invert the projector once from two known rows (linear in this small area).
  if (!inv) {
    const a = rows[0], b = rows.find((r) => Math.abs(r.lat - a.lat) > 1e-3 && Math.abs(r.lon - a.lon) > 1e-3) ?? a
    const [ax, ay] = P(a.lat, a.lon), [bx, by] = P(b.lat, b.lon)
    const kx = (b.lon - a.lon) / (bx - ax || 1), ky = (b.lat - a.lat) / (by - ay || 1)
    inv = (x, y) => [a.lat + (y - ay) * ky, a.lon + (x - ax) * kx]
  }
  const [lat, lon] = inv(cx, cy), out = []
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) out.push(...(grid.get(`${Math.floor(lat / cell) + i},${Math.floor(lon / cell) + j}`) ?? []))
  return out
}
function pointIn([x, y], ring) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c }
  return c
}
