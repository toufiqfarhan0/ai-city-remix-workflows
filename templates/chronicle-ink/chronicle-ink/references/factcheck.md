# Fact check

Every date, number, name and superlative a film says or shows must come from a claim that passed the
cross-check. This page is the full rule set; SKILL.md has the short version.

## 1. Entity lock (`research`)

- With `qid` (brief or `--qid`): the item is read with `wbgetentities`, no search.
- Without: `wbsearchentities` in zh and en (7 results each), disambiguation pages removed, then the
  candidates are typed: `P31` contains `Q5` = person; `P105` or `P31` contains `Q16521` = animal (any taxon);
  `P625` coordinates and `P1082` population = city; `P625` alone = landmark; anything else = unsupported.
- Lock rule over all candidates (unsupported ones included): no candidate -> `entity_not_found`; only
  unsupported -> `subject_undetermined`; none matches `brief.subject` -> `entity_subject_mismatch`.
  The best candidate (most sitelinks, ties to the lower QID) locks as `unique` when alone, or as
  `dominant` when it has at least 10 sitelinks and at least 5 times the sitelinks of the strongest rival;
  otherwise `entity_ambiguous` (exit 3, `candidates.json`, rerun with `--qid`).
- Measured examples (October 2026): Su Shi Q36020 (54 sitelinks) against a species named after him
  (2) locks as dominant; Giant panda Q33602 (146) against Q675020 (15) locks; the Chinese word for octopus
  gives Octopoda Q40152 (119) against Q611843 (31) and is ambiguous; "Mercury" is ambiguous (planet and
  element are unsupported but still count as rivals).
- Dates and numbers are read only from the entity JSON (`time`, `precision`, `calendarmodel`).
- Living rule: a person without `P570` whose `P569` is within 150 years (or missing) is `living: true`,
  `portrait_policy: forbidden`.
- `known-entities.json`: labels and aliases (zh-hans, zh-hant, zh, en) of every item the entity's
  statements point to (at most 200). Simplified and traditional forms are matched through this table,
  not through a general conversion.

## 2. Claims

Structured claims (no model):

- Wikidata: one claim per statement of every predicate with a Wikidata property (table below). The
  excerpt is the statement value as written in the JSON, for example `"+1037-01-08T00:00:00Z"`.
- CBDB adapter (`id_formatters.P497` plus `&o=json`): `BasicInfo.YearBirth` -> `born` (year precision,
  calendar `lunar-chinese`), `YearDeath` -> `died`, `YearsLived` -> `age_at_death` (East Asian reckoning),
  `IndexAddr` -> `birthplace` (label without QID). Field names checked against the live response for
  Su Shi (person id 3767) on 21 October 2026: `YearBirth "1036"`, `YearDeath "1101"`, `YearsLived "66"`.
- GBIF adapter (`api.gbif.org/v1/species/<id>`): `rank` -> `taxon_rank`, `scientificName` ->
  `scientific_name` (text, never clustered).
- Adapter excerpts are the `"<key>": <value>` fragment exactly as it appears in the raw response text.
- A response that does not have the expected shape gives no claims and the warning
  `adapter_unparsed:<publisher>`.
- Claim texts in both languages come from fixed templates (no translation call).

Text claims (LLM, or the Agent with `--author agent`):

- Sources are cut into chunks of at most 12,000 characters; at most 12 extraction calls per film, in the
  order tier, source id, chunk; the rest is skipped with `extract_truncated`.
- Each claim: `{ predicate, subject_qid, value, scope, text: { en, "zh-CN" }, excerpt, source_id }`.
  In Agent mode both texts are required.
- Excerpt: at most 30 words (60 CJK characters), verbatim from the source text. After NFKC, whitespace
  folding and Latin lower-casing it must be a substring of the stored source text, otherwise the claim is
  dropped (`excerpt_not_found`, counted in the report).
- A predicate outside the vocabulary becomes `other` (the original name kept in `predicate_raw`, the
  value stored as `{ text }`). A value that does not fit the predicate's shape, or an enum value outside
  its list, drops the claim (`value_invalid`). A subject other than the locked entity drops it
  (`subject_mismatch`).
- Full-text scans only write hints (`hints.json`: "source s02 mentions 1037"); hints are never evidence.

## 3. Controlled predicates

The vocabulary is data in `facts/predicates.mjs`; this table lists every key (a test compares the sets).
`card` many predicates split into instances by `key`.

| Predicate | Type | Card | Key | Subjects | Wikidata | Visual |
|---|---|---|---|---|---|---|
| `born` | date | one | | person | P569 | |
| `died` | date | one | | person | P570 | |
| `birthplace` | label | one | | person | P19 | |
| `deathplace` | label | one | | person | P20 | |
| `burial_place` | label | one | | person | P119 | |
| `located_in` | label | one | | landmark, city | P131 | |
| `named_after` | label | one | | all | P138 | |
| `age_at_death` | age | one | | person | | |
| `courtesy_name` | label | many | object | person | P1782 | |
| `art_name` | label | many | object | person | P1787 | |
| `father` | label | one | | person | P22 | |
| `mother` | label | one | | person | P25 | |
| `spouse` | label | many | object | person | P26 | |
| `child` | label | many | object | person | P40 | |
| `sibling` | label | many | object | person | P3373 | |
| `exam_passed` | event | many | object | person | | |
| `office_held` | event | many | object | person | | |
| `exiled_to` | event | many | place | person | | |
| `lived_in` | event | many | place | person | | |
| `imprisoned` | event | many | date | person | | |
| `work_written` | event | many | object | person | | |
| `built_or_founded` | event | many | object | person | | |
| `inception` | date | one | | landmark | P571 | |
| `construction_started` | date | one | | landmark | | |
| `completed` | date | one | | landmark | | |
| `architect` | label | many | object | landmark | P84 | |
| `material` | label | many | object | landmark | P186 | |
| `length` | number | one | | landmark, animal | P2043 | |
| `height` | number | one | | landmark, animal | P2048 | |
| `width` | number | one | | landmark | P2049 | |
| `span` | number | one | | landmark | | |
| `arch_count` | count | one | | landmark | | yes |
| `structure_feature` | label | many | object | landmark | | yes |
| `restored` | event | many | date | landmark | | |
| `damaged` | event | many | date | landmark | | |
| `heritage_listed` | event | many | object | landmark, city | | |
| `founded` | date | one | | city | P571 | |
| `population` | number | many | date | city | | |
| `area` | number | many | date | city | | |
| `river` | label | many | object | city | P206 | |
| `capital_of` | event | many | object | city | | |
| `ruled_by` | event | many | object | city | | |
| `renamed` | event | many | date | city | | |
| `wall_built` | event | many | object | city | | |
| `structure_built` | event | many | object | city | | |
| `sacked` | event | many | date | city | | |
| `disaster` | event | many | date | city | | |
| `rebuilt` | event | many | date | city | | |
| `taxon_rank` | enum | one | | animal | P105 | |
| `parent_taxon` | label | one | | animal | P171 | |
| `iucn_status` | enum | one | | animal | P141 | |
| `habitat` | label | many | object | animal | | |
| `range` | label | many | object | animal | | |
| `diet` | label | many | object | animal | | |
| `lifespan` | number | one | | animal | | |
| `body_mass` | number | one | | animal | | |
| `limb_count` | count | one | | animal | | yes |
| `color_pattern` | label | many | object | animal | | yes |
| `attire` | label | many | object | person | | yes |
| `headwear` | label | many | object | person | | yes |
| `quote` | quote | many | | all | | |
| `superlative` | superlative | many | | all | | |
| `scientific_name` | text | one | | animal | | |
| `other` | text | many | | all | | |

Enums: `taxon_rank` species, subspecies, genus, family, order, class, phylum; `iucn_status` LC, NT, VU,
EN, CR, EW, EX, DD. A predicate used for another subject becomes `other`.

## 4. Value shapes and equivalence

| Type | Shape | Equal when |
|---|---|---|
| date | `{ raw, gregorian_year_hint?, calendar? }` normalised to `{ y, m?, d?, precision, calendar }` | same day after calendar conversion, or the coarser precision contains the finer one, or ranges overlap |
| number | `{ raw, unit? }` normalised to a value and SI unit | within 2 % (counts must be equal); "about" gives a range |
| count | integer | equal |
| age | `{ years, reckoning: exact, east-asian, unknown }` | consistent with the cluster of `born` and `died` |
| enum | one listed value | identical |
| label | `{ label: { en?, "zh-CN"? }, qid? }` | both with qid: same qid; else any normalised label or known alias in common |
| event | `{ object?, place?, date? }` | every field both sides have is equal; at least one field compared |
| quote | `{ text }` | same normalised text |
| superlative | `{ dimension, category, as_of }` | same dimension and equivalent category |
| text | `{ text }` | never clustered |

## 5. Groups, instances, clusters

- Group: subject, predicate and scope (the superlative dimension).
- Instance: a `many` predicate splits its group by the key (label closure for object and place, a two
  year closure for dates). A claim without the key is isolated (`unkeyed`, at most single-source). Note
  that `lived_in` is keyed by place, so two stays in the same city years apart form one instance with
  two date clusters (disputed); model only one of them.
- Cluster: claims with equivalent values. Members are sorted by tier, publisher, source and claim id,
  so input order never changes a result.
- Corroboration only happens inside a cluster: claims from different publishers in the same cluster
  support each other. Wikidata and every Wikipedia are one publisher (`wikimedia`).

## 6. Status

| Status | Rule |
|---|---|
| verified | the best cluster has at least 2 qualifying publishers, one of them tier 1, and no other qualifying cluster (or every rival has no tier 1 while the best has 2 tier 1: `minority_conflict`) |
| single-source | only one qualifying publisher, or no tier-1 publisher; `text`, `other` and unkeyed claims never go higher |
| disputed | two or more qualifying clusters that the rules above cannot settle |
| rejected | no qualifying evidence (only lead sources), a superlative without scope, a quote that is not verified with a tier-1 excerpt |

Qualifying evidence: tier 1 and 2 always; tier 3 only for claims with a date whose year is at least the
retrieval year minus 30; lead never. Ages are judged after `born` and `died`: an `age_at_death` value is
consistent when some combination of the born and died clusters allows it (exact age, or East Asian
nominal age one or two years higher); otherwise `age_inconsistent`.

Normalisation: BCE years are astronomical (551 BC = -550); dates before 1582 without a calendar are
assumed Julian (`calendar_assumed`); a Chinese era or lunar year compares with the Gregorian year it
mostly overlaps and the following one (`lunar_cross_year`); Chinese numerals, separators and unit
conversions are normalised before comparison.

## 7. Script gate (`script`)

Structure (exit 9): schema `chronicle-script/2`, shots in theme-section order tiling every section in
whole bars (1–4), at least one shot per 2.5 bars, the last outro shot ≥ 2 bars, the knowledge-point range
of the length (4–6 / 5–7 / 6–8), each card on exactly one shot of ≥ 2 bars in an allowed section, a
`rehook: true` shot within one bar of every planned re-hook (gaps ≤ 35 s), caption layout per script (CJK
≤ 16 characters per line, others ≤ 9 words / 42 characters, ≤ 2 lines), reading time, glyph coverage of
the bundled fonts, seconds and subject equal to the brief, no portrait of a living subject.
Facts (exit 6), per caption (shot), title, knowledge-point card and end card, in the brief's language:

- A `fact` line binds at least one claim; rejected claims are never bound.
- Single-source claims need `hedge: "attributed"` and an attribution phrase (en: "according to",
  "records say", "is said to"; zh-CN: the phrases for "according to records" and "it is said"), at most
  2 such lines per film, never in the intro or a drop section.
- Disputed claims need `hedge: "one-account"` and "one account" (zh-CN: the phrase "yi shuo").
- A `quote` line contains the exact words of a verified quote claim.
- Every date and number in the text must be allowed by the bound claims (their values, date parts,
  differences of two bound dates, ages they allow, "years ago" forms).
- A place, person or work name of any claim may appear only in a line that binds a claim with that name.
- Superlatives ("most", "first", "only", "oldest" and their Chinese forms) need a bound superlative claim.
- Card values must equal a bound claim value (date precision not higher than the claim's).
- Entailment: the Agent answers for every caption and virtual line (`work/script/entail.agent.json`),
  judging only from the caption, the claim texts and the excerpts; `partial` is a warning, `no` or extra
  facts fail.

Lexical order per line: hedge markers (checked, then masked), fixed expressions (idioms such as the
Chinese words for "a lifetime" or "together" are not numbers), bound value spans on the original text,
dates (bound raw spellings first), numbers (a lone Chinese "one" is not a number; Chinese numerals count
only before a measure word), superlatives, then names.

## 8. Visual self-review (`render --segment`)
The Agent reviews each segment's contact sheet and key frames against the do / don't list of
`style-pack.md`, always including: no realistic face, no identifiable living person, no national or
provincial borders, no invented legible text, captions readable. At most 3 rounds per segment, recorded in
`work/review.json`; `check` fails `visual_review` when a segment is missing or a blocking finding is open.
## 9. Human review

The report's `human_review` flags (`facts`, `visuals`, `listening`) are false until a real person has
looked and the report is rebuilt with `--reviewed facts,visuals,listening`. An Agent must not set them.
