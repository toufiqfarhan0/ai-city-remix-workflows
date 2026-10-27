# Style `model` (white model, projected history)


`--style model` (or `"style": "model"` in `brief.json`). A white plaster table model of the city in a
dark studio, built from OpenStreetMap streets and building footprints; history is projected onto it as
light. One scene, `model-city` (`assets/styles/model/exemplars/model-city.js`), carries the whole film:
copy it into the project's `scenes/` (the project copy is what renders; copy it again after a Skill
update).

## Two scenes

- `city-3d` (recommended, `assets/styles/model/exemplars/city-3d.js`, kit `city3d-kit.js`): the real
  city in WebGL. Every OpenStreetMap building footprint (ways and multipolygon relations, courtyards
  as holes) is extruded to its height: the OSM `height` / `building:levels` tag, a landmark's Wikidata
  height (P2048) on its own footprint, else the median of mapped buildings in the same 300 m cell
  (shown as such in the legend). Streets, water and rail are painted on the ground, which fills the
  frame and fades into fog: there is no floating plate. The camera flies through the city on one
  continuous Catmull-Rom path through the shots' key views (`path: [prev, from, to, next]`), so a cut
  never jumps. Keep the camera calm: one slow orbit (yaw a few degrees per shot, never back) and only
  a few changes of altitude per film (down for the founding, out as the city grows, down for the
  monuments, out for the walls, a slow rise to the end). Alternating close and far shots reads as
  restless; stay at 2.4–5 km and let the effects carry the motion.
  Era extents are coloured light on the buildings while the rest of the city dims; `tint` and `dim`
  ranges hand over smoothly between shots. Renders at about 0.8 s per frame on the CPU path.
  Effects of `city-3d`:
  - Opening: the camera zoom eases in and out (a trapezoid speed profile that ends exactly where the
    shot path takes over, so there is no jolt at the hand-over); the globe turns to the city first, a flat land map takes over once the globe is larger
    than the frame (both read the same raster land mask, so coastlines never flicker), the land
    darkens towards the stage tone, and the 3D city dissolves in top-down at the same scale (no
    separate 2D city layer, which would flash and vanish).
  - Captions tell the city's story; never explain the technique ("white model", "projected light").
  - Every effect should start on the beat where the narration names it: the river flows when the
    river is named, streets light up when the city spreads, the extent outline slides when an era
    begins.
  - Time on the buildings: landmarks rise on their year (`chronology.places[].born`, else the
    place's Wikidata inception, shown as "built … · Wikidata" on its callout); with
    `chronology.modern { from, to, outside: [area ids] }` every building outside the historic extents
    rises between the two years, nearer ones first, so the modern city grows outwards. Inside the
    old city today's buildings stand for the whole film: the history is projected onto today's model.
  - Walls glow while built; `until` dissolves a wall into sparks; `breach { place, year, r_km }`
    blows a gap open with a burst of sparks, and the wall flares again for about 12 years around the
    breach so it stands out where it runs along an era's lit edge.
  - `morph: { from, to, beat }`: the light spreads out of the old extent (or withdraws into the new
    one) at one speed in every direction, along a distance field of the real outlines, with a bright
    front; it never leaves the new outline, whatever its shape (a long island, a bent coast). The new
    edge only lights once the light reaches it, and extents an entered layer replaced stay dark; arrows
    in the direction it moves, the old outline left as a dashed line, and "The city grows" or "The
    city shrinks" (decided by the two areas' km², which come from the map) with "from → to".
  - `spread: [{ from, area?, r_km, color?, kind?: "fire", beat, beats }]`: streets and roads light up
    outward from a place, street by street with a bright front (the city spreading over its hills,
    or a fire running through the streets); `area` keeps it inside an era's extent.
  - `found: { place, beat }`: a column of light and ripples where the city began. With `reveal: true` (a
    founding shot right after the `clean` shots) the extents that begin in the shot come up with the
    column instead of popping in at the cut.
  - The city's dimming follows the era light, so it never steps when an era fades out; a shot with its
    own `dim: [a, b]` should start `a` where the previous shot ends (about 0.3 once every era has
    faded, 0.5 while one is lit).
  - `river: true`: the main river's channel brightens from upstream, then streaks of light run
    downstream along it (in the OSM point order, which runs downstream). Fire scars spread a
    flickering front with flames and char the inside.
  - `axis: [{ id, beat }]` with `chronology.axes { id: { from, to: [ids], title, sub } }`: beams drawn
    from a hub, a pulse running along them, sun-like seals at the ends.
  - Focus `kind: "emblem"` (`glyph`, `title`, `sub`): a medallion floating over its place in a beam.
  - Focus `kind: "scar"` with `collapse: true`: buildings inside the burnt or destroyed area fall as the
    front spreads; the next shot's `rebuild: { id, beat, beats }` fades the scar and raises them again.
  - `rewind: [2026, y]` (opening shot after the globe): time runs back on the buildings, newest first,
    so the city sinks to its starting point before the first historic shot; no jump at the cut.
  - A layer with `morph: true` gets no light before its first year, so it only appears through the
    `morph` that grows it out of the previous extent (never big, then small, then big again).
  - `heights: true` measures the tallest building in view and names it (a landmark's label and
    "tallest in view · Wikidata", else "Tallest building in view · OpenStreetMap").
  - `chronology.modern.core { from, to }` makes the old city's buildings rise too (for a first town
    that was small and low), and `modern.tall { min_m, from, to }` raises mapped buildings above
    `min_m` later the taller they are, so a skyline grows instead of standing over the first town.
  - `chronology.river` (or `river: { name }` on a shot) picks the river by OSM name and joins its
    pieces; otherwise the longest river is used.
  - Walls without OpenStreetMap ways: give `geo/places.json` `walls[].line: [[lat, lon], …]` (drawn as
    one path, recorded as `source: agent-line`).
  - `chronology.places[].span`: years a landmark takes to rise from its `born` year (default 12).
  - Sea and water: the coastline (OSM `natural=coastline`) is closed into a sea by a flood fill from
    its water side and painted with rivers and lakes; water never takes era light or a morph front, so
    a coastal city's extents stop at the shore. The ground fades into fog only near the edge of
    `ground_km`, so far landmarks (a bridge across a strait) stay visible.
  - Height data: `geo.mjs` prints `heights_sparse` when fewer than 20% of the buildings have a mapped
    height and writes `heights_share` to the basemap; the `heights` legend shows that share. Skip
    `heights` shots for such cities (the tallest "mapped" building is often not the real tallest).
  - Walls: when an OSM `match` finds no ways (names differ by language), the `line` is used instead.
- `model-city` (older): a pre-rendered flat model that only zooms.

## What the viewer sees

- A globe fly-in, then the white plaster model, which dims to graphite (`dim: [0, 1]`, with
  `clean: true` for the bare model): "we project the rings of this city onto it with light".
- The model never moves inside a camera view: each view (`chronology.camera`, `chronology.views`)
  is rendered once; shots only zoom into it, and a zoomed part slides into the clear stage right of
  the left block and above the captions (`chronology.stage`). Cut to another view (`view: 'low'`) for
  oblique moments such as walls.
- Each era's extent shows the white model through a coloured mask with a glowing edge (soft
  spotlights for uncertain settlements); a white halo sweeps out when an era begins (`halo`); ended
  eras stay as fine white rings; walls glow red while they are built.
- Landmarks light up their own footprints with a closing ring and a two-line callout; fires and sacks
  spread a red ring with embers. Photo cards are optional (`card: true` in the focus item).
- `heights: true` extrudes every building to its OpenStreetMap height (× `height_exaggerate`) coloured
  indigo → magenta, with a legend; unmapped buildings stay low and grey.
- The left block reads "01 — era", a big thin year (or a figure with `big`), a white line and a grey
  note; the closing view (`rings: true`) names every ring with its first year and the end card sits on
  the left with the data credits.

## Data: `geo/places.json` → `chronology`

`node scripts/geo.mjs --project <p>` copies the block into `geo/basemap.json`. Shape:

| Key | Meaning |
|---|---|
| `camera` | `{ x, y, km, pitch, yaw, ox, oy }`: look-at point in km from the centre, view width, tilt, rotation, screen position of the look-at point. Frame the largest era extent above the caption band (about y < 0.74 H) |
| `views` | named extra cameras (`{ low: {…}, height: {…} }`), each rendered once |
| `height_exaggerate`, `heights_note` | vertical factor and the legend note of `heights` shots |
| `plate_km`, `stage` | half-size of the model plate (keep it inside the fetched building radius); zoom stage |
| `city`, `coords`, `hud` | globe pin label, coordinates line, HUD lines (strings or `{ en, zh-CN }`) |
| `eras` | `[{ code, from, label }]` for the year block |
| `layers` | `[{ area, from, to, color, spot?, fade? }]`: era extents from `areas` (`spot` = soft light for an uncertain settlement) |
| `walls` | `[{ id, from, to, color, glow_years }]` from the OSM walls |
| `places` | `[{ id, from, to?, fade? }]` labels that appear on their years |
| `events` | `[{ year, until?, title, sub?, place?, kind: event|person|scar }]` |
| `focus` | `{ <id>: { place, title, en, photo, kind?, r_km?, ring_km? } }` for `focus` params |

Every date or name on screen must come from a claim or a tier-1 source, like captions.

## Shot params (`model-city`)

`year` · `view` · `zoom` · `globe` · `dim` · `clean` · `halo: { area, beat }` · `heights` · `rings` ·
`river` · `hills` · `focus` · `big: { text, unit, line, note }` · `era_label` (see the header of
`model-city.js`). About 5.5 s (2 bars) per shot
reads well; keep zooms between 1 and about 1.9.

## Photos

`node scripts/photos.mjs --project <p> [--only id,id]` resolves `focus[].photo` (a QID's P18 or a
Commons file name) and downloads it with its author and licence into `geo/photos/` and
`geo/photos.json`. The credit is drawn on the card; never crop it away.

## Music

The style's theme is "Atlas Theme" (D major, I–V–vi–IV, felt piano, pad, sub bass; same 88 BPM beat
map). An opt-in track can replace it: [music-track.md](music-track.md).
