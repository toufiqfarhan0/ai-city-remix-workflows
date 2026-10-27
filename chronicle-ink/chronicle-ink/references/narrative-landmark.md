# Narrative: landmark (`landmark`, structure `time-travel`)

A landmark film travels through time around one place: why it stands there, how it was built, what
happened to it and what it looks like now. Sections, budgets and re-hooks are the same as for a person.

## Sections

| Section | Music | Role | How to write it |
|---|---|---|---|
| `intro` | intro | today's panorama plus a curious question | One verified striking fact (age, size, a structural detail) and a question. |
| `verse` | verse | why it was built here | Location, purpose, the river or route it serves; one knowledge point (inception year or length). |
| `build` | build | construction begins | Who built it and when (`architect`, `construction_started`, `material`). |
| `drop` | drop | the principle revealed (section or breakdown) | The engineering idea shown as a cut-away or exploded view; numbers must be bound (`span`, `arch_count`). |
| `breakdown` | breakdown | fragility and loss | What was lost or is at risk; disputed repair dates use the "one account" hedge. |
| `build2` | build | "why is it still standing?" | The suspense line. |
| `drop2` | drop | then and now | The same view across centuries; verified values only. |
| `outro` | outro | echo | A closing line; the end card holds the name. |

## Rules specific to landmarks

- `inception` and the year it was "completed" are different predicates and never corroborate each other.
- Map shots show terrain, rivers and a site point only; never national or provincial borders, even for
  sites near a border or in a disputed area.
- Inception or completion in 1950 or later adds the non-blocking warning
  `modern_landmark_copyright_note`: the building design or its lighting may be protected in some
  countries. Decide whether the pictures need to stay generic.
- No logos or legible signs in pictures.

## Knowledge points

Year built, length or span, number of arches, heritage listing year. A card value must equal the claim
value with no extra precision (a year card for a year claim).

## Counterexamples

- "The oldest bridge in the world" without a superlative claim with `dimension: oldest`, its category and
  `as_of` year: `superlative_unbound`.
- A length in a different unit than the claim without conversion is fine only within 2 %; "about 50 m"
  for a claim of 50.82 m is fine, "50 m" is not (precision higher than the claim allows).
