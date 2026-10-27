# Rome Through Time — Complete Reusable Project Prompt

> In this package the reference app is `assets/eternal-city`; deterministic capture is `window.__scene.script(t)` driven by `npm run record`, and the optional score comes from `scripts/compose-score.py`. The sections below are the original design brief.

Copy this brief into an AI development tool capable of editing code, verifying browser behavior, and exporting local files. Adjust output paths to the current workspace. Use model services only when configured and authorized.

You are a creative engineer specializing in Three.js, architectural visualization, interaction design, and cinematic production. Build a working, interactive Rome time machine and deliver editable source plus a finished promotional film. Improve existing implementations in place when available. Complete implementation, execution, verification, recording, and delivery; a proposal or code excerpt is insufficient.

## 1. Intended result

Create a warm, finely detailed, museum-style miniature Rome that evolves continuously from AD 125 to 2026. The same city and surviving monuments must experience prosperity, decay, reuse, rebuilding, and conservation across nearly two millennia.

Include a fixed rounded relief base, the Colosseum, Roman Forum, Palatine remains, surrounding period housing, churches, palazzi, streets, and vegetation. Modern Rome includes roads, cars, buses, streetlights, and visitors.

The real interactive product includes SandBase Lab / AI City Remix branding, the left-hand “Rome Through Time.” title, a right-hand historical narration card, a continuous bottom timeline, playback and view controls, and orbit/zoom/pan exploration. Default all visible copy and delivery documentation to English.

Deliver a 25-second, 1920×1080, 30 FPS H.264 MP4 showing the actual product interface, with an original orchestral-style score. Also deliver an identical silent version.

## 2. Technical approach

Use JavaScript or TypeScript, Three.js, Vite, OrbitControls, procedural architectural geometry, and FFmpeg or an equally reliable local encoder. Preserve a working existing architecture. Commercial 3D libraries are unnecessary. Capture the actual application rather than substituting generated video. Keep API keys out of browser code. Normal exploration and historical playback require no model calls.

If authorized SandBase assistance is available, verify current capabilities before calling it. The approved reference model is MiniMax M3.1 Flash, `minimax/minimax-m3.1-flash`, not H3.1 Flash. Do not invoke paid music/video services without authorization or report failed calls as successful generation.

## 3. Visual direction

Use warm, bright, restrained architectural miniatures, clear depth, and realistic soft shadows. Reference colors: background `#eeeadd`, deep olive text `#384130`, terracotta accent `#a65e40`. Buildings use limestone, pale plaster, and weathered stone; roofs vary between terracotta and brown-red. Planting uses olive, deep green, and cypress tones. Modern asphalt must contrast clearly with archaeological ground.

Avoid uniform beige, repeated boxes, identical roofs, blank side walls, heavy fog, blown-out lighting, theatrical particles, explosions, futuristic effects, and skyscrapers used as a shorthand for modern Rome. Add windows, doors, cornices, arcades, balconies, and shop awnings. Merge static geometry when helpful without sacrificing visible detail.

## 4. Shared geography and anchors

Use one coordinate system across all years. A reference base is approximately 32×26 units, x from -16 to 16, z from -13 to 13, with most structures below 6 units high.

| Landmark | Reference position |
| --- | --- |
| Colosseum | [8.2, 0.13, 2] |
| Roman Forum | [-6.2, 0, -2.3] |
| Palatine | [-1, 0.75, 6.7] |

Keep the Colosseum root's object identity, position, rotation basis, and scale `[1,1,1]` unchanged. These are artistic composition coordinates, not survey measurements. Organize neighborhoods and roads around these anchors. Do not transplant distant landmarks such as St Peter's or the Trevi Fountain into this district.

## 5. Continuous historical system

Support exact continuous years from 125 to 2026. Imperial Rome (125), Medieval Rome (1300), Baroque Rome (1700), and Modern Rome (2026) are narrative milestones within one persistent world.

Never clear the whole city at a milestone, replace the entire Colosseum, crossfade entire era scenes, raise or erase whole neighborhoods together, stretch every building vertically, substitute a nearest-era snapshot for intermediate years, or retain incorrect state after reverse scrubbing.

A suitable architecture includes HistoricalEntityRegistry, HistoricalEventTimeline, BuildingLifecycleController, LandmarkEvolutionController, UrbanEnvironmentController, and ContinuousTimeController. Give each building/component a stable ID and explicit construction, renovation, weathering, damage, demolition, reuse, preservation, and evidence/confidence metadata.

Compute every visible and hidden state directly from the exact year. Identical years must yield identical visibility, material color, opacity, clipping, transforms, vegetation, and vehicle positions, regardless of previous playback direction or frame count. Avoid fresh random state during updates.

## 6. Distinct mechanisms of change

Construction reveals foundations, walls, upper floors, and roofs locally, using clipping or components rather than vertical stretching. Weathering ages stone; roofs disappear before supporting fabric; upper walls lose sections while foundations or lower walls survive. Give buildings staggered intervals.

Demolition occurs individually. Adaptive reuse preserves recognizable older fabric while adding homes, religious uses, facades, or extensions. Historic palazzi remain identifiable in modern surroundings. Conservation retains ruins and adds archaeological boundaries, paths, railings, signs, visitors, and modern infrastructure. Use smooth local fades without noisy dithering.

## 7. The Colosseum as the narrative anchor

Build a persistent component-based elliptical monument: approximately 64 outer bays, three principal arcade tiers plus an attic, inner arcades, stepped seating, arena surface, and later exposed underground structures. These are implementation scales, not archaeological measurement claims.

- **125:** continuous outer arcades, complete attic, recognizable arena and seating, relatively clean pale stone, ordered classical surroundings.
- **1300:** missing outer wall sections, exposed inner structures, retained northern core, small reused dwellings, weathered stone, rubble and vegetation, nearby towers, houses, and churches.
- **1700:** further upper/inner losses, reused dwellings receding, recognizable ancient core, surrounding palazzi, churches, and formal public spaces.
- **2026:** recognizable conserved ruin, exposed hypogeum and archaeology, protective supports, visitor infrastructure, and clearly modern street life.

Do not replace the whole monument. Avoid unverified attribution of precise losses to individual years or events. Medieval domestic reuse may use broad tenth-to-thirteenth-century evidence intervals.

## 8. Historically distinct neighborhoods

Imperial surroundings include temples, colonnades, public monuments, insulae, domus, enclosed courts, stone paving, marble, and tiled roofs. Medieval surroundings include smaller irregular homes, towers, Romanesque churches, narrow passages, gardens, grazing land, vegetation, and ancient walls incorporated into later structures.

Baroque surroundings include palazzi, formal courts, decorative facades, domes, cornices, church fronts, small squares and fountains, warm stone, and red roofs among surviving ancient remains. Modern surroundings include historic Italian blocks, balconies, shops, awnings, rooftop equipment, dark asphalt, curbs, lane markings, crossings, cars, buses, street/traffic lights, visitors, benches, paths, and conservation rails.

Road markings and curbs must actually be mounted in the persistent scene; an asset inventory alone is insufficient. Anonymous blocks may be interpretive, but scale, type, and layering should be plausible. Building counts serve composition and narrative; they do not constitute historical evolution by themselves.

## 9. Readable English product interface

Keep the interface real and functional. The top bar contains SandBase Lab / AI City Remix, Play/Pause, Reset view, and Fullscreen. Set a large left-hand serif title on three lines:

```text
Rome
Through
Time.
```

Accent “Time.” in terracotta. Subtitle: “One city. 2,000 years of change.”

The right-hand card contains chapter number, current year, period heading, a concise historical paragraph, three principal changes, a LANDMARK TRANSFORMATION heading, and a monument explanation.

At 1920×1080 use approximately: card width 320px, padding 24px, description 16px, change list 14px, landmark paragraph 15px, section label 10px, period heading 34px, year 58px, body color `#525c49`, and line height 1.6–1.65. Body copy must remain readable in the exported film. Prevent overflow, cropping, timeline overlap, and excessive obstruction of the city.

Remove the “Explore the city” section and its three Colosseum / Roman Forum / Palatine Hill shortcut rows.

Keep the bottom continuous timeline visible, labeled 125 AD / 1300 / 1700 / 2026, with current year, progress, era labels, playback control, concise interaction hints, and an artistic-reconstruction notice. Use Libre Caslon Display and DM Sans or close alternatives with system fallbacks. Offline operation must remain usable.

## 10. Manual exploration

Support continuous timeline scrubbing, milestone clicks, orbit, zoom, pan, reset, play, pause, resume, and replay. Manual input interrupts automatic camera direction. Reverse scrubbing must restore the exact historical state.

Milestones may have equal visual spacing if their positions map correctly to real continuous years. Round displayed year labels only; retain fractional years in the scene engine.

## 11. Twenty-five-second historical pacing

| Film time | Year |
| --- | --- |
| 0.0s | 125 |
| 0.5s | approximately 266 |
| 2.0s | 600 |
| 8.0s | 1300 |
| 15.0s | 1700 |
| 21.8s | 2026 |
| 25.0s | 2026 |

Start advancing immediately, allow no opening still longer than 0.5 seconds, and show visible architectural change within 2 seconds. Give intermediate periods rhythmic emphasis without long pauses. Reach modern Rome at 21.8 seconds; the final two seconds are a perfectly stable modern panorama.

For 0≤t<2, use `u=t/2` and `year=125+475*(u+u*u-u*u*u)`. After 2 seconds, interpolate monotonically between year keys with smoothstep or equivalent continuous easing. Synchronize the year, timeline, narration, and geometry.

## 12. Cinematic camera direction

Use a gentle opening push, approach toward the Colosseum during the medieval passage, lateral travel through the Baroque passage, a restrained modern orbit, and a final pullback revealing the complete city. Avoid fast spins, cuts, drastic zooms, collisions, losing the Colosseum, or hiding the city under the interface.

| Time | Position | Target |
| --- | --- | --- |
| 0s | [33,31,40] | [0,0.5,0] |
| 2s | [31,29,38] | [1,0.7,0.5] |
| 8s | [27,25,35] | [2.5,0.8,1] |
| 15s | [15,27,43] | [0,0.8,0] |
| 19.5s | [29,22,36] | [2,0.8,0] |
| 22s | [31,28,39] | [0.8,0.3,0] |
| 23s | [32,30,40] | [0,0,0] |
| 25s | [32,30,40] | [0,0,0] |

Reference FOV: 36 degrees. Use time-aware cubic Hermite interpolation or equivalent with continuous position/target velocity. Arrive at the final composition at 23 seconds with zero velocity; hold exactly to 25 seconds. Repeated final keys must not create spline overshoot. Verify framing against the actual scene and make small adjustments while preserving the narrative timing.

## 13. Original orchestral-style score

Create original music or use material with verified promotional/social-media permission. Aim for an epic, historical, dignified, warm, emotionally developing documentary score. Avoid copyrighted film music or imitation of a specific composer's signature work.

- 0–2s: immediately recognizable cello/string motif.
- 2–8s: low strings and restrained timpani.
- 8–15s: fuller strings and an ascending melody.
- 15–22s: brass, strings, and moderate percussion build.
- 22–25s: clear, elegant resolution and a natural tail.

When reliable licensed music is unavailable, compose locally with original notes, mathematical waveforms/harmonics, detuned string layers, cello/brass/timpani envelopes, subtle vowel textures, and algorithmic reverb. F minor resolving to F major at approximately 96 BPM is a useful starting point; fit the 25-second edit.

Do not call paid generation services without authorization, describe synthesized instruments as a live orchestra, or claim third-party material is royalty-free without checking its license. Deliver 48kHz stereo with approximately -16 LUFS integrated loudness, safe peaks, no clipping, an immediate opening, and a natural ending completed within 25 seconds. Document composition method, sources, and permissions.

## 14. Capture and encoding

Capture the actual WebGL scene and actual DOM title, narration, year counter, and timeline. Do not redraw a substitute interface in another canvas. Include the complete interface without browser chrome, address bars, debug content, capture controls, pointer artifacts, extra title cards, outros, or logo animations.

Prefer deterministic capture: set a 1920×1080 page, expose a recording-only frame-index control, seek frame n to n/30 seconds, wait for both scene and DOM readiness, save exactly 750 frames, capture the full page width, encode at 30 FPS, then mux music. With CUA, verify `fullPage:true` output dimensions rather than trusting a narrower visible browser surface.

Use libx264, CRF 17–18, slow preset or equivalent, yuv420p, H.264 High profile, MP4 fast-start, and stereo AAC. Other capture methods must still prove frame rate, complete UI, and synchronized timing. The last 60 frames must show the same stable image.

## 15. Verification

Run checks before reporting completion. Inspect all four milestones from the same angle plus intermediate years. Confirm distinct Colosseum intact/reused/ruined/conserved states, stable root identity and transforms, staggered changes, no city resets, path-independent forward/reverse scrubbing, and visible modern roads, markings, cars, and buses.

Review camera continuity, visibility of the Colosseum, collisions, and final hold. Check complete branding/title/year/era/timeline visibility, readable narration sizes, no overflow, no Explore shortcuts, and synchronization between text and geometry.

Verify the final MP4: approximately 25.00 seconds, 1920×1080, 750 frames, 30 FPS, H.264, scored audio where requested, safe peaks, musical development, and a natural ending. Scored and silent versions must share video content. Fully decode the files. Actually play the encoded output and review opening, medieval, Baroque, modern, and final passages. Technical measurements, visual inspection, listening, and user acceptance are separate statuses.

Do not claim completion before files exist or report planned checks as passed checks.

## 16. Deliverables

Deliver complete editable source; an English README covering running/building/recording; `outputs/rome-through-time-25s.mp4`; `outputs/rome-through-time-25s-silent.mp4`; capture/export scripts; camera and year schedule; original soundtrack and composition source or verified license details; a final interface screenshot; and an honest validation record.

Report duration, resolution, frame rate, soundtrack provenance, major completed features, and historical details that remain artistic approximations.

The final experience should convey one persistent Rome: ancient structures gradually lose fabric, acquire new uses, become surrounded by later urban life, and survive as protected heritage. Readable interface design, restrained camera motion, continuous architectural change, and emotionally shaped music should make nearly two millennia legible within 25 seconds.
