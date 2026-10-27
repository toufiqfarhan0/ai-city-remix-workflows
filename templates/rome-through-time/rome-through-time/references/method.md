# Engine, layouts and film

## One city, evaluated by year

`assets/eternal-city` is the executable specification: a Vite project with vanilla Three.js and OrbitControls.

| File | Role |
| --- | --- |
| `src/scene/scene-system.js` | Builds the single mounted city graph; `updateCityAtYear(year)` |
| `src/scene/entity-registry.js` | Stable entity IDs; construction, deterioration and removal intervals |
| `src/scene/persistent-landmarks.js`, `landmarks.js`, `architecture.js` | Colosseum, Forum and Palatine anchors and their component states |
| `src/scene/urban-evolution.js`, `era-configs.js`, `environments.js` | Neighborhoods, streets, planting, modern transport |
| `src/scene/historical-events.js` | Year helpers, timeline mapping and the film's year schedule |
| `src/scene/cinematic-director.js` | The film camera, a pure function of film time |
| `src/scene/shell.js`, `src/scene/main.js` | Bilingual markup, layouts, controls, capture API |
| `src/i18n/strings.json`, `src/i18n/stories.json` | Interface text and the narration card, English and Simplified Chinese |
| `tests/*.test.js` | 19 history and camera tests (`npm test`) |

Never swap whole era scenes or reset neighborhoods at milestones. Every component's visibility, damage and reuse is derived from the exact year, so dragging the timeline backward lands in the same state as playing forward. The four milestones (125, 1300, 1700, 2026) have equal length on the slider but not equal calendar length.

## Film schedule

25 s at 30 fps (750 frames): year 600 by 2 s, 1300 at 8 s, 1700 at 15 s, 2026 at 21.8 s; the camera finishes its pullback at 23 s and holds exactly to 25 s. Year and camera are separate deterministic functions of film time.

## Layouts

- Full: the editorial composition (title, narration card, timeline, era stops, notes) for desktop windows of at least 700×520 and the film.
- Compact: `?embed=1`, phones and small windows. The scene fills the frame; a dock holds the four era stops, play, the timeline and reset; the year and era sit on the scene. The camera pulls back to fit the relief base by width.

## Capture contract

`window.__scene = { slug, version, ready, cover: { fps: 30, frames: 750, posterAt: 24 }, inspect(), act(name, arg), pointer(nx, ny), press(), release(), seek(t) }`, plus `script(t)` and `step(n, dt)` with `?capture=1`. `script(t)` renders the film frame at t synchronously. `inspect()` returns `{ quality, audio: 'none', errors, facts }`; facts include year, era, playing, layout, camera distance and azimuth, entity and triangle counts. `act` accepts `year` (125–2026), `era` (0–3), `play`, `pause`, `reset` and `zoom` (factor). Inside an iframe the page posts `rome-through-time:ready`, or `rome-through-time:error` with `code: 'webgl'`.
