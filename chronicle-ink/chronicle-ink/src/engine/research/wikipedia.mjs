// Wikipedia REST client (design §6.2): page summary and page HTML converted to plain text. zh pages
// are requested with `Accept-Language: zh-hans` so excerpts match the simplified variant; the source
// record stores `variant: "zh-hans"`. Like the Wikidata API, the documented REST API skips the
// robots check (Wikimedia's robots.txt disallows /api/ for crawlers).

/** Title -> REST path segment (spaces become underscores). */
const titleSegment = (title) => encodeURIComponent(String(title).trim().replace(/ /g, '_'))

export const summaryUrl = (lang, title) => `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${titleSegment(title)}`
export const htmlUrl = (lang, title) => `https://${lang}.wikipedia.org/api/rest_v1/page/html/${titleSegment(title)}`

/** Request options per wiki language: zh asks for the simplified variant. */
export const variantFor = (lang) => (lang === 'zh' ? 'zh-hans' : null)

const ENTITIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' })

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/**
 * Parsoid HTML -> plain text: drops head, scripts, styles, reference markers and the references list;
 * block elements become line breaks; whitespace is collapsed per line.
 */
export function htmlToText(html) {
  let s = String(html ?? '')
  s = s.replace(/<head[\s\S]*?<\/head>/gi, ' ')
  s = s.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<sup\b[^>]*class="[^"]*\breference\b[^"]*"[\s\S]*?<\/sup>/gi, '')
  s = s.replace(/<(ol|div)\b[^>]*class="[^"]*\breferences\b[^"]*"[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/?(p|div|section|h[1-6]|li|ul|ol|table|tr|blockquote|dd|dt|dl|figure|figcaption)\b[^>]*>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s.split('\n').map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n')
}

/** Sitelink titles of an entity: { zh?, en?, ...<lang> } from `<lang>wiki` sitelinks. */
export function sitelinkTitles(item) {
  const out = {}
  for (const [site, link] of Object.entries(item?.sitelinks ?? {})) {
    const m = site.match(/^([a-z][a-z-]*)wiki$/)
    if (m && link?.title && !['commons', 'species', 'meta', 'wikidata'].includes(m[1])) out[m[1].replace(/_/g, '-')] = link.title
  }
  return out
}

/**
 * Fetches one article as plain text.
 * @returns {Promise<{ ok: true, lang: string, url: string, final_url: string, text: string, variant?: string, tier, publisher }|{ ok: false, warning: string }>}
 */
export async function fetchArticle({ fetcher, lang, title }) {
  const variant = variantFor(lang)
  const url = htmlUrl(lang, title)
  const res = await fetcher.get(url, { robots: false, accept: 'text/html', ...(variant ? { acceptLanguage: variant } : {}) })
  if (!res.ok) return res
  return { ok: true, lang, url, final_url: res.final_url, text: htmlToText(res.text), tier: res.tier, publisher: res.publisher, ...(variant ? { variant } : {}) }
}

/** Fetches the REST summary (`extract` field) of an article. */
export async function fetchSummary({ fetcher, lang, title }) {
  const variant = variantFor(lang)
  const res = await fetcher.get(summaryUrl(lang, title), { robots: false, accept: 'application/json', ...(variant ? { acceptLanguage: variant } : {}) })
  if (!res.ok) return res
  try {
    const json = JSON.parse(res.text)
    return { ok: true, lang, url: summaryUrl(lang, title), final_url: res.final_url, text: String(json.extract ?? ''), ...(variant ? { variant } : {}) }
  } catch {
    return { ok: false, code: 'fetch_invalid_json', warning: `fetch_invalid_json:${lang}.wikipedia.org` }
  }
}
