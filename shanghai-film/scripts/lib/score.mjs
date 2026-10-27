// A quiet synthesised score bed (no samples, no models): slow strings-like pad and soft piano
// in D minor, rising in density with the eras, with a low swell at fire and blitz events.
// Ducked by about 6 dB under each narration clip. Returns stereo float buffers at 48 kHz.

export const SR = 48000
const midi = (m) => 440 * 2 ** ((m - 69) / 12)
const frac = (x) => x - Math.floor(x)

export function score(story, tl, voiced, seed = 11) {
  const T = tl.duration + 0.5, N = Math.ceil(T * SR)
  const L = new Float32Array(N), R = new Float32Array(N)
  let s0 = seed * 2654435761 >>> 0 || 1
  const rnd = () => { s0 ^= s0 << 13; s0 >>>= 0; s0 ^= s0 >>> 17; s0 ^= s0 << 5; s0 >>>= 0; return s0 / 4294967296 }
  const add = (i, v, pan) => { if (i < 0 || i >= N) return; const p = (pan + 1) * Math.PI / 4; L[i] += v * Math.cos(p); R[i] += v * Math.sin(p) }
  const onePole = (a) => { let y = 0; return (x) => (y += a * (x - y)) }
  // D minor: i  VI  III  VII, four bars each chord at 60 bpm (4 s a bar)
  const CH = [[50, 62, 65, 69], [46, 58, 62, 65], [53, 60, 65, 69], [48, 60, 64, 67]]
  const BAR = 4
  for (let b = 0, t = 0.5; t < T - 2; b++, t += BAR) {
    const ch = CH[b % 4], n0 = Math.round(t * SR), len = Math.round((BAR + 1.5) * SR)
    const k = Math.min(1, t / (tl.endStart || T)), dens = 0.6 + 0.6 * k
    const lp = [onePole(0.02 + 0.03 * k), onePole(0.02 + 0.03 * k)], ph = ch.map(() => [rnd(), rnd(), rnd()])
    for (let i = 0; i < len; i++) {
      const tt = i / SR, env = Math.min(1, tt / 1.6) * Math.min(1, (len / SR - tt) / 1.4)
      let a = 0, c = 0
      ch.forEach((m, j) => { const f = midi(m); for (let d = 0; d < 3; d++) { const saw = 2 * frac(ph[j][d] + f * (1 + (d - 1) * 0.003) * tt) - 1; if (d !== 2) a += saw; if (d !== 0) c += saw } })
      add(n0 + i, lp[0](a) * env * 0.012 * dens, -0.55); add(n0 + i, lp[1](c) * env * 0.012 * dens, 0.55)
    }
    // soft piano: the top notes, one per beat from the second era on
    if (t > (tl.eras[1]?.start ?? 0)) for (let beat = 0; beat < 4; beat++) {
      const m = ch[1 + ((beat + b) % 3)] + 12, f = midi(m), s = Math.round((t + beat) * SR)
      for (let i = 0; i < 2.5 * SR; i++) { const tt = i / SR; add(s + i, (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt / 0.2)) * Math.exp(-tt / 0.9) * Math.min(1, tt / 0.003) * 0.03 * k, 0.25) }
    }
  }
  // low swells under fire and blitz
  for (const [i, e] of story.eras.entries()) for (const ev of e.events ?? []) {
    if (ev.kind === 'flash') continue
    const b = tl.eras[i], t = b.start + b.duration * (Number.isFinite(ev.at01) ? ev.at01 : 0.35) - 0.5
    const n0 = Math.round(t * SR), len = Math.round(4 * SR), lp = onePole(0.004)
    for (let j = 0; j < len; j++) { const tt = j / SR, env = Math.sin(Math.PI * Math.min(1, tt / 4)) ** 2; add(n0 + j, (lp(rnd() * 2 - 1) * 9 + Math.sin(2 * Math.PI * 41 * tt) * 0.3) * env * 0.08, 0) }
  }
  // duck under narration, fade in and out
  const duck = new Float32Array(N).fill(1)
  for (const v of voiced) { const a = Math.round((v.from - 0.3) * SR), b = Math.round((v.to + 0.4) * SR); for (let i = Math.max(0, a); i < Math.min(N, b); i++) duck[i] = 0.5 }
  let g = 1
  for (let i = 0; i < N; i++) { g += (duck[i] - g) * 0.0004; const t = i / SR, f = Math.min(1, t / 1.2, (T - t) / 2.5); L[i] *= g * f; R[i] *= g * f }
  return [L, R]
}

export function wav(chs) {
  const n = chs[0].length, buf = Buffer.alloc(44 + n * 8), dv = new DataView(buf.buffer)
  buf.write('RIFF', 0); dv.setUint32(4, 36 + n * 8, true); buf.write('WAVE', 8); buf.write('fmt ', 12); dv.setUint32(16, 16, true)
  dv.setUint16(20, 3, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 8, true); dv.setUint16(32, 8, true); dv.setUint16(34, 32, true)
  buf.write('data', 36); dv.setUint32(40, n * 8, true)
  for (let i = 0; i < n; i++) { dv.setFloat32(44 + i * 8, chs[0][i], true); dv.setFloat32(48 + i * 8, chs[1][i], true) }
  return buf
}
