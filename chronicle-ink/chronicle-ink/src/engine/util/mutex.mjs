// In-process mutex (a Promise queue). Concurrent tasks of one process (for example `--jobs 3` image
// jobs) run their read -> modify -> write of jobs.json / state.json one at a time. Other processes are
// kept out by the project lock (project.mjs), so no file lock is needed here. Dependency-free.

/** Returns { run(fn) } where run executes fn() after every earlier task has settled. */
export function createMutex() {
  let tail = Promise.resolve()
  return {
    run(fn) {
      const next = tail.then(() => fn())
      // Keep the queue alive after a failure; the caller still sees the rejection.
      tail = next.then(() => undefined, () => undefined)
      return next
    },
  }
}

const mutexes = new Map()

/** One shared mutex per key (an absolute file path), so every module serialises the same file. */
export function mutexFor(key) {
  let m = mutexes.get(key)
  if (!m) mutexes.set(key, (m = createMutex()))
  return m
}
