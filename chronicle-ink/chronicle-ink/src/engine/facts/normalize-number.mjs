// Number parsing and comparison (design §6.4 "数字"). Arabic numerals (1,400; 1.4 thousand), Chinese
// numerals (一千四百, 两千, 万, 亿), "余/多/over" open lower bounds, "约/about" ±5 % ranges, units
// converted to SI (m, kg, m2) except historical Chinese units, which compare only with the same unit.
// Measurements agree within 2 % relative difference or overlapping ranges; counts must be equal.
import { formatNumber } from '../i18n.mjs'

export const MEASURE_TOLERANCE = 0.02
export const APPROX_SPREAD = 0.05

const ZH_DIGITS = Object.freeze({ 〇: 0, 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 })
const ZH_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1000 })

/**
 * Chinese numeral -> integer: positional (一千四百, 两万三千, 十二, 三亿) or digit by digit (一〇三七).
 * Returns null for anything else.
 */
export function parseChineseInteger(text) {
  const s = String(text ?? '').trim()
  if (!s || !/^[〇零一二两三四五六七八九十百千万亿]+$/.test(s)) return null
  if (!/[十百千万亿]/.test(s)) return Number([...s].map((c) => ZH_DIGITS[c]).join(''))
  let total = 0
  let section = 0
  let num = 0
  let sawDigit = false
  for (const c of s) {
    if (c in ZH_DIGITS) {
      num = ZH_DIGITS[c]
      sawDigit = true
    } else if (c in ZH_UNITS) {
      section += (num === 0 && !sawDigit ? 1 : num) * ZH_UNITS[c]
      num = 0
      sawDigit = false
    } else if (c === '万') {
      total += (section + num) * 10_000
      section = 0
      num = 0
      sawDigit = false
    } else if (c === '亿') {
      total = (total + section + num) * 100_000_000
      section = 0
      num = 0
      sawDigit = false
    }
  }
  return total + section + num
}

/** Unit name -> { unit (SI or historical key), factor, historical? }. Keys are matched case-insensitively. */
const UNIT_TABLE = (() => {
  const t = {}
  const add = (names, unit, factor, historical = false) => { for (const n of names) t[n.toLowerCase()] = { unit, factor, historical } }
  add(['m', 'meter', 'meters', 'metre', 'metres', '米', '公尺'], 'm', 1)
  add(['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres', '公里', '千米'], 'm', 1000)
  add(['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres', '厘米'], 'm', 0.01)
  add(['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres', '毫米'], 'm', 0.001)
  add(['ft', 'foot', 'feet', '英尺'], 'm', 0.3048)
  add(['in', 'inch', 'inches', '英寸'], 'm', 0.0254)
  add(['mi', 'mile', 'miles', '英里'], 'm', 1609.344)
  add(['kg', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes', '千克', '公斤'], 'kg', 1)
  add(['g', 'gram', 'grams', '克'], 'kg', 0.001)
  add(['t', 'tonne', 'tonnes', 'ton', 'tons', 'metric ton', 'metric tons', '吨', '公吨'], 'kg', 1000)
  add(['lb', 'lbs', 'pound', 'pounds', '磅'], 'kg', 0.45359237)
  add(['m2', 'm²', 'square meter', 'square meters', 'square metre', 'square metres', '平方米'], 'm2', 1)
  add(['km2', 'km²', 'square kilometer', 'square kilometers', 'square kilometre', 'square kilometres', '平方公里', '平方千米'], 'm2', 1e6)
  add(['ha', 'hectare', 'hectares', '公顷'], 'm2', 1e4)
  add(['year', 'years', 'yr', 'yrs', '年', '岁'], 'year', 1)
  add(['day', 'days', '天', '日'], 'day', 1)
  // Historical Chinese units changed over time: no conversion, compared only with the same unit.
  for (const u of ['丈', '尺', '寸', '里', '步', '斤', '亩', '石']) add([u], u, 1, true)
  return Object.freeze(t)
})()

/** Wikidata unit QIDs for the quantities the vocabulary maps (P2043 length, P2048 height, P2049 width). */
export const WIKIDATA_UNITS = Object.freeze({
  Q11573: 'm', Q828224: 'km', Q174728: 'cm', Q174789: 'mm', Q3710: 'ft', Q218593: 'in', Q253276: 'mi',
  Q11570: 'kg', Q41803: 'g', Q191118: 't', Q100995: 'lb',
})

const APPROX_PREFIX = /^(?:约|大约|大概|近|将近|接近|about|around|approximately|approx\.?|nearly|almost|roughly|circa|c\.|ca\.|some)\s*/i
const OVER_PREFIX = /^(?:over|more than|above|超过|逾|超)\s*/i
const APPROX_SUFFIX = /\s*(?:左右|上下|许)$/
const OVER_SUFFIX = /\s*(?:以上|有余|\+)$/
const MULTIPLIERS = Object.freeze({ thousand: 1e3, million: 1e6, billion: 1e9, 千: 1e3, 万: 1e4, 亿: 1e8 })

const tidy = (n) => Number(n.toPrecision(12))

/** Unit text -> table entry, or a plain lower-case unit for anything unknown (compared by string). */
function lookupUnit(text) {
  const u = String(text ?? '').trim().replace(/\.$/, '')
  if (!u) return { unit: null, factor: 1, historical: false }
  return UNIT_TABLE[u.toLowerCase()] ?? { unit: u.toLowerCase(), factor: 1, historical: false, unknown: true }
}

/** Parses a bare numeral (Arabic with optional thousands separators or Chinese). */
function parseNumeral(s) {
  const t = s.trim()
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''))
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t)
  return parseChineseInteger(t)
}

const NUMERAL = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|[〇零一二两三四五六七八九十百千万亿]+)'
const RE_RANGE = new RegExp(`^${NUMERAL}\\s*(?:–|—|-|~|～|至|到|to)\\s*${NUMERAL}\\s*(thousand|million|billion|千|万|亿)?\\s*(.*)$`, 'i')
const RE_SINGLE = new RegExp(`^${NUMERAL}\\s*(?:(余|多)\\s*)?(thousand|million|billion|千|万|亿)?\\s*(?:(余|多)\\s*)?(.*)$`, 'i')

/**
 * Parses a measurement or amount.
 * @param {string|number} raw   e.g. `50.82 m`, `1,400`, `1.4 thousand`, `约50米`, `一千四百余年`, `over 30 kg`
 * @param {{ unit?: string }} [options] unit given separately (used when `raw` has none)
 * @returns {{ raw: string, value: number, unit: string|null, approx: boolean, range?: [number, number|null], historical?: true }|null}
 *   `range[1] === null` is an open upper bound.
 */
export function normalizeNumber(raw, { unit: unitHint } = {}) {
  if (typeof raw === 'number' && Number.isFinite(raw)) raw = String(raw)
  if (typeof raw !== 'string') return null
  let s = raw.normalize('NFKC').trim()
  let approx = false
  let lowerOpen = false
  for (;;) {
    const before = s
    if (APPROX_PREFIX.test(s)) { s = s.replace(APPROX_PREFIX, ''); approx = true }
    if (OVER_PREFIX.test(s)) { s = s.replace(OVER_PREFIX, ''); lowerOpen = true }
    if (APPROX_SUFFIX.test(s)) { s = s.replace(APPROX_SUFFIX, ''); approx = true }
    if (OVER_SUFFIX.test(s)) { s = s.replace(OVER_SUFFIX, ''); lowerOpen = true }
    if (s === before) break
  }
  let lo
  let hi
  let mult
  let unitText
  const r = s.match(RE_RANGE)
  if (r) {
    lo = parseNumeral(r[1])
    hi = parseNumeral(r[2])
    mult = r[3]
    unitText = r[4]
  } else {
    const m = s.match(RE_SINGLE)
    if (!m) return null
    lo = parseNumeral(m[1])
    if (m[2] || m[4]) lowerOpen = true
    mult = m[3]
    unitText = m[5]
  }
  if (lo == null || (r && hi == null)) return null
  if (unitText && /[\d]/.test(unitText)) return null
  const factorM = mult ? MULTIPLIERS[mult.toLowerCase()] : 1
  const u = lookupUnit(unitText || unitHint)
  const f = factorM * u.factor
  const value = tidy(r ? ((lo + hi) / 2) * f : lo * f)
  const out = { raw: String(raw), value, unit: u.unit, approx }
  if (u.historical) out.historical = true
  if (r) out.range = [tidy(lo * f), tidy(hi * f)]
  else if (lowerOpen) out.range = [value, null]
  else if (approx) out.range = [tidy(value * (1 - APPROX_SPREAD)), tidy(value * (1 + APPROX_SPREAD))]
  if (lowerOpen) out.approx = true
  return out
}

const interval = (n) => (Array.isArray(n.range) ? [n.range[0], n.range[1] ?? Infinity] : [n.value, n.value])

/**
 * Measurement equivalence: same (SI or historical) unit, and overlapping ranges or relative difference ≤ 2 %.
 */
export function numbersEqual(a, b) {
  if (!a || !b || (a.unit ?? null) !== (b.unit ?? null)) return false
  const [a0, a1] = interval(a)
  const [b0, b1] = interval(b)
  if (Math.max(a0, b0) <= Math.min(a1, b1)) return true
  const scale = Math.max(Math.abs(a.value), Math.abs(b.value))
  return scale === 0 || Math.abs(a.value - b.value) <= MEASURE_TOLERANCE * scale + 1e-12
}

/** Counts (arches, limbs) must be exactly equal non-negative integers. */
export const countsEqual = (a, b) => Number.isInteger(a) && a >= 0 && a === b

/**
 * Narration precision (design §6.4): when agreeing sources differ, the narration may only use their
 * common significant digits plus an approximation word. 50 and 50.82 -> { value: 50, approx: true }.
 */
export function narrationNumber(values) {
  const vs = values.map(Number).filter(Number.isFinite)
  if (!vs.length) return null
  if (vs.every((v) => v === vs[0])) return { value: vs[0], approx: false }
  for (let k = -6; k <= 15; k++) {
    const step = 10 ** k
    const rounded = vs.map((v) => tidy(Math.round(v / step) * step))
    if (rounded.every((v) => v === rounded[0])) return { value: rounded[0], approx: true }
  }
  return { value: tidy(vs[0]), approx: true }
}

const UNIT_LABELS = Object.freeze({
  m: { en: 'm', 'zh-CN': '米' },
  kg: { en: 'kg', 'zh-CN': '千克' },
  m2: { en: 'm²', 'zh-CN': '平方米' },
  year: { en: 'years', 'zh-CN': '年' },
  day: { en: 'days', 'zh-CN': '天' },
})

/** Display label of a normalized unit in a language (historical and unknown units are shown as given). */
export const unitLabel = (lang, unit) => (unit == null ? '' : UNIT_LABELS[unit]?.[lang === 'zh-CN' ? 'zh-CN' : 'en'] ?? unit)

/** `about 50 m` / `约 50 米`. */
export function formatNarrationNumber(lang, { value, unit, approx }) {
  const zh = lang === 'zh-CN'
  const n = formatNumber(zh ? 'zh-CN' : 'en', value, { maximumFractionDigits: 6 })
  const u = unitLabel(zh ? 'zh-CN' : 'en', unit)
  const body = u ? `${n} ${u}` : n
  if (!approx) return body
  return zh ? `约 ${body}` : `about ${body}`
}
