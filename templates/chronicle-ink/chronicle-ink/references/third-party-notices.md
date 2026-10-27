# Third-party notices

| Component | Version | Licence | How it is used |
|---|---|---|---|
| GSAP | 3.14.2 | Standard "No Charge" GSAP License | bundled (`assets/vendor/gsap.min.js`, licence in `assets/vendor/GSAP-LICENSE.txt`); only fixes the composition duration |
| LXGW WenKai | as listed in `assets/SOURCES.json` | SIL Open Font License 1.1 | bundled (`assets/fonts/`, licence in `assets/fonts/OFL-LXGWWenKai.txt`) |
| Noto Serif, Noto Sans, Noto Naskh Arabic | Fontsource 5.3.0 subsets | SIL Open Font License 1.1 | bundled WOFF2 subsets (`assets/fonts/`, licence in `assets/fonts/OFL-Noto.txt`) |
| Noto Sans SC, JetBrains Mono | Fontsource subsets | SIL Open Font License 1.1 | style `model` (`assets/styles/model/fonts/`, licences next to the files) |
| Noto Serif SC, Cinzel | Fontsource subsets | SIL Open Font License 1.1 | style `roman` (`assets/styles/roman/fonts/`, licences next to the files) |
| Natural Earth land (world-atlas 2.0.2) | 1:50m | public domain data, ISC packaging | `assets/geo/world-land-50m.json` (licence in `assets/geo/LICENSE-world-atlas.txt`): the globe of the city opening and ending |
| HyperFrames | 0.8.30 | Apache-2.0 | run with `npx --yes hyperframes@0.8.30`, not bundled |
| FFmpeg | system | LGPL or GPL depending on the build | system tool, not bundled |
| Wikidata | live data | CC0 1.0 | entity data, labels and place coordinates (P625) |
| Wikipedia | excerpts | CC BY-SA 4.0 | short excerpts with the article link and retrieval time in every report |
| CBDB (China Biographical Database) | live data | see the CBDB terms at cbdb.fas.harvard.edu | short JSON excerpts with the record link |
| OpenStreetMap data | fetched per film | ODbL 1.0 | `scripts/geo.mjs` reads water, rivers, coast, rail, streets, buildings and walls through the Overpass API into the project's `geo/basemap.json` (not bundled); every frame of a film that uses it shows "© OpenStreetMap contributors (ODbL)" |
| Wikimedia Commons photographs | fetched per film | each file's own licence (public domain or CC BY / BY-SA) | `scripts/photos.mjs` downloads existing photographs of landmarks into `geo/photos/` (not bundled); each photo card shows its author, licence and "Wikimedia Commons" |

The DSP and voice code in `src/engine/audio/synth/` and some SFX layers share code with
`skills/sketchbook-film` (same repository, MIT). The kits, the themes, the seal and the CSS are made for
this Skill. Pictures and, by default, music of a film are produced by code in the project. Only when the
user asks for it, `music/track.json` may bring an openly licensed recording or an instrumental generated
by a SandBase music model; its credit is then shown on the end card and in the report
([music-track.md](music-track.md)).
