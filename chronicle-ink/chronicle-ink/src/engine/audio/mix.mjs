// Soundtrack mix: the rendered theme plus the SFX cues of the timeline. Each cue's `hit` sample lands
// exactly on its action time (frame-quantised in timeline.json); climax cues dip the music by 3 dB for
// 0.4 s so they cut through. Returns the stereo mix and the SFX-only stem (the check stage measures
// onsets on the stem). Final loudness (−14 LUFS, −1.5 dBTP) is applied afterwards by ffmpeg loudnorm.
import { SR, Biquad, Stereo, freeverb, hash, samples } from './synth/dsp.mjs'
import { renderCue } from './sfx.mjs'
export const DUCK = Object.freeze({ db: -3, attack: 0.03, hold: 0.4, release: 0.25 })
/**
 * @param {{ L: Float32Array, R: Float32Array }} theme full-length theme bus
 * @param {{ t: number, kind: string, tier: string, dur?: number, step?: number, pan?: number, id: string }[]} cues
 * @param {{ from?: number, to?: number }} window seconds (segment renders)
 */
/** Music level under narration (opt-in voice track): −9 dB, 120 ms in, 450 ms out. */
export const VOICE_DUCK = Object.freeze({ db: -9, attack: 0.12, release: 0.45, gate: 0.004 })
export function mixFilm(theme, cues, { from = 0, to = theme.L.length / SR, tierDb, lowpass = 0, voice = null } = {}) {
  const off = samples(from)
  const n = Math.max(1, samples(to) - off)
  const music = new Stereo(n)
  music.L.set(theme.L.subarray(off, off + n))
  music.R.set(theme.R.subarray(off, off + n))
  const sfx = new Stereo(n)
  const send = new Stereo(n)
  const duck = new Float32Array(n).fill(1)
  for (const c of cues) {
    const r0 = renderCue({ kind: c.kind, tier: c.tier, dur: c.dur, step: c.step ?? 0, seed: (hash(c.id) % 9973) + 1, ...(tierDb ? { tierDb } : {}) })
    const hit = r0.hit
    // A soft style rounds off the SFX top end (no clicks or hiss above the cutoff).
    const buf = lowpass ? (() => { const b = Float32Array.from(r0.buf); new Biquad('lowpass', lowpass, 0.707).process(b); return b })() : r0.buf
    const at = c.t - hit - from
    if (at + buf.length / SR < 0 || at > n / SR) continue
    // Stereo.add takes seconds >= 0; trim the head of a cue that starts before the window.
    let b = buf
    let tAt = at
    if (at < 0) { b = buf.subarray(samples(-at)); tAt = 0 }
    sfx.add(b, tAt, 1, c.pan ?? 0)
    send.add(b, tAt, c.tier === 'climax' ? 0.35 : 0.2, c.pan ?? 0)
    if (c.tier === 'climax') {
      const s0 = samples(c.t - from - DUCK.attack)
      const g = 10 ** (DUCK.db / 20)
      const len = samples(DUCK.attack + DUCK.hold + DUCK.release)
      for (let i = 0; i < len; i++) {
        const k = s0 + i
        if (k < 0 || k >= n) continue
        const tt = i / SR
        const v = tt < DUCK.attack ? 1 + (g - 1) * (tt / DUCK.attack) : tt < DUCK.attack + DUCK.hold ? g : g + (1 - g) * ((tt - DUCK.attack - DUCK.hold) / DUCK.release)
        duck[k] = Math.min(duck[k], v)
      }
    }
  }
  const verb = freeverb(send, { room: 0.8, damp: 0.45, width: 0.9 })
  // Narration (voice/voice.json): the music ducks smoothly while a line is spoken.
  const vL = voice ? voice.L.subarray(off, off + n) : null
  const vR = voice ? voice.R.subarray(off, off + n) : null
  if (voice) {
    const blk = samples(0.01)
    const g = 10 ** (VOICE_DUCK.db / 20)
    const up = 1 / Math.max(1, VOICE_DUCK.attack / 0.01), down = 1 / Math.max(1, VOICE_DUCK.release / 0.01)
    // look ahead by the attack so the music is already down when the first syllable lands
    const lead = Math.round(VOICE_DUCK.attack / 0.01)
    const blocks = Math.ceil(n / blk)
    const on = new Uint8Array(blocks)
    for (let b = 0; b < blocks; b++) {
      let acc = 0
      for (let i = b * blk; i < Math.min(n, (b + 1) * blk); i++) acc += vL[i] * vL[i] + vR[i] * vR[i]
      if (Math.sqrt(acc / (2 * blk)) > VOICE_DUCK.gate) for (let k = Math.max(0, b - lead); k <= b; k++) on[k] = 1
    }
    // hold short gaps between words so the music does not pump
    const hold = Math.round(0.35 / 0.01)
    for (let b = 0, last = -1e9; b < blocks; b++) { if (on[b]) last = b; else if (b - last < hold) on[b] = 1 }
    let lvl = 0
    for (let b = 0; b < blocks; b++) {
      lvl = on[b] ? Math.min(1, lvl + up) : Math.max(0, lvl - down)
      const v = 1 + (g - 1) * lvl
      for (let i = b * blk; i < Math.min(n, (b + 1) * blk); i++) duck[i] = Math.min(duck[i], v)
    }
  }
  const mix = new Stereo(n)
  for (let i = 0; i < n; i++) {
    mix.L[i] = music.L[i] * duck[i] + sfx.L[i] + verb.L[i] * 0.5 + (vL ? vL[i] : 0)
    mix.R[i] = music.R[i] * duck[i] + sfx.R[i] + verb.R[i] * 0.5 + (vR ? vR[i] : 0)
  }
  return { mix, sfx }
}
/**
 * Measured onset of the SFX stem near `t` (seconds): the time of the steepest rise of the 4 ms RMS
 * envelope (1 ms hop) inside [t - win, t + win]. Used to prove that each cue's hit lands on its action.
 * @returns {number|null} seconds, or null when the window is silent
 */
export function onsetNear(stem, t, { win = 0.15, offset = 0 } = {}) {
  const hop = Math.round(SR * 0.001)
  const len = Math.round(SR * 0.004)
  const s0 = Math.max(0, samples(t - win - offset))
  const s1 = Math.min(stem.L.length - len, samples(t + win - offset))
  let best = null
  let bestRise = 0
  let prev = null
  for (let s = s0; s <= s1; s += hop) {
    let acc = 0
    for (let i = s; i < s + len; i++) { const v = 0.5 * (stem.L[i] + stem.R[i]); acc += v * v }
    const rms = Math.sqrt(acc / len)
    if (prev != null && rms - prev > bestRise) { bestRise = rms - prev; best = (s + len) / SR + offset }
    prev = rms
  }
  return best == null ? null : Math.round(best * 1000) / 1000
}
