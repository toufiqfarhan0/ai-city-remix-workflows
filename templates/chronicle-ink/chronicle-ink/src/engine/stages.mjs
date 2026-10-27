// Stage table: required and optional upstream stages, declared inputs (for inputs_sha256) and the usual
// output paths. Shared by cli.mjs, state.mjs, project.mjs (--fixture) and the report. Data only.
//
// No stage calls a model. Research reads keyless public pages; every piece of writing (claims, the
// shot list and captions, scene code, entailment and visual self-review) is done by the Agent that reads
// SKILL.md, through the awaiting points of facts, script and scenes.
//
// inputs.files: project-relative paths; a trailing '/' hashes a whole directory tree. Absent files and
//   directories count as null.
// inputs.brief: brief fields (normalised, defaults filled in).
// inputs.style: dotted style-pack paths.
// inputs.options: CLI options (normalised, see stageOptions in state.mjs).
/** Order of `all` (doctor is not a pipeline stage). */
export const STAGE_ORDER = Object.freeze(['research', 'facts', 'script', 'timeline', 'music', 'scenes', 'render', 'check', 'report'])
const s = (def) => Object.freeze({ required: [], optional: [], outputs: [], ...def, inputs: Object.freeze({ files: [], brief: [], style: [], options: [], ...def.inputs }) })
export const STAGES = Object.freeze({
  research: s({
    inputs: { files: ['sources/'], brief: ['topic', 'qid', 'subject'], options: ['qid', 'add-source', 'source-file'] },
    outputs: ['work/research/entity.json', 'work/research/known-entities.json', 'work/research/sources/'],
  }),
  facts: s({
    required: ['research'],
    inputs: { files: ['work/research/entity.json', 'work/research/known-entities.json', 'work/research/sources/', 'work/facts/claims.agent.json'], brief: ['subject'] },
    outputs: ['work/facts/claims.json', 'work/facts/facts.json', 'work/facts/hints.json'],
  }),
  script: s({
    required: ['facts'],
    inputs: {
      files: ['work/facts/facts.json', 'work/research/entity.json', 'work/research/known-entities.json', 'script.json', 'work/script/entail.agent.json'],
      brief: ['lang', 'seconds', 'aspect', 'subject', 'structure', 'angle', 'audience'],
      style: ['music', 'captions', 'typography'],
    },
    outputs: ['script.json', 'work/script/gate.json'],
  }),
  timeline: s({
    required: ['script'],
    inputs: { files: ['script.json'], brief: ['seconds', 'aspect', 'lang'], style: ['music', 'captions', 'sfx'] },
    outputs: ['work/timeline.json', 'out/captions.vtt'],
  }),
  music: s({
    required: [],
    inputs: { files: ['music/'], brief: ['seconds', 'style'], style: ['music'] },
    outputs: ['work/music/theme.wav', 'work/music/beatmap.json'],
  }),
  scenes: s({
    required: ['timeline'],
    inputs: { files: ['work/timeline.json', 'script.json', 'scenes/', 'geo/basemap.json', 'geo/photos.json', 'geo/photos/', 'music/track.json', 'voice/voice.json'], brief: ['aspect', 'lang', 'style'], style: ['id', 'css', 'kit', 'assets_sha256', 'palette', 'typography', 'ident', 'captions'] },
    outputs: ['work/scenes/project/', 'work/scenes/scan.json'],
  }),
  render: s({
    required: ['scenes', 'music'],
    inputs: { files: ['work/scenes/project/', 'work/music/theme.wav', 'work/timeline.json', 'music/track.json', 'voice/'], style: ['sfx'], options: ['quality'] },
    outputs: ['work/render/picture.mp4', 'work/render/mix.wav', 'work/render/render.json', 'out/film.mp4'],
  }),
  check: s({
    required: ['render'],
    inputs: { files: ['out/film.mp4', 'work/timeline.json', 'work/music/beatmap.json', 'work/render/render.json', 'work/review.json'], options: ['strict'] },
    outputs: ['work/check.json', 'out/sheet.jpg', 'out/joins.jpg'],
  }),
  report: s({
    required: ['facts'],
    optional: ['script', 'timeline', 'music', 'scenes', 'render', 'check'],
    inputs: {
      files: ['work/facts/facts.json', 'script.json', 'work/script/gate.json', 'work/timeline.json', 'work/music/beatmap.json', 'work/scenes/scan.json', 'work/check.json', 'work/review.json', 'out/film.mp4', 'voice/voice.json'],
      brief: ['lang'],
      options: ['reviewed'],
    },
    outputs: ['out/report.json', 'out/report.en.html', 'out/report.zh-CN.html'],
  }),
})
/** Required upstream stages of `name`. */
export function requiredUpstream(name, _brief = {}, table = STAGES) {
  return [...(table[name]?.required ?? [])]
}
/** Every stage that lists `name` as a (required or optional) upstream, transitively. */
export function downstreamOf(name, table = STAGES) {
  const out = new Set()
  const visit = (n) => {
    for (const [other, def] of Object.entries(table)) {
      if (out.has(other)) continue
      if ([...def.required, ...(def.optional ?? [])].includes(n)) {
        out.add(other)
        visit(other)
      }
    }
  }
  visit(name)
  return [...out]
}
