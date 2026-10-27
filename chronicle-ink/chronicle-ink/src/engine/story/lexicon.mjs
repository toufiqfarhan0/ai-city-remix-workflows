// Script-gate lexical rules (design §6.6a). Exported data (patterns and word lists) plus pure matchers.
//
// Fixed order per line (virtual lines included); every step masks what it matched with a same-length
// placeholder so later steps do not see it:
//   1  hedge markers: presence is checked first (hedge rules, §6.6), then masked
//   2  fixed expressions (idioms) that are neither numbers nor superlatives
//   3b bound-value spans: quote text / label labels + known-entity aliases / event object and place
//      labels of the claims bound to this line, matched on the ORIGINAL text (review nit N1, so a bound
//      quote containing an idiom such as 千古 still matches) via normalized substrings mapped back to
//      original offsets; strings shorter than 2 Han / 4 Latin letters do not take part
//   3  dates: the raw text of bound date claims first (era and lunar spellings), then the generic zh/en
//      patterns; generic hits fully inside a 3b span are ignored; afterwards the 3b spans are masked
//   4  numbers in the remaining text (Arabic always; Chinese numerals only before a measure word, a lone
//      一 is not a number; English number words, `one` only before a measure noun) with approximation
//      markers and the "years ago" form
//   5  superlatives in the remaining text
//   6  proper names (claim label values) on the original text; hits fully inside a 3b span are bound
import { ageSets } from '../facts/age.mjs'
import { labelTexts, normalizeLabel, normalizeWithMap } from '../facts/labels.mjs'
import { compareDates, normalizeDate, precisionRank } from '../facts/normalize-date.mjs'
import { normalizeNumber, parseChineseInteger } from '../facts/normalize-number.mjs'
import { PREDICATES } from '../facts/predicates.mjs'

const MASK = '\u0000'
const EPS = 1e-9
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const freeze = (o) => Object.freeze(o)

/** Step 1: hedge markers (masked after the hedge rules have looked at them). */
export const HEDGE = freeze({
  'zh-CN': freeze(['据记载', '据……记载', '相传', '一说', '据说']),
  en: freeze(['according to', 'records say', 'is said to', 'one account says', 'one account']),
})
const HEDGE_RE = freeze({
  'zh-CN': freeze([/据记载/gu, /据[^，。]{1,12}记载/gu, /相传/gu, /一说/gu, /据说/gu]),
  en: freeze([/\baccording to\b/giu, /\brecords say\b/giu, /\bis said to\b/giu, /\bone account says\b/giu, /\bone account\b/giu]),
})
/** Markers that satisfy `hedge: "attributed"` (single-source claims, §6.6 rule 2). */
export const ATTRIBUTION_MARKERS = freeze({
  'zh-CN': freeze([/据记载/u, /据[^，。]{1,12}记载/u, /相传/u]),
  en: freeze([/\baccording to\b/iu, /\brecords say\b/iu, /\bis said to\b/iu]),
})
/** Markers that satisfy `hedge: "one-account"` (disputed claims). */
export const DISPUTE_MARKERS = freeze({ 'zh-CN': freeze([/一说/u]), en: freeze([/\bone account\b/iu]) })

/** Step 2: fixed expressions. 唯一 and 第一 are deliberately absent (step 5 handles them). */
export const IDIOMS = freeze({
  'zh-CN': freeze(['一生', '一世', '一时', '一起', '一同', '一直', '一样', '一切', '一番', '一旦', '一度', '一举', '一路', '千古', '万古', '千秋', '万物', '万事', '三言两语', '千言万语', '一心一意', '十分', '万分']),
  en: freeze(['no one', 'one day', 'one another', 'at once', 'once again', 'at first', 'first of all', 'only then', 'not only', 'at least', 'at best', 'at worst', 'best known', 'best-known', 'most of', 'for the most part']),
})

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'
/** Step 3 generic date patterns, applied in this order. */
export const DATE_PATTERNS = freeze({
  'zh-CN': freeze([
    /(?:公元前|前)?\d{1,4}\s?年(?!\s?[前来间内])(?:\s?\d{1,2}\s?月(?:\s?\d{1,2}\s?日)?)?/gu,
    /\d{1,2}\s?月\s?\d{1,2}\s?日/gu,
    /[〇零一二三四五六七八九]{3,4}年/gu,
    /\d{1,2}世纪|[一二三四五六七八九十]{1,3}世纪/gu,
  ]),
  en: freeze([
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{1,4}\\b`, 'giu'),
    new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{1,4}\\b`, 'giu'),
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{3,4}\\b`, 'giu'),
    /\b\d{1,4}\s?(?:BCE|BC|AD|CE)\b/gu,
    /\b(?:AD|CE)\s?\d{1,4}\b/gu,
    /\b(?:in|by|from|until|since|around|circa)\s+\d{3,4}\b|\bc\.\s+\d{3,4}\b/giu,
    /\b\d{1,2}(?:st|nd|rd|th)[- ]century\b/giu,
  ]),
})

/** Step 4 measure words: a Chinese numeral counts only right before one of these. */
export const MEASURE_ZH = freeze(['年', '岁', '个', '位', '座', '只', '头', '条', '首', '篇', '卷', '部', '本', '名', '人', '代', '次', '回', '天', '日', '月', '世纪', '米', '公里', '千米', '里', '丈', '尺', '吨', '公斤', '千克', '斤', '孔', '拱', '层', '级', '处', '万', '亿', '余', '多'])
/** `one` counts only right before one of these nouns. */
export const MEASURE_EN = freeze(['year', 'years', 'metre', 'metres', 'meter', 'meters', 'km', 'kilometre', 'kilometres', 'mile', 'miles', 'foot', 'feet', 'ton', 'tons', 'arch', 'arches', 'arm', 'arms', 'leg', 'legs', 'poem', 'poems', 'work', 'works', 'son', 'sons', 'daughter', 'daughters', 'time', 'times', 'dynasty', 'dynasties', 'century', 'centuries'])
export const APPROX_MARKERS = freeze({
  'zh-CN': freeze({ approx: freeze(['约', '近']), over: freeze(['余', '多', '逾', '超过']) }),
  en: freeze({ approx: freeze(['about', 'around', 'nearly', 'almost', 'some']), over: freeze(['over', 'more than']) }),
})
export const YEARS_AGO_TOLERANCE = freeze({ abs: 10, rel: 0.05 })

/** Step 5 superlatives. */
export const SUPERLATIVE_PATTERNS = freeze({
  'zh-CN': freeze([/天下第一/gu, /之最/gu, /最(?!后|终|初|近|好不过)/gu, /第一(?!次|天|步|眼|句|回|年|时间|批)/gu, /唯一/gu, /首个/gu, /首位/gu, /首座/gu]),
  en: freeze([/\bthe (?:first|only)\b(?! time)/giu, /\bthe (?:most|least)\b/giu]),
})
/** Explicit English superlative words (whole words only, no -est suffix rule). */
export const SUPERLATIVE_WORDS_EN = freeze(['largest', 'oldest', 'tallest', 'longest', 'highest', 'biggest', 'smallest', 'fastest', 'earliest', 'deepest', 'greatest', 'widest', 'heaviest', 'youngest', 'best', 'worst'])

const NUM_WORDS = freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
})
const SCALE_WORDS = freeze({ hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 })
const W = `(?:${[...Object.keys(NUM_WORDS), ...Object.keys(SCALE_WORDS)].join('|')})`
const EN_NUMBER = new RegExp(`\\b${W}(?:(?:[\\s-]+(?:and[\\s-]+)?)${W})*\\b`, 'giu')
const ZH_NUMERAL = /[零〇一二两三四五六七八九十百千万亿]+/gu
const MEASURE_ZH_RE = new RegExp(`^(?:${[...MEASURE_ZH].sort((a, b) => b.length - a.length).map(esc).join('|')})`, 'u')
const MEASURE_EN_RE = new RegExp(`^\\s+(?:${MEASURE_EN.join('|')})\\b`, 'iu')
const HAN = /\p{Script=Han}/u
const HAN_G = /\p{Script=Han}/gu

/** Value type of a claim. */
export const claimType = (c) => c?.type ?? PREDICATES[c?.predicate]?.type ?? 'text'

/** Masks [start, end) of a string with same-length placeholders. */
export const maskRange = (s, start, end) => s.slice(0, start) + MASK.repeat(end - start) + s.slice(end)

/** Whether a normalized string is long enough to match: ≥ 2 Han characters, or ≥ 4 Latin letters. */
export function longEnough(normalized) {
  const s = String(normalized ?? '')
  if (HAN.test(s)) return (s.match(HAN_G) ?? []).length >= 2
  return (s.match(/[a-z]/g) ?? []).length >= 4
}

/** Merges overlapping or touching spans. */
export function mergeSpans(spans) {
  const out = []
  for (const s of [...spans].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = out[out.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else out.push({ start: s.start, end: s.end })
  }
  return out
}

const inside = (spans, start, end) => spans.some((s) => start >= s.start && end <= s.end)

/**
 * Occurrences of normalized needles in a text, as original [start, end) offsets (whitespace and
 * punctuation inside a match are included).
 * @param {string} text original text
 * @param {Iterable<string>} needles normalized strings
 * @returns {{ start: number, end: number, needle: string }[]}
 */
export function findNormalized(text, needles) {
  const { text: norm, map } = normalizeWithMap(text)
  const out = []
  for (const n of needles) {
    if (!n) continue
    for (let k = norm.indexOf(n); k >= 0; k = norm.indexOf(n, k + 1)) {
      const a = map[k]
      const b = map[k + n.length - 1]
      out.push({ start: a, end: b + (text.codePointAt(b) > 0xffff ? 2 : 1), needle: n })
    }
  }
  return out
}

/** Normalized names of a label value: its labels plus the known-entity labels and aliases of its qid. */
export function labelNames(value, known) {
  if (!value) return []
  const names = new Set(labelTexts(value))
  if (value.qid && known?.names) for (const n of known.names(value.qid)) names.add(n)
  return [...names].filter(longEnough)
}

/** Normalized strings a claim's value contributes to step 3b and step 6. */
function valueNames(claim, known, { quotes }) {
  const v = claim?.value
  switch (claimType(claim)) {
    case 'quote': return quotes ? [normalizeLabel(v?.text)].filter(longEnough) : []
    case 'label': return labelNames(v, known)
    case 'event': return [...labelNames(v?.object, known), ...labelNames(v?.place, known)]
    default: return []
  }
}

/**
 * Step 3b: spans of the bound values in a line (design §6.6a 3b), computed on the original text.
 * @param {string|{ text: string }} line
 * @param {object[]} boundClaims claims bound to this line
 * @param {object} [knownEntities] table from facts/labels.mjs loadKnownEntities()
 * @returns {{ start: number, end: number }[]} merged spans
 */
export function boundValueSpans(line, boundClaims, knownEntities) {
  const text = typeof line === 'string' ? line : String(line?.text ?? '')
  const needles = new Set()
  for (const c of boundClaims ?? []) for (const n of valueNames(c, knownEntities, { quotes: true })) needles.add(n)
  return mergeSpans(findNormalized(text, needles))
}

/** Bound date values of claims (date type and event.date), with the claim id. */
function boundDates(bound) {
  const out = []
  for (const c of bound) {
    const t = claimType(c)
    if (t === 'date' && c.value) out.push({ claim: c.id, date: c.value })
    else if (t === 'event' && c.value?.date) out.push({ claim: c.id, date: c.value.date })
  }
  return out
}

/** Approximation marker right before or after a number in the masked text. */
function approxAround(m, start, end, lang) {
  const before = m.slice(Math.max(0, start - 12), start)
  const after = m.slice(end, end + 4)
  const markers = APPROX_MARKERS[lang]
  if (lang === 'zh-CN') {
    for (const w of markers.over) if (new RegExp(`${esc(w)}\\s?$`, 'u').test(before)) return 'over'
    for (const w of markers.approx) if (new RegExp(`${esc(w)}\\s?$`, 'u').test(before)) return 'approx'
    if (/^\s?(?:余|多)/u.test(after)) return 'over'
    return null
  }
  for (const w of markers.over) if (new RegExp(`\\b${esc(w)}\\s+$`, 'iu').test(before)) return 'over'
  for (const w of markers.approx) if (new RegExp(`\\b${esc(w)}\\s+$`, 'iu').test(before)) return 'approx'
  return null
}

/** Value of an English number-word phrase. */
function englishNumber(text) {
  let total = 0
  let cur = 0
  for (const w of text.toLowerCase().split(/[\s-]+/)) {
    if (w === 'and') continue
    if (w in NUM_WORDS) cur += NUM_WORDS[w]
    else if (w === 'hundred') cur = (cur || 1) * 100
    else if (w in SCALE_WORDS) { total += (cur || 1) * SCALE_WORDS[w]; cur = 0 }
  }
  return total + cur
}

/** Measurement unit right after a number (for SI conversion); returns the unit text or ''. */
function unitAfter(m, end, lang) {
  const after = m.slice(end, end + 16)
  const u = lang === 'zh-CN'
    ? after.match(/^\s?(?:余|多)?\s?(公里|千米|厘米|毫米|米|公斤|千克|吨|斤|丈|尺|里)/u)
    : after.match(/^\s?(km|kilometres?|kilometers?|metres?|meters?|m|cm|mm|feet|foot|ft|miles?|kg|kilograms?|tonnes?|tons?|t)\b/iu)
  return u ? u[1] : ''
}

/** "N years ago" right after a number. */
function yearsAgoAfter(m, end, lang) {
  const after = m.slice(end, end + 16)
  return lang === 'zh-CN' ? /^\s?(?:余|多)?\s?年前/u.test(after) : /^\s+years?\s+ago\b/iu.test(after)
}

/**
 * Runs steps 1–6 on one line.
 * @param {{ text: string, lang: string, bound?: object[], claims?: object[], known?: object }} input
 *   bound: claims bound to the line; claims: all claims of the fact sheet (step 6 names)
 * @returns {{ hedges: string[], spans: object[], dates: object[], numbers: object[], superlatives: object[], names: object[], masked: string }}
 */
export function analyzeLine({ text, lang, bound = [], claims = [], known }) {
  const l = lang === 'zh-CN' ? 'zh-CN' : 'en'
  const orig = String(text ?? '')
  let m = orig
  // 1 hedge markers
  const hedges = []
  for (const re of HEDGE_RE[l]) {
    for (const x of m.matchAll(re)) {
      hedges.push(orig.slice(x.index, x.index + x[0].length))
      m = maskRange(m, x.index, x.index + x[0].length)
    }
  }
  // 2 idioms
  for (const idiom of [...IDIOMS[l]].sort((a, b) => b.length - a.length)) {
    const re = l === 'en' ? new RegExp(`\\b${esc(idiom)}\\b`, 'giu') : new RegExp(esc(idiom), 'gu')
    for (const x of m.matchAll(re)) m = maskRange(m, x.index, x.index + x[0].length)
  }
  // 3b spans on the original text (N1)
  const spans = boundValueSpans(orig, bound, known)
  // 3 dates: bound raw first, then the generic patterns
  const dates = []
  const rawNeedles = new Map()
  for (const { claim, date } of boundDates(bound)) {
    const n = normalizeLabel(date.raw)
    if (n.length >= 2 && !rawNeedles.has(n)) rawNeedles.set(n, claim)
  }
  for (const hit of findNormalized(orig, rawNeedles.keys())) {
    if (/^\u0000+$/.test(m.slice(hit.start, hit.end))) continue
    dates.push({ text: orig.slice(hit.start, hit.end), start: hit.start, end: hit.end, source: 'raw', claim: rawNeedles.get(hit.needle) })
    m = maskRange(m, hit.start, hit.end)
  }
  for (const re of DATE_PATTERNS[l]) {
    for (const x of m.matchAll(re)) {
      const start = x.index
      const end = start + x[0].length
      if (inside(spans, start, end)) continue
      dates.push({ text: x[0], start, end, source: 'regex' })
      m = maskRange(m, start, end)
    }
  }
  for (const s of spans) m = maskRange(m, s.start, s.end)
  // 4 numbers
  const numbers = []
  const pushNumber = (start, end, value, kind) => {
    if (!Number.isFinite(value)) return
    const unit = unitAfter(m, end, l)
    const approx = approxAround(m, start, end, l)
    let si = null
    if (unit) {
      const n = normalizeNumber(`${value} ${unit}`)
      if (n && n.unit && !['year', 'day'].includes(n.unit)) si = { value: n.value, unit: n.unit }
    }
    numbers.push({ text: orig.slice(start, end), start, end, value, kind, approx, unit: unit || null, si, years_ago: yearsAgoAfter(m, end, l) })
  }
  for (const x of m.matchAll(/\d+(?:[.,]\d+)*/gu)) {
    const raw = x[0]
    const value = Number(raw.replace(/,/g, ''))
    pushNumber(x.index, x.index + raw.length, value, 'arabic')
  }
  if (l === 'zh-CN') {
    for (const x of m.matchAll(ZH_NUMERAL)) {
      const end = x.index + x[0].length
      if (!MEASURE_ZH_RE.test(m.slice(end))) continue
      if (x[0] === '一' && m[x.index - 1] !== '第') continue
      const value = parseChineseInteger(/^[万亿]/u.test(x[0]) ? `一${x[0]}` : x[0])
      if (value == null) continue
      pushNumber(x.index, end, value, 'chinese')
    }
  } else {
    for (const x of m.matchAll(EN_NUMBER)) {
      const end = x.index + x[0].length
      if (/^one$/i.test(x[0]) && !MEASURE_EN_RE.test(m.slice(end))) continue
      pushNumber(x.index, end, englishNumber(x[0]), 'words')
    }
  }
  numbers.sort((a, b) => a.start - b.start)
  // 5 superlatives
  const superlatives = []
  for (const re of SUPERLATIVE_PATTERNS[l]) {
    for (const x of m.matchAll(re)) {
      superlatives.push({ text: x[0], start: x.index, end: x.index + x[0].length })
      m = maskRange(m, x.index, x.index + x[0].length)
    }
  }
  if (l === 'en') {
    const re = new RegExp(`\\b(?:${SUPERLATIVE_WORDS_EN.join('|')})\\b`, 'giu')
    for (const x of m.matchAll(re)) superlatives.push({ text: x[0], start: x.index, end: x.index + x[0].length })
  }
  superlatives.sort((a, b) => a.start - b.start)
  // 6 names on the original text
  const boundNames = new Set()
  for (const c of bound) for (const n of valueNames(c, known, { quotes: false })) boundNames.add(n)
  const nameClaims = new Map()
  for (const c of claims) {
    for (const n of valueNames(c, known, { quotes: false })) {
      if (!nameClaims.has(n)) nameClaims.set(n, new Set())
      nameClaims.get(n).add(c.id)
    }
  }
  const names = findNormalized(orig, nameClaims.keys()).map((h) => ({
    text: orig.slice(h.start, h.end), start: h.start, end: h.end, needle: h.needle,
    claims: [...nameClaims.get(h.needle)].sort(), bound: inside(spans, h.start, h.end) || boundNames.has(h.needle),
  })).sort((a, b) => a.start - b.start || a.end - b.end)
  return { hedges, spans, dates, numbers, superlatives, names, masked: m }
}

/** Whether a line text carries the hedge marker a hedge kind needs. */
export function hasHedgeMarker(text, lang, kind) {
  const l = lang === 'zh-CN' ? 'zh-CN' : 'en'
  const list = kind === 'one-account' ? DISPUTE_MARKERS[l] : ATTRIBUTION_MARKERS[l]
  return list.some((re) => re.test(String(text ?? '')))
}

/** Calendar number of an astronomical year as written in text (BCE years are written 1 − y). */
const writtenYear = (y) => (y > 0 ? y : 1 - y)

/**
 * Allowed numbers of a line (design §6.6a step 4): the bound values themselves, date parts, differences
 * of two bound dates and the ages they allow, age_at_death years, and "years ago" values.
 * @param {object[]} bound bound claims
 * @param {{ as_of_year?: number|null }} [options] max retrieved_at year of the fact sheet's sources
 */
export function allowedSet(bound, { as_of_year: asOf = null } = {}) {
  const ints = new Set()
  const measures = []
  const yearsAgo = []
  const dates = boundDates(bound).map((d) => d.date)
  for (const c of bound) {
    const t = claimType(c)
    const v = c.value
    if (t === 'age' && Number.isInteger(v?.years)) ints.add(v.years)
    else if (t === 'count' && Number.isInteger(v)) ints.add(v)
    else if (t === 'number' && v && Number.isFinite(v.value)) measures.push(v)
    else if (t === 'superlative' && Number.isInteger(v?.as_of)) ints.add(v.as_of)
  }
  for (const d of dates) {
    ints.add(writtenYear(d.y))
    if (Array.isArray(d.range)) for (const y of d.range) ints.add(writtenYear(y))
    if (d.m) ints.add(d.m)
    if (d.d) ints.add(d.d)
    if (d.lunar_month) ints.add(d.lunar_month)
    if (Number.isInteger(asOf)) yearsAgo.push(asOf - d.y)
  }
  for (let i = 0; i < dates.length; i++) {
    for (let j = i + 1; j < dates.length; j++) {
      const [a, b] = dates[i].y <= dates[j].y ? [dates[i], dates[j]] : [dates[j], dates[i]]
      ints.add(b.y - a.y)
      const { exact, eastAsian } = ageSets(a, b)
      for (const n of exact) ints.add(n)
      for (const n of eastAsian) ints.add(n)
    }
  }
  return { ints, measures, yearsAgo, dates }
}

const within = (n, v, { abs = 0, rel = 0 }) => Math.abs(n - v) <= Math.max(abs, rel * Math.abs(v)) + EPS

/** Whether a detected number is in the allowed set. */
export function numberAllowed(num, allowed) {
  if (num.years_ago) {
    return allowed.yearsAgo.some((Y) => {
      if (num.approx == null) return num.value === Y
      if (num.approx === 'over') return num.value <= Y + EPS && within(num.value, Y, YEARS_AGO_TOLERANCE)
      return within(num.value, Y, YEARS_AGO_TOLERANCE)
    })
  }
  const n = num.value
  for (const v of allowed.ints) {
    if (num.approx == null ? n === v : num.approx === 'over' ? n <= v && within(n, v, { rel: 0.05 }) : within(n, v, { rel: 0.05 })) return true
  }
  for (const v of allowed.measures) {
    const candidates = [v.value]
    const raw = normalizeNumber(v.raw)
    if (raw) candidates.push(raw.value)
    for (const x of String(v.raw ?? '').match(/\d+(?:\.\d+)?/g) ?? []) candidates.push(Number(x))
    const nv = num.si && num.si.unit === v.unit ? num.si.value : n
    for (const c of candidates) {
      if (num.approx == null && within(nv, c, { rel: 1e-9 })) return true
      if (num.approx === 'approx' && within(nv, c, { rel: 0.05 })) return true
      if (num.approx === 'over' && nv <= c + EPS && within(nv, c, { rel: 0.05 })) return true
    }
  }
  return false
}

/** Parses a detected date expression (prepositions stripped). */
export function parseDateExpression(text) {
  const s = String(text ?? '').replace(/^(?:in|by|from|until|since)\s+/iu, '').trim()
  const md = s.match(/^(\d{1,2})\s?月\s?(\d{1,2})\s?日$/u)
  if (md) return { md: true, m: Number(md[1]), d: Number(md[2]) }
  return normalizeDate(s)
}

/**
 * Whether a detected date matches one of the bound dates: same date under §6.4 and no higher precision
 * than that claim. Raw matches are always the claim's own date.
 */
export function dateAllowed(expr, allowed) {
  if (expr.source === 'raw') return true
  const parsed = parseDateExpression(expr.text)
  if (!parsed) return false
  if (parsed.md) return allowed.dates.some((d) => d.m === parsed.m && d.d === parsed.d)
  return allowed.dates.some((d) => compareDates(parsed, d).equal && precisionRank(parsed.precision) <= precisionRank(d.precision))
}
