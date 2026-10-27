// Fact sheet assembly (design §6.5): work/facts/facts.json, later copied into report.json.facts.
// Follows the research report's fact-sheet shape (entity, claims with sources, disputed,
// visual_checks, human_review) plus the cross-check fields. Pure and deterministic: no clock.
import { PREDICATES } from './predicates.mjs'

export const FACTS_SCHEMA = 'chronicle-facts/1'

/**
 * @param {object} input
 * @param {object} input.entity         entity.json record (research/entity.mjs)
 * @param {object} input.check          crosscheck() result
 * @param {Record<string, object>} input.sourcesById
 * @param {{ value_invalid?: number, subject_mismatch?: number, excerpt_not_found?: number }} [input.counts]
 * @param {object[]} [input.hints]
 * @param {string[]} [input.warnings]
 */
export function buildFactSheet({ entity, check, sourcesById, counts = {}, hints = [], warnings = [] }) {
  const claims = check.claims.map((c) => {
    const src = sourcesById[c.source_id] ?? {}
    return {
      id: c.id,
      predicate: c.predicate,
      ...(c.predicate_raw != null ? { predicate_raw: c.predicate_raw } : {}),
      type: PREDICATES[c.predicate]?.type ?? 'text',
      status: c.status,
      instance: c.instance,
      cluster: c.cluster,
      value: c.value,
      scope: c.scope ?? null,
      flags: [...(c.flags ?? [])].sort(),
      text: c.text,
      origin: c.origin,
      sources: [{ id: c.source_id, url: src.final_url ?? src.url ?? null, tier: src.tier ?? 'lead', publisher: src.publisher ?? null, lang: src.lang ?? null, excerpt: c.excerpt, retrieved_at: src.retrieved_at ?? null }],
      lines: [],
    }
  })
  return {
    schema: FACTS_SCHEMA,
    entity: {
      qid: entity.qid,
      label: entity.label,
      subject: entity.subject,
      lock_rule: entity.lock_rule,
      alternatives: entity.alternatives ?? [],
      living: !!entity.living,
      portrait_policy: entity.portrait_policy ?? (entity.living ? 'forbidden' : 'allowed'),
    },
    claims,
    hints,
    disputed: check.disputed,
    value_invalid_count: counts.value_invalid ?? 0,
    subject_mismatch_count: counts.subject_mismatch ?? 0,
    rejected_count: check.rejected_count,
    excerpt_not_found_count: counts.excerpt_not_found ?? 0,
    visual_checks: [],
    human_review: { facts: false, visuals: false, listening: false },
    warnings: [...new Set(warnings)].sort(),
  }
}
