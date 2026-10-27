// Font coverage for the glyph check: code points a bundled font maps to a real glyph.
// The TrueType cmap reader shares code with skills/sketchbook-film/src/stage/cmap.mjs (same repo); WOFF2
// files are unpacked with Node's built-in Brotli (cmap is never transformed in WOFF2). No dependencies.
import { readFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'

const PREFERENCE = [
  [3, 10, 12], [0, 6, 12], [0, 4, 12], // full Unicode
  [3, 1, 4], [0, 3, 4], [0, 2, 4], [0, 1, 4], [0, 0, 4], // BMP
]

function tableOffset(view, tag) {
  const count = view.getUint16(4)
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16
    const name = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3))
    if (name === tag) return view.getUint32(rec + 8)
  }
  return -1
}

function format4(view, at, out) {
  const segX2 = view.getUint16(at + 6)
  const ends = at + 14
  const starts = ends + segX2 + 2
  const deltas = starts + segX2
  const ranges = deltas + segX2
  for (let s = 0; s < segX2; s += 2) {
    const end = view.getUint16(ends + s)
    const start = view.getUint16(starts + s)
    const delta = view.getInt16(deltas + s)
    const range = view.getUint16(ranges + s)
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph
      if (range === 0) glyph = (c + delta) & 0xffff
      else {
        const raw = view.getUint16(ranges + s + range + (c - start) * 2)
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff
      }
      if (glyph !== 0) out.add(c)
    }
  }
}

function format12(view, at, out) {
  const groups = view.getUint32(at + 12)
  for (let g = 0; g < groups; g++) {
    const rec = at + 16 + g * 12
    const start = view.getUint32(rec)
    const end = view.getUint32(rec + 4)
    const glyph = view.getUint32(rec + 8)
    for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c)
  }
}
/** Sorted code points of the preferred Unicode cmap subtable of an sfnt (TTF/OTF) buffer. */
export function sfntCodepoints(bytes) {
  const buf = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const cmap = tableOffset(view, 'cmap')
  if (cmap < 0) throw new Error('font has no cmap table')
  return cmapCodepoints(view, cmap)
}
function cmapCodepoints(view, cmap) {
  const subtables = []
  const n = view.getUint16(cmap + 2)
  for (let i = 0; i < n; i++) {
    const rec = cmap + 4 + i * 8
    const at = cmap + view.getUint32(rec + 4)
    subtables.push({ platform: view.getUint16(rec), encoding: view.getUint16(rec + 2), format: view.getUint16(at), at })
  }
  for (const [platform, encoding, format] of PREFERENCE) {
    const st = subtables.find((s) => s.platform === platform && s.encoding === encoding && s.format === format)
    if (!st) continue
    const out = new Set()
    if (format === 4) format4(view, st.at, out)
    else format12(view, st.at, out)
    return [...out].sort((a, b) => a - b)
  }
  throw new Error('font has no Unicode cmap subtable in format 4 or 12')
}
const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']
function base128(view, pos) {
  let v = 0
  for (let i = 0; i < 5; i++) {
    const b = view.getUint8(pos.at++)
    v = (v << 7) | (b & 0x7f)
    if (!(b & 0x80)) return v >>> 0
  }
  throw new Error('woff2: bad UIntBase128')
}
/** Sorted code points of a WOFF2 font (table directory -> Brotli stream -> cmap). */
export function woff2Codepoints(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0) !== 0x774f4632) throw new Error('not a woff2 font')
  const numTables = view.getUint16(12)
  const compressedLength = view.getUint32(20)
  const pos = { at: 48 }
  let offset = 0
  let cmap = null
  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(pos.at++)
    const known = flags & 0x3f
    let tag
    if (known === 63) {
      tag = String.fromCharCode(view.getUint8(pos.at), view.getUint8(pos.at + 1), view.getUint8(pos.at + 2), view.getUint8(pos.at + 3))
      pos.at += 4
    } else tag = WOFF2_TAGS[known]
    const transform = (flags >> 6) & 3
    const origLength = base128(view, pos)
    let length = origLength
    const transformed = (tag === 'glyf' || tag === 'loca') ? transform === 0 : transform !== 0
    if (transformed) length = base128(view, pos)
    if (tag === 'cmap') cmap = { offset, length }
    offset += length
  }
  if (!cmap) throw new Error('woff2: no cmap')
  const data = brotliDecompressSync(bytes.subarray(pos.at, pos.at + compressedLength))
  const table = data.subarray(cmap.offset, cmap.offset + cmap.length)
  return cmapCodepoints(new DataView(table.buffer, table.byteOffset, table.byteLength), 0)
}
/** Code points of a font file (TTF/OTF or WOFF2). */
export function fontCodepoints(file) {
  const bytes = readFileSync(file)
  return bytes.readUInt32BE(0) === 0x774f4632 ? woff2Codepoints(bytes) : sfntCodepoints(bytes)
}
/** Code points that never need a glyph (whitespace, joiners, bidi and variation controls). */
export const IGNORABLE = (cp) => cp <= 0x20 || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x00a0 || cp === 0x3000
/**
 * Missing glyphs of `texts` against a coverage set: [{ char, cp, text }] (each code point once).
 * @param {string[]} texts
 * @param {Set<number>} covered
 */
export function missingGlyphs(texts, covered) {
  const out = []
  const seen = new Set()
  for (const text of texts) {
    for (const ch of String(text ?? '')) {
      const cp = ch.codePointAt(0)
      if (IGNORABLE(cp) || covered.has(cp) || seen.has(cp)) continue
      seen.add(cp)
      out.push({ char: ch, cp: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, text: String(text).slice(0, 40) })
    }
  }
  return out
}
