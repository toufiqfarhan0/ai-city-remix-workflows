// HyperFrames renderer (design §10.3): `npx --yes hyperframes@0.8.30 render <project> --output <mp4>
// --fps <fps> --quality high --strict` (+ --no-browser-gpu without a GPU). HYPERFRAMES_CLI may point at a
// local copy of the CLI (a tool path, not a credential). Pure argv builders + one runner.
import { existsSync, statfsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { ChronicleError, EXIT } from '../errors.mjs'
import { redactTail } from '../util/redact.mjs'
import { runProcess } from '../util/proc.mjs'

export const HYPERFRAMES = 'hyperframes@0.8.30'
/** Unattended runs: no update check, no telemetry, no git prompt. */
export const HF_ENV = Object.freeze({ HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_NO_TELEMETRY: '1', GIT_TERMINAL_PROMPT: '0' })
export const GPU_DEVICES = Object.freeze(['/dev/nvidia0', '/dev/dri/renderD128'])
export const RENDER_TIMEOUT_MS = 6 * 3600 * 1000

/** Whether a GPU device is present (doctor uses the same rule). */
export const hasGpu = (exists = existsSync) => GPU_DEVICES.some((p) => exists(p))

/** `render` arguments. */
export function renderArgs(project, output, { fps = 30, quality = 'final', gpu = false, workers = null } = {}) {
  return ['render', project, '--output', output, '--fps', String(fps), '--quality', quality === 'draft' ? 'draft' : 'high', '--strict', ...(gpu ? [] : ['--no-browser-gpu']), ...(workers ? ['--workers', String(workers)] : [])]
}

/**
 * Whether the render must be split into chunks: HyperFrames captures frames to temporary disk (about
 * width × height × 4 bytes per frame, 37 GB for 150 s of 1080p30) and refuses to start without room
 * to spare. CHRONICLE_LOW_MEMORY=1 forces chunked rendering.
 */
export function needsLowMemory({ seconds, fps = 30, width = 1920, height = 1080, env = process.env, statfs = statfsSync, dir = tmpdir() } = {}) {
  if (env.CHRONICLE_LOW_MEMORY === '1') return true
  try {
    const st = statfs(dir)
    return st.bavail * st.bsize < seconds * fps * width * height * 4 * 1.6 + 2e9
  } catch { return false }
}

/** [command, prefix args] of the HyperFrames CLI. */
export function hyperframesCommand(env = process.env) {
  return env.HYPERFRAMES_CLI ? [process.execPath, [env.HYPERFRAMES_CLI]] : ['npx', ['--yes', HYPERFRAMES]]
}

/**
 * Runs a render; hyperframes_failed (exit 7) with the redacted last 40 lines on failure. A render that
 * exits with an error (often the browser running out of memory while other heavy jobs share the
 * machine) is retried CHRONICLE_RENDER_RETRIES times (default 1); timeouts and a CLI that does not
 * start are not retried. The render is deterministic, so a retry gives the same frames.
 */
export async function runHyperframes(args, { env = process.env, spawn, timeoutMs = RENDER_TIMEOUT_MS, output, retries } = {}) {
  const [cmd, pre] = hyperframesCommand(env)
  const max = Math.max(0, Number.isFinite(retries) ? retries : Number(env.CHRONICLE_RENDER_RETRIES ?? 1) || 0)
  for (let attempt = 0; ; attempt++) {
    const r = await runProcess(cmd, [...pre, ...args], { env: { ...env, ...HF_ENV }, spawn, timeoutMs })
    if (!(r.error || r.code !== 0 || (output && !existsSync(output)))) return r
    if (attempt < max && !r.error && !r.timedOut) { process.stderr.write(`[render] HyperFrames failed (exit ${r.code}); retrying (${attempt + 1}/${max})\n`); continue }
    throw new ChronicleError('hyperframes_failed', EXIT.local, { exit_code: r.code, timed_out: r.timedOut, reason: r.error ? 'not_started' : 'exit', attempts: attempt + 1, stderr: redactTail(`${r.stdout}\n${r.stderr}`, 40, env) })
  }
}
