// Entity locking (design §6.1). The topic is locked to exactly one Wikidata item before any source
// is read; ambiguity is judged over ALL candidates (not only the ones a template can narrate), so
// "Mercury" is never silently locked to its only landmark-typed candidate.
import { ChronicleError } from '../errors.mjs'
import { t } from '../i18n.mjs'
import { fromWikidataTime } from '../facts/normalize-date.mjs'
import { bestStatement, itemValues, statements } from './wikidata.mjs'

export const Q_HUMAN = 'Q5'
export const Q_TAXON = 'Q16521'
export const Q_DISAMBIGUATION = 'Q4167410'
export const DOMINANT_MIN_SITELINKS = 10
export const DOMINANT_RATIO = 5
export const MAX_ALTERNATIVES = 6
export const LIVING_WINDOW_YEARS = 150
/** External identifiers the research stage turns into tier-1 sources through id_formatters. */
export const EXTERNAL_ID_PROPS = Object.freeze(['P1417', 'P497', 'P757', 'P846', 'P627'])

const has = (item, prop) => statements(item, prop).length > 0

/** person | animal | city | landmark | unsupported (selects a template; never rejects a topic by itself). */
export function subjectOf(item) {
  const p31 = itemValues(item, 'P31')
  if (p31.includes(Q_HUMAN)) return 'person'
  if (has(item, 'P105') || p31.includes(Q_TAXON)) return 'animal'
  // A place with a population and coordinates is a settlement (city/town); a bridge or temple has none.
  if (has(item, 'P625') && has(item, 'P1082')) return 'city'
  if (has(item, 'P625')) return 'landmark'
  return 'unsupported'
}

export const isDisambiguation = (item) => itemValues(item, 'P31').includes(Q_DISAMBIGUATION)
export const sitelinkCount = (item) => Object.keys(item?.sitelinks ?? {}).length
const qnum = (qid) => Number(String(qid).slice(1))

const text = (map, lang) => map?.[lang]?.value ?? null

/** Display labels: zh-CN prefers zh-hans, then zh-cn, zh, zh-hant; en is the English label. */
export function displayLabels(item, field = 'labels') {
  const m = item?.[field]
  return { en: text(m, 'en'), 'zh-CN': text(m, 'zh-hans') ?? text(m, 'zh-cn') ?? text(m, 'zh') ?? text(m, 'zh-hant') }
}

/** Candidate summary used in candidates.json, alternatives and error details. */
export function summarize(item) {
  return { qid: item.id, label: displayLabels(item), description: displayLabels(item, 'descriptions'), sitelinks: sitelinkCount(item), subject: subjectOf(item) }
}

const bySitelinks = (a, b) => sitelinkCount(b) - sitelinkCount(a) || qnum(a.id) - qnum(b.id)

/**
 * The lock rule of §6.1 over search candidates (in search order, already fetched with wbgetentities).
 * @param {object[]} items  Wikidata entities
 * @param {string} [subject] brief.subject
 * @returns {{ best: object, lock_rule: 'unique'|'dominant', rivals: object[] }}
 * @throws {ChronicleError} entity_not_found | subject_undetermined | entity_subject_mismatch | entity_ambiguous (exit 3)
 */
export function decideLock(items, subject) {
  const all = items.filter((it) => it && !('missing' in it) && !isDisambiguation(it))
  if (!all.length) throw new ChronicleError('entity_not_found', undefined, { candidates: [] })
  const typed = all.filter((it) => subjectOf(it) !== 'unsupported')
  if (!typed.length) throw new ChronicleError('subject_undetermined', undefined, { candidates: all.map(summarize) })
  const qualifying = subject ? typed.filter((it) => subjectOf(it) === subject) : typed
  if (!qualifying.length) throw new ChronicleError('entity_subject_mismatch', undefined, { subject, candidates: typed.map(summarize) })
  const best = [...qualifying].sort(bySitelinks)[0]
  const rivals = all.filter((it) => it.id !== best.id).sort(bySitelinks)
  if (!rivals.length) return { best, lock_rule: 'unique', rivals }
  const b = sitelinkCount(best)
  if (b >= DOMINANT_MIN_SITELINKS && b >= DOMINANT_RATIO * sitelinkCount(rivals[0])) return { best, lock_rule: 'dominant', rivals }
  throw new ChronicleError('entity_ambiguous', undefined, { candidates: [...all].sort(bySitelinks).map(summarize) })
}

/** candidates.json written when the lock fails with entity_ambiguous. */
export function candidatesDoc({ topic, candidates }) {
  return { schema: 'chronicle-candidates/1', topic: topic ?? null, hint: '--qid', candidates }
}

/** Date of the best-rank statement of a time property, from the JSON only. */
function dateOf(item, prop) {
  const s = bestStatement(item, prop)
  return s ? fromWikidataTime(s.mainsnak.datavalue?.value) : null
}

function languageMap(m, langs) {
  const out = {}
  for (const l of langs) if (m?.[l]?.value) out[l] = m[l].value
  return out
}

/**
 * entity.json record of a locked item.
 * @param {object} item  Wikidata entity
 * @param {{ lock_rule: string, alternatives?: object[], now?: number }} options  `now` (ms) for the living rule
 */
export function entityRecord(item, { lock_rule: lockRule, alternatives = [], now = Date.now() } = {}) {
  const subject = subjectOf(item)
  const born = dateOf(item, 'P569')
  const died = dateOf(item, 'P570')
  const year = new Date(now).getUTCFullYear()
  const living = subject === 'person' && !has(item, 'P570') && (!born || born.y >= year - LIVING_WINDOW_YEARS)
  const aliases = {}
  for (const l of ['zh-hans', 'zh-hant', 'zh', 'en']) {
    const list = (item.aliases?.[l] ?? []).map((a) => a.value).filter(Boolean)
    if (list.length) aliases[l] = list
  }
  const externalIds = {}
  for (const p of EXTERNAL_ID_PROPS) {
    const s = bestStatement(item, p)
    const v = s?.mainsnak?.datavalue?.value
    if (typeof v === 'string' && v) externalIds[p] = v
  }
  return {
    schema: 'chronicle-entity/1',
    qid: item.id,
    subject,
    label: displayLabels(item),
    labels: languageMap(item.labels, ['zh-hans', 'zh-hant', 'zh', 'en']),
    aliases,
    native_names: statements(item, 'P1559').map((s) => s.mainsnak.datavalue?.value).filter((v) => v?.text).map((v) => ({ text: v.text, language: v.language })),
    description: displayLabels(item, 'descriptions'),
    sitelinks: sitelinkCount(item),
    lock_rule: lockRule,
    alternatives,
    living,
    portrait_policy: living ? 'forbidden' : 'allowed',
    born,
    died,
    external_ids: externalIds,
  }
}

/**
 * Locks the topic (§6.1). With a qid, fetches it without searching. Otherwise searches zh then en
 * (limit 7 each), fetches all candidates in one wbgetentities call and applies decideLock().
 * A dominant lock prints `entity_locked_dominant <qid> (alternatives: …)` through `log` in `lang`.
 * @returns {Promise<{ entity: object, item: object, candidates: object[] }>}
 */
export async function lockEntity({ wikidata, topic, qid, subject, lang = 'en', log = () => {}, now = Date.now() }) {
  if (qid) {
    const { entities } = await wikidata.getEntities([qid])
    const item = entities[qid]
    if (!item || 'missing' in item) throw new ChronicleError('entity_not_found', undefined, { qid, candidates: [] })
    const s = subjectOf(item)
    if (s === 'unsupported') throw new ChronicleError('subject_undetermined', undefined, { qid, candidates: [summarize(item)] })
    if (subject && s !== subject) throw new ChronicleError('entity_subject_mismatch', undefined, { qid, subject, candidates: [summarize(item)] })
    return { entity: entityRecord(item, { lock_rule: 'qid', alternatives: [], now }), item, candidates: [summarize(item)] }
  }
  const ids = []
  for (const language of ['zh', 'en']) for (const id of await wikidata.search(topic, language)) if (!ids.includes(id)) ids.push(id)
  if (!ids.length) throw new ChronicleError('entity_not_found', undefined, { topic, candidates: [] })
  const { entities } = await wikidata.getEntities(ids)
  const items = ids.map((id) => entities[id]).filter(Boolean)
  let decision
  try {
    decision = decideLock(items, subject)
  } catch (e) {
    if (e instanceof ChronicleError) e.details = { topic, ...e.details }
    throw e
  }
  const { best, lock_rule: lockRule, rivals } = decision
  const alternatives = rivals.slice(0, MAX_ALTERNATIVES).map(summarize)
  if (lockRule === 'dominant') log(t(lang, 'warn.entity_locked_dominant', { qid: best.id, alternatives: alternatives.map((a) => a.qid).join(', ') }))
  return { entity: entityRecord(best, { lock_rule: lockRule, alternatives, now }), item: best, candidates: items.filter((it) => !isDisambiguation(it)).map(summarize) }
}
