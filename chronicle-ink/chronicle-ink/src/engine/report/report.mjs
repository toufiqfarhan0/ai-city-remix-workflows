// report.json (schema chronicle-report/2). buildReport(inputs) is a pure function: the CLI report stage
// passes what state.json says has run, the sample generator passes fixture data, and both get the same
// structure.
//
// `facts` is the only required block (stage_missing:facts otherwise). Every optional upstream stage of
// the report (script, timeline, music, scenes, render, check) whose data is null is listed in
// stages_missing, in pipeline order; stages_stale comes from the caller. Paths are project-relative and
// every string goes through redact(). No model is called by the Skill, so `cost` only records that.
import { ChronicleError, EXIT } from '../errors.mjs'
import { implicitLabelText } from '../render/mux.mjs'
import { redact } from '../util/redact.mjs'

export const REPORT_SCHEMA = 'chronicle-report/2'
/** Optional upstream stages of `report` and the input that carries each (design §3.1). */
export const REPORT_OPTIONAL = Object.freeze([
  ['script', 'script'], ['timeline', 'timeline'], ['music', 'music'], ['scenes', 'scenes'], ['render', 'render'], ['check', 'check'],
])
export const COMMERCIAL_TERMS_NOTE = 'visuals and music are produced by code in this project (fonts: SIL OFL); facts and excerpts keep their source licences'
export const REVIEW_KEYS = Object.freeze(['facts', 'visuals', 'listening'])

function timelineSummary(timeline) {
  if (!timeline) return null
  const tiers = (k) => timeline.sfx.filter((c) => c.tier === k).length
  return {
    seconds: timeline.seconds, fps: timeline.fps, frames: timeline.frames, aspect: timeline.aspect, lang: timeline.lang, dir: timeline.dir,
    bpm: timeline.bpm, sections: timeline.sections.map((s) => ({ id: s.id, start: s.start, end: s.end, bars: s.bars })),
    shots: timeline.shots.length, captions: timeline.captions.length, kp_cards: timeline.kp_cards.length,
    sfx: { cues: timeline.sfx.length, normal: tiers('normal'), emphasis: tiers('emphasis'), climax: tiers('climax') },
    rehooks: timeline.rehooks, segments: timeline.segments, end_card: timeline.end_card,
  }
}
/**
 * @param {object} inputs
 * @param {{ slug: string, version: string }} inputs.skill
 * @param {string} inputs.engineVersion
 * @param {'real'|'mock'|'fixture'} inputs.mode
 * @param {string} inputs.generatedAt ISO time (the sample passes a fixed value)
 * @param {object} inputs.brief
 * @param {object} inputs.facts      facts.json (required)
 * @param {object} [inputs.entity]   entity.json (falls back to facts.entity)
 * @param {object} [inputs.claimLines] work/script/claim-lines.json
 * @param {object} [inputs.script] script.json  @param {object} [inputs.gate] gate.json
 * @param {object} [inputs.plan]  @param {object} [inputs.music] beatmap.json  @param {object} [inputs.timeline]
 * @param {{ scan, review }} [inputs.scenes]  @param {object} [inputs.render] render.json  @param {object} [inputs.check] check.json
 * @param {object[]} [inputs.outputs] { path, sha256, bytes }
 * @param {string[]} [inputs.reviewed]  @param {string[]} [inputs.stale]  @param {string[]} [inputs.warnings]
 * @param {object} [inputs.aigcSpec]  @param {object} [inputs.env] for redaction of the live key
 */
export function buildReport(inputs) {
  const { facts } = inputs
  if (!facts || typeof facts !== 'object') throw new ChronicleError('stage_missing:facts', EXIT.input, { stage: 'report', upstream: 'facts' })
  const missing = REPORT_OPTIONAL.filter(([, key]) => inputs[key] == null).map(([stage]) => stage)
  const staleSet = new Set(inputs.stale ?? [])
  const stale = REPORT_OPTIONAL.map(([stage]) => stage).filter((s) => staleSet.has(s) && !missing.includes(s))
  const reviewed = new Set(inputs.reviewed ?? [])
  const humanReview = Object.fromEntries(REVIEW_KEYS.map((k) => [k, reviewed.has(k)]))
  const entity = inputs.entity ?? facts.entity
  const lines = inputs.claimLines?.lines ?? {}
  const factSheet = {
    ...facts,
    claims: facts.claims.map((c) => ({ ...c, lines: lines[c.id] ?? c.lines ?? [] })),
    human_review: humanReview,
  }
  const filmLang = inputs.brief?.lang ?? 'en'
  const loc = (field) => (field && typeof field === 'object' ? field[filmLang] ?? field[String(filmLang).split('-')[0]] ?? field.en ?? null : field ?? null)
  const script = inputs.script
    ? {
        lang: filmLang,
        langs: [...new Set((inputs.script.shots ?? []).flatMap((s) => Object.keys(s.caption ?? {})))].sort(),
        title: loc(inputs.script.title),
        entailment_by: inputs.gate?.entailment_by ?? null,
        gate: inputs.gate ? { status: inputs.gate.status, exit: inputs.gate.exit, errors: inputs.gate.errors?.length ?? 0, warnings: inputs.gate.warnings ?? [], budget: inputs.gate.budget ?? null } : null,
        lines: (inputs.script.shots ?? []).map((s) => ({ id: s.id, section: s.section, bars: s.bars, size: s.size, camera: s.camera, scene: s.scene, description: s.description, text: loc(s.caption)?.text ?? '', claims: s.claims ?? [], kind: s.kind, hedge: s.hedge ?? null, kp: s.kp ?? null, rehook: s.rehook === true, sfx: (s.sfx ?? []).length })),
        knowledge_points: (inputs.script.knowledge_points ?? []).map((k) => ({ id: k.id, claims: k.claims, card: loc(k.card), count: k.count ?? null })),
        end_card: inputs.script.end_card ? { line: loc(inputs.script.end_card.line), claims: inputs.script.end_card.claims } : null,
      }
    : null
  const track = inputs.music?.track ?? null
  const music = inputs.music ? { theme: track ? 'track' : inputs.music.theme, bpm: inputs.music.bpm, key: track ? null : inputs.music.key, bars: inputs.music.total_bars, sections: inputs.music.sections, track } : null
  const scenes = inputs.scenes ? { count: inputs.scenes.scan?.scenes?.length ?? 0, scan_ok: inputs.scenes.scan?.ok === true, review: inputs.scenes.review ?? null } : null
  const timeline = inputs.timeline
  const report = {
    schema: REPORT_SCHEMA,
    skill: { slug: inputs.skill?.slug ?? null, version: inputs.skill?.version ?? null },
    engine_version: inputs.engineVersion ?? null,
    mode: inputs.mode ?? 'real',
    generated_at: inputs.generatedAt ?? null,
    stages_missing: missing,
    stages_stale: stale,
    brief: inputs.brief ?? null,
    entity,
    facts: factSheet,
    script,
    plan: inputs.plan ?? null,
    kp_cards: timeline?.kp_cards ?? null,
    music,
    scenes,
    timeline_summary: timelineSummary(timeline),
    checks: inputs.check ? { film: inputs.check.film, items: inputs.check.items, failed: inputs.check.failed ?? [], listening: inputs.check.listening ?? null } : null,
    compliance: {
      aigc: { badge: [0, 3], end_card: timeline ? [timeline.end_card.start, timeline.end_card.end] : null, metadata: inputs.render != null },
      implicit_label: implicitLabelText(inputs.aigcSpec),
      portrait_policy: entity?.portrait_policy ?? null,
      map_policy: 'no-borders',
      commercial_terms_note: track ? `visuals are produced by code in this project (fonts: SIL OFL); music: ${track.credit?.en ?? track.title}; facts and excerpts keep their source licences` : COMMERCIAL_TERMS_NOTE,
    },
    voice: inputs.voice ?? null,
    cost: (() => {
      const models = [track?.generated?.model, inputs.voice?.model].filter(Boolean)
      if (!models.length) return { model_calls: 0, note: 'no image, voice, music, vision or LLM model is called by the Skill; writing is done by the user\'s own Agent' }
      return { model_calls: (track?.generated ? 1 : 0) + (inputs.voice?.lines ?? 0), note: `opt-in audio through SandBase: ${models.join(', ')}; no image, video or vision model is called by the Skill` }
    })(),
    render: inputs.render ? { seconds: inputs.render.seconds, ms_per_frame: inputs.render.ms_per_frame, workers: inputs.render.workers ?? null, gpu: inputs.render.gpu === true, width: inputs.render.width, height: inputs.render.height, fps: inputs.render.fps, output: inputs.render.output, loudnorm: inputs.render.loudnorm ?? null } : null,
    outputs: inputs.outputs ?? [],
    human_review: humanReview,
    warnings: [...new Set([...(inputs.warnings ?? []), ...(facts.warnings ?? []), ...(inputs.gate?.warnings ?? [])])].sort(),
  }
  return redact(report, inputs.env ?? {})
}
