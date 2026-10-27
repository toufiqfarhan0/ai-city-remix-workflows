---
name: landmark-buildup
description: Raise a city landmark in 3D stone by stone from a recipe, then dismantle it to see inside. Walls with real openings, arches, turrets, copper shells on iron frames, day to dusk light, a film.
version: 0.2.2
---
# Landmark Build-Up

Describe a masonry landmark as a recipe and watch it go up. The kit lays foundations, then walls course by course with real voids for doors, windows and cannon ports and voussoirs over every arch, then terraces, battlements, sentry turrets with ribbed domes, an arcaded loggia, string courses and roofs. Every one of the five thousand pieces is a solid that falls into its seat at its own time; one progress value drives all of them on the GPU, so scrubbing backwards and forwards is exact. The light runs from day through golden hour to a floodlit dusk. The dismantle slider takes a building apart: masonry slides outward, and a statue's shell is cut away on one side, top to bottom, so you can orbit around the frame inside while the silhouette stays. The included sample, River Bastion, is an interpretive model of the Torre de Belém in Lisbon. A second published example, Liberty Unveiled, builds the Statue of Liberty: an eleven-point star fort, a stepped foundation and a granite pedestal, an iron pylon with armature bars, then a copper skin hung plate by plate, the tablet, the crown and the torch, and cuts the front of the skin away to show the pylon. A brick campanile recipe also runs on the same code.

## Example

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/river-bastion.json --out prompt.md
node scripts/new-project.mjs --out my-landmark
cd my-landmark && npm ci
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

`record` writes `film/film.mp4` (the sample is 40 s, 1920×1080, 30 fps, silent) and `film/poster.jpg`; `--cover` records only the 30 s build. A landmark is two files: `src/landmark/recipe.json` (palette, construction stages with labels in both languages, the parts and the page copy) and `src/landmark/film.json` (duration, build window, light keys, shots and the view presets). To try another example, copy `assets/prompts/examples/liberty-unveiled.recipe.json` (or `brick-campanile.recipe.json`) over `src/landmark/recipe.json` and the matching `.film.json` over `src/landmark/film.json`.

## Controls

Play or pause the build (Space), scrub the build, click a stage to jump to its end, pick a view (overview, loggia, turret, crown), drag to orbit, use the wheel or the + / − buttons to zoom, move the light slider from day to dusk, drag the dismantle slider to pull the pieces apart, and reset the view. The build plays by itself unless reduced motion is requested. Desktop windows show the full layout with the stage list; phones, small windows and `?embed=1` show a compact strip. `?lang=zh-CN` switches the interface to Simplified Chinese. The page is silent.

## How it works

Read [method.md](references/method.md) for the recipe language, the assembly and the film, [lessons.md](references/lessons.md) for what is most likely to go wrong, [prompt-slots.md](references/prompt-slots.md) for the brief, [verification.md](references/verification.md) for what `shoot` proves and [hosting.md](references/hosting.md) for embedding.

## Credentials, cost and failure boundaries

No keys, model calls or runtime network. Geometry and textures are generated in the browser. An invalid recipe or film file fails with a localized message (`data`); missing WebGL shows a localized message. Missing Chrome or FFmpeg stops `shoot` or `record` with a localized error. Headless frame rates are indicative, not device acceptance.

## FAQ

- Is it accurate? It is an interpretive model with simplified proportions and ornament; say so for every landmark you build. Check the real building's form (storeys, openings, turrets) before writing its recipe.
- What can the kit build? Masonry forms (platforms, coursed walls on any footprint, openings and arches, battlements, round turrets with domes, loggias, string courses, stepped roofs) and hollow sculpture on a frame (a draped figure from elliptical sections, limbs along a path, an iron pylon, armature bars, crown rays, a tablet, a torch flame). Timber framing and curved roofs need new part types.
- Can I change the order? Yes. Stages are time windows; parts in the same stage rise together, and `window` places a part inside its stage (a string course as the walls pass it).
