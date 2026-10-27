// Overpass queries with mirror rotation, retries and validation. Uses curl so the
// system proxy settings apply. OpenStreetMap data is ODbL: credit it in the film.
import { spawnSync } from 'node:child_process'

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const UA = 'sandbase-lab-city-through-time/0.1 (+https://www.sandbase.ai/lab)'
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Runs one Overpass QL query and returns its elements. Throws after every mirror failed. */
export function overpass(query, { attempts = 6, timeout = 300, log = () => {} } = {}) {
  let last = ''
  for (let i = 0; i < attempts; i++) {
    const mirror = MIRRORS[i % MIRRORS.length]
    const r = spawnSync('curl', ['-sS', '-m', String(timeout), '-A', UA, '-H', 'Accept: application/json', '--data-urlencode', `data=${query}`, mirror], { maxBuffer: 1 << 30 })
    const body = r.stdout?.toString() ?? ''
    try {
      const json = JSON.parse(body)
      if (Array.isArray(json.elements)) return json.elements
      last = 'no elements'
    } catch {
      last = (body || r.stderr?.toString() || '').slice(0, 80).replace(/\s+/g, ' ')
    }
    log(`overpass: ${new URL(mirror).host} failed (${last}); retrying`)
    sleep(Math.min(60_000, 8_000 * (i + 1)))
  }
  throw new Error(`overpass: every mirror failed (${last})`)
}

/** Splits a bbox [south, west, north, east] into n×n tiles. */
export function tiles([s, w, n, e], k) {
  const out = []
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    out.push([s + ((n - s) * i) / k, w + ((e - w) * j) / k, s + ((n - s) * (i + 1)) / k, w + ((e - w) * (j + 1)) / k])
  }
  return out
}

export const bboxStr = ([s, w, n, e]) => `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`
