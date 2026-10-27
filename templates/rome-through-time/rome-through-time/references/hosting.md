# Hosting and embedding

`npm run build:single` writes one offline HTML with no external URLs. It runs under Lab's sample CSP: `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`. The third-party notices are embedded as an HTML comment right after `<meta charset>`; keep it. Fonts are system fonts; no web font is loaded.

Query parameters: `lang=en|zh-CN` (default English), `embed=1` (compact dock), `quality=high|low` (low turns off antialiasing and halves the shadow map; phones default to low) and `capture=1` (adds `script` and `step`). In an iframe the page posts `rome-through-time:ready` or `rome-through-time:error` (`code: 'webgl'`) to the parent; the full-screen button is hidden there. The historical notes cite their sources as text rather than links.
