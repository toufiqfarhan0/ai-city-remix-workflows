# Narrative: animal (`animal`, structures `superpower`, `day`, `life`)

Any taxon can be told with the animal template (genus or family topics get a warning and are told as a
group). The default structure is `superpower`; `day` and `life` are alternatives.

## Sections per structure

| Section | `superpower` | `day` | `life` |
|---|---|---|---|
| `intro` | the superpower on show | a moment before dawn | the moment of birth |
| `verse` | habitat | dawn, waking up | birth and early life |
| `build` | the challenge it meets | foraging | the trials of growing up |
| `drop` | the mechanism revealed | the hunting or foraging climax | the first migration or independence |
| `breakdown` | cost or predators | danger | cost and wear |
| `build2` | the suspense of its conservation status | dusk | the suspense of passing it on |
| `drop2` | protection status and an astonishing fact | night | legacy |
| `outro` | echo | echo | echo |

## Rules specific to animals

- Conservation status comes from Wikidata `P141` (`iucn_status`); IUCN pages are linked, never fetched.
- Body facts (`length`, `body_mass`, `lifespan`, `limb_count`) need units and ranges as written in the
  sources; "up to" and "about" become ranges.
- Visual claims (`limb_count`, `color_pattern`) bind the shots that draw them: a verified eight-arm claim
  means the scene draws exactly eight arms, and the visual self-review checks it.
- No people in animal pictures unless the claim is about people; never a living person's likeness.
- Range maps show terrain and water only, never borders.

## Knowledge points

Scientific name, status, lifespan, size, a count. A status card value is the enum code itself (`VU`).

## Re-hooks

Same anchors as every structure (hook, cliffs, reveals, mid, final). For `day`, cliffs work as time
jumps ("then the light goes"); for `superpower`, as "how does it do that?".

## Counterexamples

- "The smartest invertebrate" without a superlative claim: `superlative_unbound`.
- A lifespan from a lead source only (a forum or a social post): the claim is rejected, the line fails.
- A behaviour seen in one study written as a general fact: if single-source, hedge it ("according to")
  and keep it out of the intro and the drops.
