// Interactive Rome diorama and its film adapter over one historical engine.
// The year drives every entity state; the camera and year of the film are pure functions of film time.
import { params, L, t, story, coarse, reduced, embedded, isCompact } from './shell.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cinematicFrame, chapterAt, CHAPTERS, FILM_DURATION } from './cinematic-director.js';
import { createHistoricalSystem } from './scene-system.js';
import { playbackYear, sliderToYear, yearToSlider, MILESTONES, clampYear } from './historical-events.js';
import { SLUG, VERSION } from '../config';

const $ = (s) => document.querySelector(s);
const all = (s) => [...document.querySelectorAll(s)];
const errors = [];
addEventListener('error', (e) => errors.push(String(e.message)));
addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
const COVER = { fps: 30, frames: FILM_DURATION * 30, posterAt: 24 };
const HOME = { position: [29, 27, 36], target: [0, 0, 0] };
const quality = params.quality ?? (coarse ? 'low' : 'high');
const low = quality === 'low';

// ── Scene ──────────────────────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eeeadd');
scene.fog = new THREE.Fog('#eeeadd', 65, 140);
const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, preserveDrawingBuffer: true });
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#scene').appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 180);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 20;
controls.maxDistance = 64;
controls.maxPolarAngle = Math.PI * 0.4;
controls.minPolarAngle = 0.2;
camera.position.fromArray(HOME.position);
controls.target.fromArray(HOME.target);
controls.update();
scene.add(new THREE.HemisphereLight('#fff4db', '#8b9872', 1.8));
const sun = new THREE.DirectionalLight('#fff1d5', 2.8);
sun.position.set(-18, 35, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 90 });
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00015;
scene.add(sun);
const fill = new THREE.DirectionalLight('#e8f0e9', 1.3);
fill.position.set(20, 14, -20);
scene.add(fill);
const historical = createHistoricalSystem(scene);

// ── State ──────────────────────────────────────────────────────────────────────────────────────
let currentYear = 125, targetYear = 125, isPlaying = false, playElapsed = 0, paused = false, ended = false;
let focus = null, offline = null, prev = performance.now(), renders = 0, layout = 'full';

function setPlayLabels() {
  const label = isPlaying || offline !== null ? t('pause') : ended ? t('replay') : t('play');
  const glyph = isPlaying || offline !== null ? 'Ⅱ' : ended ? '↺' : '▶';
  $('#play').innerHTML = `${glyph} <span>${label}</span>`;
  $('#toggle').textContent = glyph;
  $('#c-play').textContent = glyph;
  for (const b of all('[data-act="play"]')) if (b.id !== 'play') b.setAttribute('aria-label', label);
}
function stop() {
  document.body.classList.remove('cinematic');
  if (isPlaying) paused = true;
  isPlaying = false;
  setPlayLabels();
}
function play() {
  document.body.classList.remove('exploring');
  if (isPlaying) {
    stop();
    return;
  }
  if (!paused || currentYear >= 2026) {
    currentYear = targetYear = 125;
    playElapsed = 0;
  }
  paused = false;
  ended = false;
  isPlaying = true;
  focus = null;
  setPlayLabels();
}
function setYear(year, instant = false) {
  stop();
  paused = false;
  ended = false;
  targetYear = clampYear(Number(year));
  if (instant) currentYear = targetYear;
}
function homeView() {
  // Phones and the compact layout pull back so the whole relief base fits.
  if (layout !== 'compact') return { position: new THREE.Vector3(...HOME.position), target: new THREE.Vector3(...HOME.target) };
  // Fit the relief base by width: pull back on portrait frames, come closer on landscape ones.
  const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const k = THREE.MathUtils.clamp(21 / Math.tan(halfH), 30, 92) / new THREE.Vector3(...HOME.position).length();
  return { position: new THREE.Vector3(...HOME.position).multiplyScalar(k), target: new THREE.Vector3(0, 0, 0.5) };
}
function reset(instant = false) {
  document.body.classList.remove('exploring');
  stop();
  const home = homeView();
  if (instant) {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    focus = null;
  } else focus = home;
}
function zoom(factor) {
  stop();
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  focus = null;
}
function directCamera(seconds) {
  const pose = cinematicFrame(seconds);
  camera.position.fromArray(pose.position);
  controls.target.fromArray(pose.target);
  const i = CHAPTERS.indexOf(chapterAt(seconds));
  $('#cinematic-chapter').innerHTML = `<strong>${t(`chapter${i}`)}</strong><span>${t(`chapter${i}Line`)}</span>`;
}

// ── Controls ───────────────────────────────────────────────────────────────────────────────────
for (const b of all('[data-act="play"]')) b.addEventListener('click', play);
for (const b of all('[data-act="reset"]')) b.addEventListener('click', () => reset());
for (const input of all('[data-act="year"]')) input.addEventListener('input', (e) => setYear(sliderToYear(Number(e.target.value)), true));
for (const b of all('[data-era]')) b.addEventListener('click', () => setYear(MILESTONES[+b.dataset.era]));
controls.addEventListener('start', () => {
  document.body.classList.add('exploring');
  stop();
  focus = null;
});
const fs = $('#fullscreen');
if (embedded || !document.fullscreenEnabled) fs.hidden = true;
fs.addEventListener('click', () => {
  const req = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
  req?.catch?.(() => {});
});
$('#sources').addEventListener('click', () => $('#notes').showModal());
$('#close-notes').addEventListener('click', () => $('#notes').close());

function resize() {
  const next = isCompact() ? 'compact' : 'full';
  const changed = next !== layout;
  layout = next;
  document.body.dataset.layout = layout;
  const w = innerWidth;
  const h = Math.max(120, innerHeight - (layout === 'compact' ? $('.c-dock').offsetHeight : 135));
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : 1.8));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = layout === 'compact' ? 40 : 36;
  controls.maxDistance = layout === 'compact' ? 100 : 64;
  camera.updateProjectionMatrix();
  if (changed && offline === null) reset(true);
}
addEventListener('resize', resize);

// ── State → UI and pixels ─────────────────────────────────────────────────────────────────────
function storyId(year) {
  if (year >= 350 && year < 900) return 'late-antique';
  if (year >= 900 && year < 1300) return 'medieval-settlement';
  if (year >= 1450 && year < 1700) return 'renaissance';
  if (year >= 1850 && year < 2026) return year < 1950 ? 'archaeology' : 'living-capital';
  return ['imperial', 'medieval', 'baroque', 'modern'][eraIndex(year)];
}
const eraIndex = (year) => (year < 1300 ? 0 : year < 1700 ? 1 : year < 2026 ? 2 : 3);
const yearText = (year, html) => {
  const y = Math.round(year);
  if (y >= 1000) return String(y);
  return L === 'zh-CN' ? `${t('ad')} ${y}` : html ? `${y} <small>${t('ad')}</small>` : `${y} ${t('ad')}`;
};
function updateUI() {
  const i = eraIndex(currentYear);
  const e = story(storyId(currentYear));
  $('#chapter').textContent = `${t('chapter')} 0${i + 1}`;
  $('#year').innerHTML = yearText(currentYear, true);
  $('#era').textContent = e.name;
  $('#description').textContent = e.desc;
  $('#fact').textContent = e.fact;
  $('#changes').innerHTML = e.changes.map((s) => `<li>${s}</li>`).join('');
  $('#time-display').textContent = yearText(currentYear);
  $('#c-year').textContent = yearText(currentYear);
  $('#c-era').textContent = e.name;
  const s = yearToSlider(currentYear);
  for (const input of all('[data-act="year"]')) input.value = String(s);
  $('#progress').style.width = `${(s / 3) * 100}%`;
  $('#c-timeline').style.setProperty('--v', String(s / 3));
  for (const b of all('[data-era]')) {
    const active = +b.dataset.era === i;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  }
}
function render() {
  historical.updateCityAtYear(currentYear);
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -13, 13);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -10, 10);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 4);
  controls.enableDamping = !isPlaying && offline === null;
  controls.update();
  updateUI();
  renderer.render(scene, camera);
  renders++;
}
function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.max(0, (now - prev) / 1000), dt = Math.min(elapsed, 0.05);
  prev = now;
  if (offline !== null) return;
  if (isPlaying) {
    playElapsed += Math.min(elapsed, 0.1);
    currentYear = targetYear = playbackYear(playElapsed);
    directCamera(playElapsed);
    if (playElapsed >= FILM_DURATION) {
      stop();
      paused = false;
      ended = true;
      setPlayLabels();
    }
  } else currentYear = THREE.MathUtils.damp(currentYear, targetYear, 4, dt);
  if (Math.abs(currentYear - targetYear) < 0.01) currentYear = targetYear;
  if (focus) {
    controls.target.lerp(focus.target, 0.12);
    camera.position.lerp(focus.position, 0.12);
    if (camera.position.distanceTo(focus.position) < 0.02) focus = null;
  }
  render();
}

// ── Capture contract ───────────────────────────────────────────────────────────────────────────
// script(t): the film frame at t, rendered synchronously (year and camera from film time only).
function script(at) {
  const sec = Math.max(0, Math.min(FILM_DURATION, Number(at) || 0));
  offline = sec;
  isPlaying = false;
  focus = null;
  document.body.classList.remove('exploring');
  playElapsed = sec;
  currentYear = targetYear = playbackYear(sec);
  directCamera(sec);
  setPlayLabels();
  render();
  return { year: currentYear, chapter: CHAPTERS.indexOf(chapterAt(sec)) };
}
function step(n = 1, dt = 1 / COVER.fps) {
  if (offline !== null) script(offline + n * dt);
  else render();
}
const api = {
  slug: SLUG,
  version: VERSION,
  ready: false,
  cover: COVER,
  inspect: () => ({
    quality,
    audio: 'none',
    errors: [...errors],
    facts: {
      year: Math.round(currentYear * 100) / 100,
      era: eraIndex(currentYear),
      playing: isPlaying,
      layout,
      distance: Math.round(controls.getDistance() * 1000) / 1000,
      azimuth: Math.round(controls.getAzimuthalAngle() * 1000) / 1000,
      duration: FILM_DURATION,
      landmarks: 3,
      entities: historical.registry?.entities?.size ?? 0,
      triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      renders,
      reducedMotion: reduced,
    },
  }),
  act(name, arg) {
    if (name === 'year') setYear(arg, true);
    else if (name === 'era') setYear(MILESTONES[Math.max(0, Math.min(3, Number(arg) | 0))], true);
    else if (name === 'play') { if (!isPlaying) play(); }
    else if (name === 'pause') stop();
    else if (name === 'reset') reset(true);
    else if (name === 'zoom') zoom(Number(arg) || 1);
    else throw new Error(`Unknown action ${name}`);
    render();
    return api.inspect();
  },
  pointer(nx, ny) {
    stop();
    const home = homeView();
    const offset = home.position.clone().sub(home.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += Math.max(-1, Math.min(1, nx)) * Math.PI * 0.5;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + Math.max(-1, Math.min(1, ny)) * 0.3, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(home.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.target.copy(home.target);
    render();
  },
  press: () => stop(),
  release: () => {},
  seek: script,
  ...(params.capture ? { script, step } : {}),
};
window.__scene = api;

resize();
reset(true);
render();
requestAnimationFrame(frame);
document.fonts.ready.then(() => {
  document.body.classList.add('ready');
  api.ready = true;
  if (window.parent !== window) window.parent.postMessage({ type: `${SLUG}:ready` }, '*');
});
addEventListener('pagehide', (e) => {
  if (!e.persisted) {
    controls.dispose();
    historical.dispose();
    renderer.dispose();
  }
});
