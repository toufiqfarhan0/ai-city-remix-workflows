// report stage: reads what state.json says has run (optional upstreams that are missing stay null and
// appear in stages_missing; stale ones are read and listed in stages_stale), builds report.json with the
// pure buildReport() and writes the bilingual HTML pages (en + zh-CN, whatever the film language).
// --reviewed facts,visuals,listening sets the human-review flags (only after a person has looked).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { t } from '../i18n.mjs'
import { renderReportHtml } from '../report/html.mjs'
import { buildReport } from '../report/report.mjs'
import { sha256 } from '../util/json.mjs'
import { ENGINE_VERSION } from '../version.mjs'
import { abs, readProjectJson, writeProjectFile, writeProjectJson } from './common.mjs'
import { loadVoice } from '../audio/voice.mjs'

const OUT_FILES = ['out/film.mp4', 'out/captions.vtt', 'out/sheet.jpg', 'out/joins.jpg']

function skillOf(ctx) {
  try {
    const pkg = JSON.parse(readFileSync(`${ctx.skillDir}/package.json`, 'utf8'))
    return { slug: pkg.name, version: pkg.version }
  } catch {
    return { slug: null, version: null }
  }
}

/** @param {object} ctx stage context */
export async function run(ctx) {
  const { flags, lang, log, brief } = ctx
  const missing = new Set(ctx.upstream?.missing ?? [])
  const read = (stage, rel) => (missing.has(stage) ? null : readProjectJson(ctx, rel))
  const facts = readProjectJson(ctx, 'work/facts/facts.json', { code: 'stage_missing:facts' })
  const state = ctx.store?.read?.() ?? {}
  const outputs = OUT_FILES.filter((rel) => existsSync(abs(ctx, rel))).map((rel) => ({ path: rel, sha256: sha256(readFileSync(abs(ctx, rel))), bytes: statSync(abs(ctx, rel)).size }))
  const report = buildReport({
    skill: skillOf(ctx),
    engineVersion: ENGINE_VERSION,
    mode: state.fixture ? 'fixture' : 'real',
    generatedAt: ctx.now().toISOString(),
    brief,
    facts,
    entity: readProjectJson(ctx, 'work/research/entity.json'),
    claimLines: read('script', 'work/script/claim-lines.json'),
    script: read('script', 'script.json'),
    gate: read('script', 'work/script/gate.json'),
    plan: read('script', 'work/script/plan.json'),
    music: read('music', 'work/music/beatmap.json'),
    voice: (() => { const v = loadVoice(ctx.projectDir); return v ? { model: v.generated.model, voice_id: v.generated.voice_id ?? null, lines: v.lines.length, chars: v.lines.reduce((n, l) => n + l.text.length, 0), credit: v.credit } : null })(),
    timeline: read('timeline', 'work/timeline.json'),
    scenes: (() => { const scan = read('scenes', 'work/scenes/scan.json'); return scan ? { scan, review: readProjectJson(ctx, 'work/review.json') } : null })(),
    render: read('render', 'work/render/render.json'),
    check: read('check', 'work/check.json'),
    outputs,
    reviewed: flags.reviewed ? String(flags.reviewed).split(',').map((x) => x.trim()) : [],
    stale: ctx.upstream?.stale ?? [],
    env: ctx.env,
  })
  writeProjectJson(ctx, 'out/report.json', report)
  writeProjectFile(ctx, 'out/report.en.html', renderReportHtml(report, 'en'))
  writeProjectFile(ctx, 'out/report.zh-CN.html', renderReportHtml(report, 'zh-CN'))
  log.log(t(lang, 'stage.report_done', { missing: report.stages_missing.length ? report.stages_missing.join(', ') : '—' }))
  return { status: 'done', outputs: ['out/report.json', 'out/report.en.html', 'out/report.zh-CN.html'] }
}
