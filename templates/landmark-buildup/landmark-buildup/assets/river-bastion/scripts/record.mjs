#!/usr/bin/env node
// Exports the film from the single-file build in capture mode (?capture=1): every frame is
// window.__scene.script(t) (a pure function of time) followed by step(1, 1/fps), so the video is
// identical however slow the machine is. By default the whole film (window.__scene.film: 40 s of the
// sample at 30 fps, silent) is recorded in the full 1920×1080 layout; --cover records only the 30 s card
// loop; --embed records the compact layout at 1280×800.
// Writes <out>/film.mp4 and <out>/poster.jpg (at posterAt) through the system ffmpeg.
//
//   npm run record -- --file dist-single/index.html [--out shots] [--cover] [--embed] [--chrome <path>] [--lang en|zh-CN]
//
// Exit codes: 0 ok, 1 failure, 2 usage or Node too old, 3 Chrome or ffmpeg missing.

import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
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
const outDir = resolve(opt('out') ?? join(APP, 'shots'))
const chromePath = opt('chrome') ?? process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chromePath)) {
  console.error(msg(L, 'chromeMissing', { path: chromePath }))
  process.exit(3)
}
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.error(msg(L, 'ffmpegMissing'))
  process.exit(3)
}
const { chromium } = await import('playwright-core')

const html = readFileSync(file)
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  if (path !== '/' && path !== '/index.html') {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': SAMPLE_SITE_CSP })
  res.end(html)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [process.platform === 'darwin' ? '--use-angle=metal' : '--enable-unsafe-swiftshader', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const embed = args.includes('--embed')
const W = embed ? 1280 : 1920
const H = embed ? 800 : 1080
const page = await browser.newPage({ viewport: { width: W, height: H } })
await page.goto(`http://127.0.0.1:${server.address().port}/?capture=1&embed=${embed ? 1 : 0}&lang=${L}&quality=high`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__scene?.ready === true && typeof window.__scene.script === 'function', null, { timeout: 30000 })
const cover = await page.evaluate((onlyCover) => (onlyCover ? window.__scene.cover : window.__scene.film ?? window.__scene.cover), args.includes('--cover'))
console.log(msg(L, 'recordReady', { frames: cover.frames }))
const frames = mkdtempSync(join(tmpdir(), 'scene-frames-'))
const posterFrame = Math.min(cover.frames - 1, Math.round(cover.posterAt * cover.fps))
try {
  for (let i = 0; i < cover.frames; i++) {
    await page.evaluate(
      ({ t, dt }) => {
        window.__scene.script(t)
        window.__scene.step(1, dt)
      },
      { t: i / cover.fps, dt: 1 / cover.fps },
    )
    writeFileSync(join(frames, `f${String(i).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 90 }))
  }
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'film.mp4')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(cover.fps), '-i', join(frames, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(cover.fps), '-movflags', '+faststart', '-an', out])
  copyFileSync(join(frames, `f${String(posterFrame).padStart(5, '0')}.jpg`), join(outDir, 'poster.jpg'))
  console.log(msg(L, 'recordWrote', { file: out }))
} finally {
  rmSync(frames, { recursive: true, force: true })
  await browser.close()
  server.close()
}
