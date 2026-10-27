// Page shell: the pixel canvas, a bilingual HUD, the controls and the capture contract.
//
// Two ways to move: the tour (the film timeline, a pure function of time) and free driving (scroll, drag
// or arrow keys set the speed, reverse included). Both draw through the same renderer from (s, tod, clock).
import route from '../city/route.json'
import style from '../city/style.json'
import strings from '../i18n/strings.json'
import { parseParams } from '../lib/params.mjs'
import { createFilm } from './film.js'
import { createRaster } from './raster.js'
import { createRenderer, lightAt } from './render.js'
import { createWorld } from './world.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const MAX_SPEED = 140
const MIN_SPEED = -30

export function start({ SLUG, VERSION }) {
  const params = parseParams(location.search)
  const L = params.lang
  const s = strings[L]
  const t = (key, vars = {}) => (s[key] ?? strings.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = matchMedia('(pointer: coarse)').matches
  const quality = params.quality ?? (coarse ? 'low' : 'high')
  const errors = []
  addEventListener('error', (e) => errors.push(String(e.message)))
  addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)))
  document.documentElement.lang = L
  document.title = `${route.title} · ${s.title}`
  const app = document.getElementById('app')
  app.innerHTML = markup(t, coarse)
  const $ = (id) => document.getElementById(id)
  const all = (sel) => [...document.querySelectorAll(sel)]
  const canvas = $('drive')
  const ctx = canvas.getContext('2d', { alpha: false })
  const post = (msg) => window.parent !== window && window.parent.postMessage(msg, '*')
  if (!ctx) {
    $('loading').textContent = s.canvasMissing
    post({ type: `${SLUG}:error`, code: 'webgl' })
    throw new Error('canvas')
  }
  let world
  try {
    world = createWorld(route, style)
  } catch {
    $('loading').textContent = s.dataError
    post({ type: `${SLUG}:error`, code: 'data' })
    throw new Error('data')
  }
  const film = createFilm(world, style.film)
  const COVER = { fps: 30, frames: 900, posterAt: style.film.posterAt ?? 15 }
  const FILM = { fps: 30, frames: Math.round(film.duration * 30), posterAt: style.film.posterAt ?? 15 }
  const renderer = createRenderer(world)
  const raster = createRaster(320, 200)

  // State: mode 'tour' plays the film timeline; 'drive' integrates speed. tod is the time of day (0–1).
  const first = film.at(0)
  const state = { mode: 'tour', playing: false, filmT: 0, s: first.s, speed: 0, target: 0, tod: first.tod, lane: first.lane, clock: 0, map: false, capture: false }
  let raf = 0, last = 0, renders = 0, frameMs = 0, drawn = {}, layout = 'full', scale = 4, summaryText = ''

  function fit() {
    layout = params.embed || innerWidth < 900 || innerHeight < 520 ? 'compact' : 'full'
    document.body.dataset.layout = layout
    const stage = $('stage').getBoundingClientRect()
    const cssW = Math.max(120, stage.width), cssH = Math.max(120, stage.height)
    // Integer pixel scale, about 170–210 low-res rows whatever the window (sharper on the low tier).
    scale = Math.max(2, Math.round(cssH / (quality === 'low' ? 170 : 200)))
    const w = Math.ceil(cssW / scale), h = Math.ceil(cssH / scale)
    if (raster.width !== w || raster.height !== h) raster.resize(w, h)
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${w * scale}px`
    canvas.style.height = `${h * scale}px`
    draw()
  }

  function view() {
    return { s: state.s, lane: state.lane, tod: state.tod, clock: state.clock, speed: Math.abs(state.speed), look: world.lookAt(state.s, state.lane) }
  }
  function draw() {
    const t0 = performance.now()
    drawn = renderer.frame(raster, view())
    raster.present(ctx)
    frameMs = performance.now() - t0
    renders++
    hud()
  }

  const lightName = (tod) => (tod < 0.25 ? 'golden' : tod < 0.5 ? 'sunset' : tod < 0.68 ? 'dusk' : tod < 0.86 ? 'blue' : 'night')
  const rank = (ds) => (ds < 0 ? -ds * 3 : ds)
  function nearest() {
    let best = null
    for (const l of world.landmarks) {
      const ds = l.s - state.s
      if (ds > -140 && ds < 420 && (!best || rank(ds) < rank(best.ds))) best = { l, ds }
    }
    for (const b of world.bridges) {
      if (b.structure !== 'suspension' || !b.name) continue
      const ds = b.s - state.s
      if (ds > -100 && ds < 400 && (!best || rank(ds) < rank(best.ds))) best = { l: { name: b.name, kind: 'bridge', d: 0, s: b.s }, ds }
    }
    return best
  }
  function hud() {
    const km = (m) => (m / 1000).toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const street = world.streetAt(state.s)
    const district = world.districtAt(state.s)
    $('street').textContent = street
    $('district').textContent = district
    $('c-street').textContent = street
    $('progress').textContent = t('km', { at: km(state.s), total: km(world.length) })
    $('c-progress').textContent = t('kmShort', { at: km(state.s) })
    const light = t(lightName(state.tod))
    $('light-label').textContent = light
    for (const r of all('[data-act="route"]')) {
      r.value = String(Math.round(state.s))
      r.setAttribute('aria-valuetext', t('km', { at: km(state.s), total: km(world.length) }))
    }
    for (const r of all('[data-act="time"]')) {
      r.value = String(state.tod)
      r.setAttribute('aria-valuetext', light)
    }
    const kmh = Math.round(Math.abs(state.speed) * 3.6)
    $('speed').textContent = state.mode === 'drive' ? `${kmh} km/h` : ''
    $('mode').textContent = state.mode === 'tour' ? (state.playing ? t('tour') : t('paused')) : state.speed < -0.5 ? t('reverse') : Math.abs(state.speed) < 0.5 ? t('stopped') : t('drive')
    for (const b of all('[data-act="play"]')) {
      const on = state.playing && state.mode === 'tour'
      b.setAttribute('aria-label', on ? t('ariaPause') : t('ariaPlay'))
      b.setAttribute('aria-pressed', String(on))
      b.textContent = b.dataset.style === 'long' ? (on ? t('pause') : t('play')) : on ? 'Ⅱ' : '▶'
    }
    for (const b of all('[data-act="map"]')) b.setAttribute('aria-pressed', String(state.map))
    $('minimap').hidden = !state.map
    if (state.map) drawMap()
    const n = nearest()
    const card = $('card')
    if (n) {
      card.hidden = false
      const dist = Math.abs(n.ds) < 25 ? t('here') : n.ds > 0 ? t('ahead', { m: Math.round(n.ds / 10) * 10 }) : t('behind', { m: Math.round(-n.ds / 10) * 10 })
      $('card-kind').textContent = t(`kind.${n.l.kind}`)
      $('card-name').textContent = n.l.name
      $('card-where').textContent = n.l.kind === 'bridge' ? dist : `${n.l.d < 0 ? t('left') : t('right')} · ${dist}`
      $('card-note').textContent = style.notes?.[n.l.name]?.[L] ?? style.notes?.[n.l.name]?.en ?? ''
    } else card.hidden = true
    const text = n
      ? t('summaryLandmark', { street, landmark: n.l.name, side: n.l.kind === 'bridge' ? '' : n.l.d < 0 ? t('left') : t('right'), distance: Math.abs(n.ds) < 25 ? t('here') : `${Math.round(Math.abs(n.ds) / 10) * 10} m`, light })
      : t('summary', { street, district: district || route.title, at: km(state.s), total: km(world.length), light })
    if (text !== summaryText) {
      summaryText = text
      $('live').textContent = text
    }
  }
  const map = $('minimap')
  const mctx = map.getContext('2d')
  function drawMap() {
    const w = map.width, h = map.height
    const pts = route.path
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    const k = Math.min((w - 16) / (x1 - x0 || 1), (h - 16) / (y1 - y0 || 1))
    const P = ([x, y]) => [8 + (x - x0) * k + (w - 16 - (x1 - x0) * k) / 2, h - 8 - (y - y0) * k - (h - 16 - (y1 - y0) * k) / 2]
    mctx.fillStyle = '#10131c'
    mctx.fillRect(0, 0, w, h)
    mctx.strokeStyle = '#5d6478'
    mctx.lineWidth = 3
    mctx.beginPath()
    pts.forEach((p, i) => (i ? mctx.lineTo(...P(p)) : mctx.moveTo(...P(p))))
    mctx.stroke()
    mctx.strokeStyle = '#f2c22a'
    mctx.beginPath()
    const upto = Math.floor(state.s / world.step)
    pts.slice(0, upto + 1).forEach((p, i) => (i ? mctx.lineTo(...P(p)) : mctx.moveTo(...P(p))))
    mctx.stroke()
    for (const l of world.landmarks) {
      const [x, y] = P(world.at(l.s, l.d))
      mctx.fillStyle = '#e9a25a'
      mctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4)
    }
    const [cx, cy] = P(world.at(state.s, 0))
    mctx.fillStyle = '#ffffff'
    mctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6)
  }

  // ── Motion ────────────────────────────────────────────────────────────────────────────────
  function applyFilm(at) {
    state.filmT = clamp(at, 0, film.duration)
    const f = film.at(state.filmT)
    state.s = f.s
    state.speed = f.speed
    state.tod = f.tod
    state.lane = f.lane
    state.clock = state.filmT
  }
  function stopLoop() {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }
  function loop(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    if (state.mode === 'tour') {
      if (state.playing) {
        let next = state.filmT + dt
        if (next >= film.duration) next = 0
        applyFilm(next)
      }
    } else {
      state.speed += (state.target - state.speed) * Math.min(1, dt * 2.2)
      state.s = clamp(state.s + state.speed * dt, 0, world.length)
      if ((state.s <= 0 && state.speed < 0) || (state.s >= world.length && state.speed > 0)) state.speed = state.target = 0
      state.clock += dt
    }
    draw()
    raf = requestAnimationFrame(loop)
  }
  function run() {
    if (!raf && !state.capture) {
      last = 0
      raf = requestAnimationFrame(loop)
    }
  }
  function play() {
    state.capture = false
    if (state.mode === 'tour' && state.playing) {
      state.playing = false
      draw()
      return
    }
    // Resume the tour from where the car is now.
    const at = state.mode === 'tour' ? state.filmT : film.timeAt(state.s)
    state.mode = 'tour'
    state.playing = true
    applyFilm(at >= film.duration - 0.05 ? 0 : at)
    draw()
    run()
  }
  function toDrive() {
    if (state.mode === 'tour') {
      state.mode = 'drive'
      state.playing = false
      state.target = state.speed
    }
    run()
  }
  function nudge(dv) {
    toDrive()
    state.target = clamp(state.target + dv, MIN_SPEED, MAX_SPEED)
    draw()
  }
  function seekRoute(m) {
    const v = Number(m)
    if (!Number.isFinite(v)) throw new Error('Route position must be a number')
    if (state.mode === 'tour') {
      applyFilm(film.timeAt(clamp(v, 0, world.length)))
      state.s = clamp(v, 0, world.length)
    } else state.s = clamp(v, 0, world.length)
    draw()
  }
  function setTime(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('Time of day must be a number')
    toDrive()
    state.tod = clamp(n, 0, 1)
    draw()
  }
  function nextLandmark() {
    const next = world.landmarks.find((l) => l.s - 260 > state.s + 20) ?? world.landmarks[0]
    toDrive()
    state.s = clamp(next.s - 260, 0, world.length)
    state.speed = state.target = Math.min(film.cruise * 0.45, 30)
    draw()
  }
  function toggleMap() {
    state.map = !state.map
    draw()
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────
  for (const b of all('[data-act="play"]')) b.addEventListener('click', play)
  for (const b of all('[data-act="faster"]')) b.addEventListener('click', () => nudge(12))
  for (const b of all('[data-act="slower"]')) b.addEventListener('click', () => nudge(-12))
  for (const b of all('[data-act="next"]')) b.addEventListener('click', nextLandmark)
  for (const b of all('[data-act="map"]')) b.addEventListener('click', toggleMap)
  for (const r of all('[data-act="route"]')) {
    r.max = String(Math.round(world.length))
    r.addEventListener('input', (e) => seekRoute(e.target.value))
  }
  for (const r of all('[data-act="time"]')) r.addEventListener('input', (e) => setTime(e.target.value))
  const stage = $('stage')
  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    nudge(clamp(-e.deltaY * 0.05, -14, 14))
  }, { passive: false })
  let drag = null
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,input')) return
    drag = { y: e.clientY }
    stage.setPointerCapture?.(e.pointerId)
  })
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dy = drag.y - e.clientY
    drag.y = e.clientY
    if (dy) nudge(dy * 0.35)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, () => (drag = null))
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input')) return
    if (e.key === ' ') {
      e.preventDefault()
      play()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      nudge(10)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      nudge(-10)
    } else if (e.key === 'n' || e.key === 'N') nextLandmark()
    else if (e.key === 'm' || e.key === 'M') toggleMap()
  })
  addEventListener('resize', fit)

  // ── Boot ──────────────────────────────────────────────────────────────────────────────────
  applyFilm(0)
  fit()
  document.body.classList.add('ready')

  // ── Capture contract ──────────────────────────────────────────────────────────────────────
  // script(t): the film frame at t (pure). step(n, dt): advance by n fixed steps of the current mode.
  function script(at) {
    stopLoop()
    state.capture = true
    state.mode = 'tour'
    state.playing = false
    applyFilm(at)
    draw()
    return api.inspect().facts
  }
  function step(n = 1, dt = 1 / COVER.fps) {
    for (let i = 0; i < n; i++) {
      if (state.mode === 'tour' && state.playing) applyFilm(Math.min(film.duration, state.filmT + dt))
      else if (state.mode === 'drive') {
        state.speed += (state.target - state.speed) * Math.min(1, dt * 2.2)
        state.s = clamp(state.s + state.speed * dt, 0, world.length)
        state.clock += dt
      }
    }
    draw()
  }
  const api = {
    slug: SLUG,
    version: VERSION,
    ready: true,
    cover: COVER,
    film: FILM,
    inspect: () => ({
      quality,
      audio: 'none',
      errors: [...errors],
      facts: {
        mode: state.mode, playing: state.playing, filmT: state.filmT, s: state.s, speed: state.speed, target: state.target, tod: state.tod,
        map: state.map, layout, scale, width: raster.width, height: raster.height, renders, frameMs,
        length: world.length, buildings: world.buildings.length, landmarks: world.landmarks.length, bridges: world.bridges.length,
        street: world.streetAt(state.s), near: nearest()?.l.name ?? null, light: lightName(state.tod), duration: film.duration,
        reducedMotion: reduced, lightAmb: lightAt(state.tod).amb, drawn: { ...drawn },
      },
    }),
    act(name, arg) {
      if (name === 'play') {
        if (!(state.mode === 'tour' && state.playing)) play()
      } else if (name === 'pause') {
        state.playing = false
        state.mode === 'drive' && (state.target = state.speed = 0)
        draw()
      } else if (name === 'speed') nudge(Number(arg) || 0)
      else if (name === 'route') seekRoute(arg)
      else if (name === 'time') setTime(arg)
      else if (name === 'next') nextLandmark()
      else if (name === 'map') toggleMap()
      else throw new Error(`Unknown action ${name}`)
      return api.inspect()
    },
    pointer(nx, ny) {
      // Normalized pointer: vertical position sets a target speed (top fast, bottom reverse).
      nudge(0)
      state.target = clamp(-Number(ny) * MAX_SPEED, MIN_SPEED, MAX_SPEED)
      void nx
      draw()
    },
    press: () => {
      state.playing = false
      draw()
    },
    release: () => {},
    seek: script,
    ...(params.capture ? { step, script } : {}),
  }
  window.__scene = api
  if (!params.capture && !reduced) play()
  post({ type: `${SLUG}:ready` })
}

function markup(t, coarse) {
  return `
<main id="shell">
 <section id="stage" class="stage" aria-label="${t('sceneAria')}">
  <canvas id="drive" role="img" aria-label="${t('sceneAria')}"></canvas>
  <div id="loading" class="loading">${t('loading')}</div>
  <header class="top">
   <div class="where"><span class="brand">${t('brand')}</span><b id="street"></b><span id="district"></span></div>
   <div class="meter"><span id="progress"></span><span id="speed"></span><span id="mode"></span></div>
  </header>
  <aside id="card" class="card" hidden><span id="card-kind"></span><b id="card-name"></b><span id="card-where"></span><p id="card-note"></p></aside>
  <canvas id="minimap" class="minimap" width="220" height="150" hidden aria-hidden="true"></canvas>
  <div class="c-top"><b id="c-street"></b><span id="c-progress"></span></div>
  <p class="credits">${t('credits')}</p>
 </section>
 <footer class="dock">
  <button type="button" data-act="play" data-style="long" class="filled play"></button>
  <label class="route"><span>${t('route')}</span><input type="range" data-act="route" min="0" max="1000" step="1" value="0" aria-label="${t('ariaRoute')}"></label>
  <div class="speed" role="group" aria-label="${t('speed')}"><button type="button" data-act="slower" aria-label="${t('slower')}">−</button><button type="button" data-act="faster" aria-label="${t('faster')}">+</button></div>
  <label class="time"><span>${t('time')} · <b id="light-label"></b></span><input type="range" data-act="time" min="0" max="1" step="0.01" value="0" aria-label="${t('ariaTime')}"></label>
  <button type="button" data-act="next" class="next">${t('next')} ↦</button>
  <button type="button" data-act="map" class="map" aria-label="${t('ariaMap')}">${t('map')}</button>
  <span class="hint">${coarse ? t('hintTouch') : t('hint')}</span>
 </footer>
 <footer class="c-dock">
  <button type="button" data-act="play" class="round"></button>
  <input type="range" data-act="route" min="0" max="1000" step="1" value="0" aria-label="${t('ariaRoute')}">
  <button type="button" data-act="slower" aria-label="${t('slower')}">−</button>
  <button type="button" data-act="faster" aria-label="${t('faster')}">+</button>
  <button type="button" data-act="next" aria-label="${t('next')}" title="${t('next')}">↦</button>
  <button type="button" data-act="map" aria-label="${t('ariaMap')}" title="${t('map')}">⌖</button>
 </footer>
 <p id="live" class="sr" aria-live="polite"></p>
 <p class="sr">${t('disclaimer')}</p>
</main>`
}
