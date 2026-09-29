# Capability Observatory & Measurement Foundation — Stage 12 Architecture

Stage 12 adds the measurement layer the atlas has deferred since
Stage 6: **Measurement** (an accepted observation of the world, with
an explicit basis) and **Indicator** (a versioned, read-only
analytical definition computed dynamically from accepted
measurements). Everything else in the stage is views: the
Observatory and the Balance Sheet.

Exactly two entities are added. There is no `measurement_value`, no
`indicator_value`, no `balance_sheet` entity, no score of any kind.
The frozen Stage 12 scope v1.1 §2 prohibits every ghost collection,
and the test suite asserts the prohibition by name.

## The honesty boundary (frozen scope v1.1 §4-§6)

Stage 12 is the direct descendant of the Stage 6 count-bases rule,
and it inherits the permanent carry-forward: a measurement documents
what was observed **in its survey scope** — it never asserts "only N
exist".

- **Basis is the Stage 6 enum, unchanged**: `OBSERVED`,
  `ESTIMATED`, `REPORTED`, `UNKNOWN`. No free text.
- **UNKNOWN is never zero.** An `UNKNOWN` measurement carries a null
  value and is rejected if a value is supplied; an explicit zero
  requires a factual basis (`OBSERVED` with a documented scope — "we
  looked and found none" is a legitimate finding).
- **An estimate is not an observation.** `ESTIMATED` requires a
  documented method; a census-derived estimate must reference an
  APPROVED Stage 6 methodology. An estimated zero is rejected.
- **Every measurement carries an observation scope** — the sentence
  that says what was counted, where, and how. Without it the record
  is invalid at creation and flagged by the integrity checker.
- **Kind and unit are controlled vocabularies** (`COUNT`, `RATIO`,
  `RATE`, `DURATION`, `PERCENTAGE`, `CATEGORICAL`); a categorical
  measurement carries a named value, never a number.

## Lifecycle (frozen scope v1.1 §7-§9)

`DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED`, with `REJECTED` from
`UNDER_REVIEW` and `ACCEPTED → SUPERSEDED`:

- `SUBMITTED` and `UNDER_REVIEW` are **edit-locked**; the three
  terminal states are immutable. There is no resurrection path.
- A **correction creates a new measurement** that supersedes the
  original: the new record references its predecessor
  (`supersedes_id`), and acceptance retires the original to
  `SUPERSEDED` with `superseded_by`. The original's history is
  preserved byte-exact — provenance is never rewritten.
- **Creator/reviewer separation is enforced at the service layer**,
  for every role including `national_administrator`: whoever created a
  measurement can never review it. The NATIONAL self-assessment
  lesson from Stage 10 is structural here, not advisory.

## Provenance and integration boundaries

A measurement integrates with the earlier stages by reference only,
and every reference is canonical and validated — a measurement never
silently creates the thing it cites:

- **Census** (Stage 6): a census-derived measurement references a
  **PUBLISHED (immutable) snapshot**; a DRAFT snapshot can never be
  pinned. A newer census never rewrites an existing measurement —
  each measurement is a historical observation pinned to its snapshot.
- **Research** (Stage 4): a field observation may become a
  measurement, but only through the explicit governed chain — nothing
  is auto-accepted.
- **Evidence** (Stage 3): acceptance never upgrades a capability's
  evidence level. The two scales stay separate.
- **Graph** (Stage 7): strictly read-only. A graph-derived
  measurement declares `GRAPH_DERIVED` provenance; the 19-type
  registry is untouched and measurement creation writes no edges.
- **Interventions & pilots** (Stages 10-11): a measurement may attach
  as baseline/follow-up context; it never changes an intervention
  outcome or a pilot state, and no pilot score exists.

## Indicators: definitions, never values

The 23 authorized indicator definitions are seeded **APPROVED v1**
with two distinct seed identities (author ≠ reviewer — the
creator/reviewer separation is honored even at seed time). A
definition specifies what is measured and how it is interpreted;
**no definition ever carries a result value**, and the production
baseline ships with **zero measurements**.

- A formula change creates a **new version** (DRAFT → reviewed →
  APPROVED); the previous version is retired to `SUPERSEDED` only
  when the new one is approved. Versions are immutable.
- Computation is **dynamic, read-only and deterministic**: from
  ACCEPTED measurements only (DRAFT, REJECTED and superseded inputs
  are excluded), version-pinned, and it persists **nothing** — there
  is no result entity, ever. `LATEST`, `SUM`, `MEAN` and `RATIO`
  methods are supported.
- Missing inputs produce an honest **UNKNOWN with a reason** — never
  zero, never LOW. The Observatory displays "not yet measured".
- **No indicator is a score or a ranking.** No composite capability
  score exists; the test suite asserts the absence of every score
  function by name.

## Observatory and Balance Sheet

Nine read-only views compose from accepted data: capability
condition, the four indicator families (Human Capability, Knowledge,
Repair, Resilience), geographic coverage, capability trends (with
explicit limitations on non-comparable series), evidence quality,
and the Balance Sheet. The Balance Sheet documents assets (the
240-capability inventory, counts with bases) and gaps, and its
verdict field is **always "None — the balance sheet does not
judge"**. Views are display-only; the data layer stays honest.

## Privacy and access

- Eight flat permissions (`measurement.*`, `indicator.*`); anonymous
  users read only `ACCEPTED`/`SUPERSEDED` measurements.
- Small person counts are **Restricted** to anonymous viewers —
  counts never become identity inference.
- DRAFT creation is a pure local operation (offline-first, no
  connectivity assumption anywhere in the workflow).

## Transfer

Export/import is atomic and authority-honest: a bundle carrying an
`ACCEPTED` measurement with `creator === reviewer`, an acceptance
without a review stamp, an `UNKNOWN` measurement with a value, or an
indicator carrying a stored value is **rejected wholesale** — import
can never manufacture authority. `SUPERSEDED` terminal history keeps
its broken references by design (the Stage 7/8 exemption), but an
ACTIVE measurement with a broken reference is rejected, and an
ACCEPTED correction whose original is not superseded is rejected
(provenance chains must be consistent). A full-bundle restore maps
onto the deterministic seed ids (`ind-<code>-v1`, the Stage 4
`fam-/cap-<code>` convention), so re-import is idempotent.

## Routes and files

`#/observatory`, `#/measurements`, `#/indicators` (+ detail pages).
`BUILD_STEP = 12`, service worker cache `sca-step12-v1`. The suite
contract lives in `tests/measurement-system.test.js` (25 sections),
and the build/runtime integrity test exercises the shipped shell:
clean install seeds zero measurements and the 23 definitions, a
distinct reviewer accepts a measurement through the real workflow,
and honest UNKNOWN is proven at runtime.
