// GBIF species JSON (api.gbif.org/v1/species/<id>) -> structured claims (design §6.3 item 1):
// `rank` -> taxon_rank (enum, lower-cased), `scientificName` -> scientific_name (text, never
// clustered). Anything else produces no claims and the warning adapter_unparsed:gbif.
import { PREDICATES } from '../../facts/predicates.mjs'
import { idFormatterUrls } from '../tiers.mjs'
import { claimId, jsonFragment, structuredClaim } from './common.mjs'

export const PUBLISHER = 'gbif'

/** GBIF API URL for a P846 identifier. */
export const gbifFetchUrl = (id) => idFormatterUrls('P846', id)?.fetch ?? null

/**
 * @param {{ source: { id: string, text: string }, entity: { qid: string, label: object }, known?: object }} input
 * @returns {{ claims: object[], warnings: string[] }}
 */
export function gbifClaims({ source, entity, known }) {
  let json
  try {
    json = JSON.parse(source.text)
  } catch {
    return { claims: [], warnings: [`adapter_unparsed:${PUBLISHER}`] }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || (typeof json.rank !== 'string' && typeof json.scientificName !== 'string')) {
    return { claims: [], warnings: [`adapter_unparsed:${PUBLISHER}`] }
  }
  const claims = []
  const add = (predicate, value, key) => {
    const frag = jsonFragment(source.text, key)
    if (!frag) return
    claims.push(structuredClaim({ id: claimId(source.id, claims.length + 1), predicate, value, excerpt: frag.fragment, source, entity, known }))
  }
  const rank = typeof json.rank === 'string' ? json.rank.toLowerCase() : null
  if (rank && PREDICATES.taxon_rank.values.includes(rank)) add('taxon_rank', rank, 'rank')
  if (typeof json.scientificName === 'string' && json.scientificName.trim()) add('scientific_name', { text: json.scientificName.trim() }, 'scientificName')
  return { claims, warnings: [] }
}
