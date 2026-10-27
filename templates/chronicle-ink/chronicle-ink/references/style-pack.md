# Style pack: Ink Scroll

`assets/style-pack.json` (palette, fonts, caption budget, theme, SFX tiers, transitions, cameras, ident),
`assets/style/ink-kit.js` (drawing kit), `assets/style/ink.css` (overlays), `assets/style/exemplars/`
(two complete scenes to copy).

## Kit reference (`s.kit`)

| Group | Functions |
|---|---|
| Numbers | `rng(seed)`, `noise(x, y, seed)`, `fbm(x, y, seed, oct)`, `ease.{in,out,inOut,back}`, `prog(t, a, b, ease)`, `clamp`, `rgba(hex, a)`, `PAL` |
| Paper and ink | `paper(g, W, H, seed, tone)`, `stroke(g, pts, { w, color, alpha, dry, taper, p, seed })`, `curve(ctrl)`, `wash(g, x, y, rx, ry, o)`, `bleed(g, x, y, r, { p })`, `mist(g, W, y, h)`, `dryFill(g, x, y, w, h)` |
| Composition | `frame(size, W, H, side)` → horizon, focal point, subject scale for wide / medium / close / detail; `layer(g, s, depth, fn)` 2.5D parallax from the shot camera (0 = paper, 1 = mid ground, > 1 foreground) |
| Landscape | `mountains`, `water`, `river`, `cliff`, `grass`, `rain`, `moon`, `geese` |
| Objects | `boat`, `pavilion`, `house`, `wall`, `scroll`, `scrollRod`, `bamboo`, `plum`, `inkstone`, `brush`, `seal(g, x, y, size, text, o)`, `lattice` |
| People | `figure(g, x, y, s, { pose: standing / walking / seated / bowing, hat: tall / straw / none, flip, t })` — solid silhouettes, no faces |
| Information | `textReveal(g, text, x, y, { size, p, vertical })`, `route(g, stops, p)` (abstract terrain, no borders), `timeline(g, x0, x1, y, items, p)`, `countUp(value, p)` |

Transitions are drawn by the engine: ink-bleed (noise-threshold blot growing from the centre with a dark
rim), scroll pan (the new shot unrolls behind a scroll rod), seal stamp (a seal slams down mid-transition),
hard cut on the downbeat. Captions, knowledge cards (seal + count-up), title, badge and end card are DOM
overlays drawn by the engine.

## Do

- Keep the xuan paper ground visible; most of the frame is negative space, mist and soft washes.
- Build depth with 3–4 layers (far range pale, mid range darker, water, foreground reeds or branches) and
  give each a `layer()` depth so the camera move reads as 2.5D.
- Use brushed edges for everything: `stroke`, `dryFill`, `wall`, `house`. Ink black, mist grey, one or two
  touches of cinnabar (seal, blossoms, route) per frame; ochre and indigo washes sparingly.
- Keep the lower ~18 % calm and light: captions sit there in dark ink with a paper halo.
- Tie motion to cues: things appear, stamp, bloom and draw on the beats listed in the shot's `sfx`.
- Cache static layers (`s.cache`) so a frame costs < 100 ms on a CPU.
- People are small silhouettes from behind or far away; objects, calligraphy and landscapes carry the story.

## Don't

- No realistic faces, no living-person portraits, no photographs or photo-like shading.
- No national or provincial borders on maps; no modern objects in historical scenes.
- No flat vector slabs (plain rectangles, perfect circles) as main subjects; no dark backgrounds behind
  captions; no pure black areas larger than a seal.
- No legible invented text in the picture: only names or numbers that the shot's claims carry (seals,
  calligraphy of the art name, map labels). Everything else is abstract brush marks.
- No Math.random, Date, timers, network or DOM in scene code; no state carried between frames.
- No more than one strong focal point per shot; no clutter that fights the caption.
