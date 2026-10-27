// Removes credentials and inline payloads from anything that may reach a log, an error or a report.
// Dependency-free.

const PATTERNS = [
  [/data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]*/g, 'data:[omitted]'],
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  [/\bsk-[A-Za-z0-9_-]{6,}/g, '[redacted]'],
  [/\bsb_[A-Za-z0-9_-]{6,}/g, '[redacted]'],
]

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Redacts a string. The live SANDBASE_API_KEY value (if any) is removed wherever it appears. */
export function redactText(text, env = process.env) {
  let out = String(text)
  const live = env?.SANDBASE_API_KEY
  if (typeof live === 'string' && live.length >= 8) out = out.replace(new RegExp(escape(live), 'g'), '[redacted]')
  for (const [re, sub] of PATTERNS) out = out.replace(re, sub)
  return out
}

/** Deep-redacts strings, arrays, plain objects and Error instances (returns copies). */
export function redact(value, env = process.env) {
  if (typeof value === 'string') return redactText(value, env)
  if (value instanceof Error) {
    const e = new Error(redactText(value.message, env))
    e.name = value.name
    if (value.stack) e.stack = redactText(value.stack, env)
    for (const k of ['code', 'exit']) if (value[k] != null) e[k] = value[k]
    if (value.details) e.details = redact(value.details, env)
    return e
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, env))
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, env)]))
  return value
}

/** The last `n` lines of a process output, redacted (for error details). */
export function redactTail(text, n = 20, env = process.env) {
  return redactText(String(text ?? '').split(/\r?\n/).filter(Boolean).slice(-n).join('\n'), env)
}
