// The film: the camera and the time of day as pure functions of film time. It opens on the whole area, flies
// to every landmark in turn (pulling back on long hops, framing tall towers whole, turning a little around the
// area on every move, holding still on each landmark), and ends on a wide night view.
//
// Zoom is in "reference" pixels per metre for a 240-row buffer; the app scales it to the real buffer height,
// so every layout frames the same shot.

export const REF_ROWS = 240
const HZ = 0.95
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (k) => k * k * (3 - 2 * k)
const lerp = (a, b, k) => a + (b - a) * k

/** Zoom and lift that frame a landmark of height h whole, at most `near`. */
export function framing(h, near) {
  const zoom = Math.min(near, (REF_ROWS * 0.62) / (h * HZ + 60))
  return { zoom, lift: h * 0.42 }
}

/**
 * world: { width, height, landmarks: [{ id, name, x, y, h }] }. cfg: { duration, tod: [from, to], turns,
 * wide, near, order: [names] }. Returns { duration, stops, at(t) → camera + tod + focus, stopTime(i) }.
 */
export function createFilm(world, { duration = 60, tod = [0.04, 0.97], turns = 1, wide = 0.17, near = 0.72, order = [] } = {}) {
  const byName = new Map(world.landmarks.map((l) => [l.name, l]))
  const ordered = [...order.map((n) => byName.get(n)).filter(Boolean), ...world.landmarks.filter((l) => !order.includes(l.name))]
  const intro = 4, outro = 8
  const per = ordered.length ? (duration - intro - outro) / ordered.length : 0
  const travel = Math.min(2.6, per * 0.45)
  const centre = { x: world.width / 2, y: world.height / 2 }
  const keys = [{ t: 0, x: centre.x, y: centre.y, zoom: wide, lift: 0, focus: null }]
  keys.push({ t: intro * 0.8, x: centre.x, y: centre.y, zoom: wide * 1.12, lift: 0, focus: null })
  ordered.forEach((l, i) => {
    const f = framing(l.h, near)
    const arrive = intro + i * per + travel
    keys.push({ t: arrive, x: l.x, y: l.y, zoom: f.zoom, lift: f.lift, focus: l.id })
    // Hold still on the landmark (only the traffic, water and light move), so the shot can be read.
    keys.push({ t: intro + (i + 1) * per, x: l.x, y: l.y, zoom: f.zoom, lift: f.lift, focus: l.id, hold: true })
  })
  keys.push({ t: duration - 1.5, x: centre.x, y: centre.y, zoom: wide, lift: 0, focus: null })
  keys.push({ t: duration, x: centre.x, y: centre.y, zoom: wide * 0.98, lift: 0, focus: null, hold: true })
  // The view turns only while the camera travels: `turns` quarter turns shared out over the moves.
  const moves = keys.filter((k, i) => i > 0 && !k.hold).length
  let turned = 0
  for (let i = 0; i < keys.length; i++) {
    if (i > 0 && !keys[i].hold) turned += turns / moves
    keys[i].rot = turned
  }

  function at(t) {
    const tc = clamp(t, 0, duration)
    let i = 0
    while (i < keys.length - 2 && keys[i + 1].t <= tc) i++
    const a = keys[i], b = keys[i + 1]
    const raw = clamp((tc - a.t) / (b.t - a.t || 1))
    const k = b.hold ? raw : smooth(raw)
    // Long hops pull back in the middle, like a camera lifting off and settling again.
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const dip = b.hold ? 0 : clamp(Math.log(Math.max(1, dist / 220)) * 0.55, 0, 1.1)
    const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k) - dip * Math.sin(Math.PI * k))
    const tk = smooth(clamp((tc / duration - 0.3) / 0.62))
    return {
      t: tc,
      cx: lerp(a.x, b.x, k),
      cy: lerp(a.y, b.y, k),
      zoom,
      lift: lerp(a.lift, b.lift, k),
      rot: lerp(a.rot, b.rot, k),
      tod: lerp(tod[0], tod[1], tk),
      focus: raw > 0.6 ? b.focus : a.focus,
    }
  }
  const stopTime = (i) => intro + i * per + travel
  return { duration, stops: ordered.map((l) => l.id), at, stopTime }
}
