# Prompt slots

`fill-prompt.mjs` reads one UTF-8 JSON object of string slots, rejects unknown keys, non-strings and values over 2000 characters, and exits 2 on invalid input. Without `--out` the prompt goes to standard output. `--lang en|zh-CN` (alias `zh`) chooses the prompt language; an invalid value falls back to English with a warning.

| Slot | Required | Meaning |
| --- | --- | --- |
| `city` | yes | The city or place the island stands for |
| `landmark` | yes | The one centrepiece and its signature features |
| `style` | no | Materials, colours and interface look |
| `village` | no | What surrounds the landmark on the island |
| `chapters` | no | What the four 6-second film chapters show |
| `lighting` | no | How the light moves from day to night |
| `interaction` | no | Controls the page must offer |
| `extraPrompt` | no | Additional brief, added under "Extra instructions" |

Blank optional slots take the defaults in `scripts/lib/i18n.mjs`. The shipped film is 24 s, 1920×1080, 30 fps with the bundled score; change duration or audio in `extraPrompt` and in the project together. A brief describes intent: apply it to `landmark.js`, the camera anchors, the village and the strings before recording.

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/stone-stars.json
node scripts/fill-prompt.mjs --slots assets/prompts/examples/stone-stars.json --lang zh-CN --out prompt.zh-CN.md
```

An example of a different brief: `{ "city": "a storybook Kyoto", "landmark": "a five-storey pagoda with deep layered eaves, bronze finial rings and lantern-lit galleries", "village": "machiya townhouses, a stone-paved lane, maples and a small torii by the plaza" }`.
