#!/usr/bin/env node
// Folds the Vite build (index.html + one JS chunk + at most one CSS file) and THIRD_PARTY_NOTICES.txt
// into one self-contained HTML file that runs under a sandbox CSP with no network. Zero dependencies.
//
//   node scripts/inline-build.mjs dist dist-single/index.html [--lang en|zh-CN]
//
// Every insertion uses a function replacer: the React bundle contains "$&/", which a string
// replacer would expand.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bundleChecks, markupChecks } from './lib/checks.mjs'
import { msg, resolveLang, stripLang } from './lib/messages.mjs'

const SCRIPT_RE = /<script type="module" crossorigin src="\.\/assets\/([^"]+\.js)"><\/script>/g
const STYLE_RE = /<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+\.css)">/g
const CHARSET_RE = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i

/** problems: [{ key, vars }] with keys from scripts/lib/messages.mjs. */
export class InlineError extends Error {
  constructor(problems) {
    super(problems.map((p) => `${p.key} ${JSON.stringify(p.vars ?? {})}`).join('; '))
    this.problems = problems
  }
}

/** The asset files index.html references: { js: [names], css: [names] }. */
export function referencedAssets(html) {
  return {
    js: [...html.matchAll(SCRIPT_RE)].map((m) => m[1]),
    css: [...html.matchAll(STYLE_RE)].map((m) => m[1]),
  }
}

/** Escapes that keep the bundle inert inside a <script> element and outside any HTML comment. */
export function escapeScript(js) {
  return js.replace(/<\/script/gi, () => '<\\/script').replace(/<!--/g, () => '\\x3C!--')
}
export function escapeStyle(css) {
  return css.replace(/<\/style/gi, () => '<\\/style')
}

/** The notices as an HTML comment that cannot close early. */
export function noticesComment(notices) {
  let text = String(notices)
  while (text.includes('--')) text = text.replaceAll('--', '- -')
  return `<!--\nThird-party notices\n${text}\n-->`
}

/** Pure: returns the single-file HTML, or throws InlineError listing every problem. */
export function inlineBuild({ html, js, css = '', notices }) {
  const problems = []
  const refs = referencedAssets(html)
  if (refs.js.length !== 1) problems.push({ key: 'inlineMissingScript', vars: { count: refs.js.length } })
  let rest = html.replace(SCRIPT_RE, () => '').replace(STYLE_RE, () => '')
  if (refs.css.length > 1) problems.push({ key: 'inlineUnexpectedTag', vars: { tag: '<link rel="stylesheet" …> (more than one)' } })
  for (const m of rest.matchAll(/<script\b[^>]*>/gi)) problems.push({ key: 'inlineUnexpectedTag', vars: { tag: m[0].slice(0, 120) } })
  for (const m of rest.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']?([^"'\s>]+)/i.exec(m[0])?.[1]
    if (rel !== 'icon') problems.push({ key: 'inlineUnexpectedTag', vars: { tag: m[0].slice(0, 120) } })
  }
  if (!CHARSET_RE.test(rest)) problems.push({ key: 'inlineNoCharset' })
  if (notices === undefined || notices === null) problems.push({ key: 'inlineMissingFile', vars: { file: 'THIRD_PARTY_NOTICES.txt' } })
  if (problems.length) throw new InlineError(problems)

  const comment = noticesComment(notices)
  const style = `<style>${escapeStyle(css)}</style>`
  const script = `<script type="module">${escapeScript(js)}</script>`
  rest = rest.replace(CHARSET_RE, (tag) => `${tag}\n${comment}`)
  if (css) rest = rest.replace(/<\/head>/i, (tag) => `${style}\n${tag}`)
  rest = rest.replace(/<\/body>/i, (tag) => `${script}\n${tag}`)
  return rest
}

function main() {
  const { lang, invalid } = resolveLang()
  if (invalid !== null) console.error(msg(lang, 'langInvalid', { value: invalid }))
  const [distArg, outArg] = stripLang(process.argv.slice(2))
  if (!distArg || !outArg) {
    console.error(msg(lang, 'inlineUsage'))
    process.exit(2)
  }
  const dist = resolve(distArg)
  const fail = (problems) => {
    console.error(msg(lang, 'inlineViolations'))
    for (const p of problems) console.error(`  - ${msg(lang, p.key, p.vars)}`)
    process.exit(1)
  }
  const indexFile = join(dist, 'index.html')
  if (!existsSync(indexFile)) fail([{ key: 'inlineMissingFile', vars: { file: 'index.html' } }])
  const html = readFileSync(indexFile, 'utf8')
  const refs = referencedAssets(html)
  const problems = []
  // Inventory: only index.html, assets/ and THIRD_PARTY_NOTICES.txt at the top; only referenced assets.
  for (const name of readdirSync(dist).sort()) {
    if (!['index.html', 'assets', 'THIRD_PARTY_NOTICES.txt'].includes(name)) problems.push({ key: 'inlineUnexpectedFile', vars: { file: name } })
  }
  if (!existsSync(join(dist, 'THIRD_PARTY_NOTICES.txt'))) problems.push({ key: 'inlineMissingFile', vars: { file: 'THIRD_PARTY_NOTICES.txt' } })
  const assetsDir = join(dist, 'assets')
  const wanted = new Set([...refs.js, ...refs.css])
  if (existsSync(assetsDir) && statSync(assetsDir).isDirectory()) {
    for (const name of readdirSync(assetsDir).sort()) if (!wanted.has(name)) problems.push({ key: 'inlineUnexpectedFile', vars: { file: `assets/${name}` } })
  }
  for (const name of wanted) if (!existsSync(join(assetsDir, name))) problems.push({ key: 'inlineMissingFile', vars: { file: `assets/${name}` } })
  if (problems.length) fail(problems)

  const readUtf8 = (file) => {
    const buf = readFileSync(file)
    const text = buf.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(buf)) {
      console.error(msg(lang, 'inlineUtf8'))
      process.exit(1)
    }
    return text
  }
  let out
  try {
    out = inlineBuild({
      html,
      js: readUtf8(join(assetsDir, refs.js[0] ?? '')),
      css: refs.css[0] ? readUtf8(join(assetsDir, refs.css[0])) : '',
      notices: readUtf8(join(dist, 'THIRD_PARTY_NOTICES.txt')),
    })
  } catch (e) {
    if (e instanceof InlineError) fail(e.problems)
    throw e
  }
  const failed = [...markupChecks(out), ...bundleChecks(out)]
  if (failed.length) {
    console.error(msg(lang, 'inlineChecksFailed', { ids: failed.join(', ') }))
    process.exit(1)
  }
  const bytes = Buffer.from(out, 'utf8')
  if (bytes.toString('utf8') !== out) {
    console.error(msg(lang, 'inlineUtf8'))
    process.exit(1)
  }
  const file = resolve(outArg)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes)
  console.log(msg(lang, 'inlineWrote', { file: outArg, bytes: bytes.length, sha: createHash('sha256').update(bytes).digest('hex') }))
}

// Run only as a CLI (tests import the functions). realpath: /tmp and /var may be symlinks.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) main()
