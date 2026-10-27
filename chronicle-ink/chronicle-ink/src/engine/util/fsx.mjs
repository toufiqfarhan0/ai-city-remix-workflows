// File helpers. Every write is atomic: the data goes to a temporary file in the same directory,
// which is then renamed over the target, so an interrupted process never leaves a half-written file.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export function mkdirp(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Writes `data` (string or Buffer) to `path` atomically, creating parent directories.
 * @param {{ mode?: number }} [options] file mode for the new file (for example 0o600 for request bodies)
 */
export function writeFileAtomic(path, data, { mode } = {}) {
  const dir = dirname(path)
  mkdirp(dir)
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`)
  try {
    writeFileSync(tmp, data, mode == null ? undefined : { mode })
    renameSync(tmp, path)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
  return path
}

/** Writes `value` as 2-space indented JSON with a trailing newline, atomically. */
export function writeJsonAtomic(path, value, options) {
  return writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`, options)
}

/** Parsed JSON of `path`, or `fallback` when the file does not exist. Invalid JSON throws. */
export function readJsonIfExists(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}
