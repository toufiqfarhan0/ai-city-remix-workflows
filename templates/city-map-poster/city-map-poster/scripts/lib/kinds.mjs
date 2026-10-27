// The three data poster kinds beside the street map, baked from OpenStreetMap elements. Pure functions, no
// network (the CLI in bake-poster.mjs fetches the elements):
//   skyline   building and building-part heights seen from one side, as four depth bands sampled every 2 m,
//             with domes, spires and towers drawn as caps, and the tallest named features as labels
//   food      places to eat and drink and food shops as points in six groups, with counts and top cuisines
//   landmark  one named building's footprint (all its rings and parts), its neighbours and its mapped facts

const num = (v) => Number.parseFloat(String(v ?? '').replace(/[^\d.]/g, ''))
// Names keep their accents (canvas type renders them); only whitespace is tidied.
const clean = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
const fold = (s) => clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Height of a building or part in metres, or null when nothing is mapped (no guess for the skyline). */
export function heightOf(t) {
  const h = num(t.height)
  if (h > 1 && h < 900) return h
  const l = num(t['building:levels'])
  if (l > 0 && l < 200) return l * 3.2 + (num(t['roof:levels']) > 0 ? num(t['roof:levels']) * 2.6 : 0)
  return null
}
export function baseOf(t) {
  const h = num(t.min_height)
  if (h > 0 && h < 900) return h
  const l = num(t['building:min_level'])
  return l > 0 && l < 200 ? l * 3.2 : 0
}
/** How the top is drawn: a flat roof, a dome, a spire (cone or pyramid) or a lattice tower. */
export function capOf(t) {
  if (t.man_made === 'tower' || t.man_made === 'mast') return 'tower'
  const r = String(t['roof:shape'] ?? '')
  if (['dome', 'onion'].includes(r)) return 'dome'
  if (['pyramidal', 'cone', 'spire'].includes(r) || t['building:part'] === 'steeple' || t['tower:type'] === 'bell_tower') return 'spire'
  return 'flat'
}

export const VIEWS = ['south', 'north', 'east', 'west']
/** Screen x and depth (0 near, 1 far) of a point in metres for a skyline seen from `from`. */
export function viewer(from, h) {
  if (from === 'north') return (x, y) => [-x, (h - y) / (2 * h)]
  if (from === 'east') return (x, y) => [y, (h - x) / (2 * h)]
  if (from === 'west') return (x, y) => [-y, (x + h) / (2 * h)]
  return (x, y) => [x, (y + h) / (2 * h)]
}

/**
 * elements: Overpass ways and relations with `bounds` and tags (out tags bb). Returns the skyline record:
 * { from, step, x0, bands: [[heights…] × 4, delta-encoded whole metres], caps: [[x0, x1, base, top, kind, band]],
 *   labels: [{ name, x, h }], buildings, mapped }.
 */
export function bakeSkyline(elements, P, h, from = 'south', english = false, step = 2) {
  const V = viewer(from, h)
  const n = Math.ceil((2 * h) / step) + 1
  const bands = [0, 1, 2, 3].map(() => new Float32Array(n))
  const caps = []
  const named = []
  let buildings = 0, mapped = 0
  const items = []
  const outlines = []
  const tops = []
  for (const e of elements) {
    const t = e.tags ?? {}
    const isB = !!t.building && t.building !== 'no', isP = !!t['building:part'] && t['building:part'] !== 'no'
    if (!e.bounds || !(isB || isP || t.man_made === 'tower' || t.man_made === 'mast')) continue
    const [ax, ay] = P.fwd(e.bounds.minlat, e.bounds.minlon)
    const [bx, by] = P.fwd(e.bounds.maxlat, e.bounds.maxlon)
    const cx = (ax + bx) / 2, cy = (ay + by) / 2
    if (Math.abs(cx) > h || Math.abs(cy) > h) continue
    items.push({ t, ax, ay, bx, by, cx, cy, part: isP && !isB })
  }
  // An outline holding building parts is not drawn itself (the parts carry the shape).
  const parts = items.filter((i) => i.part)
  const holds = (o) => parts.some((p) => p.cx > o.ax && p.cx < o.bx && p.cy > o.ay && p.cy < o.by && (p.bx - p.ax) * (p.by - p.ay) < (o.bx - o.ax) * (o.by - o.ay))
  for (const it of items) {
    const t = it.t
    buildings++
    const top = heightOf(t)
    if (!it.part && holds(it) && !num(t.height)) {
      // Not drawn, but its name labels the tallest part inside it.
      const name = clean((english && t['name:en']) || t.name || '')
      if (name) outlines.push({ name, it, wikidata: !!t.wikidata })
      continue
    }
    if (top === null) continue
    mapped++
    const base = baseOf(t)
    // Screen extent from the four corners of the bounds.
    const xs = [[it.ax, it.ay], [it.bx, it.ay], [it.ax, it.by], [it.bx, it.by]].map(([x, y]) => V(x, y)[0])
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    const depth = V(it.cx, it.cy)[1]
    const band = Math.max(0, Math.min(3, Math.floor(depth * 4)))
    const kind = capOf(t)
    const width = x1 - x0
    let wall = top
    if (kind === 'dome') wall = Math.max(base, top - Math.min(num(t['roof:height']) || width / 2, top * 0.5))
    else if (kind === 'spire') wall = Math.max(base, top - Math.min(num(t['roof:height']) || width * 1.6, top * 0.7))
    else if (kind === 'tower') wall = base
    if (kind !== 'flat') caps.push([Math.round(x0), Math.round(x1), Math.round(wall), Math.round(top), kind, band])
    const i0 = Math.max(0, Math.floor((x0 + h) / step)), i1 = Math.min(n - 1, Math.ceil((x1 + h) / step))
    for (let i = i0; i <= i1; i++) if (wall > bands[band][i]) bands[band][i] = wall
    tops.push({ cx: it.cx, cy: it.cy, top, x: (x0 + x1) / 2 })
    const name = clean((english && t['name:en']) || t.name || '')
    if (name && top >= 30) named.push({ name, x: Math.round((x0 + x1) / 2), h: Math.round(top), wikidata: !!t.wikidata, outline: false })
  }
  for (const o of outlines) {
    let best = null
    for (const p of tops) if (p.cx > o.it.ax && p.cx < o.it.bx && p.cy > o.it.ay && p.cy < o.it.by && (!best || p.top > best.top)) best = p
    if (best && best.top >= 30) named.push({ name: o.name, x: Math.round(best.x), h: Math.round(best.top), wikidata: o.wikidata, outline: true })
  }
  // The tallest named features, one per name, at least 300 m apart on screen (less in a small box).
  const apart = Math.min(300, h * 0.25)
  // Well-known features first (a Wikidata link), then by height; a whole building's name beats its part's.
  named.sort((a, b) => b.wikidata - a.wikidata || b.h - a.h || b.outline - a.outline)
  const labels = []
  for (const l of named) {
    if (labels.length >= 6) break
    if (labels.some((o) => o.name === l.name || Math.abs(o.x - l.x) < apart)) continue
    labels.push({ name: l.name, x: l.x, h: l.h })
  }
  const enc = (arr) => {
    const out = []
    let prev = 0
    for (const v of arr) {
      const r = Math.round(v)
      out.push(r - prev)
      prev = r
    }
    return out
  }
  return { from, step, x0: -h, bands: bands.map(enc), caps, labels, buildings, mapped }
}

export const FOOD = ['cafe', 'restaurant', 'bakery', 'bar', 'quick', 'market']
/** Food group of a place's tags, or null. */
export function foodOf(t) {
  const a = t.amenity, s = t.shop
  if (a === 'cafe' || s === 'coffee' || s === 'tea') return 'cafe'
  if (a === 'restaurant') return 'restaurant'
  if (['bakery', 'pastry', 'confectionery', 'chocolate'].includes(s)) return 'bakery'
  if (['bar', 'pub', 'biergarten'].includes(a) || s === 'wine') return 'bar'
  if (['fast_food', 'ice_cream', 'food_court'].includes(a)) return 'quick'
  if (a === 'marketplace' || ['cheese', 'butcher', 'deli', 'greengrocer', 'seafood'].includes(s)) return 'market'
  return null
}
/** elements: nodes, ways and relations with `lat`/`lon` or `center`. */
export function bakeFood(elements, P, h) {
  const pts = []
  const counts = Object.fromEntries(FOOD.map((k) => [k, 0]))
  const cuisines = new Map()
  const seen = new Set()
  for (const e of elements) {
    const t = e.tags ?? {}
    const g = foodOf(t)
    if (!g) continue
    const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon } : null)
    if (!c) continue
    const key = `${e.type}${e.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const [x, y] = P.fwd(c.lat, c.lon)
    if (Math.abs(x) > h || Math.abs(y) > h) continue
    pts.push(Math.round(x), Math.round(y), FOOD.indexOf(g))
    counts[g]++
    if (g === 'restaurant' && t.cuisine) for (const k of String(t.cuisine).split(';')) {
      const v = k.trim().toLowerCase()
      if (v && v !== 'regional') cuisines.set(v, (cuisines.get(v) ?? 0) + 1)
    }
  }
  const top = [...cuisines].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6)
  return { groups: FOOD, pts, counts, total: pts.length / 3, cuisines: top }
}

/**
 * answer: Overpass elements for one landmark query (the named element(s) with geometry, then the buildings around
 * them). Returns { name, x, y, rings, parts, context, facts } with rings in metres around the landmark's centre.
 */
export function bakeLandmark(answer, P, wanted, english = false) {
  const low = fold(wanted)
  const nameOf = (t) => clean((english && t['name:en']) || t.name || '')
  const matches = answer.elements.filter((e) => [nameOf(e.tags ?? {}), e.tags?.name, e.tags?.['name:en']].some((n) => n && fold(n) === low) && (e.geometry || e.members))
  if (!matches.length) return null
  // Prefer a building, then a tower, then anything with an outline; the largest outline wins.
  const ringsOf = (e) => (e.type === 'way' ? [e.geometry] : e.members.filter((m) => m.geometry && m.type === 'way').map((m) => m.geometry))
  const rank = (e) => (e.tags?.building ? 3 : e.tags?.man_made ? 2 : 1) * 1e9 + ringsOf(e).reduce((a, r) => a + r.length, 0)
  const best = matches.sort((a, b) => rank(b) - rank(a))[0]
  // Rings without the repeated closing point (the renderer closes them).
  const open = (g) => (g.length > 1 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon ? g.slice(0, -1) : g)
  const raw = ringsOf(best).map((g) => open(g).map((p) => P.fwd(p.lat, p.lon)))
  let cx = 0, cy = 0, k = 0
  for (const r of raw) for (const [x, y] of r) {
    cx += x
    cy += y
    k++
  }
  cx /= k
  cy /= k
  const local = (r) => {
    const out = []
    for (const [x, y] of r) out.push(Math.round((x - cx) * 10) / 10, Math.round((y - cy) * 10) / 10)
    return out
  }
  const inside = (x, y) => raw.some((r) => {
    let hit = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) hit = !hit
    }
    return hit
  })
  const parts = [], context = []
  let tallest = heightOf(best.tags ?? {}) ?? 0
  for (const e of answer.elements) {
    if (e === best || e.type !== 'way' || !e.geometry || !(e.tags?.building || e.tags?.['building:part'])) continue
    const r = open(e.geometry).map((p) => P.fwd(p.lat, p.lon))
    const mx = r.reduce((a, p) => a + p[0], 0) / r.length, my = r.reduce((a, p) => a + p[1], 0) / r.length
    if (Math.hypot(mx - cx, my - cy) > 320) continue
    if (e.tags['building:part'] && inside(mx, my)) {
      parts.push(local(r))
      tallest = Math.max(tallest, heightOf(e.tags) ?? 0)
    } else if (!inside(mx, my)) context.push(local(r))
  }
  const t = best.tags ?? {}
  const facts = {}
  if (tallest) facts.height = Math.round(tallest)
  if (t.start_date) facts.built = String(t.start_date).slice(0, 24)
  if (t.architect) facts.architect = clean(t.architect).slice(0, 60)
  if (t['building:levels']) facts.levels = Math.round(num(t['building:levels']))
  if (t.wikidata) facts.wikidata = t.wikidata
  let extent = 0
  for (const r of raw) for (const [x, y] of r) extent = Math.max(extent, Math.abs(x - cx), Math.abs(y - cy))
  return { name: nameOf(t) || clean(wanted), query: wanted, x: Math.round(cx), y: Math.round(cy), extent: Math.round(extent), rings: raw.map(local), parts, context, facts }
}
