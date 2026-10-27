#!/usr/bin/env node
/**
 * Narration through SandBase (billed to your account): one clip per spoken line of story.json,
 * MiniMax Speech 2.8 HD, written to <project-dir>/audio/<key>.mp3.
 *
 *   node scripts/voice.mjs <project-dir>             # print the plan and the estimated cost
 *   node scripts/voice.mjs <project-dir> --confirm   # generate what is missing
 *
 * Calls go through the SandBase CLI (`npx -y @sandbaseai/cli@latest`); it uses its own login or
 * SANDBASE_API_KEY from the environment. Nothing here reads or writes a key. Existing clips are
 * kept, so deleting one and re-running regenerates only that clip.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { langFromArgs, messages } from './lib/i18n.mjs'
import { normalizeStory, spokenLines, validateStory } from './lib/story.mjs'

const args = process.argv.slice(2)
const msg = messages(langFromArgs(args))
if (!args[0] || args[0].startsWith('--')) { console.error(msg('usageVoice')); process.exit(2) }
const dir = resolve(args[0])
const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
normalizeStory(story)
const problems = validateStory(story)
if (problems.length) { console.error(msg('storyProblems')); for (const p of problems) console.error(`  - ${p}`); process.exit(1) }
const TTS = 'sandbase_minimax_speech_2_8_hd'
const todo = spokenLines(story).filter(([k]) => !existsSync(join(dir, 'audio', `${k}.mp3`)))
const chars = todo.reduce((n, [, t]) => n + t.length, 0)
console.log(msg('voicePlan', { n: todo.length, chars, usd: ((chars / 1000) * 0.1).toFixed(3), tool: TTS, voice: story.voice }))
if (!todo.length) process.exit(0)
if (!args.includes('--confirm')) { console.log(msg('notConfirmed')); process.exit(0) }

const WIN = process.platform === 'win32'
function cli(argv) {
  const opts = { encoding: 'utf8', maxBuffer: 1 << 26 }
  const r = WIN ? spawnSync(`npx.cmd ${argv.map((a) => `"${a}"`).join(' ')}`, { ...opts, shell: true }) : spawnSync('npx', argv, opts)
  try { return JSON.parse(r.stdout) } catch { throw new Error(String(r.stderr || r.stdout).trim().slice(-300)) }
}
function run(tool, input) {
  const tmp = mkdtempSync(join(tmpdir(), 'cg3-'))
  try {
    const f = join(tmp, 'in.json'); writeFileSync(f, JSON.stringify(input))
    let d = cli(['-y', '@sandbaseai/cli@latest', 'run', tool, '-f', f, '-j'])
    for (let i = 0; i < 10 && !['completed', 'failed', 'timeout'].includes(d.status) && d.run_id; i++) {
      try { d = { ...d, ...cli(['-y', '@sandbaseai/cli@latest', 'runs', 'get', '-r', d.run_id, '-w', '--timeout', '90', '-j']) } } catch { /* poll again */ }
    }
    if (d.status !== 'completed') throw new Error(`${tool}: ${typeof d.error === 'object' ? JSON.stringify(d.error) : d.error ?? d.status}`)
    return d
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}
mkdirSync(join(dir, 'audio'), { recursive: true })
let spent = 0
for (const [key, text] of todo) {
  const d = run(TTS, { text, voice_id: story.voice, emotion: 'neutral', speed: 0.95, language_boost: 'English', format: 'mp3', sample_rate: 44100 })
  const url = d.output?.find?.((o) => o.url)?.url
  if (!url) throw new Error(`${TTS}: no output URL`)
  const r = spawnSync('curl', ['-fsSL', '--retry', '3', ...(WIN ? ['--ssl-no-revoke'] : []), '-o', join(dir, 'audio', `${key}.mp3`), url])
  if (r.status !== 0) throw new Error(`download failed for ${key}`)
  spent += Number(d.cost ?? 0) || 0
  console.log(`narration ${key} ok`)
}
const prev = existsSync(join(dir, 'voice.json')) ? JSON.parse(readFileSync(join(dir, 'voice.json'), 'utf8')) : {}
writeFileSync(join(dir, 'voice.json'), JSON.stringify({ tool: TTS, voice: story.voice, spent_usd: +((prev.spent_usd ?? 0) + spent).toFixed(4) }, null, 1))
console.log(msg('voiceDone', { usd: spent.toFixed(3) }))
