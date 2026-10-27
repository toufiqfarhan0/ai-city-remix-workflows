// Calendar arithmetic (design §6.4): Julian day numbers, Julian and Gregorian calendars, astronomical
// year numbering (1 BCE = 0, N BCE = 1 − N), Wikidata calendar models and the Chinese lunar-year rule.
// Pure and dependency-free.

/** Wikidata calendar models (`calendarmodel` is an entity URL ending in the QID). */
export const CALENDAR_MODELS = Object.freeze({ Q1985786: 'julian', Q1985727: 'gregorian' })

/** Calendar name for a Wikidata calendarmodel URL or QID; unknown models give 'unknown'. */
export function calendarFromModel(model) {
  const qid = String(model ?? '').match(/Q\d+$/)?.[0]
  return (qid && CALENDAR_MODELS[qid]) || 'unknown'
}

/** N BCE (historical numbering, no year 0) -> astronomical year. */
export const bceToAstronomical = (n) => 1 - n

/** Wikidata JSON years are historical: `-0551` is 551 BCE = astronomical −550; positive years are unchanged. */
export const wikidataYearToAstronomical = (y) => (y < 0 ? y + 1 : y)

const fdiv = (a, b) => Math.floor(a / b)

/** JDN of a proleptic Gregorian date (astronomical year). */
export function gregorianToJdn(y, m, d) {
  const a = fdiv(14 - m, 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + fdiv(153 * mm + 2, 5) + 365 * yy + fdiv(yy, 4) - fdiv(yy, 100) + fdiv(yy, 400) - 32045
}

/** JDN of a proleptic Julian date (astronomical year). */
export function julianToJdn(y, m, d) {
  const a = fdiv(14 - m, 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + fdiv(153 * mm + 2, 5) + 365 * yy + fdiv(yy, 4) - 32083
}

function fromParts(b, c) {
  const d = fdiv(4 * c + 3, 1461)
  const e = c - fdiv(1461 * d, 4)
  const m = fdiv(5 * e + 2, 153)
  return { y: 100 * b + d - 4800 + fdiv(m, 10), m: m + 3 - 12 * fdiv(m, 10), d: e - fdiv(153 * m + 2, 5) + 1 }
}

export function jdnToGregorian(jdn) {
  const a = jdn + 32044
  const b = fdiv(4 * a + 3, 146097)
  return fromParts(b, a - fdiv(146097 * b, 4))
}

export function jdnToJulian(jdn) {
  return fromParts(0, jdn + 32082)
}

/** First day of the Gregorian calendar (1582-10-15). Earlier day dates without a calendar are ambiguous. */
export const GREGORIAN_START_JDN = gregorianToJdn(1582, 10, 15)

/** JDN of y-m-d in a named calendar ('julian' or 'gregorian'). */
export const toJdn = (calendar, y, m, d) => (calendar === 'julian' ? julianToJdn(y, m, d) : gregorianToJdn(y, m, d))

/** Converts y-m-d between calendars. */
export function convertDate(from, to, y, m, d) {
  if (from === to) return { y, m, d }
  const jdn = toJdn(from, y, m, d)
  return to === 'julian' ? jdnToJulian(jdn) : jdnToGregorian(jdn)
}

/**
 * Gregorian years a Chinese lunar year Y may fall in: Y, and Y + 1 when the lunar month is 11, 12
 * or unknown (those months can fall in January or February of the next Gregorian year).
 */
export function lunarGregorianYears(y, lunarMonth) {
  return lunarMonth == null || lunarMonth >= 11 ? [y, y + 1] : [y]
}
