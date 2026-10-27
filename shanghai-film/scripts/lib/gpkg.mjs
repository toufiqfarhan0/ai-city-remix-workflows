// Reads polygons from a GeoPackage in EPSG:3857 (the Victorian London footprints) for one
// bounding box, with Node's built-in SQLite (node:sqlite, Node 22.5+) and a small WKB parser.
import { DatabaseSync } from 'node:sqlite'

const R = 6378137
const toLL = (x, y) => [(Math.atan(Math.exp(y / R)) * 2 - Math.PI / 2) * 180 / Math.PI, (x / R) * 180 / Math.PI]
const toM = (lat, lon) => [(lon * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R]

/** Outer rings of a WKB Polygon / MultiPolygon, as [[x, y], …] in the layer's CRS. */
function wkbRings(buf, off = 0, out = []) {
  const le = buf[off] === 1, u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)), f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o))
  let type = u32(off + 1) % 1000, p = off + 5
  if (type === 3) {
    const nr = u32(p); p += 4
    for (let r = 0; r < nr; r++) {
      const np = u32(p); p += 4
      const ring = []
      for (let i = 0; i < np; i++) { ring.push([f64(p), f64(p + 8)]); p += 16 }
      if (r === 0) out.push(ring)
    }
    return { out, end: p }
  }
  if (type === 6) {
    const n = u32(p); p += 4
    for (let i = 0; i < n; i++) p = wkbRings(buf, p, out).end
    return { out, end: p }
  }
  return { out, end: p }
}

/** GeoPackage binary → WKB offset (header + optional envelope). */
function gpkgWkb(blob) {
  const flags = blob[3], env = (flags >> 1) & 7
  return 8 + ({ 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 }[env] ?? 0)
}

export function readVictorian(file, [S, W, N, E]) {
  const db = new DatabaseSync(file, { readOnly: true })
  const [{ table_name: t, srs_id: srs }] = db.prepare("select table_name, srs_id from gpkg_contents where data_type = 'features'").all()
  if (srs !== 3857) throw new Error(`${file}: expected EPSG:3857, got ${srs}`)
  const [x0, y0] = toM(S, W), [x1, y1] = toM(N, E)
  const rt = db.prepare("select name from sqlite_master where name like 'rtree_%'").all().map((r) => r.name).find((n) => n.startsWith(`rtree_${t}`))
  const rows = rt
    ? db.prepare(`select g.geom as geom from "${t}" g join "${rt}" r on g.fid = r.id where r.maxx >= ? and r.minx <= ? and r.maxy >= ? and r.miny <= ?`).all(x0, x1, y0, y1)
    : db.prepare(`select geom from "${t}"`).all()
  const out = []
  for (const { geom } of rows) {
    const b = Buffer.from(geom)
    for (const ring of wkbRings(b, gpkgWkb(b)).out) out.push(ring.map(([x, y]) => toLL(x, y)))
  }
  db.close()
  return out
}
