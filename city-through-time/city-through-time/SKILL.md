---
name: city-through-time
description: Turn the history of any living city into a narrated 1080p map film. An Agent writes one story.json (eras, walls, landmarks, narration); the scripts fetch real OpenStreetMap streets and buildings, light each era's extent up layer by layer on today's map, add AI narration, subtitles and landmark illustrations through SandBase, and render an MP4.
version: 0.1.1
category: video
delivery: download-only
---
# City Through Time

A 1-2 minute film of one city's life, told on its own map.

1. **Globe.** The Earth turns to the city and a pin drops on it.
2. **Dive.** The camera falls onto a dark, tilted map of the city as it is today: real streets, buildings and rivers.
3. **Era by era.** The year rolls forward. The new extent lights up on top of the earlier ones: real streets and buildings inside the wall glow in the era's colour, spreading out from where the city began; the newly gained ground flashes behind the growth front; the wall draws itself in. Its area and growth (`≈ 37 km² · ×4.6`) appear under the year, landmark illustrations float up one at a time, and a narrator tells the step with matching English subtitles. A timeline along the bottom shows how far the story has come.
4. **Rings.** Every era's outline comes back at once, oldest inside, with a legend of years and areas: the city's growth rings.

The Agent only writes text. Geometry comes from OpenStreetMap, the voice from a speech model, the pictures from an image model, and every frame from code, so the same story always renders the same film.

Works for living cities that still exist, best where OpenStreetMap maps the historic centre's buildings. Vanished or fictional cities are out of scope.

## Run

Requirements: Node 22+, Google Chrome or Chromium, FFmpeg, curl, and a SandBase account (`npx -y @sandbaseai/cli@latest connect` once, or `SANDBASE_API_KEY` in the environment). The scripts never write a key anywhere.

```bash
S=path/to/city-through-time
(cd $S && npm ci)
mkdir <city> && $EDITOR <city>/story.json        # 1. the Agent writes this (below)
node $S/scripts/resolve.mjs <city>              # 2. OSM outlines + basemap   (no model calls, ~2 min)
node $S/scripts/media.mjs <city>                # 3. plan and cost of narration + pictures (spends nothing)
node $S/scripts/media.mjs <city> --confirm      #    generate them (about $0.5-0.7 for 8-9 eras)
node $S/scripts/film.mjs <city> --stills 12,40  # 4. look at a few frames
node $S/scripts/film.mjs <city>                 #    <city>/film.mp4
```

Every script takes `--lang en|zh-CN` for its messages (default English; `zh` is accepted as `zh-CN`). The film's voice and subtitles are English. `film.mjs` finds Chrome on the usual paths; elsewhere pass `--chrome <path>` or set `CHROME`.

## Write story.json (the Agent step)

Use **MiniMax M3.1 flash through SandBase** (`sandbase_minimax_minimax_m3_1_flash`). Format and rules: `references/story.md`. In short:

1. Pick 7-9 eras from the city's founding to today. Each needs a year, a short label, one or two spoken sentences, a colour and an extent. Each era should add visible ground or change; the film is about growth.
2. For each extent, prefer a real OpenStreetMap reference with an accurate `polygons` fallback: a mapped wall, the boulevards that replaced a demolished wall, a ring road, or the administrative boundary. Use `glow` + `radius` where the edge is unknown.
3. Add up to two landmarks or events per era, each with a coordinate, a title and an illustration prompt.
4. Fact-check every narration line, attribution and date before step 3 of Run. Voice and pictures cost money; a wrong sentence means paying for that clip again (delete its mp3 and re-run).
5. Validate with `node $S/scripts/resolve.mjs <city>`: it repairs obvious format slips, lists every problem before fetching anything, and says which outlines came from OSM and which from your fallback.

Keep each model request small: the top level first, then one era per request (reasoning effort low). Sync requests that run past about two minutes are dropped by the SandBase CLI, so asking for the whole story at once usually fails.

## What the scripts do

- `resolve.mjs`: checks the story, turns each OSM reference into a closed outline (farthest point per bearing around the remains, outliers clamped, gaps filled) or keeps it as lines, and downloads the basemap: major roads across the whole story, small streets and buildings over a disc up to 14 km wide around the historic core, and rivers. Outlines come from the Overpass API (mirrors rotate with retries); the basemap comes from OpenFreeMap vector tiles. Everything is cached in `<city>/cache/`.
- `media.mjs`: without `--confirm`, prints the plan and estimated cost and spends nothing. With it, generates one narration clip per line (MiniMax Speech 2.8 HD) and one illustration per event prompt (Qwen Image 3, text prompt only, one house style). Existing files are kept.
- `film.mjs`: inlines everything into `film.html` (one self-contained page; `window.render(t)` draws frame t), renders it frame by frame in headless Chrome, and lays the narration in (loudness normalised). Each era lasts as long as its narration.

## Honesty in the film

- Outlines are reconstructions; the on-screen credit says so, and so should the narration where it matters ("about", "c."). Areas are computed from the outlines and shown as approximate (`≈`).
- Illustrations are AI-generated and labelled "AI illustration" on every card.
- Map data © OpenStreetMap contributors (ODbL), OpenMapTiles (basemap tiles via OpenFreeMap) and Natural Earth are credited on screen.

## Failure boundaries

- The language model gets facts and coordinates wrong: misattributed walls and fallback outlines several kilometres off are common. Review the narration and the stills before paying for media.
- Walls with little left in OpenStreetMap fall back to your `polygons`; the resolver warns for each one.
- The lights need buildings in OpenStreetMap: dense historic centres look best; sparse areas show streets only.
- Public Overpass servers are often busy. The resolver retries across mirrors; if all fail, try again later (the basemap does not depend on them).
- One city per film, English voice and subtitles, 16:9 1080p at 30 fps. A 2-minute film renders in about 15-20 minutes on a laptop CPU.
- Cities that straddle the 180° meridian are not supported.

## FAQ

- **Can I change the voice?** Set `voice` in `story.json` to another SandBase MiniMax voice id. Text and voice are English only in this version.
- **Can I end on my own card?** Set `endCard.title` and `endCard.sub`; without it the film fades to black after the rings.
- **Does it need a GPU?** No. Chrome renders on the CPU.
- **Where do keys go?** Nowhere. The SandBase CLI uses its own login, or `SANDBASE_API_KEY` from the current environment.

Licences: `references/LICENSE.txt` (MIT, this package) and `references/third-party.md`.
