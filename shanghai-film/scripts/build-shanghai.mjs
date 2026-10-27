import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { normalizeStory, validateStory } from './lib/story.mjs'
import { area, centroid, inside, projector, simplify } from './lib/geo.mjs'
import { tileFeatures } from './lib/tiles.mjs'

const dir = resolve('.')
const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
normalizeStory(story)
const problems = validateStory(story)
if (problems.length) {
  console.error('Story problems:', problems)
  process.exit(1)
}

const [S, W, N, E] = story.city.bbox
const P = projector(story.city.center ?? [(S + N) / 2, (W + E) / 2])
mkdirSync(join(dir, 'cache'), { recursive: true })

const rawData = JSON.parse(readFileSync(join(dir, 'cache', 'osm-shanghai.json'), 'utf8'))
console.log(`Loaded ${rawData.elements.length} OSM elements from cache.`);

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const levelH = 3.4
const out = []

for (const e of rawData.elements) {
  const t = e.tags
  const ring = simplify(e.geometry.map((p) => P(p.lat, p.lon)), 0.4)
  if (ring.length < 4) continue
  const a = area(ring)
  if (a < 8) continue

  let h = num(t.height) ?? (num(t['building:levels']) ? num(t['building:levels']) * levelH + 2 : null)
  const hSrc = h ? 'data' : 'estimate'
  if (!h) h = Math.min(30, Math.max(7, 6 + Math.sqrt(a) * 0.35))
  if (t.building === 'roof' || t.building === 'canopy') h = Math.min(h, 6)

  const sd = /^~?(\d{4})/.exec(t.start_date ?? '')
  let year = null, ySrc = null
  if (sd) {
    year = +sd[1]
    ySrc = 'osm'
  }

  out.push({
    id: `way/${e.id}`,
    ring: ring.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]),
    h: +h.toFixed(1),
    hSrc,
    year,
    ySrc,
    name: t.name ?? null
  })
}

// Landmarks from story.json override or date the closest footprint
for (const lm of story.landmarks ?? []) {
  if (!lm.at || !lm.year) continue
  const [x, y] = P(lm.at[0], lm.at[1])
  let hit = out.filter((b) => inside([x, y], b.ring)).sort((p, q) => area(p.ring) - area(q.ring))[0]
  if (!hit) {
    // Find closest within 80 meters
    let bestDist = 80
    for (const b of out) {
      const [cx, cy] = centroid(b.ring)
      const d = Math.hypot(cx - x, cy - y)
      if (d < bestDist) {
        bestDist = d
        hit = b
      }
    }
  }

  if (hit) {
    hit.year = lm.year
    hit.ySrc = 'landmark'
    hit.name = lm.name
    if (lm.height) {
      hit.h = lm.height
      hit.hSrc = 'data'
    }
    hit.landmark = lm.id
    console.log(`Matched landmark "${lm.name}" to building ${hit.id} (height ${hit.h}m, year ${hit.year})`)
  } else {
    // Synthesize footprint for isolated landmark tower
    const towerRadius = lm.height > 400 ? 25 : 15
    const pts = []
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      pts.push([+(x + Math.cos(ang) * towerRadius).toFixed(1), +(y + Math.sin(ang) * towerRadius).toFixed(1)])
    }
    pts.push(pts[0])
    out.push({
      id: `synthetic/${lm.id}`,
      ring: pts,
      h: lm.height ?? 100,
      hSrc: 'data',
      year: lm.year,
      ySrc: 'landmark',
      name: lm.name,
      landmark: lm.id
    })
    console.log(`Synthesized landmark "${lm.name}" at center (${x.toFixed(1)}, ${y.toFixed(1)})`)
  }
}

// ── ground: water, parks and streets from OpenFreeMap vector tiles ──
const pad = 0.012, outer = [S - pad, W - pad * 1.6, N + pad, E + pad * 1.6]
const cacheJson = (name, fn) => {
  const f = join(dir, 'cache', `${name}.json`)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  const v = fn()
  writeFileSync(f, JSON.stringify(v))
  return v
}
const toLocal = (rings) => rings.map((r) => r.map(([la, lo]) => P(la, lo)).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]))

console.log('Fetching base ground layers (water, parks, roads)...')
const water = cacheJson('t-water', () => tileFeatures(outer, 14, ['water'], () => true)).filter((f) => f.type === 3).flatMap((f) => toLocal(f.rings))
const parks = cacheJson('t-park', () => tileFeatures(outer, 14, ['park', 'landcover'], (l, p) => l === 'park' || /^(grass|wood)$/.test(p.class))).filter((f) => f.type === 3).flatMap((f) => toLocal(f.rings))
const roads = cacheJson('t-roads', () => tileFeatures(outer, 14, ['transportation'], (_, p) => /^(motorway|trunk|primary|secondary|tertiary|minor)$/.test(p.class) && !p.ramp && p.brunnel !== 'tunnel'))
  .filter((f) => f.type === 2).map((f) => ({ cls: f.props.class, bridge: f.props.brunnel === 'bridge', lines: toLocal(f.rings) }))

console.log(`Ground features: ${water.length} water bodies, ${parks.length} parks, ${roads.length} road lines.`)

const dated = out.filter((b) => b.year).length
const city = {
  version: 1,
  center: story.city.center ?? [(S + N) / 2, (W + E) / 2],
  bbox: story.city.bbox,
  stats: {
    buildings: out.length,
    dated,
    heightData: out.filter((b) => b.hSrc === 'data').length
  },
  sources: {
    osm: 'OpenStreetMap API, © OpenStreetMap contributors (ODbL)',
    ground: 'OpenFreeMap vector tiles, © OpenMapTiles © OpenStreetMap contributors'
  },
  ground: { water, parks, roads },
  buildings: out,
  victorian: null
}

writeFileSync(join(dir, 'city.json'), JSON.stringify(city))
console.log(`Wrote city.json with ${out.length} buildings (${dated} dated, ${((100 * dated) / out.length).toFixed(1)}%).`)
