// CLI entry of the chronicle engine. A Skill's scripts/chronicle.mjs calls
//   main(argv, { skillDir, stylePackPath })
// and uses the returned number as the process exit code; scripts/new-project.mjs calls newProjectMain.
//
// Static imports stay dependency-free (no ffmpeg, no Node-22-only API), so --help and argument errors
// work on a fresh unpack. doctor and the stage modules are loaded lazily. No command calls a model:
// the Agent that reads SKILL.md writes claims, the shot list, scene code and reviews at the awaiting
// points, and code draws and scores the film.
//
// Flow of a stage command: flags -> project folder (outside the Skill) -> project lock (held for the
// whole command; released on exit, error, SIGINT and SIGTERM) -> brief.json -> --fixture -> the stage
// runner (state.mjs). `render --segment <x>` bypasses the runner (review renders are never recorded).
// Errors: ChronicleError -> its exit status with one localised line; anything else -> exit 1
// internal_error with a redacted one-line message (stack only with CHRONICLE_DEBUG=1, redacted).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ChronicleError, EXIT, baseCode } from './errors.mjs'
import { normalizeLang, t } from './i18n.mjs'
import { QID_RE, acquireProjectLock, applyFixture, assertOutsideSkill, createProject, loadBrief, loadBriefForFixture, projectPaths, readFixtureBrief, resolveFixture } from './project.mjs'
import { redactText } from './util/redact.mjs'
import { STAGES, STAGE_ORDER } from './stages.mjs'
import { checkUpstream, createStateStore, readState, runStage } from './state.mjs'

export const COMMANDS = Object.freeze(['doctor', ...STAGE_ORDER, 'all'])
const BOOLEAN_FLAGS = new Set(['help', 'offline', 'redo', 'strict'])
const REPEATABLE_FLAGS = new Set(['add-source', 'source-file'])
const PIPELINE = new Set([...STAGE_ORDER, 'all'])

/** `--key value`, `--key=value` and boolean `--flag`; bare words are positional (first one = command). */
export function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = String(argv[i])
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=')
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2)
      let value
      if (eq > 0) value = a.slice(eq + 1)
      else if (BOOLEAN_FLAGS.has(key) || argv[i + 1] == null || String(argv[i + 1]).startsWith('--')) value = true
      else value = String(argv[++i])
      if (REPEATABLE_FLAGS.has(key)) (flags[key] ??= []).push(value)
      else flags[key] = value
    } else positional.push(a)
  }
  return { command: positional[0] ?? null, args: positional.slice(1), flags }
}

const invalid = (flag, details = {}) => new ChronicleError(`flag_invalid:${flag}`, EXIT.input, { flag, ...details })
const isStr = (v) => typeof v === 'string' && v.length > 0

/**
 * Option rules (design §3.1). `commands`: commands that accept the flag; `requires`: another flag that
 * must be present. Misuse -> flag_invalid:<flag> (exit 2).
 */
export const FLAG_RULES = Object.freeze({
  project: { check: isStr },
  lang: { check: () => true },
  help: { bool: true },
  offline: { bool: true, commands: [...PIPELINE] },
  redo: { bool: true, commands: [...PIPELINE] },
  strict: { bool: true, commands: ['check', 'all'] },
  quality: { check: (v) => v === 'draft' || v === 'final', commands: ['scenes', 'render', 'all'] },
  segment: { check: (v) => isStr(v) && /^[\w.:-]{1,32}$/.test(v), commands: ['render'] },
  fixture: { check: isStr, commands: [...PIPELINE] },
  'add-source': { repeat: true, check: (v) => isStr(v) && /^https?:\/\/\S+$/i.test(v), commands: ['research', 'all'] },
  'source-file': { repeat: true, check: isStr, commands: ['research', 'all'] },
  reviewed: { check: (v) => isStr(v) && v.split(',').every((x) => ['facts', 'visuals', 'listening'].includes(x.trim())), commands: ['report', 'all'] },
  qid: { check: (v) => isStr(v) && QID_RE.test(v), commands: [...PIPELINE] },
})
/** Validates options against FLAG_RULES (throws flag_invalid:<flag>). */
export function validateFlags(command, args, flags) {
  for (const [key, value] of Object.entries(flags)) {
    const rule = FLAG_RULES[key]
    if (!rule) throw invalid(key, { reason: 'unknown' })
    if (rule.commands && !rule.commands.includes(command)) throw invalid(key, { reason: 'not_for_command', command })
    if (rule.requires && !flags[rule.requires]) throw invalid(key, { reason: `requires_${rule.requires}` })
    const values = rule.repeat ? value : [value]
    for (const v of values) {
      if (rule.bool ? v !== true : !rule.check(v)) throw invalid(key)
    }
  }
  if (args.length) throw invalid('argument', { argument: args[0] })
}

/** One localised line for a ChronicleError: `error <code>: <message>` (details fill the message). */
export function errorLine(lang, err) {
  const key = `err.${baseCode(err.code)}`
  const vars = {}
  for (const [k, v] of Object.entries(err.details ?? {})) {
    if (typeof v === 'string' || typeof v === 'number') vars[k] = v
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) vars[k] = v.join(', ')
  }
  let message = t(lang, key, vars)
  message = message === key ? '' : message.replace(/\{\w+\}/g, '?')
  return t(lang, 'cli.error', { code: err.code, message })
}

/** Prints an error and returns its exit status (redacted; one line; stack only with CHRONICLE_DEBUG=1). */
export function reportError(e, { lang = 'en', log = console, env = process.env } = {}) {
  if (e instanceof ChronicleError) {
    log.error(redactText(errorLine(lang, e), env))
    // tool output (already redacted) of a failed renderer or encoder, for debugging
    if (env?.CHRONICLE_DEBUG === '1' && typeof e.details?.stderr === 'string') log.error(e.details.stderr)
    return e.exit
  }
  const msg = redactText(String(e?.message ?? e ?? ''), env).split(/\r?\n/)[0].slice(0, 300)
  log.error(t(lang, 'cli.error', { code: 'internal_error', message: `${t(lang, 'err.internal_error')} ${msg}`.trim() }))
  if (env?.CHRONICLE_DEBUG === '1' && e?.stack) log.error(redactText(e.stack, env))
  return EXIT.internal
}

/**
 * Stage loaders (lazy, so the static import graph of cli.mjs stays dependency-free). Each module exports
 * run(ctx); see state.mjs runStage for the result contract. A loader marked `.stub` is a stage that is
 * not implemented (stage_missing:<stage>, exit 2, nothing recorded).
 */
export const DEFAULT_STAGES = Object.freeze({
  research: () => import('./stages/research.mjs'),
  facts: () => import('./stages/facts.mjs'),
  script: () => import('./stages/script.mjs'),
  timeline: () => import('./stages/timeline.mjs'),
  music: () => import('./stages/music.mjs'),
  scenes: () => import('./stages/scenes.mjs'),
  render: () => import('./stages/render.mjs'),
  check: () => import('./stages/check.mjs'),
  report: () => import('./stages/report.mjs'),
})
function loadStylePack(path) {
  if (!path) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new ChronicleError('deps_missing:style_pack', EXIT.input)
  }
}

function skillId(skillDir) {
  if (!skillDir) return null
  try {
    const pkg = JSON.parse(readFileSync(join(skillDir, 'package.json'), 'utf8'))
    return `${pkg.name}@${pkg.version}`
  } catch {
    return null
  }
}

/**
 * Runs one command and returns the exit code.
 * @param {string[]} argv command line without node and the script path
 * @param {object} [options] skillDir, stylePackPath; for tests: stages, table, log, env, fetch, now,
 *   probe (doctor), spawn, lookup, hostname, kill
 */
export async function main(argv, options = {}) {
  const { skillDir, stylePackPath, stages = DEFAULT_STAGES, table = STAGES, log = console, env = process.env } = options
  let lang = 'en'
  let lock = null
  const onSignal = (sig) => {
    lock?.release()
    process.exit(sig === 'SIGINT' ? 130 : 143)
  }
  try {
    const { command, args, flags } = parseArgs(argv)
    lang = normalizeLang(flags.lang, { warn: (v) => log.error(t('en', 'cli.lang_invalid', { lang: v })) })
    if (flags.help || command === 'help') {
      log.log(t(lang, 'cli.usage'))
      return EXIT.ok
    }
    if (!command) {
      log.error(t(lang, 'cli.command_required'))
      return EXIT.input
    }
    if (!COMMANDS.includes(command)) {
      log.error(t(lang, 'cli.command_unknown', { command }))
      throw new ChronicleError('flag_invalid:command', EXIT.input, { command })
    }
    validateFlags(command, args, flags)
    if (command === 'doctor') {
      if (flags.project) throw invalid('project', { reason: 'not_for_command' })
      const { runDoctor } = await import('./doctor.mjs')
      return runDoctor({ lang, log, env, skillDir, ...(options.probe ? { probe: options.probe } : {}) })
    }
    if (!flags.project) throw invalid('project', { reason: 'required' })
    const projectDir = resolve(flags.project)
    assertOutsideSkill(projectDir, skillDir)
    if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) throw new ChronicleError('brief_invalid:file', EXIT.input, { reason: 'project_missing' })
    const label = `${command}${flags.segment ? ` --segment ${flags.segment}` : ''}`
    lock = acquireProjectLock(projectDir, { command: label, ...(options.hostname ? { hostname: options.hostname } : {}), ...(options.kill ? { kill: options.kill } : {}) })
    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)

    let stylePack = loadStylePack(stylePackPath)
    const skill = skillId(skillDir)
    const fixtureDir = flags.fixture ? resolveFixture(skillDir, flags.fixture) : null
    // With --fixture a brief without topic/qid is completed by the fixture brief (applyFixture validates).
    let { brief, warnings } = fixtureDir ? loadBriefForFixture(projectDir, readFixtureBrief(fixtureDir).brief) : loadBrief(projectDir)
    for (const w of warnings) log.error(t(lang, 'warn.brief_lang_invalid', { lang: w.split(':').slice(1).join(':') }))
    let fixture = null
    if (fixtureDir) {
      const r = await applyFixture({ projectDir, fixtureDir, cliQid: flags.qid ?? null, stylePack, flags, lang, log, skill, table })
      brief = r.brief
      fixture = r.fixture
    }
    // brief.style picks a style pack under assets/styles/<id>/ (the default pack is assets/style-pack.json).
    if (brief.style && skillDir && brief.style !== (stylePack.style ?? 'ink')) {
      const file = join(skillDir, 'assets', 'styles', brief.style, 'style-pack.json')
      if (!existsSync(file)) throw new ChronicleError('brief_invalid:style', EXIT.input, { field: 'style', value: brief.style })
      stylePack = loadStylePack(file)
    }
    // Kit and CSS files of the pack are hashed into it, so a Skill update re-runs the scenes stage
    // (the project's composition inlines that code).
    if (skillDir) {
      const h = createHash('sha256')
      for (const rel of [...(Array.isArray(stylePack.kit) ? stylePack.kit : [stylePack.kit]), stylePack.css].filter((x) => typeof x === 'string')) {
        const f = join(skillDir, 'assets', rel)
        h.update(`${rel}\0${existsSync(f) ? readFileSync(f) : ''}\n`)
      }
      stylePack = { ...stylePack, assets_sha256: h.digest('hex') }
    }
    const store = createStateStore(projectDir, { skill })
    const ctx = {
      command, args, flags, lang, log, env, skillDir, stylePackPath, stylePack, projectDir,
      paths: projectPaths(projectDir), brief, store, fetch: options.fetch ?? globalThis.fetch, now: options.now ?? (() => new Date()),
      // Test hooks: child-process spawn (ffmpeg, HyperFrames) and DNS lookup.
      spawn: options.spawn, lookup: options.lookup,
    }
    if (command === 'render' && flags.segment != null && flags.segment !== 'all') {
      const { renderSegment } = await import('./stages/render.mjs')
      return await renderSegment(ctx)
    }
    for (const name of command === 'all' ? STAGE_ORDER : [command]) {
      const loader = stages[name]
      if (!loader || loader.stub) {
        // Not implemented yet: report a missing upstream first (no state is written for a stub).
        checkUpstream({ projectDir, state: store.read(), stage: name, brief, table })
        throw new ChronicleError(`stage_missing:${name}`, EXIT.input, { stage: name, reason: 'not_implemented' })
      }
      const mod = await loader()
      const run = typeof mod === 'function' ? mod : mod?.run ?? mod?.default
      const res = await runStage({ stage: name, ctx, run, store, table, now: ctx.now })
      if (res.status === 'awaiting') {
        log.log(t(lang, 'cli.awaiting', { status: res.awaiting ?? 'awaiting' }))
        return EXIT.ok
      }
      if (res.exit !== EXIT.ok) return res.exit
    }
    return EXIT.ok
  } catch (e) {
    return reportError(e, { lang, log, env })
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    lock?.release()
  }
}

const NEW_FLAGS = new Set(['out', 'topic', 'qid', 'seconds', 'aspect', 'film-lang', 'lang', 'help', 'style'])

/**
 * scripts/new-project.mjs: creates <out>/brief.json. --film-lang sets brief.lang (the film language);
 * --lang only sets the language of these messages.
 */
export async function newProjectMain(argv, { skillDir, log = console, env = process.env } = {}) {
  let lang = 'en'
  try {
    const { command, flags } = parseArgs(argv)
    lang = normalizeLang(flags.lang, { warn: (v) => log.error(t('en', 'cli.lang_invalid', { lang: v })) })
    if (flags.help) {
      log.log(t(lang, 'new.usage'))
      return EXIT.ok
    }
    if (command) throw invalid('argument', { argument: command })
    for (const [k, v] of Object.entries(flags)) {
      if (!NEW_FLAGS.has(k)) throw invalid(k, { reason: 'unknown' })
      if (k !== 'help' && k !== 'lang' && !isStr(v)) throw invalid(k)
    }
    const { dir, brief } = createProject({ out: flags.out, skillDir, topic: flags.topic, qid: flags.qid, seconds: flags.seconds, aspect: flags.aspect, filmLang: flags['film-lang'], style: flags.style })
    log.log(t(lang, 'new.created', { dir, lang: brief.lang, seconds: brief.seconds }))
    log.log(t(lang, brief.topic == null && brief.qid == null ? 'new.next_blank' : 'new.next', { dir }))
    return EXIT.ok
  } catch (e) {
    return reportError(e, { lang, log, env })
  }
}
