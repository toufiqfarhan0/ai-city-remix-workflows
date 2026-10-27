// chronicle-script/2 schema: one language-neutral shot list with captions per language. The same
// script.json serves every film language (share it between an en and a zh-CN project); the gate checks
// the captions of the brief's language. Every problem is reported as `script_invalid:<path>` (exit 9).
//
//   shots[]            film order; each shot is a whole number of bars of one theme section
//     id, section, bars, size (wide|medium|close|detail), camera, transition (cut|ink-bleed|scroll-pan|seal-stamp)
//     scene            scene name -> scenes/<scene>.js (Agent-written code), params passed to it
//     description, motion   what the picture shows and how it moves (art and fact-check roles)
//     sfx[]            { beat (0 ≤ beat < bars × 4, from the shot start), kind, tier, dur_beats? }
//     kind             fact|bridge|question|rehook|quote (as a narration line); hedge attributed|one-account
//     claims[]         verified claim ids the caption and picture rely on
//     caption          { <lang>: { text, em: [keyword…] } } — one short line saying what the picture shows
//     kp, rehook       knowledge-point id shown as a card in this shot; true when this shot is a re-hook
//   title, end_card    { <lang>: text } with title_claims / end_card.claims
//   knowledge_points[] { id: kp<n>, claims, card: { <lang>: { title, value } }, count?: number }
export const SCRIPT_SCHEMA = 'chronicle-script/2'
export const LINE_KINDS = Object.freeze(['fact', 'bridge', 'question', 'rehook', 'quote'])
export const HEDGES = Object.freeze(['attributed', 'one-account'])
export const SIZES = Object.freeze(['wide', 'medium', 'close', 'detail'])
export const CAMERAS = Object.freeze(['hold', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'rise', 'parallax'])
export const TRANSITIONS = Object.freeze(['cut', 'ink-bleed', 'scroll-pan', 'seal-stamp'])
export const SFX_KINDS = Object.freeze(['transition', 'appear', 'count', 'seal', 'route', 'reveal', 'brush', 'scroll'])
export const SFX_TIERS = Object.freeze(['normal', 'emphasis', 'climax'])
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/
const SCENE = /^[a-z][a-z0-9-]{0,47}$/
const KP_ID = /^kp\d+$/
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const strArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0)
/** Text of a localised field for `lang` (exact tag, then its primary subtag), or null. */
export function localized(field, lang) {
  if (!isObj(field)) return null
  if (field[lang] != null) return field[lang]
  const primary = String(lang).split('-')[0]
  const key = Object.keys(field).find((k) => k.split('-')[0] === primary)
  return key ? field[key] : null
}
/**
 * Structural schema checks for one film language.
 * @returns {{ code: string, details?: object }[]}
 */
export function validateScriptSchema(script, lang = 'en') {
  const errors = []
  const bad = (path, details) => errors.push(details ? { code: `script_invalid:${path}`, details } : { code: `script_invalid:${path}` })
  if (!isObj(script)) return [{ code: 'script_invalid:script' }]
  if (script.schema !== SCRIPT_SCHEMA) bad('schema')
  if (!Number.isInteger(script.seconds)) bad('seconds')
  if (typeof script.subject !== 'string') bad('subject')
  if (!isStr(localized(script.title, lang))) bad('title', { lang })
  if (!strArray(script.title_claims ?? null)) bad('title_claims')
  if (!Array.isArray(script.shots) || !script.shots.length) bad('shots')
  const seen = { shot: new Set(), kp: new Set() }
  for (const [i, shot] of (Array.isArray(script.shots) ? script.shots : []).entries()) {
    if (!isObj(shot) || typeof shot.id !== 'string' || !ID.test(shot.id) || /^(title|end_card|kp\d+)$/.test(shot.id)) { bad(`shots[${i}]`); continue }
    const p = shot.id
    if (seen.shot.has(p)) bad(`${p}.id`, { reason: 'duplicate' })
    seen.shot.add(p)
    if (typeof shot.section !== 'string') bad(`${p}.section`)
    if (!Number.isInteger(shot.bars)) bad(`${p}.bars`)
    if (!SIZES.includes(shot.size)) bad(`${p}.size`)
    if (!CAMERAS.includes(shot.camera)) bad(`${p}.camera`)
    if (!TRANSITIONS.includes(shot.transition)) bad(`${p}.transition`)
    if (typeof shot.scene !== 'string' || !SCENE.test(shot.scene)) bad(`${p}.scene`)
    if (shot.params != null && !isObj(shot.params)) bad(`${p}.params`)
    if (!isStr(shot.description)) bad(`${p}.description`)
    if (shot.motion != null && typeof shot.motion !== 'string') bad(`${p}.motion`)
    if (!LINE_KINDS.includes(shot.kind)) bad(`${p}.kind`)
    if (shot.hedge != null && !HEDGES.includes(shot.hedge)) bad(`${p}.hedge`)
    if (!strArray(shot.claims ?? null)) bad(`${p}.claims`)
    if (shot.kp != null && (typeof shot.kp !== 'string' || !KP_ID.test(shot.kp))) bad(`${p}.kp`)
    if (shot.rehook != null && typeof shot.rehook !== 'boolean') bad(`${p}.rehook`)
    const cap = localized(shot.caption, lang)
    if (!isObj(cap) || !isStr(cap.text)) bad(`${p}.caption`, { lang })
    else if (cap.em != null && (!strArray(cap.em) || cap.em.some((e) => !cap.text.includes(e)))) bad(`${p}.caption.em`)
    if (!Array.isArray(shot.sfx ?? [])) bad(`${p}.sfx`)
    for (const [k, c] of (Array.isArray(shot.sfx) ? shot.sfx : []).entries()) {
      if (!isObj(c) || typeof c.beat !== 'number' || !(c.beat >= 0) || (Number.isInteger(shot.bars) && c.beat >= shot.bars * 4) || Math.round(c.beat * 4) !== c.beat * 4) bad(`${p}.sfx[${k}].beat`)
      else if (!SFX_KINDS.includes(c.kind)) bad(`${p}.sfx[${k}].kind`)
      else if (!SFX_TIERS.includes(c.tier)) bad(`${p}.sfx[${k}].tier`)
      else if (c.dur_beats != null && !(typeof c.dur_beats === 'number' && c.dur_beats > 0 && c.dur_beats <= 16)) bad(`${p}.sfx[${k}].dur_beats`)
    }
  }
  if (!Array.isArray(script.knowledge_points)) bad('knowledge_points')
  for (const [i, kp] of (Array.isArray(script.knowledge_points) ? script.knowledge_points : []).entries()) {
    if (!isObj(kp) || typeof kp.id !== 'string' || !KP_ID.test(kp.id)) { bad(`knowledge_points[${i}]`); continue }
    if (seen.kp.has(kp.id)) bad(`${kp.id}.id`, { reason: 'duplicate' })
    seen.kp.add(kp.id)
    if (!strArray(kp.claims ?? null) || !kp.claims.length) bad(`${kp.id}.claims`)
    const card = localized(kp.card, lang)
    if (!isObj(card) || !isStr(card.title) || !isStr(card.value)) bad(`${kp.id}.card`, { lang })
    if (kp.count != null && !(typeof kp.count === 'number' && Number.isFinite(kp.count))) bad(`${kp.id}.count`)
  }
  if (!isObj(script.end_card) || !isStr(localized(script.end_card.line, lang)) || !strArray(script.end_card.claims ?? null)) bad('end_card', { lang })
  return errors
}
/**
 * The gate view of a script for one language: captions as narration lines, title / kp cards / end card
 * as virtual lines (the fact rules of script-gate.mjs read this view).
 */
export function gateView(script, lang) {
  const shots = Array.isArray(script?.shots) ? script.shots : []
  const sections = []
  for (const shot of shots) {
    if (!sections.length || sections[sections.length - 1].id !== shot.section) sections.push({ id: shot.section, lines: [] })
    const cap = localized(shot.caption, lang) ?? {}
    sections[sections.length - 1].lines.push({ id: shot.id, text: cap.text ?? '', kind: shot.kind, claims: shot.claims ?? [], hedge: shot.hedge ?? null, emphasis: cap.em ?? [], kp: shot.kp ?? null })
  }
  return {
    title: localized(script?.title, lang) ?? '',
    title_claims: script?.title_claims ?? [],
    sections,
    knowledge_points: (script?.knowledge_points ?? []).map((kp) => ({ id: kp.id, section: shots.find((s) => s.kp === kp.id)?.section ?? null, claims: kp.claims ?? [], card: localized(kp.card, lang) ?? {} })),
    end_card: { line: localized(script?.end_card?.line, lang) ?? '', claims: script?.end_card?.claims ?? [] },
  }
}
/** Script lines (captions) of a gate view in order, each with its section id. */
export function scriptLines(view) {
  return (Array.isArray(view?.sections) ? view.sections : []).flatMap((s) => (Array.isArray(s?.lines) ? s.lines : []).map((l) => ({ ...l, section: s.id })))
}
/** Virtual lines of a gate view: title, every knowledge-point card, end card. */
export function virtualLines(view) {
  const out = []
  if (typeof view?.title === 'string') out.push({ id: 'title', text: view.title, kind: 'bridge', claims: [...(view.title_claims ?? [])], hedge: null, section: null, virtual: true })
  for (const kp of Array.isArray(view?.knowledge_points) ? view.knowledge_points : []) {
    if (!kp?.card) continue
    out.push({ id: kp.id, text: `${kp.card.title ?? ''} ${kp.card.value ?? ''}`, kind: 'bridge', claims: [...(kp.claims ?? [])], hedge: null, section: kp.section, virtual: true, card: true })
  }
  if (view?.end_card && typeof view.end_card.line === 'string') out.push({ id: 'end_card', text: view.end_card.line, kind: 'bridge', claims: [...(view.end_card.claims ?? [])], hedge: null, section: 'outro', virtual: true })
  return out
}
/** All display texts of a script in one language (title, captions, cards, end card), for the glyph check. */
export function displayTexts(script, lang) {
  const v = gateView(script, lang)
  return [...scriptLines(v).map((l) => l.text), ...virtualLines(v).map((x) => x.text)].filter((t) => typeof t === 'string')
}
