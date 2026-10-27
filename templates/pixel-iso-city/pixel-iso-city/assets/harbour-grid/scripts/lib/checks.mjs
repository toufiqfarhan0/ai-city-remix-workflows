// Static checks of the single-file build. Imports nothing, runs in Node 18+ and in browsers, and is
// copied verbatim by the hosting side, so keep it self-contained. Each function returns the ids of
// the failed rules (an empty array means pass).

export const CHECKS_VERSION = 1

/**
 * Empties every <script>…</script> and <style>…</style> body (the tags stay) and removes every HTML
 * comment outside those bodies. Scanned left to right, so a comment that mentions <script> or a
 * script that mentions <!-- cannot confuse the other. The build escapes `</script` / `<!--` inside
 * script bodies, so the first closing tag after an opening tag is the real one.
 */
export function stripBodies(html) {
  let out = ''
  let i = 0
  const lower = html.toLowerCase()
  while (i < html.length) {
    const c = lower.indexOf('<!--', i)
    const s = lower.indexOf('<script', i)
    const t = lower.indexOf('<style', i)
    const next = [c, s, t].filter((n) => n >= 0)
    if (!next.length) {
      out += html.slice(i)
      break
    }
    const at = Math.min(...next)
    out += html.slice(i, at)
    if (at === c) {
      const end = lower.indexOf('-->', at + 4)
      i = end < 0 ? html.length : end + 3
      continue
    }
    const name = at === s ? 'script' : 'style'
    const open = lower.indexOf('>', at)
    if (open < 0) {
      out += html.slice(at)
      break
    }
    const close = lower.indexOf(`</${name}`, open + 1)
    out += html.slice(at, open + 1)
    if (close < 0) break
    const closeEnd = lower.indexOf('>', close)
    out += html.slice(close, closeEnd < 0 ? html.length : closeEnd + 1)
    i = closeEnd < 0 ? html.length : closeEnd + 1
  }
  return out
}

function firstBytes(text, n) {
  const bytes = new TextEncoder().encode(text)
  return new TextDecoder().decode(bytes.subarray(0, n))
}

/** Markup rules, run on stripBodies(html) (charset-early runs on the raw first 1024 bytes). */
export function markupChecks(html) {
  const failed = []
  const m = stripBodies(html)
  if (!/^\s*<!doctype html>/i.test(m)) failed.push('doctype')
  const scripts = m.match(/<script\b[^>]*>/gi) ?? []
  if (scripts.length !== 1 || !/\btype\s*=\s*["']?module["']?/i.test(scripts[0]) || /\ssrc\s*=/i.test(scripts[0])) failed.push('one-module-script')
  if (/\s(src|href|srcset|action|poster)\s*=\s*["']?\s*(https?:|\/\/)/i.test(m)) failed.push('no-external-attr')
  if (/<(iframe|object|embed|base)\b/i.test(m) || /<link\b[^>]*rel\s*=\s*["']?(stylesheet|preload|modulepreload)/i.test(m)) failed.push('no-embed-tags')
  if (!/<html\b[^>]*\slang\s*=\s*["']en["']/i.test(m)) failed.push('lang-en')
  if (!/<meta\s+charset=["']?utf-8/i.test(firstBytes(html, 1024))) failed.push('charset-early')
  return failed
}

/** The first HTML comment after the opening <head> tag, or null. */
function firstHeadComment(html) {
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (!head) return null
  const from = head.index + head[0].length
  const start = html.indexOf('<!--', from)
  if (start < 0) return null
  const headEnd = html.toLowerCase().indexOf('</head', from)
  if (headEnd >= 0 && start > headEnd) return null
  const end = html.indexOf('-->', start + 4)
  return end < 0 ? null : html.slice(start + 4, end)
}

/**
 * Bundle rules, run on the full file. `denylist` (a RegExp) is optional: without it the
 * ip-denylist rule is skipped, not reported.
 */
export function bundleChecks(html, { denylist } = {}) {
  const failed = []
  if (/raw\.githack/i.test(html)) failed.push('no-githack')
  if (/githubusercontent/i.test(html)) failed.push('no-ghcontent')
  if (/\.hdr["'?]/i.test(html)) failed.push('no-hdr')
  if (/\.exr["'?]/i.test(html)) failed.push('no-exr')
  if (/fetch\(\s*["'`]https?:/i.test(html)) failed.push('no-remote-fetch')
  if (denylist instanceof RegExp) {
    const re = new RegExp(denylist.source, denylist.flags.replace(/[gy]/g, ''))
    if (re.test(html)) failed.push('ip-denylist')
  }
  const notes = firstHeadComment(html)
  if (notes === null || !notes.includes('Third-party notices')) failed.push('notices')
  return failed
}
