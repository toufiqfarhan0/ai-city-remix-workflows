// Geometry, traffic, diversity and planning checks, without a browser: each test file is bundled
// (three included) by a Vite SSR build into node_modules/.cache and imported. Run: node tests/run.mjs
import { rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(APP, 'node_modules/.cache/mm-tests')
try {
  for (const name of ['geometry', 'life', 'diversity', 'planning']) {
    await build({
      configFile: false,
      logLevel: 'error',
      root: APP,
      ssr: { noExternal: true }, // bundle three, so the output runs without bare imports
      build: {
        ssr: join(APP, 'tests', `${name}.ts`),
        outDir: OUT,
        emptyOutDir: true,
        write: true,
        rollupOptions: { output: { format: 'es', entryFileNames: '[name].mjs' } },
      },
    })
    await import(pathToFileURL(join(OUT, `${name}.mjs`)).href)
    console.log(`ok ${name}`)
  }
} finally {
  rmSync(OUT, { recursive: true, force: true })
}
