---
name: architecture-night-day
description: Build a detailed 3D explorer of any architectural site with a night-to-day light slider and a matching 20-second film, as one offline HTML. Sample Temple of Heaven included.
version: 1.0.0
---
# Architecture Night-Day Explorer

Turn any architectural site (a temple, a campus, a historic quarter, a landmark ensemble) into one detailed Three.js scene. The bundled sample, Through Light, is five Temple of Heaven landmarks (Hall of Prayer, Huangqian Hall, Imperial Vault, Circular Mound Altar and Hall of Abstinence). Pick a building, switch between orbit and detail framing, drag and zoom the camera, and move the bottom slider from night through dawn and sunrise into day. The same scene renders a deterministic 20-second 1920×1080 film in which the visible controls follow the shown building and light. The sample's park layout is compressed and interpretive, not a survey.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/through-light.json --out prompt.md
node scripts/new-project.mjs --out my-site
cd my-site && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (20 s, 1920×1080, 30 fps, 600 frames, silent) and `film/poster.jpg`; it needs Chrome and FFmpeg. Give the filled prompt and the copied project to your coding agent for a new subject. Geometry lives in `src/scene/detailed-temple.js`, `marble-base.js`, `park-landmarks.js` and `park-setting.js`; views and the shot table in `src/scene/config.js`; visible text in `src/i18n/strings.json` (English and Simplified Chinese).

## Controls

Five building buttons, Orbit / Detail framing, drag to orbit (right-drag pans), wheel or + / − to zoom, Reset view, a night-to-day slider with Night / Dawn / Sunrise / Day stops, and Play / Pause for the tour. The tour starts by itself unless reduced motion is requested. Desktop windows show the full editorial composition; phones, small windows and `?embed=1` show a compact layout with the same controls. `?lang=zh-CN` switches the interface to Simplified Chinese. The scene is silent by design.

## How it works

Read [method.md](references/method.md) for the shared scene, the two layouts and the capture contract, [lessons.md](references/lessons.md) for the details most likely to regress, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No model key or runtime network is needed; rebuilding and recording the included sample makes no model calls. The sample's architecture code was generated earlier with MiniMax M3.1 Flash through SandBase for a recorded total of $0.109565 (`usage.json`); that figure is history, not a forecast. Changing the subject with a model incurs new usage that must be read from the provider response. Missing WebGL shows a localized message. Missing Chrome or FFmpeg stops `shoot` or `record` with a localized error. Headless frame rates are indicative, not device acceptance. The included scripts copy and verify a runnable example; they do not reconstruct arbitrary buildings from photographs.

## FAQ

- Can I use another site? Yes, but replace the geometry, arrangement and copy as well as the wording; a new subject needs new visual review.
- Is it accurate? It is an interpretive model with a compressed layout, not a measured reconstruction.
- Are models or textures downloaded? No. Geometry and textures are generated in the browser.
- Does the film have sound? No. It is silent by design.
