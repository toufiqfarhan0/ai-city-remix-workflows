# Narrative: city (`city`, structure `life`)
A city film tells a real city's life as if it were a person: where it was born, why it grew, what hurt
it, what it looks like today. The map is the main character: the same real river and coast stay on
screen while the built-up area grows, shrinks and grows again. A short span is fine (for example
Cairo 1798–1952): keep the same sections and tell only that span.

A topic locks as `city` when its Wikidata item has coordinates (P625) and a population (P1082).

## Sections
| Section | Music | Role | How to write it |
|---|---|---|---|
| `intro` | intro | today's map + "where did it begin?" | Wide map of today (roads on), title on the first shot; one verified fact or a question. |
| `verse` | verse | birth | The river or coast (`river`), the founding (`founded`), the first settlement as a small area. One or two knowledge points. |
| `build` | build | growth begins | Trade, roads, becoming a capital (`capital_of`, `ruled_by`); the area spreads. |
| `drop` | drop | first height | Largest extent, monuments appear (verified claims only: no hedged line in drops). |
| `breakdown` | breakdown | scars | `sacked`, `disaster`, lost walls or rivers; cinnabar `scar` wash. Single-source events need the "据记载 / records say" hedge. |
| `build2` | build | rebirth suspense | `rebuilt`, a new centre, a question. |
| `drop2` | drop | today | Modern roads fade in over the same map; `heritage_listed`, today's river. |
| `outro` | outro | echo | Back to the opening view; optional author line "me and this city" (`kind: bridge`, no facts). |

## Predicates
`founded` (P571), `river` (P206), `located_in` (P131), `population` and `area` (scope `{ as_of }` year),
`capital_of`, `ruled_by`, `renamed`, `wall_built`, `structure_built`, `sacked`, `disaster`, `rebuilt`,
`heritage_listed`. Legendary founding dates keep their hedge in the claim text ("according to legend",
"相传").

## Map rules
- Data only from `node scripts/geo.mjs` (Wikidata coordinates, OpenStreetMap layers). Do not invent
  coordinates; a place without a QID may give `lat`/`lon` (recorded as `source: given`).
- Historic extents (`areas`) are approximations and are always tagged "AI 示意 / AI illustration" by
  the kit. Name them generically ("Republican city", "medieval town") unless a claim names the wall.
- Modern roads (`roads`) only from the "today" sections on; before that, roads stay at 0 so the past is
  not drawn with today's streets.
- No national or provincial borders. Year stamps only for dates in the shot's claims.
- Bridge captions describe the picture ("the ink spreads from the hills"), never an unbound fact;
  numerals such as 两 / two count as numbers and need a claim.

## Counterexamples
- "The greatest city of its time" without a superlative claim: `superlative_unbound`.
- A single-source date (e.g. a sack known from one publisher) in a drop: `hedge_missing`.
- Map labels for places that are in no claim and no tier-1 source.
