#!/usr/bin/env node
/**
 * Checks a project (free, no model calls, no network).
 *
 *   node scripts/check.mjs <project-dir>          # story.json, city.json and the timeline
 *   node scripts/check.mjs <project-dir> --film   # also film.mp4: 1920×1080, 30 fps, duration, audio, full decode
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { langFromArgs, messages } from './lib/i18n.mjs'
import { normalizeStory, spokenLines, timeline, validateStory } from './lib/story.mjs'

const args = process.argv.slice(2)
const msg = messages(langFromArgs(args))
const dir = args[0]
if (!dir || dir.startsWith('--')) { console.error(msg('usageCheck')); process.exit(2) }
const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
normalizeStory(story)
const problems = validateStory(story)
if (problems.length) { console.error(msg('storyProblems')); for (const p of problems) console.error(`  - ${p}`); process.exit(1) }
const probe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout)
const clips = Object.fromEntries(spokenLines(story).map(([k]) => [k, join(dir, 'audio', `${k}.mp3`)]).filter(([, f]) => existsSync(f)).map(([k, f]) => [k, +probe(f).toFixed(2)]))
const tl = timeline(story, clips)
console.log(msg('storyOk', { n: story.eras.length, s: tl.duration.toFixed(1) }))
for (const e of tl.eras) console.log(`  ${e.id.padEnd(12)} ${e.start.toFixed(1).padStart(6)}–${(e.start + e.duration).toFixed(1).padEnd(6)} ${e.from}–${e.to}${clips[e.id] ? `  voice ${clips[e.id]} s` : ''}`)
if (existsSync(join(dir, 'city.json'))) {
  const c = JSON.parse(readFileSync(join(dir, 'city.json'), 'utf8'))
  console.log(msg('cityWritten', { n: c.stats.buildings, dated: c.stats.dated, pct: ((100 * c.stats.dated) / Math.max(1, c.stats.buildings)).toFixed(0) }))
} else console.log(msg('missingCity'))

if (!args.includes('--film')) process.exit(0)
const film = join(dir, 'film.mp4'), fail = []
if (!existsSync(film)) fail.push('film.mp4 is missing')
else {
  const info = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', film], { encoding: 'utf8' }).stdout)
  const v = info.streams.find((s) => s.codec_type === 'video'), a = info.streams.find((s) => s.codec_type === 'audio'), dur = Number(info.format.duration)
  if (!v || v.codec_name !== 'h264') fail.push('video must be H.264')
  if (v && (v.width !== 1920 || v.height !== 1080)) fail.push(`video is ${v?.width}×${v?.height}, not 1920×1080`)
  if (v && v.r_frame_rate !== '30/1') fail.push(`frame rate is ${v.r_frame_rate}, not 30`)
  if (!a) fail.push('no audio track')
  if (Math.abs(dur - tl.duration) > 0.5) fail.push(`duration ${dur.toFixed(2)} s, timeline ${tl.duration.toFixed(2)} s`)
  if (dur < 60 || dur > 180) fail.push(`duration ${dur.toFixed(1)} s is outside 60–180 s`)
  const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', film, '-f', 'null', '-'], { encoding: 'utf8' })
  if (dec.status !== 0 || dec.stderr.trim()) fail.push(`decode errors: ${dec.stderr.trim().slice(0, 200)}`)
  if (!fail.length) console.log(msg('checkOk', { s: dur.toFixed(1) }))
}
if (fail.length) { console.error(msg('checkFailed')); for (const f of fail) console.error(`  - ${f}`); process.exit(1) }
