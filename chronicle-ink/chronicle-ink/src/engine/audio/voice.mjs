// Opt-in narration (voice/voice.json, see references/voice.md). Each line is one audio clip spoken
// over one shot: it starts `offset` seconds after the shot (default 0.25 s), must end before the next
// shot and must say exactly the shot's caption in the film language (so the fact gate that checked the
// caption also covers what is heard). Clips are levelled one by one; the mix ducks the music under them.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { ChronicleError } from '../errors.mjs'
import { ffmpeg } from './loudness.mjs'
import { SR, dbToGain, integratedLoudness } from './synth/dsp.mjs'
import { decodeWav } from '../util/wav.mjs'

export const VOICE_FILE = 'voice/voice.json'
/** Loudness of each narration clip before the master (the master lands at −14 LUFS). */
export const VOICE_LUFS = -15
const bad = (reason, details = {}) => new ChronicleError('voice_invalid', 2, { reason, ...details })
const norm = (s) => String(s ?? '').normalize('NFC').replace(/[\s\u00a0]+/g, '').replace(/[’‘]/g, "'").toLowerCase()

/** Reads and validates voice/voice.json, or null when the project has none. */
export function loadVoice(projectDir) {
  const file = `${projectDir}/${VOICE_FILE}`
  if (!existsSync(file)) return null
  let v
  try { v = JSON.parse(readFileSync(file, 'utf8')) } catch { throw bad('json') }
  if (!v || !Array.isArray(v.lines) || !v.lines.length) throw bad('lines')
  if (!v.generated || typeof v.generated.model !== 'string') throw bad('generated')
  if (!v.credit || typeof v.credit.en !== 'string') throw bad('credit')
  for (const [i, l] of v.lines.entries()) {
    if (typeof l.shot !== 'string' || typeof l.text !== 'string') throw bad('line', { index: i })
    if (typeof l.file !== 'string' || !/^voice\/[A-Za-z0-9._\-]+$/.test(l.file)) throw bad('file', { index: i })
    if (!existsSync(`${projectDir}/${l.file}`)) throw bad('file_missing', { file: l.file })
  }
  return v
}

/**
 * Full-length narration bus for a timeline. Throws voice_mismatch when a line does not say its shot's
 * caption, voice_too_long when a clip runs into the next shot.
 * @returns {Promise<{ L: Float32Array, R: Float32Array, lines: object[] }|null>}
 */
export async function voiceBus(ctx, timeline, voice) {
  if (!voice) return null
  const n = Math.round(timeline.seconds * SR)
  const L = new Float32Array(n), R = new Float32Array(n)
  const shots = new Map(timeline.shots.map((s) => [s.id, s]))
  const caps = new Map(timeline.captions.map((c) => [c.shot, c]))
  const placed = []
  mkdirSync(`${ctx.projectDir}/work/render`, { recursive: true })
  for (const l of voice.lines) {
    const shot = shots.get(l.shot)
    if (!shot) throw new ChronicleError('voice_invalid', 2, { reason: 'unknown_shot', shot: l.shot })
    const cap = caps.get(l.shot)
    if (!cap || norm(cap.lines.join(' ')) !== norm(l.text)) throw new ChronicleError('voice_mismatch', 6, { shot: l.shot, caption: cap ? cap.lines.join(' ') : null })
    const tmp = `${ctx.projectDir}/work/render/.voice-${l.shot}.wav`
    await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', `${ctx.projectDir}/${l.file}`, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', tmp], { code: 'voice_decode_failed', env: ctx.env, spawn: ctx.spawn })
    const wav = decodeWav(readFileSync(tmp))
    rmSync(tmp, { force: true })
    const mono = Float32Array.from(wav.channels[0])
    const at = shot.start + (l.offset ?? 0.25)
    const dur = mono.length / SR
    const room = shot.end - at
    if (dur > room + 0.15) throw new ChronicleError('voice_too_long', 6, { shot: l.shot, seconds: Math.round(dur * 100) / 100, room: Math.round(room * 100) / 100 })
    const g = dbToGain(VOICE_LUFS - integratedLoudness({ L: mono, R: mono }))
    const s0 = Math.round(at * SR)
    for (let i = 0; i < mono.length && s0 + i < n; i++) { const x = mono[i] * g; L[s0 + i] += x; R[s0 + i] += x }
    placed.push({ shot: l.shot, start: Math.round(at * 1000) / 1000, seconds: Math.round(dur * 1000) / 1000 })
  }
  return { L, R, lines: placed }
}
