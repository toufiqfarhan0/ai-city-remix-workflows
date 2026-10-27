// Page shell: the poster canvas on a stage, a bilingual HUD, the controls and the capture contract.
//
// Two ways to look: the tour (the film timeline, a pure function of time) and free styling (pick the poster kind
// — street map, skyline, food map or landmark — a theme, format and map shape, drag to pan, wheel or pinch to
// zoom, redraw, show or hide the marks). Both draw through the same renderer from the view.
import poster from '../city/poster.json'
import style from '../city/style.json'
import strings from '../i18n/strings.json'
import { parseParams } from '../lib/params.mjs'
import { createFilm, kindReveal, kindRevealLength } from './film.js'
import { createRenderer, FORMATS, KINDS, layout } from './render.js'
import { coordText, createWorld, latLonOf } from './world.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const FORMAT_ORDER = ['portrait', 'square', 'landscape']
const WIPE_S = 0.7

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
  document.title = `${poster.title} · ${s.title}`
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const themes = style.themes
  document.getElementById('app').innerHTML = markup(t, coarse, esc(style.city?.[L] ?? poster.title), KINDS.filter((k) => k === 'map' || (k === 'skyline' && poster.skyline) || (k === 'food' && poster.food?.total) || (k === 'landmark' && poster.landmarks?.length)), themes.map((th) => ({ id: th.id, name: esc(th.name?.[L] ?? th.name?.en ?? th.id), paper: th.paper, ink: th.roads.major })))
  const $ = (id) => document.getElementById(id)
  const all = (sel) => [...document.querySelectorAll(sel)]
  const canvas = $('poster')
  const ctx = canvas.getContext('2d', { alpha: false })
  const post = (msg) => window.parent !== window && window.parent.postMessage(msg, '*')
  if (!ctx || typeof Path2D !== 'function') {
    $('loading').textContent = s.canvasMissing
    post({ type: `${SLUG}:error`, code: 'webgl' })
    throw new Error('canvas')
  }
  let world
  try {
    world = createWorld(poster)
  } catch {
    $('loading').textContent = s.dataError
    post({ type: `${SLUG}:error`, code: 'data' })
    throw new Error('data')
  }
  const film = createFilm(themes, style.film, world.kinds)
  const COVER = { fps: 30, frames: 900, posterAt: style.film.posterAt ?? 11 }
  const FILM = { fps: 30, frames: Math.round(film.duration * 30), posterAt: style.film.posterAt ?? 11 }
  const renderer = createRenderer(world, style)
  const baseSpan = 2 * world.radius * (style.span ?? 0.94)
  const home = () => ({ cx: 0, cy: 0, span: baseSpan })

  // State: mode 'tour' plays the film; 'explore' eases the camera and runs the live wipe and redraw.
  const state = {
    mode: 'tour', playing: false, filmT: 0, capture: false,
    theme: 0, next: null, wipe: 0, shape: 'full', nextShape: null, format: 'portrait', marks: true,
    kind: 'map', landmark: 0, nextKind: null, nextLandmark: null, nextReveal: null,
    camera: home(), target: home(), reveal: {}, drawT: null, wipeT: null,
  }
  let raf = 0, last = 0, renders = 0, frameMs = 0, layoutName = 'full', dpr = 1, size = [0, 0], dirty = true, summaryText = ''

  function fit() {
    layoutName = params.embed || innerWidth < 1180 || innerHeight < 520 ? 'compact' : 'full'
    document.body.dataset.layout = layoutName
    const stage = $('stage').getBoundingClientRect()
    const pad = layoutName === 'compact' ? 10 : 36
    const a = FORMATS[state.format]
    const aw = Math.max(80, stage.width - 2 * pad), ah = Math.max(80, stage.height - 2 * pad)
    const pw = Math.floor(Math.min(aw, ah * a)), ph = Math.floor(pw / a)
    dpr = quality === 'low' ? 1 : Math.min(2, devicePixelRatio || 1)
    canvas.style.width = `${pw}px`
    canvas.style.height = `${ph}px`
    canvas.style.left = `${Math.round((stage.width - pw) / 2)}px`
    canvas.style.top = `${Math.round((stage.height - ph) / 2)}px`
    if (canvas.width !== Math.round(pw * dpr) || canvas.height !== Math.round(ph * dpr)) {
      canvas.width = Math.round(pw * dpr)
      canvas.height = Math.round(ph * dpr)
    }
    size = [pw, ph]
    dirty = true
    draw()
  }

  // Localized type lines per kind (the poster title stays the baked name).
  const fmtN = (n) => Number(n).toLocaleString(L)
  function texts(format, W, H) {
    const out = {}
    const S = world.skyline
    if (S) {
      const map = layout(format, 'full', W, H).map
      const ratio = ((map.h * 0.56) / S.top) / ((map.w * 0.92) / (-2 * S.x0))
      const top = S.labels[0]
      out.skyline = { subtitle: t('sky.subtitle', { side: t(`side.${S.from}`) }), line: top ? t('sky.line', { name: top.name, h: top.h, x: Math.round(ratio) }) : t('sky.lineNoName', { x: Math.round(ratio) }) }
    }
    const F = world.food
    if (F?.total) {
      const cuisines = F.cuisines.slice(0, 3).map(([c]) => t(`cuisine.${c}`) === `cuisine.${c}` ? c.replace(/_/g, ' ') : t(`cuisine.${c}`)).join(' · ')
      out.food = {
        subtitle: t('food.subtitle', { n: fmtN(F.total) }),
        line: cuisines ? t('food.line', { list: cuisines }) : coordText(poster.center),
        legend: F.groups.map((g, i) => ({ group: i, label: `${t(`food.${g}`)} ${fmtN(F.counts[g])}` })).filter((g, i) => F.counts[F.groups[i]] > 0),
      }
    }
    out.landmark = {}
    world.landmarks.forEach((l, i) => {
      const f = l.facts ?? {}
      const bits = []
      if (f.height) bits.push(t('lm.height', { h: f.height }))
      if (f.built) bits.push(t('lm.built', { v: f.built }))
      if (f.architect) bits.push(t('lm.architect', { v: f.architect }))
      out.landmark[i] = { title: l.name, subtitle: style.city?.en ?? poster.title, line: bits.length ? bits.join(' · ') : coordText(latLonOf(poster.center, l.x, l.y)) }
    })
    return out
  }
  let textCache = null
  const textFor = () => {
    const key = `${state.format}:${canvas.width}x${canvas.height}`
    if (!textCache || textCache.key !== key) textCache = { key, value: texts(state.format, canvas.width, canvas.height) }
    return textCache.value
  }
  const view = () => {
    const tx = textFor()
    return {
      theme: state.theme, next: state.next, wipe: state.wipe, shape: state.shape, nextShape: state.nextShape,
      kind: state.kind, landmark: state.landmark, nextKind: state.nextKind, nextLandmark: state.nextLandmark, nextReveal: state.nextReveal,
      format: state.format, camera: state.camera, baseSpan, reveal: state.reveal, marks: state.marks,
      text: tx,
    }
  }
  function draw() {
    const t0 = performance.now()
    renderer.draw(ctx, canvas.width, canvas.height, view())
    frameMs = performance.now() - t0
    renders++
    dirty = false
    hud()
  }

  const visibleTheme = () => (state.next !== null && state.wipe >= 0.5 ? state.next : state.theme)
  function hud() {
    const th = themes[visibleTheme()]
    const name = th.name?.[L] ?? th.name?.en ?? th.id
    $('theme-name').textContent = name
    $('mode').textContent = state.mode === 'tour' ? (state.playing ? t('tour') : t('paused')) : t('styling')
    for (const b of all('[data-act="play"]')) {
      const on = state.playing && state.mode === 'tour'
      b.setAttribute('aria-label', on ? t('ariaPause') : t('ariaPlay'))
      b.setAttribute('aria-pressed', String(on))
      b.textContent = b.dataset.style === 'long' ? (on ? t('pause') : t('play')) : on ? 'Ⅱ' : '▶'
    }
    for (const b of all('[data-act="theme"]')) b.setAttribute('aria-pressed', String(Number(b.dataset.index) === visibleTheme()))
    for (const b of all('[data-act="marks"]')) b.setAttribute('aria-pressed', String(state.marks))
    const kindNow = state.nextKind && state.wipe >= 0.5 ? state.nextKind : state.kind
    for (const b of all('[data-act="kind"][data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === kindNow))
    $('kind-name').textContent = kindNow === 'landmark' ? world.landmarks[state.nextKind && state.wipe >= 0.5 ? state.nextLandmark : state.landmark]?.name ?? t('kind.landmark') : t(`kind.${kindNow}`)
    const shape = state.nextShape && state.wipe >= 0.5 ? state.nextShape : state.shape
    for (const b of all('[data-act="shape"]')) {
      b.setAttribute('aria-pressed', String(shape === 'circle'))
      if (b.dataset.style === 'long') b.textContent = shape === 'circle' ? t('shapeCircle') : t('shapeFull')
    }
    for (const b of all('[data-act="format"]')) if (b.dataset.style === 'long') b.textContent = t(`format.${state.format}`)
    const text = t('summary', { city: poster.title, theme: name, format: t(`format.${state.format}`) })
    if (text !== summaryText) {
      summaryText = text
      $('live').textContent = text
    }
  }

  // ── Motion ────────────────────────────────────────────────────────────────────────────────
  function applyFilm(at) {
    state.filmT = clamp(at, 0, film.duration)
    const f = film.at(state.filmT)
    Object.assign(state, {
      theme: f.theme, next: f.next, wipe: f.wipe, shape: f.shape, nextShape: f.nextShape, reveal: f.reveal,
      kind: f.kind, landmark: f.landmark, nextKind: f.nextKind, nextLandmark: f.nextLandmark, nextReveal: f.nextReveal,
    })
    state.drawT = state.wipeT = null
    dirty = true
  }
  /** Advances the live animations of the explore mode by dt seconds. */
  function tick(dt) {
    const c = state.camera, T = state.target
    const k = state.capture ? 1 : Math.min(1, dt * 9)
    if (Math.abs(c.cx - T.cx) + Math.abs(c.cy - T.cy) > 0.05 || Math.abs(c.span / T.span - 1) > 1e-4) {
      c.cx += (T.cx - c.cx) * k
      c.cy += (T.cy - c.cy) * k
      c.span = Math.exp(Math.log(c.span) + (Math.log(T.span) - Math.log(c.span)) * k)
      dirty = true
    }
    if (state.wipeT !== null) {
      state.wipeT += dt
      const w = clamp(state.wipeT / WIPE_S, 0, 1)
      state.wipe = 1 - (1 - w) ** 3
      if (w >= 1) {
        state.theme = state.next
        state.shape = state.nextShape ?? state.shape
        if (state.nextKind) {
          state.kind = state.nextKind
          state.landmark = state.nextLandmark ?? state.landmark
          state.reveal = state.nextReveal ?? {}
        }
        state.next = state.nextShape = state.nextKind = state.nextLandmark = state.nextReveal = null
        state.wipe = 0
        state.wipeT = null
      }
      dirty = true
    }
    if (state.drawT !== null) {
      // The draw-in of the kind on screen, or of the one being wiped in.
      state.drawT += dt
      const kind = state.nextKind ?? state.kind
      const r = kindReveal(kind, state.drawT, style.film.reveal)
      if (state.nextKind) state.nextReveal = r
      else state.reveal = r
      if (state.drawT >= kindRevealLength(kind, style.film.reveal) + 0.3) {
        state.drawT = null
        if (state.nextKind) state.nextReveal = {}
        else state.reveal = {}
      }
      dirty = true
    }
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
    } else tick(dt)
    if (dirty) draw()
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
    if (state.mode !== 'tour') Object.assign(state.camera, home())
    Object.assign(state.target, state.camera)
    state.mode = 'tour'
    state.playing = true
    applyFilm(state.filmT >= film.duration - 0.05 ? 0 : state.filmT)
    draw()
    run()
  }
  /** Leaves the tour on what is on screen: a running wipe settles on its target first. */
  function toExplore() {
    if (state.mode === 'tour') {
      state.mode = 'explore'
      state.playing = false
      if (state.next !== null && state.wipe >= 0.5) {
        state.theme = state.next
        state.shape = state.nextShape ?? state.shape
        if (state.nextKind) {
          state.kind = state.nextKind
          state.landmark = state.nextLandmark ?? state.landmark
        }
      }
      state.next = state.nextShape = state.nextKind = state.nextLandmark = state.nextReveal = null
      state.wipe = 0
      state.reveal = {}
      dirty = true
    }
    run()
  }
  const settle = () => {
    if (state.capture) tick(10)
    draw()
  }
  function setTheme(i) {
    const n = Number(i)
    const idx = i === 'next' || i === undefined ? (visibleTheme() + 1) % themes.length : Number.isInteger(n) ? n : themes.findIndex((th) => th.id === i)
    if (!(idx >= 0 && idx < themes.length)) throw new Error('Theme must be an index, an id or "next"')
    toExplore()
    if (state.wipeT !== null) tick(WIPE_S)
    if (idx === state.theme) return draw()
    state.next = idx
    state.nextShape = null
    state.wipeT = 0
    settle()
  }
  function setShape(v) {
    toExplore()
    if (state.wipeT !== null) tick(WIPE_S)
    const to = v === 'circle' || v === 'full' ? v : state.shape === 'circle' ? 'full' : 'circle'
    if (to === state.shape) return draw()
    state.next = state.theme
    state.nextShape = to
    state.wipeT = 0
    settle()
  }
  /** Wipes to another poster kind (and landmark), playing its draw-in. */
  function setKind(v, landmark) {
    toExplore()
    if (state.wipeT !== null) tick(WIPE_S)
    const kinds = world.kinds
    const to = kinds.includes(v) ? v : kinds[(kinds.indexOf(state.kind) + 1) % kinds.length]
    const lm = to === 'landmark' ? (landmark ?? (state.kind === 'landmark' ? (state.landmark + 1) % world.landmarks.length : state.landmark)) : state.landmark
    if (to === state.kind && lm === state.landmark) return draw()
    state.next = state.theme
    state.nextShape = null
    state.nextKind = to
    state.nextLandmark = lm
    state.nextReveal = kindReveal(to, 0, style.film.reveal)
    state.wipeT = 0
    state.drawT = 0
    if (state.capture) {
      tick(WIPE_S)
      tick(10)
    }
    draw()
  }
  function nextLandmark() {
    if (!world.landmarks.length) throw new Error('This poster has no landmarks')
    setKind('landmark', state.kind === 'landmark' ? (state.landmark + 1) % world.landmarks.length : state.landmark)
  }
  function setFormat(v) {
    toExplore()
    const to = FORMAT_ORDER.includes(v) ? v : FORMAT_ORDER[(FORMAT_ORDER.indexOf(state.format) + 1) % FORMAT_ORDER.length]
    state.format = to
    fit()
  }
  function clampTarget() {
    const T = state.target
    T.span = clamp(T.span, baseSpan / 8, baseSpan * 1.15)
    const lim = world.radius * 0.95
    T.cx = clamp(T.cx, -lim, lim)
    T.cy = clamp(T.cy, -lim, lim)
  }
  /** Map metres per CSS pixel at the target zoom. */
  const metresPerPx = () => {
    const map = layout(state.format, state.shape, size[0], size[1]).map
    return state.target.span / Math.max(map.w, map.h)
  }
  function panPixels(dx, dy) {
    toExplore()
    const k = metresPerPx()
    state.target.cx -= dx * k
    state.target.cy += dy * k
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
  /** Zooms by factor f, keeping the map point under CSS point (px, py) of the poster in place. */
  function zoomBy(f, px, py) {
    const k = Number(f)
    if (!Number.isFinite(k) || k <= 0) throw new Error('Zoom factor must be a positive number')
    toExplore()
    const map = layout(state.format, state.shape, size[0], size[1]).map
    const ax = px ?? map.x + map.w / 2, ay = py ?? map.y + map.h / 2
    const m = metresPerPx()
    const wx = state.target.cx + (ax - (map.x + map.w / 2)) * m, wy = state.target.cy - (ay - (map.y + map.h / 2)) * m
    state.target.span /= k
    clampTarget()
    const m2 = metresPerPx()
    state.target.cx = wx - (ax - (map.x + map.w / 2)) * m2
    state.target.cy = wy + (ay - (map.y + map.h / 2)) * m2
    clampTarget()
    settle()
  }
  function redraw() {
    toExplore()
    state.drawT = 0
    state.reveal = kindReveal(state.kind, 0, style.film.reveal)
    if (state.capture) tick(state.kind === 'map' ? 4 : 1.2)
    draw()
  }
  function toggleMarks() {
    state.marks = !state.marks
    dirty = true
    draw()
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────
  for (const b of all('[data-act="play"]')) b.addEventListener('click', play)
  for (const b of all('[data-act="theme"]')) b.addEventListener('click', () => setTheme(b.dataset.index ?? 'next'))
  for (const b of all('[data-act="shape"]')) b.addEventListener('click', () => setShape())
  for (const b of all('[data-act="format"]')) b.addEventListener('click', () => setFormat())
  for (const b of all('[data-act="draw"]')) b.addEventListener('click', redraw)
  for (const b of all('[data-act="marks"]')) b.addEventListener('click', toggleMarks)
  for (const b of all('[data-act="kind"]')) b.addEventListener('click', () => (b.dataset.kind === 'landmark' && state.kind === 'landmark' ? nextLandmark() : setKind(b.dataset.kind ?? 'next')))
  for (const b of all('[data-act="zoom-in"]')) b.addEventListener('click', () => zoomBy(1.4))
  for (const b of all('[data-act="zoom-out"]')) b.addEventListener('click', () => zoomBy(1 / 1.4))
  const stage = $('stage')
  const toPoster = (e) => {
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const [px, py] = toPoster(e)
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
    touches.set(e.pointerId, [e.clientX, e.clientY])
    if (touches.size === 2) {
      const [a, b] = [...touches.values()]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (pinch > 0 && d > 0) zoomBy(d / pinch)
      pinch = d
      return
    }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]
    if (dx || dy) panPixels(dx, dy)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, (e) => {
    touches.delete(e.pointerId)
    pinch = 0
  })
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input')) return
    const k = e.key
    if (k === ' ') {
      e.preventDefault()
      play()
    } else if (k >= '1' && k <= String(themes.length)) setTheme(Number(k) - 1)
    else if (k === 't' || k === 'T') setTheme('next')
    else if (k === 'c' || k === 'C') setShape()
    else if (k === 'f' || k === 'F') setFormat()
    else if (k === 'd' || k === 'D') redraw()
    else if (k === 'm' || k === 'M') toggleMarks()
    else if (k === 'k' || k === 'K') setKind('next')
    else if ((k === 'l' || k === 'L') && world.landmarks.length) nextLandmark()
    else if (k === '+' || k === '=') zoomBy(1.4)
    else if (k === '-' || k === '_') zoomBy(1 / 1.4)
    else if (k.startsWith('Arrow')) {
      e.preventDefault()
      panPixels(k === 'ArrowLeft' ? 40 : k === 'ArrowRight' ? -40 : 0, k === 'ArrowUp' ? 40 : k === 'ArrowDown' ? -40 : 0)
    }
  })
  addEventListener('resize', fit)

  // ── Boot ──────────────────────────────────────────────────────────────────────────────────
  applyFilm(0)
  fit()
  document.body.classList.add('ready')

  // ── Capture contract ──────────────────────────────────────────────────────────────────────
  // script(t): the film frame at t (pure: portrait, marks on, home camera). step(n, dt): advance n fixed steps.
  function script(at) {
    stopLoop()
    state.capture = true
    state.mode = 'tour'
    state.playing = false
    state.marks = true
    Object.assign(state.camera, home())
    Object.assign(state.target, home())
    if (state.format !== 'portrait') {
      state.format = 'portrait'
      fit()
    }
    applyFilm(at)
    draw()
    return api.inspect().facts
  }
  function step(n = 1, dt = 1 / COVER.fps) {
    for (let i = 0; i < n; i++) {
      if (state.mode === 'tour' && state.playing) applyFilm(Math.min(film.duration, state.filmT + dt))
      else if (state.mode === 'explore') tick(dt)
    }
    draw()
  }
  /** Renders the current style (or the given one) at print size and returns a PNG data URL. */
  async function exportPoster({ theme, format, shape, kind, landmark, width = 3000 } = {}) {
    const fmt = FORMAT_ORDER.includes(format) ? format : state.format
    const w = clamp(Math.round(Number(width) || 3000), 600, 9000)
    const h = Math.round(w / FORMATS[fmt])
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d', { alpha: false })
    const idx = theme === undefined ? visibleTheme() : Number.isInteger(theme) ? theme : themes.findIndex((th) => th.id === theme)
    const k = world.kinds.includes(kind) ? kind : state.kind
    const lm = Number.isInteger(landmark) ? landmark : state.landmark
    renderer.draw(g, w, h, { ...view(), text: texts(fmt, w, h), theme: Math.max(0, idx), next: null, wipe: 0, nextShape: null, nextKind: null, reveal: {}, kind: k, landmark: lm, format: fmt, shape: shape === 'circle' || shape === 'full' ? shape : state.shape })
    const blob = await c.convertToBlob({ type: 'image/png' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `data:image/png;base64,${btoa(bin)}`
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
        mode: state.mode, playing: state.playing, filmT: state.filmT, theme: themes[visibleTheme()].id, themeIndex: visibleTheme(),
        kind: state.nextKind && state.wipe >= 0.5 ? state.nextKind : state.kind, landmark: state.nextKind && state.wipe >= 0.5 ? state.nextLandmark : state.landmark,
        kinds: world.kinds.length, kindIds: [...world.kinds], landmarkCount: world.landmarks.length, landmarkNames: world.landmarks.map((l) => l.name),
        foodPlaces: world.food?.total ?? 0, skylineMapped: world.skyline?.mapped ?? 0, skylineLabels: world.skyline?.labels.length ?? 0,
        wipe: state.wipe, shape: state.nextShape && state.wipe >= 0.5 ? state.nextShape : state.shape, format: state.format, marks: state.marks,
        drawing: state.drawT !== null || Object.values(state.reveal).some((v) => v < 1) || Object.values(state.nextReveal ?? {}).some((v) => v < 1),
        camera: { ...state.camera }, target: { ...state.target }, layout: layoutName, dpr, posterPx: [canvas.width, canvas.height], posterCss: [...size],
        renders, frameMs, themes: themes.length, themeIds: themes.map((th) => th.id), roads: world.stats.roads, roadKm: world.stats.roadKm, water: world.stats.water,
        parks: world.stats.parks, rail: world.stats.rail, markCount: world.marks.length, duration: film.duration, reducedMotion: reduced,
      },
    }),
    act(name, arg, arg2) {
      if (name === 'play') {
        if (!(state.mode === 'tour' && state.playing)) play()
      } else if (name === 'pause') {
        state.playing = false
        draw()
      } else if (name === 'theme') setTheme(arg)
      else if (name === 'shape') setShape(arg)
      else if (name === 'format') setFormat(arg)
      else if (name === 'pan') pan(arg, arg2)
      else if (name === 'zoom') zoomBy(arg)
      else if (name === 'draw') redraw()
      else if (name === 'marks') toggleMarks()
      else if (name === 'kind') setKind(arg, arg2)
      else if (name === 'landmark') nextLandmark()
      else throw new Error(`Unknown action ${name}`)
      return api.inspect()
    },
    pointer(nx, ny) {
      // Normalized pointer (-1..1): pans the map toward that side.
      panPixels(-Number(nx) * size[0] * 0.1, -Number(ny) * size[1] * 0.1)
    },
    press: () => {
      state.playing = false
      draw()
    },
    release: () => {},
    seek: script,
    exportPoster,
    ...(params.capture ? { step, script } : {}),
  }
  window.__scene = api
  if (!params.capture && !reduced) play()
  post({ type: `${SLUG}:ready` })
}

function markup(t, coarse, city, kinds, themes) {
  const tabs = kinds.map((k) => `<button type="button" data-act="kind" data-kind="${k}" aria-label="${t(`ariaKind.${k}`)}">${t(`kind.${k}`)}</button>`).join('')
  const swatches = themes.map((th, i) => `<button type="button" data-act="theme" data-index="${i}" class="swatch" aria-label="${t('ariaTheme', { name: th.name })}" title="${th.name}" style="--paper:${th.paper};--ink:${th.ink}"><i></i></button>`).join('')
  return `
<main id="shell">
 <section id="stage" class="stage" aria-label="${t('sceneAria')}">
  <canvas id="poster" role="img" aria-label="${t('sceneAria')}"></canvas>
  <div id="loading" class="loading">${t('loading')}</div>
  <header class="top">
   <div class="where"><span class="brand">${t('brand')}</span><b>${city}</b><span><span id="kind-name"></span> · <span id="theme-name"></span> · <span id="mode"></span></span></div>
  </header>
 </section>
 <footer class="dock">
  <button type="button" data-act="play" data-style="long" class="filled play"></button>
  <div class="group kinds" role="group" aria-label="${t('kinds')}">${tabs}</div>
  <div class="group swatches" role="group" aria-label="${t('themes')}">${swatches}</div>
  <button type="button" data-act="format" data-style="long" aria-label="${t('ariaFormat')}"></button>
  <button type="button" data-act="shape" data-style="long" aria-label="${t('ariaShape')}"></button>
  <div class="group" role="group" aria-label="${t('zoom')}"><button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button><button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button></div>
  <button type="button" data-act="draw" aria-label="${t('ariaDraw')}">${t('draw')}</button>
  <button type="button" data-act="marks" aria-label="${t('ariaMarks')}">${t('marks')}</button>
  <span class="hint">${coarse ? t('hintTouch') : t('hint')}</span>
 </footer>
 <footer class="c-dock">
  <button type="button" data-act="play" class="round"></button>
  <button type="button" data-act="kind" aria-label="${t('nextKind')}" title="${t('nextKind')}">▤</button>
  <button type="button" data-act="theme" aria-label="${t('nextTheme')}" title="${t('nextTheme')}">◐</button>
  <button type="button" data-act="format" aria-label="${t('ariaFormat')}" title="${t('ariaFormat')}">▭</button>
  <button type="button" data-act="shape" aria-label="${t('ariaShape')}" title="${t('ariaShape')}">◯</button>
  <button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button>
  <button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button>
  <button type="button" data-act="draw" aria-label="${t('ariaDraw')}" title="${t('draw')}">✎</button>
 </footer>
 <p id="live" class="sr" aria-live="polite"></p>
 <p class="sr">${t('disclaimer')}</p>
</main>`
}
