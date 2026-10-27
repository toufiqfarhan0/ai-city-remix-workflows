// Static guard for Agent-written scene code (scenes/<name>.js). Pure.
//   network       no fetch / XHR / WebSocket / EventSource / workers / beacons / dynamic import, no URLs
//   determinism   no Math.random, Date, performance, timers or animation frames (frame(t) only)
//   sandbox       no eval / Function constructor, no DOM or storage access, no <script> injection
//   contract      the file registers scene('<name>', function (g, s) { … }) for its own name
// The composition additionally shadows these globals at run time and sets connect-src 'none'.
export const SCAN_SCHEMA = 'chronicle-scan/1'
export const SCENE_MAX_BYTES = 200_000
export const BANNED = Object.freeze([
  { id: 'network', re: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|SharedWorker|Worker|RTCPeerConnection)\b/ },
  { id: 'network', re: /\bimport\s*\(|^\s*import\s|\brequire\s*\(/m },
  { id: 'network', re: /\b(?:https?|wss?|ftp):\/\/|\/\/[a-z0-9-]+\.[a-z]{2,}\//i },
  { id: 'determinism', re: /\bMath\s*\.\s*random\b|\bDate\b|\bperformance\b|\bcrypto\b/ },
  { id: 'determinism', re: /\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\b/ },
  { id: 'sandbox', re: /\beval\s*\(|\bFunction\s*\(|\bnew\s+Function\b/ },
  { id: 'sandbox', re: /\b(document|localStorage|sessionStorage|indexedDB|caches|location|navigator|parent|top|opener)\s*[.[]/ },
  { id: 'sandbox', re: /\bwindow\s*\.\s*(?!CI_KIT\b)/ },
  { id: 'sandbox', re: /<\s*\/?\s*script/i },
  { id: 'sandbox', re: /\b(Image|Audio|Video)\s*\(/ },
])
/** Removes comments and string contents (so words inside text and comments are not flagged), keeping URL-like strings. */
function codeOnly(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
}
/**
 * Scans one scene file.
 * @returns {{ name: string, ok: boolean, problems: { id: string, match: string, line: number }[], registers: string[] }}
 */
export function scanScene(name, code) {
  const problems = []
  const src = String(code ?? '')
  if (Buffer.byteLength(src) > SCENE_MAX_BYTES) problems.push({ id: 'size', match: `${Buffer.byteLength(src)} bytes`, line: 0 })
  const body = codeOnly(src)
  for (const rule of BANNED) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`)
    for (const m of body.matchAll(re)) problems.push({ id: rule.id, match: m[0].trim().slice(0, 40), line: body.slice(0, m.index).split('\n').length })
  }
  const registers = [...body.matchAll(/\bscene\s*\(\s*(['"])([a-z][a-z0-9-]{0,47})\1/g)].map((m) => m[2])
  if (!registers.includes(name)) problems.push({ id: 'contract', match: `scene('${name}', …) missing`, line: 0 })
  for (const r of registers) if (r !== name) problems.push({ id: 'contract', match: `registers '${r}'`, line: 0 })
  return { name, ok: problems.length === 0, problems, registers }
}
