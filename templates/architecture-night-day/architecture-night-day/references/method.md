# Scene and film method

## Shared architecture

`assets/through-light` is the executable specification: a Vite project with vanilla Three.js (no framework code at runtime). One scene factory serves the live page and the film. Input handling, the two layouts and deterministic capture are adapters around it.

| File | Role |
| --- | --- |
| `index.html`, `src/main.ts`, `src/style.css` | Entry, styles, Skill identity (`src/config.ts`) |
| `src/scene/app.js` | Layouts, controls, tour clock, capture API |
| `src/scene/config.js` | Film duration, light-transition interval, five landmark views and six shots |
| `src/scene/showcase-scene.js` | Three.js scene factory; `renderAt(time)`, `renderView(view, day)`, `resize(w, h)` |
| `detailed-temple.js`, `marble-base.js`, `park-landmarks.js`, `park-setting.js`, `environment.js` | Geometry, procedural textures and sky |
| `src/i18n/strings.json` | Every visible string, English and Simplified Chinese (same keys) |
| `scripts/shoot.mjs`, `scripts/record.mjs` | Verification and film export from the single-file build |

`npm run dev` serves the explorer, `npm run build:single` writes `dist-single/index.html` (one offline file with the third-party notices as a comment), `npm run shoot` verifies it and `npm run record` exports the film. The stock film is 20 s with the light transition from 8.5 to 13.5 s. If you change the duration, update the shot table and `COVER` in `app.js` together.

For another site, replace the subject geometry, material vocabulary, arrangement and copy. Reusing this interface and camera mechanism alone does not validate the architectural accuracy of a new site.

## Camera and composition

- Make the building the subject. Fit it inside the scene viewport, clear of the side panels and the bottom timeline.
- Elevated three-quarter views reveal roof depth and terrace structure; closer oblique views show tile courses and bracket assemblies. Avoid sparse park-wide shots unless requested.
- Camera targets are world-space; the orbit position adds the target offset before `lookAt(target)`.
- During the main night-to-day passage, hold target, radius, azimuth, elevation and field of view. Let sky, light balance, warm lamps, exposure and shadows carry the change.
- Frames narrower than the 1212×730 stage keep its horizontal field of view (vertical FOV up to 80°), so phones see the whole building.

## Layouts

- Full: the 1920×1080 editorial composition scaled into the window (desktop windows of at least 900×520, and the film). At scale 1 and DPR 1 the canvas backing store is exactly 1212×730.
- Compact: `?embed=1`, phones and small windows. The canvas fills the frame; a dock holds the five building buttons, the framing toggle, play, the light slider and reset; zoom buttons sit on the scene.

Both layouts drive the same state: selected building, framing, camera view, day fraction and tour clock. Every user action pauses the tour.

## Capture contract

`window.__scene = { slug, version, ready, cover: { fps: 30, frames: 600, posterAt: 12 }, inspect(), act(name, arg), pointer(nx, ny), press(), release(), seek(t) }`, plus `script(t)` and `step(n, dt)` with `?capture=1`. `script(t)` sets the film state at t as a pure function of time (no accumulated deltas). `inspect()` returns `{ quality, audio: 'none', errors, facts, camera }`; facts include the selected building, framing, day, time, playing, layout, camera and triangle count. `act` accepts `visit` (`prayer`, `imperial-hall`, `vault`, `altar`, `abstinence`), `view` (`orbit` | `detail`), `light` (0–1), `zoom` (factor), `reset`, `play` and `pause`. Inside an iframe the page posts `architecture-night-day:ready`, or `architecture-night-day:error` with `code: 'webgl'`.

## Adaptation order

Make one representative building readable in one view, then add navigation and the other subjects. Tune night-to-day from a fixed view. Author the shot table once architecture and UI are stable. Check a few timestamps with `script(t)`, then record and watch the whole film.
