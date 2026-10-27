// Page shell: two layouts around one Three.js scene, bilingual controls and the capture contract.
//
// - Full layout: the 1920×1080 editorial composition scaled into the window (desktop and the film).
// - Compact layout: the scene fills the frame with a small control dock (embeds, phones, small windows).
//
// Every control drives the same state (selected building, framing, camera, day fraction, tour clock).
// The film state is a pure function of time: seek(t) never depends on earlier frames.
import { createShowcase } from './showcase-scene.js';
import { landmarks, duration } from './config.js';
import strings from '../i18n/strings.json';
import { parseParams } from '../lib/params.mjs';

const COVER = { fps: 30, frames: duration * 30, posterAt: 12 };
const STAGE = { width: 1212, height: 730 };
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const pad = (i) => String(i + 1).padStart(2, '0');
const STOPS = [['night', '0'], ['dawn', '0.333'], ['sunrise', '0.667'], ['day', '1']];

export function start({ SLUG, VERSION }) {
  const params = parseParams(location.search);
  const L = params.lang;
  const s = strings[L];
  const t = (key, vars = {}) => (s[key] ?? strings.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = params.quality ?? (coarse ? 'low' : 'high');
  const embedded = window.parent !== window;
  const errors = [];
  addEventListener('error', (e) => errors.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  document.documentElement.lang = L;
  document.title = s.title;

  const app = document.getElementById('app');
  app.innerHTML = markup(t, coarse);
  const $ = (id) => document.getElementById(id);
  const all = (sel) => [...document.querySelectorAll(sel)];
  const canvas = $('world');

  let film;
  let selected = 'prayer', preset = 'orbit', day = 0, time = 0, playing = false, capture = false, view = null;
  let raf = 0, last = 0, renders = 0, layout = 'full';

  // ── Layout ────────────────────────────────────────────────────────────────────────────────
  function chooseLayout() {
    return params.embed || innerWidth < 900 || innerHeight < 520 ? 'compact' : 'full';
  }
  function fit() {
    layout = chooseLayout();
    document.body.dataset.layout = layout;
    const dpr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 2);
    if (layout === 'full') {
      const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
      const root = $('root');
      root.style.transform = `scale(${scale})`;
      root.style.left = `${(innerWidth - 1920 * scale) / 2}px`;
      root.style.top = `${(innerHeight - 1080 * scale) / 2}px`;
      if (canvas.parentElement !== $('full-stage')) $('full-stage').prepend(canvas);
      // At scale 1 and DPR 1 (the film) the backing store is exactly the stage size.
      const k = clamp(scale * dpr, 0.5, 2);
      film?.resize(STAGE.width * k, STAGE.height * k);
    } else {
      if (canvas.parentElement !== $('c-stage')) $('c-stage').prepend(canvas);
      const r = $('c-stage').getBoundingClientRect();
      film?.resize(r.width * dpr, r.height * dpr);
    }
    if (film && view) draw();
  }

  // ── State → UI ────────────────────────────────────────────────────────────────────────────
  function updateUI() {
    const index = landmarks.findIndex((l) => l.id === selected);
    const name = t(`${selected}.name`);
    $('chapter').textContent = t('chapter', { n: pad(index) });
    $('number').textContent = pad(index);
    $('landmark-title').textContent = name;
    $('description').textContent = t(`${selected}.text`);
    $('material').textContent = t(`${selected}.tag`);
    $('scene-tag').textContent = L === 'en' ? name.toUpperCase() : name;
    $('scene-detail').textContent = t(`${selected}.detail`);
    $('c-title').textContent = `${pad(index)} · ${name}`;
    $('c-tag').textContent = t(`${selected}.tag`);
    const stage = Math.round(day * 3);
    const label = t(STOPS[stage][0]);
    $('light-chip').textContent = L === 'en' ? label.toUpperCase() : label;
    $('c-light-chip').textContent = label;
    $('time-label').textContent = label;
    $('c-time').textContent = label;
    for (const input of all('[data-act="light"]')) {
      input.value = String(day);
      input.setAttribute('aria-valuetext', label);
    }
    $('light-fill').style.width = `${day * 100}%`;
    $('c-light').style.setProperty('--v', String(day));
    for (const b of all('[data-landmark]')) {
      const active = b.dataset.landmark === selected;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    }
    all('[data-light]').forEach((b, i) => b.classList.toggle('active', i === stage));
    for (const p of ['orbit', 'detail']) {
      for (const b of all(`[data-view="${p}"]`)) {
        b.classList.toggle('selected', preset === p);
        b.setAttribute('aria-pressed', String(preset === p));
      }
    }
    $('c-view').textContent = preset === 'detail' ? t('orbitView') : t('detailView');
    const run = playing || capture;
    for (const b of all('[data-act="play"]')) {
      b.setAttribute('aria-label', run ? t('ariaPause') : t('ariaPlay'));
      b.textContent = b.dataset.style === 'long' ? (run ? t('pauseTour') : t('playTour')) : run ? 'Ⅱ' : '▶';
    }
  }

  // ── Scene operations ─────────────────────────────────────────────────────────────────────
  function render(v, extra) {
    film.renderView(v, day, extra);
    renders++;
  }
  function seek(at) {
    time = clamp(at, 0, duration);
    const st = film.renderAt(time);
    renders++;
    selected = st.id;
    preset = st.preset;
    day = st.day;
    view = st.view;
    updateUI();
    return st;
  }
  function draw() {
    render(view, { t: time, id: selected, preset });
    updateUI();
  }
  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }
  function pause() {
    playing = false;
    capture = false;
    stopLoop();
    updateUI();
  }
  function presetView() {
    const info = landmarks.find((l) => l.id === selected);
    const detail = preset === 'detail';
    return { center: [...(detail ? info.detailCenter : info.center)], yaw: info.yaw, elev: info.elev, distance: detail ? info.detailDistance : info.distance };
  }
  function resetView() {
    view = presetView();
    draw();
  }
  function choose(id, p = preset) {
    if (!['orbit', 'detail'].includes(p)) throw new Error('Unknown camera view');
    if (!landmarks.some((l) => l.id === id)) throw new Error('Unknown landmark');
    pause();
    selected = id;
    preset = p;
    resetView();
  }
  function setLight(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error('Light must be a number');
    pause();
    day = clamp(v);
    draw();
  }
  function zoom(factor) {
    pause();
    view.distance = clamp(view.distance * factor, 15, 120);
    draw();
  }
  function orbit(dx, dy) {
    view.yaw -= dx;
    view.elev = clamp(view.elev + dy, 0.025, 1.05);
    draw();
  }
  function tick(now) {
    if (!playing) return;
    if (last) time += Math.min(0.1, (now - last) / 1000);
    last = now;
    // The live tour loops; the film stops at its last frame.
    if (time >= duration) time = 0;
    seek(time);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    capture = false;
    if (playing) {
      pause();
      return;
    }
    if (time >= duration) time = 0;
    playing = true;
    last = 0;
    updateUI();
    raf = requestAnimationFrame(tick);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────────────────
  if (!webglAvailable()) {
    $('loading').textContent = s.webglMissing;
    $('c-loading').textContent = s.webglMissing;
    if (window.parent !== window) window.parent.postMessage({ type: `${SLUG}:error`, code: 'webgl' }, '*');
    throw new Error('webgl');
  }
  film = createShowcase({ canvas, width: STAGE.width, height: STAGE.height, quality });
  window.__showcase = film;

  for (const box of all('[data-landmarks]')) {
    const long = box.dataset.landmarks === 'long';
    box.innerHTML = landmarks
      .map((l, i) => long
        ? `<button type="button" data-landmark="${l.id}" aria-pressed="false"><span>${pad(i)}</span><b>${t(`${l.id}.name`)}</b>↗</button>`
        : `<button type="button" data-landmark="${l.id}" aria-pressed="false" aria-label="${t(`${l.id}.name`)}" title="${t(`${l.id}.name`)}">${pad(i)}</button>`)
      .join('');
  }
  for (const b of all('[data-landmark]')) b.addEventListener('click', () => choose(b.dataset.landmark));
  for (const b of all('[data-light]')) b.addEventListener('click', () => setLight(b.dataset.light));
  for (const input of all('[data-act="light"]')) input.addEventListener('input', (e) => setLight(e.target.value));
  for (const b of all('[data-act="play"]')) b.addEventListener('click', play);
  for (const b of all('[data-act="reset"]')) b.addEventListener('click', () => { pause(); resetView(); });
  for (const b of all('[data-view]')) b.addEventListener('click', () => choose(selected, b.dataset.view));
  $('c-view').addEventListener('click', () => choose(selected, preset === 'detail' ? 'orbit' : 'detail'));
  for (const b of all('[data-act="zoom-in"]')) b.addEventListener('click', () => zoom(0.88));
  for (const b of all('[data-act="zoom-out"]')) b.addEventListener('click', () => zoom(1 / 0.88));
  const fs = $('fullscreen');
  if (embedded || !document.fullscreenEnabled) fs.hidden = true;
  fs.addEventListener('click', () => {
    const req = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    req?.catch?.(() => {});
  });

  let pointer = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    pause();
    pointer = { x: e.clientX, y: e.clientY, button: e.button };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    // Pixels in the scaled composition map back to composition pixels.
    const scale = layout === 'full' ? 1920 / $('root').getBoundingClientRect().width : 1.6;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (pointer.button === 2) {
      const amount = view.distance * 0.0012 * scale;
      view.center[0] -= Math.cos(view.yaw) * dx * amount;
      view.center[2] += Math.sin(view.yaw) * dx * amount;
      view.center[1] = clamp(view.center[1] + dy * amount, 2, 40);
      draw();
    } else orbit(dx * 0.004 * scale, dy * 0.003 * scale);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => (pointer = null));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });

  addEventListener('resize', fit);
  fit();
  seek(0);
  document.body.classList.add('ready');

  // ── Capture contract ─────────────────────────────────────────────────────────────────────
  // script(t): the film state at t (pure). step(n, dt): advance a playing tour by n fixed steps.
  function script(at) {
    stopLoop();
    playing = false;
    capture = true;
    return seek(at);
  }
  function step(n = 1, dt = 1 / COVER.fps) {
    if (playing) seek(Math.min(duration, time + n * dt));
    else draw();
  }
  const api = {
    slug: SLUG,
    version: VERSION,
    ready: true,
    cover: COVER,
    inspect: () => ({
      quality,
      audio: 'none',
      errors: [...errors],
      facts: {
        selected, preset, day, time, playing, layout,
        yaw: view.yaw, elev: view.elev, distance: view.distance,
        landmarks: landmarks.length, duration, renders,
        triangles: film.renderer.info.render.triangles,
        drawCalls: film.renderer.info.render.calls,
        reducedMotion: reduced,
      },
      camera: { ...view, center: [...view.center] },
    }),
    act(name, arg) {
      if (name === 'visit') choose(arg);
      else if (name === 'view') choose(selected, arg);
      else if (name === 'light') setLight(arg);
      else if (name === 'zoom') zoom(Number(arg) || 1);
      else if (name === 'reset') { pause(); resetView(); }
      else if (name === 'play') { if (!playing) play(); }
      else if (name === 'pause') pause();
      else throw new Error(`Unknown action ${name}`);
      return api.inspect();
    },
    pointer(nx, ny) {
      // Normalized pointer in [-1, 1]: orbit around the preset view.
      const base = presetView();
      view.yaw = base.yaw + clamp(nx, -1, 1) * Math.PI * 0.5;
      view.elev = clamp(base.elev + clamp(ny, -1, 1) * 0.3, 0.025, 1.05);
      draw();
    },
    press: () => pause(),
    release: () => {},
    seek: script,
    ...(params.capture ? { step, script } : {}),
  };
  window.__scene = api;
  if (!params.capture && !reduced) play();
  if (window.parent !== window) window.parent.postMessage({ type: `${SLUG}:ready` }, '*');
}

function webglAvailable() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function markup(t, coarse) {
  const stops = STOPS.map(([k, v]) => `<button type="button" data-light="${v}"><strong>${t(k)}</strong><small>${t(`${k}Note`)}</small></button>`).join('');
  return `
<main id="root" class="full">
 <header><div class="brand"><span class="wordmark">SandBase</span><span class="divider"></span><span>${t('brandTag')}</span></div>
  <nav><button type="button" data-act="play" data-style="long" class="filled">${t('playTour')}</button><button type="button" data-act="reset" aria-label="${t('ariaReset')}">${t('reset')}</button><button type="button" id="fullscreen" aria-label="${t('fullscreen')}" title="${t('fullscreen')}">⛶</button></nav></header>
 <section class="body-grid">
  <aside class="intro"><p class="eyebrow">${t('eyebrow')}</p><h1>${t('headline')}<span>${t('headlineAccent')}</span></h1><p class="intro-text">${t('introText')}</p><div class="short-rule"></div><p class="small-copy">${t('smallCopy')}</p><div class="location"><i></i> ${t('location')}<br><small>${t('locationNote')}</small></div></aside>
  <section class="viewport" id="full-stage" aria-label="${t('sceneAria')}"><canvas id="world" width="1212" height="730" tabindex="-1"></canvas><div class="scene-top"><span id="scene-tag"></span><span id="light-chip"></span></div><div class="scene-bottom"><span id="scene-detail"></span><div class="zoom"><button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button><button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button></div></div><div id="loading">${t('loading')}</div></section>
  <aside class="details"><div class="chapter"><span id="chapter"></span><span class="live"><i></i> ${t('live')}</span></div><div id="number"></div><h2 id="landmark-title"></h2><p id="description"></p><p id="material" class="eyebrow"></p><div class="view-switch" role="group" aria-label="${t('framing')}"><button type="button" data-view="orbit">${t('orbitView')}</button><button type="button" data-view="detail">${t('detailView')}</button></div><div class="landmark-heading">${t('exploreHeading')}</div><div class="landmarks" data-landmarks="long" role="group" aria-label="${t('landmarkGroup')}"></div><p class="note">${t('note')}</p></aside>
 </section>
 <footer><div class="timeline-heading"><div><b>${t('travel')}</b><span>${t('travelHint')}</span></div><div class="transport"><button type="button" data-act="play" class="round"></button><span id="time-label"></span></div></div>
  <div class="slider-wrap"><div class="slider-track"><div id="light-fill"></div></div><input id="light" data-act="light" type="range" min="0" max="1" step="0.001" value="0" aria-label="${t('timeOfDay')}"></div>
  <div class="stops">${stops}</div>
  <div class="bottom-line"><span class="hint">${t('hint')}</span><span>${t('credit')}</span><span>${t('motto')}</span></div></footer>
</main>
<div id="compact" class="compact">
 <div class="c-stage" id="c-stage" aria-label="${t('sceneAria')}">
  <div class="c-top"><span id="c-title"></span><span id="c-light-chip"></span></div>
  <div class="c-info"><span id="c-tag"></span><span class="c-hint hint">${coarse ? t('hintTouch') : t('hint')}</span></div>
  <div class="c-zoom"><button type="button" data-act="zoom-in" aria-label="${t('zoomIn')}">+</button><button type="button" data-act="zoom-out" aria-label="${t('zoomOut')}">−</button></div>
  <div id="c-loading" class="c-loading">${t('loading')}</div>
 </div>
 <div class="c-dock">
  <div class="c-row"><div class="c-marks" data-landmarks="short" role="group" aria-label="${t('landmarkGroup')}"></div><button type="button" id="c-view" class="c-view" data-act="view-toggle">${t('detailView')}</button></div>
  <div class="c-row"><button type="button" data-act="play" class="round"></button><input id="c-light" data-act="light" type="range" min="0" max="1" step="0.001" value="0" aria-label="${t('timeOfDay')}"><span id="c-time" class="c-time"></span><button type="button" data-act="reset" class="c-reset" aria-label="${t('ariaReset')}" title="${t('ariaReset')}">↺</button></div>
 </div>
</div>`;
}
