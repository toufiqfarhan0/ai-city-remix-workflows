// Project folder: paths, brief.json contract (design §4), the "project outside the Skill" rule, the
// project lock (§3.5a) and --fixture (§3.1 steps 1-4).
import { closeSync, existsSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { hostname as osHostname } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { ChronicleError } from './errors.mjs'
import { t } from './i18n.mjs'
import { createHash } from 'node:crypto'
import { STAGES, STAGE_ORDER } from './stages.mjs'
import { createStateStore, fixtureRecord, listFiles } from './state.mjs'
import { STRUCTURES, defaultStructure } from './story/templates.mjs'
import { mkdirp, writeFileAtomic, writeJsonAtomic } from './util/fsx.mjs'

export const BRIEF_FILE = 'brief.json'
export const LOCK_FILE = '.chronicle.lock'
export const LOCK_STALE_MS = 6 * 3600 * 1000

/** Project-relative locations used by the CLI. */
export function projectPaths(projectDir) {
  const root = resolve(projectDir)
  return {
    root,
    brief: join(root, BRIEF_FILE),
    state: join(root, 'state.json'),
    lock: join(root, LOCK_FILE),
    script: join(root, 'script.json'),
    work: join(root, 'work'),
    out: join(root, 'out'),
    cache: join(root, 'work', 'cache'),
    scenes: join(root, 'scenes'),
  }
}

/** 16-hex sha256 prefix of the host name (the lock never stores the plain name). */
export const hostHash = (name = osHostname()) => createHash('sha256').update(String(name)).digest('hex').slice(0, 16)

// ---------------------------------------------------------------- brief.json (§4)

export const BRIEF_FIELDS = Object.freeze(['topic', 'qid', 'subject', 'structure', 'angle', 'seconds', 'aspect', 'lang', 'audience', 'seed', 'style'])
export const SUBJECTS = Object.freeze(['person', 'landmark', 'animal', 'city'])
export const SECONDS = Object.freeze([120, 150, 180])
export const ASPECTS = Object.freeze(['9:16', '16:9'])
export const AUDIENCES = Object.freeze(['general-12+', 'kids-8+'])
export const QID_RE = /^Q[1-9]\d{0,11}$/
export const BRIEF_DEFAULTS = Object.freeze({ seconds: 150, aspect: '16:9', lang: 'en', audience: 'general-12+', seed: 1 })
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
const MAX_SEED = 2 ** 31

const bad = (field, details = {}) => new ChronicleError(`brief_invalid:${field}`, 2, { field, ...details })
const chars = (s) => [...s].length

/** NFC + trim (topic comparison and storage). */
export const normalizeTopic = (s) => String(s).normalize('NFC').trim()

/**
 * Film (caption) language: any well-formed BCP-47 tag, canonicalised (`zh`, `zh-Hans`, `zh_CN` -> zh-CN).
 * `both` -> lang_both_unsupported (one film per language; share script.json between two projects).
 * An invalid tag -> en with a warning.
 */
export function briefLang(value, warn) {
  if (value == null) return 'en'
  if (typeof value === 'string' && value.trim().toLowerCase() === 'both') throw new ChronicleError('lang_both_unsupported', 2, { field: 'lang' })
  return filmLang(value, warn)
}
/** Canonical BCP-47 tag of a film language (Chinese variants without a script map to zh-CN / zh-TW). */
export function filmLang(value, warn) {
  const raw = typeof value === 'string' ? value.trim().replace(/_/g, '-') : ''
  let tag = null
  try { tag = raw ? Intl.getCanonicalLocales(raw)[0] : null } catch { tag = null }
  if (!tag) {
    warn?.(value)
    return 'en'
  }
  const low = tag.toLowerCase()
  if (low === 'zh' || low === 'zh-cn' || low === 'zh-hans' || low === 'zh-hans-cn' || low === 'zh-sg') return 'zh-CN'
  if (low === 'zh-tw' || low === 'zh-hant' || low === 'zh-hant-tw' || low === 'zh-hk') return low === 'zh-hk' ? 'zh-HK' : 'zh-TW'
  return tag
}
/**
 * Validates brief.json (design §4). Throws the first problem in field order (unknown fields first).
 * @returns {{ brief: object, warnings: string[] }} brief with NFC topic, normalised lang and defaults
 */
export function validateBrief(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('json')
  for (const k of Object.keys(raw)) if (!BRIEF_FIELDS.includes(k)) throw bad(`unknown_field:${k}`)
  const warnings = []
  const out = {}
  if (raw.qid !== undefined) {
    if (typeof raw.qid !== 'string' || !QID_RE.test(raw.qid)) throw bad('qid')
    out.qid = raw.qid
  }
  if (raw.topic !== undefined) {
    if (typeof raw.topic !== 'string') throw bad('topic')
    const topic = normalizeTopic(raw.topic)
    if (chars(topic) < 1 || chars(topic) > 60 || CONTROL.test(topic)) throw bad('topic')
    out.topic = topic
  } else if (!out.qid) throw bad('topic', { reason: 'topic_or_qid_required' })
  if (raw.subject !== undefined) {
    if (!SUBJECTS.includes(raw.subject)) throw bad('subject')
    out.subject = raw.subject
  }
  if (raw.structure !== undefined) {
    const allowed = out.subject ? STRUCTURES[out.subject] : Object.values(STRUCTURES).flat()
    if (typeof raw.structure !== 'string' || !allowed.includes(raw.structure)) throw bad('structure', { allowed })
    out.structure = raw.structure
  } else if (out.subject) out.structure = defaultStructure(out.subject)
  if (raw.angle !== undefined) {
    if (typeof raw.angle !== 'string' || chars(raw.angle.trim()) > 40 || CONTROL.test(raw.angle)) throw bad('angle')
    out.angle = raw.angle.normalize('NFC').trim()
  }
  if (raw.seconds !== undefined && !(Number.isInteger(raw.seconds) && SECONDS.includes(raw.seconds))) throw new ChronicleError('seconds_invalid', 2, { field: 'seconds', allowed: [...SECONDS], value: raw.seconds })
  out.seconds = raw.seconds ?? BRIEF_DEFAULTS.seconds
  if (raw.aspect !== undefined && !ASPECTS.includes(raw.aspect)) throw bad('aspect')
  out.aspect = raw.aspect ?? BRIEF_DEFAULTS.aspect
  out.lang = briefLang(raw.lang, (v) => warnings.push(`brief_lang_invalid:${String(v)}`))
  if (raw.audience !== undefined && !AUDIENCES.includes(raw.audience)) throw bad('audience')
  out.audience = raw.audience ?? BRIEF_DEFAULTS.audience
  if (raw.seed !== undefined && !(Number.isInteger(raw.seed) && raw.seed >= 0 && raw.seed < MAX_SEED)) throw bad('seed')
  out.seed = raw.seed ?? BRIEF_DEFAULTS.seed
  if (raw.style !== undefined) {
    if (typeof raw.style !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(raw.style)) throw bad('style')
    out.style = raw.style
  }
  return { brief: out, warnings }
}

/** Reads and validates <project>/brief.json. @returns {{ raw, brief, warnings }} */
export function loadBrief(projectDir) {
  const path = join(projectDir, BRIEF_FILE)
  if (!existsSync(path)) throw bad('file', { reason: 'missing' })
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw bad('json')
  }
  return { raw, ...validateBrief(raw) }
}

/** Whether an error is the "neither topic nor qid" brief error (a new-project default brief). */
export const isTopicMissing = (e) => e?.code === 'brief_invalid:topic' && e.details?.reason === 'topic_or_qid_required'

/**
 * loadBrief for --fixture: a brief without topic and qid (new-project default) is accepted because the
 * fixture supplies both; the returned brief then has topic and qid null. Every other error is thrown.
 */
export function loadBriefForFixture(projectDir, fixtureBrief) {
  try {
    return loadBrief(projectDir)
  } catch (e) {
    if (!isTopicMissing(e)) throw e
    const raw = JSON.parse(readFileSync(join(projectDir, BRIEF_FILE), 'utf8'))
    const { brief, warnings } = validateBrief({ ...raw, ...(fixtureBrief.qid ? { qid: fixtureBrief.qid } : { topic: fixtureBrief.topic }) })
    return { raw, brief: { ...brief, topic: null, qid: null }, warnings }
  }
}

// ---------------------------------------------------------------- project outside the Skill

/** realpath of `p`, resolving through the nearest existing ancestor when `p` does not exist yet. */
function realish(p) {
  const abs = resolve(p)
  let base = abs
  const rest = []
  while (!existsSync(base)) {
    const up = dirname(base)
    if (up === base) break
    rest.unshift(basename(base))
    base = up
  }
  return join(existsSync(base) ? realpathSync(base) : base, ...rest)
}

/** True when `child` is `parent` or inside it (symlinks resolved). */
export function isInside(child, parent) {
  const rel = relative(realish(parent), realish(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** project_inside_skill (exit 2) when the project folder is the Skill folder or inside it. */
export function assertOutsideSkill(projectDir, skillDir) {
  if (skillDir && isInside(projectDir, skillDir)) throw new ChronicleError('project_inside_skill', 2)
}

// ---------------------------------------------------------------- project lock (§3.5a)

function readLock(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function processGone(pid, kill) {
  try {
    kill(pid, 0)
    return false
  } catch (e) {
    return e?.code === 'ESRCH'
  }
}

/**
 * Takes <project>/.chronicle.lock with O_EXCL. A lock is stale when it was written on this host and its
 * pid is gone (kill(pid, 0) -> ESRCH; success or EPERM keeps it, however old), or when it comes from
 * another host and created_at is older than 6 hours; a stale lock
 * is removed and taken once more. Otherwise project_locked (exit 2, details { command, created_at }).
 * @returns {{ path: string, info: object, release(): void }}
 */
export function acquireProjectLock(projectDir, { command, now = Date.now, hostname = osHostname(), kill = process.kill.bind(process), pid = process.pid } = {}) {
  const path = join(projectDir, LOCK_FILE)
  const info = { pid, host_hash: hostHash(hostname), created_at: new Date(now()).toISOString(), command: String(command ?? '') }
  const tryCreate = () => {
    let fd
    try {
      fd = openSync(path, 'wx', 0o600)
    } catch (e) {
      if (e?.code === 'EEXIST') return false
      throw e
    }
    try {
      writeSync(fd, `${JSON.stringify(info)}\n`)
    } finally {
      closeSync(fd)
    }
    return true
  }
  let ok = tryCreate()
  if (!ok) {
    const held = readLock(path)
    let createdMs = Date.parse(held?.created_at ?? '')
    if (!Number.isFinite(createdMs)) {
      try { createdMs = statSync(path).mtimeMs } catch { createdMs = now() }
    }
    const sameHost = held && held.host_hash === info.host_hash
    // Same host with a known pid: only a dead process (ESRCH) frees the lock, whatever its age, so a
    // long-running stage is never taken over. The 6-hour rule applies to locks from other hosts.
    const stale = sameHost && Number.isInteger(held.pid)
      ? processGone(held.pid, kill)
      : now() - createdMs > LOCK_STALE_MS
    if (stale) {
      try { unlinkSync(path) } catch (e) { if (e?.code !== 'ENOENT') throw e }
      ok = tryCreate()
    }
    if (!ok) {
      const current = readLock(path) ?? held
      throw new ChronicleError('project_locked', 2, { command: current?.command ?? '?', created_at: current?.created_at ?? '?' })
    }
  }
  let released = false
  return {
    path,
    info,
    release() {
      if (released) return
      released = true
      const held = readLock(path)
      // Only remove our own lock (it may have been taken over after expiry).
      if (held && held.pid === info.pid && held.created_at === info.created_at && held.host_hash === info.host_hash) {
        try { unlinkSync(path) } catch { /* already gone */ }
      }
    },
  }
}

// ---------------------------------------------------------------- --fixture (§3.1)

/** Brief fields a fixture overrides; seed, angle and audience stay the user's. */
export const FIXTURE_FIELDS = Object.freeze(['qid', 'topic', 'subject', 'structure', 'seconds', 'lang', 'aspect'])

/**
 * Fixture file -> project path and the stage it belongs to (the stage's documented output files). A
 * stage is written by --fixture only when the fixture has at least one of its files. `dir` entries copy a whole folder. The script file is
 * `script.<lang>.json` (fixture brief lang) or `script.json`.
 */
export const FIXTURE_LAYOUT = Object.freeze([
  { stage: 'research', from: 'entity.json', to: 'work/research/entity.json' },
  { stage: 'research', from: 'known-entities.json', to: 'work/research/known-entities.json' },
  { stage: 'research', from: 'sources/', to: 'work/research/sources/' },
  { stage: 'facts', from: 'claims.json', to: 'work/facts/claims.json' },
  { stage: 'facts', from: 'facts.json', to: 'work/facts/facts.json' },
  { stage: 'facts', from: 'hints.json', to: 'work/facts/hints.json' },
  { stage: 'script', from: 'script.json', to: 'script.json' },
  { stage: 'script', from: 'gate.{lang}.json', to: 'work/script/gate.json' },
  { stage: 'script', from: 'entail.{lang}.json', to: 'work/script/entail.agent.json' },
  { stage: 'script', from: 'claim-lines.json', to: 'work/script/claim-lines.json' },
  { stage: 'script', from: 'plan.json', to: 'work/script/plan.json' },
  // Scene code of the sample (inputs of the scenes stage; copied, recorded with the script stage).
  { stage: 'script', from: 'scenes/', to: 'scenes/' },
].map(Object.freeze))

const FIXTURE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** <skillDir>/assets/fixtures/<id>, or fixture_unknown (exit 2) when that is not a directory. */
export function resolveFixture(skillDir, id) {
  const dir = skillDir ? join(skillDir, 'assets', 'fixtures', String(id)) : null
  if (!FIXTURE_ID.test(String(id)) || !dir || !existsSync(dir) || !statSync(dir).isDirectory()) throw new ChronicleError('fixture_unknown', 2, { fixture: String(id) })
  return dir
}

/** Default value of a brief field for the conflict rule; null = no default (any explicit difference conflicts). */
function fieldDefault(field, subject) {
  if (field === 'structure') return subject ? defaultStructure(subject) : null
  return field in BRIEF_DEFAULTS && ['seconds', 'aspect', 'lang'].includes(field) ? BRIEF_DEFAULTS[field] : null
}

function normField(field, value) {
  if (value == null) return null
  if (field === 'topic') return normalizeTopic(value)
  if (field === 'lang') {
    try { return briefLang(value) } catch { return String(value) }
  }
  return value
}

/** Files of a fixture stage: [{ from (abs), to (rel) }]. */
function fixtureFiles(fixtureDir, lang) {
  const out = []
  for (const entry of FIXTURE_LAYOUT) {
    if (entry.from.endsWith('/')) {
      for (const f of listFiles(join(fixtureDir, entry.from))) out.push({ stage: entry.stage, from: join(fixtureDir, entry.from, f), to: `${entry.to}${f}` })
      continue
    }
    let from = join(fixtureDir, entry.from)
    if (entry.from.includes('{lang}')) from = join(fixtureDir, entry.from.replace('{lang}', lang))
    if (existsSync(from) && statSync(from).isFile()) out.push({ stage: entry.stage, from, to: entry.to })
  }
  return out
}

/** The fixture's brief.json ({ raw, brief }), or fixture_unknown (exit 2) when it is missing or not JSON. */
export function readFixtureBrief(fixtureDir) {
  let raw
  try {
    raw = JSON.parse(readFileSync(join(fixtureDir, BRIEF_FILE), 'utf8'))
  } catch {
    throw new ChronicleError('fixture_unknown', 2, { fixture: basename(fixtureDir), reason: 'brief_missing' })
  }
  return { raw, brief: validateBrief(raw).brief }
}

const shown = (v) => (v == null ? '—' : String(v))

/**
 * Applies a fixture (call after the project lock is held, before any stage runs):
 *  1. conflicts: an explicit, non-default brief value that differs from the fixture, or a different
 *     --qid -> fixture_brief_conflict:<field[,field…]> (exit 2), nothing written;
 *  2. brief override of FIXTURE_FIELDS (atomic write), state.json fixture: '<id>', one bilingual line
 *     `fixture_brief_applied <id> (<field> <old>→<new>, …)` listing changed fields only;
 *  3. fixture stage outputs written only for stages not yet recorded in state.json, recorded as
 *     done / source fixture with the normal inputs_sha256 (absent inputs = null).
 * dryRun: only the conflict check; returns the merged brief without writing anything.
 * @returns {{ brief: object, raw: object, changed: string[], written: string[], fixture: string }}
 */
export async function applyFixture({ projectDir, fixtureDir, cliQid = null, stylePack = {}, flags = {}, lang = 'en', log = console, dryRun = false, skill = null, table = STAGES, now = () => new Date() }) {
  const id = basename(fixtureDir)
  const { raw: fixtureRaw, brief: fixtureBrief } = readFixtureBrief(fixtureDir)
  const { raw: projectRaw, brief: projectBrief } = loadBriefForFixture(projectDir, fixtureBrief)

  const conflicts = []
  const subjectForDefault = projectRaw.subject ?? fixtureBrief.subject
  for (const field of FIXTURE_FIELDS) {
    if (!(field in fixtureRaw)) continue
    const want = normField(field, fixtureBrief[field])
    if (field in projectRaw) {
      const have = normField(field, projectRaw[field])
      const def = fieldDefault(field, subjectForDefault)
      if (have !== want && (def == null || have !== def)) conflicts.push(field)
    }
  }
  if (cliQid != null && fixtureBrief.qid && cliQid !== fixtureBrief.qid && !conflicts.includes('qid')) conflicts.push('qid')
  if (conflicts.length) {
    const fields = FIXTURE_FIELDS.filter((f) => conflicts.includes(f))
    throw new ChronicleError(`fixture_brief_conflict:${fields.join(',')}`, 2, { fixture: id, fields: fields.join(', ') })
  }

  const mergedRaw = { ...projectRaw }
  for (const field of FIXTURE_FIELDS) if (field in fixtureRaw) mergedRaw[field] = fixtureRaw[field]
  const { brief } = validateBrief(mergedRaw)
  const changed = FIXTURE_FIELDS.filter((f) => f in fixtureRaw && normField(f, projectBrief[f]) !== normField(f, brief[f]))
  if (dryRun) return { brief, raw: mergedRaw, changed, written: [], fixture: id }

  writeJsonAtomic(join(projectDir, BRIEF_FILE), mergedRaw)
  const list = changed.map((f) => `${f} ${shown(projectBrief[f])}→${shown(brief[f])}`).join(', ')
  log.log(t(lang, 'cli.fixture_brief_applied', { fixture: id, changes: list }))

  const store = createStateStore(projectDir, { skill })
  const recorded = new Set(Object.keys(store.read().stages))
  const files = fixtureFiles(fixtureDir, brief.lang).filter((f) => !recorded.has(f.stage))
  for (const f of files) {
    mkdirp(dirname(join(projectDir, f.to)))
    writeFileAtomic(join(projectDir, f.to), readFileSync(f.from))
  }
  const stages = STAGE_ORDER.filter((s) => files.some((f) => f.stage === s))
  await store.update((state) => {
    state.fixture = id
    for (const stage of stages) {
      state.stages[stage] = fixtureRecord({ projectDir, stage, brief, stylePack, flags, outputs: files.filter((f) => f.stage === stage).map((f) => f.to), table, now })
    }
  })
  return { brief, raw: mergedRaw, changed, written: stages, fixture: id }
}

// ---------------------------------------------------------------- new-project

/**
 * Creates a project folder with brief.json (refuses a folder inside the Skill or an existing brief).
 * @returns {{ dir: string, brief: object }}
 */
export function createProject({ out, skillDir, topic, qid, seconds, aspect, filmLang, style }) {
  if (!out) throw new ChronicleError('flag_invalid:out', 2)
  const dir = resolve(out)
  assertOutsideSkill(dir, skillDir)
  if (existsSync(join(dir, BRIEF_FILE))) throw new ChronicleError('flag_invalid:out', 2, { reason: 'brief_exists' })
  let lang = 'en'
  if (filmLang != null) {
    if (typeof filmLang !== 'string') throw new ChronicleError('flag_invalid:film-lang', 2)
    let invalid = false
    lang = briefLang(filmLang, () => { invalid = true })
    if (invalid) throw new ChronicleError('flag_invalid:film-lang', 2)
  }
  const raw = {}
  if (topic != null) raw.topic = typeof topic === 'string' ? topic : String(topic)
  if (qid != null) raw.qid = qid
  raw.seconds = seconds == null ? BRIEF_DEFAULTS.seconds : /^\d+$/.test(String(seconds)) ? Number(seconds) : seconds
  raw.aspect = aspect ?? BRIEF_DEFAULTS.aspect
  raw.lang = lang
  if (style != null && style !== true) {
    if (skillDir && !existsSync(join(skillDir, 'assets', 'styles', String(style), 'style-pack.json'))) throw new ChronicleError('flag_invalid:style', 2)
    raw.style = String(style)
  }
  // Without --topic/--qid the project is a default project: fill in brief.json (or use --fixture) later.
  const blank = raw.topic == null && raw.qid == null
  const { brief } = blank ? { brief: { ...validateBrief({ ...raw, qid: 'Q1' }).brief, qid: null } } : validateBrief(raw)
  if (brief.topic) raw.topic = brief.topic
  mkdirp(dir)
  writeJsonAtomic(join(dir, BRIEF_FILE), raw)
  return { dir, brief }
}
