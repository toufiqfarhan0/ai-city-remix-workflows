// Child processes with argv arrays (never a shell), a timeout and bounded output capture.
import { spawn as nodeSpawn } from 'node:child_process'

const CAP = 2_000_000

/**
 * Runs `cmd args` and resolves { code, signal, stdout, stderr, timedOut, error } (never rejects).
 * `error` is set when the program could not be started (for example ENOENT).
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ env?: object, cwd?: string, timeoutMs?: number, spawn?: Function, stdin?: string }} [options]
 */
export function runProcess(cmd, args, { env = process.env, cwd, timeoutMs = 0, spawn = nodeSpawn } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(cmd, args, { env, cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ code: null, signal: null, stdout: '', stderr: '', timedOut: false, error })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch { /* already gone */ }
    }, timeoutMs) : null
    const done = (res) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(res)
    }
    child.stdout?.on('data', (d) => { stdout += d; if (stdout.length > CAP) stdout = stdout.slice(-CAP / 2) })
    child.stderr?.on('data', (d) => { stderr += d; if (stderr.length > CAP) stderr = stderr.slice(-CAP / 2) })
    child.on('error', (error) => done({ code: null, signal: null, stdout, stderr, timedOut, error }))
    child.on('close', (code, signal) => done({ code, signal, stdout, stderr, timedOut, error: null }))
  })
}

/** Whether a program starts (`<cmd> <versionArg>` exits 0). */
export async function programWorks(cmd, versionArgs = ['-version'], { env, spawn } = {}) {
  const r = await runProcess(cmd, versionArgs, { env, spawn, timeoutMs: 15_000 })
  return !r.error && r.code === 0
}
