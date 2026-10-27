// HyperFrames composition writer. Pure: timeline.json + scene code + style pack -> index.html and the
// list of assets to copy into work/scenes/project/assets/.
//
// The page is one canvas (scenes, drawn by the Agent's code through the style kit) plus DOM overlays
// (captions, cards, title, AIGC badge, end card). engine/render/runtime.js draws a frame on every
// HyperFrames `hf-seek`; a paused GSAP timeline only fixes the duration. A window { from, to } renders a
// review segment with the same timeline (scene times stay absolute).
//
// No-network guard: a Content-Security-Policy with connect-src 'none' and no remote origins, and every
// scene file is evaluated inside a function whose parameters shadow the network, clock, storage and
// randomness globals (fetch, XMLHttpRequest, WebSocket, Date, performance, Math.random, …). The static
// scan (render/scan.mjs) rejects such code before it gets here.
import { localized } from '../story/script-schema.mjs'
export const COMPOSITION_ID = 'chronicle'
export const HYPERFRAMES_JSON = Object.freeze({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: false } })
export const CANVAS = Object.freeze({ '16:9': Object.freeze({ width: 1920, height: 1080 }), '9:16': Object.freeze({ width: 1080, height: 1920 }) })
export const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'none'; media-src 'self'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
/** Globals shadowed inside every scene file (undefined, or a safe replacement for Math). */
export const SHADOWED = Object.freeze(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'importScripts', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Image', 'Audio', 'open', 'location'])
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const px = (x) => `${(Math.round(Number(x) * 100) / 100).toFixed(2)}px`
/** Canvas size of an aspect (draft quality only lowers the encoder quality; scenes always draw at output size). */
export const canvasFor = (aspect) => ({ ...CANVAS[aspect], fps: 30 })
/** Script text safe inside an inline <script> element. */
const inlineScript = (code) => String(code).replace(/<\/(script)/gi, '<\\/$1')
/** Wraps one scene file so it can register scenes but cannot reach the network, clock or storage. */
export function wrapScene(name, code) {
  const safeMath = "Object.freeze(Object.assign(Object.create(Math),{random:function(){throw new Error('Math.random is not allowed: use s.kit.rng(seed)')}}))"
  return `/* scene ${name} */\n;(function(scene,Math,${SHADOWED.join(',')}){'use strict';\n${code}\n})(function(n,f){if(typeof f!=='function')throw new Error('scene '+n+': draw must be a function');window.CI_SCENES[n]=f},${safeMath});\n`
}
/**
 * @param {{ timeline: object, scenes: { name: string, code: string }[], stylePack: object, styleCss: string,
 *           kitCode: string, runtimeCode: string, window?: { from: number, to: number }, episode?: number, sealText?: string,
 *           geo?: object }} input  geo = geo/basemap.json (scripts/geo.mjs, OpenStreetMap): exposed to scenes as s.geo,
 *   and its attribution is drawn on every frame.
 *   Kit, scene files and runtime are inlined into one script element in that order (HyperFrames may
 *   reorder separate script elements; one element keeps registration before the first seek).
 * @returns {{ html: string, hyperframes: object, assets: { from: string, to: string }[], canvas: object, duration: number }}
 */
/** AIGC end-card line when the music comes from a music/track.json file (pictures only). */
export const TRACK_AIGC_LABEL = Object.freeze({ en: 'AI-generated: drawn by code written by an AI agent. Illustrative only.', 'zh-CN': 'AI 生成：画面由 AI 编写的代码绘制，仅作示意' })
export function buildComposition({ timeline, scenes, stylePack, styleCss = '', kitCode = '', runtimeCode = '', window: win = null, episode = 1, sealText = null, geo = null, photos = [], track = null, voice = null }) {
  const aspect = timeline.aspect
  const canvas = canvasFor(aspect)
  const W = canvas.width
  const H = canvas.height
  const lang = timeline.lang
  const zh = /^zh/i.test(lang)
  const uiLang = zh ? 'zh-CN' : 'en'
  const from = win?.from ?? 0
  const to = win?.to ?? timeline.seconds
  const duration = Math.round((to - from) * 1000) / 1000
  const scale = stylePack.typography.scale[aspect]
  const cap = stylePack.captions[aspect]
  const files = stylePack.typography.files
  const fonts = [...new Set(files.map((f) => f.family))]
  const stack = /^(zh|ja|yue)/i.test(lang) ? stylePack.typography.stack.han : stylePack.typography.stack.default
  const assets = [
    { from: 'vendor/gsap.min.js', to: 'assets/gsap.min.js' },
    ...files.map((f) => ({ from: f.file, to: `assets/fonts/${f.file.split('/').pop()}` })),
  ]
  const faces = files.map((f) => `@font-face{font-family:${JSON.stringify(f.family)};src:url("assets/fonts/${f.file.split('/').pop()}") format("${f.file.endsWith('.woff2') ? 'woff2' : 'truetype'}");font-weight:${f.weight ?? 400};font-style:normal;font-display:block${f.unicode_range ? `;unicode-range:${f.unicode_range}` : ''}}`).join('\n')
  const vars = [
    `--ci-caption-size:${px(scale.caption * H)}`,
    `--ci-caption-width:${px(cap.width * W)}`,
    `--ci-caption-bottom:${px(cap.bottom * H)}`,
    `--ci-title-size:${px(scale.title * H)}`,
    `--ci-title-top:${px(H * (aspect === '16:9' ? 0.14 : 0.2))}`,
    `--ci-card-title-size:${px(scale.card_title * H)}`,
    `--ci-card-value-size:${px(scale.card_value * H)}`,
    `--ci-card-width:${px((aspect === '16:9' ? 0.24 : 0.5) * W)}`,
    `--ci-card-right:${px(0.06 * W)}`,
    `--ci-card-top:${px((aspect === '16:9' ? 0.12 : 0.14) * H)}`,
    `--ci-badge-size:${px(0.022 * H)}`,
    '--ci-paper-texture:none',
  ].join(';')
  const ident = stylePack.ident
  // With an opt-in music track (music/track.json) the music is not made by code: the AIGC line then
  // only claims the pictures, and the track's own credit (title, author, licence or model) follows it.
  const aigcLabel = track || voice ? (ident.aigc_label_track ?? TRACK_AIGC_LABEL)[uiLang] ?? TRACK_AIGC_LABEL.en : ident.aigc_label[uiLang]
  const trackCredit = track ? track.credit[uiLang] ?? track.credit[String(uiLang).split('-')[0]] ?? track.credit.en : ''
  const voiceCredit = voice ? voice.credit[uiLang] ?? voice.credit.en : ''
  const seal = sealText ?? '墨'
  const sample = [timeline.title?.text, timeline.end_card?.line, ...timeline.captions.flatMap((c) => c.lines), ...timeline.kp_cards.flatMap((c) => [c.title, c.value]), ident.series[uiLang], aigcLabel, trackCredit, voiceCredit, ident.aigc_badge[uiLang], seal, '0123456789', ...(geo?.places ?? []).flatMap((p) => Object.values(p.label ?? {})), ...photos.map((p) => p.credit), ...JSON.stringify(geo?.chronology ?? '').split(''), ...(geo ? [geo.attribution ?? '', 'AI 示意 AI illustration km 公元前年 BCE CE'] : []), ...timeline.shots.flatMap((s) => Object.values(s.params ?? {}).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).filter((x) => typeof x === 'string') : [])))].filter(Boolean).join('')
  const runtimeTimeline = { ...timeline, width: W, height: H, fonts, font_sample: [...new Set(sample)].join(''), seal_text: seal }
  const overlays = [
    `<div class="ci-overlay" id="ci-caption" dir="${timeline.dir}" lang="${esc(lang)}"></div>`,
    `<div class="ci-overlay" id="ci-card" lang="${esc(lang)}"><div class="ci-card-seal">${esc(seal)}</div><div class="ci-card-title"></div><div class="ci-card-value"></div></div>`,
    `<div class="ci-overlay" id="ci-title" lang="${esc(lang)}" dir="${timeline.dir}">${esc(timeline.title?.text ?? '')}</div>`,
    ...(geo ? [`<div class="ci-overlay" id="ci-geo-credit" style="left:auto;right:${px(0.03 * W)};bottom:${px(0.032 * H)};top:auto;font-size:${px(0.016 * H)};opacity:.62;color:#3b342b;letter-spacing:.02em">${esc(geo.attribution ?? '© OpenStreetMap contributors')}</div>`] : []),
    `<div class="ci-overlay" id="ci-badge" lang="${uiLang}">${esc(ident.aigc_badge[uiLang])}</div>`,
    `<div class="ci-overlay" id="ci-endcard" lang="${esc(lang)}"><div class="ci-end-line" dir="${timeline.dir}">${esc(timeline.end_card?.line ?? '')}</div><div class="ci-end-seal">${esc(seal)}</div><div class="ci-end-series" lang="${uiLang}">${esc(ident.series[uiLang])} · ${esc(ident.episode_format[uiLang].replace('{n}', String(episode)))}</div>${geo ? `<div class="ci-end-aigc" id="ci-data-credit">${esc(['Data: ' + (geo.attribution ?? '© OpenStreetMap contributors (ODbL)'), 'Wikidata (CC0)', ...(photos.length ? ['photographs: Wikimedia Commons'] : [])].join(' · '))}</div>` : ''}<div class="ci-end-aigc" id="ci-aigc-label" lang="${uiLang}">${esc(aigcLabel)}</div>${trackCredit ? `<div class="ci-end-aigc ci-end-credit" id="ci-music-credit" lang="${uiLang}">${esc(trackCredit)}</div>` : ''}${voiceCredit ? `<div class="ci-end-aigc ci-end-credit" id="ci-voice-credit" lang="${uiLang}">${esc(voiceCredit)}</div>` : ''}</div>`,
  ].join('')
  const html = `<!doctype html>
<html lang="${esc(lang)}" dir="${timeline.dir}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>${esc(timeline.title?.text || 'chronicle')}</title><style>
${faces}
html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;background:#EFE6D2}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${stack};${vars}}
${String(styleCss).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<\/style/gi, '<\\/style')}
</style></head><body><div id="stage" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${duration}" data-width="${W}" data-height="${H}" data-fps="${canvas.fps}"><canvas id="ci-canvas" width="${W}" height="${H}"></canvas>${overlays}</div>
<script src="assets/gsap.min.js"></script>
<script>
const tl=gsap.timeline({paused:true});tl.set('#stage',{opacity:1},${duration});
window.__timelines=window.__timelines||{};window.__timelines[${JSON.stringify(COMPOSITION_ID)}]=tl;
window.CI_TIMELINE=${JSON.stringify(runtimeTimeline).replace(/</g, '\\u003c')};
window.CI_WINDOW=${JSON.stringify({ from, to })};
window.CI_PHOTOS=${JSON.stringify(photos.map((p) => ({ id: p.id, src: `assets/photos/${p.id}.jpg`, credit: p.credit }))).replace(/</g, '\\u003c')};
window.CI_GEO=${geo ? JSON.stringify(geo).replace(/</g, '\\u003c') : 'null'};
window.CI_SCENES={};
${inlineScript([kitCode, ...scenes.map((s) => wrapScene(s.name, s.code)), runtimeCode].join('\n'))}
</script>
</body></html>
`
  return { html, hyperframes: HYPERFRAMES_JSON, assets, canvas, duration }
}
/** Seal text of a script (script.seal, at most 4 characters) or null. */
export const sealTextOf = (script) => (typeof script?.seal === 'string' && [...script.seal].length <= 4 ? script.seal : null)
export { localized }
