#!/usr/bin/env node
// Entry point of every stage:
//   node scripts/chronicle.mjs <command> --project <dir> [--lang en|zh-CN] [options]
// The engine is a byte-identical copy in ../src/engine/; this file only passes the Skill's paths.
import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { main } from '../src/engine/cli.mjs'

export const skillDir = fileURLToPath(new URL('..', import.meta.url))
export const stylePackPath = fileURLToPath(new URL('../assets/style-pack.json', import.meta.url))

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2), { skillDir, stylePackPath })
}
