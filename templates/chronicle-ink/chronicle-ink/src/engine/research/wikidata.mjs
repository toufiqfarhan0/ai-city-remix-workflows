// Wikidata client (design §6.1, §6.3 item 3) over the public-read fetcher. Dates are only ever read
// from wbgetentities JSON (time + precision + calendarmodel), never from SPARQL/RDF.
//
// Wikidata is the backbone of the research stage: a failed request is retried twice (1 s, then 3 s)
// and then raises research_failed (exit 5). Wikimedia's robots.txt is aimed at crawlers and disallows
// /w/; the documented action API is used as an API (identified by the policy User-Agent), so these
// requests skip the robots check.
import { ChronicleError } from '../errors.mjs'

export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
export const SEARCH_LIMIT = 7
export const ENTITY_BATCH = 50
export const RETRY_DELAYS_MS = Object.freeze([1000, 3000])
export const ENTITY_PROPS = 'claims|sitelinks|labels|descriptions|aliases'
export const KNOWN_LANGUAGES = 'zh-hans|zh-hant|zh|en'

/** Properties whose item values form the known-entity table (deduplicated, ≤ 200 items). */
export const KNOWN_ENTITY_PROPS = Object.freeze(['P19', 'P20', 'P119', 'P131', 'P84', 'P39', 'P69', 'P26', 'P22', 'P25', 'P40', 'P800', 'P171', 'P138', 'P186', 'P3373', 'P17', 'P276', 'P27', 'P106', 'P1344', 'P793'])
export const KNOWN_ENTITY_MAX = 200

const qs = (params) => Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

/**
 * @param {{ fetcher: { get: Function }, sleep?: (ms: number) => Promise<void>, onRetry?: (info: object) => void }} deps
 */
export function createWikidata({ fetcher, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRetry } = {}) {
  async function getJson(params) {
    const url = `${WIKIDATA_API}?${qs({ ...params, format: 'json', utf8: 1 })}`
    let last
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        onRetry?.({ attempt, code: last?.code ?? 'invalid_json' })
        await sleep(RETRY_DELAYS_MS[attempt - 1])
      }
      const res = await fetcher.get(url, { robots: false, accept: 'application/json', quiet: true })
      if (res.ok) {
        try {
          const json = JSON.parse(res.text)
          if (!json.error) return { json, text: res.text, url, final_url: res.final_url }
          last = { code: `api_error:${json.error.code ?? 'unknown'}` }
        } catch {
          last = { code: 'invalid_json' }
        }
      } else last = res
    }
    throw new ChronicleError('research_failed', undefined, { url, reason: last?.warning ?? last?.code ?? 'unknown' })
  }

  return {
    /** wbsearchentities in one language; returns the result ids in order. */
    async search(text, language) {
      const { json } = await getJson({ action: 'wbsearchentities', search: text, language, uselang: language, type: 'item', limit: SEARCH_LIMIT })
      return (json.search ?? []).map((r) => r.id).filter((id) => /^Q[1-9]\d*$/.test(id))
    },
    /**
     * wbgetentities in batches of ≤ 50 ids.
     * @returns {Promise<{ entities: Record<string, object>, responses: { url: string, text: string }[] }>}
     */
    async getEntities(ids, { props = ENTITY_PROPS, languages } = {}) {
      const entities = {}
      const responses = []
      const list = [...new Set(ids)]
      for (let i = 0; i < list.length; i += ENTITY_BATCH) {
        const params = { action: 'wbgetentities', ids: list.slice(i, i + ENTITY_BATCH).join('|'), props }
        if (languages) params.languages = languages
        const { json, text, url, final_url: finalUrl } = await getJson(params)
        Object.assign(entities, json.entities ?? {})
        responses.push({ url, final_url: finalUrl, text })
      }
      return { entities, responses }
    },
  }
}

/** Value statements of a property, in JSON order (deprecated statements and no-value snaks dropped). */
export function statements(item, prop) {
  return (item?.claims?.[prop] ?? []).filter((s) => s.rank !== 'deprecated' && s.mainsnak?.snaktype === 'value')
}

/** Item ids referenced by a property's statements. */
export const itemValues = (item, prop) => statements(item, prop).map((s) => s.mainsnak.datavalue?.value?.id).filter(Boolean)

/** First best-rank statement of a property (preferred rank wins over normal). */
export function bestStatement(item, prop) {
  const list = statements(item, prop)
  return list.find((s) => s.rank === 'preferred') ?? list[0] ?? null
}

/** QIDs the locked entity refers to through KNOWN_ENTITY_PROPS (sorted, ≤ 200). */
export function referencedQids(item) {
  const set = new Set()
  for (const prop of KNOWN_ENTITY_PROPS) for (const id of itemValues(item, prop)) if (/^Q[1-9]\d*$/.test(id)) set.add(id)
  return [...set].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).slice(0, KNOWN_ENTITY_MAX)
}

/** Fetches labels and aliases of the referenced items (props labels|aliases, zh-hans|zh-hant|zh|en). */
export async function fetchKnownEntityItems(wikidata, item) {
  const ids = referencedQids(item)
  if (!ids.length) return {}
  const { entities } = await wikidata.getEntities(ids, { props: 'labels|aliases', languages: KNOWN_LANGUAGES })
  return entities
}
