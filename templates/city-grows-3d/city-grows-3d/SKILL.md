---
name: city-grows-3d
description: Make a narrated 3D film of a real city in which every building rises in the year it was built. Today's footprints come from OpenStreetMap; construction years from a Colouring Cities data extract (Colouring London and its sister platforms), OSM start dates and your landmarks; an optional historic footprint survey appears as its own layer. The agent writes one story.json (eras, narration, camera, landmarks, fires); the scripts build the city, voice the narration through SandBase and render a 1080p MP4 in Chrome with Three.js.
version: 0.1.0
category: video
delivery: download-only
---
# City Grows 3D

A 1-2 minute film of one real city, building by building. It opens on today's city in 3D; the buildings sink away; then the city clock runs forward and each building rises in the year it was recorded as built, coloured by its century. Landmarks are named as they appear, fires and raids glow on the ground, a historic survey (if you have one) shows the city as it stood in one moment, and an English narrator tells each era with matching captions. It ends with the buildings whose year is not recorded rising in grey, and a card with the counts and every data source.

Example: "London: Every Building, Year by Year", 120 s, 18,961 buildings in central London (6,908 with a recorded year), nine eras from Londinium to the Shard, the 1890s Ordnance Survey city as its own layer, 11 narration clips. Its `story.json` is `assets/story.example.json`. Narration cost about $0.11; everything else is free.

Made for cities with open building-age data: Colouring London has years for about a third of central London. Other Colouring Cities platforms (Athens, Dresden, Australia, Ghana and more) use the same extract format.

Its sibling `city-through-time-3d` raises each era's whole extent at that period's heights and works for any city on OpenStreetMap alone. Use this one when the city has building-age data and the film should show it filling in building by building.

## Run

Requirements: Node 22.5+ (for `node:sqlite`), Google Chrome, FFmpeg, curl, about 10 GB of disk for the London extract, and a SandBase login for the narration (`npx -y @sandbaseai/cli@latest connect` once, or `SANDBASE_API_KEY`). A GPU makes rendering about ten times faster (`--software` works without one).

```bash
S=path/to/city-grows-3d
(cd $S && npm ci)
mkdir london && cp $S/assets/story.example.json london/story.json   # or write your own (below)

# 1. data you download once (see references/data.md):
#    Colouring London extract  -> building_attributes.csv   (optional but this is where the years come from)
#    a historic footprint survey (GeoPackage, EPSG:3857)     (optional)
node $S/scripts/build-city.mjs london --colouring <building_attributes.csv> [--victorian <footprints.gpkg>]
node $S/scripts/check.mjs london                      # story, city counts, timeline
node $S/scripts/voice.mjs london                      # narration plan and cost (spends nothing)
node $S/scripts/voice.mjs london --confirm            # generate it (about $0.1)
node $S/scripts/film.mjs london --stills 10,40,80     # look at a few frames
node $S/scripts/film.mjs london                       # london/film.mp4 (about 10 minutes with a GPU)
node $S/scripts/check.mjs london --film
```

Every script takes `--lang en|zh-CN` for its messages.

## Write story.json (the agent step)

Use **MiniMax M3.1 flash through SandBase** (`sandbase_minimax_minimax_m3_1_flash`) or write it yourself. Format: `references/story.md`. In short:

1. Set `city.bbox` (about 6 × 3 km is plenty) and `city.center`.
2. Write 7-10 eras in order, each `from`/`to` years, a short `label`, one or two spoken sentences (≤ 40 words), a camera (`target`, `dist`, `pitch`, `yaw`, and a `to` pose for a slow move) and optional `events` (`fire`, `blitz`, `flash` at a place, with a radius).
3. Add `landmarks` (name, year, `[lat, lon]`, optional height) for buildings the data may miss, and `outlines` for vanished walls (they are labelled reconstructions).
4. **Fact-check every line** against sources you list in `sources`; the voice costs money and a wrong date means paying again.

## Honesty in the film

- A building's year is only ever a recorded one (Colouring, OSM `start_date`, or your landmark). Buildings without one rise last, in grey, and the film says their year is not recorded. Nothing is inferred.
- The historic survey layer is shown as what it is (a footprint map of one moment); it is never used to date today's buildings.
- Outlines are reconstructions and the end card says so. Every data source and licence is credited on screen.

## Failure boundaries

- Coverage is whatever the data has: in central London about 36% of buildings have a year, and very few before 1700, so early eras show the street plan, outlines, landmarks and events more than buildings.
- Heights come from OSM `height`/`building:levels`, then Colouring; the rest are estimated from footprint size.
- Overpass servers are often busy; `build-city.mjs` retries across mirrors and caches every tile.
- English narration, 16:9 1080p, 30 fps. One city per film.

Licences: `references/LICENSE.txt` (MIT, this package) and `references/third-party.md` (data and libraries).
