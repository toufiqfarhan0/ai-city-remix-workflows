# Verify a runnable package and a cover

## Without a browser

`node tests/run.mjs` bundles the geometry, traffic, diversity and planning checks with a Vite SSR build and runs them: landmark envelopes, ten building families, a connected road graph, signal stops, camera collision and the Vessel stairs.

## What `npm run shoot` proves

It serves the single file on 127.0.0.1 under the Lab sample CSP and drives headless Chrome:

- Interactions at 1600×900 (en, high tier), each with the state change and a pixel difference: `landmark` (button, card title, `aria-pressed` and camera target agree after the flight), `night` (night above 0.9, status text), `orbit` (mouse drag), `pan` (right-drag moves the target without turning), `zoom` (wheel out, then + flies in), `reset` (camera and target back home, card closed, rotation off) and `rotate` (the view turns with no input).
- `landmarks-all`: all eight buttons, with the camera never inside a building.
- Sandbox: screenshot, fullscreen and the external link are hidden and the brand is a plain mark; an `unrestricted` run without the sandbox shows them, still with no requests or CSP violations.
- Layouts: full at 1600×900 (en, zh-CN, low tier), compact at 390×844 (touch orbit, touch landmark, low tier) and the 345×345 embed in both languages (touch on landmark, Night, + and Reset; every visible button inside the viewport and not covered; the hint in the page language).
- Ready within 10 s, at least 24 fps on both tiers, the capture API, deterministic capture (two fresh pages, the same script and steps, the same pixels), reduced motion (a landmark click cuts within one frame).
- No console errors, external requests or CSP violations; audio stays `none`.

Thresholds live in `scripts/shoot.mjs`. Headless frame rates are indicative, not device acceptance.

## Cover

`npm run record -- --file dist-single/index.html --out film` steps `script(t)` frame by frame at 1920×1080. Expect one h264 stream, 30 fps, 360 frames, 12 s, no audio:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames -of json film/film.mp4
```

Watch the whole clip: the flights must not cut through towers and the night must arrive before the final overview.

## Release contents

Test a freshly extracted ZIP: `new-project`, `npm ci`, `node tests/run.mjs`, `build:single`, `shoot`. Exclude `node_modules`, `dist`, `dist-single`, `shots`, films, credentials and machine-specific paths.
