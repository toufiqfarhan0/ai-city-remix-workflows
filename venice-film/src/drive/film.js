// The film: where the car is, how fast it goes and what time of day it is, as pure functions of film time.
// Speed eases down near every landmark and overhead bridge so they can be read, then picks up again; the
// whole profile is scaled so the drive ends exactly at the end of the film, followed by a short hold.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (k) => k * k * (3 - 2 * k)

/**
 * Builds the film timeline. world: { length, landmarks, bridges }. Returns
 * { duration, at(t) → { s, speed, tod, lane }, timeAt(s), highlights: [{ s, t, kind, name }] }.
 */
export function createFilm(world, { duration = 90, hold = 2.5, lane = 2.2, tod = [0, 1], startAt = 0 } = {}) {
  const length = world.length
  const start = clamp(startAt, 0, length * 0.5)
  const focus = [
    ...world.landmarks.map((l) => ({ s: l.s, kind: 'landmark', name: l.name, weight: 1 })),
    ...world.bridges.filter((b) => b.structure === 'suspension').map((b) => ({ s: b.s, kind: 'bridge', name: b.name, weight: 1.2 })),
  ].sort((a, b) => a.s - b.s)
  // Relative speed: 1 cruising, down to 0.38 within 220 m of a highlight (reached slightly before it).
  const rel = (s) => {
    let v = 1
    for (const f of focus) {
      const d = Math.abs(s - (f.s - 60))
      if (d < 260) v = Math.min(v, 1 - (0.62 * f.weight) * smooth(1 - d / 260))
    }
    // Pull away from the start and arrive gently.
    v = Math.min(v, 0.35 + 0.65 * smooth(clamp((s - start) / 160)))
    v = Math.min(v, 0.25 + 0.75 * smooth(clamp((length - s) / 220)))
    return Math.max(0.2, v)
  }
  // Integrate dt = ds / v on a 1 m grid, then scale to the film.
  const N = Math.max(2, Math.ceil(length - start))
  const T = new Float64Array(N + 1)
  for (let i = 1; i <= N; i++) T[i] = T[i - 1] + 1 / rel(start + i - 0.5)
  const drive = duration - hold
  const scale = drive / T[N]
  const cruise = 1 / scale // metres per second at relative speed 1
  function sAt(t) {
    const tt = clamp(t, 0, drive) / scale
    let lo = 0, hi = N
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (T[mid] <= tt) lo = mid
      else hi = mid
    }
    const k = (tt - T[lo]) / (T[hi] - T[lo] || 1)
    return start + lo + k
  }
  function todAt(t) {
    const k = clamp(t / duration)
    return tod[0] + (tod[1] - tod[0]) * smooth(k)
  }
  function at(t) {
    const tc = clamp(t, 0, duration)
    const s = Math.min(length, sAt(tc))
    const speed = tc >= drive ? 0 : cruise * rel(s)
    return { s, speed, tod: todAt(tc), lane, t: tc }
  }
  function timeAt(s) {
    const i = clamp(Math.round(s - start), 0, N)
    return T[i] * scale
  }
  return { duration, drive, cruise, at, timeAt, highlights: focus.map((f) => ({ ...f, t: timeAt(f.s) })) }
}
