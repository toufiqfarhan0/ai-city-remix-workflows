// Script and fact gate. Deterministic; rule 3 (entailment) is the Agent's own fact-checker answer
// (work/script/entail.agent.json), judged only from the caption text, the claim texts and excerpts.
//
//   rule 1 structure (exit 9): schema, brief fields, shots tiling every theme section in whole bars
//          (every cut on a downbeat), shot count, knowledge points (count, sections, one shot each),
//          re-hook shots on the planned bars (gaps <= 35 s), caption budget per script (CJK about 16
//          characters per line, spaced scripts 9 words / 42 characters, at most 2 lines), reading
//          time, glyph coverage of the bundled fonts, SFX annotations, portrait ban for living people
//   rule 2 fact binding (exit 6) on every caption and virtual line (title, kp cards, end card): claims
//          exist and are not rejected, hedges, quotes, fact leaks (claim_unbound), numbers, card values,
//          superlatives
//   rule 3 entailment (exit 6): skipped when rule 1 or rule 2 failed
// All errors are collected; any structure error -> exit 9, else any fact error -> exit 6.
//
// The number, date, name and hedge rules have lexicons for English and Chinese; other film languages
// are checked with the English rules (numbers and dates still compare digit by digit).
import { ChronicleError } from '../errors.mjs'
import { labelsEquivalent, loadKnownEntities, normalizeLabel } from '../facts/labels.mjs'
import { compareDates, normalizeDate, precisionRank } from '../facts/normalize-date.mjs'
import { normalizeNumber, numbersEqual } from '../facts/normalize-number.mjs'
import { layoutCaption, minHoldSeconds } from '../timeline/captions.mjs'
import { missingGlyphs } from '../util/fonts.mjs'
import { sha256Json } from '../util/json.mjs'
import { barSeconds, REHOOK_MAX_GAP_S, SHOT_BARS } from './beatsheet.mjs'
import { allowedSet, analyzeLine, claimType, dateAllowed, hasHedgeMarker, labelNames, numberAllowed } from './lexicon.mjs'
import { displayTexts, gateView, localized, scriptLines, validateScriptSchema, virtualLines } from './script-schema.mjs'
import { defaultStructure } from './templates.mjs'
export const GATE_SCHEMA = 'chronicle-gate/2'
export const ENTAIL_REQUEST_SCHEMA = 'chronicle-entail-request/1'
export const ENTAIL_SCHEMA = 'chronicle-entail/1'
export const ENTAIL_AGENT_FILE = 'entail.agent.json'
export const ENTAIL_NOTE_MAX = 280
export const SINGLE_SOURCE_MAX_LINES = 2
export const ENTAILED = Object.freeze(['yes', 'partial', 'no', 'n/a'])
export const EXTRA_FACTS = Object.freeze(['yes', 'no'])
/** Shots per film: at least one per 2.5 bars on average, at most one per bar. */
export const SHOTS_MIN_RATIO = 0.4
const err = (code, rule, line = null, details) => (details ? { code, rule, line, details } : { code, rule, line })
/** Lexicon language of the fact rules for a film language. */
export const gateLang = (lang) => (/^zh(-|$)/i.test(String(lang)) ? 'zh-CN' : 'en')
/** as_of year for "years ago" numbers: the max retrieved_at year of the fact sheet's sources. */
export function asOfYear(facts) {
  let max = null
  for (const c of facts?.claims ?? []) {
    for (const s of c.sources ?? []) {
      const y = Number(String(s.retrieved_at ?? '').slice(0, 4))
      if (Number.isInteger(y) && y > 0 && (max == null || y > max)) max = y
    }
  }
  return max
}
/** Shots whose scene is declared to depict a living entity person (portrait ban). */
export function forbiddenPortraits(script, entity) {
  if (entity?.living !== true) return []
  return (script?.shots ?? []).filter((s) => s?.params?.depicts_person === true).map((s) => s.id)
}
/** Shot start bars (absolute) of a script, in order, and per-section bar sums. */
export function shotBars(script, plan) {
  const sec = new Map(plan.sections.map((s) => [s.id, s]))
  const used = new Map()
  const out = []
  for (const shot of script?.shots ?? []) {
    const ps = sec.get(shot?.section)
    if (!ps) continue
    const at = used.get(ps.id) ?? 0
    out.push({ id: shot.id, section: ps.id, start_bar: ps.start_bar + at, bars: shot.bars })
    used.set(ps.id, at + (Number.isInteger(shot.bars) ? shot.bars : 0))
  }
  return { shots: out, used }
}
/**
 * Rule 1 (structure).
 * @param {{ coverage?: Set<number> }} input coverage: code points of the bundled fonts (glyph check)
 * @returns {{ errors: object[], warnings: string[], budget: object, rehooks: object[] }}
 */
export function structureErrors({ script, brief, plan, facts, stylePack = {}, coverage = null }) {
  const errors = []
  const warnings = []
  const add = (code, details, line = null) => errors.push(err(code, 'structure', line, details))
  const lang = brief.lang
  for (const e of validateScriptSchema(script, lang)) add(e.code, e.details)
  if (!script || typeof script !== 'object' || !Array.isArray(script.shots)) return { errors, warnings, budget: null, rehooks: [] }
  const subject = brief.subject ?? facts?.entity?.subject
  const structure = brief.structure ?? defaultStructure(subject)
  if (script.seconds !== brief.seconds) add('script_invalid:seconds', { script: script.seconds ?? null, brief: brief.seconds })
  if (script.subject !== subject) add('script_invalid:subject', { script: script.subject ?? null, brief: subject })
  if (script.structure != null && script.structure !== structure) add('script_invalid:structure', { script: script.structure, brief: structure })
  const shots = script.shots.filter((x) => x && typeof x.id === 'string')
  // Sections in theme order, each tiled exactly by its shots.
  const order = plan.sections.map((s) => s.id)
  let last = -1
  for (const shot of shots) {
    const k = order.indexOf(shot.section)
    if (k < 0) add(`script_invalid:${shot.id}.section`, { section: shot.section ?? null, allowed: order })
    else if (k < last) add(`script_invalid:${shot.id}.section`, { reason: 'order' })
    else last = k
    if (Number.isInteger(shot.bars) && !SHOT_BARS.includes(shot.bars)) add(`script_invalid:${shot.id}.bars`, { bars: shot.bars, allowed: SHOT_BARS })
  }
  const { shots: placed, used } = shotBars(script, plan)
  for (const s of plan.sections) if ((used.get(s.id) ?? 0) !== s.bars) add(`script_invalid:${s.id}.shots`, { bars: used.get(s.id) ?? 0, plan_bars: s.bars })
  if (shots.length < Math.ceil(plan.total_bars * SHOTS_MIN_RATIO)) add('script_invalid:shot_count', { count: shots.length, min: Math.ceil(plan.total_bars * SHOTS_MIN_RATIO) })
  // The end card owns the last END_CARD_BARS bars: the final shot must be at least that long.
  const lastShot = shots[shots.length - 1]
  if (lastShot && (lastShot.section !== 'outro' || !(lastShot.bars >= plan.end_card_bars))) add('script_invalid:end_card_shot', { shot: lastShot.id, min_bars: plan.end_card_bars })
  // Knowledge points.
  const kps = Array.isArray(script.knowledge_points) ? script.knowledge_points.filter((k) => k && typeof k.id === 'string') : []
  if (kps.length < plan.kp.min || kps.length > plan.kp.max) add('kp_count', { count: kps.length, min: plan.kp.min, max: plan.kp.max })
  const planSec = new Map(plan.sections.map((s) => [s.id, s]))
  for (const kp of kps) {
    const on = shots.filter((s) => s.kp === kp.id)
    if (on.length !== 1) add(`kp_count:${kp.id}`, { shots: on.map((s) => s.id), reason: 'one_shot_each' })
    else if (!planSec.get(on[0].section)?.kp_allowed) add(`kp_count:${kp.id}`, { section: on[0].section, reason: 'section_not_allowed' })
    else if (on[0].bars < 2) add(`kp_count:${kp.id}`, { shot: on[0].id, reason: 'shot_shorter_than_2_bars' })
  }
  for (const s of shots) if (s.kp && !kps.some((k) => k.id === s.kp)) add(`script_invalid:${s.id}.kp`, { kp: s.kp })
  // Re-hooks: each planned re-hook needs a `rehook: true` shot starting within ±1 bar of it.
  const barS = barSeconds(plan.bpm)
  const hooks = placed.filter((p) => shots.find((s) => s.id === p.id)?.rehook === true)
  const rehooks = plan.rehooks.map((r) => {
    const hit = hooks.find((h) => Math.abs(h.start_bar - r.bar) <= 1)
    if (!hit) add(`rehook_missing:${r.i}`, { bar: r.bar, t: r.t, kind: r.kind })
    return { ...r, shot: hit?.id ?? null, t: hit ? Math.round(hit.start_bar * barS * 1000) / 1000 : r.t }
  })
  const times = [...rehooks.map((r) => r.t), plan.seconds].sort((a, b) => a - b)
  for (let i = 0; i + 1 < times.length; i++) if (times[i + 1] - times[i] > REHOOK_MAX_GAP_S + 1e-9) add(`rehook_gap:${i}`, { from: times[i], to: times[i + 1], max: REHOOK_MAX_GAP_S })
  for (const id of forbiddenPortraits(script, facts?.entity)) add(`portrait_forbidden:${id}`)
  // Captions: budget, layout and reading time.
  const capStyle = stylePack.captions ?? {}
  const budget = { unit: /^(zh|ja|yue)/i.test(lang) ? 'chars' : 'words', total: 0, lines: {} }
  for (const shot of shots) {
    const cap = localized(shot.caption, lang)
    if (!cap || typeof cap.text !== 'string') continue
    const lay = layoutCaption(cap.text, lang, capStyle)
    budget.lines[shot.id] = lay.units
    budget.total += lay.units
    if (!lay.ok) add(`caption_too_long:${shot.id}`, { lines: lay.lines, reason: lay.reason }, shot.id)
    const hold = (Number(shot.bars) || 0) * barS - (capStyle.lead_beats ?? 0.5) * (barS / 4)
    const need = minHoldSeconds(cap.text, lang, capStyle.min_hold_s ?? 1.6)
    if (hold + 1e-9 < need) add(`caption_too_fast:${shot.id}`, { hold: Math.round(hold * 100) / 100, need: Math.round(need * 100) / 100 }, shot.id)
  }
  // Glyphs: every display text must be covered by the bundled fonts (never render tofu).
  if (coverage) for (const g of missingGlyphs(displayTexts(script, lang), coverage)) add(`glyph_missing:${g.cp}`, { char: g.char, text: g.text })
  return { errors, warnings, budget, rehooks }
}
/** Label value from a plain card string. */
const labelOf = (s) => ({ label: { en: s, 'zh-CN': s } })

/**
 * Whether a knowledge-point card value equals one of its claims' values (design §6.6 rule 2):
 * number/count/date/label/enum/age by type; text, quote and superlative claims never qualify.
 */
export function cardValueMatches(value, claims, known) {
  const v = String(value ?? '').trim()
  if (!v) return false
  for (const c of claims) {
    const x = c.value
    switch (claimType(c)) {
      case 'number': {
        const n = normalizeNumber(v)
        if (n && x && numbersEqual(n, x) && (n.approx || Math.abs(n.value - x.value) <= 1e-9 * Math.max(1, Math.abs(x.value)))) return true
        break
      }
      case 'count': {
        const n = normalizeNumber(v)
        if (n && !n.approx && n.value === x) return true
        break
      }
      case 'date': {
        const d = normalizeDate(v)
        if (d && x && compareDates(d, x).equal && precisionRank(d.precision) <= precisionRank(x.precision)) return true
        break
      }
      case 'event': {
        const d = x?.date ? normalizeDate(v) : null
        if (d && compareDates(d, x.date).equal && precisionRank(d.precision) <= precisionRank(x.date.precision)) return true
        for (const k of ['object', 'place']) if (x?.[k] && labelsEquivalent(labelOf(v), x[k], known)) return true
        break
      }
      case 'label':
        if (x && labelsEquivalent(labelOf(v), x, known)) return true
        break
      case 'enum':
        if (v === x) return true
        break
      case 'age': {
        const n = normalizeNumber(v)
        if (n && Number.isInteger(n.value) && n.value === x?.years) return true
        break
      }
      default:
        break
    }
  }
  return false
}

/**
 * Rule 2 for one line or virtual line.
 * @param {object} line { id, text, kind, claims, hedge, section, virtual?, card? }
 * @param {{ claimsById: Map, claims: object[], known: object, lang: string, asOf: number|null, plan: object, singleSource: string[], kpById: Map }} ctx
 * @returns {object[]} errors
 */
export function lineFactErrors(line, ctx) {
  const out = []
  const seen = new Set()
  const add = (code, details) => { if (!seen.has(code)) { seen.add(code); out.push(err(code, 'facts', line.id, details)) } }
  const ids = Array.isArray(line.claims) ? line.claims : []
  const bound = []
  for (const id of ids) {
    const c = ctx.claimsById.get(id)
    if (!c) add(`claim_unverified:${line.id}:${id}`, { reason: 'missing' })
    else if (c.status === 'rejected' || !['verified', 'single-source', 'disputed'].includes(c.status)) add(`claim_unverified:${line.id}:${id}`, { status: c.status ?? null })
    else bound.push(c)
  }
  if (line.kind === 'fact' && !ids.length) add(`claim_unbound:${line.id}`, { reason: 'fact_without_claim' })
  const text = String(line.text ?? '')
  const music = ctx.plan?.sections.find((s) => s.id === line.section)?.music
  if (bound.some((c) => c.status === 'single-source')) {
    ctx.singleSource.push(line.id)
    const ok = line.hedge === 'attributed' && hasHedgeMarker(text, ctx.lang, 'attributed') && music !== 'intro' && music !== 'drop' && line.section !== 'intro'
    if (!ok || ctx.singleSource.length > SINGLE_SOURCE_MAX_LINES) add(`hedge_missing:${line.id}`, { status: 'single-source', reason: !ok ? 'hedge' : 'too_many_lines' })
  }
  if (bound.some((c) => c.status === 'disputed') && !(line.hedge === 'one-account' && hasHedgeMarker(text, ctx.lang, 'one-account'))) add(`hedge_missing:${line.id}`, { status: 'disputed' })
  if (line.kind === 'quote') {
    const nt = normalizeLabel(text)
    const ok = bound.length > 0 && bound.length === ids.length && bound.every((c) => claimType(c) === 'quote' && c.status === 'verified' && normalizeLabel(c.value?.text) !== '' && nt.includes(normalizeLabel(c.value.text)))
    if (!ok) add(`quote_unsourced:${line.id}`)
  }
  const a = analyzeLine({ text, lang: ctx.lang, bound, claims: ctx.claims, known: ctx.known })
  // The film's own subject ("Rome" in a film about Rome) is never a leaked fact, even when some
  // claim's value happens to carry the same label (e.g. a province called "Rome").
  // A name that is only part of the subject's own name as written in the line ("York" and "New York"
  // inside "New York City") is the subject too.
  const nt0 = normalizeLabel(text), inSubject = (needle) => [...(ctx.subjectNames ?? [])].some((sn) => sn.includes(needle) && nt0.includes(sn))
  const leakedNames = a.names.filter((n) => !n.bound && !ctx.subjectNames?.has(n.needle) && !inSubject(n.needle))
  if (!bound.length) {
    if (a.dates.length || a.numbers.length || leakedNames.length) add(`claim_unbound:${line.id}`, { dates: a.dates.map((d) => d.text), numbers: a.numbers.map((n) => n.text), names: leakedNames.map((n) => n.text) })
  } else {
    const allowed = allowedSet(bound, { as_of_year: ctx.asOf })
    const badDates = a.dates.filter((d) => !dateAllowed(d, allowed))
    const badNumbers = a.numbers.filter((n) => !numberAllowed(n, allowed))
    if (badDates.length || badNumbers.length) add(`number_mismatch:${line.id}`, { dates: badDates.map((d) => d.text), numbers: badNumbers.map((n) => n.text) })
    if (leakedNames.length) add(`claim_unbound:${line.id}`, { names: leakedNames.map((n) => n.text) })
  }
  if (line.virtual && line.card) {
    const kp = ctx.kpById.get(line.id)
    const existing = ids.map((id) => ctx.claimsById.get(id)).filter(Boolean)
    if (!cardValueMatches(kp?.card?.value, existing, ctx.known)) add(`number_mismatch:${line.id}`, { reason: 'card_value', value: kp?.card?.value ?? null })
  }
  if (a.superlatives.length && !bound.some((c) => claimType(c) === 'superlative')) add(`superlative_unbound:${line.id}`, { words: a.superlatives.map((s) => s.text) })
  return out
}

/**
 * Rule 2 over all lines and virtual lines.
 * @returns {{ errors: object[], disputed: { line: string, claims: string[] }[] }}
 */
export function factErrors({ script, facts, known, lang, plan }) {
  const claims = facts?.claims ?? []
  const claimsById = new Map(claims.map((c) => [c.id, c]))
  const kpById = new Map((script.knowledge_points ?? []).filter((k) => k && typeof k.id === 'string').map((k) => [k.id, k]))
  const subjectNames = new Set(facts?.entity ? labelNames({ label: facts.entity.label, qid: facts.entity.qid }, known) : [])
  const ctx = { claimsById, claims, known, lang, asOf: asOfYear(facts), plan, singleSource: [], kpById, subjectNames }
  const errors = []
  const disputed = []
  for (const line of [...scriptLines(script), ...virtualLines(script)]) {
    errors.push(...lineFactErrors(line, ctx))
    const d = (line.claims ?? []).filter((id) => claimsById.get(id)?.status === 'disputed')
    if (d.length) disputed.push({ line: line.id, claims: d })
  }
  return { errors, disputed }
}

/** Entailment request (design §6.6 rule 3): every line and virtual line with its bound claims. */
export function buildEntailRequest({ script, facts, lang }) {
  const byId = new Map((facts?.claims ?? []).map((c) => [c.id, c]))
  const virt = virtualLines(script)
  const ordered = [...virt.filter((v) => v.id === 'title'), ...scriptLines(script), ...virt.filter((v) => v.id !== 'title')]
  const l = lang === 'zh-CN' ? 'zh-CN' : 'en'
  return {
    schema: ENTAIL_REQUEST_SCHEMA,
    script_sha256: sha256Json(script),
    items: ordered.map((line) => ({
      id: line.id,
      text: line.text,
      claims: (line.claims ?? []).map((id) => byId.get(id)).filter(Boolean).map((c) => ({
        id: c.id,
        text: c.text?.[l] ?? c.text?.[l === 'en' ? 'zh-CN' : 'en'] ?? '',
        excerpt: c.sources?.[0]?.excerpt ?? '',
        source_id: c.sources?.[0]?.id ?? null,
      })),
      questions: ['entailed', 'extra_facts'],
    })),
  }
}

/**
 * Strict validation of the Agent's entail.agent.json (design §6.6 rule 3). Throws
 * agent_file_invalid:entail.agent.json:<id> (exit 2) listing every problem; a stale script_sha256 sets
 * details.stale (the caller rewrites the request file).
 */
export function validateEntailAnswer(request, answer) {
  const problems = []
  const p = (id, reason) => problems.push({ id, reason })
  if (!answer || typeof answer !== 'object' || answer.schema !== ENTAIL_SCHEMA) p('schema', 'schema')
  const stale = !!answer && answer.script_sha256 !== request.script_sha256
  if (stale) p('script_sha256', 'stale')
  const answers = Array.isArray(answer?.answers) ? answer.answers : null
  if (!answers) p('answers', 'missing')
  const items = new Map(request.items.map((i) => [i.id, i]))
  const seen = new Set()
  for (const a of answers ?? []) {
    const id = a?.id
    const item = items.get(id)
    if (!item) { p(String(id), 'unknown_id'); continue }
    if (seen.has(id)) { p(id, 'duplicate'); continue }
    seen.add(id)
    if (!ENTAILED.includes(a.entailed) || !EXTRA_FACTS.includes(a.extra_facts)) { p(id, 'enum'); continue }
    if (item.claims.length && a.entailed === 'n/a') { p(id, 'n/a_with_claims'); continue }
    if (!item.claims.length && a.entailed !== 'n/a') { p(id, 'claims_missing_for_answer'); continue }
    if (a.note != null && (typeof a.note !== 'string' || [...a.note].length > ENTAIL_NOTE_MAX)) p(id, 'note')
  }
  if (answers) for (const id of items.keys()) if (!seen.has(id) && !problems.some((x) => x.id === id)) p(id, 'missing')
  if (problems.length) throw new ChronicleError(`agent_file_invalid:${ENTAIL_AGENT_FILE}:${problems[0].id}`, undefined, { file: ENTAIL_AGENT_FILE, problems, stale })
}

/**
 * Maps entailment answers to gate results. Missing or invalid answers count as failures
 * (entailment_failed), `no` -> entailment_failed, extra_facts `yes` -> claim_unbound, `partial` -> warning.
 */
export function entailmentErrors(request, answer) {
  const errors = []
  const warnings = []
  const list = Array.isArray(answer?.answers) ? answer.answers : Array.isArray(answer) ? answer : []
  const byId = new Map()
  for (const a of list) if (a && typeof a.id === 'string' && !byId.has(a.id)) byId.set(a.id, a)
  for (const item of request.items) {
    const a = byId.get(item.id)
    const hasClaims = item.claims.length > 0
    if (!a) { errors.push(err(`entailment_failed:${item.id}`, 'entailment', item.id, { reason: 'missing' })); continue }
    const entailOk = hasClaims ? ['yes', 'partial', 'no'].includes(a.entailed) : true
    if (!entailOk || !EXTRA_FACTS.includes(a.extra_facts)) { errors.push(err(`entailment_failed:${item.id}`, 'entailment', item.id, { reason: 'invalid' })); continue }
    if (hasClaims && a.entailed === 'no') errors.push(err(`entailment_failed:${item.id}`, 'entailment', item.id, { note: a.note ?? null }))
    if (hasClaims && a.entailed === 'partial') warnings.push(`entailment_partial:${item.id}`)
    if (a.extra_facts === 'yes') errors.push(err(`claim_unbound:${item.id}`, 'entailment', item.id, { reason: 'extra_facts', note: a.note ?? null }))
  }
  return { errors, warnings }
}

/** facts.json with claims[].lines back-filled from the script (lines and virtual lines, sorted). */
export function backfillLines(facts, script) {
  const map = new Map()
  for (const line of [...scriptLines(script), ...virtualLines(script)]) {
    for (const id of line.claims ?? []) {
      if (!map.has(id)) map.set(id, new Set())
      map.get(id).add(line.id)
    }
  }
  return { ...facts, claims: (facts?.claims ?? []).map((c) => ({ ...c, lines: [...(map.get(c.id) ?? [])].sort() })) }
}

/**
 * Runs the gate.
 * @param {{ script: object, brief: { lang: string, seconds: number, subject?: string, structure?: string }, plan: object, facts: object,
 *           known?: object, stylePack: object, coverage?: Set<number>, agentAnswer?: object|null }} input
 *   agentAnswer: the Agent's entail.agent.json (null -> awaiting_entailment once rules 1 and 2 pass)
 *   known: known-entities.json document or a loaded table; missing -> empty table + warning known_entities_missing
 * @returns {Promise<{ exit: number, status: 'passed'|'failed'|'awaiting_entailment', errors: object[], warnings: string[],
 *           gate: object, request: object|null, facts: object|null }>} request: entail request to write (Agent, awaiting);
 *           facts: back-filled facts.json when the gate passed
 */
export async function runScriptGate({ script, brief, plan, facts, known, stylePack, coverage = null, agentAnswer = null }) {
  const lang = gateLang(brief.lang)
  const view = gateView(script, brief.lang)
  const table = known && typeof known.names === 'function' ? known : loadKnownEntities(known)
  const warnings = [...(table.warnings ?? [])]
  const s1 = structureErrors({ script, brief, plan, facts, stylePack, coverage })
  warnings.push(...s1.warnings)
  const s2 = script && typeof script === 'object' ? factErrors({ script: view, facts, known: table, lang, plan }) : { errors: [], disputed: [] }
  const structureFailed = s1.errors.length > 0
  let status = null
  let request = null
  let ran = false
  const s3 = { errors: [], warnings: [] }
  if (!structureFailed && !s2.errors.length) {
    request = { ...buildEntailRequest({ script: view, facts, lang }), script_sha256: sha256Json(script), film_lang: brief.lang }
    if (agentAnswer == null) status = 'awaiting_entailment'
    else {
      validateEntailAnswer(request, agentAnswer)
      ran = true
      const r = entailmentErrors(request, agentAnswer)
      s3.errors.push(...r.errors)
      s3.warnings.push(...r.warnings)
    }
  }
  warnings.push(...s3.warnings)
  const errors = [...s1.errors, ...s2.errors, ...s3.errors]
  const exit = structureFailed ? 9 : errors.length ? 6 : 0
  if (status == null) status = exit ? 'failed' : 'passed'
  const gate = {
    schema: GATE_SCHEMA,
    script_sha256: script && typeof script === 'object' ? sha256Json(script) : null,
    status,
    exit,
    entailment_by: 'agent',
    lang: brief.lang,
    entailment_ran: ran,
    errors,
    warnings: [...new Set(warnings)],
    budget: s1.budget,
    rehooks: s1.rehooks,
    disputed_lines: s2.disputed,
  }
  return {
    exit, status, errors, warnings: gate.warnings, gate,
    request: status === 'awaiting_entailment' ? request : null,
    facts: status === 'passed' ? backfillLines(facts, view) : null,
  }
}
