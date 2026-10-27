# Verify a runnable package and a film

## What `npm run shoot` proves

It serves the single file on 127.0.0.1 under the Lab sample CSP and drives headless Chrome:

- Interactions, each with the state change and a pixel difference: `chapter` (chapter button), `orbit` (mouse drag), `zoom` (wheel), `light` (Daylight stop; the active label reads Daylight), `lanterns` (off at starlight), `life` (resume after a pause moves the street; a pause holds it still), `card` (a still click on the landmark opens the card, Escape closes it), `scrub` (the journey bar jumps the tour), `reset` and `play` (the tour clock advances).
- Layout: full composition at 1600×900 (en, zh-CN, low tier), compact at 390×844 (touch zoom and touch orbit) and the 345×345 embed (touch on chapter, zoom and lanterns). Every visible control is inside the viewport and not covered.
- Autoplay outside capture, no autoplay under reduced motion, deterministic capture (same pixels for `script(11)` after other states and a backward seek), the light schedule (golden hour until 9 s, starlight from 21 s) and the four film chapters.
- Score: `audio` is `uninitialised` before any gesture (the silent autoplay does not create an AudioContext) and `running` after the Sound button; Sound toggles mute.
- No console errors, external requests or CSP violations.

Thresholds live in `scripts/shoot.mjs`. Headless frame rates are indicative, not device acceptance.

`shoot` does not judge composition. A landmark cut off at the top of the frame, a spire behind the chapter card or an unreadable night scene all pass it. Composition is checked by looking at frames (below).

Chrome: `shoot` and `record` look for the system Chrome in its default place on macOS, Windows (`%ProgramFiles%\Google\Chrome\Application\chrome.exe`, then Program Files (x86) and `%LOCALAPPDATA%`) and Linux (`google-chrome`, `chromium`). Pass `--chrome <path>` or set `CHROME_PATH` for any other location; `playwright-core` does not download a browser.

## Film

`npm run record -- --file dist-single/index.html --out film` steps `script(t)` frame by frame at 1920×1080 and muxes the bundled score. Check the file itself:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames -of json film/film.mp4
ffmpeg -v error -i film/film.mp4 -f null -
ffmpeg -hide_banner -nostats -i film/film.mp4 -af ebur128=peak=true:framelog=quiet -f null -
```

Expect h264 1920×1080 at 30 fps with 720 frames, one AAC stream and 24 s. The sample measures about −18.5 LUFS integrated with a peak near −5.6 dBFS.

Composition review, at these times:

| t (s) | Shows | Look for |
| --- | --- | --- |
| 1, 3 | The island approach | The whole landmark inside the canvas, crown below the top edge |
| 6.5, 8, 10.5 | Move into and hold on the facade | Entrance readable; nothing (trees, houses) in front of it |
| 13, 14.5 | Move from the facade to the crown | The finial never touches or leaves the top edge mid-move |
| 17, 18 | The crown | Crown details fill the frame; nothing clipped by the near plane |
| 20, 23.9 | The island at night | Dark background, stars visible, windows and lanterns glowing |

```sh
for t in 1 3 6.5 8 10.5 13 14.5 17 18 20 23.9; do ffmpeg -v error -y -ss $t -i film/film.mp4 -frames:v 1 frames/t$t.jpg; done
```

Also check every frame for text under the canvas and fallback fonts, then watch and listen to the whole film; a still proves composition only and a loudness value is not a listening review. If a move clips the landmark, adjust its `views` anchor (raise `target`, move `from` back) rather than the shared keyframes.

## Release contents

Test a freshly extracted ZIP: `new-project`, `npm ci`, `build:single`, `shoot`, `record`. Keep sources, fonts, the score, the manifest and lockfile and the notices. Exclude `node_modules`, `dist`, `dist-single`, `shots`, films, credentials and machine-specific paths.
