# Recipe: any city's life story in 3D (style `model`, scene `city-3d`)

The same steps made the Rome, New York and Barcelona samples. Budget: about 2 hours of Agent work, 35–60 minutes
of rendering, $0.3–0.5 if narration and the music track are used.

## 1. Project and sources

```sh
node <skill>/scripts/new-project.mjs --out /abs/films/<city> --qid <Q…> --seconds 150 --film-lang en
# brief.json: add "style": "model"
```

Save 10–20 pages as `sources/<n>-<name>.txt` (first line `source: <url>`, optional `lang: en`, then a
blank line, then the verbatim text). Every fact you want on screen needs one reference institution
(Britannica, UNESCO, a museum in the allowlist) and one more publisher (Wikipedia counts once). When a
site blocks this machine, read it with your own fetch or a SandBase page-parsing tool and keep the text
verbatim. `research` gives every file a source id (`s02`…): read them from `work/research/sources/`
before you write claims, and run `research` again (ids change) whenever you add a file.

## 2. Claims

Write `work/facts/claims.agent.json` with two claims per fact (one per publisher) using the same
predicate and value: `structure_built { object, date }`, `ruled_by`, `wall_built`, `disaster`,
`river`… (the `other` predicate never corroborates). Keep excerpts verbatim and under 30 words.
Run `facts` and keep only the lines whose claims come back `verified`; plan at most two hedged
single-source lines, never in the intro or a drop.

## 3. Geography (`geo/places.json`)

- `center.qid`, `radius_km` 6, `places` by QID (landmarks get their Wikidata height and year), `walls`
  by OSM name (`match`) or by `line`, `areas` as polygons `[[lat, lon], …]` for each era's extent
  (approximations: the film tags them), `fabric { focus, streets_km, buildings_km, builtup_km }`.
  Keep `buildings_km` so the fetched footprints stay under about 60,000 (render time grows with it).
- Run `node <skill>/scripts/geo.mjs --project <p>` and read the printed km positions: they are the
  coordinates of every camera view and effect.
- Then add `chronology`: `city`, `coords`, `hud`, `eras`, `layers` (colour per era, `morph: true` for
  extents that grow out of the previous one), `walls` (years, `until`, `breach`), `places` (label
  years, `modern`, `mark_built`), `events`, `focus` (callouts, scars with `collapse`, emblems), `axes`
  (links between places, e.g. a bridge), `modern { from, to, outside }`, `ground_km`,
  `height_exaggerate`, `heights_note`. Patch both `geo/places.json` and `geo/basemap.json`, or rerun
  `geo.mjs`.

## 4. Shot list

Write `script.json` from a small generator in the project (`gen/shots.mjs`): one row per shot
`[id, section, bars, [y0, y1], params, kind, claims, caption]` plus one key view per shot
`V(x, y, d, pitch, yaw)`; each shot's `path` is `[prev, this, next, after]`. A 150-second film has 27
two-bar shots on the sections intro 2 · verse 6 · build 2 · drop 4 · breakdown 4 · build2 2 · drop2 4 ·
outro 3. The pattern that works:

| Beat | Params |
|---|---|
| Globe to the city, "This is <city> today." | `globe`, `clean`, `grow: [0, 0]` |
| "Its life story begins long ago." | `clean`, `grow: [0, 1]`, `rewind: [2026, <first year>]`, `dim: [0, 0.3]` |
| The river, only when the city's story is about it | `river: true` (set `chronology.river` to its OSM name) |
| The founding | `found: { place }` |
| Each new era | `morph: { from, to }` (+ `focus` on its landmark later in the shot) |
| The city spreading | `spread: [{ from, area, r_km }]` |
| A link between places (bridge, axis) | `axis: [{ id }]` |
| A fire, sack or attack | `focus` on a `scar` (with `collapse`), next shot `rebuild` |
| Landmarks | `focus` (the callout shows "built … · Wikidata") |
| Height today | `heights: true`, `tint` in and out |
| Closing rings, the echo, the question | `rings: true` |

Only use an effect the story needs: a city that began on a hill or a coast does not get a river.
Captions say what the picture shows in plain words (never the technique), each bound to verified
claims; years and names on screen come from claims. Camera: one slow orbit (yaw −4° per shot), stay
between 3 and 7 km, dive closer only for the founding and a few landmarks.

## 5. Sound

Optional, only when the user asks: `music/track.json` with a SandBase music model instrumental
([music-track.md](music-track.md)) and one narration clip per caption ([voice.md](voice.md)).

## 6. Review and render

Render 4–10 s test segments around every effect (`render --segment a-b`), check the contact sheets and
a frame-difference scan for flicker, then `all` for the final film, `check` and `report`.
