// Basemap features from OpenFreeMap vector tiles (OpenMapTiles schema, built from
// OpenStreetMap). Static files on a CDN: much more reliable than Overpass for the
// dense layers (buildings, streets). Data © OpenMapTiles © OpenStreetMap contributors.
import { spawnSync } from 'node:child_process'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader as Pbf } from 'pbf'

const TILEJSON = 'https://tiles.openfreemap.org/planet'
const UA = 'sandbase-lab-city-grows-3d/0.1 (+https://www.sandbase.ai/lab)'

function curl(url, { binary = false, timeout = 60 } = {}) {
  for (let i = 0; i < 4; i++) {
    const r = spawnSync('curl', ['-sS', '-f', '-L', '--compressed', '-m', String(timeout), '-A', UA, url], { maxBuffer: 1 << 28 })
    if (r.status === 0) return binary ? r.stdout : r.stdout.toString()
    // 404/204 means an empty tile (sea, nothing mapped).
    if (/error: (404|204)/.test(r.stderr?.toString() ?? '')) return null
  }
  throw new Error(`tiles: ${url} failed`)
}

let template
function tileUrl(z, x, y) {
  template ??= JSON.parse(curl(TILEJSON)).tiles[0]
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y)
}

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z) }

/** Tile ids covering bbox [south, west, north, east] at zoom z. */
export function tileIds([s, w, n, e], z) {
  const out = []
  for (let x = lon2x(w, z); x <= lon2x(e, z); x++) for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push([z, x, y])
  return out
}

/**
 * Features of the given layers over a bbox, as { layer, props, rings: [[[lat, lon], …], …], type }.
 * type: 1 point, 2 line, 3 polygon. `filter(layer, props)` drops features early.
 */
export function tileFeatures(bbox, z, layers, filter = () => true, { log = () => {} } = {}) {
  const ids = tileIds(bbox, z)
  log(`tiles: z${z} × ${ids.length}`)
  const out = []
  for (const [tz, tx, ty] of ids) {
    const buf = curl(tileUrl(tz, tx, ty), { binary: true })
    if (!buf?.length) continue
    const vt = new VectorTile(new Pbf(buf))
    for (const name of layers) {
      const layer = vt.layers[name]
      if (!layer) continue
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i)
        if (!filter(name, f.properties)) continue
        const size = f.extent * 2 ** tz
        const x0 = f.extent * tx, y0 = f.extent * ty
        const rings = f.loadGeometry().map((ring) => ring.map((p) => {
          const lon = ((p.x + x0) / size) * 360 - 180
          const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (p.y + y0)) / size))) * 180) / Math.PI
          return [lat, lon]
        }))
        out.push({ layer: name, props: f.properties, rings, type: f.type })
      }
    }
  }
  return out
}
