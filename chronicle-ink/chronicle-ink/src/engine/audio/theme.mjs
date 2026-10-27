// The series theme of the ink style ("Ink Theme"): one fixed, code-synthesized tune in D gong
// pentatonic (D E F# A B) at 88 BPM, with guqin-like plucks, a xiao-like breathy flute, low frame drums,
// woodblock, a string pad and a bell. It is the recognisable signature of every ink film, so it is not
// re-composed per film: the arrangement only repeats or trims sections at bar boundaries for 120 / 150 /
// 180 s (story/beatsheet.mjs ARRANGEMENTS), and the authored beat map (exact beats, downbeats and
// section starts) is written next to the WAV. Deterministic: same seconds -> same samples.
import { SR, Biquad, Stereo, addInto, adsr, dbToGain, filter, freeverb, integratedLoudness, mtof, mul, noise, osc, perc, samples, scale, sweep, compress, softClip } from './synth/dsp.mjs'
import { VOICES } from './synth/voices.mjs'
import { arrangement, THEME } from '../story/beatsheet.mjs'
const TAU = Math.PI * 2
export const BEATMAP_SCHEMA = 'chronicle-beatmap/1'
/** Pitches (MIDI) of D gong pentatonic used by the theme. */
export const SCALE = Object.freeze([50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86])
// Motifs: [midi, start beat, length beats] over two bars. M1 = call, M2 = answer.
const M1 = [[69, 0, 1], [71, 1, 0.5], [74, 1.5, 0.5], [76, 2, 1.5], [74, 3.5, 0.5], [71, 4, 1], [69, 5, 0.5], [66, 5.5, 0.5], [69, 6, 2]]
const M2 = [[74, 0, 1], [76, 1, 0.5], [78, 1.5, 0.5], [81, 2, 1], [78, 3, 1], [76, 4, 1], [74, 5, 0.5], [71, 5.5, 0.5], [74, 6, 2]]
const M3 = [[78, 0, 1.5], [76, 1.5, 0.5], [74, 2, 1], [71, 3, 1], [69, 4, 1.5], [71, 5.5, 0.5], [62, 6, 2]]
// Four-bar harmony loop: roots and pentatonic pad clusters.
const ROOTS = [38, 47, 40, 45]
const PADS = [[62, 69, 76], [59, 66, 74], [64, 71, 76], [57, 64, 71]]
// Guqin ostinato per bar (eighth notes, index into the bar's pad cluster an octave down + passing tones).
const OSTINATO = [[0, 2, 1, 2, 0, 2, 1, 3], [0, 1, 2, 1, 0, 1, 2, 3]]
// ---------- instruments ----------
/** Guqin-like pluck: darker Karplus-Strong string plus a soft body resonance. */
function guqin({ pitch, dur, vel = 0.7, seed = 1 }) {
  const out = VOICES.pluck({ pitch, dur, vel: vel * 0.55, seed })
  const body = filter(Float32Array.from(out), 'lowpass', mtof(pitch) * 2.2, 0.7)
  addInto(out, body, 0.6)
  return scale(out, 0.75)
}
/** Harmonic (fanyin): a bell-like pure partial pair. */
function harmonic({ pitch, dur, vel = 0.6 }) {
  const f = mtof(pitch)
  const n = samples(Math.max(dur, 0.3) + 1.4)
  const out = mul(osc('sine', f, n), perc(n, 0.002, 0.9))
  addInto(out, mul(osc('sine', f * 2, n), perc(n, 0.002, 0.35)), 0.25)
  return scale(out, 0.35 * vel)
}
/** Xiao-like flute: breathy sine with delayed vibrato and band-passed breath noise. */
function xiao({ pitch, dur, vel = 0.6, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.25)
  const vib = (t) => f * 2 ** ((t > 0.25 ? 9 * Math.sin(TAU * 5 * (t - 0.25)) * Math.min(1, (t - 0.25) * 2) : 0) / 1200)
  const tone = osc('sine', vib, n)
  addInto(tone, osc('sine', (t) => vib(t) * 2, n), 0.12)
  const breath = filter(noise(n, seed), 'bandpass', f * 2, 2.5)
  addInto(tone, breath, 0.22)
  return scale(mul(tone, adsr(n, 0.09, 0.15, 0.82, 0.22)), 0.42 * vel)
}
/** Low frame drum: pitched skin with a long body. */
function frameDrum({ vel = 0.8, seed = 1, low = false }) {
  const n = samples(0.9)
  const body = mul(osc('sine', (t) => sweep(low ? 96 : 130, low ? 44 : 62, 0.18, t), n), perc(n, 0.002, low ? 0.32 : 0.2))
  addInto(body, filter(mul(noise(n, seed), perc(n, 0.001, 0.03)), 'lowpass', 900, 0.8), 0.35)
  return scale(body, vel)
}
/** Woodblock: two short inharmonic modes. */
function woodblock({ vel = 0.5, pitch = 81 }) {
  const f = mtof(pitch)
  const n = samples(0.18)
  const out = mul(osc('sine', f, n), perc(n, 0.0005, 0.03))
  addInto(out, mul(osc('sine', f * 2.73, n), perc(n, 0.0005, 0.012)), 0.4)
  return scale(out, 0.5 * vel)
}
/** Bronze bell (bianzhong-like) with inharmonic partials. */
export function bell({ pitch, vel = 0.6, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(3.2)
  const out = new Float32Array(n)
  for (const [r, a, tau] of [[1, 1, 1.4], [2.41, 0.45, 0.8], [3.88, 0.25, 0.45], [5.4, 0.12, 0.25]]) addInto(out, mul(osc('sine', f * r, n), perc(n, 0.001, tau)), a)
  addInto(out, filter(mul(noise(samples(0.02), seed), perc(samples(0.02), 0.0005, 0.004)), 'highpass', 3000, 0.7), 0.2)
  return scale(out, 0.32 * vel)
}
const INSTR = { guqin, harmonic, xiao, frameDrum, frameLow: (o) => frameDrum({ ...o, low: true }), woodblock, bell, pad: VOICES.pad, bass: VOICES.bass, hat: VOICES.hat, shaker: VOICES.shaker }
/** Mix level and reverb send per instrument. */
const LEVEL = { guqin: [0.55, 0.25], harmonic: [0.5, 0.5], xiao: [0.55, 0.35], frameDrum: [0.7, 0.1], frameLow: [0.95, 0.12], woodblock: [0.35, 0.2], bell: [0.5, 0.45], pad: [0.16, 0.4], bass: [0.4, 0], hat: [0.14, 0.05], shaker: [0.18, 0.05] }
// ---------- score ----------
/**
 * Note events of the theme for a film length: [{ t, voice, pitch, dur, vel, pan, seed }].
 * Sections come from the arrangement; every section is written bar by bar, so repeating or trimming a
 * section only changes how many of its bars are played.
 */
export function themeEvents(seconds) {
  const arr = arrangement(seconds)
  const beatS = 60 / THEME.bpm
  const ev = []
  const add = (voice, t, pitch, durBeats, vel, pan = 0) => ev.push({ t, voice, pitch, dur: durBeats * beatS, vel, pan, seed: (ev.length * 7919) % 9973 + 1 })
  const motif = (m, bar0, voice, vel, transpose = 0, pan = 0) => {
    for (const [p, b, d] of m) add(voice, (bar0 * 4 + b) * beatS, p + transpose, d, vel, pan)
  }
  for (const sec of arr.sections) {
    for (let k = 0; k < sec.bars; k++) {
      const bar = sec.start_bar + k
      const t0 = bar * 4 * beatS
      const h = bar % 4
      const lastBar = k === sec.bars - 1
      const phrase = Math.floor(k / 2) % 4
      const id = sec.id
      if (id === 'intro') {
        for (const [i, p] of PADS[h].entries()) add('guqin', t0 + i * 0.5 * beatS, p - 12, 3, 0.55, -0.2 + i * 0.2)
        if (k % 2 === 0) add('xiao', t0 + 2 * beatS, PADS[h][2], 2, 0.45, 0.15)
        add('pad', t0, PADS[h][0] - 12, 4, 0.5)
        if (lastBar) for (let i = 0; i < 4; i++) add('frameDrum', t0 + (2 + i * 0.5) * beatS, 0, 0.5, 0.25 + i * 0.12)
        continue
      }
      // Harmony bed for every other section.
      if (id !== 'outro' || k < sec.bars - 2) add('pad', t0, PADS[h][0] - 12, 4, id === 'breakdown' ? 0.75 : 0.55)
      if (['verse', 'build', 'build2', 'drop', 'drop2'].includes(id)) add('bass', t0, ROOTS[h], id.startsWith('drop') ? 1.5 : 2, id.startsWith('drop') ? 0.85 : 0.6)
      if (id.startsWith('drop')) add('bass', t0 + 2 * beatS, ROOTS[h], 1.5, 0.75)
      // Guqin ostinato.
      if (['verse', 'build', 'build2', 'drop', 'drop2'].includes(id)) {
        const pat = OSTINATO[bar % 2]
        const cluster = [PADS[h][0] - 12, PADS[h][1] - 12, PADS[h][2] - 12, PADS[h][1]]
        for (let i = 0; i < 8; i++) add('guqin', t0 + i * 0.5 * beatS, cluster[pat[i]], 0.5, (i % 2 ? 0.45 : 0.6) * (id.startsWith('drop') ? 1.1 : 1), i % 2 ? 0.25 : -0.25)
      }
      // Melody: motifs on two-bar phrases.
      if (k % 2 === 0) {
        if (id === 'verse' && phrase % 2 === 1) motif(phrase === 1 ? M1 : M2, bar, 'xiao', 0.5, 0, 0.1)
        if (id === 'build' || id === 'build2') motif(M1, bar, 'harmonic', 0.6, 12)
        if (id === 'drop' || id === 'drop2') {
          motif(phrase % 2 ? M2 : M1, bar, 'xiao', 0.85, 0, 0.1)
          motif(phrase % 2 ? M2 : M1, bar, 'guqin', 0.7, 0, -0.15)
        }
        if (id === 'drop2' && phrase % 2) motif(M3, bar, 'bell', 0.55, 0, 0.3)
        if (id === 'breakdown') motif(phrase % 2 ? M3 : M1, bar, 'xiao', 0.6, -12 + 12, 0)
        if (id === 'outro' && k < sec.bars - 2) motif(k === 0 ? M1 : M3, bar, 'guqin', 0.6)
      }
      if (id === 'breakdown' && k % 2 === 1) add('harmonic', t0 + 2 * beatS, PADS[h][2] + 12, 2, 0.5, 0.3)
      // Drums.
      if (id === 'verse') {
        add('frameLow', t0, 0, 1, 0.55)
        add('frameDrum', t0 + 2.5 * beatS, 0, 0.5, 0.35)
        for (let i = 1; i < 8; i += 2) add('woodblock', t0 + i * 0.5 * beatS, 81, 0.25, 0.35, 0.4)
        if (k % 4 === 3) add('frameDrum', t0 + 3.5 * beatS, 0, 0.5, 0.4)
      } else if (id === 'build' || id === 'build2') {
        const rise = (k + 1) / sec.bars
        for (let i = 0; i < 8; i++) add('frameDrum', t0 + i * 0.5 * beatS, 0, 0.5, 0.25 + 0.5 * rise * (i / 8 + 0.5))
        add('frameLow', t0, 0, 1, 0.6)
        for (let i = 0; i < 16; i++) add('shaker', t0 + i * 0.25 * beatS, 0, 0.25, 0.3 + 0.4 * rise)
        if (lastBar) for (let i = 0; i < 8; i++) add('frameDrum', t0 + (2 + i * 0.25) * beatS, 0, 0.25, 0.5 + i * 0.06)
      } else if (id === 'drop' || id === 'drop2') {
        add('frameLow', t0, 0, 1, 1)
        add('frameLow', t0 + 2 * beatS, 0, 1, 0.85)
        add('frameDrum', t0 + 1 * beatS, 0, 1, 0.7)
        add('frameDrum', t0 + 3 * beatS, 0, 1, 0.7)
        add('frameDrum', t0 + 3.5 * beatS, 0, 0.5, 0.45)
        for (let i = 0; i < 8; i++) add('hat', t0 + i * 0.5 * beatS, 0, 0.5, i % 2 ? 0.5 : 0.3)
        if (k === 0) add('bell', t0, 62, 4, 0.8)
      } else if (id === 'breakdown') {
        if (k % 4 === 0) add('frameLow', t0, 0, 1, 0.45)
      } else if (id === 'outro') {
        if (k === 0) add('frameLow', t0, 0, 1, 0.7)
        if (k === sec.bars - 2) {
          add('bell', t0, 62, 4, 0.7)
          for (const p of [50, 57, 62, 69]) add('guqin', t0, p, 8, 0.6)
          add('pad', t0, 50, 8, 0.6)
        }
      }
    }
  }
  return ev.sort((a, b) => a.t - b.t || (a.voice < b.voice ? -1 : 1))
}
/** Exact beat map for a film length. */
export function beatMap(seconds) {
  const arr = arrangement(seconds)
  const beatS = 60 / THEME.bpm
  const total = arr.total_bars * 4
  const r6 = (x) => Math.round(x * 1e6) / 1e6
  const beats = Array.from({ length: total }, (_, i) => r6(i * beatS))
  return {
    schema: BEATMAP_SCHEMA,
    theme: THEME.id,
    bpm: THEME.bpm,
    key: THEME.key,
    beats_per_bar: 4,
    seconds,
    beat_s: r6(beatS),
    bar_s: r6(beatS * 4),
    total_bars: arr.total_bars,
    beats,
    downbeats: beats.filter((_, i) => i % 4 === 0),
    sections: arr.sections.map((s) => ({ id: s.id, start_bar: s.start_bar, bars: s.bars, start: r6(s.start_bar * 4 * beatS), end: r6((s.start_bar + s.bars) * 4 * beatS) })),
  }
}
/** Renders the theme to a stereo bus at about −16 LUFS (final loudness is set after the SFX mix). */
export function renderTheme(seconds) {
  const n = samples(seconds)
  const bus = new Stereo(n)
  const send = new Stereo(n)
  const cache = new Map()
  for (const e of themeEvents(seconds)) {
    const key = `${e.voice}:${e.pitch}:${e.dur.toFixed(4)}:${Math.round(e.vel * 32)}`
    let buf = cache.get(key)
    if (!buf) {
      buf = INSTR[e.voice]({ pitch: e.pitch, dur: e.dur, vel: e.vel, seed: 1 + (e.pitch % 17) })
      cache.set(key, buf)
    }
    const [level, verb] = LEVEL[e.voice]
    bus.add(buf, e.t, level * e.vel, e.pan)
    if (verb) send.add(buf, e.t, level * e.vel * verb, e.pan)
  }
  bus.addStereo(freeverb(send, { room: 0.84, damp: 0.5, width: 0.9 }), 0.6)
  new Biquad('highpass', 30, 0.707).process(bus.L)
  new Biquad('highpass', 30, 0.707).process(bus.R)
  const g = dbToGain(-16 - integratedLoudness(bus))
  for (let i = 0; i < n; i++) { bus.L[i] *= g; bus.R[i] *= g }
  compress(bus, { threshold: -12, ratio: 2.5, attack: 0.006, release: 0.2, knee: 6 })
  softClip(bus, 1)
  // Short fade-in and a 1.5 s fade-out so the film never ends on a hard edge.
  const fi = samples(0.01)
  const fo = samples(1.5)
  for (let i = 0; i < n; i++) {
    let k = 1
    if (i < fi) k = i / fi
    if (i > n - fo) k *= Math.max(0, (n - i) / fo)
    bus.L[i] *= k
    bus.R[i] *= k
  }
  return bus
}
export { SR }
