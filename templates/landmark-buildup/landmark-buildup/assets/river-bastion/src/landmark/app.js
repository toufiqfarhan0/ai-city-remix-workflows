// Page shell: the 3D stage, a bilingual panel with the construction stages, the controls and the capture
// contract. Every control drives the same three inputs of the stateless scene: view, build and light.
import recipe from './recipe.json'
import filmData from './film.json'
import strings from '../i18n/strings.json'
import { parseParams } from '../lib/params.mjs'
import { placedAt } from './kit.js'
import { createFilm } from './film.js'
import { createScene } from './scene.js'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export function start({ SLUG, VERSION }) {
  const params = parseParams(location.search)
  const L = params.lang
  const s = strings[L]
  const t = (key, vars = {}) => (s[key] ?? strings.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
  const copy = recipe.copy?.[L] ?? recipe.copy?.en ?? {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = matchMedia('(pointer: coarse)').matches
  const quality = params.quality ?? (coarse ? 'low' : 'high')
  const errors = []
  addEventListener('error', (e) => errors.push(String(e.message)))
  addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)))
  document.documentElement.lang = L
  document.title = `${copy.title ?? ''} · ${s.brand}`
  const app = document.getElementById('app')
  app.innerHTML = markup(t, copy, coarse)
  const $ = (id) => document.getElementById(id)
  const all = (sel) => [...document.querySelectorAll(sel)]
  const post = (msg) => window.parent !== window && window.parent.postMessage(msg, '*')
  const canvas = $('world')
  if (!webglAvailable()) {
    $('loading').textContent = s.webglMissing
    post({ type: `${SLUG}:error`, code: 'webgl' })
    throw new Error('webgl')
  }
  let scene, film
  try {
    film = createFilm(filmData)
    scene = createScene({ canvas, recipe, width: 1280, height: 720, quality })
  } catch (e) {
    if (e?.code !== 'data') throw e
    $('loading').textContent = s.dataError
    post({ type: `${SLUG}:error`, code: 'data' })
    throw e
  }
  const pieces = scene.built.pieces
  const stages = scene.built.stages
  const COVER = { fps: 30, frames: filmData.cover?.frames ?? 900, posterAt: filmData.cover?.posterAt ?? 24 }
  const FILM = { fps: 30, frames: Math.round(film.duration * 30), posterAt: filmData.cover?.posterAt ?? 24 }
  window.__buildup = scene

  const state = { mode: 'film', playing: false, time: 0, build: 0, light: 0, explode: 0, view: { ...filmData.views.overview, center: [...filmData.views.overview.center] }, preset: 'overview', capture: false }
  let raf = 0, last = 0, renders = 0, layout = 'full', summaryText = ''

  function fit() {
    layout = params.embed || innerWidth < 900 || innerHeight < 520 ? 'compact' : 'full'
    document.body.dataset.layout = layout
    const r = $('stage').getBoundingClientRect()
    const dpr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 2)
    scene.resize(r.width * dpr, r.height * dpr)
    draw()
  }
  const lightName = (v) => (v < 0.35 ? 'day' : v < 0.78 ? 'golden' : 'dusk')
  const stageAt = (p) => (p >= 1 ? null : stages.find((st) => p < st.to) ?? stages.at(-1))
  function draw() {
    scene.render(state.view, state.build, state.light, state.explode)
    renders++
    ui()
  }
  function ui() {
    const st = stageAt(state.build)
    const label = st ? st.label[L] ?? st.label.en : t('done')
    const placed = placedAt(pieces, state.build)
    const pct = `${Math.round(state.build * 100)}%`
    $('stage-label').textContent = label
    $('percent').textContent = pct
    $('pieces').textContent = t('stone', { placed: placed.toLocaleString(L), total: pieces.length.toLocaleString(L) })
    $('c-stage-label').textContent = `${label} · ${pct}`
    for (const li of all('[data-stage]')) {
      const sg = stages.find((x) => x.id === li.dataset.stage)
      li.classList.toggle('done', state.build >= sg.to)
      li.classList.toggle('active', st?.id === sg.id)
      li.setAttribute('aria-current', String(st?.id === sg.id))
    }
    for (const r of all('[data-act="build"]')) {
      r.value = String(state.build)
      r.setAttribute('aria-valuetext', `${label}, ${pct}`)
    }
    const ln = t(lightName(state.light))
    $('light-label').textContent = ln
    for (const r of all('[data-act="light"]')) {
      r.value = String(state.light)
      r.setAttribute('aria-valuetext', ln)
    }
    const en = `${Math.round(state.explode * 100)}%`
    $('explode-label').textContent = state.explode > 0.01 ? en : t('assembled')
    for (const r of all('[data-act="explode"]')) {
      r.value = String(state.explode)
      r.setAttribute('aria-valuetext', state.explode > 0.01 ? en : t('assembled'))
    }
    for (const b of all('[data-view]')) b.setAttribute('aria-pressed', String(state.preset === b.dataset.view && state.mode === 'free'))
    for (const b of all('[data-act="play"]')) {
      b.setAttribute('aria-label', state.playing ? t('ariaPause') : t('ariaPlay'))
      b.setAttribute('aria-pressed', String(state.playing))
      b.textContent = b.dataset.style === 'long' ? (state.playing ? t('pause') : t('play')) : state.playing ? 'Ⅱ' : '▶'
    }
    const text = t('summary', { stage: label, percent: pct, pieces: t('stone', { placed, total: pieces.length }), light: ln })
    if (text !== summaryText) {
      summaryText = text
      $('live').textContent = text
    }
  }

  function applyFilm(at) {
    state.mode = 'film'
    state.time = clamp(at, 0, film.duration)
    const f = film.at(state.time)
    state.build = f.build
    state.light = f.light
    state.explode = f.explode
    state.view = { ...f.view, center: [...f.view.center] }
    state.preset = f.shot
  }
  function stopLoop() {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }
  function loop(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    if (state.playing) {
      let next = state.time + dt
      if (next >= film.duration) next = 0
      if (state.mode === 'film') applyFilm(next)
      else {
        // Free view: play only advances the build, the camera stays where the visitor put it.
        state.time = next
        state.build = film.at(next).build
      }
      draw()
    }
    raf = state.playing ? requestAnimationFrame(loop) : 0
  }
  function play() {
    state.capture = false
    if (state.playing) {
      state.playing = false
      stopLoop()
      draw()
      return
    }
    if (state.build >= 1 && state.mode === 'free') state.time = 0
    if (state.mode === 'film' && state.time >= film.duration - 0.05) state.time = 0
    state.playing = true
    if (!raf) {
      last = 0
      raf = requestAnimationFrame(loop)
    }
    draw()
  }
  function pause() {
    state.playing = false
    stopLoop()
  }
  function toFree() {
    if (state.mode === 'film') state.mode = 'free'
  }
  function setBuild(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('Build must be a number')
    pause()
    toFree()
    state.build = clamp(n)
    // Keep the film clock in step, so Play continues from this point of the build.
    const [b0, b1] = filmData.build
    state.time = b0 + (b1 - b0) * state.build
    draw()
  }
  function setLight(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('Light must be a number')
    pause()
    toFree()
    state.light = clamp(n)
    draw()
  }
  function setExplode(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('Explode must be a number')
    pause()
    toFree()
    state.explode = clamp(n)
    if (state.explode > 0 && state.build < 1) state.build = 1
    draw()
  }
  function view(id) {
    const v = filmData.views[id]
    if (!v) throw new Error('Unknown view')
    pause()
    toFree()
    state.preset = id
    state.view = { center: [...v.center], yaw: v.yaw, elev: v.elev, distance: v.distance }
    // A preset may open the exploded view (to look at the frame inside a shell).
    state.explode = v.explode ?? 0
    if (id !== 'overview' && state.build < 1) state.build = 1
    draw()
  }
  function stage(id) {
    const sg = stages.find((x) => x.id === id)
    if (!sg) throw new Error('Unknown stage')
    setBuild(sg.to - 1e-4)
  }
  function zoom(f) {
    pause()
    toFree()
    state.view.distance = clamp(state.view.distance * f, 6, 160)
    draw()
  }
  function orbit(dx, dy) {
    toFree()
    state.view.yaw -= dx
    state.view.elev = clamp(state.view.elev + dy, 0.02, 1.3)
    draw()
  }
  function reset() {
    view('overview')
  }

  for (const b of all('[data-act="play"]')) b.addEventListener('click', play)
  for (const r of all('[data-act="build"]')) r.addEventListener('input', (e) => setBuild(e.target.value))
  for (const r of all('[data-act="light"]')) r.addEventListener('input', (e) => setLight(e.target.value))
  for (const r of all('[data-act="explode"]')) r.addEventListener('input', (e) => setExplode(e.target.value))
  for (const b of all('[data-view]')) b.addEventListener('click', () => view(b.dataset.view))
  for (const b of all('[data-stage] button')) b.addEventListener('click', () => stage(b.parentElement.dataset.stage))
  for (const b of all('[data-act="reset"]')) b.addEventListener('click', reset)
  for (const b of all('[data-act="zoom-in"]')) b.addEventListener('click', () => zoom(0.85))
  for (const b of all('[data-act="zoom-out"]')) b.addEventListener('click', () => zoom(1 / 0.85))
  $('c-view').addEventListener('click', () => {
    const ids = Object.keys(filmData.views)
    const i = ids.indexOf(state.preset)
    view(ids[i < 0 ? 1 % ids.length : (i + 1) % ids.length])
  })
  let pointer = null
  canvas.addEventListener('pointerdown', (e) => {
    pointer = { x: e.clientX, y: e.clientY }
    canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer) return
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y
    pointer = { x: e.clientX, y: e.clientY }
    orbit(dx * 0.006, dy * 0.004)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => (pointer = null))
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    zoom(Math.exp(e.deltaY * 0.0012))
  }, { passive: false })
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input')) return
    if (e.key === ' ') {
      e.preventDefault()
      play()
    }
  })
  addEventListener('resize', fit)

  applyFilm(0)
  fit()
  document.body.classList.add('ready')

  function script(at) {
    stopLoop()
    state.playing = false
    state.capture = true
    applyFilm(at)
    draw()
    return api.inspect().facts
  }
  function step(n = 1, dt = 1 / COVER.fps) {
    if (state.playing) for (let i = 0; i < n; i++) applyFilm(Math.min(film.duration, state.time + dt))
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
        mode: state.mode, playing: state.playing, time: state.time, build: state.build, light: state.light, explode: state.explode, preset: state.preset,
        yaw: state.view.yaw, elev: state.view.elev, distance: state.view.distance, layout, renders,
        pieces: pieces.length, placed: placedAt(pieces, state.build), stages: stages.length, stage: stageAt(state.build)?.id ?? 'done',
        duration: film.duration, triangles: scene.state.triangles ?? 0, drawCalls: scene.state.calls ?? 0, reducedMotion: reduced,
      },
    }),
    act(name, arg) {
      if (name === 'play') {
        if (!state.playing) play()
      } else if (name === 'pause') {
        pause()
        draw()
      } else if (name === 'build') setBuild(arg)
      else if (name === 'light') setLight(arg)
      else if (name === 'explode') setExplode(arg)
      else if (name === 'view') view(arg)
      else if (name === 'stage') stage(arg)
      else if (name === 'zoom') zoom(Number(arg) || 1)
      else if (name === 'reset') reset()
      else throw new Error(`Unknown action ${name}`)
      return api.inspect()
    },
    pointer(nx, ny) {
      const base = filmData.views[state.preset] ?? filmData.views.overview
      toFree()
      state.view.yaw = base.yaw + clamp(Number(nx), -1, 1) * Math.PI * 0.5
      state.view.elev = clamp(base.elev + clamp(Number(ny), -1, 1) * 0.3, 0.02, 1.3)
      draw()
    },
    press: () => pause(),
    release: () => {},
    seek: script,
    ...(params.capture ? { step, script } : {}),
  }
  window.__scene = api
  if (!params.capture && !reduced) play()
  post({ type: `${SLUG}:ready` })
}

function webglAvailable() {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

function markup(t, copy, coarse) {
  const views = Object.entries(copy.views ?? {}).map(([id, label]) => `<button type="button" data-view="${id}" aria-pressed="false">${label}</button>`).join('')
  const stages = recipe.stages.map((st, i) => `<li data-stage="${st.id}"><button type="button"><span>${String(i + 1).padStart(2, '0')}</span>${st.label[document.documentElement.lang] ?? st.label.en}</button></li>`).join('')
  return `
<main id="shell">
 <section id="stage" class="stage" aria-label="${t('sceneAria')}">
  <canvas id="world" tabindex="-1"></canvas>
  <div id="loading" class="loading">${t('loading')}</div>
  <header class="title"><span class="brand">${t('brand')}</span><h1>${copy.title ?? ''}</h1><p class="place">${copy.place ?? ''}</p></header>
  <div class="progress"><b id="percent"></b><span id="stage-label"></span><small id="pieces"></small></div>
  <aside class="panel"><p class="eyebrow">${copy.eyebrow ?? ''}</p><p class="text">${copy.text ?? ''}</p><h2>${t('stages')}</h2><ol class="stages">${stages}</ol><h2>${t('views')}</h2><div class="views" role="group" aria-label="${t('views')}">${views}</div><p class="note">${copy.disclaimer ?? ''}</p></aside>
  <div class="zoom"><button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button><button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button></div>
  <div class="c-top"><b id="c-stage-label"></b></div>
 </section>
 <footer class="dock">
  <button type="button" data-act="play" data-style="long" class="filled play"></button>
  <label class="build"><span>${t('build')}</span><input type="range" data-act="build" min="0" max="1" step="0.001" value="0" aria-label="${t('ariaBuild')}"></label>
  <label class="light"><span>${t('light')} · <b id="light-label"></b></span><input type="range" data-act="light" min="0" max="1" step="0.01" value="0" aria-label="${t('ariaLight')}"></label>
  <label class="explode"><span>${t('explode')} · <b id="explode-label"></b></span><input type="range" data-act="explode" min="0" max="1" step="0.01" value="0" aria-label="${t('ariaExplode')}"></label>
  <button type="button" data-act="reset">${t('reset')}</button>
  <span class="hint">${coarse ? t('hintTouch') : t('hint')}</span>
 </footer>
 <footer class="c-dock">
  <button type="button" data-act="play" class="round"></button>
  <input type="range" data-act="build" min="0" max="1" step="0.001" value="0" aria-label="${t('ariaBuild')}">
  <button type="button" id="c-view" aria-label="${t('views')}" title="${t('views')}">◎</button>
  <button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button>
  <button type="button" data-act="reset" aria-label="${t('reset')}" title="${t('reset')}">↺</button>
 </footer>
 <p id="live" class="sr" aria-live="polite"></p>
</main>`
}
