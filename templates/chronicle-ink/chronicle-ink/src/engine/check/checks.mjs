// Quality checks. Pure evaluators over ffprobe JSON, ebur128 numbers, timeline.json, beatmap.json,
// measured SFX onsets, gate.json and the Agent's visual review (work/review.json); the check stage runs
// the tools. Each item is { id, status: pass|fail|skipped|info, code?, details }; `code` is the --strict
// failure code.
import { loudnessGate } from '../audio/loudness.mjs'
import { REHOOK_MAX_GAP_S } from '../story/beatsheet.mjs'
import { budgetFor, textWidth } from '../timeline/captions.mjs'
export const CHECK_SCHEMA = 'chronicle-check/2'
export const REVIEW_SCHEMA = 'chronicle-review/1'
export const REWORK_MAX_ROUNDS = 3
const item = (id, ok, code, details = {}) => ({ id, status: ok ? 'pass' : 'fail', ...(ok ? {} : { code }), details })
const rate = (r) => {
  const [a, b] = String(r ?? '0/1').split('/').map(Number)
  return b ? a / b : a
}
/** Format: h264 / yuv420p / fps / size / AAC 48 kHz stereo / duration ± 1 frame / frame count / decode. */
export function formatCheck(probe, { width, height, fps, seconds, decodeOk = true }) {
  const v = (probe?.streams ?? []).find((s) => s.codec_type === 'video') ?? {}
  const a = (probe?.streams ?? []).find((s) => s.codec_type === 'audio') ?? {}
  const duration = Number(probe?.format?.duration ?? v.duration ?? 0)
  const frames = Number(v.nb_frames ?? NaN)
  const want = Math.round(seconds * fps)
  const problems = []
  if (v.codec_name !== 'h264') problems.push(`video_codec:${v.codec_name ?? 'none'}`)
  if (v.pix_fmt !== 'yuv420p') problems.push(`pix_fmt:${v.pix_fmt ?? 'none'}`)
  if (Math.abs(rate(v.avg_frame_rate ?? v.r_frame_rate) - fps) > 0.01) problems.push(`fps:${v.avg_frame_rate ?? v.r_frame_rate}`)
  if (v.width !== width || v.height !== height) problems.push(`size:${v.width}x${v.height}`)
  if (a.codec_name !== 'aac') problems.push(`audio_codec:${a.codec_name ?? 'none'}`)
  if (Number(a.sample_rate) !== 48000) problems.push(`sample_rate:${a.sample_rate ?? 'none'}`)
  if (Number(a.channels) !== 2) problems.push(`channels:${a.channels ?? 'none'}`)
  if (Math.abs(duration - seconds) > 1 / fps + 0.03) problems.push(`duration:${duration}`)
  if (Number.isFinite(frames) && Math.abs(frames - want) > 1) problems.push(`frames:${frames}`)
  if (!decodeOk) problems.push('decode')
  return item('format', !problems.length, 'check_probe_failed', { problems, duration, frames: Number.isFinite(frames) ? frames : null, expected_frames: want })
}
/** Loudness gates: I ∈ [−15, −13] LUFS, TP ≤ −1.0 dBTP. */
export function loudnessCheck(m) {
  const g = loudnessGate(m)
  return item('loudness', g.ok, 'loudness_out_of_range', { I: g.I, TP: g.TP, LRA: g.LRA, failed: g.failed })
}
/** Cuts and sections on downbeats: every shot start and section start is a downbeat frame of the beat map. */
export function downbeatCheck(timeline, beatmap) {
  const fps = timeline.fps
  const downs = new Set(beatmap.downbeats.map((t) => Math.round(t * fps)))
  const off = []
  for (const s of timeline.shots) if (!downs.has(s.start_frame)) off.push(s.id)
  const sections = []
  for (const s of beatmap.sections) {
    const tl = timeline.sections.find((x) => x.id === s.id)
    if (!tl || tl.start_frame !== Math.round(s.start * fps) || !downs.has(tl.start_frame)) sections.push(s.id)
  }
  const maxMs = Math.max(0, ...timeline.shots.map((s) => {
    const exact = beatmap.downbeats.reduce((b, d) => (Math.abs(d - s.start) < Math.abs(b - s.start) ? d : b), beatmap.downbeats[0])
    return Math.abs(s.start_frame / fps - exact) * 1000
  }))
  return item('downbeats', !off.length && !sections.length, 'sync_out_of_tolerance', { shots: timeline.shots.length, off_beat: off, sections_off: sections, max_quantisation_ms: Math.round(maxMs * 10) / 10 })
}
/** SFX sync: each cue's measured onset on the SFX stem is within one frame of its action time. */
export function sfxCheck(timeline, onsets) {
  const frame = 1 / timeline.fps
  const rows = timeline.sfx.map((c, i) => ({ id: c.id, kind: c.kind, tier: c.tier, t: c.t, onset: onsets[i], dev_ms: onsets[i] == null ? null : Math.round((onsets[i] - c.t) * 10000) / 10 }))
  const bad = rows.filter((r) => r.onset == null || Math.abs(r.onset - r.t) > frame + 1e-9)
  const devs = rows.filter((r) => r.dev_ms != null).map((r) => Math.abs(r.dev_ms)).sort((a, b) => a - b)
  return item('sfx_sync', !bad.length, 'sfx_out_of_sync', {
    cues: rows.length,
    tiers: { normal: rows.filter((r) => r.tier === 'normal').length, emphasis: rows.filter((r) => r.tier === 'emphasis').length, climax: rows.filter((r) => r.tier === 'climax').length },
    median_ms: devs.length ? devs[Math.floor(devs.length / 2)] : null,
    max_ms: devs.length ? devs[devs.length - 1] : null,
    out_of_sync: bad.map((r) => r.id),
  })
}
/** Caption layout: at most 2 lines, each within the script's budget. */
export function captionCheck(timeline, style = {}) {
  const b = budgetFor(timeline.lang, style)
  const bad = []
  for (const c of timeline.captions) {
    if (c.lines.length > b.maxLines) bad.push({ shot: c.shot, reason: 'lines' })
    for (const l of c.lines) if (textWidth(l, timeline.lang) > b.perLine + 1e-9) bad.push({ shot: c.shot, reason: 'width', line: l })
  }
  return item('captions', !bad.length, 'caption_too_long', { blocks: timeline.captions.length, dir: timeline.dir, problems: bad })
}
/** AIGC: metadata AIGC + comment read back; badge 0–3 s; end card present. */
export function aigcCheck(probe, timeline) {
  const tags = probe?.format?.tags ?? {}
  const aigc = tags.AIGC ?? tags.aigc ?? null
  let parsed = null
  try { parsed = aigc ? JSON.parse(aigc) : null } catch { parsed = null }
  const ok = !!parsed && parsed.Label === '1' && !!parsed.ContentProducer && !!timeline.badge && timeline.end_card?.end - timeline.end_card?.start >= 4 - 1e-6
  return item('aigc', ok, 'aigc_metadata_missing', { metadata: parsed, badge: timeline.badge, end_card_s: Math.round((timeline.end_card.end - timeline.end_card.start) * 100) / 100 })
}
/** Re-hook gaps ≤ 35 s. */
export function rehookCheck(timeline, gate) {
  const times = [...(gate?.rehooks ?? timeline.rehooks).map((r) => r.t), timeline.seconds].sort((a, b) => a - b)
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) * 10) / 10)
  return item('rehooks', gaps.every((g) => g <= REHOOK_MAX_GAP_S + 1e-9), 'rehook_gap', { gaps })
}
/** Fact gate passed for the brief's language. */
export function factsCheck(gate) {
  return item('facts', gate?.status === 'passed', 'claim_unverified', { gate: gate?.status ?? null, lang: gate?.lang ?? null })
}
/** Scene code passed the no-network / determinism scan. */
export function scanCheck(scan) {
  return item('scene_scan', !!scan?.ok, 'scene_rejected', { scenes: scan?.scenes?.length ?? 0, rejected: (scan?.scenes ?? []).filter((s) => !s.ok).map((s) => s.name) })
}
/**
 * The Agent's visual self-review (work/review.json): every segment reviewed against the style do/don't
 * list, at most REWORK_MAX_ROUNDS rounds each, no open blocking issue. Missing -> fail (review_missing).
 */
export function reviewCheck(review, timeline) {
  if (!review || review.schema !== REVIEW_SCHEMA) return item('visual_review', false, 'review_missing', { reason: 'work/review.json missing' })
  const segs = new Map((review.segments ?? []).map((s) => [s.id, s]))
  const missing = timeline.segments.filter((s) => !segs.get(s.id)?.rounds?.length).map((s) => s.id)
  const open = [...segs.values()].flatMap((s) => (s.rounds?.[s.rounds.length - 1]?.open_blocking ?? []).map((x) => `${s.id}:${x}`))
  const tooMany = [...segs.values()].filter((s) => (s.rounds?.length ?? 0) > REWORK_MAX_ROUNDS).map((s) => s.id)
  return item('visual_review', !missing.length && !open.length && !tooMany.length, 'review_missing', { segments: segs.size, missing, open_blocking: open, over_rounds: tooMany })
}
export const strictFailures = (items) => items.filter((i) => i.status === 'fail' && i.code)
/** Stage to re-run per failing item. */
export const REWORK_STAGE = Object.freeze({ format: 'render', loudness: 'render', downbeats: 'timeline', sfx_sync: 'render', captions: 'script', aigc: 'render', rehooks: 'script', facts: 'script', scene_scan: 'scenes', visual_review: 'scenes' })
export const reworkPlan = (items) => items.filter((i) => i.status === 'fail').map((i) => ({ item: i.id, code: i.code ?? null, stage: REWORK_STAGE[i.id] ?? null }))
