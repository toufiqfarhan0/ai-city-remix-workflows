# Hosting and embedding

`npm run build:single` writes one offline HTML with no external URLs (about 1.7 MB with fonts and score). It runs under Lab's sample CSP: `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`. The third-party notices are embedded as an HTML comment right after `<meta charset>`; keep it.

Query parameters: `lang=en|zh-CN` (default English), `embed=1` (compact layout), `quality=high|low` (low turns off antialiasing and halves the shadow map; phones default to low) and `capture=1` (adds `script` and `step`, no autoplay, hides the live controls). In an iframe the page posts `stone-stars-city:ready` or `stone-stars-city:error` (`code: 'webgl'`) to the parent. The full-screen button is hidden inside iframes.

The score needs a user gesture inside the frame; an embedding page cannot start it. Do not copy private reference media, credentials, generation records or local paths into a hosted artifact.
