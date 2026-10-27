#!/usr/bin/env node
// Fills the stone-stars-city meta prompt from a slots JSON file. Zero dependencies, no network.
//
//   node scripts/fill-prompt.mjs --slots slots.json [--lang en|zh-CN] [--out prompt.md]
//
// Exit codes: 0 written, 1 internal error (a placeholder left over), 2 invalid input.

import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EXTRA_HEADING, SLOT_DEFAULTS, msg, resolveLang } from './lib/i18n.mjs'

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REQUIRED = ['city', 'landmark']
export const OPTIONAL = Object.keys(SLOT_DEFAULTS.en)
export const SLOT_MAX = 2000

export class SlotError extends Error {
  constructor(key, vars = {}) {
    super(key)
    this.key = key
    this.vars = vars
  }
}

/** The placeholder names used by a template. */
export function placeholders(template) {
  return [...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort()
}

/** Validates the slots object; throws SlotError. */
export function validateSlots(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) throw new SlotError('slotsNotObject')
  const known = [...REQUIRED, ...OPTIONAL]
  const unknown = Object.keys(slots).filter((k) => !known.includes(k))
  if (unknown.length) throw new SlotError('slotsUnknown', { keys: unknown.join(', '), known: known.join(', ') })
  for (const [k, v] of Object.entries(slots)) {
    if (typeof v !== 'string') throw new SlotError('slotNotString', { key: k })
    if (v.length > SLOT_MAX) throw new SlotError('slotTooLong', { key: k, max: SLOT_MAX })
  }
  for (const k of REQUIRED) if (!slots[k] || !slots[k].trim()) throw new SlotError('slotRequired', { key: k })
}

/** Pure: renders the template for `lang` with defaults for blank optional slots. */
export function renderPrompt(template, slots, lang) {
  validateSlots(slots)
  const values = { ...SLOT_DEFAULTS[lang] }
  for (const [k, v] of Object.entries(slots)) if (v.trim() || REQUIRED.includes(k)) values[k] = v.trim()
  const extra = values.extraPrompt ? `\n## ${EXTRA_HEADING[lang]}\n${values.extraPrompt}\n` : ''
  values.extraPrompt = extra
  // Function replacer, so "$&" in a slot value stays literal.
  return template.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in values ? values[k] : all))
}

export function templatePath(lang) {
  return join(SKILL, 'assets', 'prompts', `meta-prompt.${lang}.md`)
}

function main() {
  const argv = process.argv.slice(2)
  const { lang, invalid } = resolveLang(argv)
  if (invalid !== null) console.error(msg(lang, 'langInvalid', { value: invalid }))
  const opt = (name) => {
    const i = argv.indexOf(`--${name}`)
    if (i >= 0) return argv[i + 1]
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  }
  const slotsFile = opt('slots')
  const out = opt('out')
  const fail = (key, vars) => {
    console.error(msg(lang, key, vars))
    process.exit(2)
  }
  if (!slotsFile) fail('fillUsage')
  if (!existsSync(slotsFile)) fail('slotsMissing', { file: slotsFile })
  let slots
  try {
    slots = JSON.parse(readFileSync(slotsFile, 'utf8'))
  } catch {
    fail('slotsInvalidJson', { file: slotsFile })
  }
  let text
  try {
    text = renderPrompt(readFileSync(templatePath(lang), 'utf8'), slots, lang)
  } catch (e) {
    if (e instanceof SlotError) fail(e.key, e.vars)
    throw e
  }
  const left = placeholders(text)
  if (left.length) {
    console.error(msg(lang, 'fillLeftover', { list: left.join(', ') }))
    process.exit(1)
  }
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true })
    writeFileSync(out, text)
    console.error(msg(lang, 'fillWrote', { lang, file: out }))
  } else {
    process.stdout.write(text)
  }
}

// Run only as a CLI (tests import the functions). realpath: /tmp and /var may be symlinks.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) main()
