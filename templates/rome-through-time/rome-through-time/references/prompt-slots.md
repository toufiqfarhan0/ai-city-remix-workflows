# Prompt slots

`fill-prompt.mjs` reads one UTF-8 JSON object of string slots, rejects unknown keys, non-strings and values over 2000 characters, and exits 2 on invalid input. Without `--out` the prompt goes to standard output. `--lang en|zh-CN` (alias `zh`) chooses the prompt language; an invalid value falls back to English with a warning.

| Slot | Required | Meaning |
| --- | --- | --- |
| `city` | yes | The city or district and its anchor landmarks |
| `eras` | yes | The eras or milestone years to evolve through |
| `style` | no | Visual direction of the miniature and the interface |
| `camera` | no | Framing and film camera |
| `interaction` | no | Controls the page must offer |
| `extraPrompt` | no | Additional brief, added under "Extra instructions" |

Blank optional slots take the defaults in `scripts/lib/i18n.mjs`. The shipped sample is Rome, 25 s, 1920×1080, 30 fps. A brief describes intent: apply it to the geometry, entity schedules, film timing and strings before recording.

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/eternal-city.json
node scripts/fill-prompt.mjs --slots assets/prompts/examples/eternal-city.json --lang zh-CN --out prompt.zh-CN.md
```
