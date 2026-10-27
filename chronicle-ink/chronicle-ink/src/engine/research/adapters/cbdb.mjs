// CBDB person JSON -> structured claims (design §6.3 item 1). Fetch URL = id_formatters.P497.fetch
// plus `&o=json`. BasicInfo.YearBirth / YearDeath are the Gregorian numbers of the person's lunar
// birth/death years (calendar lunar-chinese, year precision); YearsLived is the East Asian
// (nominal) age; IndexAddr is a place label without a QID. A response that does not have this shape
// produces no claims and the warning adapter_unparsed:cbdb.
import { normalizeDate } from '../../facts/normalize-date.mjs'
import { idFormatterUrls } from '../tiers.mjs'
import { claimId, findObject, jsonFragment, structuredClaim } from './common.mjs'

export const PUBLISHER = 'cbdb'

/** CBDB API URL (JSON) for a P497 identifier. */
export function cbdbFetchUrl(id) {
  const urls = idFormatterUrls('P497', id)
  return urls?.fetch ? `${urls.fetch}&o=json` : null
}

const positiveInt = (v) => {
  const n = typeof v === 'number' ? v : /^\s*\d+\s*$/.test(String(v ?? '')) ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * @param {{ source: { id: string, text: string }, entity: { qid: string, label: object }, known?: object }} input
 * @returns {{ claims: object[], warnings: string[] }}
 */
export function cbdbClaims({ source, entity, known }) {
  let json
  try {
    json = JSON.parse(source.text)
  } catch {
    return { claims: [], warnings: [`adapter_unparsed:${PUBLISHER}`] }
  }
  const info = findObject(json, 'BasicInfo')
  const at = source.text.indexOf('"BasicInfo"')
  if (!info || at < 0) return { claims: [], warnings: [`adapter_unparsed:${PUBLISHER}`] }
  const claims = []
  const add = (predicate, value, key) => {
    const frag = jsonFragment(source.text, key, at)
    if (!frag) return
    claims.push(structuredClaim({ id: claimId(source.id, claims.length + 1), predicate, value, excerpt: frag.fragment, source, entity, known }))
  }
  const birth = positiveInt(info.YearBirth)
  if (birth) add('born', normalizeDate(String(birth), { calendar: 'lunar-chinese' }), 'YearBirth')
  const death = positiveInt(info.YearDeath)
  if (death) add('died', normalizeDate(String(death), { calendar: 'lunar-chinese' }), 'YearDeath')
  const lived = positiveInt(info.YearsLived)
  if (lived) add('age_at_death', { years: lived, reckoning: 'east-asian' }, 'YearsLived')
  const addr = typeof info.IndexAddr === 'string' ? info.IndexAddr.trim() : ''
  if (addr) {
    const value = { label: { 'zh-CN': addr } }
    const qid = known?.resolve(value)
    add('birthplace', qid ? { ...value, qid } : value, 'IndexAddr')
  }
  return { claims, warnings: [] }
}
