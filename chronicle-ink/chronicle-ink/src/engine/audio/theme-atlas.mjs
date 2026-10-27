// The series theme of the model style ("Atlas Theme"): a calm, modern documentary cue in D major at
// the same 88 BPM and with the same sections and beat map as the ink theme (audio/theme.mjs), so
// scripts, timelines and checks are identical across styles. Voices: a soft felt piano, a warm low pad,
// a round sub bass and, on the drops only, a muted low pulse. Progression I–V–vi–IV (D–A–Bm–G).
// No plucks, flutes, horns, hats or bells: the cue should sit under captions and not draw attention.
// Deterministic: same seconds -> same samples.
import { SR, Biquad, Stereo, addInto, adsr, dbToGain, filter, freeverb, integratedLoudness, mtof, mul, osc, perc, samples, scale, sweep, compress, softClip } from './synth/dsp.mjs'
import { VOICES } from './synth/voices.mjs'
import { arrangement, THEME } from '../story/beatsheet.mjs'
const TAU = Math.PI * 2
// Piano melodies in D major ([midi, start beat, length beats] over two bars, chords D | A then Bm | G).
const M1 = [[66, 0, 1.5], [69, 1.5, 0.5], [74, 2, 2], [73, 4, 1.5], [69, 5.5, 0.5], [64, 6, 2]]
const M2 = [[66, 0, 1], [69, 1, 1], [71, 2, 2], [74, 4, 1.5], [71, 5.5, 0.5], [67, 6, 2]]
const M3 = [[69, 0, 2], [66, 2, 2], [64, 4, 2], [62, 6, 2]]
const ROOTS = [38, 33, 35, 31]
const PADS = [[62, 66, 69], [61, 64, 69], [62, 66, 71], [62, 67, 71]]
const BROKEN = [0, 1, 2, 1]

/** Felt piano: a few decaying partials, the hammer softened by a low-pass; short release on note-off. */
function piano({ pitch, dur, vel = 0.6 }) {
  const f = mtof(pitch)
  const n = samples(Math.min(dur, 3) + 1.2)
  const out = new Float32Array(n)
  for (const [r, a, tau] of [[1, 1, 1.6], [2.001, 0.42, 0.9], [3.003, 0.16, 0.5], [4.006, 0.07, 0.3]]) {
    const w = (TAU * f * r) / SR
    if (w >= Math.PI) continue
    const k = Math.exp(-1 / (tau * SR))
    let e = a
    for (let i = 0; i < n; i++) { out[i] += e * Math.sin(w * i); e *= k }
  }
  const atk = samples(0.006)
  for (let i = 0; i < atk; i++) out[i] *= i / atk
  const off = samples(Math.min(dur, 3)), rel = samples(0.9)
  for (let i = off; i < n; i++) out[i] *= Math.max(0, 1 - (i - off) / rel)
  return scale(filter(out, 'lowpass', Math.min(3200, f * 6), 0.7), 0.34 * vel)
}
/** Warm pad: the shared detuned pad, darkened and with a slow swell. */
function pad({ pitch, dur, vel = 0.6, seed = 1 }) {
  const raw = VOICES.pad({ pitch, dur, vel, seed })
  const soft = filter(raw, 'lowpass', 1100, 0.6)
  return mul(soft, adsr(soft.length, Math.min(1.2, dur * 0.4), 0.3, 0.9, 0.8))
}
/** Round sub bass: sine with a touch of second harmonic. */
function sub({ pitch, dur, vel = 0.6 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.3)
  const tone = osc('sine', f, n)
  addInto(tone, osc('sine', f * 2, n), 0.12)
  return scale(mul(tone, adsr(n, 0.04, 0.3, 0.75, 0.25)), 0.5 * vel)
}
/** Muted low pulse for the drops: a soft, click-free thump. */
function pulse({ vel = 0.6 }) {
  const n = samples(0.6)
  const body = mul(osc('sine', (t) => sweep(70, 42, 0.18, t), n), perc(n, 0.006, 0.22))
  return scale(filter(body, 'lowpass', 220, 0.7), vel)
}
const INSTR = { piano, pad, sub, pulse }
const LEVEL = { piano: [0.62, 0.5], pad: [0.22, 0.45], sub: [0.3, 0], pulse: [0.42, 0.08] }

/** Note events: [{ t, voice, pitch, dur, vel, pan }] for a film length. */
export function atlasThemeEvents(seconds) {
  const arr = arrangement(seconds)
  const beatS = 60 / THEME.bpm
  const ev = []
  const add = (voice, t, pitch, durBeats, vel, pan = 0) => ev.push({ t, voice, pitch, dur: durBeats * beatS, vel, pan })
  const motif = (m, bar0, vel, transpose = 0) => { for (const [p, b, d] of m) add('piano', (bar0 * 4 + b) * beatS, p + transpose, d, vel, 0.1) }
  for (const sec of arr.sections) {
    for (let k = 0; k < sec.bars; k++) {
      const bar = sec.start_bar + k
      const t0 = bar * 4 * beatS
      const h = bar % 4
      const id = sec.id
      const drop = id === 'drop' || id === 'drop2'
      const last2 = id === 'outro' && k >= sec.bars - 2
      if (!last2) add('pad', t0, PADS[h][0] - 12, 4, id === 'intro' ? 0.5 : drop ? 0.75 : 0.62)
      if (id === 'intro') {
        // a single held chord per bar, low and open
        add('piano', t0, ROOTS[h] + 12, 4, 0.45, -0.15)
        add('piano', t0 + 2 * beatS, PADS[h][2] - 12, 2, 0.32, 0.15)
        continue
      }
      if (!last2) add('sub', t0, ROOTS[h], 4, id === 'breakdown' ? 0.45 : drop ? 0.75 : 0.6)
      // broken chord in quarter notes (eighths on the drops), quiet, under everything
      const step = drop ? 0.5 : 1
      if (id !== 'outro') for (let i = 0; i < 4 / step; i++) add('piano', t0 + i * step * beatS, PADS[h][BROKEN[i % 4]] - 12, step * 1.5, (i % 2 ? 0.26 : 0.34) * (id === 'breakdown' ? 0.8 : 1), i % 2 ? 0.2 : -0.2)
      if (k % 2 === 0) {
        if (id === 'verse' && Math.floor(k / 2) % 2 === 1) motif(M1, bar, 0.42)
        if (id === 'build' || id === 'build2') motif(M2, bar, 0.46)
        if (drop) motif(Math.floor(k / 2) % 2 ? M2 : M1, bar, 0.58, 12)
        if (id === 'breakdown') motif(M3, bar, 0.4, 12)
        if (id === 'outro' && !last2) motif(k === 0 ? M1 : M3, bar, 0.45)
      }
      if (drop) { add('pulse', t0, 0, 1, 0.6); add('pulse', t0 + 2 * beatS, 0, 1, 0.45) }
      else if (id === 'build' || id === 'build2') { if (k === sec.bars - 1) for (let i = 0; i < 4; i++) add('pulse', t0 + i * beatS, 0, 1, 0.25 + 0.1 * i) }
      if (id === 'outro' && k === sec.bars - 2) { for (const p of [50, 57, 62, 66, 69]) add('piano', t0, p, 8, 0.4); add('pad', t0, 50, 8, 0.55); add('sub', t0, 38, 6, 0.5) }
    }
  }
  return ev.sort((a, b) => a.t - b.t || (a.voice < b.voice ? -1 : 1))
}

/** Renders the atlas theme to a stereo bus at about −16 LUFS. */
export function renderAtlasTheme(seconds) {
  const n = samples(seconds)
  const bus = new Stereo(n)
  const send = new Stereo(n)
  const cache = new Map()
  for (const e of atlasThemeEvents(seconds)) {
    const key = `${e.voice}:${e.pitch}:${e.dur.toFixed(4)}:${Math.round(e.vel * 32)}`
    let buf = cache.get(key)
    if (!buf) { buf = INSTR[e.voice]({ pitch: e.pitch, dur: e.dur, vel: e.vel, seed: 1 + (e.pitch % 17) }); cache.set(key, buf) }
    const [level, verb] = LEVEL[e.voice]
    bus.add(buf, e.t, level * e.vel, e.pan)
    if (verb) send.add(buf, e.t, level * e.vel * verb, e.pan)
  }
  bus.addStereo(freeverb(send, { room: 0.88, damp: 0.55, width: 1 }), 0.5)
  for (const ch of [bus.L, bus.R]) {
    new Biquad('highpass', 32, 0.707).process(ch)
    new Biquad('lowpass', 7000, 0.6).process(ch)
  }
  const g = dbToGain(-16 - integratedLoudness(bus))
  for (let i = 0; i < n; i++) { bus.L[i] *= g; bus.R[i] *= g }
  compress(bus, { threshold: -14, ratio: 2, attack: 0.015, release: 0.3, knee: 8 })
  softClip(bus, 1)
  const fi = samples(0.4), fo = samples(2.5)
  for (let i = 0; i < n; i++) {
    let k = 1
    if (i < fi) k = i / fi
    if (i > n - fo) k *= Math.max(0, (n - i) / fo)
    bus.L[i] *= k; bus.R[i] *= k
  }
  return bus
}
export { SR }
