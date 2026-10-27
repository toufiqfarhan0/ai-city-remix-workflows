# Narrative: historical person (`person`, structure `arc`)

A person film is a life told as an arc in the eight sections of the series theme. Every section has a
role; the plan (`work/script/plan.json`) gives its bars and the re-hook bars.

## Sections

| Section | Music | Role | How to write it |
|---|---|---|---|
| `intro` | intro | the most striking moment or question | One verified fact with the sharpest contrast (for Su Shi: demoted from Huangzhou to Huizhou to Changhua). No single-source claim here. Two shots: the fact, then the image that names him. |
| `verse` | verse | origins: the era plus one concrete detail | Birth, name, first success, each with its date. One knowledge point (for example the exam year). Ends on a cliff line. |
| `build` | build | the turn begins | The event that changes the course (arrest, war, exile). A hedged single-source line is allowed here. |
| `drop` | drop | the first high point | The first reveal, stated plainly and verified (a new name, a work, a breakthrough). No hedges. |
| `breakdown` | breakdown | cost and controversy (hedged when present) | What it cost: distance, age, loss. Disputed points use the "one account" hedge. Sparse narration is fine. |
| `build2` | build | the suspense of a comeback | A question the audience wants answered (will he return?). Ends on a cliff. |
| `drop2` | drop | the defining achievement | The answer and the summary: death, legacy, the places of the life. Verified facts only. |
| `outro` | outro | the link to today, a closing line | A short line plus a question to the viewer; the end card holds the name or art name. |

## Re-hooks

The plan places re-hooks at the starts of intro, build, breakdown, build2 and outro, plus `mid` re-hooks
so that no gap exceeds 35 seconds (150 s: bars 0, 8, 16, 28, 36, 48). Mark the shot that starts within
one bar of each with `rehook: true` and give it a new question, a turn or a reveal.

Patterns that work: a dated fact followed by a short open question ("In 1079 he moved to Huzhou. What
came next?"), a reveal that names the result first, a question that turns to the viewer.

## Knowledge points

5 to 7 cards at 150 s (4–6 at 120 s, 6–8 at 180 s), never in the intro or the outro. Each card sits on
exactly one shot of at least 2 bars and its value is a claim value: a year (`1057`, with `count: 1057` for
the count-up), a name (an art name), a status.

## Budgets

120, 150 or 180 seconds (2 to 3 minutes). There is no voice: one caption per shot, short enough to read in
the shot (CJK 7 characters/s, other scripts 3.3 words/s; a 1-bar shot holds about 2.6 s). Long dated runs
(a list of postings) belong on a map or timeline shot of 4 bars, not in a caption.

## Counterexamples

- An unbound date in a bridge line ("he left in 1084" without the claim): `claim_unbound`.
- A place name that only a different claim carries: `claim_unbound` (bind the claim that names it).
- "The first ..." or "the most ..." without a superlative claim: `superlative_unbound`.
- A single-source detail in the intro or a drop, or a third hedged line: `hedge_missing`.
- A quotation from a poem that is not a verified quote claim: `quote_unsourced`. Paraphrase instead.
- Adjectives that add facts ("a barren plot" when the source only says "a plot"): entailment answers
  must say `partial` or `extra_facts: yes`; drop the adjective.
- Two stays in the same city years apart as `lived_in` claims: they become one disputed instance; keep
  one of them.
