// story.json: reading, light repair, validation and the film's timeline.
// The film is a sequence of eras. Each era runs the city clock from one year to the next,
// moves the camera, and has one or two narration lines; the picture comes from city.json.

export const SHAPES = ['outline', 'glow']
export const LIMITS = { eras: [5, 14], seconds: [4, 30], narration: 230, words: 40, title: 48, label: 40, total: [60, 180] }

const num = (v, d) => (Number.isFinite(+v) ? +v : d)

export function normalizeStory(s) {
  const fixed = []
  if (!s || typeof s !== 'object') return fixed
  if (typeof s.title === 'string') { s.title = { en: s.title }; fixed.push('title: string wrapped as { en }') }
  s.voice ??= 'English_CaptivatingStoryteller'
  s.landmarks ??= []
  s.outlines ??= []
  s.credits ??= []
  ;(s.eras ?? []).forEach((e, i) => {
    e.id ??= `e${i + 1}`
    e.seconds = num(e.seconds, 9)
    e.camera ??= {}
    e.events ??= []
  })
  return fixed
}

export function validateStory(s) {
  const p = [], need = (c, m) => { if (!c) p.push(m) }, len = (t) => [...String(t ?? '')].length, words = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length
  need(s && typeof s === 'object', 'story.json must be an object')
  if (!s || typeof s !== 'object') return p
  need(s.version === 1, 'version must be 1')
  need(s.title?.en && len(s.title.en) <= LIMITS.title, `title.en is required (≤ ${LIMITS.title} characters)`)
  need(Array.isArray(s.city?.bbox) && s.city.bbox.length === 4 && s.city.bbox[0] < s.city.bbox[2] && s.city.bbox[1] < s.city.bbox[3], 'city.bbox must be [south, west, north, east]')
  if (Array.isArray(s.city?.bbox)) need((s.city.bbox[2] - s.city.bbox[0]) * (s.city.bbox[3] - s.city.bbox[1]) <= 0.01, 'city.bbox is too large (keep it under about 0.1° × 0.1°)')
  need(Array.isArray(s.sources) && s.sources.length >= 1, 'sources: list at least one link or citation')
  const n = s.eras?.length ?? 0
  need(n >= LIMITS.eras[0] && n <= LIMITS.eras[1], `eras: ${LIMITS.eras[0]} to ${LIMITS.eras[1]} are needed (got ${n})`)
  let prev = -Infinity
  ;(s.eras ?? []).forEach((e, i) => {
    const at = `eras[${i}]`
    need(Number.isFinite(e.from) && Number.isFinite(e.to) && e.to >= e.from, `${at}: from and to must be years, to ≥ from`)
    need(e.from >= prev, `${at}.from must not go back in time`); prev = e.to
    need(e.seconds >= LIMITS.seconds[0] && e.seconds <= LIMITS.seconds[1], `${at}.seconds must be ${LIMITS.seconds[0]}-${LIMITS.seconds[1]}`)
    need(e.label && len(e.label) <= LIMITS.label, `${at}.label is required (≤ ${LIMITS.label} characters)`)
    need(e.narration && len(e.narration) <= LIMITS.narration && words(e.narration) <= LIMITS.words, `${at}.narration is required (≤ ${LIMITS.words} words, ${LIMITS.narration} characters)`)
    for (const [j, ev] of e.events.entries()) need(['fire', 'blitz', 'flash'].includes(ev.kind) && Number.isFinite(ev.year), `${at}.events[${j}] needs kind fire|blitz|flash and a year`)
  })
  for (const [i, l] of s.landmarks.entries()) need(l.id && l.name && Number.isFinite(l.year) && Array.isArray(l.at), `landmarks[${i}] needs id, name, year and at [lat, lon]`)
  for (const [i, o] of s.outlines.entries()) need(o.id && Array.isArray(o.ring) && o.ring.length >= 3 && Number.isFinite(o.from), `outlines[${i}] needs id, from and a ring of [lat, lon]`)
  const total = timeline(s).duration
  need(total >= LIMITS.total[0] && total <= LIMITS.total[1], `the film is ${total.toFixed(1)} s; it must be ${LIMITS.total[0]}-${LIMITS.total[1]} s`)
  return p
}

/** Title card, one block per era, end card. Each era's narration starts 0.6 s in. */
export const TITLE = 5.5, END = 8.5
export function timeline(s, clips = {}) {
  let t = TITLE
  const eras = (s.eras ?? []).map((e) => {
    const d = Math.max(e.seconds, (clips[e.id] ?? 0) + 1.4)
    const key = (e.events ?? []).find((ev) => ev.kind !== 'flash' && ev.year > e.from && ev.year < e.to)
    const b = { id: e.id, start: +t.toFixed(3), duration: +d.toFixed(3), from: e.from, to: e.to, voiceAt: +(t + 0.6).toFixed(3), ...(key ? { key: { u: Number.isFinite(key.at01) ? key.at01 : 0.35, year: key.year } } : {}) }
    t += d
    return b
  })
  return { title: TITLE, eras, endStart: +t.toFixed(3), duration: +(t + END).toFixed(3), introAt: 1.2, outroAt: +(t + 1.0).toFixed(3) }
}

/** City year at film time t: eases through each era, holds on the title and end cards. */
export function yearAt(tl, t) {
  if (!tl.eras.length) return 0
  if (t <= tl.eras[0].start) return tl.eras[0].from
  for (const e of tl.eras) if (t < e.start + e.duration) {
    const u = (t - e.start) / e.duration, s = (v) => v * v * (3 - 2 * v)
    // With a key event the clock runs from..event year, holds briefly, then event year..to.
    if (e.key) { const a = e.key.u - 0.08, b = e.key.u + 0.12; if (u < a) return e.from + (e.key.year - e.from) * s(u / a); if (u < b) return e.key.year; return e.key.year + (e.to - e.key.year) * s((u - b) / (1 - b)) }
    return e.from + (e.to - e.from) * s(u)
  }
  return tl.eras[tl.eras.length - 1].to
}

/** Film time of an era event: `at` (0-1 through the era, default 0.35, while the line is spoken). */
export function eventTime(tl, i, ev) {
  const e = tl.eras[i]
  return e.start + e.duration * (Number.isFinite(ev.at01) ? ev.at01 : 0.35)
}

/** Every spoken line: [key, text]. */
export const spokenLines = (s) => [...(s.intro ? [['intro', s.intro]] : []), ...s.eras.map((e) => [e.id, e.narration]), ...(s.outro ? [['outro', s.outro]] : [])]
