# Bake, renderer and film

## Bake (`scripts/bake-area.mjs`)
1. One Overpass query for the box: buildings and building parts, roads, railways, water, coastline (from a slightly larger box), parks and named landmarks. Answers without buildings are retried on the next server; the answer is cached next to the output.
2. Latitude and longitude are projected to metres from the south-west corner (equirectangular).
3. The ground becomes a grid of 2 m cells (`--cell`): sea from the side of the nearest coastline segment, then water areas, parks and squares, roads by class and width (minor first, major over them, lanes widen major roads), then rail. The grid is run-length encoded.
4. Buildings and building parts become prisms: a simplified footprint, a height (`height`, else `building:levels` × 3.3 m plus roof levels, else by type), a base (`min_height` or `building:min_level`), a type, and mapped facade or roof colours. An outline that holds building parts is dropped, as in Simple 3D Buildings, so the parts carry the shape.
5. Landmarks are ranked by pin (exact name first, then substring; each pin claims one), Wikidata, attraction tags and height; when pins are given only pinned places are kept. A building landmark is as tall as the tallest prism inside its footprint. Duplicate names keep the pinned, then the tallest element. At most eight, at least 90 m apart.

## Renderer (`src/iso/`)
| File | Role |
| --- | --- |
| `world.js` | Decoded grid, prisms with outward wall normals and radius, car lanes on major roads, trees in parks, landmarks |
| `raster.js` | Low-res buffer, convex and even-odd polygon fill, lines |
| `render.js` | Light through the day, rotation and projection, ground traced per pixel, sorted prisms with textured walls and roofs, trees, cars, street lamps |
| `film.js` | Film timeline: camera and time of day as pure functions of time |
| `app.js` | Layouts, labels, HUD, controls, capture contract |

Projection is 2:1 isometric. The world is turned around the area centre by `rot` quarter turns (whole numbers are the four classic views, values in between are the turn); screen x is X − Y and screen y is −(X + Y)/2 − height. Every ground pixel is traced back to its grid cell, so roads, water and parks stay crisp at any zoom; outside the box the edge ground carries on and dithers into the sky within 140 m. Prisms, trees and cars are sorted by X + Y and drawn far to near: walls whose normal faces the viewer, lit by how much they face left, then the roof. Wall texels come from floors and bays: towers and offices get glass with floor bands, low-rises get windows in their facade colour; when floors are too small for windows they read as bands. At night lit windows come in runs of three bays. Colours are posterized and patterns ordered-dithered. The canvas is the buffer itself, scaled by a whole number in CSS with `image-rendering: pixelated`, about 200–240 rows high.

## Film
`film.js` builds key frames: a wide view of the whole area, then each landmark in `film.order` (framed so tall towers fit, centred halfway up), held with a slow push in, then a wide view again. Long hops pull back in the middle. The view turns `turns` quarter turns over the film and the light follows the `tod` arc, staying day for the first third. Zoom is defined for a 240-row buffer and scaled to the real one, so every layout frames the same shot. The capture contract exposes `cover` (30 s card loop, at most 900 frames) and `film` (the whole film).
