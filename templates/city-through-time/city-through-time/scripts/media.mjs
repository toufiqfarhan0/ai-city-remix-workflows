#!/usr/bin/env node
/**
 * Narration and landmark illustrations through SandBase (billed to your account).
 *
 *   node scripts/media.mjs <project-dir>             # print the plan and the estimated cost
 *   node scripts/media.mjs <project-dir> --confirm   # generate what is missing
 *
 * Narration: MiniMax Speech 2.8 HD, one clip per line (intro, every era, outro) → audio/*.mp3.
 * Illustrations: Qwen Image 3 from each event's text prompt (no reference photo) → art/*.jpg,
 * all in one house style and labelled "AI illustration" in the film.
 * Calls go through the SandBase CLI (`npx -y @sandbaseai/cli@latest`), so SANDBASE_API_KEY
 * or `sandbase connect` is the only credential. Existing files are kept: delete one to redo it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { langFromArgs, messages } from './lib/i18n.mjs'

const dir = process.argv[2]
const confirm = process.argv.includes('--confirm')
const msg = messages(langFromArgs(process.argv))
if (!dir || dir.startsWith('--')) { console.error(msg('usageMedia')); process.exit(2) }
const storyFile = existsSync(join(dir, 'story.resolved.json')) ? 'story.resolved.json' : 'story.json'
const story = JSON.parse(readFileSync(join(dir, storyFile), 'utf8'))
const voice = story.voice ?? 'English_CaptivatingStoryteller'
const TTS = 'sandbase_minimax_speech_2_8_hd', IMG = 'sandbase_alibaba_qwen_image_3_text_to_image'
const STYLE = 'Editorial history illustration, gouache and ink, warm muted palette of ochre, terracotta and deep blue, soft dusk light, clean composition, wide 16:10 frame, no text, no letters, no logos, no frame or border. Subject: '

const lines = [['intro', story.intro], ...story.eras.map((e, i) => [`era${i}`, e.narration]), ['outro', story.outro]]
const art = story.eras.flatMap((e) => (e.events ?? []).filter((ev) => ev.prompt).map((ev) => [ev.image ?? slug(ev.title), ev.prompt]))
function slug(s) { return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) }
const todoLines = lines.filter(([k]) => !existsSync(join(dir, 'audio', `${k}.mp3`)))
const todoArt = [...new Map(art).entries()].filter(([k]) => !existsSync(join(dir, 'art', `${k}.jpg`)))
const chars = todoLines.reduce((s, [, t]) => s + t.length, 0)
const estimate = chars / 1000 * 0.1 + todoArt.length * 0.04
console.log(msg('narrationPlan', { n: todoLines.length, chars, usd: (chars / 1000 * 0.1).toFixed(3), tool: TTS, voice }))
console.log(msg('artPlan', { n: todoArt.length, usd: (todoArt.length * 0.04).toFixed(2), tool: IMG }))
console.log(msg('total', { usd: estimate.toFixed(2) }))
if (!confirm) { console.log(msg('notConfirmed')); process.exit(0) }

function sandbase(tool, input) {
  const r = spawnSync('npx', ['-y', '@sandbaseai/cli@latest', 'run', tool, '-i', JSON.stringify(input), '-w', '--timeout', '400', '-j'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  let d
  try { d = JSON.parse(r.stdout) } catch { throw new Error(`${tool}: ${(r.stderr || r.stdout).slice(0, 200)}`) }
  const url = d?.output?.[0]?.url
  if (d.status !== 'completed' || !url) throw new Error(`${tool}: ${d.error ?? d.status}`)
  return { url, cost: Number(d.cost ?? 0) }
}
function download(url, file) {
  const r = spawnSync('curl', ['-fsSL', '-o', file, url])
  if (r.status !== 0) throw new Error(`download failed: ${url}`)
}
let spent = 0
mkdirSync(join(dir, 'audio'), { recursive: true }); mkdirSync(join(dir, 'art'), { recursive: true })
for (const [key, text] of todoLines) {
  const { url, cost } = sandbase(TTS, { text, voice_id: voice, emotion: 'neutral', speed: 0.95, language_boost: 'English', format: 'mp3', sample_rate: 44100 })
  download(url, join(dir, 'audio', `${key}.mp3`)); spent += cost; console.log(`narration ${key} ok`)
}
for (const [key, prompt] of todoArt) {
  const { url, cost } = sandbase(IMG, { prompt: STYLE + prompt, resolution: '1K', output_format: 'png', seed: 1871 })
  const png = join(dir, 'art', `${key}.png`)
  download(url, png)
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=520:340:force_original_aspect_ratio=increase,crop=520:340', '-q:v', '3', join(dir, 'art', `${key}.jpg`)])
  spent += cost || 0.04; console.log(`illustration ${key} ok`)
}
writeFileSync(join(dir, 'media.json'), JSON.stringify({ voice, tts: TTS, image: IMG, spent_usd: +spent.toFixed(4) }, null, 1))
console.log(msg('spent', { usd: spent.toFixed(3) }))
