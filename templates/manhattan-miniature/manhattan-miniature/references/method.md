# Build and adaptation method

The code-scene contract in `hosting.md` and `verification.md` overrides the delivery and test sections of `accepted-brief.en.md` (single offline HTML file, embed rules, no downloads or fullscreen inside a sandbox).

## Starting point

`scripts/new-project.mjs` copies `assets/manhattan-diorama` (the actual city, not a placeholder). Install from the lockfile; never install or build inside the Skill's assets. The sample has about 100 structures, 87 ordinary parcels, 121 road edges, 79 junctions and 42 blocks. These counts document the sample, not a target. The city is geographically compressed.

## Module map

- `urbanPlan.ts`: reserved sites, connected planar road graph, block faces and parcel subdivision.
- `streets.ts`: graph types, occupancy helpers, signal timing and collision envelopes.
- `architecture.ts`: instanced and merged facade geometry, materials and distance-based detail.
- `archetypes.ts`, `newArchetypes.ts`, `aiProfiles.ts`: ten ordinary building families and their variants (static authoring data).
- `landmarks.ts`, `downtownLandmarks.ts`, `chryslerArch.ts`, `vessel.ts`: dedicated landmark geometry and the debug view presets.
- `urbanEnvironment.ts`, `waterMotion.ts`: sidewalks, crossings, signals, greenery, shoreline, bridges and water.
- `cityLife.ts`, `models.ts`: traffic, pedestrians, vehicles and boats.
- `cameraSafety.ts`: keeps the camera out of buildings.
- `city.ts`: scene composition, lighting, quality tiers, the virtual clock (`tick(dt)`) and the camera API (`focus`, `zoom`, `reset`, `orbitBy`, `panBy`, `state`).
- `App.tsx`, `style.css`, `skill-config.ts`, `i18n/strings.json`: controls, cards, layouts, brand and both languages.
- `capture.tsx`: `window.__scene` (inspect, act, pointer, and in capture mode `step` and `script`), the ready and error handshake.

## Capture contract

All motion runs from `tick(dt)`: camera flights (1.4 s), day/night easing, traffic, water and the shadow refresh use virtual time. Live pages tick from `requestAnimationFrame` with dt capped at 50 ms. With `?capture=1` nothing moves until `__scene.step(n, dt)`, and `__scene.script(t)` plays the cover cues (day overview drift, Empire State at 3.0 s, Vessel at 5.6 s, night at 8.0 s, reset at 8.2 s, night overview from 9.6 s; 360 frames at 30 fps, poster at 1.5 s). Seeking backwards returns to the start state; traffic is not rewound. `act()` wraps the UI handlers in `flushSync`, so buttons, card and camera change in the same call.

## Layouts

`body[data-layout]` is `compact` below 900 px wide or 560 px high, otherwise `full`. The full layout keeps the editorial composition (brand row, title column, controls on the right, landmark bar, footer hint) and shifts the camera right of the title column. The compact layout (phones, small windows, the 345×345 embed) puts the hint at the top, the controls in one row and the landmarks in a 4×2 grid of short names. `embed=1` hides the header, the title column and the collectible line. `?view=` (topdown, lower, midtown, vessel…) is a debug starting viewpoint; Lab never passes it and capture mode ignores it.

## Changing the city

Keep the road-first order. A building-center test is not enough: use the facade and roof envelope, setbacks and the road half-width. Signals and crossings must follow diagonal approaches. When changing a landmark, check its silhouette alone and its neighborhood from two sides; keep the Vessel open with rising stairs. Camera clearance and framing are separate checks: a safe camera can still face an occluding tower. Update `landmarks`, `landmarkViews`, the strings and the expected targets in `scripts/shoot.mjs` together.

## Runtime and fonts

React + TypeScript + three.js + Vite. System fonts only; no font file or request. No service or model call at runtime.
