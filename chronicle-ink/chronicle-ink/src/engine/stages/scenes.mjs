// scenes stage (art role): checks the Agent-written scene code (scenes/<name>.js, one file per scene
// name used by the shot list) and builds the HyperFrames project work/scenes/project/. No model call.
//
// Without every scene file: AGENT_TASK.md lists the missing scenes with their shots (size, camera,
// description, motion, SFX beats) and points at the kit reference and the exemplars; status
// awaiting_scenes. Every file must pass the static scan (render/scan.mjs: no network, no clock or
// Math.random, no DOM or storage access) or the stage fails with scene_rejected:<name> (exit 4).
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ChronicleError, EXIT } from '../errors.mjs'
import { t } from '../i18n.mjs'
import { buildComposition, sealTextOf } from '../render/composition.mjs'
import { loadTrack } from './music.mjs'
import { loadVoice } from '../audio/voice.mjs'
import { SCAN_SCHEMA, scanScene } from '../render/scan.mjs'
import { abs, assetsDir, readProjectJson, writeAgentTask, writeProjectFile, writeProjectJson } from './common.mjs'
export const PROJECT_DIR = 'work/scenes/project'
/** Scene names in first-use order with their shots. */
export function sceneUses(timeline) {
  const out = new Map()
  for (const s of timeline.shots) {
    if (!out.has(s.scene)) out.set(s.scene, [])
    out.get(s.scene).push(s)
  }
  return out
}
const AGENT_TASK = (missing, timeline) => `# chronicle-ink: write the scene code (art)
Write one file per scene into \`scenes/<name>.js\` of the project:
\`\`\`js
scene('<name>', function (g, s) {
  // g: CanvasRenderingContext2D (${timeline.aspect === '16:9' ? '1920×1080' : '1080×1920'}); s: { t, u, dur, beat, bar, W, H, params, size, cam,
  //    cues, cue(kind, i), kp, title, lang, dir, cache(key, w, h, draw), kit }
  const k = s.kit
  g.drawImage(s.cache('paper', s.W, s.H, (p) => k.paper(p, s.W, s.H, 7)), 0, 0)
  k.layer(g, s, 0.4, () => k.mountains(g, { W: s.W, base: s.H * 0.62, height: s.H * 0.3, seed: 3, alpha: 0.35 }))
})
\`\`\`
- Draw only with the kit (\`references/style-pack.md\`) and Canvas 2D. Deterministic in \`s.t\`: no
  Math.random (use \`s.kit.rng(seed)\`), no Date, no timers, no network, no DOM. Cache static layers.
- Time key actions on the shot's cues (\`s.cue('appear', 0)\` is the local time of its SFX hit), so the
  sound lands on the frame where the action happens. Captions, cards, title and end card are drawn by the
  engine; keep the lower ${timeline.aspect === '16:9' ? '18' : '20'} % calm for the caption.
- Never draw a realistic face: silhouettes from behind or far away, objects, calligraphy, landscapes.
- Start from \`assets/style/exemplars/\` (copy and adapt). Then run \`scenes\` again and review segment by
  segment with \`render --segment s1\` (opening first).

Missing scenes:
${missing.map(([name, shots]) => `- \`${name}\`: ${shots.map((s) => `${s.id} (${s.bars} bars, ${s.size}, ${s.camera}${s.kp ? `, card ${s.kp}` : ''}${s.title ? ', title' : ''}): ${s.description}`).join('; ')}`).join('\n')}
`
/** Reads and scans every scene file; returns { scenes, scan, missing }. */
export function loadScenes(ctx, timeline) {
  const uses = sceneUses(timeline)
  const scenes = []
  const missing = []
  const results = []
  for (const [name, shots] of uses) {
    const file = abs(ctx, `scenes/${name}.js`)
    if (!existsSync(file)) { missing.push([name, shots]); continue }
    const code = readFileSync(file, 'utf8')
    results.push(scanScene(name, code))
    scenes.push({ name, code })
  }
  return { scenes, missing, scan: { schema: SCAN_SCHEMA, scenes: results, ok: results.every((r) => r.ok) } }
}
/**
 * Writes a HyperFrames project for the film or a review window into `dir` (project-relative).
 * @returns {object} composition result
 */
export function writeProject(ctx, { dir, timeline, scenes, script, window = null }) {
  const pack = ctx.stylePack
  const assets = assetsDir(ctx)
  const styleCss = readFileSync(join(assets, ...String(pack.css).split('/')), 'utf8')
  // pack.kit is one file or a list (a style kit may extend the base kit); they are concatenated in order.
  const kitCode = [].concat(pack.kit).map((k) => readFileSync(join(assets, ...String(k).split('/')), 'utf8')).join('\n;\n')
  const runtimeCode = readFileSync(new URL('../render/runtime.js', import.meta.url), 'utf8')
  const geoFile = abs(ctx, 'geo/basemap.json')
  const geo = existsSync(geoFile) ? JSON.parse(readFileSync(geoFile, 'utf8')) : null
  const photoFile = abs(ctx, 'geo/photos.json')
  const photos = existsSync(photoFile) ? JSON.parse(readFileSync(photoFile, 'utf8')).photos.filter((p) => existsSync(abs(ctx, p.file))) : []
  const comp = buildComposition({ timeline, scenes, stylePack: pack, styleCss, kitCode, runtimeCode, window, sealText: sealTextOf(script), geo, photos, track: loadTrack(ctx.projectDir), voice: loadVoice(ctx.projectDir) })
  rmSync(abs(ctx, dir), { recursive: true, force: true })
  writeProjectFile(ctx, `${dir}/index.html`, comp.html)
  writeProjectJson(ctx, `${dir}/hyperframes.json`, comp.hyperframes)
  for (const a of comp.assets) writeProjectFile(ctx, `${dir}/${a.to}`, readFileSync(join(assets, ...a.from.split('/'))))
  for (const p of photos) writeProjectFile(ctx, `${dir}/assets/photos/${p.id}.jpg`, readFileSync(abs(ctx, p.file)))
  writeProjectJson(ctx, `${dir}/composition.json`, { schema: 'chronicle-composition/2', width: comp.canvas.width, height: comp.canvas.height, fps: comp.canvas.fps, from: window?.from ?? 0, to: window?.to ?? timeline.seconds, duration: comp.duration })
  return comp
}
/** @param {object} ctx stage context */
export async function run(ctx) {
  const { lang, log } = ctx
  const timeline = readProjectJson(ctx, 'work/timeline.json', { code: 'stage_missing:timeline' })
  const script = readProjectJson(ctx, 'script.json', { code: 'stage_missing:script' })
  const { scenes, missing, scan } = loadScenes(ctx, timeline)
  if (missing.length) {
    writeAgentTask(ctx, AGENT_TASK(missing, timeline))
    return { status: 'awaiting', awaiting: 'awaiting_scenes', outputs: ['AGENT_TASK.md'] }
  }
  writeProjectJson(ctx, 'work/scenes/scan.json', scan)
  const bad = scan.scenes.filter((r) => !r.ok)
  if (bad.length) {
    for (const r of bad) for (const p of r.problems) log.error(`- scene_rejected:${r.name} ${p.id} line ${p.line}: ${p.match}`)
    throw new ChronicleError(`scene_rejected:${bad[0].name}`, EXIT.scene, { scenes: bad.map((r) => r.name), problems: bad[0].problems.map((p) => `${p.id}:${p.match}`) })
  }
  writeProject(ctx, { dir: PROJECT_DIR, timeline, scenes, script })
  log.log(t(lang, 'stage.scenes_done', { scenes: scenes.length, shots: timeline.shots.length }))
  return { status: 'done', outputs: [`${PROJECT_DIR}/`, 'work/scenes/scan.json'] }
}
