// Page shell: the pixel canvas, landmark labels, a bilingual HUD, the controls and the capture contract.
//
// Two ways to look: the tour (the film timeline, a pure function of time) and free exploring (drag to pan,
// wheel or pinch to zoom, Q/E to turn a quarter, the time slider for the light). Both draw through the same
// renderer from (camera, tod, clock).
import area from '../city/area.json'
import style from '../city/style.json'
import strings from '../i18n/strings.json'
import { parseParams } from '../lib/params.mjs'
import { createFilm, framing, REF_ROWS } from './film.js'
import { createRaster } from './raster.js'
import { createRenderer, lightAt, projection } from './render.js'
import { createWorld } from './world.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ZOOM_MIN = 0.1
const ZOOM_MAX = 2.4

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
  document.title = `${area.title} · ${s.title}`
  const app = document.getElementById('app')
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  app.innerHTML = markup(t, coarse, esc(area.title), esc(style.place?.[L] ?? style.place?.en ?? style.city ?? ''))
  const $ = (id) => document.getElementById(id)
  const all = (sel) => [...document.querySelectorAll(sel)]
  const canvas = $('city')
  const ctx = canvas.getContext('2d', { alpha: false })
  const post = (msg) => window.parent !== window && window.parent.postMessage(msg, '*')
  if (!ctx) {
    $('loading').textContent = s.canvasMissing
    post({ type: `${SLUG}:error`, code: 'webgl' })
    throw new Error('canvas')
  }
  let world
  try {
    world = createWorld(area, style)
  } catch {
    $('loading').textContent = s.dataError
    post({ type: `${SLUG}:error`, code: 'data' })
    throw new Error('data')
  }
  const film = createFilm(world, style.film)
  const COVER = { fps: 30, frames: 900, posterAt: style.film.posterAt ?? 12 }
  const FILM = { fps: 30, frames: Math.round(film.duration * 30), posterAt: style.film.posterAt ?? 12 }
  const renderer = createRenderer(world)
  const raster = createRaster(320, 200)
  const near = style.film.near ?? 0.72

  // State: mode 'tour' plays the film; 'explore' eases the camera toward a target the controls set.
  const first = film.at(0)
  const cam = { cx: first.cx, cy: first.cy, zoom: first.zoom, lift: first.lift, rot: first.rot }
  const state = { mode: 'tour', playing: false, filmT: 0, cam, target: { ...cam }, tod: first.tod, clock: 0, labels: true, focus: null, stop: -1, capture: false }
  let raf = 0, last = 0, renders = 0, frameMs = 0, drawn = {}, layout = 'full', scale = 3, summaryText = ''

  function fit() {
    layout = params.embed || innerWidth < 900 || innerHeight < 520 ? 'compact' : 'full'
    document.body.dataset.layout = layout
    const stage = $('stage').getBoundingClientRect()
    const cssW = Math.max(120, stage.width), cssH = Math.max(120, stage.height)
    // Integer pixel scale, about 200–240 low-res rows whatever the window.
    scale = Math.max(1, Math.round(cssH / (quality === 'low' ? 200 : 240)))
    const w = Math.ceil(cssW / scale), h = Math.ceil(cssH / scale)
    if (raster.width !== w || raster.height !== h) raster.resize(w, h)
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${w * scale}px`
    canvas.style.height = `${h * scale}px`
    draw()
  }

  // Film zoom is per 240 rows; the buffer may have more or fewer.
  const camera = (c = state.cam) => ({ cx: c.cx, cy: c.cy, zoom: c.zoom * (raster.height / REF_ROWS), lift: c.lift, rot: c.rot })
  const proj = () => projection(world, camera(), raster.width, raster.height)

  function draw() {
    const t0 = performance.now()
    drawn = renderer.frame(raster, { camera: camera(), tod: state.tod, clock: state.clock })
    raster.present(ctx)
    frameMs = performance.now() - t0
    renders++
    hud()
  }

  const lightName = (tod) => (tod < 0.3 ? 'day' : tod < 0.52 ? 'sunset' : tod < 0.72 ? 'dusk' : 'night')
  /** The landmark the view is about: the film's focus, or the nearest one to the view centre. */
  function focused() {
    if (state.mode === 'tour') return state.focus === null ? null : world.landmarks[state.focus]
    let best = null, bd = 140
    for (const l of world.landmarks) {
      const d = Math.hypot(l.x - state.cam.cx, l.y - state.cam.cy)
      if (d < bd && state.cam.zoom > 0.3) {
        bd = d
        best = l
      }
    }
    return best
  }
  const labels = []
  for (const l of world.landmarks) {
    const el = document.createElement('span')
    el.className = 'tag'
    el.textContent = l.name
    $('labels').append(el)
    labels.push(el)
  }
  function hud() {
    const light = t(lightName(state.tod))
    const f = focused()
    $('light-label').textContent = light
    for (const r of all('[data-act="time"]')) {
      r.value = String(state.tod)
      r.setAttribute('aria-valuetext', light)
    }
    $('mode').textContent = state.mode === 'tour' ? (state.playing ? t('tour') : t('paused')) : t('explore')
    for (const b of all('[data-act="play"]')) {
      const on = state.playing && state.mode === 'tour'
      b.setAttribute('aria-label', on ? t('ariaPause') : t('ariaPlay'))
      b.setAttribute('aria-pressed', String(on))
      b.textContent = b.dataset.style === 'long' ? (on ? t('pause') : t('play')) : on ? 'Ⅱ' : '▶'
    }
    for (const b of all('[data-act="labels"]')) b.setAttribute('aria-pressed', String(state.labels))
    // North arrow: the screen direction of world +y.
    const P = proj()
    const [ax, ay] = P.toScreen(world.width / 2, world.height / 2)
    const [bx, by] = P.toScreen(world.width / 2, world.height / 2 + 100)
    $('north').style.transform = `rotate(${Math.atan2(bx - ax, -(by - ay))}rad)`
    // Labels above each landmark's top, in CSS pixels.
    const W = raster.width, H = raster.height
    $('labels').hidden = !state.labels
    // The focused label first, then nearer ones; a label that would overlap one already placed is hidden.
    const placed = []
    const order = world.landmarks.map((l) => ({ l, p: P.toScreen(l.x, l.y, l.h + 4) })).sort((a, b) => (b.l.id === f?.id) - (a.l.id === f?.id) || a.p[2] - b.p[2])
    for (const { l, p: [x, y] } of order) {
      const el = labels[l.id]
      const cx = x * scale, cy = y * scale
      const half = (el.offsetWidth || l.name.length * 7 + 14) / 2, tall = el.offsetHeight || 20
      const box = [cx - half - 4, cy - tall - 12, cx + half + 4, cy]
      let show = state.labels && x > 8 && x < W - 8 && y > 10 && y < H - 4
      if (show && placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) show = false
      el.hidden = !show
      el.classList.toggle('on', f?.id === l.id)
      if (!show) continue
      placed.push(box)
      el.style.transform = `translate(${Math.round(cx)}px,${Math.round(cy)}px)`
    }
    const card = $('card')
    if (f) {
      card.hidden = false
      $('card-name').textContent = f.name
      $('card-note').textContent = f.note?.[L] ?? f.note?.en ?? ''
      $('c-name').textContent = f.name
    } else {
      card.hidden = true
      $('c-name').textContent = area.title
    }
    const text = f ? t('summaryLandmark', { landmark: f.name, light }) : t('summary', { area: area.title, light })
    if (text !== summaryText) {
      summaryText = text
      $('live').textContent = text
    }
  }

  // ── Motion ────────────────────────────────────────────────────────────────────────────────
  function applyFilm(at) {
    state.filmT = clamp(at, 0, film.duration)
    const f = film.at(state.filmT)
    Object.assign(state.cam, { cx: f.cx, cy: f.cy, zoom: f.zoom, lift: f.lift, rot: f.rot })
    Object.assign(state.target, state.cam)
    state.tod = f.tod
    state.focus = f.focus
    state.clock = state.filmT
  }
  function ease(dt) {
    const k = state.capture ? 1 : Math.min(1, dt * 7)
    for (const key of ['cx', 'cy', 'lift', 'rot']) state.cam[key] += (state.target[key] - state.cam[key]) * k
    state.cam.zoom = Math.exp(Math.log(state.cam.zoom) + (Math.log(state.target.zoom) - Math.log(state.cam.zoom)) * k)
    if (!reduced || state.capture) state.clock += dt
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
    } else ease(dt)
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
    // Resume the tour at the next stop after the one in view, or where it paused.
    const at = state.mode === 'tour' ? state.filmT : state.stop >= 0 ? Math.max(0, film.stopTime(state.stop) - 2.6) : 0
    state.mode = 'tour'
    state.playing = true
    applyFilm(at >= film.duration - 0.05 ? 0 : at)
    draw()
    run()
  }
  function toExplore() {
    if (state.mode === 'tour') {
      state.mode = 'explore'
      state.playing = false
      Object.assign(state.target, state.cam)
    }
    run()
  }
  const settle = () => {
    if (state.capture) ease(0)
    draw()
  }
  function clampTarget() {
    const T = state.target
    T.cx = clamp(T.cx, 0, world.width)
    T.cy = clamp(T.cy, 0, world.height)
    T.zoom = clamp(T.zoom, ZOOM_MIN, ZOOM_MAX)
  }
  /** Pans by a screen offset in buffer pixels (the content follows the pointer). */
  function panPixels(dx, dy) {
    toExplore()
    const P = projection(world, camera(state.target), raster.width, raster.height)
    const [ax, ay] = P.toGround(raster.width / 2, raster.height / 2)
    const [bx, by] = P.toGround(raster.width / 2 - dx, raster.height / 2 - dy)
    state.target.cx += bx - ax
    state.target.cy += by - ay
    clampTarget()
    settle()
  }
  function pan(dxm, dym) {
    const x = Number(dxm), y = Number(dym)
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Pan offsets must be numbers')
    toExplore()
    state.target.cx += x
    state.target.cy += y
    clampTarget()
    settle()
  }
  /** Zooms by factor f, keeping the ground under buffer point (px, py) in place. */
  function zoomBy(f, px = raster.width / 2, py = raster.height / 2) {
    const k = Number(f)
    if (!Number.isFinite(k) || k <= 0) throw new Error('Zoom factor must be a positive number')
    toExplore()
    const before = projection(world, camera(state.target), raster.width, raster.height).toGround(px, py)
    state.target.zoom = clamp(state.target.zoom * k, ZOOM_MIN, ZOOM_MAX)
    const after = projection(world, camera(state.target), raster.width, raster.height).toGround(px, py)
    state.target.cx += before[0] - after[0]
    state.target.cy += before[1] - after[1]
    clampTarget()
    settle()
  }
  function rotate(dir) {
    const d = Math.sign(Number(dir)) || 1
    toExplore()
    state.target.rot = Math.round(state.target.rot) + d
    settle()
  }
  function setTime(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('Time of day must be a number')
    toExplore()
    state.tod = clamp(n, 0, 1)
    draw()
  }
  function visit(i) {
    const stops = film.stops
    const at = i === undefined || i === 'next' ? (state.stop + 1) % stops.length : clamp(Math.round(Number(i)), 0, stops.length - 1)
    if (!Number.isFinite(at)) throw new Error('Landmark must be an index or "next"')
    // From the tour, "next" means the stop after the one in view.
    const from = state.mode === 'tour' && state.focus !== null && (i === undefined || i === 'next') ? (stops.indexOf(state.focus) + 1) % stops.length : at
    toExplore()
    state.stop = from
    const l = world.landmarks[stops[from]]
    const f = framing(l.h, near)
    Object.assign(state.target, { cx: l.x, cy: l.y, zoom: f.zoom, lift: f.lift })
    settle()
  }
  function toggleLabels() {
    state.labels = !state.labels
    draw()
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────
  for (const b of all('[data-act="play"]')) b.addEventListener('click', play)
  for (const b of all('[data-act="zoom-in"]')) b.addEventListener('click', () => zoomBy(1.4))
  for (const b of all('[data-act="zoom-out"]')) b.addEventListener('click', () => zoomBy(1 / 1.4))
  for (const b of all('[data-act="rotate-left"]')) b.addEventListener('click', () => rotate(-1))
  for (const b of all('[data-act="rotate-right"]')) b.addEventListener('click', () => rotate(1))
  for (const b of all('[data-act="next"]')) b.addEventListener('click', () => visit('next'))
  for (const b of all('[data-act="labels"]')) b.addEventListener('click', toggleLabels)
  for (const r of all('[data-act="time"]')) r.addEventListener('input', (e) => setTime(e.target.value))
  const stage = $('stage')
  const toBuffer = (e) => {
    const r = canvas.getBoundingClientRect()
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]
  }
  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const [px, py] = toBuffer(e)
    zoomBy(Math.exp(clamp(-e.deltaY, -300, 300) * 0.0018), px, py)
  }, { passive: false })
  const touches = new Map()
  let pinch = 0
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,input')) return
    touches.set(e.pointerId, [e.clientX, e.clientY])
    stage.setPointerCapture?.(e.pointerId)
    if (touches.size === 2) {
      const [a, b] = [...touches.values()]
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1])
    }
  })
  stage.addEventListener('pointermove', (e) => {
    const p = touches.get(e.pointerId)
    if (!p) return
    if (touches.size === 2) {
      touches.set(e.pointerId, [e.clientX, e.clientY])
      const [a, b] = [...touches.values()]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (pinch > 0 && d > 0) zoomBy(d / pinch)
      pinch = d
      return
    }
    const dx = (e.clientX - p[0]) / scale, dy = (e.clientY - p[1]) / scale
    touches.set(e.pointerId, [e.clientX, e.clientY])
    if (dx || dy) panPixels(dx, dy)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, (e) => {
    touches.delete(e.pointerId)
    pinch = 0
  })
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input')) return
    const k = e.key
    const step = 24
    if (k === ' ') {
      e.preventDefault()
      play()
    } else if (k === 'q' || k === 'Q') rotate(-1)
    else if (k === 'e' || k === 'E') rotate(1)
    else if (k === '+' || k === '=') zoomBy(1.4)
    else if (k === '-' || k === '_') zoomBy(1 / 1.4)
    else if (k === 'n' || k === 'N') visit('next')
    else if (k === 'l' || k === 'L') toggleLabels()
    else if (k.startsWith('Arrow')) {
      e.preventDefault()
      panPixels(k === 'ArrowLeft' ? step : k === 'ArrowRight' ? -step : 0, k === 'ArrowUp' ? step : k === 'ArrowDown' ? -step : 0)
    }
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
      else if (state.mode === 'explore') ease(dt)
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
        mode: state.mode, playing: state.playing, filmT: state.filmT, tod: state.tod, labels: state.labels,
        cx: state.cam.cx, cy: state.cam.cy, zoom: state.cam.zoom, rot: state.cam.rot, lift: state.cam.lift,
        target: { ...state.target }, layout, scale, width: raster.width, height: raster.height, renders, frameMs,
        buildings: world.buildings.length, landmarks: world.landmarks.length, roads: area.roads.length, trees: world.trees.length,
        areaM: [world.width, world.height], focus: focused()?.name ?? null, light: lightName(state.tod), duration: film.duration,
        labelsShown: labels.filter((el) => !el.hidden).length, reducedMotion: reduced, lightAmb: lightAt(state.tod).amb, drawn: { ...drawn },
      },
    }),
    act(name, arg, arg2) {
      if (name === 'play') {
        if (!(state.mode === 'tour' && state.playing)) play()
      } else if (name === 'pause') {
        state.playing = false
        draw()
      } else if (name === 'pan') pan(arg, arg2)
      else if (name === 'zoom') zoomBy(arg)
      else if (name === 'rotate') rotate(arg)
      else if (name === 'time') setTime(arg)
      else if (name === 'landmark') visit(arg)
      else if (name === 'labels') toggleLabels()
      else throw new Error(`Unknown action ${name}`)
      return api.inspect()
    },
    pointer(nx, ny) {
      // Normalized pointer (-1..1): pans the view toward that side of the screen.
      panPixels(-Number(nx) * raster.width * 0.1, -Number(ny) * raster.height * 0.1)
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

function markup(t, coarse, brand, place) {
  return `
<main id="shell">
 <section id="stage" class="stage" aria-label="${t('sceneAria')}">
  <canvas id="city" role="img" aria-label="${t('sceneAria')}"></canvas>
  <div id="labels" class="labels" aria-hidden="true"></div>
  <div id="loading" class="loading">${t('loading')}</div>
  <header class="top">
   <div class="where"><span class="brand">${brand}</span><b>${place}</b><span id="mode"></span></div>
   <div class="compass" aria-hidden="true"><span id="north">▲<i>N</i></span></div>
  </header>
  <aside id="card" class="card" hidden><span>${t('landmark')}</span><b id="card-name"></b><p id="card-note"></p></aside>
  <div class="c-top"><b id="c-name"></b></div>
  <p class="credits">${t('credits')}</p>
 </section>
 <footer class="dock">
  <button type="button" data-act="play" data-style="long" class="filled play"></button>
  <div class="group" role="group" aria-label="${t('zoom')}"><button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button><button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button></div>
  <div class="group" role="group" aria-label="${t('turn')}"><button type="button" data-act="rotate-left" aria-label="${t('rotateLeft')}">⟲</button><button type="button" data-act="rotate-right" aria-label="${t('rotateRight')}">⟳</button></div>
  <label class="time"><span>${t('time')} · <b id="light-label"></b></span><input type="range" data-act="time" min="0" max="1" step="0.01" value="0" aria-label="${t('ariaTime')}"></label>
  <button type="button" data-act="next" class="next">${t('next')} ↦</button>
  <button type="button" data-act="labels" class="labels-btn" aria-label="${t('ariaLabels')}">${t('labels')}</button>
  <span class="hint">${coarse ? t('hintTouch') : t('hint')}</span>
 </footer>
 <footer class="c-dock">
  <button type="button" data-act="play" class="round"></button>
  <button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button>
  <button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button>
  <button type="button" data-act="rotate-right" aria-label="${t('rotateRight')}">⟳</button>
  <input type="range" data-act="time" min="0" max="1" step="0.01" value="0" aria-label="${t('ariaTime')}">
  <button type="button" data-act="next" aria-label="${t('next')}" title="${t('next')}">↦</button>
  <button type="button" data-act="labels" aria-label="${t('ariaLabels')}" title="${t('labels')}">Aa</button>
 </footer>
 <p id="live" class="sr" aria-live="polite"></p>
 <p class="sr">${t('disclaimer')}</p>
</main>`
}
