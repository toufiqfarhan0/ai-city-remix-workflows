// Mux and metadata (design §10.3): picture + mix -> MP4 (AAC 192k 48 kHz) with the AIGC metadata.
// The implicit label is one `AIGC` item whose value is a JSON string built from
// engine/data/aigc-metadata.json (GB 45438-2025 field set; `verified` says whether it was checked
// against the standard text). No path, account or run id ever enters the metadata. Pure.
import { readFileSync } from 'node:fs'
import { sha256 } from '../util/json.mjs'

export const AIGC_COMMENT = 'AI-generated content (AIGC). Visuals and music were drawn and synthesized by code written by an AI agent; no image, voice or music model was used.'

/** The AIGC field specification (engine/data/aigc-metadata.json). */
export const loadAigcSpec = () => JSON.parse(readFileSync(new URL('../data/aigc-metadata.json', import.meta.url), 'utf8'))

/** ContentProducer value. */
export const contentProducer = (skill, version) => `SandBase Lab ${skill} ${version}`

/** ProduceID: first 32 hex digits of sha256(timeline.json bytes). */
export const produceId = (timelineBytes) => sha256(timelineBytes).slice(0, 32)

/**
 * The AIGC JSON value: every field of the spec in order; propagator and reserved fields are empty
 * strings (we are not a distribution platform).
 */
export function aigcValue({ spec = loadAigcSpec(), skill = 'chronicle-ink', version, timelineBytes }) {
  const values = { Label: spec.label_value ?? '1', ContentProducer: contentProducer(skill, version), ProduceID: produceId(timelineBytes) }
  return JSON.stringify(Object.fromEntries(spec.fields.map((f) => [f, values[f] ?? ''])))
}

/** Compliance wording of the implicit label for the report (§10.3). */
export function implicitLabelText(spec = loadAigcSpec()) {
  return spec.verified ? `AIGC field per ${spec.standard}${spec.clause ? ` §${spec.clause}` : ''}` : 'AIGC field per GB 45438 (field set not verified)'
}

/**
 * ffmpeg argv: -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k (320k for an opt-in music track) -ar 48000 -shortest
 * -movflags +faststart+use_metadata_tags, comment / AIGC / title metadata (input metadata dropped).
 */
export function muxArgv({ picture, audio, output, title, aigc, seconds = null, audioBitrate = '192k' }) {
  return [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', picture, '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', audioBitrate, '-ar', '48000', '-ac', '2', '-shortest',
    ...(seconds ? ['-t', String(seconds)] : []),
    '-map_metadata', '-1', '-movflags', '+faststart+use_metadata_tags',
    '-metadata', `comment=${AIGC_COMMENT}`, '-metadata', `AIGC=${aigc}`, '-metadata', `title=${title}`,
    output,
  ]
}
