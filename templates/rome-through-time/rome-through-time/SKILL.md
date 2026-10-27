---
name: rome-through-time
description: Build a persistent 3D city diorama that evolves year by year across two thousand years, with a timeline, narration card and a matching 25-second film. Sample Rome included.
version: 1.0.1
---
# Rome Through Time

A warm miniature of Rome around the Colosseum, the Roman Forum and the Palatine that changes continuously from AD 125 to 2026. One city graph stays mounted: roofs and wall sections are lost on their own schedules, the Colosseum becomes a reused medieval building, a depleted ruin and a conserved monument, Baroque domes and palazzi arrive, and modern Rome adds roads, buses and visitors. Drag the timeline or press Play; the narration card follows the exact year. The same engine records a 25-second 1920×1080 film of the real interface. The reconstruction is artistic and approximate, not an archaeological survey.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/eternal-city.json --out prompt.md
node scripts/new-project.mjs --out my-city
cd my-city && npm ci
npm test
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (25 s, 1920×1080, 30 fps, 750 frames, silent) and `film/poster.jpg`; it needs Chrome and FFmpeg. For the scored copy, synthesize the original score and mux it:

```sh
python3 <skill>/scripts/compose-score.py --out score   # needs numpy; writes score/rome-enduring-original-score.wav
npm run record -- --file dist-single/index.html --out film --score score/rome-enduring-original-score.wav
```

Give the filled prompt and the copied project to your coding agent to change the city or its eras. History lives in `src/scene/` (entity registry, landmark and urban evolution, era configs), film timing in `src/scene/cinematic-director.js` and `historical-events.js`, visible text in `src/i18n/strings.json` and `src/i18n/stories.json` (English and Simplified Chinese).

## Controls

A continuous timeline from AD 125 to 2026, era stops at 125, 1300, 1700 and 2026, Play / Pause history, drag to orbit (right-drag pans), wheel to zoom, Reset view and Historical notes. Desktop windows show the full editorial composition; phones, small windows and `?embed=1` show a compact dock with the same timeline, era stops, play and reset. `?lang=zh-CN` switches the interface and narration to Simplified Chinese. The page is silent; nothing plays by itself.

## How it works

Read [method.md](references/method.md) for the engine, layouts and capture contract, [lessons.md](references/lessons.md) for what regresses most easily, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves, [hosting.md](references/hosting.md) for embedding and [accepted-brief.en.md](references/accepted-brief.en.md) for the full original design brief.

## Credentials, cost and failure boundaries

No model key or runtime network is needed; rebuilding, recording and scoring the sample make no model calls. Changing the city with a model incurs new usage that must be read from the provider response. The score is sample-free local synthesis, not a recording; level measurements are not a listening review. Missing WebGL shows a localized message; missing Chrome or FFmpeg stops `shoot` or `record` with a localized error; `compose-score.py` needs Python 3 and numpy. Headless frame rates are indicative. The geometry and chronology are Rome's: another city needs new geometry, entities and schedules, not new names.

## FAQ

- Can I use another city? Yes, by authoring its landmarks, neighborhoods and schedules in the same engine; review the result.
- Is it historically exact? No. The anchor positions are fixed; neighborhoods, building counts and damage intervals are artistic approximations.
- Are models, textures or fonts downloaded? No. Geometry is procedural and fonts are system fonts.
- Does the film have sound? The recorded film is silent; the optional scored copy uses the bundled original synthesized score.
