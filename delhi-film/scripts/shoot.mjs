#!/usr/bin/env node
// First-party loopback verification of the single-file build under the Lab sample CSP. No credentials
// or external inputs. Proves every control with real mouse, keyboard or touch input, the before/after
// state and a pixel difference; checks both languages, the full and compact layouts (1600×900 desktop,
// 390×844 phone, 345×345 embed), reduced motion, deterministic capture and the gesture-gated score.
//
//   npm run shoot -- --file dist-single/index.html [--out shots] [--chrome <path>] [--lang en|zh-CN]
//
// Exit codes: 0 all checks passed, 1 a check failed, 2 usage or Node too old, 3 Chrome missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleChecks, markupChecks } from './lib/checks.mjs'
import { msg, resolveLang, stripLang } from './lib/messages.mjs'

const { lang: L, invalid } = resolveLang()
if (invalid !== null) console.error(msg(L, 'langInvalid', { value: invalid }))
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 4)) {
  console.error(msg(L, 'nodeTooOld', { need: '22.4', have: process.version }))
  process.exit(2)
}
const args = stripLang(process.argv.slice(2))
const opt = (k) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3))
const file = opt('file')
if (!file) {
  console.error(msg(L, 'shootUsage'))
  process.exit(2)
}
if (!existsSync(file)) {
  console.error(msg(L, 'fileMissing', { file }))
  process.exit(2)
}
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(opt('out') ?? join(APP, 'shots'))
// Default Chrome locations on macOS, Windows and Linux; --chrome or CHROME_PATH override them.
const CHROME_DEFAULTS = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  win32: [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA, 'C:/Program Files', 'C:/Program Files (x86)'].filter(Boolean).map((d) => join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
}[process.platform] ?? []
const chrome = opt('chrome') ?? process.env.CHROME_PATH ?? CHROME_DEFAULTS.find((p) => existsSync(p)) ?? CHROME_DEFAULTS[0] ?? 'chrome'
if (!existsSync(chrome)) {
  console.error(msg(L, 'chromeMissing', { path: chrome }))
  process.exit(3)
}
const SAMPLE_SITE_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
const html = readFileSync(file, 'utf8')
mkdirSync(out, { recursive: true })

let external = 0
const errors = [], csp = [], checks = [], proofs = [], beforeAudio = [], afterAudio = []
const interactions = {}
const fps = { high: {}, low: {}, mobile: {} }
const check = (id, ok, value) => {
  checks.push({ id, ok: !!ok, value })
  if (!ok) console.error(msg(L, 'shootCheckFailed', { id, value: JSON.stringify(value) }))
}
const server = createServer((req, res) => {
  if ((req.url ?? '').split('?')[0] !== '/') {
    external++
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': SAMPLE_SITE_CSP })
  res.end(html)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`
const { chromium } = await import('playwright-core')
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [process.platform === 'darwin' ? '--use-angle=metal' : '--enable-unsafe-swiftshader', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const helper = await browser.newPage()

/** Mean absolute RGB difference (0–255) of two screenshots, sampled at 320×180. */
async function diff(a, b) {
  return helper.evaluate(async ([a, b]) => {
    async function pix(s) {
      const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
      const im = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const c = new OffscreenCanvas(320, 180)
      const g = c.getContext('2d')
      g.drawImage(im, 0, 0, 320, 180)
      return g.getImageData(0, 0, 320, 180).data
    }
    const [x, y] = await Promise.all([pix(a), pix(b)])
    let sum = 0
    for (let i = 0; i < x.length; i += 4) for (let j = 0; j < 3; j++) sum += Math.abs(x[i + j] - y[i + j])
    return sum / (x.length * 0.75)
  }, [a.toString('base64'), b.toString('base64')])
}
const state = (p) => p.evaluate(() => window.__scene.inspect())
const facts = async (p) => (await state(p)).facts

async function open(width, height, lang, quality, extra = '', options = {}) {
  const p = await browser.newPage({ viewport: { width, height }, hasTouch: width < 650, ...options })
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  p.on('request', (r) => {
    if (!r.url().startsWith(base)) external++
  })
  await p.addInitScript(() => {
    window.__violations = []
    addEventListener('securitypolicyviolation', (e) => window.__violations.push(e.violatedDirective))
  })
  await p.goto(`${base}?lang=${lang}${quality ? `&quality=${quality}` : ''}${extra}`)
  await p.waitForFunction(() => window.__scene?.ready)
  return p
}
async function close(p) {
  csp.push(...(await p.evaluate(() => window.__violations)))
  await p.close()
}
/** Runs op, then requires predicate(before, after) and a visible pixel change. */
async function prove(p, id, op, predicate, threshold = 0.5) {
  const old = await facts(p)
  const a = await p.screenshot()
  await op()
  await p.waitForTimeout(250)
  const now = await facts(p)
  const b = await p.screenshot()
  const delta = await diff(a, b)
  const ok = predicate(old, now) && delta > threshold
  interactions[id] = ok
  check(`interaction-${id}`, ok, { delta: Math.round(delta * 100) / 100, threshold })
  proofs.push({ id, before: old, after: now, pixelDiff: delta })
  writeFileSync(join(out, `${id}-before.png`), a)
  writeFileSync(join(out, `${id}-after.png`), b)
}
async function rate(p) {
  return p.evaluate(() => new Promise((done) => {
    let n = 0
    const start = performance.now()
    function f() {
      n++
      if (performance.now() - start > 1500) done((n * 1000) / (performance.now() - start))
      else requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }))
}
/** The scene and every visible control fit the viewport and are not covered by anything else. */
async function layout(p, id, want) {
  const box = await p.evaluate(() => {
    const c = document.querySelector('#world').getBoundingClientRect()
    const shown = [...document.querySelectorAll('button,input')].filter((e) => e.checkVisibility())
    const bad = shown.filter((e) => {
      const r = e.getBoundingClientRect()
      const inside = r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
      return !inside || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button,input') !== e
    }).map((e) => e.id || e.dataset.act || e.dataset.chapter || e.dataset.light || e.dataset.stop || e.tagName)
    const clipped = [...document.querySelectorAll('h1,h2,p,span,strong,small,b')].filter((e) => e.checkVisibility() && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible' && e.clientWidth > 0).length
    return { layout: document.body.dataset.layout, controls: shown.length, bad, clipped, canvas: { x: c.x, y: c.y, w: c.width, h: c.height }, inside: c.width > 100 && c.height > 100 && c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1 }
  })
  check(`layout-${id}`, box.layout === want && box.inside && box.bad.length === 0 && box.controls >= 8, box)
}

let stats = {}
try {
  check('markup', markupChecks(html).length === 0, markupChecks(html))
  check('bundle', bundleChecks(html).length === 0, bundleChecks(html))

  // 345×345 embed: compact layout, every control reachable by touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '345×345', lang }))
    const p = await open(345, 345, lang, 'low', '&embed=1&capture=1')
    await p.evaluate(() => window.__scene.script(1))
    await layout(p, `embed-${lang}`, 'compact')
    const a = await facts(p)
    await p.locator('[data-chapter="1"]:visible').tap()
    await p.locator('[data-act="zoom-in"]:visible').tap()
    await p.locator('[data-act="lanterns"]:visible').tap()
    const b = await facts(p)
    check(`embed-touch-${lang}`, b.chapter === 'facade' && b.distance < a.distance && b.lanterns === !a.lanterns, { chapter: b.chapter, distance: b.distance, lanterns: b.lanterns })
    await p.locator('[data-act="reset"]:visible').tap()
    await p.screenshot({ path: join(out, `embed-${lang}.png`) })
    await close(p)
  }

  // 1600×900 desktop, full editorial layout.
  for (const [lang, quality] of [['en', 'high'], ['zh-CN', 'high'], ['en', 'low']]) {
    console.log(msg(L, 'shootViewport', { size: '1600×900', lang }))
    const p = await open(1600, 900, lang, quality)
    beforeAudio.push((await state(p)).audio)
    const tour = await facts(p)
    await p.waitForTimeout(400)
    check(`autoplay-${lang}-${quality}`, tour.playing && (await facts(p)).time > tour.time, tour.time)
    const f = await rate(p)
    fps[quality]['1600x900'] = Math.round(f)
    check(`fps-${lang}-${quality}`, f >= 20, f)
    // The sound button is the gesture that creates the AudioContext; the second click mutes again.
    await p.locator('[data-act="sound"][data-style="long"]').click()
    await p.waitForTimeout(300)
    afterAudio.push((await state(p)).audio)
    check(`sound-unmutes-${lang}-${quality}`, (await facts(p)).muted === false, null)
    await p.locator('[data-act="sound"][data-style="long"]').click()
    check(`sound-mutes-${lang}-${quality}`, (await facts(p)).muted === true, null)
    await p.locator('[data-act="play"][data-style="long"]').click()
    if (lang === 'en' && quality === 'high') {
      const canvas = await p.locator('#world').boundingBox()
      const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2
      await prove(p, 'chapter', () => p.locator('[data-chapter="2"]:visible').click(), (a, b) => b.chapter === 'crown' && b.mode === 'free')
      await prove(p, 'orbit', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.down()
        await p.mouse.move(cx + 220, cy + 30, { steps: 10 })
        await p.mouse.up()
      }, (a, b) => Math.abs(b.yaw - a.yaw) > 0.1)
      await prove(p, 'zoom', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.wheel(0, 260)
      }, (a, b) => b.distance > a.distance + 1)
      await prove(p, 'light', () => p.locator('[data-light="0"]').click(), (a, b) => a.light > 0.5 && b.light === 0, 3)
      const label = await p.evaluate(() => document.querySelector('.light-nav button.active')?.textContent)
      check('light-label', label === 'Daylight', label)
      await prove(p, 'lanterns', async () => {
        await p.locator('[data-light="1"]').click()
        await p.waitForTimeout(100)
        await p.locator('[data-act="lanterns"][data-style="long"]').click()
      }, (a, b) => a.lanterns && !b.lanterns && b.light === 1, 0.3)
      await p.locator('[data-act="lanterns"][data-style="long"]').click()
      // Paused life holds still; resuming moves cars, walkers, clouds and the fountain again.
      await p.locator('[data-chapter="0"]:visible').click()
      await p.locator('[data-act="life"]').click()
      await prove(p, 'life', async () => {
        await p.locator('[data-act="life"]').click()
        await p.waitForTimeout(1500)
      }, (a, b) => !a.lifeRunning && b.lifeRunning && b.life > a.life, 0.05)
      const paused = await p.evaluate(async () => {
        document.querySelector('[data-act="life"]').click()
        const a = window.__scene.inspect().facts.life
        await new Promise((r) => setTimeout(r, 300))
        const b = window.__scene.inspect().facts.life
        document.querySelector('[data-act="life"]').click()
        return { a, b }
      })
      check('life-pauses', paused.a === paused.b, paused)
      // A press that does not move on the landmark opens its card; Escape closes it.
      await prove(p, 'card', async () => {
        await p.locator('[data-chapter="1"]:visible').click()
        await p.waitForTimeout(100)
        await p.mouse.click(cx, cy)
      }, (a, b) => b.card === true, 2)
      await p.keyboard.press('Escape')
      check('card-closes', (await facts(p)).card === false, null)
      await prove(p, 'scrub', async () => {
        const track = await p.locator('#scrub').boundingBox()
        await p.mouse.click(track.x + track.width * 0.9, track.y + track.height / 2)
      }, (a, b) => b.mode === 'film' && b.time > 45 && b.chapter === 'stars', 2)
      await prove(p, 'reset', () => p.locator('[data-act="reset"]:visible').click(), (a, b) => b.mode === 'film' && b.time === 0 && b.chapter === 'garden')
      await prove(p, 'play', () => p.locator('[data-act="play"][data-style="long"]').click(), (a, b) => b.playing && b.time > a.time, 0.1)
      await p.locator('[data-act="play"][data-style="long"]').click()
      check('play-pauses', !(await facts(p)).playing, null)
      stats = await facts(p)
      check('triangle-budget', stats.triangles > 100000 && stats.triangles < 3000000, stats.triangles)
      check('chapter-count', stats.chapters === 4, stats.chapters)
    }
    await p.evaluate(() => window.__scene.act('reset'))
    await layout(p, `desktop-${lang}-${quality}`, 'full')
    await p.screenshot({ path: join(out, `desktop-${lang}-${quality}.png`) })
    await close(p)
  }

  // 390×844 phone: compact layout with touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '390×844', lang }))
    const p = await open(390, 844, lang, null)
    await p.locator('[data-act="play"]:visible').tap()
    const a = await facts(p)
    check(`mobile-tier-${lang}`, (await state(p)).quality === 'low' && a.layout === 'compact', a.layout)
    await p.locator('[data-act="zoom-out"]:visible').tap()
    check(`touch-zoom-${lang}`, (await facts(p)).distance > a.distance, null)
    const box = await p.locator('#world').boundingBox()
    const cdp = await p.context().newCDPSession(p)
    const y = box.y + box.height / 2
    const before = await facts(p)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120 + i * 14, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    check(`touch-orbit-${lang}`, Math.abs((await facts(p)).yaw - before.yaw) > 0.1, null)
    await p.locator('[data-act="reset"]:visible').tap()
    await layout(p, `mobile-${lang}`, 'compact')
    fps.mobile['390x844'] = Math.round(await rate(p))
    await p.screenshot({ path: join(out, `mobile-${lang}.png`) })
    await close(p)
  }

  // Capture is a pure function of time: the same timestamp after other states and a backward seek.
  const cap = await open(1280, 720, 'en', 'high', '&capture=1')
  const ok = await cap.evaluate(() => typeof window.__scene.script === 'function' && typeof window.__scene.step === 'function' && window.__scene.cover.frames === window.__scene.cover.fps * 60)
  check('capture-api', ok, null)
  await cap.evaluate(() => window.__scene.script(25))
  const ca = await cap.screenshot()
  await cap.evaluate(() => {
    window.__scene.act('chapter', 3)
    window.__scene.act('light', 0.1)
    window.__scene.act('zoom', 1.3)
    window.__scene.script(45)
    window.__scene.script(5)
    window.__scene.script(25)
    window.__scene.step(1, 1 / 30)
  })
  const cb = await cap.screenshot()
  const d = await diff(ca, cb)
  check('deterministic-capture', d < 0.05, d)
  const light = await cap.evaluate(() => [0, 22, 37.5, 53, 60].map((t) => window.__scene.script(t).light))
  check('golden-to-stars', Math.abs(light[0] - 1 / 3) < 1e-9 && Math.abs(light[1] - 1 / 3) < 1e-9 && light[2] > 0.5 && light[2] < 0.9 && light[3] === 1 && light[4] === 1, light)
  const chapters = await cap.evaluate(() => [1, 16, 31, 46].map((t) => window.__scene.script(t).chapter))
  check('film-chapters', chapters.join() === 'garden,facade,crown,stars', chapters)
  await close(cap)

  // Reduced motion: the tour does not start by itself.
  const reduced = await open(345, 345, 'en', 'low', '&embed=1', { reducedMotion: 'reduce' })
  const r1 = await facts(reduced)
  await reduced.waitForTimeout(250)
  check('reduced-motion', !r1.playing && r1.reducedMotion && (await facts(reduced)).time === r1.time, r1.time)
  await close(reduced)

  check('console-errors', errors.length === 0, errors.length)
  check('external-requests', external === 0, external)
  check('csp-violations', csp.length === 0, csp.length)
  check('audio-before', beforeAudio.every((x) => x === 'uninitialised'), beforeAudio.join(','))
  check('audio-after-gesture', afterAudio.every((x) => x === 'running'), afterAudio.join(','))
} catch (e) {
  check('harness', false, e.message)
  console.error(e)
} finally {
  await browser.close()
  server.close()
}

const report = {
  when: new Date().toISOString(),
  ok: checks.every((c) => c.ok),
  fps,
  checks,
  interactions,
  facts: {
    chapters: stats.chapters ?? 0,
    duration: stats.duration ?? 0,
    spires: stats.spires ?? 0,
    houses: stats.houses ?? 0,
    triangles: stats.triangles ?? 0,
    embedVerified: checks.filter((c) => c.id.includes('embed')).every((c) => c.ok),
  },
  proofs,
  errors,
  csp,
}
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
const esc = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
for (const lang of ['en', 'zh-CN']) {
  const m = (k, v) => esc(msg(lang, k, v))
  const fpsRows = [['high', '1600×900'], ['low', '1600×900'], ['mobile', '390×844']].map(([tier, size]) => `<tr><td>${tier === 'mobile' ? m('reportMobile') : tier}</td><td>${size}</td><td>${esc(fps[tier][size.replace('×', 'x')] ?? '—')}</td></tr>`).join('')
  writeFileSync(join(out, `report.${lang}.html`), `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${m('reportTitle')}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;background:#f4f3eb;color:#343b30}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{padding:8px 10px;border-bottom:1px solid #d6d5c9;text-align:left;vertical-align:top}td:last-child{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}</style></head><body><h1>${m('reportTitle')}</h1><p>${m('reportIntro')}</p><p><b>${report.ok ? m('reportSummaryOk') : m('reportSummaryFail')}</b></p><h2>${m('reportFps')}</h2><table><tr><th>${m('reportTier')}</th><th>${m('reportViewport')}</th><th>fps</th></tr>${fpsRows}</table><table><tr><th>${m('reportCheck')}</th><th>${m('reportResult')}</th><th>${m('reportValue')}</th></tr>${checks.map((c) => `<tr><td>${esc(c.id)}</td><td>${c.ok ? m('reportPass') : m('reportFail')}</td><td>${esc(JSON.stringify(c.value))}</td></tr>`).join('')}</table><p>${m('reportWhen')}: ${esc(report.when)} · ${m('reportNode')}: ${esc(process.version)}</p><p>${m('reportShots')}</p></body></html>\n`)
}
const passed = checks.filter((c) => c.ok).length
console.log(msg(L, 'shootDone', { result: report.ok ? msg(L, 'resultPass') : msg(L, 'resultFail'), passed, total: checks.length, file: join(out, 'report.json') }))
process.exitCode = report.ok ? 0 : 1
