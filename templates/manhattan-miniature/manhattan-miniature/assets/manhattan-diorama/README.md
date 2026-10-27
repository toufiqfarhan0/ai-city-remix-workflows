# Manhattan Diorama

An interactive React/TypeScript/three.js miniature of Manhattan: road-first planning, ten architecture families, dedicated landmarks, the Vessel at Hudson Yards, traffic, pedestrians, boats, and day and night lighting. Builds into one offline HTML file.

Requires Node.js 22.4 or newer, a WebGL 2 browser, and for `shoot` / `record` the system Chrome (and FFmpeg for `record`).

```sh
npm ci
node tests/run.mjs
npm run dev
npm run build:single
npm run shoot -- --file dist-single/index.html
npm run record -- --file dist-single/index.html --out film
```

Eight landmark buttons, Day / Night, auto rotate, reset, drag to orbit, right-drag or arrow keys to pan, wheel or + / − to zoom; screenshot and fullscreen outside a sandbox. `?lang=zh-CN` switches to Simplified Chinese, `?embed=1` shows the embed layout, `?capture=1` enables frame stepping, `?view=topdown|lower|midtown|vessel` is a debug starting viewpoint.

Geography is artistically compressed; building counts and proportions are not survey data. No API key is required and nothing is fetched at runtime. The SandBase mark is brand material, not an endorsement or a trademark licence.
