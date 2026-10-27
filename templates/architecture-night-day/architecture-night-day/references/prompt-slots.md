# Prompt slots

`fill-prompt.mjs` reads one UTF-8 JSON object of string slots, rejects unknown keys, non-strings and values over 2000 characters, and exits 2 on invalid input. Without `--out` the prompt goes to standard output. `--lang en|zh-CN` (alias `zh`) chooses the prompt language; an invalid value falls back to English with a warning.

| Slot | Required | Meaning |
| --- | --- | --- |
| `subject` | yes | Site or architectural subject |
| `landmarks` | yes | Buildings to author, comma separated |
| `style` | no | Visual direction of the scene and interface |
| `camera` | no | Framing and motion |
| `lightingTransition` | no | How night turns into day |
| `interaction` | no | Controls the page must offer |
| `extraPrompt` | no | Additional brief, added under "Extra instructions" |

Blank optional slots take the defaults in `scripts/lib/i18n.mjs`. Film duration, size and frame rate are part of the brief text (`extraPrompt`); the shipped sample is 20 s, 1920×1080, 30 fps and silent. A brief describes intent: apply it to the project's geometry, shot table and strings before recording.

```sh
node scripts/fill-prompt.mjs --slots assets/prompts/examples/through-light.json
node scripts/fill-prompt.mjs --slots assets/prompts/examples/through-light.json --lang zh-CN --out prompt.zh-CN.md
```
