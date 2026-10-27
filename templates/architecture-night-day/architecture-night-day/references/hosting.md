# Hosting and embedding

`npm run build:single` writes one offline HTML with no external URLs. It runs under Lab's sample CSP: `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`. The third-party notices are embedded as an HTML comment right after `<meta charset>`; keep it.

Query parameters: `lang=en|zh-CN` (default English), `embed=1` (compact layout), `quality=high|low` (low turns off antialiasing and halves the shadow map; phones default to low) and `capture=1` (adds `script` and `step`, no autoplay). In an iframe the page posts `architecture-night-day:ready` or `architecture-night-day:error` (`code: 'webgl'`) to the parent. The full-screen button is hidden inside iframes.

Do not copy private reference media, credentials, usage console records or local paths into a hosted artifact. Historical sample usage in `usage.json` is labeled history, not a measurement of a visitor's run.
