// Loudness (design §7.5, §11): two-pass loudnorm to I −14 LUFS / TP −1.5 dBTP / LRA 11 at 48 kHz stereo,
// and ebur128 measurement with true peak for the check stage. Parsers and argv builders are pure; the
// runner spawns ffmpeg with argv arrays.
import { ChronicleError, EXIT } from '../errors.mjs'
import { redactTail } from '../util/redact.mjs'
import { runProcess } from '../util/proc.mjs'

export const TARGET = Object.freeze({ I: -14, TP: -1.5, LRA: 11 })
/** Gates of the check stage. */
export const GATES = Object.freeze({ I: [-15, -13], TP: -1.0 })

const num = (v) => (v == null || v === '' || /^-?inf$/i.test(String(v)) ? null : Number(v))

/** Last loudnorm JSON block of ffmpeg stderr -> numbers, or null. */
export function parseLoudnorm(stderr) {
  const text = String(stderr ?? '')
  const end = text.lastIndexOf('}')
  const start = end >= 0 ? text.lastIndexOf('{', end) : -1
  if (start < 0) return null
  let raw
  try { raw = JSON.parse(text.slice(start, end + 1)) } catch { return null }
  if (raw.input_i == null) return null
  const out = {}
  for (const [k, v] of Object.entries(raw)) out[k] = k === 'normalization_type' ? String(v) : num(v)
  return out
}

/** ebur128 summary of ffmpeg stderr -> { I, LRA, TP } (TP from peak=true), or null. */
export function parseEbur128(stderr) {
  const text = String(stderr ?? '')
  const at = text.lastIndexOf('Summary:')
  if (at < 0) return null
  const s = text.slice(at)
  const pick = (re) => { const m = re.exec(s); return m ? num(m[1]) : null }
  const I = pick(/I:\s+(-?[\d.]+|-?inf)\s+LUFS/i)
  if (I == null) return null
  return { I, LRA: pick(/LRA:\s+(-?[\d.]+)\s+LU\b/), TP: pick(/True peak:\s*\n\s*Peak:\s+(-?[\d.]+|-?inf)\s+dBFS/i) }
}

const target = (t) => `loudnorm=I=${t.I}:TP=${t.TP}:LRA=${t.LRA}`

/** Pass 1 argv (measure). */
export const measureArgv = (input, t = TARGET) => ['-hide_banner', '-nostats', '-i', input, '-af', `${target(t)}:print_format=json`, '-f', 'null', '-']

/** Pass 2 argv (linear normalisation with the pass-1 values) -> 48 kHz stereo 24-bit WAV. */
export function normalizeArgv(input, output, m, t = TARGET) {
  const filter = [target(t), `measured_I=${m.input_i}`, `measured_TP=${m.input_tp}`, `measured_LRA=${m.input_lra}`, `measured_thresh=${m.input_thresh}`, `offset=${m.target_offset}`, 'linear=true', 'print_format=json'].join(':')
  // linear loudnorm cannot cap peaks when the gain is fixed: a lookahead limiter at −3 dBFS keeps the
  // AAC true peak under the −1.0 dBTP gate (measured on the Rome film: −0.1 dBTP without it).
  return ['-hide_banner', '-nostats', '-y', '-i', input, '-af', `${filter},alimiter=limit=0.708:attack=2:release=60:level=false`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', output]
}

/** ebur128 argv of a file's first audio stream (optionally only the first `seconds`). */
export const ebur128Argv = (file, seconds = null) => ['-hide_banner', '-nostats', '-i', file, ...(seconds ? ['-t', String(seconds)] : []), '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']

/** Runs ffmpeg; ffmpeg_missing when it cannot start, `code` (exit 7) with a redacted stderr tail on failure. */
export async function ffmpeg(args, { code = 'encode_failed', env = process.env, spawn, timeoutMs = 3_600_000 } = {}) {
  const r = await runProcess('ffmpeg', args, { env, spawn, timeoutMs })
  if (r.error) throw new ChronicleError('ffmpeg_missing', EXIT.local)
  if (r.code !== 0) throw new ChronicleError(code, EXIT.local, { exit_code: r.code, timed_out: r.timedOut, stderr: redactTail(r.stderr, 40, env) })
  return r
}

/** Two-pass loudnorm of `input` into `output`. Returns { pass1, pass2 }. */
export async function loudnorm(input, output, opts = {}) {
  const t = opts.target ?? TARGET
  const p1 = parseLoudnorm((await ffmpeg(measureArgv(input, t), opts)).stderr)
  if (!p1) throw new ChronicleError('encode_failed', EXIT.local, { reason: 'loudnorm_pass1' })
  const p2 = parseLoudnorm((await ffmpeg(normalizeArgv(input, output, p1, t), opts)).stderr)
  if (!p2) throw new ChronicleError('encode_failed', EXIT.local, { reason: 'loudnorm_pass2' })
  return { pass1: p1, pass2: p2 }
}

/** Gate result: { ok, I, TP, LRA, failed: ['I'|'TP'] }. */
export function loudnessGate(m, gates = GATES) {
  const failed = []
  if (!(m && m.I != null && m.I >= gates.I[0] && m.I <= gates.I[1])) failed.push('I')
  if (!(m && m.TP != null && m.TP <= gates.TP)) failed.push('TP')
  return { ok: failed.length === 0, I: m?.I ?? null, TP: m?.TP ?? null, LRA: m?.LRA ?? null, failed }
}
