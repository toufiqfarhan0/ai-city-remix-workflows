#!/usr/bin/env node
// Real photographs for landmark and event cards: reads "photos" in <project>/geo/places.json,
// resolves each to a Wikimedia Commons file (Wikidata P18 for a QID, or a Commons search, or a file
// name), downloads a 960 px thumbnail and records author, licence and source page in
// <project>/geo/photos.json. These are existing photographs and artworks with their credits shown on
// screen, never generated images. Keyless public reads.
//
//   node scripts/photos.mjs --project <dir>
//
// places.json: "photos": [{ "id": "colosseum", "qid": "Q10285" },
//                         { "id": "fire", "search": "Hubert Robert Fire of Rome" },
//                         { "id": "x", "file": "Colosseo 2020.jpg" }]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const UA = 'sandbase-lab-chronicle-ink/0.4 (https://www.sandbase.ai/lab/chronicle-ink)'
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1] }
const dir = resolve(arg('project') ?? '')
const spec = JSON.parse(readFileSync(join(dir, 'geo', 'places.json'), 'utf8'))
const out = join(dir, 'geo', 'photos'); mkdirSync(out, { recursive: true })
// upload.wikimedia.org is unreachable from some networks through the default route; these are its
// public front ends (Wikimedia data centres), tried in order. Only standard thumbnail widths work.
const FRONTS = [null, '208.80.154.240', '208.80.153.240', '185.15.59.240']
const json = async (u) => {
  let last
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.json(); last = new Error(`HTTP ${r.status}`) } catch (e) { last = e }
    await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)))
  }
  throw last
}
const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const author = (m) => { let a = strip(m.Artist?.value).replace(/^(This )?photo (was )?taken by /i, '').replace(/\.\s.*$/, ''); if (!a || /^(FeaturedPics|Own work|unknown)/i.test(a)) a = strip(m.Credit?.value).replace(/^Own work$/i, '') || 'Wikimedia Commons contributor'; return a.slice(0, 40) }

async function fileFor(p) {
  if (p.file) return p.file
  if (p.qid) {
    const d = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${p.qid}&props=claims&format=json`)
    const f = d.entities?.[p.qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (f) return f
  }
  if (p.search) {
    const d = await json(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=1&format=json&srsearch=${encodeURIComponent(p.search)}`)
    const t = d.query?.search?.[0]?.title
    if (t) return t.replace(/^File:/, '')
  }
  return null
}
function download(url, file) {
  const host = new URL(url).hostname
  for (const ip of FRONTS) {
    try {
      execFileSync('curl', ['-sfL', '-m', '40', '-A', UA, ...(ip ? ['--resolve', `${host}:443:${ip}`] : []), '-o', file, url], { stdio: 'ignore' })
      if (existsSync(file) && statSync(file).size > 5000) return true
    } catch { /* next front end */ }
  }
  return false
}
const records = []
const only = arg('only')?.split(',')
const prev = existsSync(join(dir, 'geo', 'photos.json')) ? JSON.parse(readFileSync(join(dir, 'geo', 'photos.json'), 'utf8')).photos : []
for (const p of spec.photos ?? []) {
  if (only && !only.includes(p.id)) { const r = prev.find((x) => x.id === p.id); if (r) records.push(r); continue }
  try {
    const name = await fileFor(p)
    if (!name) { console.warn(`[photos] ${p.id}: no Commons file`); continue }
    const d = await json(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + name)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&format=json`)
    const info = Object.values(d.query?.pages ?? {})[0]?.imageinfo?.[0]
    if (!info?.thumburl) { console.warn(`[photos] ${p.id}: no thumbnail`); continue }
    const m = info.extmetadata ?? {}
    const file = join(out, `${p.id}.jpg`)
    const alt = [info.thumburl, info.thumburl.replace(/\/960px-/, '/1280px-'), info.thumburl.replace(/\/960px-/, '/640px-'), info.url]
    if (!alt.some((u) => download(u, file))) { console.warn(`[photos] ${p.id}: download failed`); continue }
    const credit = [author(m), strip(m.LicenseShortName?.value) || 'see source', 'Wikimedia Commons'].join(' · ')
    records.push({ id: p.id, file: `geo/photos/${p.id}.jpg`, commons: name, source: info.descriptionurl, license: strip(m.LicenseShortName?.value), credit })
    console.log(`[photos] ${p.id.padEnd(12)} ${credit}`)
  } catch (e) { console.warn(`[photos] ${p.id}: ${e.message}`) }
}
writeFileSync(join(dir, 'geo', 'photos.json'), JSON.stringify({ schema: 'chronicle-photos/1', photos: records }, null, 1))
console.log(`[photos] ${records.length} photos -> geo/photos.json`)
