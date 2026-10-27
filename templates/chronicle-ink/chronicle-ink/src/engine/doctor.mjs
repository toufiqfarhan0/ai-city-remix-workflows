// `doctor`: bilingual environment report (no project, no lock, no network, no credential).
// Every probe goes through an injectable `probe` object so tests run without the real tools.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cpus } from 'node:os'
import { t } from './i18n.mjs'
export const MIN_FFMPEG_MAJOR = 6
export const CHROME_PATHS = Object.freeze([
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
])
/** Real probes (argv arrays, no shell, short timeouts). */
export function defaultProbe({ env = process.env } = {}) {
  return {
    run(cmd, args, { timeoutMs = 15_000 } = {}) {
      const r = spawnSync(cmd, args, { env, shell: false, encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] })
      if (r.error) return null
      return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
    },
    exists: (p) => existsSync(p),
    nodeVersion: process.versions.node,
    cpus: cpus().length,
    chrome: env.CHROME || null,
  }
}
/** Major.minor of the first `ffmpeg version X` style string, or null. */
export function parseVersion(text, re) {
  const m = re.exec(String(text ?? ''))
  if (!m) return null
  const parts = m[1].replace(/^n/, '').split(/[.-]/).map((x) => Number.parseInt(x, 10))
  return Number.isInteger(parts[0]) ? { major: parts[0], minor: Number.isInteger(parts[1]) ? parts[1] : 0, text: m[1] } : null
}
/** Collects the checks. @returns {{ checks: { id, status: 'ok'|'warn'|'missing'|'info', key, vars }[] }} */
export function collectDoctor({ probe }) {
  const checks = []
  const add = (id, status, key, vars = {}) => checks.push({ id, status, key, vars })
  const nodeMajor = Number(String(probe.nodeVersion).split('.')[0])
  add('node', nodeMajor >= 22 ? 'ok' : 'warn', nodeMajor >= 22 ? 'doctor.node_ok' : 'doctor.node_old', { version: probe.nodeVersion })
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const r = probe.run(tool, ['-version'])
    const v = r && r.code === 0 ? parseVersion(r.stdout, new RegExp(`${tool} version (\\S+)`)) : null
    if (!r || r.code !== 0) add(tool, 'missing', 'doctor.tool_missing', { name: tool })
    else if (!v || v.major < MIN_FFMPEG_MAJOR) add(tool, 'warn', 'doctor.tool_old', { name: tool, version: v?.text ?? '?', min: MIN_FFMPEG_MAJOR })
    else add(tool, 'ok', 'doctor.tool_ok', { name: tool, version: v.text })
  }
  const chrome = [probe.chrome, ...CHROME_PATHS].filter(Boolean).find((p) => probe.exists(p))
  add('chrome', chrome ? 'ok' : 'missing', chrome ? 'doctor.chrome_ok' : 'doctor.chrome_missing')
  add('gpu', 'info', 'doctor.gpu_ignored')
  add('cpus', 'info', 'doctor.cpus', { cpus: probe.cpus, workers: Math.max(1, Math.min(6, Math.floor(probe.cpus / 2))) })
  add('models', 'info', 'doctor.no_models')
  return { checks }
}
const MARK = { ok: '[ok]', warn: '[warn]', missing: '[missing]', info: '[info]' }
/** Prints the report and returns exit 0 (doctor reports; it does not fail). */
export function runDoctor({ lang = 'en', log = console, env = process.env, probe = defaultProbe({ env }) }) {
  const { checks } = collectDoctor({ probe })
  log.log(t(lang, 'doctor.title'))
  for (const c of checks) log.log(`${MARK[c.status]} ${t(lang, c.key, c.vars)}`)
  return 0
}
