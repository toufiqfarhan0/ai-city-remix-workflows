---
name: pixel-city-drive
description: Drive any real city route in pixel art, with OpenStreetMap buildings on their footprints, real street signs, landmarks, golden hour to night, and a seekable film. One offline HTML.
version: 0.1.0
---
# Pixel City Drive

Pick two points in a city. The bake script routes the drive (OSRM) and pulls the buildings, water, parks, overhead bridges, districts and named landmarks along it from OpenStreetMap. The page then drives that road in pixel art: every building stands on its mapped footprint at its mapped or typical height, signs spell the real street and landmark names, the view glances at each landmark as you pass, and the light runs from golden afternoon through sunset to a night of lit windows and floodlit monuments. The included sample, Riverside Run, follows Lisbon's riverfront from Santos past the 25 de Abril bridge, MAAT, the Padrão dos Descobrimentos and Jerónimos to the Torre de Belém.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/riverside-run.json --out prompt.md
node scripts/new-project.mjs --out my-drive
node scripts/bake-route.mjs --from "41.8796,-87.6237" --to "41.8972,-87.6244" --out my-drive/src/city/route.json --title "Michigan Avenue" --pin "Water Tower"
cd my-drive && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (the sample is 90 s, 1920×1080, 30 fps, silent) and `film/poster.jpg`; `--cover` records only the 30 s card loop. The city lives in two files: `src/city/route.json` (baked, never hand-drawn) and `src/city/style.json` (facade palettes per building type, tile pattern share, paving, signs, car, landmark notes in both languages, film duration, start point and light arc). The renderer in `src/drive/` is shared by every city.

## Controls

Play or pause the tour (Space), scrub the route, scroll, drag or use the arrow keys to change speed (keep going down to reverse), drag the light slider from golden hour to night, jump to the next landmark (N) and show the route map (M). The tour starts by itself unless reduced motion is requested. Desktop windows show the full layout; phones, small windows and `?embed=1` show a compact strip. `?lang=zh-CN` switches the interface to Simplified Chinese. The page is silent.

## How it works

Read [method.md](references/method.md) for the bake, the renderer and the film, [lessons.md](references/lessons.md) for what is most likely to go wrong, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No keys and no model calls. The bake makes a handful of requests to the public OSRM and Overpass servers (set `PIXEL_CITY_USER_AGENT`, run one bake at a time; answers are cached next to the output). Overpass replicas sometimes answer empty while they resync: the bake retries on the next server and asks you to run it again later if all of them fail. Routes over 30 km are refused. The page itself makes no network requests. Missing Chrome or FFmpeg stops `shoot` or `record` with a localized error. Headless frame rates are indicative, not device acceptance.

## Licences

Map data © OpenStreetMap contributors under the ODbL: a baked `route.json` is a derived database, so share it under the ODbL and keep the credits line visible wherever the drive is shown. Routing by OSRM. The pictures are drawn by code.

## FAQ

- Is it a photo of the street? No. Positions, lengths, heights and names come from the map; facades, colours and landmark shapes are drawn by code from the building type and `style.json`.
- Missing buildings or heights? OpenStreetMap coverage decides. Unmapped heights come from the building type; unmapped stretches stay open.
- Hills? The ground is flat; the road follows the real plan, not the terrain.
- Another city? Bake a new route, pick its landmarks with `--pin`, write its palette and landmark notes in `style.json`, then review the frames: each city needs its own visual check.
