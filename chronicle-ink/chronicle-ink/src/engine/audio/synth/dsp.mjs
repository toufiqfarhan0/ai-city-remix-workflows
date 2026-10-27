// Adapted copy of skills/sketchbook-film/src/sound/dsp.mjs (same repository, MIT). Keep in step by hand.
// Signal-processing building blocks for the procedural soundtrack: oscillators, envelopes, equal-power
// pan, frequency sweeps, LFOs, RBJ biquads, a Freeverb reverb, a ping-pong delay and a bus compressor.
// Dependency-free and Node 18 compatible. Everything renders offline at SR into Float32Arrays.

export const SR = 48000
const TAU = Math.PI * 2

/** Deterministic PRNG (mulberry32) -> () => [0, 1). */
export function rng(seed = 1) {
  let a = seed >>> 0 || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string (FNV-1a), for per-event seeds. */
export function hash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

export const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12)
export const dbToGain = (db) => 10 ** (db / 20)
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, g))
export const samples = (seconds) => Math.max(0, Math.round(seconds * SR))

/** Equal-power pan law: pan -1 (left) .. 1 (right) -> [gainL, gainR]; centre is -3 dB per side. */
export function panGains(pan = 0) {
  const p = Math.max(-1, Math.min(1, pan))
  const a = ((p + 1) * Math.PI) / 4
  return [Math.cos(a), Math.sin(a)]
}

/** Exponential sweep from f0 to f1 over `dur` seconds, evaluated at t (clamped). */
export function sweep(f0, f1, dur, t) {
  const x = Math.max(0, Math.min(1, t / Math.max(1e-6, dur)))
  return f0 * (f1 / f0) ** x
}

/** Sine LFO value at t: depth * sin(2π rate t + phase). */
export const lfo = (rate, depth, t, phase = 0) => depth * Math.sin(TAU * rate * t + phase)

// polyBLEP residual for band-limited saw and square waves.
function blep(p, dp) {
  if (p < dp) { const x = p / dp; return x + x - x * x - 1 }
  if (p > 1 - dp) { const x = (p - 1) / dp; return x * x + x + x + 1 }
  return 0
}

/**
 * Oscillator with a time-varying frequency.
 * @param kind  'sine' | 'tri' | 'saw' | 'square'
 * @param freq  number or (t seconds) => Hz
 * @param n     samples
 */
export function osc(kind, freq, n, phase = 0) {
  const out = new Float32Array(n)
  const f = typeof freq === 'function' ? freq : () => freq
  let p = phase
  for (let i = 0; i < n; i++) {
    const dp = Math.min(0.5, f(i / SR) / SR)
    let v
    if (kind === 'sine') v = Math.sin(TAU * p)
    else if (kind === 'tri') v = 1 - 4 * Math.abs(p - 0.5)
    else if (kind === 'saw') v = 2 * p - 1 - blep(p, dp)
    else v = (p < 0.5 ? 1 : -1) + blep(p, dp) - blep((p + 0.5) % 1, dp)
    out[i] = v
    p += dp
    if (p >= 1) p -= 1
  }
  return out
}

/** White noise, seeded. */
export function noise(n, seed = 1) {
  const r = rng(seed)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1
  return out
}

/** Attack/decay/sustain/release envelope over `n` samples (seconds; release ends at n). */
export function adsr(n, a, d, s, r) {
  const out = new Float32Array(n)
  const A = samples(a)
  const D = samples(d)
  const R = Math.min(n, samples(r))
  const relStart = n - R
  for (let i = 0; i < n; i++) {
    let v = i < A ? i / Math.max(1, A) : i < A + D ? 1 - (1 - s) * ((i - A) / Math.max(1, D)) : s
    if (i >= relStart) v *= 1 - (i - relStart) / Math.max(1, R)
    out[i] = v
  }
  return out
}

/** Percussive envelope: linear attack, exponential decay with time constant `tau` seconds. */
export function perc(n, attack, tau) {
  const out = new Float32Array(n)
  const A = Math.max(1, samples(attack))
  for (let i = 0; i < n; i++) out[i] = i < A ? i / A : Math.exp(-(i - A) / (tau * SR))
  // Short linear fade at the very end avoids a click when the buffer is cut.
  const fade = Math.min(n, 96)
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade
  return out
}

export const mul = (a, b) => { for (let i = 0; i < a.length; i++) a[i] *= b[i]; return a }
export const scale = (a, g) => { for (let i = 0; i < a.length; i++) a[i] *= g; return a }
/** a += b * g, from offset (in samples) on. */
export function addInto(a, b, g = 1, offset = 0) {
  const end = Math.min(a.length, offset + b.length)
  for (let i = Math.max(0, offset); i < end; i++) a[i] += b[i - offset] * g
  return a
}

/**
 * RBJ cookbook biquad. type: lowpass | highpass | bandpass | peaking | lowshelf | highshelf.
 * `process(buf)` filters in place; `step(x)` filters one sample. Coefficients can be retuned with set().
 */
export class Biquad {
  constructor(type, f0, q = 0.707, gainDb = 0) {
    this.type = type
    this.x1 = this.x2 = this.y1 = this.y2 = 0
    this.set(f0, q, gainDb)
  }
  set(f0, q = this.q, gainDb = this.gainDb ?? 0) {
    this.q = q
    this.gainDb = gainDb
    const w = (TAU * Math.min(f0, SR * 0.49)) / SR
    const cs = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    const A = 10 ** (gainDb / 40)
    let b0, b1, b2, a0, a1, a2
    switch (this.type) {
      case 'lowpass': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break
      case 'highpass': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break
      case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break
      case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; break
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha
        b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s)
        a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s
        break
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha
        b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s)
        a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s
        break
      }
      default: throw new Error(`unknown biquad type: ${this.type}`)
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0
    return this
  }
  step(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y
    return y
  }
  process(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = this.step(buf[i])
    return buf
  }
}

/** One-shot filter helper: returns `buf` filtered in place. */
export const filter = (buf, type, f0, q, gainDb) => new Biquad(type, f0, q, gainDb).process(buf)

/**
 * Filter with a cutoff that moves over time: (t seconds) => Hz, retuned every 32 samples.
 */
export function sweepFilter(buf, type, cutoff, q = 0.707) {
  const bq = new Biquad(type, cutoff(0), q)
  for (let i = 0; i < buf.length; i++) {
    if ((i & 31) === 0 && i) bq.set(cutoff(i / SR), q)
    buf[i] = bq.step(buf[i])
  }
  return buf
}

// Freeverb (public-domain Schroeder/Moorer design). The comb and all-pass delay lengths, the stereo
// spread and the gain/room/damp scaling are the standard published tuning at 44.1 kHz, rescaled to SR.
const FV = Object.freeze({
  combs: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617],
  allpasses: [556, 441, 341, 225],
  spread: 23,
  fixedGain: 0.015,
  scaleRoom: 0.28,
  offsetRoom: 0.7,
  scaleDamp: 0.4,
  allpassFeedback: 0.5,
})
export const FREEVERB_TUNING = FV

function freeverbChannel(input, out, offset, roomSize, damp) {
  const k = SR / 44100
  const feedback = roomSize * FV.scaleRoom + FV.offsetRoom
  const d = damp * FV.scaleDamp
  const combs = FV.combs.map((len) => ({ buf: new Float32Array(Math.round((len + offset) * k)), i: 0, store: 0 }))
  const aps = FV.allpasses.map((len) => ({ buf: new Float32Array(Math.round((len + offset) * k)), i: 0 }))
  for (let n = 0; n < input.length; n++) {
    const x = input[n]
    let acc = 0
    for (const c of combs) {
      const y = c.buf[c.i]
      c.store = y * (1 - d) + c.store * d
      c.buf[c.i] = x + c.store * feedback
      if (++c.i >= c.buf.length) c.i = 0
      acc += y
    }
    for (const a of aps) {
      const b = a.buf[a.i]
      a.buf[a.i] = acc + b * FV.allpassFeedback
      acc = b - acc
      if (++a.i >= a.buf.length) a.i = 0
    }
    out[n] = acc
  }
}

/**
 * Stereo Freeverb of a stereo send bus. Returns { L, R } wet signal only (100 % wet).
 * @param o.room 0..1, o.damp 0..1, o.width 0..1
 */
export function freeverb(send, { room = 0.78, damp = 0.42, width = 1 } = {}) {
  const n = send.L.length
  const mono = new Float32Array(n)
  for (let i = 0; i < n; i++) mono[i] = (send.L[i] + send.R[i]) * FV.fixedGain
  const wl = new Float32Array(n)
  const wr = new Float32Array(n)
  freeverbChannel(mono, wl, 0, room, damp)
  freeverbChannel(mono, wr, FV.spread, room, damp)
  const w1 = (width / 2 + 0.5) * 3 // scaleWet 3
  const w2 = ((1 - width) / 2) * 3
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  for (let i = 0; i < n; i++) { L[i] = wl[i] * w1 + wr[i] * w2; R[i] = wr[i] * w1 + wl[i] * w2 }
  return { L, R }
}

/**
 * Ping-pong delay: the left line feeds the right and back, with a one-pole low-pass in the loop.
 * Input is summed to mono and enters the left line. Returns the wet { L, R }.
 */
export function pingPong(send, { time = 0.25, feedback = 0.38, tone = 3000 } = {}) {
  const n = send.L.length
  const len = Math.max(1, samples(time))
  const dl = new Float32Array(len)
  const dr = new Float32Array(len)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const a = Math.exp((-TAU * tone) / SR)
  let lpL = 0
  let lpR = 0
  for (let i = 0, j = 0; i < n; i++) {
    const outL = dl[j]
    const outR = dr[j]
    lpL = outL * (1 - a) + lpL * a
    lpR = outR * (1 - a) + lpR * a
    dl[j] = (send.L[i] + send.R[i]) * 0.5 + lpR * feedback
    dr[j] = lpL * feedback
    L[i] = outL
    R[i] = outR
    if (++j >= len) j = 0
  }
  return { L, R }
}

/**
 * Stereo-linked feed-forward compressor with a soft knee, applied in place.
 * Detector: peak of |L|,|R| smoothed with attack/release one-pole filters in the dB domain.
 */
export function compress(bus, { threshold = -18, ratio = 3, attack = 0.005, release = 0.14, knee = 6, makeup = 0 } = {}) {
  const aA = Math.exp(-1 / (attack * SR))
  const aR = Math.exp(-1 / (release * SR))
  const mk = dbToGain(makeup)
  let env = -120
  let maxReduction = 0
  for (let i = 0; i < bus.L.length; i++) {
    const level = gainToDb(Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i])))
    env = level > env ? aA * env + (1 - aA) * level : aR * env + (1 - aR) * level
    const over = env - threshold
    let red = 0
    if (2 * over > knee) red = over * (1 - 1 / ratio)
    else if (2 * Math.abs(over) <= knee) red = ((1 - 1 / ratio) * (over + knee / 2) ** 2) / (2 * knee)
    if (red > maxReduction) maxReduction = red
    const g = dbToGain(-red) * mk
    bus.L[i] *= g
    bus.R[i] *= g
  }
  return { maxReductionDb: maxReduction }
}

/** tanh soft clip with input drive; output never exceeds ±1. */
export function softClip(bus, drive = 1) {
  for (const ch of [bus.L, bus.R]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * drive)
  return bus
}

// ITU-R BS.1770 K-weighting at 48 kHz (published coefficients): high shelf, then RLB high-pass.
const K_SHELF = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585]
const K_HPF = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621]

function kWeighted(x) {
  const out = Float32Array.from(x)
  for (const [b0, b1, b2, a1, a2] of [K_SHELF, K_HPF]) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < out.length; i++) {
      const xi = out[i]
      const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = xi; y2 = y1; y1 = y
      out[i] = y
    }
  }
  return out
}

/**
 * Gated integrated loudness (LUFS) of a stereo bus: 400 ms blocks, 75 % overlap, absolute gate −70,
 * relative gate −10 LU. Used for gain staging before the soft clip; ffmpeg measures the final values.
 */
export function integratedLoudness(bus) {
  const block = samples(0.4)
  const hop = samples(0.1)
  const chans = [kWeighted(bus.L), kWeighted(bus.R)]
  const powers = []
  for (let s = 0; s + block <= bus.L.length; s += hop) {
    let z = 0
    for (const ch of chans) { let acc = 0; for (let i = s; i < s + block; i++) acc += ch[i] * ch[i]; z += acc / block }
    powers.push(z)
  }
  const lufs = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z))
  const mean = (list) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length)
  const abs = powers.filter((z) => lufs(z) > -70)
  if (!abs.length) return -Infinity
  const rel = lufs(mean(abs)) - 10
  return lufs(mean(abs.filter((z) => lufs(z) > rel)))
}

/** Stereo buffer pair with mono-in/pan and stereo-in mixing. */
export class Stereo {
  constructor(n) {
    this.L = new Float32Array(n)
    this.R = new Float32Array(n)
  }
  get length() { return this.L.length }
  /** Adds a mono buffer at `t` seconds with gain and equal-power pan. */
  add(mono, t, gain = 1, pan = 0) {
    const [gl, gr] = panGains(pan)
    const off = samples(t)
    addInto(this.L, mono, gain * gl, off)
    addInto(this.R, mono, gain * gr, off)
    return this
  }
  addStereo(other, gain = 1) {
    addInto(this.L, other.L, gain)
    addInto(this.R, other.R, gain)
    return this
  }
}
