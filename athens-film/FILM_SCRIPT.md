# Temple of Heaven — Through Light

20 seconds · 1920 × 1080 · 30 fps · English interface · silent.

A desktop architectural explorer with five detailed landmarks. The film includes the real control panel: landmark selection, Orbit / Detail, zoom, reset, play / pause, and a Night–Dawn–Sunrise–Day slider. In the MP4 these are recorded pixels; in the project they control the scene.

| Time | Picture and camera | Visible interaction state |
|---|---|---|
| 0.0–2.5s | Hall of Prayer, close elevated three-quarter view; orbit from 0.38 to 0.52 radians, move from 73 to 70 units. Blue roof tiles, three eaves and marble terraces fill the view. | Landmark 01, Orbit view, Night. |
| 2.5–5.0s | Cut to Huangqian Hall. Tight oblique view of roof and painted timber; yaw 0.60→0.76, distance 34→32. | Landmark 02, Detail view, Night. |
| 5.0–7.5s | Cut to Imperial Vault. Roof, finial and decorated cornice; yaw 0.28→0.40, distance 33→31. | Landmark 03, Detail view, Night. |
| 7.5–8.5s | Hall of Prayer, camera locked at yaw 0.28, elevation 0.20, distance 73, target [0,21,-75]. | Landmark 01, Orbit view; hold Night. |
| 8.5–13.5s | Same camera and geometry. Smoothly interpolate sky, stars, ambient light, sun, warm lamps and exposure. No camera motion obscures the lighting comparison. | Slider advances continuously through Dawn and Sunrise to Day. |
| 13.5–14.5s | Hold the same bright daytime composition. | Day endpoint remains visible. |
| 14.5–17.0s | Cut to Circular Mound Altar. Raking view across white marble balustrades; yaw 0.16→0.26, elevation 0.36→0.42, distance 38→36. | Landmark 04, Detail view, Day. |
| 17.0–20.0s | Cut to Hall of Abstinence. Close green-tiled roof and sheltered courtyard; yaw 0.40→0.56, elevation 0.28→0.33, distance 37→35. Ease into a stable final 0.6 seconds. | Landmark 05, Detail view, Day. Logo remains upright and unchanged through the final frame. |

Camera coordinates use Y up and north −Z. Exact targets, start/end values, descriptions and duration live in `src/scene/config.js`; `showcase-scene.js` evaluates the scene at arbitrary time, and `app.js` applies the same state to the visible controls. This is an interpretive model with compressed park spacing, not a surveyed reconstruction.

## Editing brief

Preserve the layered roofs, tiled surfaces, painted brackets, red columns, gold finials and carved marble. Keep the selected architecture prominent. Avoid an empty park overview, fly-through intersections, unreadable overlays, Chinese lettering in this English sample, invented building transformations, or day changes that only move the UI slider. The light transition must alter the rendered sky and materials while the camera stays fixed.

The project is the executed implementation. `npm run record` steps `window.__scene.script(t)` frame by frame from the single-file build and encodes the film with FFmpeg; check the result with `ffprobe` and a full decode (see `references/verification.md` in the Skill). Original modeling was generated using MiniMax M3.1 Flash through SandBase; later interface, camera and export revisions were implemented locally. Exact recorded API usage is in `usage.json`.
