# Bake, renderer and film

## Bake (`scripts/bake-route.mjs`)
1. OSRM car route through `--from`, `--via`… `--to`; step names become the street list.
2. The route is projected to metres (equirectangular around its middle) and resampled every 5 m.
3. Overpass is queried along the route in 1.2 km pieces: buildings within the corridor (150 m), water and coastline, parks, bridge ways, districts and named landmarks within 650 m. Answers without buildings are retried on the next server.
4. Each building footprint is mapped to road coordinates: span along the road (s0–s1), near offset d, depth, side, height (`height`, else `building:levels` × 3.2 m, else by type) and type. Footprints that map onto more road than their own size (by a bend or a loop of the route) are skipped. The nearest wall on each side is kept, plus anything 30 m or taller for the skyline.
5. Land on each side every 10 m: water, park, built land, or open water further out (`f`, or `q` beside a park).
6. Overhead bridges are bridge ways that cross the route, except the road being driven on; suspension structures get towers and cables.
7. Landmarks are ranked by tags (Wikidata, heritage, attraction, size) and nearness; `--pin` names always win. Fountains, plaques and busts are skipped.

## Renderer (`src/drive/`)
| File | Role |
| --- | --- |
| `world.js` | Smoothed road frame, building wall pieces, trees, lamps, signs, landmarks, bridges, `lookAt(s)` |
| `raster.js` | Low-res buffer, convex fill, column-wise vertical walls with perspective-correct u, camera-facing sprites |
| `render.js` | Sky and light through the day, ground strips, sorted uprights, facades by type, landmark silhouettes, the car |
| `font.js` | 5×7 pixel font for signs |
| `film.js` | Film timeline: position, speed and time of day as pure functions of time |
| `app.js` | Layouts, HUD, controls, capture contract |

The canvas is the buffer itself, scaled by a whole number in CSS with `image-rendering: pixelated`, about 170–200 rows high. Ground is drawn far to near; walls, landmarks, bridges and sprites are sorted by depth. Colours are posterized and gradients are ordered-dithered, so frames keep a small palette. Fog dithers into the horizon colour after 220 m.

## Film
`film.js` integrates a relative speed that eases down within 260 m of each landmark and of a suspension bridge, scales it to the film length and adds a hold at the end. The light follows the `tod` arc. `startAt` lets the film begin further along the route (the sample starts at the Alcântara docks so the bridge appears early). The capture contract exposes `cover` (30 s card loop, at most 900 frames) and `film` (the whole film).
