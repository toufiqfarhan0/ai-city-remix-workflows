// Helpers shared by the stage modules (engine/stages/*.mjs): project-relative JSON I/O, multi-error
// reporting, font coverage for the glyph check and the Agent task file. No stage calls a model.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ChronicleError, EXIT } from '../errors.mjs'
import { redactText } from '../util/redact.mjs'
import { fontCodepoints } from '../util/fonts.mjs'
import { writeFileAtomic, writeJsonAtomic } from '../util/fsx.mjs'

/** Absolute path of a project-relative file. */
export const abs = (ctx, rel) => join(ctx.projectDir, ...String(rel).split('/'))

/** Reads a project JSON file; null when absent (or throws `code` when given). */
export function readProjectJson(ctx, rel, { code = null } = {}) {
  const p = abs(ctx, rel)
  if (!existsSync(p)) {
    if (code) throw new ChronicleError(code, undefined, { file: rel })
    return null
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    throw new ChronicleError(code ?? 'internal_error', undefined, { file: rel, reason: 'json_invalid' })
  }
}

/** Atomic JSON write (2-space, trailing newline) of a project-relative file. */
export const writeProjectJson = (ctx, rel, value) => writeJsonAtomic(abs(ctx, rel), value)

/** Atomic text / buffer write of a project-relative file. */
export const writeProjectFile = (ctx, rel, data) => writeFileAtomic(abs(ctx, rel), data)

/** The Skill's assets folder (the folder of style-pack.json). */
export const assetsDir = (ctx) => (ctx.stylePackPath ? dirname(ctx.stylePackPath) : join(ctx.skillDir ?? '.', 'assets'))

/** Union of the code points of every bundled font (style pack typography.files), or null. */
export function loadCoverage(ctx) {
  const files = ctx.stylePack?.typography?.files ?? []
  if (!files.length) return null
  const set = new Set()
  for (const f of files) {
    const p = join(assetsDir(ctx), ...String(f.file).split('/'))
    if (!existsSync(p)) continue
    for (const cp of fontCodepoints(p)) set.add(cp)
  }
  return set.size ? set : null
}
/** Severity order of exit statuses when one stage reports several errors (9 before 6, §3.3). */
const EXIT_PRIORITY = [EXIT.plan, EXIT.gate, EXIT.input, EXIT.local, EXIT.scene, EXIT.source, EXIT.entity, EXIT.strict]

/**
 * Prints every error code (one per line, after the first, which the CLI prints itself) and throws the
 * first error of the most severe exit class with details.errors listing all codes.
 * @param {{ code: string, line?: string, details?: object }[]} errors
 */
export function failWith(ctx, errors, exit = null) {
  const exitOf = (e) => new ChronicleError(e.code).exit
  const ranked = exit ?? EXIT_PRIORITY.find((x) => errors.some((e) => exitOf(e) === x)) ?? exitOf(errors[0])
  const first = errors.find((e) => exitOf(e) === ranked) ?? errors[0]
  for (const e of errors) if (e !== first) ctx.log.error(`- ${e.code}`)
  throw new ChronicleError(first.code, ranked, { ...(first.details ?? {}), errors: errors.map((e) => e.code) })
}

/** Writes AGENT_TASK.md at the project root (Agent instructions for an awaiting point). */
export function writeAgentTask(ctx, text) {
  writeProjectFile(ctx, 'AGENT_TASK.md', text.endsWith('\n') ? text : `${text}\n`)
  return 'AGENT_TASK.md'
}

/** Prints warnings as `warning <code>` lines (codes only; never credentials). */
export function printWarnings(ctx, warnings = []) {
  for (const w of warnings) ctx.log.error(redactText(`warning ${w}`, ctx.env))
}
