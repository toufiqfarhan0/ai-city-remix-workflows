// Page shell: bilingual markup for the full editorial layout and the compact dock, evaluated before
// the scene module so every element exists when main.js wires it up. Also stops early, with a
// localized message and the iframe error handshake, when WebGL is unavailable.
import strings from '../i18n/strings.json';
import stories from '../i18n/stories.json';
import { parseParams } from '../lib/params.mjs';
import { SLUG } from '../config';

export const params = parseParams(location.search);
export const L = params.lang;
const S = strings[L];
export const t = (key) => S[key] ?? strings.en[key] ?? key;
export const story = (id) => stories[L][id] ?? stories.en[id];
export const coarse = matchMedia('(pointer: coarse)').matches;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const embedded = window.parent !== window;
/** Embeds, phones and small windows use the compact layout; the film uses the full one. */
export const isCompact = () => params.embed || innerWidth < 700 || innerHeight < 520;

document.documentElement.lang = L;
document.title = t('title');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const e = (key) => esc(t(key));
const stops = [0, 1, 2, 3].map((i) => `<button type="button" data-era="${i}"><b>${[`125 <small>${e('ad')}</small>`, '1300', '1700', '2026'][i]}</b><span>${e(`era${i}`)}</span></button>`).join('');
const marks = [0, 1, 2, 3].map((i) => `<button type="button" data-era="${i}" aria-label="${e(`era${i}`)}" title="${e(`era${i}`)}">${['125', '1300', '1700', '2026'][i]}</button>`).join('');

document.getElementById('app').innerHTML = `
<div id="scene"></div>
<div id="full" class="full">
<header><span class="brand"><span class="brand-mark">S</span> SANDBASE LAB <span class="divider">/</span> ${e('brandSub')}</span><div class="tools"><button type="button" id="play" data-act="play">▶ <span>${e('play')}</span></button><button type="button" id="reset" data-act="reset" title="${e('reset')}">↺ <span>${e('reset')}</span></button><button type="button" id="fullscreen" title="${e('fullscreen')}" aria-label="${e('fullscreen')}">⛶</button></div></header>
<main><section class="intro"><div class="eyebrow">${e('eyebrow')}</div><h1><span>${e('headline1')}</span><br><span>${e('headline2')}</span> <em>${e('headline3')}</em></h1><p>${e('subtitle')}</p><div class="fine-line"></div><div class="intro-note">${e('introNote')}</div></section>
<aside class="story"><div class="card-top"><span id="chapter"></span><span class="live-dot"> ${e('live')}</span></div><div class="era-year" id="year"></div><h2 id="era"></h2><p id="description"></p><ul id="changes"></ul><div class="fact"><span>${e('factLabel')}</span><p id="fact"></p></div></aside>
<div class="scene-label"><span class="label-dot"></span> ${e('coords')} <span class="scale">${e('scale')}</span></div><div class="compass"><b>${e('north')}</b><span>✧</span></div></main>
<footer><div class="timeline-top"><div><span class="eyebrow">${e('travel')}</span><span class="timeline-instruction">${e('travelHint')}</span></div><button type="button" id="toggle" data-act="play" aria-label="${e('ariaToggle')}">▶</button><span id="time-display"></span></div>
<div class="range-wrap"><div class="rail"></div><div class="rail-progress" id="progress"></div><input id="timeline" data-act="year" type="range" min="0" max="3" step="0.001" value="0" aria-label="${e('timelineAria')}"></div>
<div class="stops">${stops}</div>
<div class="bottomline"><span class="hint">↔ ${e('hint')}</span><span>${e('disclaimer')} <button type="button" id="sources">${e('notesButton')}</button></span><span>${e('motto')}</span></div></footer>
</div>
<div id="compact" class="compact">
 <div class="c-top"><span id="c-year"></span><span id="c-era"></span></div>
 <div class="c-dock">
  <div class="c-row c-marks">${marks}</div>
  <div class="c-row"><button type="button" id="c-play" data-act="play" class="round" aria-label="${e('ariaToggle')}">▶</button><input id="c-timeline" data-act="year" type="range" min="0" max="3" step="0.001" value="0" aria-label="${e('timelineAria')}"><button type="button" id="c-reset" data-act="reset" class="c-reset" aria-label="${e('reset')}" title="${e('reset')}">↺</button></div>
  <p class="c-hint hint">${e(coarse ? 'hintTouch' : 'hint')}</p>
 </div>
</div>
<aside id="cinematic-chapter" aria-live="polite"></aside>
<dialog id="notes"><button type="button" id="close-notes" aria-label="${e('close')}">×</button><div class="eyebrow">${e('notesEyebrow')}</div><h2>${e('notesTitle')}</h2><p>${e('notes1')}</p><p>${e('notes2')}</p><p>${e('notes3')}</p><p>${e('notes4')}</p></dialog>
<div id="loading" class="loading">${e('loading')}</div>`;

function webglAvailable() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}
if (!webglAvailable()) {
  document.getElementById('loading').textContent = S.webglMissing;
  if (window.parent !== window) window.parent.postMessage({ type: `${SLUG}:error`, code: 'webgl' }, '*');
  throw new Error('webgl');
}
