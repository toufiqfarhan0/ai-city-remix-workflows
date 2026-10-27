---
name: city-map-poster
description: Turn any city into minimalist posters from OpenStreetMap data, a street map, a skyline from real heights, a food map and landmark outlines, with five themes, a draw-in film and print PNG export.
version: 0.2.0
---
# City Map Poster

Pick a centre and a radius. The bake script pulls the city from OpenStreetMap and the page draws four kinds of poster from it, all in the same typographic frame and five themes (Noir, Paper, Blueprint, Sunset, Mint), three formats (3:4, 1:1, 16:9) and a full or round art area:

- **Map**: every road by class, the railways, water areas, rivers, canals, the sea from the coastline and parks, with up to five marked places.
- **Skyline**: every building and building part with a mapped height, seen from one side in four depth bands, domes, spires and lattice towers drawn as their caps, the tallest named features labelled; the poster says how much the heights are stretched to fit.
- **Food**: the mapped cafés, restaurants, bakeries, bars, quick bites and food markets or shops as coloured dots over a faint street base, with counts per group and the most mapped cuisines.
- **Landmark**: one named building's outline with its parts, the buildings around it, a north arrow, a scale bar and its mapped facts (height, start date, architect), up to four landmarks.

The film draws the street map outward from the centre, then wipes through the themes and kinds: the skyline rises band by band, the food places spread out from the centre, each landmark outline draws itself. The included sample, Paris Lines, covers central Paris from the Eiffel Tower to Notre-Dame, with Notre-Dame, the Louvre, the Panthéon and the Eiffel Tower as landmarks.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/paris-lines.json --out prompt.md
node scripts/new-project.mjs --out my-poster
node scripts/bake-poster.mjs --center "37.7790,-122.4190" --radius 5000 --out my-poster/src/city/poster.json --title "San Francisco" --subtitle "California" --mark "37.79554,-122.39370,Ferry Building" --landmark "Ferry Building" --skyline-from east
cd my-poster && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
node scripts/poster.mjs --file dist-single/index.html --kind all --theme paper --width 3600
```

`record` writes `film/film.mp4` (the sample is 60 s, 1920×1080, 30 fps, silent) and `film/poster.jpg`; `--cover` records only the 30 s card loop. `scripts/poster.mjs` writes print PNGs (`posters/poster-<kind>-<theme>-<format>-<shape>.png`, 3600×4800 for 3:4 by default; any width from 600 to 9000; `--kind` and `--theme` take one id or `all`; landmark posters come out one per landmark). The city lives in two files: `src/city/poster.json` (baked, never hand-drawn) and `src/city/style.json` (the city name in both languages, the map span, the five themes with paper, land, water, park, rail, road and food colours, accent and fonts, and the film: reveal times of the first map and the sequence of kind, theme, shape and landmark). The renderer in `src/poster/` is shared by every city.

## Controls

Play or pause the tour (Space), pick the poster kind (the Map, Skyline, Food and Landmark tabs, or K; the Landmark tab again, or L, shows the next landmark), pick a theme (the swatches, 1–5 or T), change the format (F), switch between a full and a round art area (C), drag to pan and scroll or pinch to zoom the map and food posters (arrow keys, + and − too), redraw the current poster (D) and show or hide the marks and skyline labels (M). The tour starts by itself unless reduced motion is requested. Wide desktop windows show the full layout; phones, windows narrower than 1180 px and `?embed=1` show a compact strip. `?lang=zh-CN` switches the interface and the poster's detail lines to Simplified Chinese; titles keep the names from the bake. The page is silent.

## How it works

Read [method.md](references/method.md) for the bake, the renderer and the film, [lessons.md](references/lessons.md) for what is most likely to go wrong, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No keys and no model calls. The bake makes one Overpass request for the map, one per tile of about 1.2 km for building heights and food places, and one per landmark; set `CITY_POSTER_USER_AGENT` and run one bake at a time. Every answer is cached next to the output, so a failed or interrupted bake resumes where it stopped. A dense centre with a 3–4 km radius takes tens of minutes on the public servers; `--kinds map` bakes only the street map. Overpass replicas sometimes answer with an error or nothing while busy: the bake retries on the next server and asks you to run it again later if all of them fail. The radius must be 500 to 6000 m; footpaths are left out unless you pass `--paths`. The page itself makes no network requests. Missing Chrome or FFmpeg stops `shoot`, `record` or `poster.mjs` with a localized error. Headless frame rates are indicative, not device acceptance.

## Licences

Map data © OpenStreetMap contributors under the ODbL: a baked `poster.json` is a derived database, so share it under the ODbL, and the credits line is drawn on every poster and export. Keep it when you print or post a poster.

## FAQ

- Is anything traced, generated or guessed? No. Lines, outlines, heights and places are mapped features in their real places; only colours, widths and type come from the theme. Buildings without a mapped height are left out of the skyline rather than given a guessed one.
- Why is the skyline so tall? A city is kilometres wide and a few hundred metres high, so heights are stretched to fit; the poster prints the factor.
- The food map looks thin in my city? It shows what OpenStreetMap has; coverage differs a lot between cities, and the counts say exactly what was found.
- A landmark is missing? Use its exact mapped name (or English name with `--english`); the bake reports names it could not find.
- Can I print it? Yes. `scripts/poster.mjs` renders the same poster at print width; 3600 px wide is 30 cm at 300 dpi.
- Another city? Bake a new centre and radius, add marks and landmarks, write its name in `style.json`, then check every kind and theme: each city needs its own look.
