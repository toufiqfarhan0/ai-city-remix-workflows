// International caption layout. Pure.
//   budget     CJK scripts (zh, ja, yue): about 16 characters per line (ASCII counts 0.5);
//              space-delimited scripts: at most 9 words and 42 characters per line; at most 2 lines
//   breaking   CJK at character boundaries with kinsoku (no line starts with closing punctuation, no
//              line ends with an opening bracket); others at spaces only. Never inside a number or a
//              date: digit runs are glued to a date unit (年月日岁 / 世纪) and, in spaced scripts, to the
//              neighbouring word ("8 January 1037", "in 1079"). Two lines are balanced.
//   direction  rtl when the first strong character is Arabic, Hebrew, Syriac or Thaana
//   reading    hold seconds ≥ max(min_hold_s, units / rate): CJK 7 characters/s, others 3.3 words/s
import { countUnits, isCjkLang } from '../story/beatsheet.mjs'
export const BUDGET = Object.freeze({ cjk: Object.freeze({ chars_per_line: 16 }), spaced: Object.freeze({ words_per_line: 9, chars_per_line: 42 }), max_lines: 2 })
export const READING_RATE = Object.freeze({ cjk: 7, spaced: 3.3 })
export const NO_LINE_START = '，。！？、：；」』）》…,.!?;:)]}”’〉】〕%'
export const NO_LINE_END = '「『（《“‘([{〈【〔'
const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u
const LTR = /[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff]/u
const DATE_UNIT_ZH = /^(年|月|日|岁|世纪|年代|号)/u
/** Text direction from the first strong character. */
export function textDirection(text) {
  for (const ch of String(text ?? '')) {
    if (RTL.test(ch)) return 'rtl'
    if (LTR.test(ch)) return 'ltr'
  }
  return 'ltr'
}
/** Display width: CJK counts full-width 1 and ASCII 0.5; spaced scripts count characters. */
export function textWidth(text, lang) {
  let w = 0
  for (const ch of String(text ?? '')) w += isCjkLang(lang) ? (ch.codePointAt(0) < 0x80 ? 0.5 : 1) : 1
  return w
}
/** Caption budget of a language: { cjk, perLine, wordsPerLine, maxLines }. */
export function budgetFor(lang, style = {}) {
  const b = { ...BUDGET, ...(style.budget ?? {}) }
  if (isCjkLang(lang)) return { cjk: true, perLine: b.cjk.chars_per_line, wordsPerLine: Infinity, maxLines: b.max_lines }
  return { cjk: false, perLine: b.spaced.chars_per_line, wordsPerLine: b.spaced.words_per_line, maxLines: b.max_lines }
}
/**
 * Unbreakable chunks of a caption, in order: { text, words } (words = budget words in the chunk).
 * The line text is chunks joined by '' (CJK) or ' ' (spaced).
 */
export function chunks(text, lang) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return []
  if (isCjkLang(lang)) {
    const out = []
    const chars = [...s]
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]
      // Latin / digit runs (with inner . , : -) stay one chunk.
      if (/[A-Za-z0-9]/.test(ch)) {
        let run = ch
        while (i + 1 < chars.length && /[A-Za-z0-9.,:\-]/.test(chars[i + 1]) && !(/[.,:]/.test(chars[i + 1]) && !/[A-Za-z0-9]/.test(chars[i + 2] ?? ''))) run += chars[++i]
        const rest = chars.slice(i + 1).join('')
        const unit = /^\d/.test(run) ? DATE_UNIT_ZH.exec(rest) : null
        if (unit) { run += unit[0]; i += [...unit[0]].length }
        out.push({ text: run })
        continue
      }
      if (ch === ' ') { out.push({ text: ' ' }); continue }
      out.push({ text: ch })
    }
    // Kinsoku: glue closing punctuation to the previous chunk and opening brackets to the next.
    const glued = []
    for (const c of out) {
      if (glued.length && NO_LINE_START.includes([...c.text][0])) glued[glued.length - 1].text += c.text
      else if (glued.length && NO_LINE_END.includes([...glued[glued.length - 1].text].pop())) glued[glued.length - 1].text += c.text
      else glued.push({ ...c })
    }
    // A digit chunk also glues to a following date chunk that is digits (e.g. "1037年1月8日").
    const merged = []
    for (const c of glued) {
      const prev = merged[merged.length - 1]
      if (prev && /\d[年月]$/u.test(prev.text) && /^\d/.test(c.text)) prev.text += c.text
      else merged.push(c)
    }
    return merged.filter((c) => c.text !== ' ').map((c) => ({ text: c.text, words: countUnits(c.text, lang) }))
  }
  const words = s.split(' ').map((w) => ({ text: w, words: /[\p{L}\p{N}]/u.test(w) ? 1 : 0 }))
  const numeric = (w) => /\d/.test(w.text)
  const out = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const prev = out[out.length - 1]
    const glue = prev && (numeric(w) || prev.lastNumeric) && [...w.text].length <= 12 && [...prev.text.split(' ').pop()].length <= 12
    if (glue) {
      prev.text += ` ${w.text}`
      prev.words += w.words
      prev.lastNumeric = numeric(w)
    } else out.push({ text: w.text, words: w.words, lastNumeric: numeric(w) })
  }
  return out.map(({ text: t, words: n }) => ({ text: t, words: n }))
}
const CLAUSE_END = /[，：；、,:;—]$/u
const join = (cs, lang) => cs.map((c) => c.text).join(isCjkLang(lang) ? '' : ' ')
/**
 * Lays a caption out.
 * @returns {{ lines: string[], dir: 'ltr'|'rtl', units: number, ok: boolean, reason?: string }}
 */
export function layoutCaption(text, lang, style = {}) {
  const b = budgetFor(lang, style)
  const cs = chunks(text, lang)
  const dir = textDirection(text)
  const units = countUnits(text, lang)
  const fits = (part) => {
    const line = join(part, lang)
    return textWidth(line, lang) <= b.perLine + 1e-9 && part.reduce((n, c) => n + c.words, 0) <= b.wordsPerLine
  }
  if (!cs.length) return { lines: [], dir, units, ok: false, reason: 'empty' }
  if (fits(cs)) return { lines: [join(cs, lang)], dir, units, ok: true }
  if (b.maxLines < 2) return { lines: [join(cs, lang)], dir, units, ok: false, reason: 'too_long' }
  // Best balanced two-line break; a break right after a clause mark (，：；、 , : ;) is strongly
  // preferred so a line never splits a phrase like 需要一 / 圈 when a comma is available.
  let best = null
  for (let k = 1; k < cs.length; k++) {
    const a = cs.slice(0, k)
    const z = cs.slice(k)
    if (!fits(a) || !fits(z)) continue
    const clause = CLAUSE_END.test(join(a, lang))
    const score = Math.abs(textWidth(join(a, lang), lang) - textWidth(join(z, lang), lang)) + (textWidth(join(a, lang), lang) < textWidth(join(z, lang), lang) ? 0.5 : 0) + (clause ? 0 : 20)
    if (!best || score < best.score) best = { score, k }
  }
  if (!best) return { lines: [join(cs, lang)], dir, units, ok: false, reason: 'too_long' }
  return { lines: [join(cs.slice(0, best.k), lang), join(cs.slice(best.k), lang)], dir, units, ok: true }
}
/** Minimum hold seconds for a caption: max(minHold, units / reading rate). */
export function minHoldSeconds(text, lang, minHold = 1.6) {
  return Math.max(minHold, countUnits(text, lang) / (isCjkLang(lang) ? READING_RATE.cjk : READING_RATE.spaced))
}
const vttTime = (t) => {
  const ms = Math.round(t * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
/** WebVTT of caption blocks [{ start, end, lines }]. */
export function toVtt(blocks) {
  return `WEBVTT\n\n${blocks.map((b, i) => `${i + 1}\n${vttTime(b.start)} --> ${vttTime(b.end)}\n${b.lines.join('\n')}\n`).join('\n')}`
}
