// Public-read policy for keyless sources (design §6.2). Every request made by the research stage goes
// through createFetcher(): GET only; https only (http is rewritten to https, never a plaintext
// fallback); 20 s timeout; 2 MiB body cap; at most 3 manual redirects, each hop re-checked for private
// addresses and re-tiered; the host is resolved before every request and any loopback, private,
// link-local, CGNAT, ULA or unspecified address is refused; fixed User-Agent; ≥ 1 s between two requests
// to the same host; credentials omitted and no Authorization or Cookie header. This module never reads
// environment variables: fetch, DNS lookup, clock and sleep are injected (defaults are Node's).
//
// Failures do not throw: get() resolves { ok: false, code, warning } and the warning is also pushed to
// fetcher.warnings, so one bad source never stops the research stage.
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { ENGINE_VERSION } from '../version.mjs'
import { createRobots } from './robots.mjs'
import { classifyUrl } from './tiers.mjs'

export const FETCH_TIMEOUT_MS = 20_000
export const FETCH_MAX_BYTES = 2 * 1024 * 1024
export const FETCH_MAX_REDIRECTS = 3
export const HOST_SPACING_MS = 1_000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const TEXT_TYPES = /^(?:text\/|application\/(?:json|[\w.+-]*\+json|xml|xhtml\+xml|[\w.+-]*\+xml)\b)/i

/** The User-Agent required by Wikimedia: `chronicle-ink/<version> (+https://www.sandbase.ai/lab/chronicle-ink)`. */
export const userAgent = (version = ENGINE_VERSION) => `chronicle-ink/${version} (+https://www.sandbase.ai/lab/chronicle-ink)`

function ipv4Parts(address) {
  const parts = address.split('.').map(Number)
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null
}

function blockedV4([a, b]) {
  return a === 0 // unspecified / "this network"
    || a === 10 // private
    || a === 127 // loopback
    || (a === 169 && b === 254) // link-local
    || (a === 172 && b >= 16 && b <= 31) // private
    || (a === 192 && b === 168) // private
    || (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64.0.0/10
    || a >= 224 // multicast, reserved, broadcast
}

/** Expands an IPv6 address to 8 16-bit groups (supports `::` and an embedded IPv4 tail). */
function ipv6Groups(address) {
  let s = address.toLowerCase().split('%')[0]
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const p = ipv4Parts(v4[1])
    if (!p) return null
    s = `${s.slice(0, -v4[1].length)}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0
  const groups = [...head, ...Array(Math.max(fill, 0)).fill('0'), ...tail].map((g) => parseInt(g, 16))
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null
}

/**
 * True for addresses a public read must never reach: loopback, private, link-local, CGNAT
 * (100.64/10), ULA (fc00::/7), unspecified, multicast; IPv4-mapped IPv6 is checked as IPv4.
 * Anything that is not a valid IP address is treated as blocked.
 */
export function isBlockedAddress(address) {
  const a = String(address ?? '').replace(/^\[|\]$/g, '')
  const family = isIP(a)
  if (family === 4) return blockedV4(ipv4Parts(a))
  if (family !== 6) return true
  const g = ipv6Groups(a)
  if (!g) return true
  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return blockedV4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]) // ::ffff:a.b.c.d
  if ((g[0] & 0xfe00) === 0xfc00) return true // ULA fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true // multicast
  return false
}

const defaultLookup = (host) => dnsLookup(host, { all: true, verbatim: true })
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {object} [deps]
 * @param {typeof fetch} [deps.fetch]
 * @param {(host: string) => Promise<{ address: string, family?: number }[]>} [deps.lookup]
 * @param {() => number} [deps.now]       milliseconds clock used for per-host spacing
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 * @param {string} [deps.version]         version in the User-Agent
 * @param {number} [deps.timeoutMs]
 * @param {number} [deps.maxBytes]
 */
export function createFetcher({ fetch = globalThis.fetch, lookup = defaultLookup, now = Date.now, sleep = defaultSleep, version = ENGINE_VERSION, timeoutMs = FETCH_TIMEOUT_MS, maxBytes = FETCH_MAX_BYTES } = {}) {
  const warnings = []
  const lastRequest = new Map()
  const ua = userAgent(version)

  const failure = (quiet) => (code, host, extra = {}) => {
    const warning = extra.status != null ? `${code}:${extra.status}:${host}` : `${code}:${host}`
    if (!quiet) warnings.push(warning)
    return { ok: false, code, warning, ...extra }
  }

  async function addressCheck(host) {
    const bare = host.replace(/^\[|\]$/g, '')
    if (isIP(bare)) return isBlockedAddress(bare) ? 'blocked' : 'ok'
    let addrs
    try {
      addrs = await lookup(bare)
    } catch {
      return 'unresolved'
    }
    const list = Array.isArray(addrs) ? addrs : [addrs]
    if (!list.length) return 'unresolved'
    return list.some((r) => isBlockedAddress(typeof r === 'string' ? r : r?.address)) ? 'blocked' : 'ok'
  }

  async function spacing(host) {
    const last = lastRequest.get(host)
    if (last != null) {
      const wait = last + HOST_SPACING_MS - now()
      if (wait > 0) await sleep(wait)
    }
    lastRequest.set(host, now())
  }

  /** Reads the body up to maxBytes; returns null when the cap is exceeded (the stream is cancelled). */
  async function readCapped(res) {
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      try { await res.body?.cancel() } catch { /* ignore */ }
      return null
    }
    if (!res.body) return Buffer.alloc(0)
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        try { await reader.cancel() } catch { /* ignore */ }
        return null
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
    }
    return Buffer.concat(chunks, total)
  }

  /** One network request (no redirect handling). */
  async function send(url, headers) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    timer.unref?.()
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', credentials: 'omit', headers, signal: controller.signal })
      if (REDIRECT_STATUSES.has(res.status)) {
        try { await res.body?.cancel() } catch { /* ignore */ }
        return { res, body: null }
      }
      if (res.status < 200 || res.status > 299) {
        try { await res.body?.cancel() } catch { /* ignore */ }
        return { res, body: null }
      }
      return { res, body: await readCapped(res), capped: true }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * GET a public URL under the policy.
   * @param {string} input
   * @param {{ acceptLanguage?: string, accept?: string, robots?: boolean, quiet?: boolean }} [options]
   *   `robots: false` skips the robots.txt check (robots.txt itself, and documented APIs, see wikidata.mjs);
   *   `quiet` keeps a failure out of `warnings`.
   */
  async function get(input, { acceptLanguage, accept, robots: checkRobots = true, quiet = false } = {}) {
    const fail = failure(quiet)
    let url
    try {
      url = new URL(String(input))
    } catch {
      return fail('fetch_invalid_url', String(input))
    }
    const hops = []
    for (let redirects = 0; ; redirects++) {
      if (url.protocol === 'http:') url.protocol = 'https:'
      if (url.protocol !== 'https:') return fail('fetch_scheme', url.protocol.replace(/:$/, ''), { url: String(input), hops })
      if (url.username || url.password) return fail('fetch_invalid_url', url.hostname, { url: String(input), hops })
      url.hash = ''
      const host = url.hostname.toLowerCase()
      const href = url.href
      const tier = classifyUrl(href)
      hops.push({ url: href, tier: tier.tier, publisher: tier.publisher })
      const check = await addressCheck(host)
      if (check === 'blocked') return fail('fetch_blocked_private', host, { url: String(input), hops })
      if (check !== 'ok') return fail('fetch_failed', host, { url: String(input), hops })
      if (checkRobots && !(await robotsCache.allowed(href))) return fail('robots_disallowed', host, { url: String(input), hops })
      await spacing(host)
      const headers = { 'User-Agent': ua, Accept: accept ?? 'text/html,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5' }
      if (acceptLanguage) headers['Accept-Language'] = acceptLanguage
      let out
      try {
        out = await send(href, headers)
      } catch (e) {
        return fail(e?.name === 'AbortError' ? 'fetch_timeout' : 'fetch_failed', host, { url: String(input), hops })
      }
      const { res, body } = out
      hops[hops.length - 1].status = res.status
      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get('location')
        if (!location) return fail('fetch_http', host, { url: String(input), hops, status: res.status })
        if (redirects + 1 > FETCH_MAX_REDIRECTS) return fail('fetch_redirects', host, { url: String(input), hops })
        try {
          url = new URL(location, href)
        } catch {
          return fail('fetch_invalid_url', host, { url: String(input), hops })
        }
        continue
      }
      if (res.status < 200 || res.status > 299) return fail('fetch_http', host, { url: String(input), hops, status: res.status })
      if (body == null) return fail('fetch_too_large', host, { url: String(input), hops })
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType && !TEXT_TYPES.test(contentType)) return fail('fetch_not_text', host, { url: String(input), hops })
      return {
        ok: true,
        url: String(input),
        final_url: href,
        status: res.status,
        content_type: contentType,
        bytes: body.length,
        text: new TextDecoder('utf-8').decode(body),
        tier: tier.tier,
        publisher: tier.publisher,
        ...(tier.reason ? { reason: tier.reason } : {}),
        hops,
      }
    }
  }

  const robotsCache = createRobots({ fetchRobots: (u) => get(u, { robots: false, quiet: true, accept: 'text/plain,*/*;q=0.5' }) })

  return { get, warnings, robots: robotsCache }
}
