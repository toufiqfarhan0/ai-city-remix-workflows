#!/usr/bin/env node
// Copies the Paris Lines reference app (assets/paris-lines) into a new project folder. Zero dependencies.
//
//   node scripts/new-project.mjs --out my-case [--name my-scene] [--lang en|zh-CN]
//
// Exit codes: 0 created, 1 IO error (a folder this run created is removed), 2 invalid input.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { msg, resolveLang } from './lib/i18n.mjs'

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const APP_SOURCE = join(SKILL, 'assets', 'paris-lines')
export const SKIP = new Set(['node_modules', 'dist', 'dist-single', 'shots', 'posters', '.DS_Store'])
export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

/** Copies src into dst (which must exist), skipping SKIP entries. Returns the number of files. */
export function copyTree(src, dst) {
  let n = 0
  for (const d of readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(d.name)) continue
    const from = join(src, d.name)
    const to = join(dst, d.name)
    if (d.isDirectory()) {
      mkdirSync(to, { recursive: true })
      n += copyTree(from, to)
    } else if (d.isFile()) {
      copyFileSync(from, to)
      n++
    }
  }
  return n
}

function main() {
  const argv = process.argv.slice(2)
  const { lang, invalid } = resolveLang(argv)
  if (invalid !== null) console.error(msg(lang, 'langInvalid', { value: invalid }))
  const opt = (name) => {
    const i = argv.indexOf(`--${name}`)
    if (i >= 0) return argv[i + 1]
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  }
  const fail = (key, vars) => {
    console.error(msg(lang, key, vars))
    process.exit(2)
  }
  const out = opt('out')
  if (!out) fail('newUsage')
  const dir = resolve(out)
  const existed = existsSync(dir)
  if (existed && readdirSync(dir).length > 0) fail('newNotEmpty', { dir: out })
  const name = opt('name') ?? basename(dir)
  if (!NAME_RE.test(name)) fail('newBadName', { name })
  try {
    mkdirSync(dir, { recursive: true })
    const files = copyTree(APP_SOURCE, dir)
    for (const file of ['package.json', 'package-lock.json']) {
      const p = join(dir, file)
      const json = JSON.parse(readFileSync(p, 'utf8'))
      json.name = name
      if (json.packages?.['']) json.packages[''].name = name
      writeFileSync(p, `${JSON.stringify(json, null, 2)}\n`)
    }
    console.log(msg(lang, 'newDone', { dir: out, files }))
  } catch (e) {
    if (!existed) rmSync(dir, { recursive: true, force: true })
    console.error(msg(lang, 'newIoError', { error: e instanceof Error ? e.message : String(e) }))
    process.exit(1)
  }
}

// Run only as a CLI (tests import the functions). realpath: /tmp and /var may be symlinks.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) main()
