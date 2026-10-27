// Canonical JSON (keys sorted at every level) and sha256 helpers. Used for input hashes, job keys
// and content hashes, so the output must not depend on key insertion order.
import { createHash } from 'node:crypto'

function sortValue(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof value.toJSON === 'function') return sortValue(value.toJSON())
  if (Array.isArray(value)) return value.map((v) => (v === undefined || typeof v === 'function' ? null : sortValue(v)))
  const out = {}
  for (const key of Object.keys(value).sort()) {
    const v = value[key]
    if (v === undefined || typeof v === 'function') continue
    out[key] = sortValue(v)
  }
  return out
}

/**
 * JSON with keys sorted (code-unit order). Same value rules as JSON.stringify (undefined members
 * dropped, undefined array items -> null). Non-finite numbers are rejected instead of becoming null.
 * @param {*} value
 * @param {{ indent?: number }} [options] indent > 0 gives a readable form with a trailing newline
 */
export function canonicalJson(value, { indent = 0 } = {}) {
  const text = JSON.stringify(sortValue(value), (key, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new TypeError(`non-finite number at "${key}"`)
    return v
  }, indent || undefined)
  if (text === undefined) throw new TypeError('value is not representable as JSON')
  return indent ? `${text}\n` : text
}

/** sha256 hex of a string (UTF-8) or Buffer/Uint8Array. */
export function sha256(data) {
  return createHash('sha256').update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data).digest('hex')
}

/** sha256 hex of the compact canonical JSON of `value`. */
export function sha256Json(value) {
  return sha256(canonicalJson(value))
}
