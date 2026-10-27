#!/usr/bin/env node
// First-party loopback verification of the single-file build under the Lab sample CSP. No credentials
// or external inputs. Proves every control with real mouse, wheel or touch input, the before/after
// state and a pixel difference; checks both languages, the full and compact layouts (1600×900 desktop,
// 390×844 phone, 345×345 embed), the controls hidden inside the sandbox, reduced motion,
// deterministic capture and the silent audio contract.
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
const chrome = opt('chrome') ?? process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
if (!existsSync(chrome)) {
  console.error(msg(L, 'chromeMissing', { path: chrome }))
  process.exit(3)
}
const SAMPLE_SITE_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
// The same policy without the sandbox: a plain file opened outside Lab, where downloads and fullscreen work.
const OPEN_CSP = SAMPLE_SITE_CSP.replace(/^sandbox allow-scripts; /, '')
const STRINGS = JSON.parse(readFileSync(join(APP, 'src/i18n/strings.json'), 'utf8'))
const html = readFileSync(file, 'utf8')
mkdirSync(out, { recursive: true })

// Landmark ids, their strings.json prefix and the camera target of their view (x, look height, z).
const LANDMARKS = [
  ['empire', 'lmEmpire', [-0.8, 4.7, -1.5]],
  ['chrysler', 'lmChrysler', [1.8, 4.65, -3.4]],
  ['one-world', 'lmOneWorld', [-1.3, 5.1, 11]],
  ['central-park', 'lmCentralPark', [0, 1, -9.8]],
  ['times-square', 'lmTimesSquare', [-1.7, 1.8, -4.4]],
  ['flatiron', 'lmFlatiron', [-0.65, 1.9, 1.7]],
  ['rockefeller', 'lmRockefeller', [-0.65, 3.1, -5.7]],
  ['vessel', 'lmVessel', [-2.65, 1.4, -0.55]],
]
const FLIGHT_MS = 1700 // camera flights take 1.4 s
const CJK = /[\u3400-\u9fff]/

let external = 0
const errors = [], warnings = [], csp = [], checks = [], proofs = [], beforeAudio = [], afterAudio = []
const interactions = {}
const fps = { high: {}, low: {}, mobile: {} }
const check = (id, ok, value) => {
  checks.push({ id, ok: !!ok, value })
  if (!ok) console.error(msg(L, 'shootCheckFailed', { id, value: JSON.stringify(value) }))
}
const server = createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0]
  if (path !== '/' && path !== '/open') {
    external++
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': path === '/open' ? OPEN_CSP : SAMPLE_SITE_CSP })
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
const inspect = (p) => p.evaluate(() => window.__scene.inspect())
const live = async (p) => (await inspect(p)).state
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const round = (v) => Math.round(v * 1000) / 1000
/** Camera position from the spherical state (three.js convention: theta around y from +z). */
const position = (s) => [
  s.target[0] + s.distance * Math.sin(s.polar) * Math.sin(s.azimuth),
  s.target[1] + s.distance * Math.cos(s.polar),
  s.target[2] + s.distance * Math.sin(s.polar) * Math.cos(s.azimuth),
]

async function open(width, height, lang, quality, extra = '', options = {}, path = '') {
  const p = await browser.newPage({ viewport: { width, height }, hasTouch: width < 650, ...options })
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    else if (m.type() === 'warning') warnings.push(m.text())
  })
  p.on('request', (r) => {
    if (!r.url().startsWith(base)) external++
  })
  await p.addInitScript(() => {
    window.__violations = []
    addEventListener('securitypolicyviolation', (e) => window.__violations.push(e.violatedDirective))
  })
  const start = Date.now()
  await p.goto(`${base}${path}?lang=${lang}${quality ? `&quality=${quality}` : ''}${extra}`)
  await p.waitForFunction(() => window.__scene?.ready, null, { timeout: 30000 })
  p.readyMs = Date.now() - start
  return p
}
async function close(p) {
  csp.push(...(await p.evaluate(() => window.__violations)))
  await p.close()
}
/** Runs op, waits, then requires predicate(before, after) and a visible pixel change. */
async function prove(p, id, op, predicate, { wait = 250, threshold = 0.5 } = {}) {
  const old = await live(p)
  const a = await p.screenshot()
  const extra = (await op()) ?? {}
  await p.waitForTimeout(wait)
  const now = await live(p)
  const b = await p.screenshot()
  const delta = await diff(a, b)
  const ok = !!(await predicate(old, now, extra)) && delta > threshold
  interactions[id] = ok
  check(`interaction-${id}`, ok, { delta: Math.round(delta * 100) / 100, threshold, ...extra })
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
      if (performance.now() - start > 2000) done((n * 1000) / (performance.now() - start))
      else requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }))
}
/** The canvas and every visible control fit the viewport and are not covered by anything else. */
async function layout(p, id, want) {
  const box = await p.evaluate(() => {
    const c = document.querySelector('.canvas canvas').getBoundingClientRect()
    const shown = [...document.querySelectorAll('button')].filter((e) => e.checkVisibility())
    const bad = shown.filter((e) => {
      const r = e.getBoundingClientRect()
      const inside = r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
      return !inside || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') !== e
    }).map((e) => e.dataset.act || e.dataset.landmark || e.getAttribute('aria-label') || e.tagName)
    return { layout: document.body.dataset.layout, controls: shown.length, bad, canvas: { w: c.width, h: c.height }, inside: c.width > 100 && c.height > 100 && c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1 }
  })
  const ok = box.layout === want && box.inside && box.bad.length === 0 && box.controls >= 14
  check(`layout-${id}`, ok, box)
  return ok
}
const visible = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].some((e) => e.checkVisibility()), sel)
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel)
/** Clicks (or taps) a landmark and reports whether button, card and camera all agree. */
async function landmarkState(p, i, lang) {
  const [id, key, target] = LANDMARKS[i]
  const s = await live(p)
  const ui = await p.evaluate((id) => {
    const b = document.querySelector(`[data-landmark="${id}"]`)
    return { pressed: b?.getAttribute('aria-pressed'), chosen: b?.classList.contains('chosen'), card: document.querySelector('.landmark-info h2')?.textContent ?? null }
  }, id)
  const off = dist3(s.target, target)
  const ok = s.selected === id && ui.card === STRINGS[lang][`${key}Name`] && ui.pressed === 'true' && ui.chosen && off < 0.3 && !s.transition
  return { ok, id, selected: s.selected, card: ui.card, pressed: ui.pressed, off: round(off), transition: s.transition, cameraClear: s.cameraClear }
}

let stats = { facts: {} }
let cameraClear = false
try {
  check('markup', markupChecks(html).length === 0, markupChecks(html))
  check('bundle', bundleChecks(html).length === 0, bundleChecks(html))

  // 345×345 embed in capture mode: compact layout, every control reachable by touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '345×345', lang }))
    const p = await open(345, 345, lang, 'low', '&embed=1&capture=1')
    const fit = await layout(p, `embed-${lang}`, 'compact')
    const hint = await text(p, '.hint')
    const hintOk = !!hint && (lang === 'zh-CN' ? CJK.test(hint) : !CJK.test(hint))
    const a = await live(p)
    await p.locator('[data-landmark="empire"]:visible').tap()
    await p.evaluate(() => window.__scene.step(50))
    const lm = await landmarkState(p, 0, lang)
    const withCard = await layout(p, `embed-card-${lang}`, 'compact')
    await p.locator('[data-act="night"]:visible').tap()
    await p.evaluate(() => window.__scene.step(75))
    const nightOn = (await live(p)).night > 0.9
    const z0 = (await live(p)).distance
    await p.locator('[data-act="zoom-in"]:visible').tap()
    await p.evaluate(() => window.__scene.step(50))
    const zoomed = (await live(p)).distance < z0 - 0.5
    await p.screenshot({ path: join(out, `embed-${lang}.png`) })
    await p.locator('[data-act="reset"]:visible').tap()
    await p.evaluate(() => window.__scene.step(50))
    const b = await live(p)
    const back = b.selected === null && dist3(b.target, a.target) < 0.2
    check(`embed-touch-${lang}`, fit && withCard && hintOk && lm.ok && nightOn && zoomed && back, { hint, landmark: lm, nightOn, zoomed, back })
    await close(p)
  }

  // 1600×900 desktop, full layout.
  for (const [lang, quality] of [['en', 'high'], ['zh-CN', 'high'], ['en', 'low']]) {
    console.log(msg(L, 'shootViewport', { size: '1600×900', lang }))
    const p = await open(1600, 900, lang, quality)
    check(`ready-time-${lang}-${quality}`, p.readyMs <= 10000, p.readyMs)
    const first = await inspect(p)
    beforeAudio.push(first.audio)
    await p.waitForTimeout(500)
    const f = await rate(p)
    fps[quality]['1600x900'] = Math.round(f)
    check(`fps-${lang}-${quality}`, f >= 24, Math.round(f * 10) / 10)
    await layout(p, `desktop-${lang}-${quality}`, 'full')
    if (lang === 'en' && quality === 'high') {
      stats = first
      const home = first.state
      // Inside the sandbox: no downloads, pop-ups or fullscreen; the brand stays visible but is not a link.
      const hidden = {
        screenshot: await visible(p, '[data-act="screenshot"]'),
        fullscreen: await visible(p, '[data-act="fullscreen"]'),
        edition: await visible(p, '.edition'),
        brand: await visible(p, 'span.brand'),
        brandLink: await visible(p, 'a.brand'),
      }
      check('restricted-controls', !hidden.screenshot && !hidden.fullscreen && !hidden.edition && hidden.brand && !hidden.brandLink, hidden)
      const canvas = await p.locator('.canvas canvas').boundingBox()
      const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2
      await prove(p, 'landmark', () => p.locator('[data-landmark="empire"]').click(), async () => (await landmarkState(p, 0, lang)).ok, { wait: FLIGHT_MS })
      const lmAgain = await landmarkState(p, 0, lang)
      proofs.at(-1).landmark = lmAgain
      if (!interactions.landmark) check('landmark-detail', false, lmAgain)
      await p.locator('[data-act="reset"]').click()
      await p.waitForTimeout(FLIGHT_MS)
      await prove(p, 'night', () => p.locator('[data-act="night"]').click(), async (a, b) => {
        const pressed = await p.evaluate(() => document.querySelector('[data-act="night"]').getAttribute('aria-pressed'))
        return a.night < 0.1 && b.night > 0.9 && pressed === 'true' && (await text(p, '.status')) === STRINGS[lang].statusNight
      }, { wait: 2500, threshold: 3 })
      await p.locator('[data-act="day"]').click()
      await p.waitForTimeout(2500)
      await prove(p, 'orbit', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.down()
        await p.mouse.move(cx + 220, cy + 10, { steps: 12 })
        await p.mouse.up()
      }, (a, b) => Math.abs(b.azimuth - a.azimuth) > 0.1, { wait: 600 })
      await prove(p, 'pan', async () => {
        await p.mouse.move(cx, cy)
        await p.mouse.down({ button: 'right' })
        await p.mouse.move(cx + 160, cy + 90, { steps: 12 })
        await p.mouse.up({ button: 'right' })
      }, (a, b) => dist3(a.target, b.target) > 0.2 && Math.abs(b.azimuth - a.azimuth) < 0.05, { wait: 600 })
      let mid = null
      await prove(p, 'zoom', async () => {
        const before = (await live(p)).distance
        await p.mouse.move(cx, cy)
        await p.mouse.wheel(0, 260)
        await p.waitForTimeout(500)
        mid = await live(p)
        await p.locator('[data-act="zoom-in"]').click()
        return { before: round(before), wheel: round(mid.distance) }
      }, (a, b) => mid.distance > a.distance + 1 && b.distance < mid.distance - 1 && !b.transition, { wait: FLIGHT_MS })
      await p.locator('[data-landmark="flatiron"]').click()
      await p.waitForTimeout(FLIGHT_MS)
      await p.locator('[data-act="rotate"]').click()
      await prove(p, 'reset', () => p.locator('[data-act="reset"]').click(), (a, b) =>
        a.selected === 'flatiron' && dist3(position(b), position(home)) < 0.5 && dist3(b.target, home.target) < 0.2 && b.selected === null && !b.rotating && !b.transition, { wait: FLIGHT_MS })
      await prove(p, 'rotate', () => p.locator('[data-act="rotate"]').click(), async (a, b) => {
        const pressed = await p.evaluate(() => document.querySelector('[data-act="rotate"]').getAttribute('aria-pressed'))
        return !a.rotating && b.rotating && Math.abs(b.azimuth - a.azimuth) > 0.02 && pressed === 'true'
      }, { wait: 1000 })
      await p.locator('[data-act="rotate"]').click()
      check('rotate-stops', !(await live(p)).rotating, null)
      afterAudio.push((await inspect(p)).audio)
      // Every landmark: button, card and camera agree, and the camera is never inside a building.
      const all = []
      for (let i = 0; i < LANDMARKS.length; i++) {
        await p.locator(`[data-landmark="${LANDMARKS[i][0]}"]`).click()
        await p.waitForTimeout(FLIGHT_MS)
        all.push(await landmarkState(p, i, lang))
        if (i === 7) await p.screenshot({ path: join(out, 'landmark-vessel.png') })
      }
      cameraClear = all.every((r) => r.cameraClear)
      check('landmarks-all', all.every((r) => r.ok) && cameraClear, all.filter((r) => !r.ok || !r.cameraClear))
      await p.locator('[data-act="reset"]').click()
      await p.waitForTimeout(FLIGHT_MS)
      check('triangle-budget', first.facts.triangles > 100000 && first.facts.triangles < 8000000, first.facts.triangles)
      check('landmark-count', first.facts.landmarks === 8, first.facts.landmarks)
    } else {
      await p.locator('[data-act="night"]').click()
      afterAudio.push((await inspect(p)).audio)
      await p.locator('[data-landmark="vessel"]').click()
      await p.waitForTimeout(FLIGHT_MS)
      const lm = await landmarkState(p, 7, lang)
      check(`landmark-${lang}-${quality}`, lm.ok, lm)
    }
    await p.screenshot({ path: join(out, `desktop-${lang}-${quality}.png`) })
    await close(p)
  }

  // The same file opened outside the sandbox: screenshot and fullscreen are offered, still no requests.
  {
    const ext0 = external
    const p = await open(1600, 900, 'en', 'low', '', {}, 'open')
    const shown = {
      screenshot: await visible(p, '[data-act="screenshot"]'),
      fullscreen: await visible(p, '[data-act="fullscreen"]'),
      edition: await visible(p, '.edition'),
      brandLink: await visible(p, 'a.brand'),
    }
    await p.waitForTimeout(300)
    const violations = await p.evaluate(() => window.__violations.length)
    check('unrestricted', shown.screenshot && shown.fullscreen && shown.edition && shown.brandLink && external === ext0 && violations === 0, { ...shown, requests: external - ext0, violations })
    await close(p)
  }

  // 390×844 phone: compact layout with touch.
  for (const lang of ['en', 'zh-CN']) {
    console.log(msg(L, 'shootViewport', { size: '390×844', lang }))
    const p = await open(390, 844, lang, null)
    const a = await inspect(p)
    check(`mobile-tier-${lang}`, a.quality === 'low' && a.state.layout === 'compact', { quality: a.quality, layout: a.state.layout })
    await layout(p, `mobile-${lang}`, 'compact')
    const box = await p.locator('.canvas canvas').boundingBox()
    const cdp = await p.context().newCDPSession(p)
    const y = box.y + box.height * 0.45
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 110, y }] })
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 110 + i * 16, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await p.waitForTimeout(500)
    check(`touch-orbit-${lang}`, Math.abs((await live(p)).azimuth - a.state.azimuth) > 0.1, null)
    await p.locator('[data-landmark="vessel"]:visible').tap()
    await p.waitForTimeout(FLIGHT_MS)
    const lm = await landmarkState(p, 7, lang)
    check(`touch-landmark-${lang}`, lm.ok, lm)
    await layout(p, `mobile-card-${lang}`, 'compact')
    fps.mobile['390x844'] = Math.round(await rate(p))
    await p.screenshot({ path: join(out, `mobile-${lang}.png`) })
    await close(p)
  }

  // Capture: step/script exist, and the same script + steps give the same pixels in two fresh pages.
  const shots = []
  for (let n = 0; n < 2; n++) {
    const cap = await open(1280, 720, 'en', 'high', '&capture=1')
    if (n === 0) {
      const api = await cap.evaluate(() => ({ script: typeof window.__scene.script, step: typeof window.__scene.step, cover: window.__scene.cover }))
      check('capture-api', api.script === 'function' && api.step === 'function' && api.cover.frames === 360 && api.cover.fps === 30 && api.cover.posterAt === 1.5, api)
    }
    await cap.evaluate(() => {
      for (let i = 0; i < 150; i++) {
        window.__scene.script(i / 30)
        window.__scene.step(1, 1 / 30)
      }
    })
    shots.push(await cap.screenshot())
    if (n === 0) writeFileSync(join(out, 'capture-150.png'), shots[0])
    await close(cap)
  }
  const d = await diff(shots[0], shots[1])
  check('deterministic-capture', d < 0.05, Math.round(d * 1000) / 1000)

  // Reduced motion: a landmark click cuts to its view within one frame.
  const reduced = await open(1600, 900, 'en', 'low', '', { reducedMotion: 'reduce' })
  await reduced.locator('[data-landmark="empire"]').click()
  await reduced.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  const rm = await inspect(reduced)
  check('reduced-motion', rm.facts.reducedMotion && !rm.state.transition && dist3(rm.state.target, LANDMARKS[0][2]) < 0.3 && rm.state.selected === 'empire', { transition: rm.state.transition, target: rm.state.target.map(round) })
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

const f = stats.facts
const report = {
  when: new Date().toISOString(),
  ok: checks.every((c) => c.ok),
  fps,
  checks,
  interactions,
  facts: {
    landmarks: f.landmarks ?? 0,
    roadEdges: f.roadEdges ?? 0,
    vehicles: f.vehicles ?? 0,
    pedestrians: f.pedestrians ?? 0,
    boats: f.boats ?? 0,
    triangles: f.triangles ?? 0,
    cameraClear,
    embedVerified: ['embed-touch-en', 'embed-touch-zh-CN'].every((id) => checks.some((c) => c.id === id && c.ok)),
    reducedMotion: f.reducedMotion ?? null,
  },
  drawCalls: f.drawCalls ?? 0,
  proofs,
  errors,
  warnings,
  csp,
}
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
const esc = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
for (const lang of ['en', 'zh-CN']) {
  const m = (k, v) => esc(msg(lang, k, v))
  const fpsRows = [['high', '1600×900'], ['low', '1600×900'], ['mobile', '390×844']].map(([tier, size]) => `<tr><td>${tier === 'mobile' ? m('reportMobile') : tier}</td><td>${size}</td><td>${esc(fps[tier][size.replace('×', 'x')] ?? '—')}</td></tr>`).join('')
  writeFileSync(join(out, `report.${lang}.html`), `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${m('reportTitle')}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;background:#eef2ee;color:#253e3b}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{padding:8px 10px;border-bottom:1px solid #cfd8d2;text-align:left;vertical-align:top}td:last-child{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}</style></head><body><h1>${m('reportTitle')}</h1><p>${m('reportIntro')}</p><p><b>${report.ok ? m('reportSummaryOk') : m('reportSummaryFail')}</b></p><h2>${m('reportFps')}</h2><table><tr><th>${m('reportTier')}</th><th>${m('reportViewport')}</th><th>fps</th></tr>${fpsRows}</table><table><tr><th>${m('reportCheck')}</th><th>${m('reportResult')}</th><th>${m('reportValue')}</th></tr>${checks.map((c) => `<tr><td>${esc(c.id)}</td><td>${c.ok ? m('reportPass') : m('reportFail')}</td><td>${esc(JSON.stringify(c.value))}</td></tr>`).join('')}</table><p>${m('reportWhen')}: ${esc(report.when)} · ${m('reportNode')}: ${esc(process.version)}</p><p>${m('reportShots')}</p></body></html>\n`)
}
const passed = checks.filter((c) => c.ok).length
console.log(msg(L, 'shootDone', { result: report.ok ? msg(L, 'resultPass') : msg(L, 'resultFail'), passed, total: checks.length, file: join(out, 'report.json') }))
process.exitCode = report.ok ? 0 : 1
