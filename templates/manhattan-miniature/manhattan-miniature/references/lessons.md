# Details worth preserving

- Consume OrbitControls damping before a programmed move (`settleControls`). Otherwise leftover inertia moves the target again after the flight ends and reset misses its endpoint.
- Keep the camera guard on every frame. A flight between two landmarks can pass through a tower; the arc climbs above the tallest blocker first.
- Day and night need real lights: sun, hemisphere, fill, window and lamp emission, signs, water, fog and exposure change from one night fraction. A background swap alone looks like a filter.
- Keep the UI's safe frame. The full layout offsets the camera right of the title column; the compact layout keeps the card above the control row and the landmark grid.
- One virtual clock. Any `performance.now()` or `THREE.Clock` inside the simulation breaks deterministic capture and the cover.
- One offline file under a strict CSP: no image URLs (the brand mark is inline SVG), no fonts, no fetch. Downloads, pop-ups and fullscreen are blocked in the sandbox, so those controls are hidden there and the brand is not a link.
- three 0.186 removed `PCFSoftShadowMap`; the scene uses `PCFShadowMap` with a shadow radius.
