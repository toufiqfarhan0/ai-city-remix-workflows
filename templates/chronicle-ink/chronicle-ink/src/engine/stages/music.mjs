// music stage: renders the series theme (audio/theme.mjs) for the film length to work/music/theme.wav
// (48 kHz stereo) and writes the authored beat map work/music/beatmap.json (BPM, beats, downbeats,
// sections). Deterministic; no model call, no analysis needed: the beat map is exact by construction.
//
// Opt-in track: when the project has music/track.json (see references/music-track.md), that audio file
// is used instead of the code-synthesised theme: cut from `start` for the film length, faded in and
// out and levelled to the theme's loudness. The beat map stays the authored 88 BPM grid (cuts and SFX
// keep their timing); beatmap.json records the track and its credit for the end card and the report.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { t } from '../i18n.mjs'
import { ChronicleError } from '../errors.mjs'
import { SR, beatMap, renderTheme } from '../audio/theme.mjs'
import { renderRomanTheme } from '../audio/theme-roman.mjs'
import { renderAtlasTheme } from '../audio/theme-atlas.mjs'
import { ffmpeg } from '../audio/loudness.mjs'
import { dbToGain, integratedLoudness } from '../audio/synth/dsp.mjs'
import { decodeWav, encodeWav } from '../util/wav.mjs'
import { abs, writeProjectFile, writeProjectJson } from './common.mjs'

export const TRACK_FILE = 'music/track.json'
/** Licences a track may carry (no NC, ND or SA: the film is a derivative that may be used commercially). */
export const TRACK_LICENCES = Object.freeze(['public-domain', 'cc0', 'cc-by-3.0', 'cc-by-4.0', 'generated'])
const bad = (reason, details = {}) => new ChronicleError('music_track_invalid', 2, { reason, ...details })

/** Reads and validates music/track.json, or null when the project has none. */
export function loadTrack(projectDir) {
  const file = `${projectDir}/${TRACK_FILE}`
  if (!existsSync(file)) return null
  let tr
  try { tr = JSON.parse(readFileSync(file, 'utf8')) } catch { throw bad('json') }
  if (!tr || typeof tr !== 'object') throw bad('json')
  if (typeof tr.file !== 'string' || !/^music\/[A-Za-z0-9._()\- ]+$/.test(tr.file)) throw bad('file')
  if (!existsSync(`${projectDir}/${tr.file}`)) throw bad('file_missing', { file: tr.file })
  if (tr.start != null && !(Number.isFinite(tr.start) && tr.start >= 0)) throw bad('start')
  if (!TRACK_LICENCES.includes(tr.licence)) throw bad('licence', { allowed: [...TRACK_LICENCES] })
  for (const k of ['title', 'by']) if (typeof tr[k] !== 'string' || !tr[k].trim()) throw bad(k)
  if (tr.licence === 'generated' && !(tr.generated && typeof tr.generated.model === 'string')) throw bad('generated')
  if (!tr.credit || typeof tr.credit.en !== 'string') throw bad('credit')
  return { start: 0, ...tr }
}

/** Track audio cut to the film length, faded and levelled to −16 LUFS like the series themes. */
async function trackBus(ctx, tr, seconds) {
  const tmp = abs(ctx, 'work/music/.track.wav')
  mkdirSync(dirname(tmp), { recursive: true })
  await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(tr.start), '-t', String(seconds), '-i', abs(ctx, tr.file),
    // mastered tracks arrive hot (true peaks above 0 dBTP): even them out and leave headroom so the
    // film's own SFX mix and the final AAC encode stay under −1.5 dBTP
    '-af', 'adeclip,loudnorm=I=-17:TP=-4:LRA=8,alimiter=limit=0.5:attack=5:release=80:level=false', '-ac', '2', '-ar', String(SR), '-c:a', 'pcm_s16le', tmp], { code: 'music_track_decode_failed', env: ctx.env, spawn: ctx.spawn })
  const wav = decodeWav(readFileSync(tmp))
  rmSync(tmp, { force: true })
  const n = Math.round(seconds * SR)
  const L = new Float32Array(n), R = new Float32Array(n)
  const c0 = Float32Array.from(wav.channels[0]), c1 = Float32Array.from(wav.channels[1] ?? wav.channels[0])
  L.set(c0.subarray(0, Math.min(n, c0.length))); R.set(c1.subarray(0, Math.min(n, c1.length)))
  const bus = { L, R }
  const g = dbToGain(-16 - integratedLoudness(bus))
  const fi = Math.round(SR * (tr.fade_in ?? 1.5)), fo = Math.round(SR * (tr.fade_out ?? 4))
  for (let i = 0; i < n; i++) {
    let k = g
    if (i < fi) k *= i / fi
    if (i > n - fo) k *= Math.max(0, (n - i) / fo)
    L[i] *= k; R[i] *= k
  }
  return bus
}

/** @param {object} ctx stage context */
export async function run(ctx) {
  const { brief, lang, log } = ctx
  const tr = loadTrack(ctx.projectDir)
  // The style pack names its series theme; every theme shares the beat map (88 BPM, same sections).
  const theme = ctx.stylePack?.music?.theme
  const bus = tr ? await trackBus(ctx, tr, brief.seconds)
    : theme === 'roman-theme' ? renderRomanTheme(brief.seconds) : theme === 'atlas-theme' ? renderAtlasTheme(brief.seconds) : renderTheme(brief.seconds)
  writeProjectFile(ctx, 'work/music/theme.wav', encodeWav([bus.L, bus.R], SR))
  const map = beatMap(brief.seconds)
  if (tr) map.track = { title: tr.title, by: tr.by, licence: tr.licence, source: tr.source ?? null, start: tr.start, generated: tr.generated ?? null, credit: tr.credit }
  writeProjectJson(ctx, 'work/music/beatmap.json', map)
  log.log(t(lang, 'stage.music_done', { bpm: map.bpm, bars: map.total_bars, sections: map.sections.length }))
  return { status: 'done', outputs: ['work/music/theme.wav', 'work/music/beatmap.json'] }
}
