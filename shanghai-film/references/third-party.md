# Third-party components and data

## npm dependencies (installed by `npm ci`, not bundled)

| Package | Version | Licence | Used for |
|---|---|---|---|
| three | 0.170.0 | MIT | 3D rendering (inlined into `film.html`) |
| playwright-core | 1.56.1 | Apache-2.0 | driving Chrome to render frames |
| @mapbox/vector-tile | 3.0.0 | BSD-3-Clause | decoding OpenFreeMap tiles |
| pbf | 5.1.2 | BSD-3-Clause | decoding OpenFreeMap tiles |

Each package's licence file is in its own `node_modules/<name>/` folder after install.

## Data

See `references/data.md`. A film made with this Skill is a Produced Work of ODbL databases (OpenStreetMap, Colouring Cities): keep the on-screen credits.

## Generated media

- Narration: MiniMax Speech 2.8 HD through SandBase, generated per run. Check the model terms on SandBase before commercial use.
- Score: synthesised in code by `scripts/lib/score.mjs`; no samples.
