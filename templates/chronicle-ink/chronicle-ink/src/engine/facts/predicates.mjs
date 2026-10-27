// Controlled predicate vocabulary (design §6.3a). Data: the claim-extract prompt, the Agent task file
// and references/factcheck.md are generated from or compared with this table. Anything outside the
// table, or not applicable to the subject, becomes `other` (type text, never clustered).
//
// Each entry: type (value type, §6.4), card ('one' | 'many'), key (instance key for 'many': object,
// place or date), subjects ('*' = shared), wikidata (structured mapping), visual, values (enum), and
// template { en, zh-CN } for structured claims (Wikidata mappings and adapter outputs).
import { formatDate, formatNumber, formatYear } from '../i18n.mjs'
import { dateParts } from './normalize-date.mjs'
import { unitLabel } from './normalize-number.mjs'

const TABLE = {
  // shared
  born:            { type: 'date',  card: 'one',  subjects: ['person'], wikidata: 'P569' },
  died:            { type: 'date',  card: 'one',  subjects: ['person'], wikidata: 'P570' },
  birthplace:      { type: 'label', card: 'one',  subjects: ['person'], wikidata: 'P19' },
  deathplace:      { type: 'label', card: 'one',  subjects: ['person'], wikidata: 'P20' },
  burial_place:    { type: 'label', card: 'one',  subjects: ['person'], wikidata: 'P119' },
  located_in:      { type: 'label', card: 'one',  subjects: ['landmark', 'city'], wikidata: 'P131' },
  named_after:     { type: 'label', card: 'one',  subjects: ['*'], wikidata: 'P138' },
  // person
  age_at_death:    { type: 'age',   card: 'one',  subjects: ['person'] }, // checked against born/died by facts/age.mjs
  courtesy_name:   { type: 'label', card: 'many', key: 'object', subjects: ['person'], wikidata: 'P1782' },
  art_name:        { type: 'label', card: 'many', key: 'object', subjects: ['person'], wikidata: 'P1787' },
  father:          { type: 'label', card: 'one',  subjects: ['person'], wikidata: 'P22' },
  mother:          { type: 'label', card: 'one',  subjects: ['person'], wikidata: 'P25' },
  spouse:          { type: 'label', card: 'many', key: 'object', subjects: ['person'], wikidata: 'P26' },
  child:           { type: 'label', card: 'many', key: 'object', subjects: ['person'], wikidata: 'P40' },
  sibling:         { type: 'label', card: 'many', key: 'object', subjects: ['person'], wikidata: 'P3373' },
  exam_passed:     { type: 'event', card: 'many', key: 'object', subjects: ['person'] }, // object = exam/degree
  office_held:     { type: 'event', card: 'many', key: 'object', subjects: ['person'] }, // object = office/post
  exiled_to:       { type: 'event', card: 'many', key: 'place',  subjects: ['person'] },
  lived_in:        { type: 'event', card: 'many', key: 'place',  subjects: ['person'] },
  imprisoned:      { type: 'event', card: 'many', key: 'date',   subjects: ['person'] },
  work_written:    { type: 'event', card: 'many', key: 'object', subjects: ['person'] }, // object = work title
  built_or_founded: { type: 'event', card: 'many', key: 'object', subjects: ['person'] }, // e.g. causeway, academy
  // landmark
  inception:       { type: 'date',  card: 'one',  subjects: ['landmark'], wikidata: 'P571' },
  construction_started: { type: 'date', card: 'one', subjects: ['landmark'] },
  completed:       { type: 'date',  card: 'one',  subjects: ['landmark'] },
  architect:       { type: 'label', card: 'many', key: 'object', subjects: ['landmark'], wikidata: 'P84' },
  material:        { type: 'label', card: 'many', key: 'object', subjects: ['landmark'], wikidata: 'P186' },
  length:          { type: 'number', card: 'one', subjects: ['landmark', 'animal'], wikidata: 'P2043' },
  height:          { type: 'number', card: 'one', subjects: ['landmark', 'animal'], wikidata: 'P2048' },
  width:           { type: 'number', card: 'one', subjects: ['landmark'], wikidata: 'P2049' },
  span:            { type: 'number', card: 'one', subjects: ['landmark'] },
  arch_count:      { type: 'count', card: 'one',  subjects: ['landmark'], visual: true },
  structure_feature: { type: 'label', card: 'many', key: 'object', subjects: ['landmark'], visual: true },
  restored:        { type: 'event', card: 'many', key: 'date',   subjects: ['landmark'] },
  damaged:         { type: 'event', card: 'many', key: 'date',   subjects: ['landmark'] },
  heritage_listed: { type: 'event', card: 'many', key: 'object', subjects: ['landmark', 'city'] }, // object = list / designation
  // city (subject 'city', structure 'life')
  founded:         { type: 'date',  card: 'one',  subjects: ['city'], wikidata: 'P571' },
  population:      { type: 'number', card: 'many', key: 'date', subjects: ['city'] }, // scope.as_of = the year counted
  area:            { type: 'number', card: 'many', key: 'date', subjects: ['city'] },
  river:           { type: 'label', card: 'many', key: 'object', subjects: ['city'], wikidata: 'P206' },
  capital_of:      { type: 'event', card: 'many', key: 'object', subjects: ['city'] }, // object = state or empire
  ruled_by:        { type: 'event', card: 'many', key: 'object', subjects: ['city'] }, // object = state, dynasty, empire
  renamed:         { type: 'event', card: 'many', key: 'date',   subjects: ['city'] }, // object = the new name
  wall_built:      { type: 'event', card: 'many', key: 'object', subjects: ['city'] }, // object = the wall
  structure_built: { type: 'event', card: 'many', key: 'object', subjects: ['city'] }, // object = landmark, road, aqueduct, port
  sacked:          { type: 'event', card: 'many', key: 'date',   subjects: ['city'] }, // object = attacker
  disaster:        { type: 'event', card: 'many', key: 'date',   subjects: ['city'] }, // object = fire, plague, flood, earthquake
  rebuilt:         { type: 'event', card: 'many', key: 'date',   subjects: ['city'] },
  // animal
  taxon_rank:      { type: 'enum',  card: 'one',  subjects: ['animal'], wikidata: 'P105', values: ['species', 'subspecies', 'genus', 'family', 'order', 'class', 'phylum'] },
  parent_taxon:    { type: 'label', card: 'one',  subjects: ['animal'], wikidata: 'P171' },
  iucn_status:     { type: 'enum',  card: 'one',  subjects: ['animal'], wikidata: 'P141', values: ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'] },
  habitat:         { type: 'label', card: 'many', key: 'object', subjects: ['animal'] },
  range:           { type: 'label', card: 'many', key: 'object', subjects: ['animal'] }, // regions only; never drawn as borders
  diet:            { type: 'label', card: 'many', key: 'object', subjects: ['animal'] },
  lifespan:        { type: 'number', card: 'one', subjects: ['animal'] },
  body_mass:       { type: 'number', card: 'one', subjects: ['animal'] },
  limb_count:      { type: 'count', card: 'one',  subjects: ['animal'], visual: true },
  color_pattern:   { type: 'label', card: 'many', key: 'object', subjects: ['animal'], visual: true },
  // person visuals
  attire:          { type: 'label', card: 'many', key: 'object', subjects: ['person'], visual: true },
  headwear:        { type: 'label', card: 'many', key: 'object', subjects: ['person'], visual: true },
  // special types
  quote:           { type: 'quote', card: 'many', subjects: ['*'] },
  superlative:     { type: 'superlative', card: 'many', subjects: ['*'] },
  scientific_name: { type: 'text', card: 'one', subjects: ['animal'] },
  other:           { type: 'text', card: 'many', subjects: ['*'] },
}

/** Deterministic bilingual templates for structured claims (Wikidata mappings and CBDB/GBIF outputs). */
const TEMPLATES = {
  born: { en: '{subject} was born {date}', 'zh-CN': '{subject}生于{date}' },
  died: { en: '{subject} died {date}', 'zh-CN': '{subject}卒于{date}' },
  birthplace: { en: '{subject} was born in {value}', 'zh-CN': '{subject}出生于{value}' },
  deathplace: { en: '{subject} died in {value}', 'zh-CN': '{subject}逝世于{value}' },
  burial_place: { en: '{subject} was buried at {value}', 'zh-CN': '{subject}葬于{value}' },
  located_in: { en: '{subject} is located in {value}', 'zh-CN': '{subject}位于{value}' },
  named_after: { en: '{subject} is named after {value}', 'zh-CN': '{subject}得名于{value}' },
  age_at_death: { en: '{subject} died at the age of {value}', 'zh-CN': '{subject}享年{value}' },
  courtesy_name: { en: "{subject}'s courtesy name was {value}", 'zh-CN': '{subject}字{value}' },
  art_name: { en: "{subject}'s art name was {value}", 'zh-CN': '{subject}号{value}' },
  father: { en: "{subject}'s father was {value}", 'zh-CN': '{subject}的父亲是{value}' },
  mother: { en: "{subject}'s mother was {value}", 'zh-CN': '{subject}的母亲是{value}' },
  spouse: { en: "{subject}'s spouse was {value}", 'zh-CN': '{subject}的配偶是{value}' },
  child: { en: "{subject}'s child was {value}", 'zh-CN': '{subject}的子女有{value}' },
  sibling: { en: "{subject}'s sibling was {value}", 'zh-CN': '{subject}的兄弟姐妹有{value}' },
  inception: { en: '{subject} dates from {date}', 'zh-CN': '{subject}始建于{date}' },
  founded: { en: '{subject} was founded {date}', 'zh-CN': '{subject}建城于{date}' },
  river: { en: '{subject} lies on {value}', 'zh-CN': '{subject}坐落在{value}畔' },
  architect: { en: '{subject} was designed by {value}', 'zh-CN': '{subject}的设计者是{value}' },
  material: { en: '{subject} is made of {value}', 'zh-CN': '{subject}的材料是{value}' },
  length: { en: '{subject} is {value} long', 'zh-CN': '{subject}长{value}' },
  height: { en: '{subject} is {value} tall', 'zh-CN': '{subject}高{value}' },
  width: { en: '{subject} is {value} wide', 'zh-CN': '{subject}宽{value}' },
  taxon_rank: { en: '{subject} is ranked as a {value}', 'zh-CN': '{subject}的分类等级是{value}' },
  parent_taxon: { en: '{subject} belongs to {value}', 'zh-CN': '{subject}隶属于{value}' },
  iucn_status: { en: "{subject}'s IUCN Red List status is {value}", 'zh-CN': '{subject}的 IUCN 红色名录等级为{value}' },
  scientific_name: { en: "{subject}'s scientific name is {value}", 'zh-CN': '{subject}的学名是{value}' },
}

export const PREDICATES = Object.freeze(Object.fromEntries(Object.entries(TABLE).map(([name, def]) => [
  name,
  Object.freeze({ ...def, subjects: Object.freeze([...def.subjects]), ...(def.values ? { values: Object.freeze([...def.values]) } : {}), ...(TEMPLATES[name] ? { template: Object.freeze({ ...TEMPLATES[name] }) } : {}) }),
])))

/** Value structures given verbatim to the extractor (design §6.4 table). */
export const VALUE_SHAPES = Object.freeze({
  date: '{ "raw": "<date exactly as written>", "gregorian_year_hint"?: <Gregorian year number, required for era-name or lunar dates>, "calendar"?: "gregorian"|"julian"|"lunar-chinese" }',
  number: '{ "raw": "<number with unit as written>", "unit"?: "<unit when not in raw>" }',
  count: '<integer ≥ 0>',
  age: '{ "years": <integer>, "reckoning": "exact"|"east-asian"|"unknown" }',
  enum: '"<one of the listed values>"',
  label: '{ "label": { "en"?: "<English>", "zh-CN"?: "<简体中文>" }, "qid"?: "Q…" } (at least one language)',
  event: '{ "object"?: <label>, "place"?: <label>, "date"?: <date> } (the predicate says what happened)',
  quote: '{ "text": "<quotation in its original language>" }',
  superlative: '{ "dimension": "oldest"|"largest"|"longest"|"tallest"|"highest"|"first"|"only"|"earliest"|"biggest"|"deepest"|"fastest", "category": <label>, "as_of": <year> }',
  text: '{ "text": "<statement>" }',
})

export const SUPERLATIVE_DIMENSIONS = Object.freeze(['oldest', 'largest', 'longest', 'tallest', 'highest', 'first', 'only', 'earliest', 'biggest', 'deepest', 'fastest'])

/** Wikidata items of the enum predicates (P105 taxon rank, P141 IUCN status). */
export const WIKIDATA_ENUMS = Object.freeze({
  taxon_rank: Object.freeze({ Q7432: 'species', Q68947: 'subspecies', Q34740: 'genus', Q35409: 'family', Q36602: 'order', Q37517: 'class', Q38348: 'phylum' }),
  iucn_status: Object.freeze({ Q211005: 'LC', Q719675: 'NT', Q278113: 'VU', Q11394: 'EN', Q219127: 'CR', Q239509: 'EW', Q237350: 'EX', Q3245245: 'DD' }),
})

const ENUM_LABELS = Object.freeze({
  taxon_rank: {
    species: { en: 'species', 'zh-CN': '种' }, subspecies: { en: 'subspecies', 'zh-CN': '亚种' }, genus: { en: 'genus', 'zh-CN': '属' },
    family: { en: 'family', 'zh-CN': '科' }, order: { en: 'order', 'zh-CN': '目' }, class: { en: 'class', 'zh-CN': '纲' }, phylum: { en: 'phylum', 'zh-CN': '门' },
  },
  iucn_status: {
    LC: { en: 'Least Concern', 'zh-CN': '无危' }, NT: { en: 'Near Threatened', 'zh-CN': '近危' }, VU: { en: 'Vulnerable', 'zh-CN': '易危' },
    EN: { en: 'Endangered', 'zh-CN': '濒危' }, CR: { en: 'Critically Endangered', 'zh-CN': '极危' }, EW: { en: 'Extinct in the Wild', 'zh-CN': '野外灭绝' },
    EX: { en: 'Extinct', 'zh-CN': '灭绝' }, DD: { en: 'Data Deficient', 'zh-CN': '数据缺乏' },
  },
})

/** Whether a predicate applies to a subject. */
export const appliesTo = (def, subject) => def.subjects.includes('*') || def.subjects.includes(subject)

/**
 * Vocabulary given to the extractor: predicates applicable to the subject plus the shared ones, in
 * table order, with their value structure.
 */
export function vocabularyFor(subject) {
  return Object.entries(PREDICATES).filter(([, d]) => appliesTo(d, subject)).map(([name, d]) => ({
    predicate: name,
    type: d.type,
    card: d.card,
    ...(d.key ? { key: d.key } : {}),
    ...(d.values ? { values: [...d.values] } : {}),
    ...(d.visual ? { visual: true } : {}),
    value: VALUE_SHAPES[d.type],
  }))
}

/** Predicate name for a claim: unknown or not applicable to the subject -> 'other'. */
export function resolvePredicate(name, subject) {
  const def = Object.prototype.hasOwnProperty.call(PREDICATES, name) ? PREDICATES[name] : null
  return def && appliesTo(def, subject) ? name : 'other'
}

const LANG_KEYS = ['en', 'zh-CN']
const other = (lang) => (lang === 'en' ? 'zh-CN' : 'en')

/** Picks a label in `lang`, falling back to the other language. */
function pick(labels, lang) {
  if (labels?.[lang]) return { text: labels[lang], fallback: false }
  if (labels?.[other(lang)]) return { text: labels[other(lang)], fallback: true }
  return { text: null, fallback: true }
}

/** Display label of a label value: known-entity labels first (qid), then the value's own labels. */
function labelText(lang, value, known) {
  const fromTable = value?.qid && known?.display ? known.display(value.qid) : null
  const merged = { en: fromTable?.en ?? value?.label?.en, 'zh-CN': fromTable?.['zh-CN'] ?? value?.label?.['zh-CN'] }
  return pick(merged, lang)
}

/** Date phrase for templates: en `on 8 January 1037 (Julian)` / `in 1037`; zh-CN `1037年1月8日（儒略历）`. */
export function formatDatePhrase(lang, d) {
  const zh = lang === 'zh-CN'
  const approx = d.approx ? (zh ? '约' : 'around ') : ''
  if (d.calendar === 'lunar-chinese') {
    return zh ? `${approx}${formatYear(lang, d.y, { compact: true })}（农历年）` : `${approx || 'in '}${formatYear(lang, d.y)} (Chinese lunar year)`
  }
  if (d.precision === 'century' || d.precision === 'millennium') {
    const size = d.precision === 'century' ? 100 : 1000
    const bce = d.range[1] <= 0
    const n = bce ? Math.ceil((1 - d.range[0]) / size) : Math.ceil(d.range[1] / size)
    const ord = (k) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] ?? 'th'}`
    if (zh) return `${approx}${bce ? '公元前' : ''}${n}${size === 100 ? '世纪' : '千纪'}`
    return `${approx || 'in '}the ${ord(n)} ${size === 100 ? 'century' : 'millennium'}${bce ? ' BCE' : ''}`
  }
  if (d.precision === 'decade') return zh ? `${approx}${d.range[0]}年代` : `${approx || 'in '}the ${d.range[0]}s`
  if (d.range) {
    const a = formatYear(lang, d.range[0], { compact: true })
    const b = formatYear(lang, d.range[1], { compact: true })
    return zh ? `${approx}${a}至${b}` : `${approx}between ${a} and ${b}`
  }
  const parts = dateParts(d)
  const text = formatDate(lang, parts, { compact: true })
  if (zh) return `${approx}${text}`
  if (approx) return `${approx}${text}`
  return d.precision === 'day' ? `on ${text}` : `in ${text}`
}

/** Text of a value for a structured template. @returns {{ text: string, fallback: boolean }} */
export function formatValue(lang, predicate, value, known) {
  const def = PREDICATES[predicate]
  const zh = lang === 'zh-CN'
  switch (def?.type) {
    case 'label':
      return labelText(lang, value, known)
    case 'number': {
      const n = formatNumber(lang, value.value, { maximumFractionDigits: 6, useGrouping: false })
      const u = unitLabel(lang, value.unit)
      return { text: u ? (zh ? `${n}${u}` : `${n} ${u}`) : n, fallback: false }
    }
    case 'count':
      return { text: String(value), fallback: false }
    case 'enum':
      return { text: ENUM_LABELS[predicate]?.[value]?.[lang] ?? String(value), fallback: false }
    case 'age': {
      const ea = value.reckoning === 'east-asian'
      return { text: zh ? `${value.years}岁${ea ? '（虚岁）' : ''}` : `${value.years}${ea ? ' (East Asian age reckoning)' : ''}`, fallback: false }
    }
    case 'text':
      return { text: String(value.text), fallback: false }
    default:
      return { text: String(value?.text ?? ''), fallback: false }
  }
}

/**
 * Bilingual text of a structured claim from its predicate template (no translation model).
 * @param {{ predicate: string, value: object, subjectLabel: { en?: string, 'zh-CN'?: string }, known?: object }} input
 *   `known` is a known-entity table from facts/labels.mjs (for value labels).
 * @returns {{ text: { en: string, 'zh-CN': string }, flags: string[] }} `label_fallback` when a language was missing
 */
export function structuredText({ predicate, value, subjectLabel, known }) {
  const def = PREDICATES[predicate]
  if (!def?.template) throw new TypeError(`predicate ${predicate} has no template`)
  const text = {}
  let fallback = false
  for (const lang of LANG_KEYS) {
    const subject = pick(subjectLabel, lang)
    const vars = { subject: subject.text ?? '' }
    if (subject.fallback) fallback = true
    if (def.type === 'date') vars.date = formatDatePhrase(lang, value)
    else {
      const v = formatValue(lang, predicate, value, known)
      if (v.fallback) fallback = true
      vars.value = v.text ?? ''
    }
    text[lang] = def.template[lang].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
  }
  return { text, flags: fallback ? ['label_fallback'] : [] }
}
