# Verify a runnable package and a film

## What `npm run shoot` proves

It serves the single file on 127.0.0.1 under the Lab sample CSP and drives headless Chrome:

- Interactions, each with the state change and a pixel difference: `visit` (building button), `view` (Detail framing, closer camera), `orbit` (mouse drag), `zoom` (wheel), `reset`, `light` (keyboard End on the slider: day 0 → 1 and the labels read Day) and `play` (the tour clock advances).
- Layout: full composition at 1600×900 (en, zh-CN, low tier), compact at 390×844 (touch zoom and touch orbit) and the 345×345 embed (touch on building, framing and zoom). Every visible control is inside the viewport and not covered.
- Autoplay outside capture, no autoplay under reduced motion, deterministic capture (same pixels for `script(11)` after other states and a backward seek), and a clean night hold before 8.5 s and day hold after 13.5 s.
- No console errors, external requests or CSP violations; audio stays `none`.

Thresholds live in `scripts/shoot.mjs`. Headless frame rates are indicative, not device acceptance.

## Film

`npm run record -- --file dist-single/index.html --out film` steps `script(t)` frame by frame at 1920×1080. Check the file itself:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames -of json film/film.mp4
ffmpeg -v error -i film/film.mp4 -f null -
```

Expect one h264 video stream, 1920×1080, 30 fps, 600 frames, 20 s and no audio stream. Inspect frames at the shot boundaries and through the transition for clipped finials, railing gaps, cropped panels and unreadable text, then watch the whole film; a still proves composition only.

## Release contents

Test a freshly extracted ZIP: `new-project`, `npm ci`, `build:single`, `shoot`, `record`. Keep sources, the manifest and lockfile and the notices. Exclude `node_modules`, `dist`, `dist-single`, `shots`, films, credentials and machine-specific paths.
