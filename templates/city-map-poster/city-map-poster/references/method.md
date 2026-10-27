# Bake, renderer and film

## Bake (`scripts/bake-poster.mjs`)
1. One Overpass query for a square of 2 × radius (plus 5 %) around the centre: roads by class, railways above ground, rivers and canals, water areas (ways and multipolygons), parks, woods and grass, and coastline from a slightly larger box. Answers without roads are retried on the next server; the answer is cached next to the output.
2. Coordinates are projected to metres east and north of the centre (equirectangular around it).
3. Roads fall into four classes: major (motorway, trunk, primary and links), mid (secondary, tertiary), minor (residential, unclassified, living street, pedestrian) and path (footways and the like, only with `--paths`). Lines are simplified (Douglas–Peucker, 1.2 m), clipped to the square (Liang–Barsky per segment) and delta-encoded in whole metres.
4. Water areas and parks keep all rings of a multipolygon (outer and inner ways joined end to end) and are filled with the even-odd rule, so islands and courtyards stay open.
5. The sea comes from the coastline: coastline cells are marked on a 400 × 400 grid, the rest is split into connected regions, and each region takes the side (water to the right of the coastline) of the segment nearest one of its cells. The mask is run-length encoded.
6. Marks are up to five `lat,lon,Label` points inside the square.
7. Skyline and food (one query per tile of about 1.2 km, `out tags bb` for buildings and `out center tags` for places, merged by id): each building or part with a mapped height (`height`, else `building:levels` × 3.2 m plus roof levels; no guesses) is placed by its bounds as seen from `--skyline-from` (south by default) into one of four depth bands, and its wall raises that band's height profile sampled every 2 m. Outlines that hold parts are skipped unless they carry their own height. Roofs tagged dome or onion, cone, pyramid or spire, and man-made towers and masts become caps drawn on top. The tallest named features (one per name, 300 m apart) become labels.
8. Food places are amenities (cafés, restaurants, fast food, ice cream, food courts, bars, pubs, beer gardens, marketplaces) and shops (bakeries, pastry, confectionery, chocolate, cheese, butchers, delis, greengrocers, seafood, wine, coffee, tea) in six groups, with counts and the six most mapped restaurant cuisines.
9. Landmarks (`--landmark`, up to four): the way or relation with that exact name (or English name), preferring buildings and the largest outline, with all its rings, the building parts inside it, the buildings within 320 m as neighbours, and its mapped height (tallest part), start date and architect.

## Renderer (`src/poster/`)
| File | Role |
| --- | --- |
| `world.js` | Decoded lines and rings, sea mask, counts and kilometres of road, coordinate text |
| `render.js` | Layout per format and shape; map, skyline, food and landmark art; themes, reveal, wipe, marks, type, food legend, credits |
| `film.js` | Film timeline: reveal per layer, theme and shape sequence, wipe progress |
| `app.js` | Layouts, HUD, kind tabs and controls, localized detail lines, live wipe and redraw, print export, capture contract |

Each layer is one Path2D built once in metres and stroked under a world transform, with line widths set in poster units (a thousandth of the short side) divided by the scale, so a poster looks the same at any size; widths grow with the square root of the zoom. The canvas is sized at the device pixel ratio. Layers draw back to front: paper, land, sea (the mask drawn smoothed), water areas and rivers, parks, rail (dashed), then path, minor, mid and major roads. The type block sits under the map (beside it for 16:9): title with wide letter spacing shrunk to fit, an accent rule, the subtitle and the coordinates. The credits line is always drawn. A theme or shape change draws the old poster, then the new one inside a slanted clip that moves across.

The skyline art scales the width of the box to the art area and the tallest height to 56 % of its height, so the poster prints the stretch factor; far bands fade toward the sky colour. The food art draws the water and a faint street base, then one dot per place in the theme's six food colours. The landmark art fits the outline to the art area, north up, with a scale bar of a round length.

## Film
`film.js` turns `reveal` ranges into eased progress per layer; a layer is clipped to a circle around the centre whose radius grows with its progress, so the city draws outward class by class. `sequence` lists steps of kind, theme, shape and landmark; each step is wiped in over `wipe` seconds ending at its start time, and a kind's own draw-in (the skyline rising band by band, food places spreading from the centre, the landmark outline drawn as a growing dash) starts with the wipe. The capture contract exposes `cover` (30 s card loop, at most 900 frames) and `film` (the whole film); `script(t)` always uses the portrait format, the home camera and the marks.
