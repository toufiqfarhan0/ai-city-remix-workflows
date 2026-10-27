// A 5×7 pixel font for road signs, so every street and landmark name is lettered exactly, pixel for pixel.
// Each glyph is seven rows of five bits (bit 4 = left column). Accented letters fold to their base letter;
// characters without a glyph become a space. Names are written in capitals, as on real signs.

const G = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '-': [0, 0, 0, 14, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
  '&': [12, 18, 20, 8, 21, 18, 13], '+': [0, 4, 4, 31, 4, 4, 0], '>': [8, 4, 2, 1, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2], '^': [4, 10, 17, 0, 0, 0, 0],
}

export const GLYPH_W = 5
export const GLYPH_H = 7

/** Upper-case ASCII the font can draw. */
export function signText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 \-.,'/()&+:<>^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Width in font pixels of a single line (1 px between glyphs). */
export function textWidth(text) {
  return text.length ? text.length * (GLYPH_W + 1) - 1 : 0
}

/**
 * Lays out text into at most `maxLines` lines no wider than `maxWidth` font pixels.
 * Returns { lines, width, height } in font pixels.
 */
export function layout(text, maxWidth = 120, maxLines = 2) {
  const words = signText(text).split(' ').filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (textWidth(next) <= maxWidth || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = lines[maxLines - 1]
    while (last.length > 1 && textWidth(`${last}.`) > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trimEnd()}.`
  }
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    while (l.length > 1 && textWidth(l) > maxWidth) l = l.slice(0, -1)
    lines[i] = l
  }
  const width = Math.max(0, ...lines.map(textWidth))
  return { lines, width, height: lines.length ? lines.length * (GLYPH_H + 2) - 2 : 0 }
}

/** Whether font pixel (px, py) of a laid-out block is ink. Lines are centred. */
export function inkAt(block, px, py) {
  const line = Math.floor(py / (GLYPH_H + 2))
  const ly = py - line * (GLYPH_H + 2)
  if (line < 0 || line >= block.lines.length || ly >= GLYPH_H || ly < 0) return false
  const text = block.lines[line]
  const off = Math.floor((block.width - textWidth(text)) / 2)
  const lx = px - off
  if (lx < 0) return false
  const gi = Math.floor(lx / (GLYPH_W + 1))
  const gx = lx - gi * (GLYPH_W + 1)
  if (gi >= text.length || gx >= GLYPH_W) return false
  const g = G[text[gi]] ?? G[' ']
  return ((g[ly] >> (GLYPH_W - 1 - gx)) & 1) === 1
}
