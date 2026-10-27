#!/usr/bin/env node
// Writes THIRD_PARTY_NOTICES.txt for the production dependency closure in package-lock.json
// (lockfileVersion 3). The minifier drops licence comments, so inline-build embeds this file in the
// single HTML file instead. Zero dependencies; deterministic output (no dates, no absolute paths).
//
//   node scripts/notices.mjs dist/THIRD_PARTY_NOTICES.txt [--lang en|zh-CN]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { msg, resolveLang, stripLang } from './lib/messages.mjs'

export const NOTICES_HEADER = 'Third-party notices for the Stone Stars sample\n\nBundled fonts: Cormorant Garamond Medium and Medium Italic (Copyright 2015 The Cormorant Project Authors) and Inter variable (Copyright 2016 The Inter Project Authors), SIL Open Font License 1.1 (full text in src/assets/fonts/OFL.txt and in each font\'s name table). Bundled score: an original 24-second piece generated through SandBase for this sample.'
const LICENSE_FILE = /^(LICEN[CS]E|COPYING|NOTICE)(\.(md|txt))?$/i

export class NoticesError extends Error {
  constructor(code, vars = {}) {
    super(`${code} ${JSON.stringify(vars)}`)
    this.code = code
    this.vars = vars
  }
}

/**
 * Pure: builds the notices text.
 * lock: parsed package-lock.json; readText(path) → file text or null; listDir(path) → file names
 * (paths are relative to the project root, e.g. "node_modules/react").
 */
export function collectNotices({ lock, readText, listDir = () => [] }) {
  const entries = []
  for (const [path, info] of Object.entries(lock?.packages ?? {})) {
    if (!path.startsWith('node_modules/') || info.dev || info.devOptional) continue
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    let pkg = {}
    const pkgText = readText(`${path}/package.json`)
    if (pkgText) {
      try {
        pkg = JSON.parse(pkgText)
      } catch {
        pkg = {}
      }
    }
    const version = info.version ?? pkg.version ?? '0.0.0'
    const license = typeof info.license === 'string' ? info.license : typeof pkg.license === 'string' ? pkg.license : null
    let text = null
    for (const file of [...listDir(path)].filter((f) => LICENSE_FILE.test(f)).sort()) {
      text = readText(`${path}/${file}`)
      if (text !== null) break
    }
    if (text === null) {
      if (!license) throw new NoticesError('noticesNoLicense', { pkg: `${name}@${version}` })
      text = `License: ${license} (no licence file in the package)`
    }
    entries.push({ name, version, license: license ?? 'see text', text: text.replace(/\r\n?/g, '\n').trim() })
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : a.version > b.version ? 1 : 0))
  let out = `${NOTICES_HEADER}\n`
  for (const e of entries) out += `\n==== ${e.name}@${e.version} (${e.license}) ====\n${e.text}\n`
  return { text: out, count: entries.length }
}

function main() {
  const { lang, invalid } = resolveLang()
  if (invalid !== null) console.error(msg(lang, 'langInvalid', { value: invalid }))
  const [out] = stripLang(process.argv.slice(2))
  if (!out) {
    console.error(msg(lang, 'noticesUsage'))
    process.exit(2)
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (!existsSync(join(root, 'package-lock.json')) || !existsSync(join(root, 'node_modules'))) {
    console.error(msg(lang, 'noticesNoInstall'))
    process.exit(1)
  }
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const readText = (p) => {
    try {
      return readFileSync(join(root, p), 'utf8')
    } catch {
      return null
    }
  }
  const listDir = (p) => {
    try {
      return readdirSync(join(root, p), { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)
    } catch {
      return []
    }
  }
  try {
    const { text, count } = collectNotices({ lock, readText, listDir })
    const file = resolve(out)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
    console.log(msg(lang, 'noticesWrote', { file: out, count }))
  } catch (e) {
    if (e instanceof NoticesError) {
      console.error(msg(lang, e.code, e.vars))
      process.exit(1)
    }
    throw e
  }
}

// Run only as a CLI (tests import the functions). realpath: /tmp and /var may be symlinks.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) main()
