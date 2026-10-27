# Pipeline

`node scripts/chronicle.mjs <stage> --project <dir>`. Each stage records its input hash in `state.json`;
an unchanged stage prints `[stage] up to date`, a changed upstream marks downstream stages stale. No stage
calls a model. Exit codes: 0 ok / awaiting the Agent, 1 internal, 2 input, 3 entity, 4 scene code,
5 public source, 6 fact gate, 7 local processing, 8 strict check, 9 script or plan.

| Stage | Does | Agent writes | Outputs |
|---|---|---|---|
| research | Wikidata QID lock, Wikipedia + tier-1 reads, `--add-source`, `--source-file` | — | `work/research/{entity,known-entities}.json`, `sources/` |
| facts | structured claims + Agent claims, excerpt check, cross-check, fact sheet | `work/facts/claims.agent.json` | `claims.json`, `facts.json`, `hints.json` |
| script | plan on the theme, gate (structure, facts, entailment) | `script.json`, `work/script/entail.agent.json` | `gate.json`, `plan.json`, `claim-lines.json` |
| timeline | shots on downbeats, captions, cards, SFX cues, segments | — | `work/timeline.json`, `out/captions.vtt` |
| music | renders the series theme + exact beat map | — | `work/music/theme.wav`, `beatmap.json` |
| scenes | static scan of scene code, HyperFrames project | `scenes/<name>.js` | `work/scenes/project/`, `scan.json` |
| render | CPU picture, theme + SFX mix, loudnorm, AIGC mux; `--segment` for reviews | `work/review.json` (director) | `out/film.mp4` or `out/segments/<id>.*` |
| check | format, loudness, downbeats, SFX sync, captions, AIGC, re-hooks, gate, scan, review | — | `work/check.json`, `out/sheet.jpg`, `out/joins.jpg` |
| report | report.json + bilingual HTML | — | `out/report.*` |

## Timing model

- Theme: 88 BPM, 4/4, one bar = 240/88 s ≈ 2.727 s. 120 / 150 / 180 s = 44 / 55 / 66 bars exactly.
- A shot is 1–4 whole bars inside one section; shots tile each section; the last outro shot is ≥ 2 bars
  (the end card owns the last 2 bars). All times are frame-quantised (30 fps).
- Transitions overlap the first beats of the incoming shot: ink-bleed and scroll-pan 2 beats, seal-stamp
  1 beat, cut 0.
- Captions: shot start + ½ beat → shot end. Cards: shot start + 1 beat → shot end − ¼ beat; numeric cards
  count up over 2 beats.
- Re-hooks at the starts of intro, build, breakdown, build2, outro, plus a `mid` re-hook while a gap is
  over 35 s. A shot with `rehook: true` must start within 1 bar of each.

## SFX cues

Automatic: every transition (cut / ink-bleed → `transition`, scroll-pan → `scroll`, seal-stamp → `seal`),
the start of each drop (`reveal`, climax), the title (`reveal`, emphasis), each card (`seal`, emphasis) and
its count-up (`count`, emphasis), the end card (`seal`, emphasis). Yours: `sfx: [{ beat, kind, tier,
dur_beats }]` per shot for every key action the scene draws. Kinds: transition, appear, count, seal, route,
reveal, brush, scroll. Tiers: normal, emphasis, climax (louder and more layered). Duplicates of a kind
within ½ beat merge, keeping the higher tier. In scene code, `s.cue(kind, i)` returns the local hit time.

## Scene contract

```js
scene('name', function (g, s) {
  // s.t local seconds, s.u 0..1, s.dur, s.beat, s.bar, s.beat_s, s.W, s.H, s.params, s.size,
  // s.cam { zoom, x, y } from the shot camera, s.cues, s.cue(kind, i), s.kp, s.title, s.lang, s.dir,
  // s.cache(key, w, h, draw) memoised canvas, s.kit (assets/style/ink-kit.js)
})
```

Each file is evaluated in a function that shadows network, clock, storage and randomness globals, inside a
page with `connect-src 'none'`. The scan rejects fetch / XHR / WebSocket / workers / imports / URLs,
`Math.random`, `Date`, `performance`, timers, `eval`, DOM and storage access. Every worker renders an
arbitrary subset of frames: a frame may never depend on the previous one.

## Segment renders

`render --segment s1|…|s5|opening|<section>|<a>-<b>|all` renders a window with the same timeline into
`out/segments/<id>.mp4`, `sheet.jpg` (1 frame per second) and `keyframes/<shot>.jpg`; nothing is recorded
in `state.json`. Review rounds go to `work/review.json` (max 3 per segment).

## Languages

The script holds captions, title, cards and end card per language (`caption.en`, `caption["zh-CN"]`, …).
Two projects with different `brief.lang` can share the same `script.json` and `scenes/`; each gates its own
language. Caption fonts: LXGW WenKai for Chinese, Noto Serif (Latin, Greek, Cyrillic, Vietnamese), Noto
Naskh Arabic, Noto Sans Devanagari; missing glyphs fail with `glyph_missing`. RTL captions get
`dir="rtl"`.
## City maps (outside the stage table)
`node scripts/geo.mjs --project <p>` reads `geo/places.json` and writes `geo/basemap.json` (kilometres
around the centre, y up): `places` (Wikidata P625, or Nominatim/`lat`/`lon`), `areas` (approximate
radii, always tagged "AI illustration"), `rivers`, `water` (bodies ≥ 0.004 km²), `coast`, `roads`
(rank 0 motorway … 3 secondary), `rail`. The scenes stage hashes `geo/basemap.json`, inlines it as
`window.CI_GEO` (scenes: `s.geo`) and adds the OpenStreetMap attribution overlay. The research stage
also reads every `sources/*.txt` file of the project (same format as `--source-file`).

