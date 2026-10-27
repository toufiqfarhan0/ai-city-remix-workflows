// robots.txt handling for public reads (design §6.2). One robots.txt per host and run, read through
// the same fetch policy as every other request; the groups `User-agent: *` and `chronicle-ink` apply,
// decided by the longest matching Allow/Disallow rule (Allow wins a tie). A robots.txt that cannot be
// read (404, network error, anything that is not 2xx) allows everything.

export const ROBOTS_AGENT = 'chronicle-ink'

/** Parses robots.txt into groups { agents: string[], rules: { allow: boolean, path: string }[] }. */
export function parseRobots(text) {
  const groups = []
  let current = null
  let lastWasAgent = false
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const field = m[1].toLowerCase()
    const value = m[2].trim()
    if (field === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (field === 'allow' || field === 'disallow') {
      // An empty Disallow allows everything and adds no rule.
      if (value === '') continue
      current.rules.push({ allow: field === 'allow', path: value })
    }
  }
  return groups
}

/** Rule path -> matcher with `*` wildcards and a trailing `$` anchor. Returns the matched length or -1. */
function ruleMatch(rulePath, path) {
  if (!rulePath.includes('*') && !rulePath.endsWith('$')) return path.startsWith(rulePath) ? rulePath.length : -1
  const anchored = rulePath.endsWith('$')
  const body = anchored ? rulePath.slice(0, -1) : rulePath
  const re = new RegExp(`^${body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}${anchored ? '$' : ''}`)
  return re.test(path) ? rulePath.length : -1
}

/** Whether `path` (path + query) may be fetched under the parsed robots groups. */
export function robotsAllows(groups, path, agent = ROBOTS_AGENT) {
  const a = agent.toLowerCase()
  const rules = groups.filter((g) => g.agents.includes('*') || g.agents.includes(a)).flatMap((g) => g.rules)
  let best = null
  for (const rule of rules) {
    const len = ruleMatch(rule.path, path)
    if (len < 0) continue
    if (!best || len > best.len || (len === best.len && rule.allow && !best.allow)) best = { len, allow: rule.allow }
  }
  return best ? best.allow : true
}

/**
 * Per-run robots cache.
 * @param {{ fetchRobots: (url: string) => Promise<{ ok: boolean, status?: number, text?: string }> }} deps
 *   `fetchRobots` reads `https://<host>/robots.txt` through the public-read policy (no robots check).
 */
export function createRobots({ fetchRobots }) {
  const cache = new Map()
  async function groupsFor(origin) {
    if (!cache.has(origin)) {
      cache.set(origin, (async () => {
        try {
          const res = await fetchRobots(`${origin}/robots.txt`)
          return res && res.ok && typeof res.text === 'string' ? parseRobots(res.text) : []
        } catch {
          return []
        }
      })())
    }
    return cache.get(origin)
  }
  return {
    /** Resolves true when the URL may be fetched. */
    async allowed(url) {
      const u = new URL(url)
      const groups = await groupsFor(u.origin)
      return robotsAllows(groups, `${u.pathname}${u.search}`)
    },
    /** Number of hosts whose robots.txt has been requested (for tests and logs). */
    get hosts() {
      return [...cache.keys()]
    },
  }
}
