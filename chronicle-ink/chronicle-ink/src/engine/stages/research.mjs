// research stage (design §3.1, §6.1–§6.3 item 3): lock the Wikidata entity, read the sources and
// write work/research/{entity.json, known-entities.json, candidates.json (ambiguity only), sources/}.
//
// Source records: sources/<id>.json = { id, url, final_url, tier, publisher, lang, retrieved_at,
// sha256, bytes, kind: wikidata|adapter|text, adapter?, variant?, text, known_texts? }. The Wikidata
// record's text is the raw wbgetentities response of the locked entity; `known_texts` keeps the raw
// labels/aliases responses of the referenced items so an --offline run can rebuild the known-entity
// table. sources/index.json lists every record without its text, plus the research warnings.
//
// --offline: no network at all; only cached records under work/research/sources/ are used, otherwise
// offline_source_missing (exit 2).
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ChronicleError, EXIT } from '../errors.mjs'
import { buildKnownEntities, loadKnownEntities } from '../facts/labels.mjs'
import { t } from '../i18n.mjs'
import { cbdbFetchUrl } from '../research/adapters/cbdb.mjs'
import { gbifFetchUrl } from '../research/adapters/gbif.mjs'
import { candidatesDoc, entityRecord, lockEntity, subjectOf, summarize } from '../research/entity.mjs'
import { createFetcher } from '../research/fetch.mjs'
import { classifyUrl, idFormatterUrls } from '../research/tiers.mjs'
import { KNOWN_LANGUAGES, createWikidata, referencedQids } from '../research/wikidata.mjs'
import { fetchArticle, htmlToText, sitelinkTitles } from '../research/wikipedia.mjs'
import { sha256 } from '../util/json.mjs'
import { abs, printWarnings, readProjectJson, writeProjectJson } from './common.mjs'

export const SOURCES_DIR = 'work/research/sources'
export const SOURCES_SCHEMA = 'chronicle-sources-index/1'

/** Cached source records (sources/*.json without index.json), sorted by id. */
export function readCachedSources(projectDir) {
  const dir = join(projectDir, ...SOURCES_DIR.split('/'))
  if (!existsSync(dir)) return []
  const out = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json').sort()) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    if (doc && typeof doc.id === 'string' && typeof doc.text === 'string') out.push(doc)
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** sources/index.json: every record without text (and without the raw known-entity texts). */
export function sourcesIndex(sources, warnings = []) {
  return {
    schema: SOURCES_SCHEMA,
    sources: sources.map(({ text, known_texts: _k, ...rest }) => ({ ...rest, bytes: rest.bytes ?? Buffer.byteLength(text) })),
    warnings: [...new Set(warnings)].sort(),
  }
}

const record = (id, fields, text, retrievedAt) => ({
  id,
  url: fields.url,
  final_url: fields.final_url ?? fields.url,
  tier: fields.tier,
  publisher: fields.publisher ?? null,
  lang: fields.lang ?? null,
  retrieved_at: retrievedAt,
  sha256: sha256(text),
  bytes: Buffer.byteLength(text),
  kind: fields.kind,
  ...(fields.adapter ? { adapter: fields.adapter } : {}),
  ...(fields.variant ? { variant: fields.variant } : {}),
  ...(fields.via ? { via: fields.via } : {}),
  text,
  ...(fields.known_texts ? { known_texts: fields.known_texts } : {}),
})

const isHtml = (res) => /html/i.test(String(res.content_type ?? '')) || /^\s*</.test(res.text)

/**
 * A page the Agent read with its own tools (when this machine cannot reach the host): a text file whose
 * first line is `source: <url>`, then a blank line, then the page text copied verbatim (whole page or
 * the sections read). The tier comes from the URL like any other source; the record carries via: agent.
 */
export function readSourceFile(file) {
  let raw
  try { raw = readFileSync(file, 'utf8') } catch { throw new ChronicleError('flag_invalid:source-file', EXIT.input, { reason: 'unreadable' }) }
  const m = /^source:\s*(https?:\/\/\S+)\s*\r?\n(?:lang:\s*(\S+)\s*\r?\n)?\r?\n([\s\S]+)$/.exec(raw)
  if (!m || !m[3].trim()) throw new ChronicleError('flag_invalid:source-file', EXIT.input, { reason: 'format' })
  const host = new URL(m[1]).hostname
  const lang = m[2] ?? (/^zh\./.test(host) ? 'zh-CN' : /^en\./.test(host) ? 'en' : null)
  return { url: m[1], lang, text: m[3].replace(/\r\n/g, '\n').trim() }
}
/** Known-entity items merged from raw wbgetentities responses. */
function knownItems(texts = []) {
  const items = {}
  for (const text of texts) {
    try { Object.assign(items, JSON.parse(text)?.entities ?? {}) } catch { /* skipped */ }
  }
  return items
}

/** Offline research: rebuild entity.json and known-entities.json from the cached records only. */
function offlineResearch(ctx, { qid }) {
  const sources = readCachedSources(ctx.projectDir)
  if (!sources.length) throw new ChronicleError('offline_source_missing', EXIT.input, { reason: 'no_cached_sources' })
  const wd = sources.find((s) => s.kind === 'wikidata')
  if (!wd) throw new ChronicleError('offline_source_missing', EXIT.input, { reason: 'wikidata_source_missing' })
  let entities
  try { entities = JSON.parse(wd.text)?.entities ?? {} } catch { entities = {} }
  const cached = readProjectJson(ctx, 'work/research/entity.json')
  const id = qid ?? cached?.qid ?? (Object.keys(entities).length === 1 ? Object.keys(entities)[0] : null)
  const item = id ? entities[id] : null
  if (!item || 'missing' in item) throw new ChronicleError('offline_source_missing', EXIT.input, { reason: 'entity_not_cached', qid: id ?? null })
  const s = subjectOf(item)
  if (s === 'unsupported') throw new ChronicleError('subject_undetermined', undefined, { qid: id, candidates: [summarize(item)] })
  if (ctx.brief.subject && s !== ctx.brief.subject) throw new ChronicleError('entity_subject_mismatch', undefined, { qid: id, subject: ctx.brief.subject, candidates: [summarize(item)] })
  for (const url of ctx.flags['add-source'] ?? []) {
    if (!sources.some((x) => x.url === url || x.final_url === url)) throw new ChronicleError('offline_source_missing', EXIT.input, { url })
  }
  const lockRule = qid ? 'qid' : cached?.qid === id ? cached.lock_rule ?? 'unique' : 'unique'
  const entity = entityRecord(item, { lock_rule: lockRule, alternatives: cached?.qid === id ? cached.alternatives ?? [] : [], now: ctx.now().getTime() })
  const warnings = []
  let known
  if (Array.isArray(wd.known_texts)) known = buildKnownEntities(knownItems(wd.known_texts))
  else {
    known = readProjectJson(ctx, 'work/research/known-entities.json')
    if (!known) {
      known = buildKnownEntities({})
      warnings.push('known_entities_missing')
    }
  }
  return { entity, known, sources, warnings }
}

/** Online research through the keyless public-read fetcher (robots.txt, tier allowlist, DNS guard). */
async function onlineResearch(ctx, { qid }) {
  const { brief, flags, lang, log } = ctx
  const fetcher = createFetcher({ fetch: ctx.fetch, ...(ctx.lookup ? { lookup: ctx.lookup } : {}) })
  const wikidata = createWikidata({ fetcher, onRetry: (info) => log.error(`warning research_retry:${info.attempt}`) })
  let lock
  try {
    lock = await lockEntity({ wikidata, topic: brief.topic, qid, subject: brief.subject, lang, log: (line) => log.error(line), now: ctx.now().getTime() })
  } catch (e) {
    if (e instanceof ChronicleError && e.code === 'entity_ambiguous') {
      writeProjectJson(ctx, 'work/research/candidates.json', candidatesDoc({ topic: brief.topic ?? null, candidates: e.details.candidates ?? [] }))
      for (const c of e.details.candidates ?? []) log.log(`${c.qid}  ${c.label?.[lang] ?? c.label?.en ?? ''}  ${c.description?.[lang] ?? c.description?.en ?? ''}  sitelinks ${c.sitelinks}  ${c.subject}`)
    }
    throw e
  }
  const { entity, item } = lock
  const retrievedAt = ctx.now().toISOString()
  const sources = []
  let n = 0
  const nextId = () => `s${String(++n).padStart(2, '0')}`
  // 1. Wikidata (raw entity response) + known-entity responses.
  const main = await wikidata.getEntities([entity.qid])
  const knownIds = referencedQids(item)
  const knownResp = knownIds.length ? await wikidata.getEntities(knownIds, { props: 'labels|aliases', languages: KNOWN_LANGUAGES }) : { entities: {}, responses: [] }
  const wdText = main.responses[0].text
  sources.push(record(nextId(), { url: main.responses[0].url, final_url: main.responses[0].final_url, ...classifyUrl(main.responses[0].url), kind: 'wikidata', known_texts: knownResp.responses.map((r) => r.text) }, wdText, retrievedAt))
  const known = buildKnownEntities(knownResp.entities)
  // 2. Wikipedia zh (zh-hans), en, then native-language editions.
  const titles = sitelinkTitles(item)
  const native = [...new Set((entity.native_names ?? []).map((nn) => String(nn.language ?? '').split('-')[0]).filter((l) => l && l !== 'zh' && l !== 'en'))]
  for (const wl of ['zh', 'en', ...native]) {
    if (!titles[wl]) continue
    const a = await fetchArticle({ fetcher, lang: wl, title: titles[wl] })
    if (!a.ok || !a.text) continue
    sources.push(record(nextId(), { url: a.url, final_url: a.final_url, tier: a.tier, publisher: a.publisher, lang: wl === 'zh' ? 'zh-CN' : wl, kind: 'text', variant: a.variant }, a.text, retrievedAt))
  }
  // 3. Tier-1 sources from Wikidata external identifiers (formatter URLs from the allowlist).
  const add = async (url, { adapter = null, langHint = null } = {}) => {
    if (!url || sources.some((s) => s.url === url)) return
    const res = await fetcher.get(url, { accept: adapter ? 'application/json' : 'text/html, text/plain;q=0.9' })
    if (!res.ok) return
    const text = adapter ? res.text : isHtml(res) ? htmlToText(res.text) : res.text
    if (!text) return
    sources.push(record(nextId(), { url, final_url: res.final_url, tier: res.tier, publisher: res.publisher, lang: langHint, kind: adapter ? 'adapter' : 'text', adapter }, text, retrievedAt))
  }
  const ext = entity.external_ids ?? {}
  if (ext.P1417) await add(idFormatterUrls('P1417', ext.P1417)?.fetch, { langHint: 'en' })
  if (ext.P497) await add(cbdbFetchUrl(ext.P497), { adapter: 'cbdb' })
  if (ext.P757) await add(idFormatterUrls('P757', ext.P757)?.fetch, { langHint: 'en' })
  if (ext.P846) await add(gbifFetchUrl(ext.P846), { adapter: 'gbif' })
  // 4. --add-source URLs: the Agent searches without limits with its own tools and passes the pages
  //    worth reading; each one is fetched here (robots, tiers, DNS guard) and becomes a source record.
  for (const url of flags['add-source'] ?? []) await add(url)
  // 5. Pages the Agent read with its own tools: --source-file flags plus every *.txt in the project's
  //    sources/ folder (kept there so a later `all` without flags still reads them).
  const folder = join(ctx.projectDir, 'sources')
  const kept = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.txt')).sort().map((f) => join(folder, f)) : []
  for (const file of [...(flags['source-file'] ?? []), ...kept]) {
    const doc = readSourceFile(file)
    if (sources.some((x) => x.url === doc.url)) continue
    sources.push(record(nextId(), { url: doc.url, ...classifyUrl(doc.url), lang: doc.lang, kind: 'text', via: 'agent' }, doc.text, retrievedAt))
  }
  const warnings = [...fetcher.warnings]
  warnings.push(...fetcher.warnings.filter((w) => !warnings.includes(w)))
  return { entity, known, sources, warnings }
}

/** @param {object} ctx stage context (see state.mjs runStage) */
export async function run(ctx) {
  const { brief, flags, lang, log } = ctx
  const qid = flags.qid ?? brief.qid ?? null
  if (qid && brief.topic && flags.qid && brief.qid && flags.qid !== brief.qid) log.error(`warning topic_qid_label_differs:${flags.qid}`)
  const r = flags.offline ? offlineResearch(ctx, { qid }) : await onlineResearch(ctx, { qid })
  const warnings = [...r.warnings, ...loadKnownEntities(r.known).warnings]
  if (!flags.offline) {
    // Replace the cached records with this run's records.
    rmSync(abs(ctx, SOURCES_DIR), { recursive: true, force: true })
    for (const s of r.sources) writeProjectJson(ctx, `${SOURCES_DIR}/${s.id}.json`, s)
  }
  writeProjectJson(ctx, `${SOURCES_DIR}/index.json`, sourcesIndex(r.sources, warnings))
  writeProjectJson(ctx, 'work/research/entity.json', r.entity)
  writeProjectJson(ctx, 'work/research/known-entities.json', r.known)
  if (!r.sources.some((s) => s.tier === 1)) warnings.push('no_tier1_source')
  printWarnings(ctx, [...new Set(warnings)].sort())
  log.log(t(lang, 'stage.research_done', { qid: r.entity.qid, label: r.entity.label?.[lang] ?? r.entity.label?.en ?? '', count: r.sources.length }))
  const outputs = ['work/research/entity.json', 'work/research/known-entities.json', `${SOURCES_DIR}/`]
  return { status: 'done', outputs }
}
