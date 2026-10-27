#!/usr/bin/env node
// First-party loopback verification of the single-file build under the Lab sample CSP. No credentials
// or external inputs. Proves every control (kind, landmark, theme, format, shape, pan, zoom, redraw, marks, tour) with real
// mouse, keyboard or touch input, the before/after state and a pixel difference; checks both languages,
// the full and compact layouts (1600×900 desktop, 390×844 phone, 345×345 embed), a sharp canvas at the
// device pixel ratio, the print export, reduced motion, deterministic capture and the silent audio contract.
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
    }).map((e) => e.dataset.act || e.id || e.tagName)
    const scroll = document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1
    const cv = document.querySelector('#poster')
    const k = (cv.getBoundingClientRect().width * (window.__scene.inspect().facts.dpr)) / cv.width
    return { layout: document.body.dataset.layout, controls: shown.length, bad, scroll, sharp: Math.abs(k - 1) < 0.01, inside: c.width > 100 && c.height > 100 }
  })
  check(`layout-${id}`, box.layout === want && box.inside && box.bad.length === 0 && !box.scroll && box.sharp && box.controls >= 5, box)
}

let stats = {}
try {
  check('markup', markupChecks(html).length === 0, markupChecks(html))
  check('bundle', bundleChecks(html).length === 0, bundleChecks(html))

  // 345×345 embed: compact layout, every control reachable by touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '345×345', lang }))
    const p = await open(345, 345, lang, 'low', '&embed=1&capture=1')
    await p.evaluate(() => window.__scene.script(12))
    await layout(p, `embed-${lang}`, 'compact')
    const a = await facts(p)
    await p.locator('.c-dock [data-act="theme"]').tap()
    await p.waitForTimeout(900)
    const b = await facts(p)
    await p.locator('.c-dock [data-act="shape"]').tap()
    await p.waitForTimeout(900)
    await p.locator('.c-dock [data-act="zoom-in"]').tap()
    const c = await facts(p)
    await p.locator('.c-dock [data-act="kind"]').tap()
    await p.waitForTimeout(900)
    const d = await facts(p)
    check(`embed-touch-${lang}`, b.mode === 'explore' && b.themeIndex === (a.themeIndex + 1) % a.themes && c.shape !== b.shape && c.target.span < b.target.span && d.kind === 'skyline', { a: a.theme, b: b.theme, shape: c.shape, span: c.target.span, kind: d.kind })
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
    check(`autoplay-${lang}-${quality}`, tour.playing && (await facts(p)).filmT > tour.filmT, tour.filmT)
    const f = await rate(p)
    fps[quality]['1600x900'] = Math.round(f)
    check(`fps-${lang}-${quality}`, f >= 24, f)
    await p.locator('.dock [data-act="play"]').click()
    afterAudio.push((await state(p)).audio)
    if (lang === 'en' && quality === 'high') {
      // Let the draw-in finish so every proof starts from the whole poster.
      await p.evaluate(() => window.__scene.act('theme', 0))
      await p.waitForTimeout(900)
      const box = await p.locator('#poster').boundingBox()
      const cx = box.x + box.width / 2, cy = box.y + box.height * 0.4
      await prove(p, 'theme', async () => {
        await p.locator('.dock [data-act="theme"][data-index="1"]').click()
        await p.waitForTimeout(900)
      }, (a, b) => b.theme === 'paper' && a.theme !== 'paper', 3)
      await prove(p, 'shape', async () => {
        await p.keyboard.press('c')
        await p.waitForTimeout(900)
      }, (a, b) => a.shape === 'full' && b.shape === 'circle')
      await prove(p, 'format', () => p.locator('.dock [data-act="format"]').click(), (a, b) => a.format === 'portrait' && b.format === 'square' && b.posterCss[0] === b.posterCss[1])
      await prove(p, 'marks', () => p.keyboard.press('m'), (a, b) => a.marks && !b.marks, 0.05)
      await p.keyboard.press('m')
      await prove(p, 'pan', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.down()
        for (let i = 1; i <= 10; i++) await p.mouse.move(cx - i * 12, cy - i * 6)
        await p.mouse.up()
        await p.waitForTimeout(400)
      }, (a, b) => Math.hypot(b.camera.cx - a.camera.cx, b.camera.cy - a.camera.cy) > 100)
      await prove(p, 'zoom', async () => {
        await p.mouse.move(cx, cy)
        for (let i = 0; i < 4; i++) await p.mouse.wheel(0, -200)
        await p.waitForTimeout(500)
      }, (a, b) => b.camera.span < a.camera.span / 1.8)
      await prove(p, 'draw', async () => {
        await p.locator('.dock [data-act="draw"]').click()
        await p.waitForTimeout(1200)
      }, (a, b) => !a.drawing && b.drawing)
      // Poster kinds: each tab wipes to its kind; the landmark tab, pressed again, moves to the next landmark.
      await p.keyboard.press('c')
      await p.waitForTimeout(900)
      await prove(p, 'kind', async () => {
        await p.locator('.dock [data-act="kind"][data-kind="skyline"]').click()
        await p.waitForTimeout(4200)
      }, (a, b) => a.kind === 'map' && b.kind === 'skyline' && !b.drawing, 3)
      await p.screenshot({ path: join(out, 'kind-skyline.png') })
      await p.locator('.dock [data-act="kind"][data-kind="food"]').click()
      await p.waitForTimeout(4000)
      check('kind-food', (await facts(p)).kind === 'food', null)
      await p.screenshot({ path: join(out, 'kind-food.png') })
      await p.locator('.dock [data-act="kind"][data-kind="landmark"]').click()
      await p.waitForTimeout(4200)
      await prove(p, 'landmark', async () => {
        await p.locator('.dock [data-act="kind"][data-kind="landmark"]').click()
        await p.waitForTimeout(4200)
      }, (a, b) => a.kind === 'landmark' && b.kind === 'landmark' && b.landmark === (a.landmark + 1) % a.landmarkCount, 3)
      await p.screenshot({ path: join(out, 'kind-landmark.png') })
      await p.locator('.dock [data-act="kind"][data-kind="map"]').click()
      await p.waitForTimeout(900)
      await prove(p, 'play', () => p.locator('.dock [data-act="play"]').click(), (a, b) => b.mode === 'tour' && b.playing && b.camera.span > a.camera.span)
      await p.keyboard.press(' ')
      check('space-pauses', !(await facts(p)).playing, null)
      stats = await facts(p)
      check('poster-data', stats.roads > 3000 && stats.roadKm > 300 && stats.water >= 1 && stats.parks > 100 && stats.themes === 5 && stats.markCount === 3 && stats.kinds === 4 && stats.foodPlaces > 1000 && stats.skylineMapped > 1000 && stats.landmarkCount >= 3, { roads: stats.roads, km: stats.roadKm, water: stats.water, parks: stats.parks, kinds: stats.kinds, food: stats.foodPlaces, mapped: stats.skylineMapped, landmarks: stats.landmarkCount })
      // Print export: a real PNG at the requested width and the format's height.
      const png = await p.evaluate(async () => {
        const url = await window.__scene.exportPoster({ theme: 'paper', format: 'portrait', shape: 'full', kind: 'skyline', width: 2400 })
        const img = new Image()
        img.src = url
        await img.decode()
        return { w: img.naturalWidth, h: img.naturalHeight, bytes: url.length }
      })
      check('export-png', png.w === 2400 && png.h === 3200 && png.bytes > 200000, png)
    }
    await layout(p, `desktop-${lang}-${quality}`, 'full')
    await p.screenshot({ path: join(out, `desktop-${lang}-${quality}.png`) })
    await close(p)
  }

  // 390×844 phone: compact layout, touch drag pans.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '390×844', lang }))
    const p = await open(390, 844, lang, null)
    const a = await facts(p)
    check(`mobile-tier-${lang}`, (await state(p)).quality === 'low' && a.layout === 'compact', a.layout)
    const box = await p.locator('#poster').boundingBox()
    const cdp = await p.context().newCDPSession(p)
    const x = box.x + box.width / 2, y = box.y + box.height * 0.4
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 12, y: y - i * 8 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const b = await facts(p)
    check(`touch-pan-${lang}`, b.mode === 'explore' && Math.hypot(b.target.cx - a.camera.cx, b.target.cy - a.camera.cy) > 100, { to: [b.target.cx, b.target.cy] })
    await layout(p, `mobile-${lang}`, 'compact')
    fps.mobile['390x844'] = Math.round(await rate(p))
    await p.screenshot({ path: join(out, `mobile-${lang}.png`) })
    await close(p)
  }

  // Capture is a pure function of time: the same timestamp after other states and a backward seek.
  const cap = await open(1280, 800, 'en', 'high', '&capture=1')
  const ok = await cap.evaluate(() => typeof window.__scene.script === 'function' && typeof window.__scene.step === 'function' && window.__scene.cover.frames <= 900 && window.__scene.film.frames >= 60 * 30)
  check('capture-api', ok, null)
  await cap.evaluate(() => window.__scene.script(18.4))
  const ca = await cap.screenshot()
  await cap.evaluate(() => {
    window.__scene.act('theme', 3)
    window.__scene.act('format', 'landscape')
    window.__scene.act('shape', 'circle')
    window.__scene.act('zoom', 2)
    window.__scene.act('marks')
    window.__scene.act('kind', 'food')
    window.__scene.act('landmark')
    window.__scene.script(40)
    window.__scene.script(3)
    window.__scene.script(18.4)
  })
  const cb = await cap.screenshot()
  const d = await diff(ca, cb)
  check('deterministic-capture', d < 0.05, d)
  const ends = await cap.evaluate(() => [0.5, 10, 16, 23, 30, 36, 42, 57].map((t) => window.__scene.script(t)))
  check('film-progress', ends[0].drawing && !ends[1].drawing && ends[2].theme !== ends[1].theme && ends[3].kind === 'skyline' && ends[4].kind === 'food' && ends[5].kind === 'landmark' && ends[6].kind === 'landmark' && ends[6].landmark !== ends[5].landmark && ends[7].shape === 'circle' && ends[7].kind === 'map', ends.map((e) => [e.kind, e.theme, e.shape, e.drawing]))
  await close(cap)

  // Reduced motion: the tour does not start by itself.
  const reduced = await open(345, 345, 'en', 'low', '&embed=1', { reducedMotion: 'reduce' })
  const r1 = await facts(reduced)
  await reduced.waitForTimeout(250)
  check('reduced-motion', !r1.playing && r1.reducedMotion && (await facts(reduced)).filmT === r1.filmT, r1.filmT)
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
    themes: stats.themes ?? 0,
    roads: stats.roads ?? 0,
    roadKm: stats.roadKm ?? 0,
    water: stats.water ?? 0,
    parks: stats.parks ?? 0,
    marks: stats.markCount ?? 0,
    kinds: stats.kinds ?? 0,
    foodPlaces: stats.foodPlaces ?? 0,
    skylineMapped: stats.skylineMapped ?? 0,
    landmarks: stats.landmarkCount ?? 0,
    duration: stats.duration ?? 0,
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
