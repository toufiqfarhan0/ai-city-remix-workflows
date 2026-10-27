// Bilingual report HTML: out/report.en.html and out/report.zh-CN.html from the same report.json and the
// same template (i18n keys report.*). Section order, effect first: film -> fact sheet -> shot list and
// captions -> theme, beats and SFX -> scenes and visual review -> quality checks -> cost -> compliance ->
// human review. A stage that did not run shows a "Not run / 未运行" card; a stale one a
// "Stale / 已过期" badge. Inline CSS, system font stack, no external resource. Pure.
import { formatDate, formatNumber, normalizeLang, t } from '../i18n.mjs'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const CSS = `
:root{--paper:#f6f1e6;--ink:#1d1b18;--mute:#6b645a;--line:#d9cfbd;--red:#b5332a;--ok:#2f6b3a;--warn:#9a6a12}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif;line-height:1.55}
main{max-width:1080px;margin:0 auto;padding:24px 20px 64px}
h1{font-size:1.7rem;margin:.2em 0}
h2{font-size:1.25rem;margin:2em 0 .6em;padding-bottom:.25em;border-bottom:2px solid var(--line)}
.meta{color:var(--mute);font-size:.92rem}
.banner{background:var(--red);color:#fff;padding:.5em .8em;border-radius:6px;font-weight:600;margin:.8em 0}
.card{border:1px dashed var(--mute);border-radius:8px;padding:.8em 1em;background:#fffaf0;margin:.6em 0}
.badge{display:inline-block;padding:.05em .5em;border-radius:999px;font-size:.8rem;font-weight:600;border:1px solid currentColor;margin-left:.4em}
.s-verified{color:var(--ok)}.s-single-source{color:var(--warn)}.s-disputed{color:var(--red)}.s-rejected{color:var(--mute)}
.stale{color:var(--warn)}.pass{color:var(--ok)}.fail{color:var(--red)}.skipped,.info{color:var(--mute)}
table{width:100%;border-collapse:collapse;font-size:.92rem;margin:.4em 0}
th,td{text-align:left;vertical-align:top;padding:.35em .5em;border-bottom:1px solid var(--line)}
th{font-weight:600;background:#efe6d2}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em}
video,img{max-width:100%;height:auto;border-radius:6px}
.bars{position:relative;height:34px;background:#efe6d2;border-radius:4px;overflow:hidden;margin:.4em 0 1.4em}
.bar{position:absolute;top:0;bottom:0;border-right:1px solid var(--paper);font-size:.72rem;padding:2px 3px;overflow:hidden;white-space:nowrap}
.m-drop{background:#e2b3aa}.m-build{background:#e7cfa2}.m-verse{background:#d8d0bd}.m-breakdown{background:#cdd6c9}.m-intro,.m-outro{background:#d3c7b4}
.hook{position:absolute;top:-2px;width:3px;height:38px;background:var(--red)}
.self{font-weight:600;color:var(--warn)}
`

const STAGE_HINT = (stage) => `node scripts/chronicle.mjs ${stage} --project <dir>`

function notRun(lang, stage) {
  return `<div class="card" role="note"><strong>${esc(t(lang, 'report.not_run'))}</strong> · <code>${esc(stage)}</code><br>${esc(t(lang, 'report.not_run_hint', { stage }))} <code>${esc(STAGE_HINT(stage))}</code></div>`
}

const staleBadge = (lang, report, stage) => (report.stages_stale.includes(stage) ? `<span class="badge stale">${esc(t(lang, 'report.stale'))}</span>` : '')

function valueText(lang, c) {
  const v = c.value
  if (v == null) return ''
  if (typeof v !== 'object') return String(v)
  if (v.label) return v.label[lang] ?? v.label.en ?? v.label['zh-CN'] ?? ''
  if (v.text) return v.text
  if (v.object || v.place || v.date) return [v.object, v.place, v.date].filter(Boolean).map((x) => valueText(lang, { value: x })).join(' · ')
  if (v.dimension) return [v.dimension, v.category ? valueText(lang, { value: v.category }) : '', v.as_of ?? ''].filter((x) => x !== '').join(' · ')
  if (Number.isFinite(v.y)) {
    const pad = (n) => String(n).padStart(2, '0')
    const ds = `${v.y}${v.m ? `-${pad(v.m)}` : ''}${v.m && v.d ? `-${pad(v.d)}` : ''}`
    try { return formatDate(lang, v.calendar === 'julian' ? { year: v.y, month: v.m, day: v.d, calendar: 'julian' } : ds) } catch { return v.raw ?? ds }
  }
  if (Number.isFinite(v.years)) return `${v.years}`
  if (Number.isFinite(v.value)) return `${formatNumber(lang, v.value)}${v.unit ? ` ${v.unit}` : ''}`
  return v.raw ?? JSON.stringify(v)
}

/** One locale's report page. */
export function renderReportHtml(report, langIn) {
  const lang = normalizeLang(langIn)
  const tr = (k, v) => esc(t(lang, k, v))
  const out = []
  const f = report.facts
  const ent = report.entity ?? f.entity
  const title = ent?.label?.[lang] ?? ent?.label?.en ?? ent?.qid ?? 'chronicle'
  const selfCheck = report.script?.entailment_by === 'agent' ? `<p class="self">${tr('report.entailment_self')}</p>` : ''
  out.push(`<header><h1>${esc(title)} · ${tr('report.title')}</h1><p class="meta">${tr('report.generated', { date: report.generated_at ? formatDate(lang, String(report.generated_at).slice(0, 10)) : '—' })} · ${esc(report.skill.slug ?? '')} ${esc(report.skill.version ?? '')} · ${tr('report.engine')} ${esc(report.engine_version ?? '')} · ${tr(`report.mode_${report.mode}`)}</p>`)
  if (report.mode === 'mock') out.push(`<p class="banner">MOCK · ${tr('report.mock_banner')}</p>`)
  if (report.mode === 'fixture') out.push(`<p class="banner">${tr('report.fixture_banner')}</p>`)
  out.push('</header>')

  // 1. Film.
  out.push(`<section id="film"><h2>${tr('report.h_film')}${staleBadge(lang, report, 'render')}</h2>`)
  if (report.render) {
    const src = String(report.render.output ?? 'out/film.mp4').replace(/^out\//, '')
    out.push(`<video controls preload="metadata" src="${esc(src)}" aria-label="${tr('report.film_alt', { title })}"></video>`)
    out.push(`<p class="meta">${tr('report.render_line', { width: report.render.width, height: report.render.height, fps: report.render.fps, seconds: formatNumber(lang, report.render.seconds ?? 0), ms: formatNumber(lang, report.render.ms_per_frame ?? 0), workers: report.render.workers ?? '—' })}</p>`)
    if (report.checks) out.push(`<img src="sheet.jpg" alt="${tr('report.sheet_alt')}">`)
  } else out.push(notRun(lang, 'render'), `<p class="meta">${tr(`report.mode_note_${report.mode}`)}</p>`)
  out.push('</section>')

  // 2. Fact sheet.
  out.push(`<section id="facts"><h2>${tr('report.h_facts')}</h2>${selfCheck}`)
  out.push(`<p class="meta">${tr('report.entity_line', { qid: ent?.qid ?? '', rule: ent?.lock_rule ?? '', living: ent?.living ? tr('report.yes') : tr('report.no'), portrait: ent?.portrait_policy ?? '' })}</p>`)
  out.push(`<p class="meta">${tr('report.facts_counts', { claims: f.claims.length, rejected: f.rejected_count ?? 0, invalid: f.value_invalid_count ?? 0, excerpt: f.excerpt_not_found_count ?? 0 })}</p>`)
  out.push(`<table><thead><tr><th>${tr('report.col_claim')}</th><th>${tr('report.col_status')}</th><th>${tr('report.col_value')}</th><th>${tr('report.col_sources')}</th><th>${tr('report.col_lines')}</th></tr></thead><tbody>`)
  for (const c of f.claims) {
    const src = (c.sources ?? []).map((s) => `${esc(s.id)} · ${tr('report.tier', { tier: s.tier })} · ${esc(s.publisher ?? '')}<br><q>${esc(s.excerpt ?? '')}</q>${s.url ? `<br><code>${esc(s.url)}</code>` : ''}`).join('<hr>')
    out.push(`<tr><td><code>${esc(c.id)}</code><br>${esc(c.predicate)}<br>${esc(c.text?.[lang] ?? c.text?.en ?? '')}</td><td><span class="badge s-${esc(c.status)}">${tr(`report.status_${c.status}`)}</span>${(c.flags ?? []).length ? `<br><code>${esc(c.flags.join(', '))}</code>` : ''}</td><td>${esc(valueText(lang, c))}</td><td>${src}</td><td>${esc((c.lines ?? []).join(', '))}</td></tr>`)
  }
  out.push('</tbody></table>')
  if ((f.disputed ?? []).length) {
    out.push(`<h3>${tr('report.h_disputed')}</h3><ul>`)
    for (const d of f.disputed) out.push(`<li><code>${esc(d.instance)}</code>: ${d.sides.map((s) => `${esc(s.values?.map((v) => (typeof v === 'object' ? v.raw ?? v.text ?? JSON.stringify(v) : v)).join(' / '))} (${esc(s.sources?.map((x) => x.publisher).join(', '))})`).join(' ↔ ')}</li>`)
    out.push('</ul>')
  }
  out.push('</section>')

  // 3. Script.
  out.push(`<section id="script"><h2>${tr('report.h_script')}${staleBadge(lang, report, 'script')}</h2>`)
  if (report.script) {
    out.push(selfCheck)
    if (report.script.title) out.push(`<p><strong>${esc(report.script.title)}</strong></p>`)
    if (report.script.gate) out.push(`<p class="meta">${tr('report.gate_line', { status: report.script.gate.status, by: report.script.entailment_by ?? '—', units: report.script.gate.budget?.total ?? 0, unit: report.script.gate.budget?.unit ?? '' })}</p>`)
    out.push(`<table><thead><tr><th>${tr('report.col_line')}</th><th>${tr('report.col_shot')}</th><th>${tr('report.col_text')}</th><th>${tr('report.col_claims')}</th></tr></thead><tbody>`)
    for (const l of report.script.lines) out.push(`<tr><td><code>${esc(l.id)}</code><br><span class="meta">${esc(l.section)} · ${esc(l.bars)} ${tr('report.bars')} · ${esc(l.kind)}${l.kp ? ` · ${esc(l.kp)}` : ''}${l.rehook ? ' · ↺' : ''}</span></td><td><span class="meta">${esc(l.size)} · ${esc(l.camera)} · <code>${esc(l.scene)}</code></span><br>${esc(l.description)}</td><td>${esc(l.text)}${l.hedge ? ` <span class="badge">${esc(l.hedge)}</span>` : ''}</td><td><code>${esc(l.claims.join(', '))}</code></td></tr>`)
    out.push('</tbody></table>')
  } else out.push(notRun(lang, 'script'))
  out.push('</section>')

  // 4. Theme, beats and SFX.
  out.push(`<section id="beats"><h2>${tr('report.h_beats')}${staleBadge(lang, report, 'timeline')}</h2>`)
  if (report.plan) {
    const p = report.plan
    out.push(`<p class="meta">${tr('report.plan_line', { bpm: p.bpm, bars: p.total_bars, seconds: p.seconds, kp: `${p.kp.min}–${p.kp.max}` })}</p>`)
    const total = p.total_bars
    const bars = p.sections.map((s) => `<div class="bar m-${esc(s.music)}" style="left:${((100 * s.start_bar) / total).toFixed(3)}%;width:${((100 * s.bars) / total).toFixed(3)}%" title="${esc(s.id)}">${esc(s.id)}</div>`).join('')
    const hooks = (p.rehooks ?? []).map((r) => `<div class="hook" style="left:${((100 * r.bar) / total).toFixed(3)}%" title="${esc(r.kind)}"></div>`).join('')
    out.push(`<div class="bars" role="img" aria-label="${tr('report.bars_alt')}">${bars}${hooks}</div>`)
  } else out.push(notRun(lang, 'script'))
  if (report.music) out.push(`<p class="meta">${tr('report.music_line', { theme: report.music.theme, bpm: report.music.bpm, key: report.music.key, bars: report.music.bars })}</p>`)
  else out.push(notRun(lang, 'music'))
  if (report.timeline_summary) {
    const ts = report.timeline_summary
    out.push(`<p class="meta">${tr('report.timeline_line', { shots: ts.shots, captions: ts.captions, cards: ts.kp_cards, cues: ts.sfx.cues, normal: ts.sfx.normal, emphasis: ts.sfx.emphasis, climax: ts.sfx.climax, lang: ts.lang, dir: ts.dir })}</p>`)
    out.push(`<table><thead><tr><th>${tr('report.col_segment')}</th><th>${tr('report.col_time')}</th></tr></thead><tbody>${ts.segments.map((g) => `<tr><td><code>${esc(g.id)}</code> ${esc(g.name)} (${esc(g.sections.join(', '))})</td><td>${formatNumber(lang, g.start, { maximumFractionDigits: 2 })}–${formatNumber(lang, g.end, { maximumFractionDigits: 2 })} s</td></tr>`).join('')}</tbody></table>`)
  } else out.push(notRun(lang, 'timeline'))
  out.push('</section>')

  // 5. Scenes and visual review.
  out.push(`<section id="visuals"><h2>${tr('report.h_visuals')}${staleBadge(lang, report, 'scenes')}</h2>`)
  if (report.scenes) {
    out.push(`<p class="meta">${tr('report.scenes_line', { count: report.scenes.count, scan: report.scenes.scan_ok ? tr('report.result_pass') : tr('report.result_fail') })}</p>`)
    const segs = report.scenes.review?.segments ?? []
    if (segs.length) {
      out.push(`<table><thead><tr><th>${tr('report.col_segment')}</th><th>${tr('report.col_rounds')}</th><th>${tr('report.col_notes')}</th></tr></thead><tbody>`)
      for (const g of segs) out.push(`<tr><td><code>${esc(g.id)}</code></td><td>${esc((g.rounds ?? []).length)}</td><td>${(g.rounds ?? []).map((r, i) => `<strong>${i + 1}.</strong> ${esc((r.findings ?? []).join(' · '))}${r.fixes?.length ? `<br><em>${esc(r.fixes.join(' · '))}</em>` : ''}`).join('<br>')}</td></tr>`)
      out.push('</tbody></table>')
    } else out.push(`<p class="meta">${tr('report.review_none')}</p>`)
  } else out.push(notRun(lang, 'scenes'))
  out.push('</section>')

  // 6. Quality checks.
  out.push(`<section id="checks"><h2>${tr('report.h_checks')}${staleBadge(lang, report, 'check')}</h2>`)
  if (report.checks) {
    out.push(`<table><thead><tr><th>${tr('report.col_check')}</th><th>${tr('report.col_result')}</th><th>${tr('report.col_details')}</th></tr></thead><tbody>`)
    for (const i of report.checks.items) out.push(`<tr><td>${esc(i.id)}</td><td class="${esc(i.status)}">${tr(`report.result_${i.status}`)}${i.code && i.status === 'fail' ? ` <code>${esc(i.code)}</code>` : ''}</td><td><code>${esc(JSON.stringify(i.details ?? {}))}</code></td></tr>`)
    out.push('</tbody></table>')
    if (report.checks.items.length) out.push(`<img src="joins.jpg" alt="${tr('report.joins_alt')}">`)
  } else out.push(notRun(lang, 'check'))
  out.push('</section>')

  // 7. Cost.
  out.push(`<section id="spend"><h2>${tr('report.h_spend')}</h2><p>${tr('report.cost_line')}</p></section>`)

  // 8. Compliance.
  const cp = report.compliance
  out.push(`<section id="compliance"><h2>${tr('report.h_compliance')}</h2><ul>`)
  out.push(`<li>${tr('report.c_badge', { from: cp.aigc.badge[0], to: cp.aigc.badge[1] })}</li>`)
  out.push(`<li>${cp.aigc.end_card ? tr('report.c_end_card', { from: formatNumber(lang, cp.aigc.end_card[0], { maximumFractionDigits: 2 }), to: formatNumber(lang, cp.aigc.end_card[1], { maximumFractionDigits: 2 }) }) : tr('report.c_end_card_none')}</li>`)
  out.push(`<li>${tr('report.c_metadata')}: ${esc(cp.implicit_label)}${cp.aigc.metadata ? '' : ` (${tr('report.c_not_rendered')})`}</li>`)
  out.push(`<li>${tr('report.c_portrait', { policy: cp.portrait_policy ?? '—' })}</li><li>${tr('report.c_map')}</li><li>${tr('report.c_commercial')} (<em>${esc(cp.commercial_terms_note)}</em>)</li></ul></section>`)

  // 9. Human review.
  const hr = report.human_review
  out.push(`<section id="review"><h2>${tr('report.h_review')}</h2><ul>${['facts', 'visuals', 'listening'].map((k) => `<li>${tr(`report.review_${k}`)}: <strong class="${hr[k] ? 'pass' : 'fail'}">${hr[k] ? tr('report.reviewed') : tr('report.not_reviewed')}</strong></li>`).join('')}</ul><p class="meta">${tr('report.review_note')}</p>`)
  if (report.warnings.length) out.push(`<h3>${tr('report.h_warnings')}</h3><ul>${report.warnings.map((w) => `<li><code>${esc(w)}</code></li>`).join('')}</ul>`)
  out.push('</section>')

  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · ${tr('report.title')}</title><style>${CSS}</style></head>
<body><main>
${out.join('\n')}
</main></body></html>
`
}
