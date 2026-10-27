// Typed errors and the process exit-code table. Dependency-free.
//
// Every expected failure is a ChronicleError(code, exit, details). `code` may carry a suffix after the
// first ':' (for example `brief_invalid:seconds` or `claim_unverified:l3:c12`); the part before it is
// the base code that selects the exit status and the i18n message (`err.<base>`).

/** Exit statuses. 0 also covers `awaiting_*` (next step is the Agent) and a finished dry run. */
export const EXIT = Object.freeze({
  ok: 0,
  internal: 1, // unexpected error (anything that is not a ChronicleError); sync.mjs --check drift
  input: 2, // input or environment problem
  entity: 3, // entity cannot be locked to one Wikidata item
  scene: 4, // scene code rejected by the no-network / determinism scan or failed in the browser
  source: 5, // public source read failed (research)
  gate: 6, // fact or visual gate
  local: 7, // local processing, rendering or encoding
  strict: 8, // quality check under --strict
  plan: 9, // script or beat plan does not comply
})

/** Base code -> exit status. */
export const CODE_EXIT = Object.freeze({
  internal_error: EXIT.internal,
  drift: EXIT.internal,

  brief_invalid: EXIT.input,
  seconds_invalid: EXIT.input,
  lang_both_unsupported: EXIT.input,
  flag_invalid: EXIT.input,
  project_inside_skill: EXIT.input,
  deps_missing: EXIT.input,
  stage_missing: EXIT.input,
  stage_stale: EXIT.input,
  offline_source_missing: EXIT.input,
  fixture_unknown: EXIT.input,
  fixture_brief_conflict: EXIT.input,
  project_locked: EXIT.input,
  agent_file_invalid: EXIT.input,
  music_track_invalid: EXIT.input,
  voice_invalid: EXIT.input,
  voice_mismatch: EXIT.gate,
  voice_too_long: EXIT.gate,

  entity_not_found: EXIT.entity,
  entity_ambiguous: EXIT.entity,
  entity_subject_mismatch: EXIT.entity,
  subject_undetermined: EXIT.entity,

  scene_rejected: EXIT.scene,
  scene_missing: EXIT.scene,
  scene_error: EXIT.scene,

  research_failed: EXIT.source,

  claim_unverified: EXIT.gate,
  claim_unbound: EXIT.gate,
  hedge_missing: EXIT.gate,
  number_mismatch: EXIT.gate,
  superlative_unbound: EXIT.gate,
  quote_unsourced: EXIT.gate,
  entailment_failed: EXIT.gate,

  ffmpeg_missing: EXIT.local,
  hyperframes_failed: EXIT.local,
  encode_failed: EXIT.local,
  mux_failed: EXIT.local,
  music_track_decode_failed: EXIT.local,
  voice_decode_failed: EXIT.local,

  check_probe_failed: EXIT.strict,
  loudness_out_of_range: EXIT.strict,
  sync_out_of_tolerance: EXIT.strict,
  sfx_out_of_sync: EXIT.strict,
  aigc_metadata_missing: EXIT.strict,
  review_missing: EXIT.strict,

  script_invalid: EXIT.plan,
  budget_chars: EXIT.plan,
  kp_count: EXIT.plan,
  rehook_gap: EXIT.plan,
  rehook_missing: EXIT.plan,
  glyph_missing: EXIT.plan,
  caption_too_long: EXIT.plan,
  caption_too_fast: EXIT.plan,
  portrait_forbidden: EXIT.plan,
  segment_invalid: EXIT.input,
})

/** The part of a code before the first ':'. */
export const baseCode = (code) => String(code ?? '').split(':')[0]

/** Exit status for a code; unknown codes are internal errors (1). */
export function exitFor(code) {
  return CODE_EXIT[baseCode(code)] ?? EXIT.internal
}

export class ChronicleError extends Error {
  /**
   * @param {string} code     machine code, e.g. `stage_missing:facts`
   * @param {number} [exit]   exit status; defaults to exitFor(code)
   * @param {object} [details] extra data for logs and reports (must not hold secrets)
   */
  constructor(code, exit, details = {}) {
    super(String(code))
    this.name = 'ChronicleError'
    this.code = String(code)
    this.exit = Number.isInteger(exit) ? exit : exitFor(code)
    this.details = details ?? {}
  }
}

export const isChronicleError = (e) => e instanceof ChronicleError
