# story.json

One file describes the whole film. The agent writes it; the scripts do everything else.
Coordinates are `[lat, lon]` in degrees. All text the viewer sees or hears is English.

The example below shows the shape only. Everything in angle brackets is yours to research for your city; do not copy the numbers.

```json
{
  "version": 1,
  "city": { "name": "<City>", "lat": <lat of the historic centre>, "lon": <lon> },
  "title": { "en": "<City>: <a short angle>", "sub": "<one line: the span of time>" },
  "intro": "<one spoken sentence that opens the story>",
  "outro": "<one spoken sentence that closes it>",
  "endCard": { "title": "<optional last card>", "sub": "<optional line under it>" },
  "eras": [
    {
      "year": "c. <year> BC",
      "label": "<first settlement>",
      "stat": "<one short fact>",
      "narration": "<1-2 sentences: where and why the city began>",
      "color": "#f2c879",
      "seed": [<lat>, <lon>],
      "shape": { "glow": [<lat>, <lon>], "radius": 700 },
      "events": [
        { "at": [<lat>, <lon>], "title": "<landmark>", "image": "<slug>",
          "prompt": "<one period-correct scene, no text>" }
      ]
    },
    {
      "year": "<years the wall was built>",
      "label": "<name of the wall>",
      "narration": "<1-2 sentences: who built it and how far the city reached>",
      "color": "#ff8a5c",
      "shape": {
        "osm": { "name": "<the wall's name in OSM, local language>", "tags": { "historic": "citywalls" } },
        "polygons": [[[<lat>, <lon>], [<lat>, <lon>], [<lat>, <lon>], "… 8-40 points along the real line"]]
      }
    }
  ]
}
```

A complete, fact-checked story that was rendered into a film is shown on the Skill's Lab page; read it for tone and pacing, not for coordinates.

## Fields

| Field | Required | Notes |
|---|---|---|
| `version` | yes | `1` |
| `city` | yes | `name`, `lat`, `lon` of the historic centre; optional `note` (shown at the globe pin instead of the coordinates) |
| `title.en`, `title.sub` | `en` yes | shown on the globe and over the closing rings |
| `intro`, `outro` | yes | one spoken sentence each |
| `endCard` | no | `title` and `sub` of a last full-screen card (a series name, a call to action). Omit it and the film fades to black. |
| `voice` | no | SandBase MiniMax voice id, default `English_CaptivatingStoryteller` |
| `eras` | yes | 4 to 12, oldest first |
| `eras[].year` | yes | as you want it printed: `753 BC`, `c. AD 100`, `1840s`, `1973–today`. Its first number drives the rolling year counter between eras, so start with the year. |
| `eras[].label` | yes | 1-4 words |
| `eras[].narration` | yes | 1-2 spoken sentences (≤ 300 characters). It is also the subtitle. Spell numbers as they are spoken. |
| `eras[].stat` | no | one short fact under the year: `Wall about 11 km long` |
| `eras[].color` | yes | `#rrggbb`, distinct from the neighbouring eras |
| `eras[].seed` | no | where the lights start growing; default: the outline's centre |
| `eras[].shape` | yes | see below |
| `eras[].events` | no | up to 2 landmarks or events, shown one after another as floating cards |
| `events[].at` | yes | `[lat, lon]` of the place |
| `events[].title` | yes | ≤ 48 characters |
| `events[].prompt` | no | what to illustrate (one scene, period-correct, no text). Without it the card has no picture. |
| `events[].image` | no | slug for the picture file; default from the title |

The film computes the rest: each outlined era shows its area (`≈ 7.9 km²`) and how much it grew on the last outlined era (`×1.6`), so outlines of the right size matter.

## shape: the city's extent in that era

Pick one, or an OSM reference plus a fallback:

- `polygons`: one or more outlines `[[lat, lon], …]` of the lived-in city or its walls. 8-40 points each is plenty.
- `glow` + `radius` (metres): a soft light where the extent is not known (early settlements) or not a line (a modern sprawl).
- `lines`: polylines that are the boundary themselves (a ring road). Usually as an OSM reference.
- `osm`: `{ "name": "<regex>", "tags": { … }, "as": "ring" | "lines", "within_km": 25 }`. The resolver pulls the real geometry from OpenStreetMap: walls become a closed ring around their remains (`ring`, the default); roads stay lines (`as: "lines"`). Always add `polygons` or `glow` as a fallback: OSM may have nothing.

OSM reference patterns that work in most cities:

| What | Reference |
|---|---|
| A surviving or mapped wall | `{ "name": "<wall name in the local language>", "tags": { "historic": "citywalls" } }` |
| A wall that was torn down and replaced by boulevards on its line | one regex of those boulevard names: `{ "name": "^(<Boulevard A>\|<Boulevard B>\|…)$", "as": "ring", "within_km": 8 }` |
| A ring road | `{ "name": "<ring road name>", "as": "lines" }`, or by route number `{ "tags": { "ref": "<ref>" }, "as": "lines" }` |
| A modern city limit or an annexation | `{ "name": "^<City>$", "tags": { "boundary": "administrative", "admin_level": "<level>" } }` (the level varies by country; check OSM) |

Names must exist in OSM exactly as written, usually in the local language. An ordinary street that is not on the old line says nothing about how far the city reached.

Fallback `polygons` are used whenever OSM has fewer than about 30 points, so make them real: trace the wall along streets, rivers and landmarks you know, both banks if it crossed a river, and keep the size right (a medieval wall is typically 1-5 km across, a 19th-century one 8-12 km). The resolver prints which outlines came from OSM and which from the fallback.

## What makes a good story

- A living city that still exists, told as it changed: walls, rebuildings, booms, shrinking, ring roads.
- 7 to 9 eras, 8-12 seconds each. Alternate growth and change; one era where the city shrinks or is rebuilt makes it memorable.
- Each era should add visible ground. The film lights each new extent on top of the last one and flashes the newly gained area, so an era that is the same size as the one before reads as a pause.
- Facts you are sure of. Use "about", "perhaps", "c." where historians disagree. The film says outlines are reconstructions; the narration should not claim precision it does not have.
- Real people may be named in narration; do not ask for portraits of real people in prompts.
