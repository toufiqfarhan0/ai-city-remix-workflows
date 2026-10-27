// story.json validation. Field reference: references/story.md.

const isLL = (p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
const hex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)
const str = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max

/**
 * Repairs common, unambiguous slips in place: a single ring written as
 * `polygons: [[lat, lon], …]` (or a single line as `lines: [[lat, lon], …]`) is wrapped.
 * Returns the list of repairs made.
 */
export function normalizeStory(s) {
  const fixed = []
  for (const [i, e] of (s?.eras ?? []).entries()) {
    const sh = e?.shape
    if (!sh) continue
    for (const k of ['polygons', 'lines']) {
      if (Array.isArray(sh[k]) && sh[k].length && sh[k].every(isLL)) { sh[k] = [sh[k]]; fixed.push(`eras[${i}].shape.${k}: wrapped a single ${k === 'polygons' ? 'ring' : 'line'}`) }
    }
  }
  return fixed
}

/** Lists problems; an empty list means the story is usable. `resolved` checks the post-resolve form. */
export function validateStory(s, { resolved }) {
  const out = []
  if (s?.version !== 1) out.push('version must be 1')
  if (!s?.city || !str(s.city.name, 60) || !isLL([s.city.lat, s.city.lon])) out.push('city needs name, lat, lon')
  if (!str(s?.title?.en, 80)) out.push('title.en is required')
  if (!str(s?.intro, 200)) out.push('intro is required (one spoken sentence)')
  if (!str(s?.outro, 200)) out.push('outro is required (one spoken sentence)')
  if (s?.endCard !== undefined && (!str(s.endCard?.title, 60) || (s.endCard.sub !== undefined && !str(s.endCard.sub, 80)))) out.push('endCard needs a title (≤ 60) and an optional sub (≤ 80)')
  if (!Array.isArray(s?.eras) || s.eras.length < 4 || s.eras.length > 12) out.push('eras: 4 to 12')
  for (const [i, e] of (s?.eras ?? []).entries()) {
    const at = `eras[${i}]`
    if (!str(e.year, 24)) out.push(`${at}.year is required (for example "753 BC", "c. AD 100", "1871")`)
    if (!str(e.label, 40)) out.push(`${at}.label is required`)
    if (!str(e.narration, 300)) out.push(`${at}.narration is required (1-2 spoken sentences, ≤ 300 chars)`)
    if (e.stat !== undefined && !str(e.stat, 60)) out.push(`${at}.stat must be a short string`)
    if (!hex(e.color)) out.push(`${at}.color must be #rrggbb`)
    const sh = e.shape ?? {}
    if (resolved) {
      const ok = (sh.polygons?.length && sh.polygons.every((p) => p.length >= 3 && p.every(isLL))) || (sh.lines?.length && sh.lines.every((l) => l.every(isLL))) || (isLL(sh.glow) && sh.radius > 0)
      if (!ok) out.push(`${at}.shape has no usable polygons, lines or glow`)
    } else {
      const refs = sh.osm ? [].concat(sh.osm) : []
      if (refs.some((r) => !r || (!str(r.name, 400) && !r.tags))) out.push(`${at}.shape.osm needs a name or tags`)
      const fallback = (sh.polygons?.length && sh.polygons.every((p) => p.length >= 3 && p.every(isLL))) || (isLL(sh.glow) && sh.radius > 0) || (sh.lines?.length && sh.lines.every((l) => l.every(isLL)))
      if (!refs.length && !fallback) out.push(`${at}.shape needs osm, polygons, lines or glow+radius`)
      if (refs.length && !fallback) out.push(`${at}.shape with osm also needs a fallback (polygons or glow+radius) in case OSM has nothing`)
    }
    if (e.seed !== undefined && !isLL(e.seed)) out.push(`${at}.seed must be [lat, lon]`)
    if (!Array.isArray(e.events ?? []) || (e.events ?? []).length > 2) out.push(`${at}.events: at most 2`)
    for (const [j, ev] of (e.events ?? []).entries()) {
      if (!isLL(ev.at)) out.push(`${at}.events[${j}].at must be [lat, lon]`)
      if (!str(ev.title, 48)) out.push(`${at}.events[${j}].title is required (≤ 48 chars)`)
      if (ev.prompt !== undefined && !str(ev.prompt, 400)) out.push(`${at}.events[${j}].prompt must be ≤ 400 chars`)
      if (ev.image !== undefined && !/^[a-z0-9-]{1,40}$/.test(ev.image)) out.push(`${at}.events[${j}].image must be a slug`)
    }
  }
  return out
}
