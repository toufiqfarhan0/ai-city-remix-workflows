// Source tiers and publishers (design §6.2). The tier of a URL is decided only by
// engine/data/sources-allowlist.json; users and Agents cannot set it.
//
// Matching: a `host` rule matches the host name exactly or as a sub-domain suffix (`www.` is the same
// host); a `suffix` rule matches as a suffix only. No wildcards. Everything else is `lead`.
import { readFileSync } from 'node:fs'

export const ALLOWLIST = Object.freeze(JSON.parse(readFileSync(new URL('../data/sources-allowlist.json', import.meta.url), 'utf8')))

/** Reason recorded for hosts on the `lead_explicit` list (the tier is the same as any unlisted host). */
const LEAD_REASONS = Object.freeze({
  'weibo.com': 'social_media',
  'x.com': 'social_media',
  'twitter.com': 'social_media',
  'reddit.com': 'social_media',
  'douyin.com': 'social_media',
  'xiaohongshu.com': 'social_media',
  'zhihu.com': 'qa_site',
  'quora.com': 'qa_site',
  'baike.baidu.com': 'encyclopedia_aggregator',
})

/** Tier 3 sources only support claims dated within this many years before the retrieval year. */
export const TIER3_RECENT_YEARS = 30

/** Lower-case host without a trailing dot and without one leading `www.`. */
export function normalizeHost(host) {
  let h = String(host ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  if (h.startsWith('www.')) h = h.slice(4)
  return h
}

const hostMatches = (host, ruleHost) => {
  const r = normalizeHost(ruleHost)
  return host === r || host.endsWith(`.${r}`)
}

function ruleMatches(host, rule) {
  if (rule.host) return hostMatches(host, rule.host)
  if (rule.suffix) return host.endsWith(String(rule.suffix).toLowerCase())
  return false
}

/**
 * Tier and publisher of a URL or host name.
 * @returns {{ host: string, tier: 1|2|3|'lead', publisher: string|null, reason?: string }}
 *   `reason` is set for lead sources: a lead_explicit category or `not_allowlisted`.
 */
export function classifyUrl(url, allowlist = ALLOWLIST) {
  let host
  try {
    host = normalizeHost(new URL(String(url)).hostname)
  } catch {
    host = normalizeHost(url)
  }
  for (const [key, tier] of [['tier1', 1], ['tier2', 2], ['tier3', 3]]) {
    const rule = (allowlist[key] ?? []).find((r) => ruleMatches(host, r))
    if (rule) return { host, tier, publisher: rule.publisher }
  }
  const explicit = (allowlist.lead_explicit ?? []).find((h) => hostMatches(host, h))
  if (explicit) return { host, tier: 'lead', publisher: null, reason: LEAD_REASONS[normalizeHost(explicit)] ?? 'lead_explicit' }
  return { host, tier: 'lead', publisher: null, reason: 'not_allowlisted' }
}

/** Sort rank of a tier: 1, 2, 3, then lead (4). */
export const tierRank = (tier) => (tier === 1 || tier === 2 || tier === 3 ? tier : 4)

/**
 * The year of a claim for the tier-3 recency rule: a `date` value, or the `date` of an `event`
 * value; ranges use the earlier end. Undated claims return null.
 */
export function claimYear(type, value) {
  const d = type === 'date' ? value : type === 'event' ? value?.date : null
  if (!d || typeof d !== 'object') return null
  if (Array.isArray(d.range) && Number.isInteger(d.range[0])) return d.range[0]
  return Number.isInteger(d.y) ? d.y : null
}

/** Calendar year of an ISO timestamp (UTC). */
export const retrievedYear = (retrievedAt) => {
  const y = Number(String(retrievedAt ?? '').slice(0, 4))
  return Number.isInteger(y) && y > 0 ? y : null
}

/**
 * Whether a claim from a source counts as qualifying evidence: tier 1 and 2 always; tier 3 only for a
 * dated claim whose year is ≥ the source's retrieval year − 30; lead never.
 */
export function isQualifying({ tier, retrieved_at: retrievedAt }, type, value) {
  if (tier === 1 || tier === 2) return true
  if (tier !== 3) return false
  const year = claimYear(type, value)
  const ry = retrievedYear(retrievedAt)
  return year != null && ry != null && year >= ry - TIER3_RECENT_YEARS
}

/**
 * URLs for a Wikidata external identifier from `id_formatters` (formatter URLs read from P1630).
 * @returns {{ fetch: string|null, link: string }|null}
 */
export function idFormatterUrls(property, id, allowlist = ALLOWLIST) {
  const f = allowlist.id_formatters?.[property]
  if (!f || id == null || id === '') return null
  const enc = encodeURIComponent(String(id)).replace(/%2F/gi, '/')
  return { fetch: f.fetch ? f.fetch.replace('$1', enc) : null, link: f.link.replace('$1', enc) }
}
