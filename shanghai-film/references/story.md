# story.json

One file describes the film. The agent writes it; the scripts build the city, voice and render it.
Coordinates are `[lat, lon]`. All spoken and on-screen text is English.

```json
{
  "version": 1,
  "title": { "en": "London: Every Building, Year by Year" },
  "subtitle": "Two thousand years on one square mile and its neighbours",
  "city": { "name": "London", "bbox": [51.495, -0.150, 51.525, -0.070], "center": [51.5085, -0.1075] },
  "voice": "English_CaptivatingStoryteller",
  "intro": "One spoken sentence over today's city.",
  "outro": "One spoken sentence over the end card.",
  "sources": ["https://…"],
  "credits": ["Building years: Colouring London contributors (ODbL)", "…"],
  "landmarks": [{ "id": "pauls", "name": "St Paul's Cathedral", "year": 1710, "at": [51.51378, -0.09831] }],
  "outlines": [{ "id": "wall", "name": "Roman wall (reconstruction)", "from": 200, "to": 1680, "ring": [[51.5089, -0.0760], "…"] }],
  "eras": [
    { "id": "fire", "from": 1640, "to": 1670, "seconds": 7, "label": "The Great Fire · 1666",
      "narration": "One or two sentences, at most 40 words.",
      "camera": { "target": [51.5125, -0.0920], "dist": 3600, "pitch": 54, "yaw": -20, "to": { "dist": 3200, "yaw": -10 } },
      "events": [{ "kind": "fire", "year": 1666, "at": [51.5125, -0.0900], "radius": 1000 }] }
  ]
}
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `version` | yes | `1` |
| `title.en` | yes | ≤ 48 characters |
| `subtitle` | no | under the title |
| `city.bbox` | yes | `[south, west, north, east]`, at most about 0.1° × 0.1° |
| `city.center` | no | projection centre; default the middle of the box |
| `voice` | no | SandBase MiniMax voice id |
| `intro`, `outro` | no | spoken over the title (today's city) and the end card |
| `sources` | yes | links or citations behind every fact in the narration |
| `credits` | no | lines on the end card; credit every data source and its licence |
| `landmarks` | no | `{ id, name, year, at, height? }`. The footprint under `at` takes this year (and height) and is named on screen when it rises |
| `outlines` | no | `{ id, name, from, to?, ring }`: a vanished wall drawn as a low glowing line from `from`, gone after `to`. Always say "reconstruction" in `name` |
| `eras` | yes | 5-14, in time order |
| `eras[].from`, `to` | yes | the city clock runs from `from` to `to` over the era |
| `eras[].seconds` | yes | 4-30; the era also lasts at least as long as its narration clip plus 1.4 s |
| `eras[].label` | yes | ≤ 40 characters, shown under the year |
| `eras[].narration` | yes | ≤ 40 words, ≤ 230 characters; spell numbers as spoken |
| `eras[].camera` | yes | `target [lat, lon]`, `dist` (m), `pitch` (°), `yaw` (°); `to` overrides any of them at the end of the era |
| `eras[].events` | no | `{ kind: fire|blitz|flash, year, at, radius, at01? }`. A fire or blitz holds the city clock at its year for a moment while it burns, at `at01` of the era (default 0.35) |
| `eras[].victorian` | no | `true` on the era that shows the historic footprint layer (`--victorian`) |

## Writing a good story

- Each era should change the picture: a landmark rising, a fire, a wave of buildings. Eras with few dated buildings (most cities before 1700) are short and close to their landmark.
- Keep the camera moving slowly (`to` differs by a few hundred metres or 10-20° of yaw) and let each era start from a different view.
- The film is honest about missing data: never claim a grey (unrecorded) building is old or new.
