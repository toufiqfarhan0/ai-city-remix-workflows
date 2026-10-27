---
name: pixel-iso-city
description: Turn any real city block into an isometric pixel-art city from OpenStreetMap, with mapped heights, landmark labels, pan, zoom, turn, day to night and a seekable film. One offline HTML.
version: 0.1.2
---
# Pixel Iso City

Draw a box on a city. The bake script pulls every building footprint and building part with its height, the roads, railways, water, coastline and parks, and the named landmarks inside the box from OpenStreetMap. The page then draws the area as an isometric pixel-art city: the ground is traced pixel by pixel from a 2 m grid, every building is a prism on its mapped footprint at its mapped (or typical) height, towers carry floor bands and windows, cars drive the main roads, the water ripples, and the light runs from day through sunset to a night of lit windows and street lamps. Landmark labels sit above their roofs. The included sample, Harbour Grid, is Central, Hong Kong, from Statue Square and the HSBC Main Building up to the Bank of China Tower and Lippo Centre, down to the piers and along to Two International Finance Centre and The Center.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/harbour-grid.json --out prompt.md
node scripts/new-project.mjs --out my-city
node scripts/bake-area.mjs --bbox "52.3640,4.8790,52.3760,4.8960" --out my-city/src/city/area.json --title "Canal Ring" --pin "Westerkerk" --pin "Munttoren"
cd my-city && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (the sample is 60 s, 1920×1080, 30 fps, silent) and `film/poster.jpg`; `--cover` records only the 30 s card loop. The city lives in two files: `src/city/area.json` (baked, never hand-drawn) and `src/city/style.json` (place name in both languages, ground colours, facade and roof palettes per building type, cars, the side of the road traffic keeps to, landmark notes in both languages, and the film: length, landmark order, zoom, turn and light arc). The renderer in `src/iso/` is shared by every city.

## Controls

Play or pause the tour (Space), drag to pan (arrow keys too), scroll or pinch to zoom (+ and −), turn the view a quarter at a time (Q and E, or the buttons), drag the light slider from day to night, jump to the next landmark (N) and show or hide the labels (L). The tour starts by itself unless reduced motion is requested. Desktop windows show the full layout with a landmark card and a north arrow; phones, small windows and `?embed=1` show a compact strip. `?lang=zh-CN` switches the interface to Simplified Chinese. The page is silent.

## How it works

Read [method.md](references/method.md) for the bake, the renderer and the film, [lessons.md](references/lessons.md) for what is most likely to go wrong, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No keys and no model calls. The bake makes one request to a public Overpass server (set `PIXEL_CITY_USER_AGENT`, run one bake at a time; the answer is cached next to the output). Overpass replicas sometimes answer empty while they resync: the bake retries on the next server and asks you to run it again later if all of them fail. Boxes over 3.5 km on a side are refused. The page itself makes no network requests. Missing Chrome or FFmpeg stops `shoot` or `record` with a localized error. Headless frame rates are indicative, not device acceptance.

## Licences

Map data © OpenStreetMap contributors under the ODbL: a baked `area.json` is a derived database, so share it under the ODbL and keep the credits line visible wherever the city is shown. The pictures are drawn by code.

## FAQ

- Is it a photo or a 3D model of the city? No. Footprints, heights and names come from the map; colours, windows and textures are drawn by code from the building type and `style.json`.
- A landmark looks too short or missing? OpenStreetMap coverage decides. Towers mapped as building parts get the tallest part; unmapped heights come from the building type. Pin the exact mapped name with `--pin`.
- Hills? The ground is flat; the city follows the real plan, not the terrain.
- Another city? Bake a new box, pick its landmarks with `--pin` (add `--english` for English names), write its palette, place name and notes in `style.json`, then review the frames: each city needs its own visual check.
