// timeline stage: script.json + the theme's beat grid -> work/timeline.json (shots on downbeats,
// captions, knowledge-point cards, SFX cues, review segments) and out/captions.vtt. No model call.
import { t } from '../i18n.mjs'
import { compileTimeline, timelineVtt } from '../timeline/compile.mjs'
import { readProjectJson, writeProjectFile, writeProjectJson } from './common.mjs'
/** @param {object} ctx stage context */
export async function run(ctx) {
  const { brief, stylePack, lang, log } = ctx
  const script = readProjectJson(ctx, 'script.json', { code: 'stage_missing:script' })
  const timeline = compileTimeline({ script, brief, stylePack })
  writeProjectJson(ctx, 'work/timeline.json', timeline)
  writeProjectFile(ctx, 'out/captions.vtt', timelineVtt(timeline))
  log.log(t(lang, 'stage.timeline_done', { shots: timeline.shots.length, cues: timeline.sfx.length, segments: timeline.segments.map((s) => `${s.id} ${s.start}-${s.end}s`).join(', ') }))
  return { status: 'done', outputs: ['work/timeline.json', 'out/captions.vtt'] }
}
