# Verify a runnable package and a film

## What `npm run shoot` proves

It serves the single file on 127.0.0.1 under the Lab sample CSP and drives headless Chrome:

- Interactions, each with the state change and a pixel difference: `era` (stop button to 1300), `year` (keyboard End on the timeline: 2026, labels read 2026 and Modern Rome), `orbit` (mouse drag), `zoom` (wheel), `reset` (camera returns home), `play` (the year advances) and `notes` (the historical notes open).
- Layout: the full composition at 1600×900 (en, zh-CN, low tier), the compact dock at 390×844 (touch era stop and touch orbit) and the 345×345 embed (touch era stop). Every visible control is inside the viewport and not covered.
- No autoplay, reduced motion, deterministic capture (same pixels for `script(12)` after other states and seeks) and the film's year schedule (125, 600 at 2 s, 2026 at 21.8 s and after).
- No console errors, external requests or CSP violations; audio stays `none`.

`npm test` runs the 19 history and camera tests. Thresholds live in `scripts/shoot.mjs`. Headless frame rates are indicative.

## Film

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames -of json film/film.mp4
ffmpeg -v error -i film/film.mp4 -f null -
```

Expect one h264 stream, 1920×1080, 30 fps, 750 frames, 25 s and no audio; the scored copy adds one AAC stream. Inspect frames at 0, 2, 8, 15, 21.8 and 23–25 s and watch the whole film; listen to the scored copy.

## Release contents

Test a freshly extracted ZIP: `new-project`, `npm ci`, `npm test`, `build:single`, `shoot`, `record`. Exclude `node_modules`, `dist`, `dist-single`, `shots`, films, scores and machine-specific paths.
