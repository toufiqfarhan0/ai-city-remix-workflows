// The series theme of the roman style ("Roman Theme"): a soft, warm tune in D dorian at the same
// 88 BPM and with the same sections and beat map as the ink theme (audio/theme.mjs), so scripts,
// timelines and checks are identical across styles. Voices: lyre-like plucks, a warm string pad, a low
// soft flute, a distant horn on the drops and a soft low drum. No hi-hats, shakers or woodblocks, and
// the whole bus is rolled off above 6 kHz: the style is meant to sit gently under captions.
// Deterministic: same seconds -> same samples.
import { SR, Biquad, Stereo, addInto, adsr, dbToGain, filter, freeverb, integratedLoudness, mtof, mul, noise, osc, perc, samples, scale, sweep, compress, softClip } from './synth/dsp.mjs'
import { VOICES } from './synth/voices.mjs'
import { arrangement, THEME } from '../story/beatsheet.mjs'
const TAU = Math.PI * 2
// D dorian motifs ([midi, start beat, length beats] over two bars), one octave lower than the ink theme.
const M1 = [[62, 0, 1.5], [64, 1.5, 0.5], [65, 2, 1], [69, 3, 1], [67, 4, 1.5], [65, 5.5, 0.5], [64, 6, 2]]
const M2 = [[69, 0, 1], [71, 1, 1], [72, 2, 1.5], [71, 3.5, 0.5], [69, 4, 1], [67, 5, 1], [69, 6, 2]]
const M3 = [[74, 0, 2], [72, 2, 1], [71, 3, 1], [69, 4, 2], [65, 6, 1], [62, 7, 1]]
// Four-bar progression: Dm – C – Bb – A(sus) as roots and pad voicings.
const ROOTS = [38, 36, 34, 33]
const PADS = [[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 62, 64]]
const ARP = [[0, 1, 2, 1, 0, 1, 2, 1], [0, 2, 1, 2, 0, 2, 1, 2]]

/** Lyre: Karplus-Strong pluck, low-passed and short. */
function lyre({ pitch, dur, vel = 0.6, seed = 1 }) {
  const out = VOICES.pluck({ pitch, dur: Math.min(dur, 1.6), vel: vel * 0.5, seed })
  return scale(filter(out, 'lowpass', Math.min(2600, mtof(pitch) * 4), 0.7), 0.7)
}
/** Soft flute: sine with a slow attack and a little second harmonic, no breath noise. */
function flute({ pitch, dur, vel = 0.6 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.3)
  const vib = (t) => f * 2 ** ((t > 0.35 ? 6 * Math.sin(TAU * 4.6 * (t - 0.35)) * Math.min(1, (t - 0.35) * 1.5) : 0) / 1200)
  const tone = osc('sine', vib, n)
  addInto(tone, osc('sine', (t) => vib(t) * 2, n), 0.08)
  return scale(mul(tone, adsr(n, 0.16, 0.2, 0.85, 0.3)), 0.36 * vel)
}
/** Distant horn (cornu-like): low saw softened by a low-pass, slow swell. */
function horn({ pitch, dur, vel = 0.6, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.4)
  const tone = osc('saw', f, n)
  addInto(tone, osc('saw', f * 1.004, n), 0.6)
  const soft = filter(tone, 'lowpass', 900, 0.6)
  addInto(soft, filter(noise(n, seed), 'lowpass', 400, 0.7), 0.02)
  return scale(mul(soft, adsr(n, 0.35, 0.2, 0.8, 0.4)), 0.22 * vel)
}
/** Soft low drum: a round, short tom with no click. */
function drum({ vel = 0.7 }) {
  const n = samples(0.8)
  const body = mul(osc('sine', (t) => sweep(92, 48, 0.2, t), n), perc(n, 0.004, 0.28))
  return scale(filter(body, 'lowpass', 500, 0.7), vel * 0.9)
}
/** Small bell for section starts, low and short. */
function chime({ pitch, vel = 0.5 }) {
  const f = mtof(pitch)
  const n = samples(2.4)
  const out = new Float32Array(n)
  for (const [r, a, tau] of [[1, 1, 1.1], [2.0, 0.3, 0.6], [3.0, 0.1, 0.3]]) addInto(out, mul(osc('sine', f * r, n), perc(n, 0.004, tau)), a)
  return scale(out, 0.25 * vel)
}
const INSTR = { lyre, flute, horn, drum, chime, pad: VOICES.pad, bass: VOICES.bass }
const LEVEL = { lyre: [0.5, 0.35], flute: [0.5, 0.45], horn: [0.45, 0.5], drum: [0.65, 0.15], chime: [0.4, 0.5], pad: [0.24, 0.5], bass: [0.32, 0] }

/** Note events: [{ t, voice, pitch, dur, vel, pan, seed }] for a film length. */
export function romanThemeEvents(seconds) {
  const arr = arrangement(seconds)
  const beatS = 60 / THEME.bpm
  const ev = []
  const add = (voice, t, pitch, durBeats, vel, pan = 0) => ev.push({ t, voice, pitch, dur: durBeats * beatS, vel, pan })
  const motif = (m, bar0, voice, vel, transpose = 0, pan = 0) => { for (const [p, b, d] of m) add(voice, (bar0 * 4 + b) * beatS, p + transpose, d, vel, pan) }
  for (const sec of arr.sections) {
    for (let k = 0; k < sec.bars; k++) {
      const bar = sec.start_bar + k
      const t0 = bar * 4 * beatS
      const h = bar % 4
      const id = sec.id
      const phrase = Math.floor(k / 2) % 4
      const drop = id === 'drop' || id === 'drop2'
      if (!(id === 'outro' && k >= sec.bars - 2)) add('pad', t0, PADS[h][0] - 12, 4, id === 'breakdown' ? 0.8 : 0.6)
      if (id === 'intro') {
        for (const [i, p] of PADS[h].entries()) add('lyre', t0 + i * beatS, p - 12, 3, 0.5, -0.2 + i * 0.2)
        if (k === 0) add('chime', t0, 62, 4, 0.6)
        continue
      }
      if (['verse', 'build', 'build2', 'drop', 'drop2'].includes(id)) {
        add('bass', t0, ROOTS[h], 2, drop ? 0.7 : 0.5)
        const pat = ARP[bar % 2]
        const cl = [PADS[h][0] - 12, PADS[h][1] - 12, PADS[h][2] - 12]
        for (let i = 0; i < 8; i++) add('lyre', t0 + i * 0.5 * beatS, cl[pat[i]], 0.5, i % 2 ? 0.38 : 0.5, i % 2 ? 0.25 : -0.25)
      }
      if (k % 2 === 0) {
        if (id === 'verse' && phrase % 2 === 1) motif(phrase === 1 ? M1 : M2, bar, 'flute', 0.55, 12, 0.1)
        if (id === 'build' || id === 'build2') motif(M1, bar, 'flute', 0.5, 12)
        if (drop) { motif(phrase % 2 ? M2 : M1, bar, 'flute', 0.75, 12, 0.1); add('horn', t0, ROOTS[h] + 12, 8, 0.6, -0.1) }
        if (id === 'drop2' && phrase % 2) motif(M3, bar, 'chime', 0.4, 0, 0.3)
        if (id === 'breakdown') motif(phrase % 2 ? M3 : M1, bar, 'flute', 0.5, 0, 0)
        if (id === 'outro' && k < sec.bars - 2) motif(k === 0 ? M1 : M3, bar, 'lyre', 0.55, 12)
      }
      if (id === 'verse') { add('drum', t0, 0, 1, 0.45); if (k % 2) add('drum', t0 + 2.5 * beatS, 0, 0.5, 0.3) }
      else if (id === 'build' || id === 'build2') { const rise = (k + 1) / sec.bars; for (let i = 0; i < 4; i++) add('drum', t0 + i * beatS, 0, 1, 0.3 + 0.35 * rise) }
      else if (drop) { add('drum', t0, 0, 1, 0.75); add('drum', t0 + 2 * beatS, 0, 1, 0.6); if (k === 0) add('chime', t0, 62, 4, 0.7) }
      else if (id === 'breakdown') { if (k % 4 === 0) add('drum', t0, 0, 1, 0.4) }
      else if (id === 'outro') {
        if (k === 0) add('drum', t0, 0, 1, 0.55)
        if (k === sec.bars - 2) { add('chime', t0, 62, 4, 0.6); for (const p of [50, 57, 62, 65]) add('lyre', t0, p, 8, 0.5); add('pad', t0, 50, 8, 0.6) }
      }
    }
  }
  return ev.sort((a, b) => a.t - b.t || (a.voice < b.voice ? -1 : 1))
}

/** Renders the roman theme to a stereo bus at about −16 LUFS. */
export function renderRomanTheme(seconds) {
  const n = samples(seconds)
  const bus = new Stereo(n)
  const send = new Stereo(n)
  const cache = new Map()
  for (const e of romanThemeEvents(seconds)) {
    const key = `${e.voice}:${e.pitch}:${e.dur.toFixed(4)}:${Math.round(e.vel * 32)}`
    let buf = cache.get(key)
    if (!buf) { buf = INSTR[e.voice]({ pitch: e.pitch, dur: e.dur, vel: e.vel, seed: 1 + (e.pitch % 17) }); cache.set(key, buf) }
    const [level, verb] = LEVEL[e.voice]
    bus.add(buf, e.t, level * e.vel, e.pan)
    if (verb) send.add(buf, e.t, level * e.vel * verb, e.pan)
  }
  bus.addStereo(freeverb(send, { room: 0.86, damp: 0.6, width: 0.9 }), 0.55)
  for (const ch of [bus.L, bus.R]) {
    new Biquad('highpass', 35, 0.707).process(ch)
    new Biquad('lowpass', 6000, 0.6).process(ch)
  }
  const g = dbToGain(-16 - integratedLoudness(bus))
  for (let i = 0; i < n; i++) { bus.L[i] *= g; bus.R[i] *= g }
  compress(bus, { threshold: -14, ratio: 2, attack: 0.01, release: 0.25, knee: 8 })
  softClip(bus, 1)
  const fi = samples(0.3), fo = samples(2)
  for (let i = 0; i < n; i++) {
    let k = 1
    if (i < fi) k = i / fi
    if (i > n - fo) k *= Math.max(0, (n - i) / fo)
    bus.L[i] *= k; bus.R[i] *= k
  }
  return bus
}
export { SR }
