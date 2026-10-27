# Third-party components and data

## npm dependencies (installed by `npm ci`, not bundled)

| Package | Version | Licence | Used for |
|---|---|---|---|
| d3-geo | 3.1.1 | ISC | globe projection (inlined into `film.html`) |
| d3-array | 3.2.4 | ISC | d3-geo dependency (inlined into `film.html`) |
| topojson-client | 3.1.0 | ISC | decoding the world land outline |
| world-atlas | 2.0.2 | ISC (data: Natural Earth, public domain) | land for the globe intro |
| @mapbox/vector-tile | 3.0.0 | BSD-3-Clause | decoding basemap tiles |
| pbf | 5.1.2 | BSD-3-Clause | decoding basemap tiles |
| playwright-core | 1.56.1 | Apache-2.0 | driving Chrome to render frames |

Each package's licence file is in its own `node_modules/<name>/` folder after install.

## Map data (downloaded at run time)

- **OpenStreetMap** (© OpenStreetMap contributors, ODbL 1.0). Wall and road outlines come from the Overpass API (overpass-api.de and public mirrors); streets, buildings and rivers come from OpenFreeMap vector tiles (OpenMapTiles schema, © OpenMapTiles). A film made with this Skill is a Produced Work under the ODbL: keep the on-screen credit "Map data © OpenStreetMap contributors · OpenMapTiles".
- **Natural Earth** land (public domain), via world-atlas.
- Use the public servers lightly: results are cached in `<project>/cache/`; do not run many cities in parallel.

## Generated media (created per run through SandBase, not bundled)

- Narration: MiniMax Speech 2.8 HD. Illustrations: Qwen Image 3, from text prompts only (no reference photos). Check the model terms on SandBase before commercial use. Cards are labelled "AI illustration" and the credit line says the illustrations are AI-generated.

## Fonts

None bundled. The player uses fonts already on the machine (PingFang SC, Hiragino Sans GB, Noto Sans SC, then `system-ui`).
