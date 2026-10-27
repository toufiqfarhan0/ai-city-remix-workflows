# Scene and film method

## Shared architecture

`assets/stone-stars` is the executable specification: a Vite project with vanilla Three.js (no framework code at runtime). One world module serves the live page and the film; input, the two layouts and deterministic capture are adapters around it.

| File | Role |
| --- | --- |
| `index.html`, `src/main.ts`, `src/style.css` | Entry, styles and bundled fonts; Skill identity in `src/config.ts` |
| `src/scene/app.js` | Layouts, controls, tour clock, landmark card, capture API |
| `src/scene/config.js` | Film duration, the four chapters, light stops, island views and film camera keyframes |
| `src/scene/world.js` | Renderer, lights, palettes, traffic, walkers, stars; `renderAt(t)`, `renderView(view, light, motion)`, `filmView(t)`, `resize(w, h)` |
| `src/scene/landmark.js` | The centrepiece; returns `{ group, hitTarget, animate(t), stats, lightingMaterials, views }` |
| `src/scene/village.js` | Island, ring road (`roadCurve`), houses, plaza and fountain, trees, flowers, clouds |
| `src/scene/score.js` | The bundled score, decoded from inlined bytes, gesture-gated and muted by default |
| `src/i18n/strings.json` | Every visible string, English and Simplified Chinese (same keys) |
| `scripts/shoot.mjs`, `scripts/record.mjs` | Verification and film export from the single-file build |

`npm run dev` serves the scene, `npm run build:single` writes `dist-single/index.html` (one offline file with fonts, score and the third-party notices as a comment), `npm run shoot` verifies it and `npm run record` exports the film.

## Replacing the landmark

The landmark stands on the island origin, faces +Z and must fit the village clearance (x −9..9, z −10..11). Keep it the tallest and most detailed object, with a readable silhouette from the opening view. Return:

- `group`: all geometry; repeated details as `InstancedMesh`.
- `hitTarget`: a mesh that covers the whole landmark and is never drawn, used for the click-to-open card. The sample uses a box with `new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })`, added to `group`. Size it to the new silhouette; a box that is too small makes clicks on the upper storeys miss.
- `animate(t)`: small motions (finials, bells, halos) as a pure function of `t`. No `Math.random`, no clocks.
- `lightingMaterials`: an array of `MeshStandardMaterial`s with an `emissive` colour (windows, glass, lanterns, star). Every frame `world.js` sets each one's `emissiveIntensity` to the night glow (about 0.35 by day, 0.7 at golden hour, 2.5 at starlight) times `material.userData.glowScale` (default 1), and to 0 when Lanterns is off. Use `glowScale` (for example 0.4 for paper screens, 1.5 for lanterns) to make some lights brighter than others; give each group its own material.
- `views`: camera anchors for chapters 02 and 03, in world units (Y up):
  ```js
  views: {
    facade: { target: [x, y, z], from: [x, y, z], hold: [x, y, z] }, // main entrance and its detail
    crown:  { target: [x, y, z], from: [x, y, z], hold: [x, y, z] }, // the top of the landmark
  }
  ```
  `target` is the point the camera looks at; the film moves the camera from `from` to `hold` during the chapter, and the chapter buttons use `hold`. Keep `hold` close to `from` (a slow push, 1–3 units), point `target` at the feature itself and keep the camera outside the landmark's bounds. Check the whole move, not only its ends (see verification.md): an anchor that frames the hold well can still clip a finial halfway.
- `stats`: plain counts merged into `inspect().facts`. `spires` is read by the tests and the reports: set it to the number of vertical crowns (towers, spires, pagoda finials, domes; at least 1). Add your own fields freely (for example `tiers`, `eaves`).

Triangle budget: `shoot` accepts 100,000 to 3,000,000 rendered triangles in the opening view. The sample is about 290,000 (the village is about 120,000 of that); a detailed landmark of 80,000–400,000 triangles is comfortable. Instance every repeated part: a few hundred `InstancedMesh` draws cost far less than thousands of meshes.

## Re-theming checklist

The village and interface were authored for a Mediterranean daydream. For another city, go through these before recording:

- `village.js`: `wallPalette`, `roofPalette`, the barrel and gable roof shapes, arched windows and doors (`archGeometry`), striped awnings, chimneys, cypresses and broad trees, flower colours, the fountain and the water rill. Replace what does not belong; keep `houseSpecs` positions, the road curve and the seeded random so nothing enters the clearance.
- `strings.json` (both languages): the title, wordmark, volume line, eyebrow, headline, notes, scene caption, the four chapter titles and texts, the four journey stops, the landmark card (`cardTitle`, `cardText`, `cardChips`) and the hints that name the landmark ("Click the basilica").
- `index.html`: `<title>` must equal `strings.en.title` (the page sets `document.title` at runtime, and the Skill's tests compare both).
- `style.css`: the paper, card and clay accent colours (`--paper`, `--card`, `--clay`). If you change `--paper`, change `PAPER` in `world.js` too.
- `world.js` palettes (`DAY`, `GOLDEN`, `STARS`) and `NIGHT_BG` only if the city needs a different light; tune from a fixed view.

Change the village only where the city calls for it. Its houses, road and plaza are laid out around the clearance; keep the seeded random so the layout never changes between loads.

## Light

One value in [0, 1] drives the background, sun, hemisphere and rim lights, fog, exposure, stars and every emissive window: 0 daylight, 1/3 golden hour, 2/3 blue hour, 1 starlight (`lightStops` in `config.js`, palettes in `world.js`). The canvas background stays paper-coloured up to golden hour and darkens to `NIGHT_BG` by starlight, so the stars and lit windows read at night. Tune palettes from a fixed view. Lanterns off sets the emissive windows and the plaza fill light to zero at any light value.

## Film

24 s, four 6 s chapters: `garden` (the island approach), `facade`, `crown`, `stars` (the island at night). Camera keyframes come from `filmPoses()` in `config.js` and ease with a quintic smoothstep; light moves from golden hour to starlight between 9 and 21 s; cars, walkers, clouds and the fountain use the same `t`. The editorial overlay (chapter card, journey bar, viewfinder) follows the time. If you change the duration, update `duration`, the keyframes, `filmLight` and the shoot checks together.

## Two modes, one world

- Film mode: the tour time sets everything (`renderAt`). Play, Reset, the journey bar and `script(t)` enter it.
- Free mode: the visitor's camera, light value and life clock (`renderView`). Chapter buttons, orbit, zoom and the light slider enter it, continuing from the current frame. Pause life freezes the life clock.

## Layouts

- Full: the 1920×1080 editorial composition scaled into the window (desktop windows of at least 900×520, and the film). At scale 1 and DPR 1 the canvas backing store is exactly 1190×790.
- Compact: `?embed=1`, phones and small windows. The canvas fills the frame; a dock holds the chapter buttons, play, reset, the light slider, lanterns and sound; zoom buttons sit on the scene.

## Capture contract

`window.__scene = { slug, version, ready, cover: { fps: 30, frames: 720, posterAt: 1 }, inspect(), act(name, arg), pointer(nx, ny), press(), release(), seek(t) }`, plus `script(t)` and `step(n, dt)` with `?capture=1`. `inspect()` returns `{ quality, audio, errors, facts, camera }`; `audio` is `uninitialised` until a gesture, then the AudioContext state. `act` accepts `chapter` (0–3), `light` (0–1), `seek` (s), `zoom` (factor), `lanterns`, `life`, `sound` (optional boolean), `card` (false closes), `reset`, `play` and `pause`. Inside an iframe the page posts `stone-stars-city:ready`, or `stone-stars-city:error` with `code: 'webgl'`. Under `?capture=1` the masthead controls, zoom buttons and light controls are hidden so the film shows the editorial layout only.

## Adaptation order

Make the landmark readable in the opening view, then set its two camera anchors and check chapters 02 and 03 with `script(8)` and `script(17)`, plus the moves into them (`script(6.5)`, `script(13)`, `script(14.5)`). Tune the night palette with lanterns on and off. Rewrite the strings in both languages. Build, shoot, record and watch the whole film.
