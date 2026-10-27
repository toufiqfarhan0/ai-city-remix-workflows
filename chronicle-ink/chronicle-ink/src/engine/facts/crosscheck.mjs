// Deterministic cross-check (design §6.4). Corroboration only happens inside clusters: claims from
// different publishers that land in the same cluster support each other.
//
// Order: every predicate except age_at_death first (born/died included), then age_at_death, whose
// equivalence depends on the born/died outcome.
//   group    (subject_qid, predicate, scope_key); scope_key = superlative dimension, else null
//   instance card 'many' splits a group by its key (object/place label closure, date ±2 years closure);
//            claims without the key are isolated (`unkeyed`, at most single-source)
//   cluster  value equivalence by type, each member compared with the cluster's first member;
//            members sorted tier → publisher → source_id → claim id, so input order never matters
//   status   verified / disputed / single-source / rejected per instance, written to every claim
import { isQualifying, tierRank } from '../research/tiers.mjs'
import { ageConsistent } from './age.mjs'
import { excerptFound } from './extract.mjs'
import { labelsEquivalent, normalizeLabel } from './labels.mjs'
import { compareDates, datesNear } from './normalize-date.mjs'
import { countsEqual, numbersEqual } from './normalize-number.mjs'
import { PREDICATES } from './predicates.mjs'

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Normalized quote text: NFKC, punctuation and whitespace removed, Latin lower-cased. */
export const normalizeQuote = (text) => normalizeLabel(text)

/** Event equivalence: compare only the fields both sides have; no comparable field -> not equivalent. */
function eventEquivalent(a, b, known) {
  let compared = 0
  const flags = []
  for (const k of ['object', 'place']) {
    if (a[k] && b[k]) {
      compared++
      if (!labelsEquivalent(a[k], b[k], known)) return { equal: false, flags: [] }
    }
  }
  if (a.date && b.date) {
    compared++
    const r = compareDates(a.date, b.date)
    if (!r.equal) return { equal: false, flags: [] }
    flags.push(...r.flags)
  }
  return { equal: compared > 0, flags }
}

/** Value equivalence by predicate type. @returns {{ equal: boolean, flags: string[] }} */
export function valuesEquivalent(type, a, b, known) {
  switch (type) {
    case 'date':
      return compareDates(a, b)
    case 'number':
      return { equal: numbersEqual(a, b), flags: [] }
    case 'count':
      return { equal: countsEqual(a, b), flags: [] }
    case 'enum':
      return { equal: a === b, flags: [] }
    case 'label':
      return { equal: labelsEquivalent(a, b, known), flags: [] }
    case 'event':
      return eventEquivalent(a, b, known)
    case 'quote':
      return { equal: normalizeQuote(a.text) !== '' && normalizeQuote(a.text) === normalizeQuote(b.text), flags: [] }
    case 'superlative':
      return { equal: !!a.category && !!b.category && labelsEquivalent(a.category, b.category, known), flags: [] }
    case 'age':
      return { equal: a.years === b.years && a.reckoning === b.reckoning, flags: [] }
    default:
      return { equal: false, flags: [] } // text / other: never clustered
  }
}

/** Union-find closure of `items` under `related(a, b)`; groups keep the input order. */
function closure(items, related) {
  const parent = items.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (find(i) !== find(j) && related(items[i], items[j])) parent[find(j)] = find(i)
  const groups = new Map()
  items.forEach((it, i) => {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(it)
  })
  return [...groups.values()]
}

/** Instance key value of a claim for a 'many' predicate (labels are their own object key). */
function keyValue(def, value) {
  if (def.type === 'label') return value
  return value?.[def.key] ?? null
}

const superlativeComplete = (v) => !!(v && v.dimension && v.category && Number.isInteger(v.as_of))

/**
 * Status of one instance from its clusters (design §6.4 "状态判定").
 * @returns {{ status: string, best: object|null, qualifying: object[], minorityConflict: boolean }}
 */
function instanceStatus(clusters) {
  const q = clusters.filter((c) => c.publishers.size > 0)
  if (!q.length) return { status: 'rejected', best: null, qualifying: q, minorityConflict: false }
  const best = [...q].sort((a, b) => b.publishers.size - a.publishers.size || b.tier1.size - a.tier1.size || cmp(a.minId, b.minId))[0]
  const others = q.filter((c) => c !== best)
  if (!others.length) return { status: best.publishers.size >= 2 && best.tier1.size >= 1 ? 'verified' : 'single-source', best, qualifying: q, minorityConflict: false }
  if (others.every((o) => o.tier1.size === 0) && best.tier1.size >= 2) return { status: 'verified', best, qualifying: q, minorityConflict: true }
  return { status: 'disputed', best, qualifying: q, minorityConflict: false }
}

/**
 * Cross-checks claims.
 * @param {{ entity: { qid: string }, claims: object[], sourcesById: Record<string, object>, known?: object }} input
 *   claims have already passed facts/extract.mjs (subject, vocabulary, value, excerpt)
 * @returns {{ claims: object[], instances: object[], disputed: object[], rejected_count: number }}
 */
export function crosscheck({ entity, claims, sourcesById, known }) {
  const entries = claims.map((c) => ({ c, src: sourcesById[c.source_id] ?? { tier: 'lead', publisher: null }, flags: new Set(c.flags ?? []) }))
  entries.sort((a, b) => tierRank(a.src.tier) - tierRank(b.src.tier) || cmp(a.src.publisher ?? '~', b.src.publisher ?? '~') || cmp(a.c.source_id, b.c.source_id) || cmp(a.c.id, b.c.id))
  const result = new Map()
  const instances = []
  const counters = new Map()
  const nextInstanceId = (predicate, scopeKey) => {
    const base = scopeKey ? `${predicate}:${scopeKey}` : predicate
    const n = (counters.get(base) ?? 0) + 1
    counters.set(base, n)
    return `${base}#${n}`
  }

  const makeCluster = (id, members, type) => {
    const qualifying = members.filter((m) => isQualifying(m.src, type, m.c.value))
    return {
      id,
      members,
      publishers: new Set(qualifying.map((m) => m.src.publisher).filter(Boolean)),
      tier1: new Set(qualifying.filter((m) => m.src.tier === 1).map((m) => m.src.publisher).filter(Boolean)),
      minId: members.map((m) => m.c.id).sort()[0],
    }
  }

  /** Clusters members of one instance and applies the status rules. */
  function settle(instanceId, predicate, scopeKey, members, { unkeyed = false, preClusters = null } = {}) {
    const def = PREDICATES[predicate]
    const type = def.type
    let groups = preClusters
    if (!groups) {
      groups = []
      for (const m of members) {
        let placed = false
        if (type !== 'text') {
          for (const g of groups) {
            const r = valuesEquivalent(type, g[0].c.value, m.c.value, known)
            if (r.equal) {
              g.push(m)
              for (const f of r.flags) m.flags.add(f)
              placed = true
              break
            }
          }
        }
        if (!placed) groups.push([m])
      }
    }
    const clusters = groups.map((g, k) => makeCluster(`${instanceId}/c${k + 1}`, g, type))
    let { status, best, qualifying, minorityConflict } = instanceStatus(clusters)
    if ((unkeyed || type === 'text') && status === 'verified') {
      status = 'single-source'
      minorityConflict = false
    }
    if (type === 'quote') {
      const ok = status === 'verified' && best.members.some((m) => m.src.tier === 1 && excerptFound(m.c.value.text, m.src.text ?? ''))
      if (!ok) status = 'rejected'
    }
    for (const cl of clusters) {
      for (const m of cl.members) {
        if (unkeyed) m.flags.add('unkeyed')
        let s
        if (status === 'rejected') s = 'rejected'
        else if (status === 'disputed') s = qualifying.includes(cl) ? 'disputed' : 'rejected'
        else s = cl === best ? status : 'rejected'
        if (status === 'verified' && cl !== best) m.flags.add('minority')
        if (status === 'verified' && cl === best && minorityConflict) m.flags.add('minority_conflict')
        result.set(m.c.id, { status: s, instance: instanceId, cluster: cl.id, flags: m.flags })
      }
    }
    const inst = { id: instanceId, predicate, scope_key: scopeKey, status, unkeyed, clusters }
    instances.push(inst)
    return inst
  }

  // Groups (subject_qid, predicate, scope_key) in a fixed key order.
  const groups = new Map()
  for (const e of entries) {
    if (e.c.predicate === 'age_at_death') continue
    const scopeKey = e.c.predicate === 'superlative' ? e.c.value?.dimension ?? null : null
    const key = `${e.c.subject_qid}\u0000${e.c.predicate}\u0000${scopeKey ?? ''}`
    if (!groups.has(key)) groups.set(key, { predicate: e.c.predicate, scopeKey, members: [] })
    groups.get(key).members.push(e)
  }
  for (const key of [...groups.keys()].sort()) {
    const { predicate, scopeKey, members } = groups.get(key)
    const def = PREDICATES[predicate]
    if (def.type === 'text') {
      for (const m of members) settle(nextInstanceId(predicate, scopeKey), predicate, scopeKey, [m])
      continue
    }
    if (def.type === 'superlative') {
      const complete = members.filter((m) => superlativeComplete(m.c.value))
      for (const m of members.filter((x) => !complete.includes(x))) {
        const id = nextInstanceId(predicate, scopeKey)
        result.set(m.c.id, { status: 'rejected', instance: id, cluster: null, flags: m.flags })
        instances.push({ id, predicate, scope_key: scopeKey, status: 'rejected', unkeyed: false, clusters: [], reason: 'superlative_incomplete' })
      }
      for (const inst of closure(complete, (a, b) => labelsEquivalent(a.c.value.category, b.c.value.category, known))) settle(nextInstanceId(predicate, scopeKey), predicate, scopeKey, inst)
      continue
    }
    if (def.card === 'one') {
      settle(nextInstanceId(predicate, scopeKey), predicate, scopeKey, members)
      continue
    }
    if (def.type === 'quote') {
      for (const inst of closure(members, (a, b) => valuesEquivalent('quote', a.c.value, b.c.value, known).equal)) settle(nextInstanceId(predicate, scopeKey), predicate, scopeKey, inst)
      continue
    }
    const keyed = members.filter((m) => keyValue(def, m.c.value) != null)
    const related = def.key === 'date'
      ? (a, b) => datesNear(keyValue(def, a.c.value), keyValue(def, b.c.value))
      : (a, b) => labelsEquivalent(keyValue(def, a.c.value), keyValue(def, b.c.value), known)
    // Instances in the order of their first (sorted) member; unkeyed claims are isolated.
    const parts = [...closure(keyed, related).map((g) => ({ members: g, unkeyed: false })), ...members.filter((m) => !keyed.includes(m)).map((m) => ({ members: [m], unkeyed: true }))]
    parts.sort((a, b) => entries.indexOf(a.members[0]) - entries.indexOf(b.members[0]))
    for (const p of parts) settle(nextInstanceId(predicate, scopeKey), predicate, scopeKey, p.members, { unkeyed: p.unkeyed })
  }

  // age_at_death, after born and died are settled.
  const ages = entries.filter((e) => e.c.predicate === 'age_at_death')
  if (ages.length) {
    const live = (pred) => {
      const inst = instances.find((i) => i.predicate === pred)
      if (!inst || inst.status === 'rejected') return null
      return inst.clusters.filter((cl) => cl.members.some((m) => result.get(m.c.id).status !== 'rejected'))
    }
    const bornClusters = live('born')
    const diedClusters = live('died')
    const id = nextInstanceId('age_at_death', null)
    if (bornClusters?.length && diedClusters?.length) {
      const disputedDates = bornClusters.length > 1 || diedClusters.length > 1
      const consistent = []
      const inconsistent = []
      for (const a of ages) {
        let exact = false
        let east = false
        for (const bc of bornClusters) for (const dc of diedClusters) for (const b of bc.members) for (const d of dc.members) {
          const r = ageConsistent(a.c.value, b.c.value, d.c.value)
          if (r.ok && !r.flags.includes('east_asian_reckoning')) exact = true
          else if (r.ok) east = true
        }
        if (exact || east) {
          if (!exact) a.flags.add('east_asian_reckoning')
          if (disputedDates) a.flags.add('age_vs_disputed_dates')
          consistent.push(a)
        } else {
          a.flags.add('age_inconsistent')
          inconsistent.push(a)
        }
      }
      const inst = consistent.length ? settle(id, 'age_at_death', null, consistent, { preClusters: [consistent] }) : (() => {
        const empty = { id, predicate: 'age_at_death', scope_key: null, status: 'disputed', unkeyed: false, clusters: [] }
        instances.push(empty)
        return empty
      })()
      inst.inconsistent = inconsistent
      for (const a of inconsistent) {
        const qualifies = isQualifying(a.src, 'age', a.c.value)
        result.set(a.c.id, { status: qualifies ? 'disputed' : 'rejected', instance: id, cluster: null, flags: a.flags })
      }
    } else {
      settle(id, 'age_at_death', null, ages)
    }
  }

  const out = claims.map((c) => {
    const r = result.get(c.id)
    return { ...c, status: r.status, instance: r.instance, cluster: r.cluster, flags: [...r.flags].sort() }
  }).sort((a, b) => cmp(a.id, b.id))
  const byId = new Map(out.map((c) => [c.id, c]))

  const disputed = []
  for (const inst of [...instances].sort((a, b) => cmp(a.id, b.id))) {
    const sides = inst.clusters
      .filter((cl) => cl.members.some((m) => byId.get(m.c.id).status === 'disputed'))
      .map((cl) => side(cl.id, cl.members))
    for (const a of inst.inconsistent ?? []) if (byId.get(a.c.id).status === 'disputed') sides.push(side(null, [a]))
    if (sides.length) disputed.push({ instance: inst.id, predicate: inst.predicate, sides })
  }
  function side(cluster, members) {
    return {
      cluster,
      claims: members.map((m) => m.c.id).sort(),
      values: members.map((m) => m.c.value),
      sources: [...new Map(members.map((m) => [m.c.source_id, { id: m.c.source_id, publisher: m.src.publisher ?? null, tier: m.src.tier, url: m.src.url ?? null }])).values()].sort((a, b) => cmp(a.id, b.id)),
    }
  }

  const instanceList = [...instances].sort((a, b) => cmp(a.id, b.id)).map((i) => ({
    id: i.id,
    predicate: i.predicate,
    scope_key: i.scope_key,
    status: i.status,
    ...(i.unkeyed ? { unkeyed: true } : {}),
    clusters: i.clusters.map((cl) => ({ id: cl.id, claims: cl.members.map((m) => m.c.id).sort(), publishers: [...cl.publishers].sort(), tier1_publishers: [...cl.tier1].sort() })),
  }))
  return { claims: out, instances: instanceList, disputed, rejected_count: out.filter((c) => c.status === 'rejected').length }
}

