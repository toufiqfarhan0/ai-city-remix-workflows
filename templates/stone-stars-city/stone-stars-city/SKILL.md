---
name: stone-stars-city
description: Build a storybook 3D miniature city around one landmark, with chapters, a daylight-to-starlight light slider, street life and a matching scored 24-second film. Sample Barcelona basilica.
version: 0.1.1
---
# Stone Stars City

Turn a city into a floating storybook island with one landmark in the middle. The bundled sample, Stone Stars, is a Gaudí-style basilica homage to the Sagrada Família: fourteen fruit-tipped honey-stone spires, a rose window, three portals and a glowing star, surrounded by a low ring of rounded houses, a ring road with tiny cars and walkers, a fountain plaza, trees and clouds. Move the light from daylight through golden hour and blue hour to starlight and the windows light up; pick a chapter, orbit, zoom, switch the lanterns, pause street life or click the landmark for its card. The same scene renders a deterministic 24-second 1920×1080 film in four chapters (the island, the facade, the crown, the island at night) with the bundled score. The city is illustrative, not a survey.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/stone-stars.json --out prompt.md
node scripts/new-project.mjs --out my-city
cd my-city && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (24 s, 1920×1080, 30 fps, 720 frames, AAC score) and `film/poster.jpg`; `--silent` leaves the score out and `--score <file>` uses your own track. It needs Chrome (found in its default place on macOS, Windows and Linux; otherwise `--chrome <path>` or `CHROME_PATH`) and FFmpeg. For another city, fill the slots (`city`, `landmark` and optional `style`, `village`, `chapters`, `lighting`, `interaction`, `extraPrompt`), give the prompt and the copied project to your coding agent, then build, shoot and record. The landmark lives in `src/scene/landmark.js` (with the camera anchors of the two close chapters), the island in `village.js`, light, traffic and stars in `world.js`, the film schedule in `config.js`, and visible text in `src/i18n/strings.json` (English and Simplified Chinese). A new city normally changes only `landmark.js`, `village.js`, `strings.json` and the `<title>` in `index.html`; method.md has the landmark contract and a re-theming checklist. `shoot` does not judge composition: look at the film frames listed in verification.md before calling it done.

## Controls

Four chapter buttons, drag to orbit, wheel or + / − to zoom, a light slider with Daylight / Golden hour / Blue hour / Starlight stops, Lanterns on/off, Pause life, a click on the landmark for its card (Enter on the focused scene, Escape to close), the journey bar to scrub the tour, Play / Pause tour, Reset and Sound. The tour starts by itself (silently) unless reduced motion is requested; the score plays only after you turn the sound on. Desktop windows show the full editorial composition; phones, small windows and `?embed=1` show a compact dock with chapters, play, reset, light, lanterns and sound. `?lang=zh-CN` switches the interface to Simplified Chinese.

## How it works

Read [method.md](references/method.md) for the shared world, the two modes, the layouts and the capture contract, [lessons.md](references/lessons.md) for what regresses most easily, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and how to check the film, and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No model key or runtime network is needed; rebuilding, shooting and recording the sample make no model calls. The score is an original piece generated once through SandBase for this sample and ships with it; replacing it with music you generate yourself is a new, separately billed call. Changing the city with a model incurs new usage that must be read from the provider response. Missing WebGL shows a localized message; missing Chrome or FFmpeg stops `shoot` or `record` with a localized error. Headless frame rates are indicative. The geometry is authored for this basilica: another landmark needs new geometry and camera anchors, not new names. Loudness measurements are not a listening review.

## FAQ

- Can I use another city or landmark? Yes: author the landmark in `landmark.js`, adjust the village and strings, and keep the four-chapter film; review the result.
- Is it architecturally exact? No. The basilica is a storybook homage and the island is a compressed, invented layout.
- Are models, textures or fonts downloaded? No. Geometry is procedural; Cormorant Garamond and Inter (SIL OFL 1.1) and the score are bundled in the single file.
- Does the page play sound? Only after you press Sound; the film always carries the score unless recorded with `--silent`.
