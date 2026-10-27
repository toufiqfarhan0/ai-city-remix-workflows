// Age at death against birth and death dates (design §6.4 "年龄").
// - exact: day dates give the exact completed years; year-only dates allow {Δ − 1, Δ};
// - east-asian ("享年 N 岁" may count nominal years): Δ + 1, and Δ + 2 when the (Gregorian) birthday is in
//   January or February or unknown, because it may belong to the previous lunar year;
// - unknown: either rule. A match that needs the east-asian rule is flagged `east_asian_reckoning`.
// Lunar years are expanded to the Gregorian years they may cover (Y, Y + 1) before computing Δ.
import { convertDate } from './calendar.mjs'
import { yearInterval } from './normalize-date.mjs'

const isDay = (d) => d && d.precision === 'day' && !d.range && d.calendar !== 'lunar-chinese'

/** Completed years between two day dates (converted to a common calendar when they differ). */
export function exactAge(born, died) {
  if (!isDay(born) || !isDay(died)) return null
  let b = { y: born.y, m: born.m, d: born.d }
  let e = { y: died.y, m: died.m, d: died.d }
  const cb = born.calendar === 'unknown' ? died.calendar : born.calendar
  const ce = died.calendar === 'unknown' ? born.calendar : died.calendar
  if (cb !== ce && cb !== 'unknown' && ce !== 'unknown') {
    b = convertDate(cb, 'gregorian', b.y, b.m, b.d)
    e = convertDate(ce, 'gregorian', e.y, e.m, e.d)
  }
  return e.y - b.y - (e.m < b.m || (e.m === b.m && e.d < b.d) ? 1 : 0)
}

/** Gregorian birth month (null when unknown or lunar). */
function gregorianMonth(d) {
  if (!d || d.calendar === 'lunar-chinese' || d.range || d.m == null) return null
  if (d.precision === 'day' && d.calendar === 'julian') return convertDate('julian', 'gregorian', d.y, d.m, d.d).m
  return d.m
}

const span = ([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** Allowed ages under each reckoning. @returns {{ exact: Set<number>, eastAsian: Set<number> }} */
export function ageSets(born, died) {
  const exact = new Set()
  const eastAsian = new Set()
  const e = exactAge(born, died)
  const bornYears = span(yearInterval(born))
  const diedYears = span(yearInterval(died))
  const janFeb = born.calendar !== 'lunar-chinese' && (gregorianMonth(born) == null || gregorianMonth(born) <= 2)
  if (e != null) exact.add(e)
  for (const by of bornYears) {
    for (const dy of diedYears) {
      const delta = dy - by
      if (e == null) {
        exact.add(delta - 1)
        exact.add(delta)
      }
      eastAsian.add(delta + 1)
      if (janFeb) eastAsian.add(delta + 2)
    }
  }
  return { exact, eastAsian }
}

/**
 * @param {{ years: number, reckoning: 'exact'|'east-asian'|'unknown' }} age
 * @returns {{ ok: boolean, flags: string[] }}
 */
export function ageConsistent(age, born, died) {
  if (!age || !born || !died) return { ok: false, flags: [] }
  const { exact, eastAsian } = ageSets(born, died)
  const n = age.years
  const r = age.reckoning ?? 'unknown'
  if (r !== 'east-asian' && exact.has(n)) return { ok: true, flags: [] }
  if (r !== 'exact' && eastAsian.has(n)) return { ok: true, flags: ['east_asian_reckoning'] }
  return { ok: false, flags: [] }
}
