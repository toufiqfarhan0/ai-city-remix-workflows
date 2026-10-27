#!/usr/bin/env node
// Exports print-size PNG posters from the single-file build: window.__scene.exportPoster renders the poster
// again at the requested width (the format sets the height), with no page controls around it.
//
//   node scripts/poster.mjs --file dist-single/index.html [--out posters] [--kind map|skyline|food|landmark|all]
//        [--theme noir|paper|…|all]
//        [--format portrait|square|landscape] [--shape full|circle] [--width 3600] [--chrome <path>] [--lang en|zh-CN]
//
// Exit codes: 0 ok, 1 failure, 2 usage or Node too old, 3 Chrome missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { msg, resolveLang, stripLang } from './lib/messages.mjs'

const SAMPLE_SITE_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { lang: L, invalid } = resolveLang()
if (invalid !== null) console.error(msg(L, 'langInvalid', { value: invalid }))
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 4)) {
  console.error(msg(L, 'nodeTooOld', { need: '22.4', have: process.version }))
  process.exit(2)
}
const args = stripLang(process.argv.slice(2))
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  if (i >= 0) return args[i + 1]
  return args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}
const file = opt('file') ?? join(APP, 'dist-single/index.html')
if (!existsSync(file)) {
  console.error(msg(L, 'fileMissing', { file }))
  process.exit(2)
}
const format = opt('format') ?? 'portrait'
const shape = opt('shape') ?? 'full'
const width = Number(opt('width') ?? 3600)
if (!['portrait', 'square', 'landscape'].includes(format) || !['full', 'circle'].includes(shape) || !(width >= 600 && width <= 9000)) {
  console.error(msg(L, 'posterUsage'))
  process.exit(2)
}
const outDir = resolve(opt('out') ?? join(APP, 'posters'))
const chromePath = opt('chrome') ?? process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chromePath)) {
  console.error(msg(L, 'chromeMissing', { path: chromePath }))
  process.exit(3)
}
const { chromium } = await import('playwright-core')
const html = readFileSync(file)
const server = createServer((req, res) => {
  if ((req.url ?? '/').split('?')[0] !== '/') {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': SAMPLE_SITE_CSP })
  res.end(html)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture=1&lang=${L}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__scene?.ready === true, null, { timeout: 30000 })
  const facts = await page.evaluate(() => window.__scene.inspect().facts)
  const ids = facts.themeIds
  const wanted = opt('theme') ?? 'all'
  const list = wanted === 'all' ? ids : [wanted]
  const kindWanted = opt('kind') ?? 'map'
  const kinds = kindWanted === 'all' ? facts.kindIds : [kindWanted]
  if (list.some((id) => !ids.includes(id))) {
    console.error(msg(L, 'posterTheme', { theme: wanted, themes: ids.join(', ') }))
    process.exitCode = 2
  } else if (kinds.some((k) => !facts.kindIds.includes(k))) {
    console.error(msg(L, 'posterKind', { kind: kindWanted, kinds: facts.kindIds.join(', ') }))
    process.exitCode = 2
  } else {
    mkdirSync(outDir, { recursive: true })
    for (const kind of kinds) for (const landmark of kind === 'landmark' ? facts.landmarkNames.map((_, i) => i) : [0]) for (const theme of list) {
      const url = await page.evaluate((o) => window.__scene.exportPoster(o), { kind, landmark, theme, format, shape, width })
      const tag = kind === 'landmark' ? `landmark${landmark + 1}` : kind
      const out = join(outDir, `poster-${tag}-${theme}-${format}-${shape}.png`)
      writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
      console.log(msg(L, 'posterWrote', { file: out }))
    }
  }
} finally {
  await browser.close()
  server.close()
}
