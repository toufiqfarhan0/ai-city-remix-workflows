// Claim extraction (design §6.3): deterministic structured claims (Wikidata statements and tier-1
// JSON adapters), the source-chunk request the Agent extracts text claims from, and the gates every claim
// passes: predicate vocabulary (unknown -> other), value structure, subject, and the verbatim excerpt
// check. The full-text normalizer scan only produces hints, never evidence.
//
// Source records (work/research/sources/<id>.json): { id, url, final_url, tier, publisher, lang,
// retrieved_at, sha256, text, kind: 'wikidata' | 'adapter' | 'text', adapter?: 'cbdb' | 'gbif', variant? }.
import { ChronicleError } from '../errors.mjs'
import { cbdbClaims } from '../research/adapters/cbdb.mjs'
import { claimId, structuredClaim } from '../research/adapters/common.mjs'
import { gbifClaims } from '../research/adapters/gbif.mjs'
import { tierRank } from '../research/tiers.mjs'
import { statements } from '../research/wikidata.mjs'
import { fromWikidataTime, normalizeDate } from './normalize-date.mjs'
import { WIKIDATA_UNITS, normalizeNumber } from './normalize-number.mjs'
import { PREDICATES, SUPERLATIVE_DIMENSIONS, WIKIDATA_ENUMS, appliesTo, resolvePredicate, vocabularyFor } from './predicates.mjs'

/** Source chunks offered to the Agent for text-claim extraction (tier 1 first). */
export const EXTRACT_MAX_CALLS = 16
export const CHUNK_CHARS = 12_000
export const EXCERPT_MAX_WORDS = 30
export const EXCERPT_MAX_CJK = 60
export const AGENT_CLAIMS_FILE = 'claims.agent.json'

const QID = /^Q[1-9]\d{0,11}$/
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const HAS_CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

// --- excerpt gate ----------------------------------------------------------------------------------

/** NFKC, whitespace folded to one space and trimmed, Latin letters lower-cased. */
export function foldText(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/[A-Z]/g, (c) => c.toLowerCase())
}

/** Verbatim excerpt check: the folded excerpt is a substring of the folded source text. */
export const excerptFound = (excerpt, sourceText) => {
  const e = foldText(excerpt)
  return e.length > 0 && foldText(sourceText).includes(e)
}

/** Text-claim excerpts are at most 30 words or at most 60 CJK characters. */
export function excerptLengthOk(excerpt) {
  const s = String(excerpt ?? '')
  const cjk = (s.match(CJK) ?? []).length
  const words = s.replace(CJK, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
  return cjk <= EXCERPT_MAX_CJK && words <= EXCERPT_MAX_WORDS
}

/**
 * Re-checks the excerpt of every claim against the stored source text (claims read back from
 * claims.json go through the same gate). Claims whose source is missing count as excerpt_not_found.
 */
export function verifyExcerpts(claims, sourcesById) {
  const kept = []
  let notFound = 0
  for (const c of claims) {
    const src = sourcesById[c.source_id]
    if (src && excerptFound(c.excerpt, src.text)) kept.push(c)
    else notFound++
  }
  return { claims: kept, excerpt_not_found: notFound }
}

// --- chunking and the 12-call plan ----------------------------------------------------------------

/** Splits text into chunks of ≤ max characters, packing whole lines; over-long lines are cut. */
export function chunkText(text, max = CHUNK_CHARS) {
  const s = String(text ?? '')
  if (s.length <= max) return s ? [s] : []
  const chunks = []
  let cur = ''
  const push = () => { if (cur) chunks.push(cur); cur = '' }
  for (const line of s.split('\n')) {
    let rest = line
    while (rest.length > max) {
      push()
      let cut = max
      const code = rest.charCodeAt(cut - 1)
      if (code >= 0xd800 && code <= 0xdbff) cut-- // keep surrogate pairs together
      chunks.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    if (!cur) cur = rest
    else if (cur.length + 1 + rest.length <= max) cur += `\n${rest}`
    else { push(); cur = rest }
  }
  push()
  return chunks
}

/**
 * Allocates at most 12 extraction calls for the whole film: sources ordered tier 1 → 2 → 3 → lead,
 * then source_id, then chunk order. Skipped chunks give one warning
 * `extract_truncated:<source_id>=<chunks>[,…]`.
 * @param {{ id: string, tier: number|'lead', text: string, lang?: string }[]} sources text sources
 */
export function planExtraction(sources, { maxCalls = EXTRACT_MAX_CALLS, chunkChars = CHUNK_CHARS } = {}) {
  const ordered = [...sources].sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const calls = []
  const skipped = []
  for (const src of ordered) {
    const chunks = chunkText(src.text, chunkChars)
    let skip = 0
    chunks.forEach((text, i) => {
      if (calls.length < maxCalls) calls.push({ source_id: src.id, chunk: i + 1, chunk_count: chunks.length, lang: src.lang ?? null, text })
      else skip++
    })
    if (skip) skipped.push({ source_id: src.id, chunks: skip })
  }
  const warnings = skipped.length ? [`extract_truncated:${skipped.map((s) => `${s.source_id}=${s.chunks}`).join(',')}`] : []
  return { calls, skipped, warnings }
}

// --- value structures -------------------------------------------------------------------------------

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

/** Label value { label: { en?, zh-CN? }, qid? } with at least one language. */
function labelValue(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const src = v.label && typeof v.label === 'object' ? v.label : {}
  const label = {}
  for (const l of ['en', 'zh-CN']) {
    if (src[l] == null) continue
    if (!nonEmpty(src[l])) return null
    label[l] = src[l].trim()
  }
  if (v.qid != null && !(typeof v.qid === 'string' && QID.test(v.qid))) return null
  if (!label.en && !label['zh-CN']) return null
  return v.qid ? { label, qid: v.qid } : { label }
}

function dateValue(v) {
  const raw = typeof v === 'string' ? v : v && typeof v === 'object' ? v.raw : null
  if (!nonEmpty(raw)) return null
  const hint = v && typeof v === 'object' ? v.gregorian_year_hint : undefined
  if (hint != null && !Number.isInteger(hint)) return null
  const calendar = v && typeof v === 'object' ? v.calendar : undefined
  if (calendar != null && !['gregorian', 'julian', 'lunar-chinese'].includes(calendar)) return null
  const d = normalizeDate(raw, { calendar, gregorian_year_hint: hint })
  if (!d) return null
  return hint != null ? { ...d, gregorian_year_hint: hint } : d
}

/**
 * Validates and normalizes a value for a predicate type (design §6.4 table).
 * @returns {object|number|string|null} the normalized value, or null when the structure is invalid
 */
export function normalizeValue(predicate, value) {
  const def = PREDICATES[predicate]
  switch (def.type) {
    case 'date':
      return dateValue(value)
    case 'number': {
      const raw = typeof value === 'string' || typeof value === 'number' ? value : value?.raw
      return raw == null ? null : normalizeNumber(raw, { unit: value?.unit })
    }
    case 'count':
      return Number.isInteger(value) && value >= 0 ? value : null
    case 'age': {
      if (!value || typeof value !== 'object' || !Number.isInteger(value.years) || value.years < 0 || value.years > 200) return null
      const reckoning = value.reckoning ?? 'unknown'
      return ['exact', 'east-asian', 'unknown'].includes(reckoning) ? { years: value.years, reckoning } : null
    }
    case 'enum':
      return typeof value === 'string' && def.values.includes(value) ? value : null
    case 'label':
      return labelValue(value)
    case 'event': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const out = {}
      for (const k of ['object', 'place']) {
        if (value[k] == null) continue
        const l = labelValue(value[k])
        if (!l) return null
        out[k] = l
      }
      if (value.date != null) {
        const d = dateValue(value.date)
        if (!d) return null
        out.date = d
      }
      return out
    }
    case 'quote':
      return value && nonEmpty(value.text) ? { text: value.text.trim() } : null
    case 'superlative': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const out = {}
      if (value.dimension != null) {
        if (!SUPERLATIVE_DIMENSIONS.includes(value.dimension)) return null
        out.dimension = value.dimension
      }
      if (value.category != null) {
        const l = labelValue(value.category)
        if (!l) return null
        out.category = l
      }
      if (value.as_of != null) {
        const y = typeof value.as_of === 'number' ? value.as_of : /^-?\d{1,4}$/.test(String(value.as_of)) ? Number(value.as_of) : NaN
        if (!Number.isInteger(y)) return null
        out.as_of = y
      }
      return out
    }
    case 'text':
      if (nonEmpty(value)) return { text: value.trim() }
      return value && nonEmpty(value.text) ? { text: value.text.trim() } : null
    default:
      return null
  }
}

/** Resolves label QIDs through the known-entity table (label values and event object/place). */
function resolveLabels(type, value, known) {
  if (!known) return value
  const one = (l) => (l && !l.qid ? (known.resolve(l) ? { ...l, qid: known.resolve(l) } : l) : l)
  if (type === 'label') return one(value)
  if (type === 'event') {
    const out = { ...value }
    if (out.object) out.object = one(out.object)
    if (out.place) out.place = one(out.place)
    return out
  }
  if (type === 'superlative' && value.category) return { ...value, category: one(value.category) }
  return value
}

const textOf = (raw) => {
  const t = raw?.text
  const out = {}
  if (t && typeof t === 'object') for (const l of ['en', 'zh-CN']) if (nonEmpty(t[l])) out[l] = t[l].trim()
  return out
}

/** The text a re-typed `other` claim keeps: a string value, value.text, then the claim text or excerpt. */
function otherText(raw) {
  if (nonEmpty(raw.value)) return raw.value.trim()
  if (raw.value && nonEmpty(raw.value.text)) return raw.value.text.trim()
  const t = textOf(raw)
  return t.en ?? t['zh-CN'] ?? (nonEmpty(raw.excerpt) ? raw.excerpt.trim() : null)
}

/**
 * Gates one extracted claim (LLM or Agent).
 * @param {object} raw  { predicate, subject_qid, value, scope, text, excerpt, source_id }
 * @param {{ id: string, entity: object, sourcesById: object, known?: object, origin: string }} ctx
 * @returns {{ claim: object }|{ drop: 'subject_mismatch'|'value_invalid'|'excerpt_not_found' }}
 */
export function validateClaim(raw, { id, entity, sourcesById, known, origin }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { drop: 'value_invalid' }
  if (raw.subject_qid !== entity.qid) return { drop: 'subject_mismatch' }
  const name = typeof raw.predicate === 'string' ? raw.predicate.trim() : ''
  const predicate = resolvePredicate(name, entity.subject)
  let value
  const claim = { id, predicate }
  if (predicate === 'other' && name !== 'other') {
    claim.predicate_raw = name || null
    const text = otherText(raw)
    if (!text) return { drop: 'value_invalid' }
    value = { text }
  } else {
    value = normalizeValue(predicate, raw.value)
    if (value == null) return { drop: 'value_invalid' }
  }
  const src = sourcesById[raw.source_id]
  if (!src || !nonEmpty(raw.excerpt) || !excerptLengthOk(raw.excerpt) || !excerptFound(raw.excerpt, src.text)) return { drop: 'excerpt_not_found' }
  const type = PREDICATES[predicate].type
  value = resolveLabels(type, value, known)
  const scope = type === 'superlative' ? { dimension: value.dimension ?? null, category: value.category ?? null } : null
  return {
    claim: { ...claim, subject_qid: entity.qid, value, scope, text: textOf(raw), excerpt: raw.excerpt, source_id: raw.source_id, origin, flags: [] },
  }
}

// --- structured claims from Wikidata ----------------------------------------------------------------

/** The value's JSON text as it appears in the raw response (plain UTF-8 or \u-escaped). */
function rawJsonValue(text, v) {
  const plain = JSON.stringify(v)
  if (text.includes(plain)) return plain
  const escaped = plain.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return text.includes(escaped) ? escaped : null
}

function labelFromQid(qid, known) {
  const d = known?.display(qid)
  const label = {}
  if (d?.en) label.en = d.en
  if (d?.['zh-CN']) label['zh-CN'] = d['zh-CN']
  return { label, qid }
}

/**
 * Structured claims from the Wikidata source record (the raw wbgetentities JSON of the locked
 * entity): one claim per statement of every mapped predicate applicable to the subject. The excerpt
 * is the statement value's JSON string as written in the response (for example "+1037-01-08T00:00:00Z").
 * @returns {{ claims: object[], warnings: string[] }}
 */
export function wikidataClaims({ source, entity, known }) {
  let item
  try {
    item = JSON.parse(source.text)?.entities?.[entity.qid]
  } catch {
    item = null
  }
  if (!item || 'missing' in item) return { claims: [], warnings: ['adapter_unparsed:wikimedia'] }
  const claims = []
  for (const [predicate, def] of Object.entries(PREDICATES)) {
    if (!def.wikidata || !appliesTo(def, entity.subject)) continue
    for (const s of statements(item, def.wikidata)) {
      const dv = s.mainsnak.datavalue
      let value = null
      let excerptValue = null
      if (dv?.type === 'time' && def.type === 'date') {
        value = fromWikidataTime(dv.value)
        excerptValue = dv.value.time
      } else if (dv?.type === 'wikibase-entityid') {
        const qid = dv.value?.id
        if (!QID.test(String(qid))) continue
        if (def.type === 'enum') value = WIKIDATA_ENUMS[predicate]?.[qid] ?? null
        else if (def.type === 'label') value = labelFromQid(qid, known)
        excerptValue = qid
      } else if (dv?.type === 'quantity' && def.type === 'number') {
        const unit = WIKIDATA_UNITS[String(dv.value?.unit ?? '').match(/Q\d+$/)?.[0]] ?? ''
        value = normalizeNumber(`${String(dv.value?.amount ?? '').replace(/^\+/, '')} ${unit}`.trim())
        if (value) value.raw = dv.value.amount
        excerptValue = dv.value?.amount
      } else if ((dv?.type === 'monolingualtext' || dv?.type === 'string') && def.type === 'label') {
        const t = dv.type === 'string' ? dv.value : dv.value?.text
        if (!nonEmpty(t)) continue
        const lang = dv.type === 'string' ? (HAS_CJK.test(t) ? 'zh-CN' : 'en') : String(dv.value.language).startsWith('zh') ? 'zh-CN' : 'en'
        value = { label: { [lang]: t } }
        excerptValue = t
      }
      if (value == null || excerptValue == null) continue
      const excerpt = rawJsonValue(source.text, excerptValue)
      if (!excerpt) continue
      claims.push(structuredClaim({ id: claimId(source.id, claims.length + 1), predicate, value, excerpt, source, entity, known }))
    }
  }
  return { claims, warnings: [] }
}

/** Structured claims of every structured source (Wikidata, CBDB, GBIF). */
export function structuredClaims({ sources, entity, known }) {
  const claims = []
  const warnings = []
  for (const src of [...sources].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    let out = null
    if (src.kind === 'wikidata') out = wikidataClaims({ source: src, entity, known })
    else if (src.kind === 'adapter' && src.adapter === 'cbdb') out = cbdbClaims({ source: src, entity, known })
    else if (src.kind === 'adapter' && src.adapter === 'gbif') out = gbifClaims({ source: src, entity, known })
    if (!out) continue
    claims.push(...out.claims)
    warnings.push(...out.warnings)
  }
  return { claims, warnings }
}

// --- Agent answers --------------------------------------------------------------------------------

/**
 * Structural check of claims.agent.json. Agent mode has no translation call, so every claim needs
 * both text.en and text['zh-CN']; any problem rejects the whole file.
 * @throws {ChronicleError} agent_file_invalid:claims.agent.json:<id>.<field> (exit 2), details.problems lists all
 */
export function validateAgentClaims(doc) {
  const problems = []
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.claims)) problems.push('claims')
  else {
    doc.claims.forEach((c, i) => {
      const id = c && typeof c === 'object' && nonEmpty(c.id) ? c.id.trim() : `#${i + 1}`
      if (!c || typeof c !== 'object' || Array.isArray(c)) { problems.push(id); return }
      if (!nonEmpty(c.text?.en) || !nonEmpty(c.text?.['zh-CN'])) problems.push(`${id}.text`)
    })
  }
  if (problems.length) throw new ChronicleError(`agent_file_invalid:${AGENT_CLAIMS_FILE}:${problems[0]}`, undefined, { file: AGENT_CLAIMS_FILE, problems })
  return doc.claims
}

// --- hints (never evidence) ---------------------------------------------------------------------------

/**
 * Full-text scan of text sources for values equal to structured claims (years of dates, numbers).
 * Produces hints.json entries { source_id, claim_id, predicate, match } only; they never change a status.
 */
export function scanHints({ sources, claims }) {
  const hints = []
  for (const c of claims) {
    const type = PREDICATES[c.predicate]?.type
    let needle = null
    if (type === 'date' && Number.isInteger(c.value?.y) && c.value.y > 0) needle = String(c.value.y)
    else if (type === 'number' && Number.isFinite(c.value?.value)) needle = String(c.value.value)
    if (!needle) continue
    const re = new RegExp(`(?<![\\d.])${needle.replace('.', '\\.')}(?![\\d])`)
    for (const s of sources) {
      if (s.kind !== 'text' || s.id === c.source_id) continue
      if (re.test(s.text)) hints.push({ source_id: s.id, claim_id: c.id, predicate: c.predicate, match: needle })
    }
  }
  return hints.sort((a, b) => (a.source_id + a.claim_id < b.source_id + b.claim_id ? -1 : a.source_id + a.claim_id > b.source_id + b.claim_id ? 1 : 0))
}

/** Claims of visual predicates (also written to visual-claims.json). */
export const visualClaims = (claims) => claims.filter((c) => PREDICATES[c.predicate]?.visual)

// --- orchestration ------------------------------------------------------------------------------------

/**
 * All claims for a film. Structured claims come from Wikidata and the tier-1 adapters; text claims are
 * written by the Agent from the source chunks into claims.agent.json (no model is ever called).
 * @param {{ entity: object, sources: object[], known?: object, agentDoc?: object }} input
 * @returns {Promise<{ claims: object[], visual: object[], hints: object[], warnings: string[], counts: { value_invalid: number, subject_mismatch: number, excerpt_not_found: number } }>}
 */
export async function extractClaims({ entity, sources, known, agentDoc }) {
  const sourcesById = Object.fromEntries(sources.map((s) => [s.id, s]))
  const counts = { value_invalid: 0, subject_mismatch: 0, excerpt_not_found: 0 }
  const structured = structuredClaims({ sources, entity, known })
  const warnings = [...structured.warnings]
  const verified = verifyExcerpts(structured.claims, sourcesById)
  counts.excerpt_not_found += verified.excerpt_not_found
  const hints = scanHints({ sources, claims: verified.claims })
  const textClaims = []
  const accept = (raw, id, origin) => {
    const r = validateClaim(raw, { id, entity, sourcesById, known, origin })
    if (r.drop) counts[r.drop]++
    else textClaims.push(r.claim)
  }
  if (agentDoc) validateAgentClaims(agentDoc).forEach((raw, i) => accept(raw, `agent.${String(i + 1).padStart(3, '0')}`, 'agent'))
  const claims = [...verified.claims, ...textClaims]
  return { claims, visual: visualClaims(claims), hints, warnings, counts }
}
