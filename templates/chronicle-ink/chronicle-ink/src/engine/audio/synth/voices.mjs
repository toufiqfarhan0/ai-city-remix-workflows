// Adapted copy of skills/sketchbook-film/src/sound/voices.mjs (same repository, MIT). Keep in step by hand.
// Instrument voices for the score. Each renders one note to a mono Float32Array:
//   VOICES[name]({ pitch (MIDI, ignored by drums), dur (s), vel (0..1), seed }) -> Float32Array
// Tones: Karplus-Strong pluck, glockenspiel, music box and marimba (modal partial sums), pad (detuned
// saws), bass, tuba; drums: kick, snare, hat, open hat, clap, shaker. Dependency-free.

import { SR, addInto, filter, mtof, noise, osc, perc, adsr, mul, samples, scale, sweep, sweepFilter } from './dsp.mjs'

const TAU = Math.PI * 2

/** Sum of exponentially decaying sine partials: [[ratio, amp, tau seconds], ...]. */
function modal(f, partials, n, detune = 0) {
  const out = new Float32Array(n)
  for (const [ratio, amp, tau] of partials) {
    const w = (TAU * f * ratio) / SR
    if (w >= Math.PI) continue
    const k = Math.exp(-1 / (tau * SR))
    let e = amp
    for (let i = 0; i < n; i++) { out[i] += e * Math.sin(w * i); e *= k }
    if (detune) {
      const w2 = w * (1 + detune)
      let e2 = amp * 0.5
      for (let i = 0; i < n; i++) { out[i] += e2 * Math.sin(w2 * i); e2 *= k }
    }
  }
  return out
}

/** Note-off: from `dur` on, fade to silence over `rel` seconds. */
function release(buf, dur, rel) {
  const s = samples(dur)
  const r = Math.max(1, samples(rel))
  for (let i = s; i < buf.length; i++) buf[i] *= Math.max(0, 1 - (i - s) / r)
  return buf
}

/** Strike transient: a few ms of filtered noise. */
function strike(n, ms, cutoff, seed, type = 'highpass') {
  const len = Math.min(n, samples(ms / 1000))
  const click = mul(noise(len, seed), perc(len, 0.0005, ms / 3000))
  return filter(click, type, cutoff, 0.7)
}

/** Karplus-Strong plucked string with an all-pass fractional delay for tuning. */
function pluck({ pitch, dur, vel = 0.8, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.7)
  const out = new Float32Array(n)
  const period = SR / f
  const N = Math.max(2, Math.floor(period - 0.5))
  const frac = period - 0.5 - N
  const c = (1 - frac) / (1 + frac)
  const line = noise(N, seed)
  // Softer attacks with lower velocity: low-pass the excitation.
  let lp = 0
  const bright = 0.35 + 0.5 * vel
  for (let i = 0; i < N; i++) { lp += bright * (line[i] - lp); line[i] = lp }
  const t60 = Math.min(3.2, 1.9 * Math.sqrt(220 / f))
  const held = 10 ** (-3 / (t60 * f))
  const muted = 10 ** (-3 / (0.15 * f))
  const offAt = samples(dur)
  let idx = 0
  let apX = 0
  let apY = 0
  for (let i = 0; i < n; i++) {
    const cur = line[idx]
    const next = line[(idx + 1) % N]
    const rho = i < offAt ? held : muted
    const avg = rho * 0.5 * (cur + next)
    // First-order all-pass: y = c*x + x1 - c*y1
    const y = c * avg + apX - c * apY
    apX = avg
    apY = y
    line[idx] = y
    out[i] = cur
    idx = (idx + 1) % N
  }
  return scale(out, 0.9)
}

function glock({ pitch, dur, vel = 0.8, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(Math.max(dur, 0.25) + 1.6)
  // Free-free bar modes: (beta_n / beta_1)^2 with beta = 4.730, 7.853, 10.996 -> 1, 2.7565, 5.4039.
  const out = modal(f, [[1, 1, 1.25], [2.7565, 0.34, 0.5], [5.4039, 0.13, 0.22]], n)
  addInto(out, strike(n, 4, 5200, seed), 0.12 * vel)
  return scale(out, 0.55)
}

function musicBox({ pitch, dur, vel = 0.8, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(Math.max(dur, 0.2) + 1.3)
  const out = modal(f, [[1, 1, 1.05], [2.0, 0.16, 0.42], [3.01, 0.07, 0.28], [5.43, 0.1, 0.11]], n, 0.0016)
  addInto(out, strike(n, 3, 6500, seed), 0.08 * vel)
  return scale(out, 0.5)
}

function marimba({ pitch, dur, vel = 0.8, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(Math.max(dur, 0.2) + 0.7)
  const out = modal(f, [[1, 1, 0.5], [3.94, 0.24, 0.11], [9.3, 0.06, 0.045]], n)
  addInto(out, strike(n, 7, 2200, seed, 'lowpass'), 0.35 * vel)
  return scale(out, 0.7)
}

/** Three detuned saws and a sub-octave sine through a slowly breathing low-pass. */
function pad({ pitch, dur, seed = 1 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.9)
  const out = new Float32Array(n)
  for (const cents of [-7, 0, 7]) addInto(out, osc('saw', f * 2 ** (cents / 1200), n, ((seed * 0.137 + cents / 31) % 1 + 1) % 1), 0.22)
  addInto(out, osc('sine', f / 2, n), 0.3)
  sweepFilter(out, 'lowpass', (t) => f * (3.2 + 0.9 * Math.sin(TAU * 0.17 * t)), 0.6)
  return mul(out, adsr(n, 0.55, 0.4, 0.78, 0.9))
}

function bass({ pitch, dur, vel = 0.8 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.15)
  const out = osc('tri', f, n)
  addInto(out, osc('sine', f, n), 0.55)
  sweepFilter(out, 'lowpass', (t) => sweep(f * (5 + 4 * vel), f * 2.2, 0.25, t), 0.8)
  mul(out, perc(n, 0.003, 0.42))
  return scale(release(out, dur, 0.12), 0.6)
}

/** Brass-like saw with an opening filter and delayed vibrato. */
function tuba({ pitch, dur, vel = 0.8 }) {
  const f = mtof(pitch)
  const n = samples(dur + 0.14)
  const vib = (t) => f * 2 ** ((t > 0.16 ? 7 * Math.sin(TAU * 5.2 * (t - 0.16)) : 0) / 1200)
  const out = osc('saw', vib, n)
  sweepFilter(out, 'lowpass', (t) => sweep(f * 1.3, f * (2.4 + 2 * vel), 0.09, t), 0.9)
  return scale(mul(out, adsr(n, 0.035, 0.14, 0.72, 0.13)), 0.55)
}

// ---------- drums ----------

function kick({ vel = 0.9, seed = 1 }) {
  const n = samples(0.45)
  const body = mul(osc('sine', (t) => sweep(150, 46, 0.12, t), n), perc(n, 0.001, 0.15))
  addInto(body, strike(n, 2, 3000, seed), 0.25)
  return scale(body, 0.95 * vel)
}

function snare({ vel = 0.8, seed = 1 }) {
  const n = samples(0.3)
  const rattle = filter(mul(noise(n, seed), perc(n, 0.001, 0.085)), 'bandpass', 2400, 0.8)
  addInto(rattle, mul(osc('sine', 196, n), perc(n, 0.001, 0.05)), 0.5)
  return scale(rattle, 1.1 * vel)
}

function hat({ vel = 0.5, seed = 1, open = false }) {
  const n = samples(open ? 0.4 : 0.12)
  const out = filter(mul(noise(n, seed), perc(n, 0.0005, open ? 0.12 : 0.028)), 'highpass', 7500, 0.7)
  return scale(out, 0.55 * vel)
}

function clap({ vel = 0.7, seed = 1 }) {
  const n = samples(0.35)
  const src = noise(n, seed)
  const env = new Float32Array(n)
  for (const ms of [0, 11, 23]) addInto(env, perc(samples(0.03), 0.0005, 0.005), 1, samples(ms / 1000))
  addInto(env, perc(n, 0.002, 0.075), 0.7, samples(0.03))
  const out = filter(mul(src, env), 'bandpass', 1300, 1.1)
  return scale(out, 1.4 * vel)
}

function shaker({ vel = 0.4, seed = 1 }) {
  const n = samples(0.14)
  return scale(filter(mul(noise(n, seed), perc(n, 0.015, 0.04)), 'bandpass', 6000, 1.2), 0.7 * vel)
}

export const VOICES = Object.freeze({
  pluck, glock, musicBox, marimba, pad, bass, tuba,
  kick, snare, hat, openHat: (o) => hat({ ...o, open: true }), clap, shaker,
})
export const DRUMS = Object.freeze(['kick', 'snare', 'hat', 'openHat', 'clap', 'shaker'])

/** Renders one note event; unknown voices throw. */
export function renderNote(voice, note) {
  const fn = VOICES[voice]
  if (!fn) throw new Error(`unknown voice: ${voice}`)
  return fn(note)
}
