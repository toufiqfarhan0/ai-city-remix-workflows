#!/usr/bin/env node
// Creates a project folder (outside the Skill folder) with brief.json:
//   node scripts/new-project.mjs --out <dir> [--topic <text>] [--qid Q…] [--seconds 150] [--aspect 16:9]
//                                [--film-lang <BCP-47>] [--lang en|zh-CN]
// --film-lang is the film language (brief.lang); --lang only changes the language of the messages.
import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { newProjectMain } from '../src/engine/cli.mjs'

export const skillDir = fileURLToPath(new URL('..', import.meta.url))

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await newProjectMain(process.argv.slice(2), { skillDir })
}
