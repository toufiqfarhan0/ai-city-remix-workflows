// The film as pure functions of time. The first step draws the street map outward from the city centre one
// layer after another (water and parks, then major, mid and minor roads, then the type and the marks); every
// later step wipes in a new poster (kind, theme, map shape, landmark) with a slanted wipe and plays that kind's
// own reveal from the moment the wipe starts: the skyline rises band by band, the food places spread out from the
// centre, the landmark outline draws itself.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ease = (k) => 1 - (1 - k) ** 3
export const KIND_REVEAL = { map: {}, skyline: { skyline: [0, 3.6] }, food: { food: [0, 3.2] }, landmark: { landmark: [0, 3.6] } }
function ranges(r, t) {
  const out = {}
  for (const [k, [a, b]] of Object.entries(r)) out[k] = ease(clamp((t - a) / (b - a || 1)))
  return out
}
/** Reveal progress of a kind's own draw-in, t seconds after it starts (the map uses the film's first-step ranges). */
export function kindReveal(kind, t, mapRanges = {}) {
  return ranges(kind === 'map' ? mapRanges : KIND_REVEAL[kind] ?? {}, t)
}
/** Seconds a kind's draw-in takes. */
export function kindRevealLength(kind, mapRanges = {}) {
  return Math.max(0, ...Object.values(kind === 'map' ? mapRanges : KIND_REVEAL[kind] ?? {}).map(([, b]) => b))
}

/**
 * themes: [{ id }]. cfg: { duration, wipe, reveal: { layer: [start, end] } for the first step, sequence:
 * [{ t, theme, shape, kind, landmark }] }. kinds: the kinds this poster has (others fall back to the map).
 * Returns { duration, steps, at(t) → { theme, shape, kind, landmark, reveal, next…, wipe } }.
 */
export function createFilm(themes, { duration = 45, wipe = 1.4, reveal = {}, sequence = [] } = {}, kinds = ['map']) {
  const index = (id) => Math.max(0, themes.findIndex((th) => th.id === id))
  const src = sequence.length ? sequence : [{ t: 0, theme: themes[0].id, shape: 'full', kind: 'map' }]
  const steps = src.map((s) => ({ t: s.t, theme: index(s.theme), shape: s.shape === 'circle' ? 'circle' : 'full', kind: kinds.includes(s.kind) ? s.kind : 'map', landmark: Math.max(0, Math.round(s.landmark ?? 0)) }))
  const revealOf = (i, t) => (i === 0 ? ranges(reveal, t) : ranges(KIND_REVEAL[steps[i].kind] ?? {}, t - (steps[i].t - wipe)))
  function at(t) {
    const tc = clamp(t, 0, duration)
    let i = 0
    while (i < steps.length - 1 && steps[i + 1].t <= tc) i++
    const cur = steps[i], nxt = steps[i + 1]
    // The wipe toward the next step ends exactly at its start time.
    const w = nxt ? clamp((tc - (nxt.t - wipe)) / wipe) : 0
    const on = nxt && w > 0
    return {
      t: tc, step: i, theme: cur.theme, shape: cur.shape, kind: cur.kind, landmark: cur.landmark, reveal: revealOf(i, tc),
      next: on ? nxt.theme : null, nextShape: on ? nxt.shape : null, nextKind: on ? nxt.kind : null, nextLandmark: on ? nxt.landmark : null,
      nextReveal: on ? revealOf(i + 1, tc) : null, wipe: on ? ease(w) : 0,
    }
  }
  return { duration, steps, at }
}
