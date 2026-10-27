#!/usr/bin/env node
/**
 * Renders the film: one self-contained page (Three.js, story, timeline, city.json inlined),
 * drawn frame by frame in Chrome with the GPU, then narration over a synthesised score.
 *
 *   node scripts/film.mjs <project-dir> [--stills 8,30,70] [--fps 30] [--chrome <path>] [--software]
 *
 * Needs city.json (build-city.mjs) and, for the voice, audio/ (voice.mjs). Writes film.html,
 * film.mp4 and still-<t>.png. --software renders with SwiftShader when there is no GPU (slow).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { langFromArgs, messages } from './lib/i18n.mjs'
import { normalizeStory, spokenLines, timeline, validateStory } from './lib/story.mjs'
import { score, wav } from './lib/score.mjs'

const args = process.argv.slice(2)
const msg = messages(langFromArgs(args))
if (!args[0] || args[0].startsWith('--')) { console.error(msg('usageFilm')); process.exit(2) }
const dir = resolve(args[0])
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d }
const FPS = Number(opt('--fps', 30)), stills = opt('--stills', null)
const CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const chrome = opt('--chrome', process.env.CHROME ?? CHROMES.find(existsSync))
if (!chrome) { console.error(msg('noChrome')); process.exit(2) }

const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
normalizeStory(story)
const problems = validateStory(story)
if (problems.length) { console.error(msg('storyProblems')); for (const p of problems) console.error(`  - ${p}`); process.exit(1) }
if (!existsSync(join(dir, 'city.json'))) { console.error(msg('missingCity')); process.exit(1) }
const ffprobe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout)
const clips = Object.fromEntries(spokenLines(story).map(([k]) => [k, join(dir, 'audio', `${k}.mp3`)]).filter(([, f]) => existsSync(f)).map(([k, f]) => [k, +ffprobe(f).toFixed(2)]))
const tl = timeline(story, clips), T = tl.duration

const require = createRequire(import.meta.url)
// three's "exports" map hides build/three.cjs, so find the package folder and read the file directly.
const pkgDir = (name) => { for (const base of require.resolve.paths(name) ?? []) { const d = join(base, name); if (existsSync(join(d, 'package.json'))) return d } throw new Error(`${name} not found: run npm ci in the Skill folder`) }
const three = readFileSync(join(pkgDir('three'), 'build', 'three.cjs'), 'utf8')
const storyLib = readFileSync(new URL('./lib/story.mjs', import.meta.url), 'utf8').replace(/^export /gm, '')
const html = readFileSync(new URL('../assets/player.html', import.meta.url), 'utf8')
  .replace('/*THREE*/', () => `var module = { exports: {} }, exports = module.exports;\n${three}\nwindow.THREE = module.exports;`)
  .replace('/*STORY*/null', () => JSON.stringify(story))
  .replace('/*CITY*/null', () => readFileSync(join(dir, 'city.json'), 'utf8'))
  .replace('/*TIMELINE*/null', () => JSON.stringify(tl))
  .replace('/*STORYLIB*/', () => storyLib)
writeFileSync(join(dir, 'film.html'), html)

const { chromium } = await import('playwright-core')
const gpuArgs = args.includes('--software') ? ['--use-angle=swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist']
const browser = await chromium.launch({ executablePath: chrome, args: gpuArgs })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(pathToFileURL(join(dir, 'film.html')).href)
await page.evaluate(() => window.ready).catch((e) => errors.push(String(e)))
const shot = async () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } })
if (errors.length) { console.error(msg('playerErrors'), errors.slice(0, 5)); await browser.close(); process.exit(1) }
if (stills) {
  for (const t of stills.split(',').map(Number)) { await page.evaluate((t) => window.render(t), t); writeFileSync(join(dir, `still-${t}.png`), await shot()) }
  await browser.close()
  if (errors.length) { console.error(msg('playerErrors'), errors.slice(0, 5)); process.exit(1) }
  console.log(msg('stills', { s: T.toFixed(1) })); process.exit(0)
}
const silent = join(dir, 'film.silent.mp4')
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] })
const frames = Math.round(T * FPS), t0 = Date.now()
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.render(t), f / FPS)
  const png = await shot()
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
  if (f % (FPS * 5) === 0) process.stderr.write(`\rframes ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close()
process.stderr.write('\n')
if (errors.length) { console.error(msg('playerErrors'), errors.slice(0, 5)); process.exit(1) }

// Sound: a synthesised score bed (no samples, no models) under the narration, ducked while it speaks.
const at = { intro: tl.introAt, outro: tl.outroAt, ...Object.fromEntries(tl.eras.map((e) => [e.id, e.voiceAt])) }
const voiced = Object.keys(clips).map((k) => ({ from: at[k], to: at[k] + clips[k] }))
writeFileSync(join(dir, 'score.wav'), wav(score(story, tl, voiced)))
const keys = Object.keys(clips)
const inputs = keys.flatMap((k) => ['-i', join(dir, 'audio', `${k}.mp3`)])
const voice = keys.map((k, i) => `[${i + 2}:a]aformat=channel_layouts=stereo,aresample=48000,adelay=${Math.round(at[k] * 1000)}:all=1[v${i}];`).join('')
const filter = keys.length
  ? `${voice}${keys.map((_, i) => `[v${i}]`).join('')}amix=inputs=${keys.length}:normalize=0,volume=1.0[voice];[1:a]volume=0.55[bed];[bed][voice]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`
  : '[1:a]loudnorm=I=-18:TP=-1.5[aout]'
const out = join(dir, 'film.mp4')
const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', join(dir, 'score.wav'), ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', T.toFixed(3), '-movflags', '+faststart', out], { encoding: 'utf8' })
if (mux.status !== 0) { console.error(msg('mixFailed'), mux.stderr.slice(0, 400)); process.exit(1) }
rmSync(join(dir, 'score.wav'), { force: true })
console.log(msg('film', { s: T.toFixed(1), n: keys.length }))
