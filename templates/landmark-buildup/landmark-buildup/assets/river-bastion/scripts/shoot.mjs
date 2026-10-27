#!/usr/bin/env node
// First-party loopback verification of the single-file build under the Lab sample CSP. No credentials
// or external inputs. Proves every control with real mouse, keyboard or touch input, the before/after
// state and a pixel difference; checks both languages, the full and compact layouts (1600×900 desktop,
// 390×844 phone, 345×345 embed), reduced motion, deterministic capture and the silent audio contract.
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
const chrome = opt('chrome') ?? process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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
    const c = document.querySelector('#stage').getBoundingClientRect()
    const shown = [...document.querySelectorAll('button,input')].filter((e) => e.checkVisibility())
    const bad = shown.filter((e) => {
      const r = e.getBoundingClientRect()
      const inside = r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
      return !inside || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button,input') !== e
    }).map((e) => e.id || e.dataset.act || e.dataset.view || e.tagName)
    const clipped = [...document.querySelectorAll('h1,h2,p,span,strong,small,b')].filter((e) => e.checkVisibility() && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible' && e.clientWidth > 0).length
    return { layout: document.body.dataset.layout, controls: shown.length, bad, clipped, canvas: { x: c.x, y: c.y, w: c.width, h: c.height }, inside: c.width > 100 && c.height > 100 && c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1 }
  })
  check(`layout-${id}`, box.layout === want && box.inside && box.bad.length === 0 && box.controls >= 4, box)
}

let stats = {}
try {
  check('markup', markupChecks(html).length === 0, markupChecks(html))
  check('bundle', bundleChecks(html).length === 0, bundleChecks(html))

  // 345×345 embed: compact layout, every control reachable by touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '345×345', lang }))
    const p = await open(345, 345, lang, 'low', '&embed=1&capture=1')
    await p.evaluate(() => window.__scene.script(14))
    await layout(p, `embed-${lang}`, 'compact')
    const a = await facts(p)
    await p.locator('#c-view').tap()
    const b = await facts(p)
    await p.locator('.c-dock [data-act="zoom-in"]').tap()
    const c = await facts(p)
    await p.locator('.c-dock [data-act="reset"]').tap()
    const d = await facts(p)
    check(`embed-touch-${lang}`, b.mode === 'free' && b.preset !== a.preset && b.build === 1 && c.distance < b.distance && d.preset === 'overview', { a: a.preset, b: b.preset })
    await p.screenshot({ path: join(out, `embed-${lang}.png`) })
    await close(p)
  }

  // 1600×900 desktop, full layout.
  for (const [lang, quality] of [['en', 'high'], ['zh-CN', 'high'], ['en', 'low']]) {
    console.log(msg(L, 'shootViewport', { size: '1600×900', lang }))
    const p = await open(1600, 900, lang, quality)
    beforeAudio.push((await state(p)).audio)
    const tour = await facts(p)
    await p.waitForTimeout(400)
    check(`autoplay-${lang}-${quality}`, tour.playing && (await facts(p)).time > tour.time, tour.time)
    const f = await rate(p)
    fps[quality]['1600x900'] = Math.round(f)
    check(`fps-${lang}-${quality}`, f >= 24, f)
    await p.locator('.dock [data-act="play"]').click()
    afterAudio.push((await state(p)).audio)
    if (lang === 'en' && quality === 'high') {
      const box = await p.locator('#world').boundingBox()
      const cx = box.x + box.width * 0.4, cy = box.y + box.height / 2
      await prove(p, 'build', async () => {
        await p.locator('.dock [data-act="build"]').focus()
        await p.keyboard.press('End')
      }, (a, b) => b.build === 1 && b.placed === b.pieces && a.placed < b.placed)
      // The fourth stage and the second view preset, whatever the recipe calls them.
      const stageId = await p.evaluate(() => document.querySelectorAll('[data-stage]')[3].dataset.stage)
      const viewId = await p.evaluate(() => document.querySelectorAll('[data-view]')[1].dataset.view)
      await prove(p, 'stage', () => p.locator(`[data-stage="${stageId}"] button`).click(), (a, b) => b.stage === stageId && b.placed < a.placed && b.placed > 0)
      await prove(p, 'view', () => p.locator(`[data-view="${viewId}"]`).click(), (a, b) => b.preset === viewId && b.distance < a.distance && b.build === 1)
      await prove(p, 'orbit', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.down()
        await p.mouse.move(cx + 220, cy + 30, { steps: 10 })
        await p.mouse.up()
      }, (a, b) => Math.abs(b.yaw - a.yaw) > 0.3)
      await prove(p, 'zoom', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.wheel(0, 300)
      }, (a, b) => b.distance > a.distance + 1)
      await prove(p, 'light', async () => {
        await p.locator('.dock [data-act="light"]').focus()
        await p.keyboard.press('End')
      }, (a, b) => b.light === 1 && a.light < 0.5, 3)
      const label = await p.evaluate(() => document.querySelector('#light-label').textContent)
      check('light-label', label === 'Dusk', label)
      await p.locator('.dock [data-act="reset"]').click()
      await prove(p, 'explode', async () => {
        await p.locator('.dock [data-act="explode"]').focus()
        await p.keyboard.press('End')
      }, (a, b) => b.explode === 1 && a.explode === 0 && b.build === 1, 1)
      const xl = await p.evaluate(() => document.querySelector('#explode-label').textContent)
      check('explode-label', xl === '100%', xl)
      await p.locator('.dock [data-act="reset"]').click()
      await prove(p, 'play', () => p.locator('.dock [data-act="play"]').click(), (a, b) => b.playing && !a.playing)
      await p.keyboard.press(' ')
      check('space-pauses', !(await facts(p)).playing, null)
      stats = await facts(p)
      check('piece-budget', stats.pieces > 3000 && stats.pieces < 20000 && stats.drawCalls < 80, { pieces: stats.pieces, drawCalls: stats.drawCalls })
    }
    await layout(p, `desktop-${lang}-${quality}`, 'full')
    await p.screenshot({ path: join(out, `desktop-${lang}-${quality}.png`) })
    await close(p)
  }

  // 390×844 phone: compact layout with touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '390×844', lang }))
    const p = await open(390, 844, lang, null)
    await p.locator('.c-dock [data-act="play"]').tap()
    const a = await facts(p)
    check(`mobile-tier-${lang}`, (await state(p)).quality === 'low' && a.layout === 'compact', a.layout)
    const box = await p.locator('#world').boundingBox()
    const cdp = await p.context().newCDPSession(p)
    const y = box.y + box.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120 + i * 18, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    check(`touch-orbit-${lang}`, Math.abs((await facts(p)).yaw - a.yaw) > 0.2, null)
    await layout(p, `mobile-${lang}`, 'compact')
    fps.mobile['390x844'] = Math.round(await rate(p))
    await p.screenshot({ path: join(out, `mobile-${lang}.png`) })
    await close(p)
  }

  // Capture is a pure function of time: the same timestamp after other states and a backward seek.
  const cap = await open(1280, 720, 'en', 'high', '&capture=1')
  const ok = await cap.evaluate(() => typeof window.__scene.script === 'function' && typeof window.__scene.step === 'function' && window.__scene.cover.frames <= 900 && window.__scene.film.frames >= window.__scene.film.fps * 30)
  check('capture-api', ok, null)
  await cap.evaluate(() => window.__scene.script(18))
  const ca = await cap.screenshot()
  await cap.evaluate(() => {
    window.__scene.act('view', document.querySelectorAll('[data-view]')[2].dataset.view)
    window.__scene.act('explode', 0.7)
    window.__scene.act('light', 0.9)
    window.__scene.act('build', 0.2)
    window.__scene.script(38)
    window.__scene.script(3)
    window.__scene.script(18)
  })
  const cb = await cap.screenshot()
  const d = await diff(ca, cb)
  check('deterministic-capture', d < 0.05, d)
  const ends = await cap.evaluate(() => { const d = window.__scene.film.frames / window.__scene.film.fps; return [0, d * 0.35, d * 0.995].map((t) => window.__scene.script(t)) })
  check('build-order', ends[0].placed === 0 && ends[1].placed > 0 && ends[1].placed < ends[2].placed && ends[2].placed === ends[2].pieces && ends[2].light === 1 && ends[2].explode === 0, ends.map((e) => [e.placed, e.light, e.explode]))
  await close(cap)

  // Reduced motion: the build does not start by itself.
  const reduced = await open(345, 345, 'en', 'low', '&embed=1', { reducedMotion: 'reduce' })
  const r1 = await facts(reduced)
  await reduced.waitForTimeout(250)
  check('reduced-motion', !r1.playing && r1.reducedMotion && (await facts(reduced)).time === r1.time, r1.time)
  await close(reduced)

  check('console-errors', errors.length === 0, errors.length)
  check('external-requests', external === 0, external)
  check('csp-violations', csp.length === 0, csp.length)
  check('audio-before', beforeAudio.every((x) => x === 'none'), beforeAudio.join(','))
  check('audio-after-gesture', afterAudio.every((x) => x === 'none'), afterAudio.join(','))
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
    pieces: stats.pieces ?? 0,
    stages: stats.stages ?? 0,
    duration: stats.duration ?? 0,
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
