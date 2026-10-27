// Label normalization and the known-entity table (design §6.3 item 3, §6.4 "标签等价").
//
// Normalization: NFKC, drop whitespace and punctuation, lower-case Latin letters, drop the English
// article "the". normalizeWithMap() also returns, for every output character, the index of the
// original character it came from, so later steps (script-gate masking) can map matches back.
//
// The known-entity table holds the multilingual labels and aliases (zh-hans, zh-hant, zh, en) of the
// items the locked entity's statements refer to. Traditional/simplified unification relies only on
// this table; there is no general conversion.

export const KNOWN_LANGS = Object.freeze(['zh-hans', 'zh-hant', 'zh', 'en'])
const DROP = /[\p{P}\p{Z}\s]/u

/** Ranges [start, end) of standalone English articles "the" in the original text. */
function articleRanges(text) {
  const out = []
  for (const m of text.matchAll(/(^|[^\p{L}\p{N}])(the)(?=$|[^\p{L}\p{N}])/giu)) {
    const start = m.index + m[1].length
    out.push([start, start + 3])
  }
  return out
}

/**
 * @param {string} text
 * @returns {{ text: string, map: number[] }} normalized text and, per output UTF-16 unit, the index
 *   of the source character in `text`
 */
export function normalizeWithMap(text) {
  const s = String(text ?? '')
  const skip = articleRanges(s)
  let out = ''
  const map = []
  let i = 0
  for (const ch of s) {
    const at = i
    i += ch.length
    if (skip.some(([a, b]) => at >= a && at < b)) continue
    for (const n of ch.normalize('NFKC')) {
      if (DROP.test(n)) continue
      const c = /[A-Z]/.test(n) ? n.toLowerCase() : n
      out += c
      for (let k = 0; k < c.length; k++) map.push(at)
    }
  }
  return { text: out, map }
}

/** Normalized label string. */
export const normalizeLabel = (text) => normalizeWithMap(text).text

/**
 * Builds the known-entities.json document from wbgetentities items (props labels|aliases).
 * @param {Record<string, object>} items  QID -> Wikidata entity
 */
export function buildKnownEntities(items) {
  const entities = {}
  for (const qid of Object.keys(items ?? {}).sort()) {
    const item = items[qid]
    if (!item || 'missing' in item) continue
    const labels = {}
    const aliases = {}
    for (const lang of KNOWN_LANGS) {
      if (item.labels?.[lang]?.value) labels[lang] = item.labels[lang].value
      const list = (item.aliases?.[lang] ?? []).map((a) => a.value).filter(Boolean)
      if (list.length) aliases[lang] = list
    }
    entities[qid] = { labels, aliases }
  }
  return { schema: 'chronicle-known-entities/1', entities }
}

/**
 * Loads a known-entity table. A missing document gives an empty table and the warning
 * `known_entities_missing`.
 * @param {object|null|undefined} doc parsed known-entities.json
 * @returns {{ entities: object, warnings: string[], names(qid): Set<string>, display(qid): object|null, resolve(label): string|null }}
 */
export function loadKnownEntities(doc) {
  const warnings = []
  let entities = {}
  if (!doc || typeof doc !== 'object' || !doc.entities || typeof doc.entities !== 'object') warnings.push('known_entities_missing')
  else entities = doc.entities
  const byQid = new Map()
  const index = new Map()
  for (const qid of Object.keys(entities).sort()) {
    const e = entities[qid] ?? {}
    const names = new Set()
    for (const v of Object.values(e.labels ?? {})) if (v) names.add(normalizeLabel(v))
    for (const list of Object.values(e.aliases ?? {})) for (const v of list ?? []) if (v) names.add(normalizeLabel(v))
    names.delete('')
    byQid.set(qid, names)
    for (const n of names) {
      if (!index.has(n)) index.set(n, new Set())
      index.get(n).add(qid)
    }
  }
  return {
    entities,
    warnings,
    /** Normalized labels and aliases of a QID (empty set when unknown). */
    names: (qid) => byQid.get(qid) ?? new Set(),
    /** { en, zh-CN } display labels: zh-CN prefers zh-hans, then zh, then zh-hant. */
    display(qid) {
      const l = entities[qid]?.labels
      if (!l) return null
      return { en: l.en ?? null, 'zh-CN': l['zh-hans'] ?? l.zh ?? l['zh-hant'] ?? null }
    },
    /** QID whose labels or aliases equal one of the label's normalized texts, when exactly one item matches. */
    resolve(label) {
      const hits = new Set()
      for (const text of labelTexts(label)) for (const q of index.get(text) ?? []) hits.add(q)
      return hits.size === 1 ? [...hits][0] : null
    },
  }
}

/** Normalized texts of a label value { label: { en?, zh-CN? } } (or a plain string). */
export function labelTexts(value) {
  const raw = typeof value === 'string' ? [value] : Object.values(value?.label ?? value ?? {}).filter((v) => typeof v === 'string')
  return [...new Set(raw.map(normalizeLabel).filter(Boolean))]
}

/**
 * Label equivalence (design §6.4): both with qid -> equal qids; otherwise any normalized label of one
 * equals any normalized label of the other, or any label/alias of the other's qid in the known table.
 */
export function labelsEquivalent(a, b, known) {
  if (!a || !b) return false
  if (a.qid && b.qid) return a.qid === b.qid
  const na = new Set(labelTexts(a))
  const nb = new Set(labelTexts(b))
  if (a.qid && known) for (const n of known.names(a.qid)) na.add(n)
  if (b.qid && known) for (const n of known.names(b.qid)) nb.add(n)
  for (const n of na) if (nb.has(n)) return true
  return false
}
