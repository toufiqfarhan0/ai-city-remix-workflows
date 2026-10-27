// Page shell: two layouts around one Three.js world, bilingual controls, the score and the capture
// contract.
//
// - Full layout: the 1920×1080 editorial composition scaled into the window (desktop and the film).
// - Compact layout: the scene fills the frame with a small control dock (embeds, phones, small windows).
//
// Two modes drive the same world. Film mode: tour time t sets camera, light and motion (renderAt).
// Free mode: the visitor's camera, light value and life clock (renderView). Seeking or playing enters
// film mode; orbiting, zooming or changing the light continues from the current frame in free mode.
// The film state is a pure function of time: script(t) never depends on earlier frames.
import * as THREE from 'three';
import { createWorld, filmLightAt, viewFrom } from './world.js';
import { chapterLength, chapters, chapterViews, duration, island, lightStops } from './config.js';
import { createScore } from './score.js';
import strings from '../i18n/strings.json';
import { parseParams } from '../lib/params.mjs';

const COVER = { fps: 30, frames: duration * 30, posterAt: 1 };
const STAGE = { width: 1190, height: 790 };
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (i) => String(i + 1).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lines = (s) => esc(s).replace(/\n/g, '<br>');

export async function start({ SLUG, VERSION }) {
  const params = parseParams(location.search);
  const L = params.lang;
  const s = strings[L];
  const t = (key) => s[key] ?? strings.en[key] ?? key;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = params.quality ?? (coarse ? 'low' : 'high');
  const embedded = window.parent !== window;
  const errors = [];
  addEventListener('error', (e) => errors.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  document.documentElement.lang = L;
  document.title = s.title;
  if (params.capture) document.body.classList.add('capture');

  const app = document.getElementById('app');
  app.innerHTML = markup(t, coarse);
  const $ = (id) => document.getElementById(id);
  const all = (sel) => [...document.querySelectorAll(sel)];
  const canvas = $('world');

  if (!webglAvailable()) {
    for (const id of ['loading', 'c-loading']) $(id).textContent = s.webglMissing;
    if (embedded) window.parent.postMessage({ type: `${SLUG}:error`, code: 'webgl' }, '*');
    throw new Error('webgl');
  }
  const world = createWorld({ canvas, width: STAGE.width, height: STAGE.height, quality });
  const score = createScore();
  const views = chapterViews(world.views);

  // ── State ────────────────────────────────────────────────────────────────────────────────
  let mode = 'film', time = 0, playing = false, capture = false;
  let view = world.filmView(0), light = filmLightAt(0), life = 0, lifeRunning = !reduced;
  let layout = 'full', renders = 0, raf = 0, last = 0, cardOpen = false;

  const chapterAt = (at) => Math.min(chapters.length - 1, Math.floor(at / chapterLength));
  const chapterIndex = () => (mode === 'film' ? chapterAt(time) : nearestChapter());
  function nearestChapter() {
    // In free mode the card follows the chapter whose framing target is closest to the view target.
    let best = 0, bestD = Infinity;
    chapters.forEach((id, i) => {
      const v = views[id];
      const d = Math.hypot(...v.target.map((x, k) => x - view.target[k])) + Math.abs(viewFrom(v.position, v.target).distance - view.distance) * 0.2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  const lightIndex = () => {
    let best = 0;
    lightStops.forEach(([, v], i) => { if (Math.abs(v - light) < Math.abs(lightStops[best][1] - light)) best = i; });
    return best;
  };

  // ── Layout ───────────────────────────────────────────────────────────────────────────────
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
      world.resize(STAGE.width * k, STAGE.height * k);
    } else {
      if (canvas.parentElement !== $('c-stage')) $('c-stage').prepend(canvas);
      const r = $('c-stage').getBoundingClientRect();
      world.resize(r.width * dpr, r.height * dpr);
    }
    draw();
  }

  // ── Rendering and UI ─────────────────────────────────────────────────────────────────────
  function draw() {
    if (mode === 'film') {
      const st = world.renderAt(time);
      view = st.view;
      light = st.light;
    } else world.renderView(view, light, life);
    renders++;
    updateUI();
  }
  function updateUI() {
    const ci = chapterIndex();
    const id = chapters[ci];
    $('chapter-number').textContent = pad(ci);
    $('chapter-title').textContent = t(`${id}.title`);
    $('chapter-text').textContent = t(`${id}.text`);
    $('chapter-fraction').textContent = `${pad(ci)} / 04`;
    $('c-title').textContent = `${pad(ci)} · ${t(`${id}.title`)}`;
    for (const b of all('[data-chapter]')) {
      const on = Number(b.dataset.chapter) === ci;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const li = lightIndex();
    const label = t(lightStops[li][0]);
    $('c-light-chip').textContent = label;
    for (const b of all('[data-light]')) {
      const on = Number(b.dataset.index) === li;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const input of all('[data-act="light"]')) {
      input.value = String(light);
      input.setAttribute('aria-valuetext', label);
      input.style.setProperty('--v', String(light));
    }
    // The journey bar is the tour timeline; its stops are the film's four chapters.
    const u = time / duration;
    $('journey-fill').style.width = `${u * 100}%`;
    $('journey-cursor').style.left = `${u * 100}%`;
    $('journey-time').textContent = `00:${String(Math.min(duration, Math.floor(time))).padStart(2, '0')} / 00:${duration}`;
    const scrub = $('scrub');
    scrub.value = String(time);
    for (const el of all('[data-stop]')) el.classList.toggle('active', Number(el.dataset.stop) === chapterAt(time));
    // The viewfinder frames close views: the film's detail chapters, or a close free camera.
    const vf = mode === 'film' ? smooth(2.5, 3.5, time) * (1 - smooth(23, 23.6, time)) : view.distance < 52 ? 1 : 0;
    $('viewfinder').style.opacity = String(vf);
    document.body.dataset.night = String(light > 0.8);
    const run = playing || capture;
    for (const b of all('[data-act="play"]')) {
      b.setAttribute('aria-label', run ? t('ariaPause') : t('ariaPlay'));
      b.setAttribute('aria-pressed', String(run));
      b.textContent = b.dataset.style === 'long' ? (run ? t('pauseTour') : t('playTour')) : run ? 'Ⅱ' : '▶';
    }
    for (const b of all('[data-act="lanterns"]')) {
      b.setAttribute('aria-pressed', String(world.lanterns));
      b.textContent = b.dataset.style === 'long' ? (world.lanterns ? t('lanternsOn') : t('lanternsOff')) : '✦';
      b.setAttribute('aria-label', world.lanterns ? t('lanternsOn') : t('lanternsOff'));
      b.classList.toggle('off', !world.lanterns);
    }
    for (const b of all('[data-act="life"]')) {
      b.setAttribute('aria-pressed', String(!lifeRunning));
      b.textContent = lifeRunning ? t('lifePause') : t('lifeResume');
    }
    for (const b of all('[data-act="sound"]')) {
      const on = !score.muted;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? t('ariaMute') : t('ariaUnmute'));
      b.textContent = b.dataset.style === 'long' ? (on ? t('soundOn') : t('soundOff')) : '♪';
      b.classList.toggle('off', !on);
    }
  }

  // ── Clock ────────────────────────────────────────────────────────────────────────────────
  function loopNeeded() {
    return !capture && (playing || (mode === 'free' && lifeRunning));
  }
  function ensureLoop() {
    if (!raf && loopNeeded()) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (playing) {
      time += dt;
      // The live tour loops; the film stops at its last frame.
      if (time >= duration) {
        time = 0;
        score.follow(0);
      }
    } else if (mode === 'free' && lifeRunning) life += dt;
    draw();
    if (loopNeeded()) raf = requestAnimationFrame(tick);
  }
  function stopTour() {
    playing = false;
    score.follow(null);
  }
  function seek(at) {
    stopTour();
    mode = 'film';
    time = clamp(at, 0, duration);
    draw();
  }
  /** Leave film mode at the current frame so the visitor can take over camera or light. */
  function toFree() {
    if (playing) stopTour();
    if (mode === 'film') {
      view = world.filmView(time);
      light = filmLightAt(time);
      life = time;
      mode = 'free';
    }
    ensureLoop();
  }
  // gesture: false for the autoplay at load, which must not create an AudioContext.
  function play(gesture = true) {
    capture = false;
    if (gesture) score.init();
    if (playing) {
      stopTour();
      updateUI();
      return;
    }
    if (mode === 'free' || time >= duration) time = 0;
    mode = 'film';
    playing = true;
    score.follow(time);
    draw();
    ensureLoop();
  }
  function chooseChapter(i) {
    if (!Number.isInteger(i) || i < 0 || i >= chapters.length) throw new Error('Unknown chapter');
    const v = views[chapters[i]];
    stopTour();
    mode = 'free';
    view = viewFrom(v.position, v.target);
    light = filmLightAt(v.at);
    life = v.at;
    draw();
    ensureLoop();
  }
  function setLight(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error('Light must be a number');
    toFree();
    light = clamp(v);
    draw();
  }
  function zoom(factor) {
    toFree();
    view.distance = clamp(view.distance * factor, 14, 240);
    draw();
  }
  function orbit(dx, dy) {
    toFree();
    view.yaw -= dx;
    view.elev = clamp(view.elev + dy, 0.08, 1.42);
    draw();
  }
  function reset() {
    seek(0);
  }
  function toggleLanterns(on = !world.lanterns) {
    world.setLanterns(on);
    draw();
  }
  function toggleLife(on = !lifeRunning) {
    lifeRunning = !!on;
    if (lifeRunning) toFree();
    updateUI();
  }
  function toggleSound(on = score.muted) {
    score.init();
    score.setMuted(!on);
    if (playing) score.follow(time);
    updateUI();
  }
  function openCard() {
    cardOpen = true;
    $('card-wrap').classList.add('open');
    $('card-wrap').setAttribute('aria-hidden', 'false');
    $('close-card').focus();
  }
  function closeCard() {
    cardOpen = false;
    $('card-wrap').classList.remove('open');
    $('card-wrap').setAttribute('aria-hidden', 'true');
  }

  // ── Wiring ───────────────────────────────────────────────────────────────────────────────
  for (const b of all('[data-chapter]')) b.addEventListener('click', () => chooseChapter(Number(b.dataset.chapter)));
  for (const b of all('[data-light]')) b.addEventListener('click', () => setLight(b.dataset.light));
  for (const input of all('[data-act="light"]')) input.addEventListener('input', (e) => setLight(e.target.value));
  $('scrub').addEventListener('input', (e) => seek(Number(e.target.value)));
  for (const b of all('[data-stop]')) b.addEventListener('click', () => seek(Number(b.dataset.stop) * chapterLength + 0.5));
  for (const b of all('[data-act="play"]')) b.addEventListener('click', () => play());
  for (const b of all('[data-act="reset"]')) b.addEventListener('click', reset);
  for (const b of all('[data-act="lanterns"]')) b.addEventListener('click', () => toggleLanterns());
  for (const b of all('[data-act="life"]')) b.addEventListener('click', () => toggleLife());
  for (const b of all('[data-act="sound"]')) b.addEventListener('click', () => toggleSound());
  for (const b of all('[data-act="zoom-in"]')) b.addEventListener('click', () => zoom(0.86));
  for (const b of all('[data-act="zoom-out"]')) b.addEventListener('click', () => zoom(1 / 0.86));
  $('close-card').addEventListener('click', closeCard);
  $('card-wrap').addEventListener('click', (e) => { if (e.target === $('card-wrap')) closeCard(); });
  const fs = $('fullscreen');
  if (embedded || !document.fullscreenEnabled) fs.hidden = true;
  fs.addEventListener('click', () => {
    const req = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    req?.catch?.(() => {});
  });
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCard(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCard();
    if (e.key === 'Tab' && cardOpen) { e.preventDefault(); $('close-card').focus(); }
  });

  // Drag orbits; a press that does not move opens the landmark card when it hits the landmark.
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pointer = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    pointer = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!pointer.moved && Math.hypot(e.clientX - pointer.x0, e.clientY - pointer.y0) < 5) return;
    pointer.moved = true;
    // Pixels in the scaled composition map back to composition pixels.
    const scale = layout === 'full' ? 1920 / $('root').getBoundingClientRect().width : 1.6;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    orbit(dx * 0.004 * scale, dy * 0.003 * scale);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = pointer;
    pointer = null;
    if (!p || p.moved) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    raycaster.setFromCamera(ndc, world.camera);
    if (raycaster.intersectObject(world.hitTarget, true).length) openCard();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => (pointer = null));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });

  addEventListener('resize', fit);
  fit();
  // Fonts are inlined; wait for them so the first frame and the film never show fallback faces.
  await Promise.all(['500 16px StoneDisplay', 'italic 500 16px StoneDisplay', '400 16px StoneSans'].map((f) => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
  updateUI();
  document.body.classList.add('ready');

  // ── Capture contract ─────────────────────────────────────────────────────────────────────
  // script(t): the film state at t (pure). step(n, dt): advance a playing tour by n fixed steps.
  function script(at) {
    cancelAnimationFrame(raf);
    raf = 0;
    stopTour();
    capture = true;
    mode = 'film';
    time = clamp(at, 0, duration);
    draw();
    return { t: time, chapter: chapters[chapterAt(time)], light, view: { ...view, target: [...view.target] } };
  }
  function step(n = 1, dt = 1 / COVER.fps) {
    if (playing) time = Math.min(duration, time + n * dt);
    else if (mode === 'free' && lifeRunning) life += n * dt;
    draw();
  }
  const api = {
    slug: SLUG,
    version: VERSION,
    ready: true,
    cover: COVER,
    inspect: () => ({
      quality,
      audio: score.state,
      errors: [...errors, ...score.errors],
      facts: {
        mode, time, playing, layout,
        chapter: chapters[chapterIndex()],
        light, lanterns: world.lanterns, life, lifeRunning, muted: score.muted, card: cardOpen,
        yaw: view.yaw, elev: view.elev, distance: view.distance,
        chapters: chapters.length, duration, renders,
        spires: world.stats.spires, houses: world.stats.houses, cars: world.stats.cars, people: world.stats.people,
        triangles: world.renderer.info.render.triangles,
        drawCalls: world.renderer.info.render.calls,
        reducedMotion: reduced,
      },
      camera: { ...view, target: [...view.target] },
    }),
    act(name, arg) {
      if (name === 'chapter') chooseChapter(Number(arg));
      else if (name === 'light') setLight(arg);
      else if (name === 'seek') seek(Number(arg));
      else if (name === 'zoom') zoom(Number(arg) || 1);
      else if (name === 'lanterns') toggleLanterns(arg === undefined ? undefined : !!arg);
      else if (name === 'life') toggleLife(arg === undefined ? undefined : !!arg);
      else if (name === 'sound') toggleSound(arg === undefined ? undefined : !!arg);
      else if (name === 'card') (arg === false ? closeCard : openCard)();
      else if (name === 'reset') reset();
      else if (name === 'play') { if (!playing) play(); }
      else if (name === 'pause') { stopTour(); updateUI(); }
      else throw new Error(`Unknown action ${name}`);
      return api.inspect();
    },
    pointer(nx, ny) {
      // Normalized pointer in [-1, 1]: orbit around the island's opening view.
      const base = viewFrom(island.open, island.target);
      toFree();
      view = { ...base, yaw: base.yaw + clamp(nx, -1, 1) * Math.PI * 0.5, elev: clamp(base.elev + clamp(ny, -1, 1) * 0.3, 0.08, 1.42) };
      draw();
    },
    press: () => { stopTour(); updateUI(); },
    release: () => {},
    seek: script,
    ...(params.capture ? { step, script } : {}),
  };
  window.__scene = api;
  if (!params.capture && !reduced) play(false);
  else if (!params.capture) ensureLoop();
  if (embedded) window.parent.postMessage({ type: `${SLUG}:ready` }, '*');
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
  const chapterNav = chapters.map((id, i) => `<button type="button" data-chapter="${i}" aria-pressed="false"><span class="nav-num">${pad(i)}</span><span class="nav-title">${esc(t(`${id}.title`))}</span><span class="nav-indicator"></span></button>`).join('');
  const lightNav = lightStops.map(([id, v], i) => `<button type="button" data-light="${v}" data-index="${i}" aria-pressed="false">${esc(t(id))}</button>`).join('');
  // The four tour stops name the light of each chapter.
  const stops = ['golden', 'jewel', 'blue', 'stars'].map((id, i) => `<button type="button" class="journey-stop" data-stop="${i}"><strong>${esc(t(id))}</strong><span>${esc(t(`${id}Note`))}</span></button>`).join('');
  const chips = t('cardChips').split('|').map((c) => `<span>${esc(c)}</span>`).join('');
  const compactChapters = chapters.map((id, i) => `<button type="button" data-chapter="${i}" aria-pressed="false" aria-label="${esc(t(`${id}.title`))}" title="${esc(t(`${id}.title`))}">${pad(i)}</button>`).join('');
  return `
<main id="root" class="full">
 <header class="masthead"><div class="wordmark"><span class="brand-seal">S</span>${esc(t('wordmark'))}<span class="wordmark-tag">${esc(t('wordmarkTag'))}</span></div>
  <div class="mast-meta"><span><i class="small-dot"></i>${esc(t('collection'))}</span><span>${esc(t('volume'))}</span></div>
  <nav class="mast-controls"><button type="button" data-act="play" data-style="long" class="filled"></button><button type="button" data-act="reset" aria-label="${esc(t('ariaReset'))}">${esc(t('reset'))}</button><button type="button" data-act="lanterns" data-style="long"></button><button type="button" data-act="life"></button><button type="button" data-act="sound" data-style="long"></button><button type="button" id="fullscreen" aria-label="${esc(t('fullscreen'))}" title="${esc(t('fullscreen'))}">⛶</button></nav></header>
 <section class="intro"><div class="eyebrow">${lines(t('eyebrow'))}</div><h1>${esc(t('headline'))}<em>${esc(t('headlineAccent'))}</em></h1><p class="dek">${esc(t('dek'))}</p><div class="intro-rule"></div><p class="note">${lines(t('notes'))}</p><div class="edition">${esc(t('edition'))}</div><p class="hint">${esc(coarse ? t('hintTouch') : t('hint'))}</p></section>
 <section class="stage" id="full-stage" aria-label="${esc(t('sceneAria'))}"><canvas id="world" width="1190" height="790" tabindex="0" aria-label="${esc(t('sceneAria'))}"></canvas><div id="viewfinder"><span class="viewfinder-label">${esc(t('viewfinder'))}</span></div><div class="zoom"><button type="button" data-act="zoom-in" aria-label="${esc(t('zoomIn'))}">+</button><button type="button" data-act="zoom-out" aria-label="${esc(t('zoomOut'))}">−</button></div><div id="loading">${esc(t('loading'))}</div></section>
 <aside class="chapter-card"><div class="card-kicker"><span>${esc(t('fieldNotes'))}</span><span><i class="live-dot"></i>${esc(t('live'))}</span></div><div class="chapter-number" id="chapter-number">01</div><h2 id="chapter-title"></h2><p class="chapter-copy" id="chapter-text"></p><div class="card-rule"></div><div class="nav-label">${esc(t('exploreHeading'))}</div><div class="chapter-nav" role="group" aria-label="${esc(t('chapterGroup'))}">${chapterNav}</div><div class="light-nav" role="group" aria-label="${esc(t('timeOfDay'))}">${lightNav}</div><input id="light" class="light-range" data-act="light" type="range" min="0" max="1" step="0.001" value="0" aria-label="${esc(t('timeOfDay'))}"><div class="card-footer"><span>${esc(t('livingMiniature'))}</span><span id="chapter-fraction">01 / 04</span></div></aside>
 <div class="scene-caption">${esc(t('sceneCaption'))}</div>
 <div class="compass" aria-hidden="true">N<svg viewBox="0 0 26 31"><path d="M13 0 25 30 13 23 1 30Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M13 0 13 23 1 30Z" fill="currentColor"/></svg></div>
 <section class="journey"><div class="journey-heading"><span>${esc(t('journeyHeading'))}</span><span class="journey-time" id="journey-time">00:00 / 00:24</span></div><div class="track"><div class="track-fill" id="journey-fill"></div><div class="track-cursor" id="journey-cursor"></div><input id="scrub" type="range" min="0" max="${duration}" step="0.01" value="0" aria-label="${esc(t('journeyHeading'))}"></div><div class="journey-stops">${stops}</div></section>
 <footer class="film-footer"><span>${esc(t('footerLeft'))}</span><span>${esc(t('footerRight'))}</span></footer>
</main>
<div id="compact" class="compact">
 <div class="c-stage" id="c-stage" aria-label="${esc(t('sceneAria'))}">
  <div class="c-top"><span id="c-title"></span><span id="c-light-chip"></span></div>
  <div class="c-zoom"><button type="button" data-act="zoom-in" aria-label="${esc(t('zoomIn'))}">+</button><button type="button" data-act="zoom-out" aria-label="${esc(t('zoomOut'))}">−</button></div>
  <div class="c-info"><span class="hint">${esc(coarse ? t('hintTouch') : t('hint'))}</span></div>
  <div id="c-loading" class="c-loading">${esc(t('loading'))}</div>
 </div>
 <div class="c-dock">
  <div class="c-row"><div class="c-marks" role="group" aria-label="${esc(t('chapterGroup'))}">${compactChapters}</div><button type="button" data-act="play" class="round"></button><button type="button" data-act="reset" class="c-icon" aria-label="${esc(t('ariaReset'))}" title="${esc(t('ariaReset'))}">↺</button></div>
  <div class="c-row"><input id="c-light" data-act="light" type="range" min="0" max="1" step="0.001" value="0" aria-label="${esc(t('timeOfDay'))}"><button type="button" data-act="lanterns" class="c-icon"></button><button type="button" data-act="sound" class="c-icon"></button></div>
 </div>
</div>
<div class="card-wrap" id="card-wrap" aria-hidden="true"><section class="tower-card" role="dialog" aria-modal="true" aria-labelledby="card-title"><button type="button" class="close" id="close-card" aria-label="${esc(t('closeCard'))}">×</button><small>${esc(t('cardKicker'))}</small><h2 id="card-title">${esc(t('cardTitle'))}</h2><p>${esc(t('cardText'))}</p><div class="chips">${chips}</div></section></div>`;
}
