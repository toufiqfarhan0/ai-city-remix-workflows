// Beat sheet: the series theme's arrangement for a film length, and the story plan laid onto it.
// Pure: the plan depends only on brief.seconds (and subject / structure for the role texts).
//
//   theme        88 BPM, 4/4 -> 1 bar = 240 / 88 s; 120 / 150 / 180 s are exactly 44 / 55 / 66 bars
//   arrangement  the theme's eight sections, repeated or trimmed at bar boundaries per length
//   shots        every shot is a whole number of bars (1–4), so every cut is on a downbeat
//   re-hooks     a new question or twist at the start of intro, build, breakdown, build2 and outro; a
//                `mid` re-hook is inserted (bar nearest the middle of the gap) while a gap exceeds 35 s
import { ChronicleError } from '../errors.mjs'
import { SECTIONS } from './templates.mjs'
export const PLAN_SCHEMA = 'chronicle-plan/2'
export const SECONDS_ALLOWED = Object.freeze([120, 150, 180])
export const THEME = Object.freeze({ id: 'ink-theme', bpm: 88, key: 'D', mode: 'gong pentatonic', version: 1 })
/** Bars per theme section by film length (sum = seconds × 88 / 240). */
export const ARRANGEMENTS = Object.freeze({
  120: Object.freeze({ intro: 4, verse: 8, build: 4, drop: 8, breakdown: 6, build2: 2, drop2: 8, outro: 4 }),
  150: Object.freeze({ intro: 4, verse: 12, build: 4, drop: 8, breakdown: 8, build2: 4, drop2: 8, outro: 7 }),
  180: Object.freeze({ intro: 4, verse: 16, build: 4, drop: 8, breakdown: 12, build2: 4, drop2: 12, outro: 6 }),
})
export const KP_RANGE = Object.freeze({ 120: Object.freeze({ min: 4, max: 6 }), 150: Object.freeze({ min: 5, max: 7 }), 180: Object.freeze({ min: 6, max: 8 }) })
export const SHOT_BARS = Object.freeze([1, 2, 3, 4])
export const END_CARD_BARS = 2
export const KP_SECTIONS = Object.freeze(['verse', 'build', 'drop', 'breakdown', 'build2', 'drop2'])
export const REHOOK_BASE = Object.freeze(['intro', 'build', 'breakdown', 'build2', 'outro'])
export const REHOOK_MIN_S = 25
export const REHOOK_MAX_GAP_S = 35
/** Seconds per bar of the theme. */
export const barSeconds = (bpm = THEME.bpm) => 240 / bpm
/** The theme arrangement: { seconds, bpm, total_bars, sections: [{ id, start_bar, bars }] }. */
export function arrangement(seconds) {
  const bars = ARRANGEMENTS[seconds]
  if (!bars) throw new ChronicleError('seconds_invalid', undefined, { allowed: SECONDS_ALLOWED })
  let start = 0
  const sections = SECTIONS.map((s) => {
    const out = { id: s.id, start_bar: start, bars: bars[s.id] }
    start += bars[s.id]
    return out
  })
  return { seconds, bpm: THEME.bpm, total_bars: start, sections }
}
/** Re-hook bars: base section starts, then `mid` insertions while any gap exceeds REHOOK_MAX_GAP_S. */
export function planRehooks(arr) {
  const barS = barSeconds(arr.bpm)
  const byId = Object.fromEntries(arr.sections.map((s) => [s.id, s]))
  const events = REHOOK_BASE.filter((id) => byId[id]).map((id) => ({ bar: byId[id].start_bar, kind: id === 'intro' ? 'hook' : id === 'outro' ? 'final' : 'turn', section: id }))
  for (;;) {
    events.sort((a, b) => a.bar - b.bar)
    const times = [...events.map((e) => e.bar * barS), arr.seconds]
    const k = times.findIndex((t, j) => j + 1 < times.length && times[j + 1] - t > REHOOK_MAX_GAP_S + 1e-9)
    if (k < 0) break
    const midBar = Math.round(((times[k] + times[k + 1]) / 2) / barS)
    const sec = arr.sections.find((s) => midBar >= s.start_bar && midBar < s.start_bar + s.bars)
    events.push({ bar: midBar, kind: 'mid', section: sec.id })
  }
  return events.map((e, i) => ({ i, ...e, t: Math.round(e.bar * barS * 1000) / 1000 }))
}
/**
 * Compiles the plan.
 * @param {{ seconds: number, aspect?: string, lang?: string, subject?: string, structure?: string }} input
 */
export function compileBeatSheet({ seconds, aspect = '16:9', lang = 'en', subject = null, structure = null }) {
  const arr = arrangement(seconds)
  const barS = barSeconds(arr.bpm)
  const sections = arr.sections.map((s, i) => ({
    ...s,
    music: SECTIONS[i].music,
    role: SECTIONS[i].role,
    start: Math.round(s.start_bar * barS * 1000) / 1000,
    end: Math.round((s.start_bar + s.bars) * barS * 1000) / 1000,
    kp_allowed: KP_SECTIONS.includes(s.id),
  }))
  return {
    schema: PLAN_SCHEMA,
    theme: THEME.id,
    seconds,
    bpm: arr.bpm,
    bar_s: Math.round(barS * 10000) / 10000,
    total_bars: arr.total_bars,
    aspect,
    lang,
    subject,
    structure,
    sections,
    rehooks: planRehooks(arr),
    end_card_bars: END_CARD_BARS,
    shot_bars: [...SHOT_BARS],
    kp: { ...KP_RANGE[seconds] },
  }
}
const HAN = /\p{Script=Han}/u
/** Budget units of a text: CJK scripts count characters (and digits); others count words. */
export function countUnits(text, lang) {
  const s = String(text ?? '')
  if (isCjkLang(lang)) {
    let n = 0
    for (const ch of s) if (HAN.test(ch) || /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}0-9]/u.test(ch)) n++
    return n
  }
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}
/** Languages written without spaces between words (caption budget in characters). */
export const isCjkLang = (lang) => /^(zh|ja|yue|wuu|lzh)(-|$)/i.test(String(lang ?? ''))
