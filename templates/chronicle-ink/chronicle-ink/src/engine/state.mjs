// Resumable stage state (design §3.2): <project>/state.json, input hashing, up-to-date skips,
// upstream checks (§3.1) and stale propagation. Pure apart from reading project files.
//
// state.json: { schema, engine, skill, fixture?, stages: { <name>: { status: done|failed|awaiting|stale,
//   inputs_sha256, outputs: { <rel>: <sha256> }, finished_at, error, source: run|fixture } } }
// Write order: a stage writes its outputs (atomically) first, then the state is written (atomically).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { ChronicleError } from './errors.mjs'
import { t } from './i18n.mjs'
import { STAGES, downstreamOf, requiredUpstream } from './stages.mjs'
import { canonicalJson, sha256 } from './util/json.mjs'
import { writeJsonAtomic } from './util/fsx.mjs'
import { mutexFor } from './util/mutex.mjs'
import { ENGINE_VERSION } from './version.mjs'

export const STATE_SCHEMA = 'chronicle-state/1'
export const STATE_FILE = 'state.json'

/** Normalised CLI option values that may enter an input hash (defaults filled in). */
export function stageOptions(flags = {}) {
  return {
    qid: flags.qid ?? null,
    'add-source': Array.isArray(flags['add-source']) ? [...flags['add-source']] : [],
    'source-file': Array.isArray(flags['source-file']) ? flags['source-file'].map(fileSha) : [],
    quality: flags.quality ?? 'final',
    strict: flags.strict === true,
    reviewed: flags.reviewed ? String(flags.reviewed).split(',').map((x) => x.trim()).filter(Boolean).sort() : [],
  }
}

const getPath = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

/** sha256 of a file, or null when it does not exist. */
export function fileSha(abs) {
  if (!existsSync(abs) || !statSync(abs).isFile()) return null
  return sha256(readFileSync(abs))
}

/** Every regular file under `abs` (relative POSIX paths, sorted), skipping dot files (temp files). */
export function listFiles(abs) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.')) continue
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (st.isFile()) out.push(relative(abs, p).split(sep).join('/'))
    }
  }
  if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs)
  return out.sort()
}

/** Tree hash of a directory (sorted `path\0sha\n` lines), or null when it does not exist. */
export function dirSha(abs) {
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return null
  return sha256(listFiles(abs).map((rel) => `${rel}\0${sha256(readFileSync(join(abs, rel)))}\n`).join(''))
}

/**
 * The declared inputs of a stage and their hash.
 * @returns {{ inputs: object, sha: string }}
 */
export function stageInputs({ projectDir, stage, brief = {}, stylePack = {}, flags = {}, table = STAGES }) {
  const def = table[stage]
  if (!def) throw new ChronicleError('internal_error', 1, { reason: 'unknown_stage', stage })
  const files = {}
  for (const rel of def.inputs.files) files[rel] = rel.endsWith('/') ? dirSha(join(projectDir, rel)) : fileSha(join(projectDir, rel))
  const opts = stageOptions(flags)
  const inputs = {
    stage,
    engine: ENGINE_VERSION,
    files,
    brief: Object.fromEntries(def.inputs.brief.map((k) => [k, brief[k] ?? null])),
    style: Object.fromEntries(def.inputs.style.map((k) => [k, getPath(stylePack, k) ?? null])),
    options: Object.fromEntries(def.inputs.options.map((k) => [k, opts[k] ?? null])),
  }
  return { inputs, sha: sha256(canonicalJson(inputs)) }
}

/** { <rel>: sha256 } for output files; a directory entry ('x/') expands to its files. Missing files are skipped. */
export function outputHashes(projectDir, rels = []) {
  const out = {}
  for (const rel of rels) {
    const clean = String(rel).replace(/\\/g, '/')
    if (clean.endsWith('/')) {
      for (const f of listFiles(join(projectDir, clean))) out[`${clean}${f}`] = sha256(readFileSync(join(projectDir, clean, f)))
    } else {
      const sha = fileSha(join(projectDir, clean))
      if (sha) out[clean] = sha
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/** Whether every recorded output still exists with the same sha256. */
export function outputsIntact(projectDir, record) {
  const missing = []
  const changed = []
  for (const [rel, sha] of Object.entries(record?.outputs ?? {})) {
    const now = fileSha(join(projectDir, rel))
    if (now == null) missing.push(rel)
    else if (now !== sha) changed.push(rel)
  }
  return { ok: !missing.length && !changed.length, missing, changed }
}

export const emptyState = (skill = null) => ({ schema: STATE_SCHEMA, engine: ENGINE_VERSION, skill, stages: {} })

export function readState(projectDir, skill = null) {
  const path = join(projectDir, STATE_FILE)
  if (!existsSync(path)) return emptyState(skill)
  let data
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new ChronicleError('internal_error', 1, { reason: 'state_json_invalid' })
  }
  return { ...emptyState(skill), ...data, stages: data?.stages && typeof data.stages === 'object' ? data.stages : {} }
}

/**
 * State file handle with an in-process mutex: update(fn) re-reads, applies fn(state) and writes atomically.
 */
export function createStateStore(projectDir, { skill = null } = {}) {
  const path = join(projectDir, STATE_FILE)
  const mutex = mutexFor(path)
  return {
    path,
    read: () => readState(projectDir, skill),
    update: (fn) => mutex.run(() => {
      const state = readState(projectDir, skill)
      const result = fn(state)
      state.engine = ENGINE_VERSION
      if (skill) state.skill = skill
      writeJsonAtomic(path, state)
      return result
    }),
  }
}

/** Marks every downstream stage that is `done` as `stale` (mutates state). Returns their names. */
export function markDownstreamStale(state, stage, table = STAGES) {
  const marked = []
  for (const name of downstreamOf(stage, table)) {
    const rec = state.stages[name]
    if (rec && rec.status === 'done') {
      rec.status = 'stale'
      marked.push(name)
    }
  }
  return marked
}

/** Status of an upstream stage: 'ok' | 'missing' | 'stale'. */
export function upstreamStatus(projectDir, state, name) {
  const rec = state.stages[name]
  if (!rec || rec.status === 'failed' || rec.status === 'awaiting') return 'missing'
  if (rec.status === 'stale') return 'stale'
  const intact = outputsIntact(projectDir, rec)
  if (intact.missing.length) return 'missing'
  if (intact.changed.length) return 'stale'
  return 'ok'
}

/**
 * Checks the upstream stages of `stage`. Required: missing -> stage_missing:<up>, stale -> stage_stale:<up>
 * (exit 2). Optional: reported, never an error.
 * @returns {{ missing: string[], stale: string[] }} optional upstream stages that are missing / stale
 */
export function checkUpstream({ projectDir, state, stage, brief = {}, table = STAGES }) {
  for (const up of requiredUpstream(stage, brief, table)) {
    const st = upstreamStatus(projectDir, state, up)
    if (st === 'missing') throw new ChronicleError(`stage_missing:${up}`, 2, { stage, upstream: up })
    if (st === 'stale') throw new ChronicleError(`stage_stale:${up}`, 2, { stage, upstream: up })
  }
  const missing = []
  const stale = []
  for (const up of table[stage]?.optional ?? []) {
    const st = upstreamStatus(projectDir, state, up)
    if (st === 'missing') missing.push(up)
    else if (st === 'stale') stale.push(up)
  }
  return { missing, stale }
}

const sameMap = (a = {}, b = {}) => canonicalJson(a) === canonicalJson(b)

/**
 * Runs one stage with the §3.2 rules: upstream check, skip when up to date ('[stage] up to date'),
 * otherwise run and record. The stage module's run(ctx) returns
 *   { status: 'done'|'awaiting', outputs: [rel…], exit?, awaiting? }   (recorded in state.json), or
 *   a number                                                           (exit code; nothing recorded).
 * ctx gets `stage`, `rerun` ({ reason: new|redo|stale|failed|awaiting|inputs_changed|outputs_changed,
 * changed, missing } — a hand-edited script.json gives outputs_changed with changed ['script.json'],
 * so the script stage can re-run only its gate), `upstream` (optional missing/stale) and `inputs`.
 * @returns {Promise<{ exit: number, status: string, skipped?: boolean }>}
 */
export async function runStage({ stage, ctx, run, store, table = STAGES, now = () => new Date() }) {
  const { projectDir, brief, stylePack, flags = {}, lang = 'en', log = console } = ctx
  const state = store.read()
  const upstream = checkUpstream({ projectDir, state, stage, brief, table })
  const { inputs, sha } = stageInputs({ projectDir, stage, brief, stylePack, flags, table })
  const rec = state.stages[stage]
  const intact = rec ? outputsIntact(projectDir, rec) : { ok: false, missing: [], changed: [] }
  if (rec?.status === 'done' && rec.inputs_sha256 === sha && intact.ok && flags.redo !== true) {
    log.log(t(lang, 'cli.stage_up_to_date', { stage }))
    return { exit: 0, status: 'done', skipped: true }
  }
  let reason
  if (!rec) reason = 'new'
  else if (flags.redo === true) reason = 'redo'
  else if (rec.status !== 'done') reason = rec.status
  else if (rec.inputs_sha256 !== sha) reason = 'inputs_changed'
  else reason = 'outputs_changed'
  const rerun = { reason, changed: intact.changed, missing: intact.missing }
  let result
  try {
    result = await run({ ...ctx, stage, rerun, upstream, inputs })
  } catch (e) {
    const code = e instanceof ChronicleError ? e.code : 'internal_error'
    await store.update((s) => {
      s.stages[stage] = { status: 'failed', inputs_sha256: null, outputs: s.stages[stage]?.outputs ?? {}, finished_at: now().toISOString(), error: code, source: 'run' }
    })
    throw e
  }
  if (typeof result === 'number') return { exit: result, status: 'unrecorded' }
  const status = result?.status === 'awaiting' ? 'awaiting' : 'done'
  const outputs = outputHashes(projectDir, result?.outputs ?? [])
  await store.update((s) => {
    const prev = s.stages[stage]
    s.stages[stage] = {
      status,
      inputs_sha256: status === 'done' ? sha : null,
      outputs,
      finished_at: now().toISOString(),
      error: null,
      source: 'run',
      ...(result?.awaiting ? { awaiting: result.awaiting } : {}),
    }
    if (status === 'done' && !(prev?.status === 'done' && sameMap(prev.outputs, outputs))) markDownstreamStale(s, stage, table)
  })
  return { exit: Number.isInteger(result?.exit) ? result.exit : 0, status, awaiting: result?.awaiting }
}

/** Record written by --fixture for a stage (§3.1 step 3): done, source fixture, normal input hash. */
export function fixtureRecord({ projectDir, stage, brief, stylePack, flags, outputs, table = STAGES, now = () => new Date() }) {
  return {
    status: 'done',
    inputs_sha256: stageInputs({ projectDir, stage, brief, stylePack, flags, table }).sha,
    outputs: outputHashes(projectDir, outputs),
    finished_at: now().toISOString(),
    error: null,
    source: 'fixture',
  }
}
