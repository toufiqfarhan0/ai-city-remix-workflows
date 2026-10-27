// The film as pure functions of time: build progress, light and camera. Shots are data (film.json); the
// build follows the camera's first shot so the stones always land in view.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (k) => k * k * (3 - 2 * k)
const mix = (a, b, k) => a + (b - a) * k
const mixArr = (a, b, k) => a.map((v, i) => mix(v, b[i], k))

/**
 * film: { duration, build: [t0, t1], light: [[t, value], …], explode?: [[t, value], …], shots: [{ start, end, id, center: [from, to] | point,
 * yaw: [a, b], elev: [a, b], distance: [a, b] }] }. Returns { duration, at(t) → { build, light, explode, view, shot } }.
 */
export function createFilm(film) {
  const { duration, shots } = film
  if (!(duration > 0) || !Array.isArray(shots) || !shots.length) throw Object.assign(new Error('film'), { code: 'data' })
  const [b0, b1] = film.build
  const keyed = (keys, t) => {
    if (!keys?.length) return 0
    if (t <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0] || 1)))
    return keys.at(-1)[1]
  }
  const lightAt = (t) => {
    const keys = film.light
    if (t <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0] || 1)))
    return keys.at(-1)[1]
  }
  function at(t) {
    const tc = clamp(t, 0, duration)
    const shot = shots.find((s) => tc < s.end) ?? shots.at(-1)
    const u = smooth(clamp((tc - shot.start) / (shot.end - shot.start)))
    const c = Array.isArray(shot.center[0]) ? mixArr(shot.center[0], shot.center[1], u) : shot.center
    return {
      t: tc,
      shot: shot.id,
      build: clamp((tc - b0) / (b1 - b0)),
      light: lightAt(tc),
      explode: keyed(film.explode, tc),
      view: { center: c, yaw: mix(...shot.yaw, u), elev: mix(...shot.elev, u), distance: mix(...shot.distance, u) },
    }
  }
  return { duration, at, shots }
}
