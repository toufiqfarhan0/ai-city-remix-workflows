#!/usr/bin/env node
/**
 * Builds the film: one self-contained HTML player, rendered frame by frame in headless
 * Chrome, then the narration is laid in.
 *
 *   node scripts/film.mjs <project-dir> [--stills 12,30] [--fps 30] [--chrome <path>]
 *
 * Needs story.resolved.json and basemap.json (scripts/resolve.mjs) and, for sound and
 * pictures, audio/ and art/ (scripts/media.mjs). Writes film.html and film.mp4.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'
import { chromium } from 'playwright-core'
import { langFromArgs, messages } from './lib/i18n.mjs'

const require = createRequire(import.meta.url)
/** A file inside an installed package, ignoring its "exports" map. */
const pkgFile = (name, sub) => {
  for (const base of require.resolve.paths(name) ?? []) { const f = join(base, name, sub); if (existsSync(f)) return f }
  throw new Error(`${name}/${sub} not found: run npm install in the Skill folder`)
}
const args = process.argv.slice(2)
const dir = resolve(args[0] ?? '')
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d }
const FPS = Number(opt('--fps', 30))
const stills = opt('--stills', null)
const WIN_CHROME = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA, 'C:/Program Files', 'C:/Program Files (x86)'].filter(Boolean).map((d) => join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
const chrome = opt('--chrome', process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', ...WIN_CHROME].find(existsSync))
const msg = messages(langFromArgs(args))
if (!args[0] || args[0].startsWith('--')) { console.error(msg('usageFilm')); process.exit(2) }

const story = JSON.parse(readFileSync(join(dir, 'story.resolved.json'), 'utf8'))
const ffprobe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout)
// Each era lasts as long as its narration plus a breath (at least 6.5 s).
story.eras.forEach((e, i) => { const a = join(dir, 'audio', `era${i}.mp3`); e.duration = existsSync(a) ? Math.max(6.5, +(ffprobe(a) + 1.6).toFixed(2)) : 7.5 })
const photos = {}
for (const e of story.eras) for (const ev of e.events ?? []) {
  ev.image ??= ev.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const f = join(dir, 'art', `${ev.image}.jpg`)
  if (existsSync(f)) photos[ev.image] = 'data:image/jpeg;base64,' + readFileSync(f).toString('base64')
}
story.photos = Object.fromEntries(Object.keys(photos).map((k) => [k, { credit: 'AI illustration' }]))
story.credits ??= `Map data © OpenStreetMap contributors · OpenMapTiles · Natural Earth · Outlines are reconstructions${Object.keys(photos).length ? ' · Illustrations are AI-generated' : ''}`
const topo = JSON.parse(readFileSync(pkgFile('world-atlas', 'land-110m.json'), 'utf8'))
const html = readFileSync(new URL('../assets/player.html', import.meta.url), 'utf8')
  .replace('/*D3ARRAY*/', () => readFileSync(pkgFile('d3-array', 'dist/d3-array.min.js'), 'utf8'))
  .replace('/*D3GEO*/', () => readFileSync(pkgFile('d3-geo', 'dist/d3-geo.min.js'), 'utf8'))
  .replace('/*STORY*/null', () => JSON.stringify(story))
  .replace('/*LAND*/null', () => JSON.stringify(feature(topo, topo.objects.land)))
  .replace('/*BASE*/null', () => (existsSync(join(dir, 'basemap.json')) ? readFileSync(join(dir, 'basemap.json'), 'utf8') : 'null'))
  .replace('/*PHOTOS*/null', () => JSON.stringify(photos))
writeFileSync(join(dir, 'film.html'), html)

const browser = await chromium.launch({ executablePath: chrome })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('file://' + join(dir, 'film.html'))
await page.evaluate(() => window.ready)
const T = await page.evaluate(() => window.DURATION)
if (errors.length) { console.error(msg('playerErrors'), errors); process.exit(1) }
if (stills) {
  for (const t of stills.split(',').map(Number)) { await page.evaluate((t) => window.render(t), t); await page.locator('canvas').screenshot({ path: join(dir, `still-${t}.png`) }) }
  await browser.close(); console.log(msg('stills', { s: T.toFixed(1) })); process.exit(0)
}
const silent = join(dir, 'film.silent.mp4')
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'fast', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] })
const frames = Math.round(T * FPS)
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.render(t), f / FPS)
  const png = await page.locator('canvas').screenshot({ type: 'jpeg', quality: 95 })
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
  if (f % (FPS * 5) === 0) process.stderr.write(`\rframes ${f}/${frames} (${Math.round(f / frames * 100)}%)`)
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close()
process.stderr.write('\n')

// Narration: intro at 0.8 s, each era 0.5 s after it starts, outro 0.8 s into the end card.
const starts = []; { let t = 8; for (const e of story.eras) { starts.push(t); t += e.duration } }
const end = starts[starts.length - 1] + story.eras[story.eras.length - 1].duration
const clips = [['intro', 0.8], ...story.eras.map((_, i) => [`era${i}`, starts[i] + 0.5]), ['outro', end + 0.8]].filter(([k]) => existsSync(join(dir, 'audio', `${k}.mp3`)))
const out = join(dir, 'film.mp4')
if (!clips.length) {
  try { renameSync(silent, out) } catch { copyFileSync(silent, out); rmSync(silent, { force: true }) }
  console.log(msg('filmSilent', { s: T.toFixed(1) }))
  process.exit(0)
}
const inputs = clips.flatMap(([k]) => ['-i', join(dir, 'audio', `${k}.mp3`)])
const filter = clips.map(([, d], i) => `[${i + 1}:a]adelay=${Math.round(d * 1000)}|${Math.round(d * 1000)}[a${i}];`).join('') + clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]`
const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out])
if (mux.status !== 0) { console.error(msg('mixFailed')); process.exit(1) }
try { rmSync(silent, { force: true }) } catch {}
console.log(msg('film', { s: T.toFixed(1), n: clips.length }))
