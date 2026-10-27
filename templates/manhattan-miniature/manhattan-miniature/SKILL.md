---
name: manhattan-miniature
description: Build an interactive 3D miniature city with landmark navigation, day and night lighting, traffic and orbit controls as one offline HTML file. Manhattan sample included.
version: 0.2.0
---
# Manhattan Miniature

Turn a city into one interactive Three.js diorama: a road-first street plan, blocks and parcels, ten ordinary building families, dedicated landmark models, traffic, pedestrians and boats on a floating island tray. The bundled sample, Manhattan Diorama, has eight landmark views (Empire State, Chrysler Building, One World Trade, Central Park, Times Square, Flatiron Building, Rockefeller Center and the Vessel at Hudson Yards), a Day / Night switch driven by real scene lights, auto rotation, reset and zoom. The layout is artistically compressed, not a survey.

## Example

`results/manhattan-diorama/index.html` is the published single-file build: eight landmark buttons, Day / Night, auto rotate, drag to orbit, wheel or + / − to zoom and right-drag to pan.

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/manhattan-diorama.json --out prompt.md
node scripts/new-project.mjs --out my-miniature
cd my-miniature && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`node tests/run.mjs` runs the geometry, traffic, diversity and planning checks without a browser. `record` writes `film/film.mp4` (12 s, 1920×1080, 30 fps, 360 frames, silent) and `film/poster.jpg`; it needs Chrome and FFmpeg.

## When to use

- A browsable miniature of a city or district with a handful of landmarks, for a launch page, a brand piece or an embedded demo.
- Adapting the Manhattan sample's mechanism (road graph first, then blocks, parcels and buildings) to another place.

Not for measured maps, GIS data, navigation or arbitrary photo-to-3D reconstruction.

## Inputs (slots)

Required: `city`, `landmarks`. Optional, with English and Chinese defaults: `palette`, `interaction`, `ui`, `brand`, `extraPrompt`. See [prompt-slots.md](references/prompt-slots.md). The 0.1.0 presentation slots (`brand_name` and the others) are no longer accepted; `fill-prompt` rejects unknown slots with exit code 2.

## Workflow

1. Fill the prompt (`fill-prompt`), copy the project (`new-project`), `npm ci`.
2. Change geometry, landmark models, views and strings together: a new city needs its own outline, street plan, landmark models and copy, not only new names. Read the relevant sections of [accepted-brief.en.md](references/accepted-brief.en.md).
3. `npm run dev` while working; `npm run build:single` for the offline file; `npm run shoot` until every check passes; `npm run record` for the cover.

Read [method.md](references/method.md) for the module map, the capture contract and the layouts, [lessons.md](references/lessons.md) for the details most likely to regress, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Language

`?lang=zh-CN` (aliases `zh`, `zh-cn`, `zh-Hans`, `zh_CN`) switches the scene to Simplified Chinese; English is the default. The CLIs take `--lang en|zh-CN`.

## Keys

None. The scene makes no network, storage or model calls. If the user asks to adapt it with a SandBase model, run `sandbase inspect` on that model first, then `sandbase run`; keep credentials out of the front end.

## Failure boundaries

The geography is compressed and interpretive. Phones were verified only under touch emulation in headless Chrome; headless frame rates are indicative. `shoot` and `record` need Node 22.4 or newer and Chrome; `record` also needs FFmpeg. Missing WebGL 2 shows a localized message.

## FAQ

- Is the map accurate? No. Positions and scales are compressed for a tabletop diorama.
- Can I use another city? Yes, but replace the outline, street plan, landmark models, views and copy as well as the wording, then review it visually.
- Does it have sound? No. It is silent by design.
- Does it download models or textures? No. Every building and texture is generated in the browser.
