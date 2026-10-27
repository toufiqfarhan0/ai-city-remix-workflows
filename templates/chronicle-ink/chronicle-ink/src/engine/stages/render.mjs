// render stage (editor): HyperFrames picture on the CPU (Chrome without GPU, so canvas output is the
// same on every machine), the soundtrack mix (theme + SFX cues, audio/mix.mjs), two-pass loudnorm to
// −14 LUFS / −1.5 dBTP, mux with the AIGC metadata.
//
//   render                      full film -> out/film.mp4 (recorded in state.json)
//   render --segment <x>        review window -> out/segments/<id>.mp4 + out/segments/<id>/sheet.jpg
//                               (one frame per second) + keyframes/<shot>.jpg (each shot's middle frame).
//                               x = s1…s5 | opening | a section id | <start>-<end> seconds | all.
//                               Reads scenes/ directly (same scan as the scenes stage); nothing is
//                               recorded in state.json, so the director's loop never invalidates the film.
import { existsSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { cpus } from 'node:os'
import { ChronicleError, EXIT } from '../errors.mjs'
import { t } from '../i18n.mjs'
import { mixFilm } from '../audio/mix.mjs'
import { TARGET, ffmpeg, loudnorm } from '../audio/loudness.mjs'
import { SR } from '../audio/synth/dsp.mjs'
import { HYPERFRAMES, needsLowMemory, renderArgs, runHyperframes } from '../render/hyperframes.mjs'
import { aigcValue, loadAigcSpec, muxArgv } from '../render/mux.mjs'
import { resolveSegment } from '../timeline/compile.mjs'
import { mkdirp } from '../util/fsx.mjs'
import { programWorks } from '../util/proc.mjs'
import { decodeWav, encodeWav } from '../util/wav.mjs'
import { ENGINE_VERSION } from '../version.mjs'
import { abs, readProjectJson, writeProjectFile, writeProjectJson } from './common.mjs'
import { PROJECT_DIR, loadScenes, writeProject } from './scenes.mjs'
import { loadVoice, voiceBus } from '../audio/voice.mjs'
/** Skill name and version from <skill>/package.json (for ContentProducer). */
function skillInfo(ctx) {
  try {
    const pkg = JSON.parse(readFileSync(`${ctx.skillDir}/package.json`, 'utf8'))
    return { name: pkg.name, version: pkg.version }
  } catch {
    return { name: 'chronicle-ink', version: ENGINE_VERSION }
  }
}
/** Chunk length when the temporary disk cannot hold one capture of the whole window. */
export const CHUNK_SECONDS = 30
/** HyperFrames capture workers: half the CPUs, 1–6. */
export const workerCount = (n = cpus().length) => Math.max(1, Math.min(6, Math.floor(n / 2)))
/** Theme bus from work/music/theme.wav. */
function readTheme(ctx) {
  const file = abs(ctx, 'work/music/theme.wav')
  if (!existsSync(file)) throw new ChronicleError('stage_missing:music', EXIT.input, { file: 'work/music/theme.wav' })
  const wav = decodeWav(readFileSync(file))
  return { L: Float32Array.from(wav.channels[0]), R: Float32Array.from(wav.channels[1] ?? wav.channels[0]) }
}
/** Picture + mix + mux for a window. Returns timing and loudness facts. */
async function produce(ctx, { project, timeline, script, window, output, workDir }) {
  const { env } = ctx
  const fps = timeline.fps
  mkdirp(abs(ctx, workDir))
  const picture = abs(ctx, `${workDir}/picture.mp4`)
  rmSync(picture, { force: true })
  const t0 = process.hrtime.bigint()
  const seconds = window.to - window.from
  if (!needsLowMemory({ seconds, fps, env })) {
    await runHyperframes(renderArgs(abs(ctx, project), picture, { fps, quality: ctx.flags.quality ?? 'final', gpu: false, workers: workerCount() }), { env, spawn: ctx.spawn, output: picture })
  } else {
    // Not enough temporary disk for one capture: render whole-frame chunks of the same timeline
    // (each its own project window) and join them losslessly.
    const { scenes } = loadScenes(ctx, timeline)
    const frames = Math.round(seconds * fps)
    let per = Math.round(CHUNK_SECONDS * fps)
    while (per > fps && needsLowMemory({ seconds: per / fps, fps, env: {} })) per = Math.round(per / 2)
    const parts = []
    for (let f0 = 0, i = 0; f0 < frames; f0 += per, i++) {
      const w = { from: window.from + f0 / fps, to: window.from + Math.min(frames, f0 + per) / fps }
      const dir = `${workDir}/chunk-${i}`
      writeProject(ctx, { dir: `${dir}/project`, timeline, scenes, script, window: w })
      const part = abs(ctx, `${dir}/picture.mp4`)
      await runHyperframes(renderArgs(abs(ctx, `${dir}/project`), part, { fps, quality: ctx.flags.quality ?? 'final', gpu: false, workers: workerCount() }), { env, spawn: ctx.spawn, output: part })
      rmSync(abs(ctx, `${dir}/project`), { recursive: true, force: true })
      parts.push(part)
    }
    const list = abs(ctx, `${workDir}/chunks.txt`)
    writeProjectFile(ctx, `${workDir}/chunks.txt`, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
    await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', picture], { code: 'encode_failed', env, spawn: ctx.spawn })
    for (const f of parts) rmSync(f.replace(/\/picture\.mp4$/, ''), { recursive: true, force: true })
    rmSync(list, { force: true })
  }
  const renderSeconds = Number(process.hrtime.bigint() - t0) / 1e9
  // Soundtrack.
  const theme = readTheme(ctx)
  const voice = await voiceBus(ctx, timeline, loadVoice(ctx.projectDir))
  const tiers = ctx.stylePack?.sfx?.tiers
  const { mix, sfx } = mixFilm(theme, timeline.sfx, { from: window.from, to: window.to, ...(tiers ? { tierDb: tiers } : {}), lowpass: ctx.stylePack?.sfx?.lowpass_hz ?? 0, voice })
  const pre = abs(ctx, `${workDir}/mix.pre.wav`)
  writeProjectFile(ctx, `${workDir}/mix.pre.wav`, encodeWav([mix.L, mix.R], SR))
  writeProjectFile(ctx, `${workDir}/sfx.wav`, encodeWav([sfx.L, sfx.R], SR))
  const mixFile = abs(ctx, `${workDir}/mix.wav`)
  // opt-in tracks and narration are mastered recordings: AAC overshoots them more, so leave 0.5 dB more headroom
  const external = existsSync(abs(ctx, 'music/track.json')) || voice
  const ln = await loudnorm(pre, mixFile, { code: 'encode_failed', env, spawn: ctx.spawn, ...(external ? { target: { ...TARGET, TP: -2 } } : {}) })
  rmSync(pre, { force: true })
  const spec = loadAigcSpec()
  const info = skillInfo(ctx)
  const aigc = aigcValue({ spec, skill: info.name, version: info.version, timelineBytes: readFileSync(abs(ctx, 'work/timeline.json')) })
  const tmp = abs(ctx, `${output}.tmp.mp4`)
  mkdirp(abs(ctx, output.split('/').slice(0, -1).join('/')))
  await ffmpeg(muxArgv({ picture, audio: mixFile, output: tmp, title: timeline.title?.text || 'chronicle', aigc, seconds: Math.round((window.to - window.from) * 1000) / 1000, audioBitrate: existsSync(abs(ctx, 'music/track.json')) || voice ? '320k' : '192k' }), { code: 'mux_failed', env, spawn: ctx.spawn })
  renameSync(tmp, abs(ctx, output))
  const frames = Math.round((window.to - window.from) * fps)
  return {
    renderer: HYPERFRAMES, gpu: false, workers: workerCount(), fps, frames,
    seconds: Math.round(renderSeconds * 10) / 10,
    ms_per_frame: Math.round((renderSeconds * 1000) / Math.max(1, frames)),
    loudnorm: { input_i: ln.pass1.input_i, input_tp: ln.pass1.input_tp, output_i: ln.pass2.output_i, output_tp: ln.pass2.output_tp },
    aigc_verified: spec.verified === true,
    output, bytes: statSync(abs(ctx, output)).size,
  }
}
/** Contact sheet (1 frame / s) and one key frame per shot for a rendered window. */
async function reviewSheets(ctx, { film, timeline, window, dir }) {
  const { env } = ctx
  const fps = timeline.fps
  mkdirp(abs(ctx, `${dir}/keyframes`))
  const secs = Math.max(1, Math.round(window.to - window.from))
  const cols = 5
  await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', abs(ctx, film), '-vf', `fps=1,scale=480:-2,tile=${cols}x${Math.ceil(secs / cols)}:padding=4:color=0x1D1B18`, '-frames:v', '1', '-q:v', '3', abs(ctx, `${dir}/sheet.jpg`)], { code: 'check_probe_failed', env, spawn: ctx.spawn })
  const keys = []
  for (const s of timeline.shots) {
    const mid = (Math.max(s.start, window.from) + Math.min(s.end, window.to)) / 2
    if (mid <= window.from || mid >= window.to) continue
    const f = Math.round((mid - window.from) * fps)
    const out = `${dir}/keyframes/${s.id}.jpg`
    await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', abs(ctx, film), '-vf', `select=eq(n\\,${f})`, '-frames:v', '1', '-q:v', '2', abs(ctx, out)], { code: 'check_probe_failed', env, spawn: ctx.spawn })
    keys.push({ shot: s.id, scene: s.scene, t: Math.round(mid * 1000) / 1000, file: out })
  }
  return { sheet: `${dir}/sheet.jpg`, keyframes: keys }
}
/** `render --segment <x>`: the director's review loop (unrecorded). Returns the exit code. */
export async function renderSegment(ctx) {
  const { flags, lang, log, env } = ctx
  const timeline = readProjectJson(ctx, 'work/timeline.json', { code: 'stage_missing:timeline' })
  const script = readProjectJson(ctx, 'script.json', { code: 'stage_missing:script' })
  const seg = resolveSegment(timeline, flags.segment)
  if (!seg) throw new ChronicleError('segment_invalid', EXIT.input, { segment: String(flags.segment), allowed: timeline.segments.map((s) => s.id) })
  if (!(await programWorks('ffmpeg', ['-version'], { env, spawn: ctx.spawn }))) throw new ChronicleError('ffmpeg_missing', EXIT.local)
  const { scenes, missing, scan } = loadScenes(ctx, timeline)
  const needed = new Set(timeline.shots.filter((s) => s.end > seg.start && s.start < seg.end).map((s) => s.scene))
  const miss = missing.filter(([name]) => needed.has(name))
  if (miss.length) throw new ChronicleError(`scene_missing:${miss[0][0]}`, EXIT.scene, { scenes: miss.map(([n]) => n) })
  const bad = scan.scenes.filter((r) => !r.ok)
  if (bad.length) throw new ChronicleError(`scene_rejected:${bad[0].name}`, EXIT.scene, { problems: bad[0].problems.map((p) => `${p.id}:${p.match}`) })
  const window = { from: seg.start, to: seg.end }
  const base = `work/render/segments/${seg.id}`
  writeProject(ctx, { dir: `${base}/project`, timeline, scenes, script, window })
  const film = `out/segments/${seg.id}.mp4`
  const facts = await produce(ctx, { project: `${base}/project`, timeline, script, window, output: film, workDir: base })
  const sheets = await reviewSheets(ctx, { film, timeline, window, dir: `out/segments/${seg.id}` })
  const doc = { schema: 'chronicle-segment/1', segment: seg.id, from: seg.start, to: seg.end, film, ...facts, ...sheets }
  writeProjectJson(ctx, `${base}.json`, doc)
  log.log(t(lang, 'stage.segment_done', { segment: seg.id, from: seg.start, to: seg.end, file: film, sheet: sheets.sheet, seconds: facts.seconds, ms: facts.ms_per_frame }))
  return EXIT.ok
}
/** @param {object} ctx stage context (full film) */
export async function run(ctx) {
  const { env, lang, log } = ctx
  const timeline = readProjectJson(ctx, 'work/timeline.json', { code: 'stage_missing:timeline' })
  const script = readProjectJson(ctx, 'script.json', { code: 'stage_missing:script' })
  readProjectJson(ctx, `${PROJECT_DIR}/composition.json`, { code: 'stage_missing:scenes' })
  if (!(await programWorks('ffmpeg', ['-version'], { env, spawn: ctx.spawn }))) throw new ChronicleError('ffmpeg_missing', EXIT.local)
  mkdirp(abs(ctx, 'out'))
  const facts = await produce(ctx, { project: PROJECT_DIR, timeline, script, window: { from: 0, to: timeline.seconds }, output: 'out/film.mp4', workDir: 'work/render' })
  writeProjectJson(ctx, 'work/render/render.json', { schema: 'chronicle-render/2', width: timeline.aspect === '16:9' ? 1920 : 1080, height: timeline.aspect === '16:9' ? 1080 : 1920, ...facts })
  log.log(t(lang, 'stage.render_done', { file: 'out/film.mp4', seconds: facts.seconds, ms: facts.ms_per_frame }))
  return { status: 'done', outputs: ['work/render/picture.mp4', 'work/render/mix.wav', 'work/render/render.json', 'out/film.mp4'] }
}
