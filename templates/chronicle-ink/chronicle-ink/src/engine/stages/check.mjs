// check stage (QA): ffprobe / ebur128 / full decode on out/film.mp4, cuts and sections on downbeats,
// SFX onsets measured on the SFX stem within one frame of their actions, caption layout, AIGC metadata,
// re-hook gaps, fact gate, scene scan and the Agent's visual review; out/sheet.jpg (one frame every 2 s)
// and out/joins.jpg (frames around every cut). Failures are warnings; --strict exits 8.
import { readFileSync } from 'node:fs'
import { ChronicleError, EXIT } from '../errors.mjs'
import { t } from '../i18n.mjs'
import { ebur128Argv, ffmpeg, parseEbur128 } from '../audio/loudness.mjs'
import { onsetNear } from '../audio/mix.mjs'
import { aigcCheck, captionCheck, CHECK_SCHEMA, downbeatCheck, factsCheck, formatCheck, loudnessCheck, rehookCheck, reviewCheck, REWORK_STAGE, reworkPlan, scanCheck, sfxCheck, strictFailures } from '../check/checks.mjs'
import { redactTail } from '../util/redact.mjs'
import { runProcess } from '../util/proc.mjs'
import { decodeWav } from '../util/wav.mjs'
import { abs, failWith, printWarnings, readProjectJson, writeProjectJson } from './common.mjs'
export const SHEET_EVERY_S = 2
async function ffprobe(file, ctx) {
  const r = await runProcess('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { env: ctx.env, spawn: ctx.spawn, timeoutMs: 120_000 })
  if (r.error) throw new ChronicleError('ffmpeg_missing', EXIT.local, { tool: 'ffprobe' })
  if (r.code !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}
/** @param {object} ctx stage context */
export async function run(ctx) {
  const { flags, stylePack, lang, log, env } = ctx
  const rel = 'out/film.mp4'
  const film = abs(ctx, rel)
  const timeline = readProjectJson(ctx, 'work/timeline.json', { code: 'stage_missing:timeline' })
  const beatmap = readProjectJson(ctx, 'work/music/beatmap.json', { code: 'stage_missing:music' })
  const render = readProjectJson(ctx, 'work/render/render.json', { code: 'stage_missing:render' })
  const gate = readProjectJson(ctx, 'work/script/gate.json')
  const scan = readProjectJson(ctx, 'work/scenes/scan.json')
  const review = readProjectJson(ctx, 'work/review.json')
  const probe = await ffprobe(film, ctx)
  const decode = await runProcess('ffmpeg', ['-v', 'error', '-i', film, '-f', 'null', '-'], { env, spawn: ctx.spawn, timeoutMs: 3_600_000 })
  const decodeOk = !decode.error && decode.code === 0 && !String(decode.stderr).trim()
  const loud = parseEbur128((await ffmpeg(ebur128Argv(film), { code: 'check_probe_failed', env, spawn: ctx.spawn })).stderr)
  // SFX onsets on the stem the render wrote (same samples as the mix).
  const stemWav = decodeWav(readFileSync(abs(ctx, 'work/render/sfx.wav')))
  const stem = { L: stemWav.channels[0], R: stemWav.channels[1] ?? stemWav.channels[0] }
  const onsets = timeline.sfx.map((c) => onsetNear(stem, c.t))
  const items = [
    probe ? formatCheck(probe, { width: render.width, height: render.height, fps: render.fps, seconds: timeline.seconds, decodeOk }) : { id: 'format', status: 'fail', code: 'check_probe_failed', details: { problems: ['ffprobe'], stderr: redactTail(decode.stderr, 20, env) } },
    loudnessCheck(loud),
    downbeatCheck(timeline, beatmap),
    sfxCheck(timeline, onsets),
    captionCheck(timeline, stylePack.captions),
    aigcCheck(probe, timeline),
    rehookCheck(timeline, gate),
    factsCheck(gate),
    scanCheck(scan),
    reviewCheck(review, timeline),
  ]
  const w = Math.max(2, 2 * Math.round(render.width / 8))
  const n = Math.max(1, Math.ceil(timeline.seconds / SHEET_EVERY_S))
  await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', film, '-vf', `fps=1/${SHEET_EVERY_S},scale=${w}:-2,tile=8x${Math.ceil(n / 8)}`, '-frames:v', '1', '-q:v', '4', abs(ctx, 'out/sheet.jpg')], { code: 'check_probe_failed', env, spawn: ctx.spawn })
  const cutFrames = timeline.shots.slice(1).map((s) => s.start_frame).filter((f) => f > 0 && f < timeline.frames)
  const sel = [...new Set(cutFrames.flatMap((f) => [f - 1, f + 2]))].sort((a, b) => a - b)
  if (sel.length) {
    const expr = sel.map((f) => `eq(n\\,${f})`).join('+')
    await ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', film, '-vf', `select='${expr}',scale=${w}:-2,tile=8x${Math.ceil(sel.length / 8)}`, '-frames:v', '1', '-q:v', '4', abs(ctx, 'out/joins.jpg')], { code: 'check_probe_failed', env, spawn: ctx.spawn })
  }
  const failures = strictFailures(items)
  const doc = { schema: CHECK_SCHEMA, film: rel, strict: flags.strict === true, items, failed: failures.map((f) => f.code), rework: reworkPlan(items), sheet: 'out/sheet.jpg', joins: sel.length ? 'out/joins.jpg' : null, listening: 'not certified: a person still has to listen to the mix' }
  writeProjectJson(ctx, 'work/check.json', doc)
  for (const f of failures) log.error(`${flags.strict ? 'error' : 'warning'} ${f.code}:${f.id} (rerun: ${REWORK_STAGE[f.id] ?? '—'})`)
  printWarnings(ctx, [])
  if (flags.strict && failures.length) failWith(ctx, failures.map((f) => ({ code: f.code, details: { item: f.id } })), EXIT.strict)
  log.log(t(lang, 'stage.check_done', { passed: items.filter((i) => i.status === 'pass').length, failed: failures.length, film: rel }))
  return { status: 'done', outputs: ['work/check.json', 'out/sheet.jpg', ...(sel.length ? ['out/joins.jpg'] : [])] }
}
