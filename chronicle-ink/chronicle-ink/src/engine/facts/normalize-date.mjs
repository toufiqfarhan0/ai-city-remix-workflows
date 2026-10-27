// Date parsing and comparison (design §6.4 "日期").
//
// Internal form: { raw, y, m?, d?, precision, calendar, approx, range?, lunar_month? }
//   y         astronomical year (1 BCE = 0, N BCE = 1 − N)
//   precision 'day' | 'month' | 'year' | 'decade' | 'century' | 'millennium'
//   calendar  'gregorian' | 'julian' | 'lunar-chinese' | 'unknown'
//   range     [fromYear, toYear] for spans, decades and centuries
// Chinese lunar / era dates are not converted here: the extractor gives `gregorian_year_hint` (the
// Gregorian number of the lunar year) and comparison is at year level (Y or Y + 1).
import { GREGORIAN_START_JDN, bceToAstronomical, calendarFromModel, convertDate, lunarGregorianYears, toJdn, wikidataYearToAstronomical } from './calendar.mjs'
import { parseChineseInteger } from './normalize-number.mjs'

const MONTHS = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
})
const PRECISION_RANK = Object.freeze({ millennium: 0, century: 1, decade: 2, year: 3, month: 4, day: 5 })
export const precisionRank = (p) => PRECISION_RANK[p] ?? -1

const APPROX_PRE = /^(?:约|大约|大概|约在|约于|circa|c\.|ca\.|about|around|approximately)\s*/i
const APPROX_POST = /\s*(?:左右|前后|许)$/
const BCE = /\s*(?:BCE|BC|B\.C\.E\.|B\.C\.)$/i
const CE = /\s*(?:CE|AD|A\.D\.|C\.E\.)$/i
const LUNAR_MARK = /农历|阴历|夏历|旧历/

/** Integer from Arabic digits or a Chinese numeral. */
function int(s) {
  if (s == null) return null
  const t = String(s).trim()
  if (/^\d+$/.test(t)) return Number(t)
  return parseChineseInteger(t)
}

const validMd = (m, d) => (m == null || (m >= 1 && m <= 12)) && (d == null || (d >= 1 && d <= 31))

function make(raw, { y, m = null, d = null, precision, calendar = 'unknown', approx = false, range = null }) {
  if (!Number.isInteger(y) || !validMd(m, d)) return null
  const out = { raw, y, precision, calendar, approx }
  if (m != null) out.m = m
  if (d != null) out.d = d
  if (range) out.range = range
  return out
}

function centuryRange(c, bce) {
  if (!Number.isInteger(c) || c < 1) return null
  return bce ? [bceToAstronomical(c * 100), bceToAstronomical((c - 1) * 100 + 1)] : [(c - 1) * 100 + 1, c * 100]
}

/** Lunar month from a raw Chinese date (正月 = 1, 冬月 = 11, 腊月 = 12). */
function lunarMonthOf(raw) {
  const s = String(raw)
  if (/正月/.test(s)) return 1
  if (/冬月/.test(s)) return 11
  if (/腊月|臘月/.test(s)) return 12
  const m = s.match(/年\s*(?:闰|閏)?\s*([〇零一二三四五六七八九十\d]{1,3})\s*月/)
  const n = m ? int(m[1]) : null
  return n >= 1 && n <= 12 ? n : null
}

/** Year with an optional BCE/CE marker (`551 BC`, `公元前551年`, `前551`, `AD 1037`). */
function parseYearToken(token) {
  let s = token.trim().replace(/年$/, '').trim()
  let bce = false
  if (/^公元前|^前/.test(s)) { bce = true; s = s.replace(/^公元前|^前/, '') }
  else if (/^公元/.test(s)) s = s.replace(/^公元/, '')
  if (BCE.test(s)) { bce = true; s = s.replace(BCE, '') }
  else if (CE.test(s)) s = s.replace(CE, '')
  s = s.replace(/^(?:AD|A\.D\.|CE)\s*/i, '').trim()
  const n = int(s)
  if (n == null || n < 1) return null
  return { y: bce ? bceToAstronomical(n) : n, bce }
}

function parsePlain(raw, s, approx) {
  // Signed ISO (Wikidata convention: negative years are historical, no year 0).
  let m = s.match(/^([+-])?(\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:T[\d:]+Z?)?$/)
  if (m) {
    const n = Number(m[2])
    const y = m[1] === '-' ? wikidataYearToAstronomical(-n) : n
    const mo = Number(m[3] ?? 0) || null
    const da = mo ? Number(m[4] ?? 0) || null : null
    return make(raw, { y, m: mo, d: da, precision: da ? 'day' : mo ? 'month' : 'year', approx })
  }
  // Spans: 595–605, 595-605年, 595 to 605, 前221年至前206年.
  m = s.match(/^(.+?)\s*(?:–|—|~|～|至|到|\bto\b|-)\s*(.+)$/i)
  if (m) {
    const right = parseYearToken(m[2])
    let left = parseYearToken(m[1])
    if (left && right && right.bce && !left.bce && /^\d+$/.test(m[1].trim())) left = parseYearToken(`${m[1]} BC`)
    if (left && right && left.y <= right.y) return make(raw, { y: left.y, precision: 'year', approx, range: [left.y, right.y] })
  }
  // Centuries: 11世纪, 公元前5世纪, 11th century, 5th century BC.
  m = s.match(/^(公元前|前)?\s*([〇零一二三四五六七八九十\d]+)\s*世纪(?:初|中|末|中叶|上半叶|下半叶)?$/)
  if (m) {
    const range = centuryRange(int(m[2]), !!m[1])
    return range && make(raw, { y: range[0], precision: 'century', approx, range })
  }
  m = s.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\s+century(\s*(?:BCE|BC|B\.C\.|AD|CE))?$/i)
  if (m) {
    const range = centuryRange(Number(m[1]), !!m[2] && /B/i.test(m[2]))
    return range && make(raw, { y: range[0], precision: 'century', approx, range })
  }
  // Decades: 1030s.
  m = s.match(/^(\d{3,4})0s$/)
  if (m) {
    const y = Number(m[1]) * 10
    return make(raw, { y, precision: 'decade', approx, range: [y, y + 9] })
  }
  // Chinese: 1037年1月8日, 公元前551年, 一〇三七年, 1079年8月.
  m = s.match(/^((?:公元前|公元|前)?\s*[〇零一二两三四五六七八九十百千\d]+)\s*年(?:\s*([〇零一二三四五六七八九十\d]{1,3})\s*月(?:\s*([〇零一二三四五六七八九十\d]{1,3})\s*[日号])?)?$/)
  if (m) {
    const yt = parseYearToken(m[1])
    if (!yt) return null
    const mo = int(m[2])
    const da = int(m[3])
    return make(raw, { y: yt.y, m: mo, d: mo ? da : null, precision: da ? 'day' : mo ? 'month' : 'year', approx })
  }
  // English: 8 January 1037, January 8, 1037, January 1037, (in) 1037, 551 BC.
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{1,4}(?:\s*(?:BCE|BC|B\.C\.|AD|CE))?)$/)
  if (m && MONTHS[m[2].toLowerCase()]) {
    const yt = parseYearToken(m[3])
    return yt && make(raw, { y: yt.y, m: MONTHS[m[2].toLowerCase()], d: Number(m[1]), precision: 'day', approx })
  }
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{1,4}(?:\s*(?:BCE|BC|B\.C\.|AD|CE))?)$/)
  if (m && MONTHS[m[1].toLowerCase()]) {
    const yt = parseYearToken(m[3])
    return yt && make(raw, { y: yt.y, m: MONTHS[m[1].toLowerCase()], d: Number(m[2]), precision: 'day', approx })
  }
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,4}(?:\s*(?:BCE|BC|B\.C\.|AD|CE))?)$/)
  if (m && MONTHS[m[1].toLowerCase()]) {
    const yt = parseYearToken(m[2])
    return yt && make(raw, { y: yt.y, m: MONTHS[m[1].toLowerCase()], precision: 'month', approx })
  }
  m = s.match(/^(?:in\s+)?((?:公元前|公元|前|AD\s*|A\.D\.\s*)?\d{1,4}(?:\s*(?:BCE|BC|B\.C\.E\.|B\.C\.|AD|A\.D\.|CE))?)$/i)
  if (m) {
    const yt = parseYearToken(m[1])
    return yt && make(raw, { y: yt.y, precision: 'year', approx })
  }
  return null
}

/**
 * Parses a raw date string.
 * @param {string} raw
 * @param {{ calendar?: string, gregorian_year_hint?: number }} [options]
 *   `calendar: 'lunar-chinese'` (or a 农历 marker, or an unparseable era date with a hint) gives a lunar
 *   date: y = gregorian_year_hint (or the parsed year), lunar_month from the text, precision 'year'.
 * @returns {object|null} the internal form, or null when the text is not a date
 */
export function normalizeDate(raw, { calendar, gregorian_year_hint: hint } = {}) {
  if (typeof raw === 'number' && Number.isInteger(raw)) raw = String(raw)
  if (typeof raw !== 'string' || !raw.trim()) return null
  let s = raw.normalize('NFKC').trim()
  let approx = false
  if (APPROX_PRE.test(s)) { s = s.replace(APPROX_PRE, ''); approx = true }
  if (APPROX_POST.test(s)) { s = s.replace(APPROX_POST, ''); approx = true }
  const lunarMarked = LUNAR_MARK.test(s)
  if (lunarMarked) s = s.replace(LUNAR_MARK, '').trim()
  const hintOk = Number.isInteger(hint)
  const plain = parsePlain(raw, s, approx)
  const lunar = calendar === 'lunar-chinese' || lunarMarked || (!plain && hintOk)
  if (lunar) {
    const y = hintOk ? hint : plain?.y
    if (!Number.isInteger(y)) return null
    const out = { raw, y, precision: 'year', calendar: 'lunar-chinese', approx }
    const lm = plain?.m ?? lunarMonthOf(raw)
    if (lm != null) out.lunar_month = lm
    return out
  }
  if (!plain) return null
  if (calendar === 'julian' || calendar === 'gregorian') plain.calendar = calendar
  return plain
}

/**
 * Wikidata time value -> internal form, read only from the JSON `time` + `precision` + `calendarmodel`.
 * Precision 11 day, 10 month, 9 year, 8 decade, 7 century, 6 millennium; coarser values return null.
 */
export function fromWikidataTime(value) {
  const m = String(value?.time ?? '').match(/^([+-])(\d{1,16})-(\d{2})-(\d{2})T/)
  if (!m) return null
  const n = Number(m[2])
  const y = m[1] === '-' ? wikidataYearToAstronomical(-n) : n
  const p = Number(value.precision)
  const calendar = calendarFromModel(value.calendarmodel)
  const raw = value.time
  if (p >= 11) return make(raw, { y, m: Number(m[3]) || null, d: Number(m[4]) || null, precision: 'day', calendar })
  if (p === 10) return make(raw, { y, m: Number(m[3]) || null, precision: 'month', calendar })
  if (p === 9) return make(raw, { y, precision: 'year', calendar })
  if (p === 8) {
    const from = Math.floor(y / 10) * 10
    return make(raw, { y: from, precision: 'decade', calendar, range: [from, from + 9] })
  }
  if (p === 7 || p === 6) {
    const size = p === 7 ? 100 : 1000
    const bce = m[1] === '-'
    const c = Math.ceil(n / size)
    const range = bce ? [1 - c * size, 1 - ((c - 1) * size + 1)] : [(c - 1) * size + 1, c * size]
    return make(raw, { y: range[0], precision: p === 7 ? 'century' : 'millennium', calendar, range })
  }
  return null
}

/** Whether a day date has no stated calendar and lies before 1582-10-15 (so both calendars are possible). */
const ambiguousDay = (d) => d.precision === 'day' && d.calendar === 'unknown' && toJdn('gregorian', d.y, d.m, d.d) < GREGORIAN_START_JDN

/** Candidate JDNs of a day date: one per possible calendar. */
function dayJdns(d) {
  if (d.calendar === 'julian' || d.calendar === 'gregorian') return [{ cal: d.calendar, jdn: toJdn(d.calendar, d.y, d.m, d.d) }]
  if (ambiguousDay(d)) return [{ cal: 'julian', jdn: toJdn('julian', d.y, d.m, d.d) }, { cal: 'gregorian', jdn: toJdn('gregorian', d.y, d.m, d.d) }]
  return [{ cal: 'gregorian', jdn: toJdn('gregorian', d.y, d.m, d.d) }]
}

/**
 * Years a date may occupy, as [from, to]. Lunar dates: Y, or Y..Y+1 for months 11, 12 or unknown.
 * A Julian (or undated pre-1582) day date also covers the Gregorian year number it maps to.
 */
export function yearInterval(d) {
  if (Array.isArray(d.range)) return [d.range[0], d.range[1]]
  if (d.calendar === 'lunar-chinese') {
    const ys = lunarGregorianYears(d.y, d.lunar_month ?? null)
    return [ys[0], ys[ys.length - 1]]
  }
  if (d.precision === 'day' && (d.calendar === 'julian' || ambiguousDay(d))) {
    const g = convertDate('julian', 'gregorian', d.y, d.m, d.d).y
    return [Math.min(d.y, g), Math.max(d.y, g)]
  }
  return [d.y, d.y]
}

const overlap = ([a0, a1], [b0, b1]) => Math.max(a0, b0) <= Math.min(a1, b1)

/**
 * Date equivalence (design §6.4):
 * - both day precision: compare JDNs; a pre-1582 day date without a calendar is tried as Julian and as
 *   Gregorian (flag `calendar_assumed`);
 * - lunar year Y matches Gregorian Y, or Y + 1 for lunar months 11, 12 or unknown (flag `lunar_cross_year`);
 * - different precision: the coarser date must contain the finer one; spans: overlap.
 * @returns {{ equal: boolean, flags: string[] }}
 */
export function compareDates(a, b) {
  if (!a || !b) return { equal: false, flags: [] }
  const la = a.calendar === 'lunar-chinese'
  const lb = b.calendar === 'lunar-chinese'
  if (la && lb) return { equal: overlap(a.range ?? [a.y, a.y], b.range ?? [b.y, b.y]), flags: [] }
  if (la || lb) {
    const L = la ? a : b
    const X = la ? b : a
    const xi = yearInterval(X)
    if (overlap([L.y, L.y], xi)) return { equal: true, flags: [] }
    const ys = lunarGregorianYears(L.y, L.lunar_month ?? null)
    return ys.length > 1 && overlap([ys[1], ys[1]], xi) ? { equal: true, flags: ['lunar_cross_year'] } : { equal: false, flags: [] }
  }
  if (a.precision === 'day' && b.precision === 'day' && !a.range && !b.range) {
    const ja = dayJdns(a)
    const jb = dayJdns(b)
    const sameParts = a.y === b.y && a.m === b.m && a.d === b.d
    if (a.calendar === b.calendar && sameParts) return { equal: true, flags: [] }
    const match = ja.some((x) => jb.some((y) => x.jdn === y.jdn))
    if (!match) return { equal: false, flags: [] }
    const assumed = ambiguousDay(a) || ambiguousDay(b)
    return { equal: true, flags: assumed ? ['calendar_assumed'] : [] }
  }
  if (!a.range && !b.range && precisionRank(a.precision) >= 4 && precisionRank(b.precision) >= 4) {
    // Month against month or day: same year and month.
    return { equal: a.y === b.y && a.m === b.m, flags: [] }
  }
  return { equal: overlap(yearInterval(a), yearInterval(b)), flags: [] }
}

/** Instance key for `key: date` predicates: year intervals overlap, or differ by at most `years` (2). */
export function datesNear(a, b, years = 2) {
  if (!a || !b) return false
  const [a0, a1] = yearInterval(a)
  const [b0, b1] = yearInterval(b)
  return Math.max(a0, b0) - Math.min(a1, b1) <= years
}

/** A plain { year, month, day, calendar } view for i18n.formatDate (null for spans and coarse dates). */
export function dateParts(d) {
  if (!d || d.range || precisionRank(d.precision) < 3) return null
  return { year: d.y, month: d.m ?? null, day: d.m ? d.d ?? null : null, calendar: d.calendar }
}
