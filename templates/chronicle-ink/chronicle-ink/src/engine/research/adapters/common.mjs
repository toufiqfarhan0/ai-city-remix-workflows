// Shared helpers for structured claims (Wikidata statements and tier-1 JSON adapters).
// Excerpts are cut verbatim from the raw response text, never re-serialized, so the generic excerpt
// check (facts/extract.mjs) applies to them unchanged.
import { structuredText } from '../../facts/predicates.mjs'

const JSON_VALUE = String.raw`("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)`
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * First `"<key>": <value>` fragment in `text` at or after `from`, exactly as written.
 * @returns {{ fragment: string, value: string, index: number }|null} `value` is the raw JSON value text
 */
export function jsonFragment(text, key, from = 0) {
  const re = new RegExp(`"${escapeRe(key)}"\\s*:\\s*${JSON_VALUE}`, 'g')
  re.lastIndex = from
  const m = re.exec(text)
  return m ? { fragment: m[0], value: m[1], index: m.index } : null
}

/** Searches a parsed JSON value depth-first for the first object stored under `key`. */
export function findObject(node, key, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return null
  if (!Array.isArray(node) && node[key] && typeof node[key] === 'object' && !Array.isArray(node[key])) return node[key]
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = findObject(v, key, depth + 1)
    if (hit) return hit
  }
  return null
}

/** Claim id: `<source_id>.<nnn>` (three-digit sequence within the source). */
export const claimId = (sourceId, n) => `${sourceId}.${String(n).padStart(3, '0')}`

/**
 * A structured claim with deterministic bilingual text from the predicate template.
 * @param {{ id: string, predicate: string, value: object, excerpt: string, source: { id: string }, entity: { qid: string, label: object }, known?: object, flags?: string[] }} input
 */
export function structuredClaim({ id, predicate, value, excerpt, source, entity, known, flags = [] }) {
  const { text, flags: textFlags } = structuredText({ predicate, value, subjectLabel: entity.label, known })
  return {
    id,
    predicate,
    subject_qid: entity.qid,
    value,
    scope: null,
    text,
    excerpt,
    source_id: source.id,
    origin: 'structured',
    flags: [...new Set([...flags, ...textFlags])].sort(),
  }
}
