# Recipe, assembly and film

## Recipe (`src/landmark/recipe.json`, schema `landmark-recipe/1`)
- `palette`: colours of the materials `stone`, `trim`, `mortar`, `accent`, `dome`, `roof`, `void`, `water`, `ground`.
- `site.ground`: `water` (the landmark stands in a river with a quay behind) or anything else (a plaza).
- `stages`: `{ id, from, to, label: { en, zh-CN } }`, consecutive windows of the build (0–1). The page lists them.
- `parts`: each has a `type`, a `stage` and optionally `window: [a, b]` (a sub-range of its stage) and `lift` (metres a piece falls).
  - `platform` x, z, w, d, y, h, course, step, batter: slabs in courses (foundations, terraces, roof decks).
  - `walls` footprint, open, base, height, thickness, course, block, openings: courses of blocks in running bond with a backing core per course; corners interlock; `open: true` leaves out the closing edge. Openings `{ edge (index or "all"), at (fraction or list with repeat), y, w, h, arch }` are left out of the coursing; arched ones get voussoirs.
  - `battlement` footprint, open, y, merlon, gap, h, depth, shield: merlons with caps, optional shields.
  - `stringcourse` footprint, open, y, h, out: a projecting trim band.
  - `turret` at, y, r, h, ribs, domeRise: corbel rings, a coursed drum with a slit, a cornice, a ribbed dome and a finial.
  - `loggia` of (a walls part id) or footprint, edge, y, bays, h, out, margin: slab, balustrade, columns, voussoir arches and a roof slab.
  - `roof` x, z, y, w, d, h, courses: a stepped pyramid or spire with a finial.
  - `figure` base, sections [{ y, rx, rz, cx, cz }], band, segments, folds, foldDepth, foldsTo, opens: a hollow draped figure of thin plates around interpolated elliptical sections, with fold ridges near the hem.
  - `limb` points, radii, ring, segments: a tube of plates along a polyline (an arm, a torch handle).
  - `frame` x, z, base, height, w, step: an iron pylon of four posts with ties and braces. `armature` base, sections, step, spokes, inner: bars from the pylon out to the shell.
  - `rays` at, count, length, from, to, tilt: a crown of tapering rays. `slab` at, w, h, d, ry, rz: a tablet of plates. `flame` at, r, h: a cup and an emissive flame that brightens at dusk.
  - Every part may set `explode` (metres moved at full dismantle). Figure plates facing `cut` (a yaw, default the front; null keeps the shell whole) get a cut key instead: they slide off and vanish top to bottom as the dismantle value passes, while the far side, limbs, crown, tablet and torch stay.
- `site.ground`: `water`, `island` (lawn in open water) or a plaza. `floodlights`: [[x, z], …] for the dusk spots.
- `copy`: title, place, eyebrow, text, disclaimer and view labels in both languages.

## Assembly
`kit.js` turns the recipe into pieces (`{ shape, mat, p, s, rx, ry, rz, tint, start, dur, lift }`). Within a part, pieces are ranked by course and then position around the footprint, and spread over the part's window. `assembly.js` draws one instanced mesh per shape and material with the schedule as an instanced attribute. The shader collapses a piece before its start and drops it from `lift` metres above its seat in world space with a short settle; the shadow depth material uses the same code. Two more instanced attributes hold each piece's dismantle direction and cut key; `uExplode` (0–1) moves pieces along their direction, or slides cut pieces off and collapses them once it passes their key, in the same shader, colour and depth alike. Shadows are refreshed only when the build, light or dismantle value changes.

## Film (`src/landmark/film.json`)
`duration`, `build: [t0, t1]` (the build runs linearly in this window), `light: [[t, value], …]` (eased between keys), `explode: [[t, value], …]` (optional, the same easing), `cover: { frames ≤ 900, posterAt }`, `shots` (`center` as a point or `[from, to]`, `yaw`, `elev`, `distance` as `[from, to]`) and `views` (the presets the page offers; a preset may set `explode`). Everything is a pure function of time.
