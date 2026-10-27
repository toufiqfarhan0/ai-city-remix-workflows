# Prompt slots

`fill-prompt.mjs` reads one UTF-8 JSON object of string slots, rejects unknown keys, non-strings and values over 2000 characters, and exits 2 on invalid input. Without `--out` the prompt goes to standard output. `--lang en|zh-CN` (alias `zh`) chooses the prompt language; an invalid value falls back to English with a warning.

| Slot | Required | Meaning |
| --- | --- | --- |
| `city` | yes | City or district, and how it is compressed |
| `landmarks` | yes | Landmarks that get dedicated models and views, comma separated |
| `palette` | no | Facade, water, tray and night colors |
| `interaction` | no | Controls the page must offer |
| `ui` | no | Overlay layout and copy |
| `brand` | no | Brand mark and how it behaves |
| `extraPrompt` | no | Additional brief, added under "Extra instructions" |

Blank optional slots take the defaults in `scripts/lib/i18n.mjs`. The 0.1.0 presentation slots (`brand_name`, `title_lines` and the others) are not accepted any more. A brief describes intent: apply it to the project's geometry, landmark views and strings before building.

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/manhattan-diorama.json
node scripts/fill-prompt.mjs --slots assets/prompts/examples/manhattan-diorama.json --lang zh-CN --out prompt.zh-CN.md
```
