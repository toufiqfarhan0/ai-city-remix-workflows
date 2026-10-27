# Hosting

## Single-file build
`npm run build:single` runs, in order:
1. `tsc --noEmit && vite build`. `vite.config.ts` emits one JS chunk and one CSS file (`inlineDynamicImports`, no module preload polyfill, no CSS code split, every asset inlined).
2. `node scripts/notices.mjs dist/THIRD_PARTY_NOTICES.txt`: the licence texts of the production dependency closure in `package-lock.json`.
3. `node scripts/inline-build.mjs dist dist-single/index.html`: the JS goes into one inline module script, the CSS into one `<style>`, and the notices into an HTML comment right after `<meta charset="UTF-8" />`.

## Sandbox
The file must run inside an iframe with `sandbox="allow-scripts"` (opaque origin) under this Content-Security-Policy, verbatim:
```
sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'
```
What that means for the scene:
- No `fetch`, XHR, WebSocket or URL loads at runtime. System fonts only; the SandBase mark is inline SVG.
- No `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`.
- The environment map is procedural (`PMREMGenerator.fromScene(new RoomEnvironment())`), never an HDR file.
- Silent by design: no Web Audio.
- Downloads, pop-ups and fullscreen are blocked. When `embed=1`, inside any iframe, or in the opaque-origin document itself, the page hides Save screenshot, Fullscreen and the external link, and renders the brand as a plain mark.

## URL parameters
- `lang=en|zh-CN` (aliases `zh`, `zh-cn`, `zh-hans`, `zh_CN`; anything else is English). Sets `<html lang>` and the title.
- `embed=1` hides the header, the title column and the collectible line; the controls stay.
- `quality=low|high` forces a tier (phones and small windows default to low: pixel ratio 1, 1024 shadow map).
- `capture=1` deterministic frame stepping for recordings (`verification.md`).
- `tune` is parsed for the shared contract and has no effect here.
- `view=topdown|lower|midtown|vessel|…` is a debug starting viewpoint. Lab never passes it; capture mode ignores it.

## Embedding handshake
Only when `window.parent !== window`:
- after the first rendered frame the page posts `{ type: 'manhattan-miniature:ready', version }` with target `'*'`;
- without WebGL 2, or when the city fails to build, it shows a localized message and posts `{ type: 'manhattan-miniature:error', code: 'webgl' }`.
The frame's origin is opaque, so the parent checks `event.source` instead of the origin. Messages carry no user data.

## Before publishing
Run the static checks with the maintainer's name denylist (`bundleChecks(html, { denylist })`) over the build, and the same denylist over prompts and reports. Keep the embedded third-party notices.
