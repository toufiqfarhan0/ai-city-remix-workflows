// Procedural SFX for the ink style, in the theme's key (D gong pentatonic). One recipe per action kind;
// three tiers make the sound more prominent the more important the moment is:
//   normal    the bare gesture (brush swish, wood tick)
//   emphasis  + a pitched layer from the theme scale (guqin harmonic / woodblock)
//   climax    + a low frame drum and a bronze bell
// Every recipe returns { buf: Float32Array (mono, SR), hit: seconds } where `hit` is the onset inside
// the buffer that must land on the action (swells start before their hit). Some layers share code with
// skills/sketchbook-film/src/sound/sfx.mjs (paper bloom, paper turn, swish). Deterministic by seed.
import { SR, addInto, filter, mtof, mul, noise, osc, perc, samples, scale, sweep, sweepFilter } from './synth/dsp.mjs'
import { bell } from './theme.mjs'
export const SFX_KINDS = Object.freeze(['transition', 'appear', 'count', 'seal', 'route', 'reveal', 'brush', 'scroll'])
export const SFX_TIERS = Object.freeze(['normal', 'emphasis', 'climax'])
/** Peak level per tier (dBFS before the master loudnorm, relative to a −16 LUFS music bed). */
export const TIER_DB = Object.freeze({ normal: -20, emphasis: -13, climax: -7 })
const TAU = Math.PI * 2
const D_PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]
function swell(peak, curve = 2) {
  return (n) => {
    const out = new Float32Array(n)
    const p = Math.max(1, Math.round(n * peak))
    for (let i = 0; i < n; i++) out[i] = i < p ? (i / p) ** curve : (1 - (i - p) / Math.max(1, n - p)) ** curve
    return out
  }
}
const sweptHiss = (dur, seed, centre, q, env) => {
  const n = samples(dur)
  return sweepFilter(mul(noise(n, seed), env(n)), 'bandpass', centre, q)
}
function layer(dur, parts) {
  const out = new Float32Array(samples(dur))
  for (const [t, buf, g = 1] of parts) addInto(out, buf, g, samples(t))
  return out
}
const tick = (pitch, seed, g = 1) => {
  const f = mtof(pitch)
  const n = samples(0.16)
  const out = mul(osc('sine', f, n), perc(n, 0.0004, 0.03))
  addInto(out, mul(osc('sine', f * 2.73, n), perc(n, 0.0004, 0.01)), 0.4)
  addInto(out, filter(mul(noise(samples(0.006), seed), perc(samples(0.006), 0.0002, 0.0015)), 'highpass', 2500, 0.7), 0.3)
  return scale(out, g)
}
const pluckHarm = (pitch, g = 1) => {
  const f = mtof(pitch)
  const n = samples(1.6)
  const out = mul(osc('sine', f, n), perc(n, 0.002, 0.6))
  addInto(out, mul(osc('sine', f * 2, n), perc(n, 0.002, 0.25)), 0.3)
  return scale(out, g)
}
const drum = (seed, g = 1) => {
  const n = samples(0.9)
  const out = mul(osc('sine', (t) => sweep(100, 42, 0.2, t), n), perc(n, 0.002, 0.33))
  addInto(out, filter(mul(noise(n, seed), perc(n, 0.001, 0.025)), 'lowpass', 800, 0.8), 0.4)
  return scale(out, g)
}
const brushSwish = (dur, seed, f0 = 900, f1 = 3200) => sweptHiss(dur, seed, (t) => sweep(f0, f1, dur, t), 1.3, swell(0.25, 1.4))
// ---------- recipes: (ctx) -> { buf, hit } ----------
const R = {
  transition: ({ seed, dur = 0.5 }) => ({ buf: layer(0.6, [[0, brushSwish(Math.min(0.5, dur), seed, 600, 2600), 0.9], [0, drum(seed, 0.25)]]), hit: 0 }),
  appear: ({ seed, step = 0 }) => ({ buf: tick(D_PENTA[(5 + step) % D_PENTA.length] + 12, seed, 0.9), hit: 0 }),
  count: ({ seed, dur = 1.2, step = 0 }) => {
    // Rising wood ticks through the count, a harmonic on the final value (the hit is the final value).
    const ticks = Math.max(3, Math.min(14, Math.round(dur * 8)))
    const parts = []
    for (let i = 0; i < ticks; i++) parts.push([(i / ticks) * dur, tick(D_PENTA[(i + step) % 6] + 12, seed + i, 0.35 + 0.4 * (i / ticks))])
    parts.push([dur, pluckHarm(86, 0.9)])
    return { buf: layer(dur + 1.6, parts), hit: dur }
  },
  seal: ({ seed }) => {
    // Seal stamp: a short pressure swell, then a dull wooden thump and paper rustle at the hit.
    const pre = 0.08
    const thump = mul(osc('sine', (t) => sweep(180, 70, 0.06, t), samples(0.25)), perc(samples(0.25), 0.001, 0.05))
    const rustle = filter(mul(noise(samples(0.12), seed), perc(samples(0.12), 0.001, 0.03)), 'bandpass', 1800, 1)
    return { buf: layer(0.6, [[0, sweptHiss(pre, seed + 1, () => 500, 1, swell(0.95, 2)), 0.3], [pre, thump, 1], [pre, rustle, 0.5], [pre, tick(69, seed, 0.6)]]), hit: pre }
  },
  route: ({ seed, dur = 1.5 }) => {
    // A brush dragged along a route: hiss that rises in pitch, a soft tick at the destination (the hit).
    const n = samples(dur)
    const drag = sweepFilter(mul(noise(n, seed), swell(0.85, 1.2)(n)), 'bandpass', (t) => sweep(500, 2400, dur, t), 2)
    return { buf: layer(dur + 1.0, [[0, drag, 0.7], [dur, tick(81, seed, 0.8)], [dur, pluckHarm(74, 0.5)]]), hit: 0 }
  },
  reveal: ({ seed }) => {
    // Reverse-swell into the hit (the climax lands on the downbeat).
    const pre = 0.6
    const rise = sweptHiss(pre, seed, (t) => sweep(400, 3600, pre, t), 1, swell(0.98, 2.2))
    return { buf: layer(pre + 1.6, [[0, rise, 0.6], [pre, drum(seed, 0.8)], [pre, pluckHarm(74, 0.7)]]), hit: pre }
  },
  brush: ({ seed, dur = 0.6 }) => ({ buf: brushSwish(Math.max(0.15, Math.min(1.2, dur)), seed, 1200, 4200), hit: 0 }),
  scroll: ({ seed, dur = 0.9 }) => {
    // Scroll unrolling: a turning-paper flutter with a soft wooden roll at the end.
    const n = samples(dur)
    const flutter = sweepFilter(mul(noise(n, seed), swell(0.5, 1.3)(n)), 'bandpass', (t) => 1600 + 700 * Math.sin(TAU * 9 * t), 1.6)
    return { buf: layer(dur + 0.4, [[0, flutter, 0.8], [dur * 0.85, tick(57, seed, 0.5)]]), hit: 0 }
  },
}
const peak = (buf) => { let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i])); return m || 1 }
/**
 * Renders one cue: { kind, tier, dur?, step?, seed } -> { buf (normalised to the tier peak), hit }.
 * Tiers add layers at the hit: emphasis a theme-scale harmonic, climax a frame drum and a bell.
 */
export function renderCue({ kind, tier = 'normal', dur, step = 0, seed = 1, tierDb = TIER_DB }) {
  const recipe = R[kind]
  if (!recipe) throw new Error(`unknown sfx kind: ${kind}`)
  const { buf, hit } = recipe({ seed, dur, step })
  let out = buf
  if (tier !== 'normal') {
    const extra = [[0, out, 1], [hit, pluckHarm(D_PENTA[(step + 3) % D_PENTA.length] + 12, tier === 'climax' ? 0.6 : 0.45)]]
    if (tier === 'climax') extra.push([hit, drum(seed + 7, 0.9)], [hit, bell({ pitch: 62, vel: 0.9, seed })])
    out = layer(Math.max(buf.length / SR, hit + (tier === 'climax' ? 3.2 : 1.6)), extra)
  }
  const g = 10 ** ((tierDb[tier] ?? TIER_DB[tier]) / 20) / peak(out)
  return { buf: scale(out, g), hit }
}
