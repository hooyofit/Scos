# Stage 6 — Capability Census & Regional Capability Mapping Foundation

**Architecture decision record (ADR-style).**
Build step 6. Status: built — awaiting inspection.

> «Unknown is information.»

Stage 6 adds the **measurement** layer of the Atlas: a disciplined way to
record *what has actually been documented on the ground* for each capability
in each place, without ever pretending that what was not measured is absent.

It is deliberately a **foundation**, not a national census. No national
practitioner counts, risk scores, region rankings or reproduction scores are
computed. The architecture captures the raw, honest measurements and the
relationships between them; later stages may build analysis on top.

---

## 1. What Stage 6 is, and is not

**Is**

- A controlled methodology → census → observation → review → snapshot
  lifecycle.
- Per-cell measurements of practitioner / trainer / apprentice / workshop /
  organization counts, each carrying a **basis** (OBSERVED, ESTIMATED,
  REPORTED, UNKNOWN) so a number is never silently confused with a guess.
- Unknown-aware views (coverage, matrix, gaps, regional profile, map layer,
  national overview) that display **Unknown** where no data exists rather
  than `0`.
- Immutable, published snapshots that preserve a moment in time and the
  list of fields that were unknown at that moment.
- Geographic redundancy rows: raw documented-location counts per capability,
  with **no resilience or risk score** derived from them.
- Practitioner deduplication: flag → explicit reviewer merge; the merged
  record is preserved and marked, never deleted, and never double counted.
- A Build/Runtime Integrity test that proves the *shipped* app (not just the
  unit suites) boots, routes render, and the service-worker precache is
  complete and current.

**Is not (deliberately deferred)**

- A national practitioner census or national capability counts based on
  partial data.
- Region or capability rankings, "best" region, reputation or risk scores.
- A reproduction score (Stage 5's reproduction pathway is represented; Stage 6
  only counts the people already documented).
- Automatic promotion of census observations into evidence levels or
  competence levels.
- Any external API, cloud profile, mapping service or AI dependency.

---

## 2. New models

All collections live behind `SCA.store`; there is no direct `localStorage`
access and no Base44-specific persistence.

| Model | Collection | Purpose |
|-------|-----------|---------|
| `CensusMethodology` | `census_methodologies` | A documented method: population definition, data-collection method, optional estimation method. Must be **approved by a national administrator** before a census that references it can be approved. |
| `CapabilityCensus` | `capability_censuses` | A scoped measurement exercise. Scope is a set of capability ids, family ids, or all; a set of location ids; a level (COMMUNITY / REGION / NATIONAL). Lifecycle: DRAFT → APPROVED → ACTIVE → COMPLETED (plus PAUSED, WITHDRAWN). |
| `CensusObservation` | `census_observations` | One cell: one capability × one location within one census. Carries count fields, a `survey_status`, a `presence`, an `evidence_status` (documentation only), optional stable practitioner-id references, and a review status. |
| `CensusSnapshot` | `census_snapshots` | An immutable point-in-time measurement of a census. Draft snapshots may be discarded; **published snapshots can never be updated or deleted** (enforced at the data layer). |
| `GeographicRedundancy` | `geographic_redundancies` | Raw documented-location counts per capability for a snapshot. No score fields exist on the record. |

The 240 capability inventory, the Stage 3 evidence models, the Stage 4
research models and the Stage 5 practitioner/apprenticeship models are all
unchanged. Census observations **reference** capabilities, locations,
practitioners and methodologies by stable id; they never mutate them.

---

## 3. Count semantics — the heart of Stage 6

Every count field on an observation is a `{ value, basis }` object, not a
bare number.

```
practitioner_count: { value: 4, basis: 'OBSERVED' }
trainer_count:       { value: null, basis: 'UNKNOWN' }
```

- **OBSERVED** — directly counted.
- **ESTIMATED** — an estimate; **rejected unless the census's approved
  methodology documents an `estimation_method`**. An estimate without a
  documented method is not a measurement, it is a guess, and the system
  refuses to store it as one.
- **REPORTED** — stated by a participant, not independently counted.
- **UNKNOWN** — the default. `value: null, basis: 'UNKNOWN'`. An unknown
  count is **information**, not a zero.

Rules enforced by the model and workflow:

- A bare number (`practitioner_count: 5`) is rejected — counts must be
  `{ value, basis }` objects.
- `basis: 'UNKNOWN'` with a non-null `value` is rejected — there is no such
  thing as a known unknown.
- `value: 0` is valid **only with an established basis** (OBSERVED/ESTIMATED/
  REPORTED). A zero is a finding ("we looked, there were none"), never a
  placeholder for "we did not look".
- `presence` defaults to `UNKNOWN`, never to "absent".
- A region with no accepted observations is **Not Surveyed**, never "no
  capability".

`SCA.census.displayCount` and `SCA.census.protectCount` are the only two
ways a count reaches a viewer:

- `displayCount` renders `null` as **Unknown**, `0` as `0`, and any number as
  itself.
- `protectCount` applies the small-number privacy threshold: small
  community counts are shown to unprivileged viewers as **Restricted**,
  while privileged viewers (reviewer and above) see the real number. The
  threshold is a measurement-privacy rule, not a reputation rule.

---

## 4. Lifecycle and authority

```
Methodology (DRAFT → APPROVED, national admin only, reason required)
        │
        ▼
Census (DRAFT → APPROVED → ACTIVE → COMPLETED)
        │  • APPROVED requires an approved methodology
        │  • estimates require that methodology to document an estimation method
        ▼
Observation (PENDING → ACCEPTED / REJECTED / SUPERSEDED)
        │  • only ACCEPTED observations feed any view or snapshot
        │  • corrections create a new version; the original is preserved
        ▼
Snapshot (DRAFT → PUBLISHED)
           • national admin generates; publishing is immutable
           • draft may be discarded (cascades its redundancy rows)
           • published can never be updated or deleted
```

A researcher creates censuses and observations but **cannot** approve a
census, review an observation, generate/publish a snapshot, or merge
practitioners. A reviewer reviews observations and reconciles duplicates.
A regional administrator cannot publish national snapshots. Only a
national administrator holds snapshot authority. See §9 for the full RBAC
list.

---

## 5. Unknown-aware views

Every view is built so that "we have no data" is a distinct, visible state
from "we measured zero".

- **`coverageMeasurements(censusId)`** — capabilities in scope, surveyed,
  not surveyed, locations in scope, registry practitioners documented
  (excluding merged records). `not surveyed = scope − surveyed` is honest
  arithmetic over what was actually measured.
- **`matrix(censusId, user)`** — capability × location grid. Public viewers
  see **Restricted** for small community counts and **Unknown** for unknown
  cells; privileged reviewers see raw numbers. No row or column is ranked.
- **`gaps(censusId)`** — work items, not verdicts. A `NOT_SURVEYED` gap
  carries the message *"no data is not absence"*. A `PRACTITIONER_UNKNOWN`
  gap is a measurement to-do, never a statement that no practitioner exists.
- **`regionalProfile(user, locationId)`** — survey status, protected
  practitioner count, documented organizations (shown only when actually
  documented), and the standing note: *"Only documented Atlas data.
  Everything not entered is Unknown, not absent."*
- **`mapData(user)`** — the map layer. Every location is marked `SURVEYED`
  or `NOT_SURVEYED`. Coordinates are optional and never fabricated. The
  layer reports `capability_count: 240` (the inventory) and surfaces
  unsurveyed districts honestly.
- **`nationalOverview(user)`** — total capabilities (240), surveyed
  locations, documented practitioners (deduped), documented organizations.
  Always carries the banner: *"National data is incomplete … must not be
  interpreted as a complete national census."*

---

## 6. Snapshots and geographic redundancy

A snapshot freezes a census at a moment: scope, surveyed, not surveyed,
unknown fields, and the stable-id practitioner references counted once each.
Generating a new snapshot for the same census **creates a new record** — it
never overwrites a previous one, so measurement history is preserved.

Generating a snapshot also writes one `GeographicRedundancy` row per
capability in scope, recording the raw `documented_location_count`. The
record intentionally has **no** `resilience_score` or `risk_score` field.
Stage 6 captures the raw fact ("this capability is documented in N places");
deriving a judgment from it is a later stage.

Discarding a **draft** snapshot cascades its redundancy rows. A **published**
snapshot and its redundancy rows are immutable for the life of the dataset.

---

## 7. Practitioner integration and deduplication

A census observation may reference practitioners by stable id
(`practitioner_ids`). References are counted once each in snapshots, and
merged records are never double counted.

Deduplication is never automatic:

1. A **reviewer** flags a possible duplicate (`flagPossibleDuplicate`); a
   researcher cannot. A record cannot duplicate itself.
2. A **reviewer** merges (`mergePractitioners`) with a mandatory documented
   reason. The merged record is **preserved and marked** (`merged_into_id`),
   never deleted, so audit history stays intact. An already-merged record
   cannot merge again.
3. `nationalOverview` and `coverageMeasurements` exclude merged records
   from their counts.

This integrates with the Stage 5 practitioner model without altering it: the
practitioner record gains a `duplicate_flags` array and a `merged_into_id`
field, both managed only through the census workflow.

---

## 8. Evidence, competence and medical safety

Stage 6 is a measurement layer and **must not** leak into the authority of
earlier stages:

- A census observation may *document* an `evidence_status` (e.g. "this
  community reports E2 evidence for this capability"). It **never** upgrades
  the capability's `evidence_level` (Stage 3's controlled upgrade remains
  the only path), never changes `capability_maturity`, and never changes
  `living_status`. The test suite asserts this for every observation.
- Census observations do not assign or imply competence levels (Stage 5's
  assessments remain the only path).
- For the medical families (S01–S20), a census observation is **documentation
  of who reports practicing a historical/community method**, never a medical
  endorsement, clinical validation, or treatment instruction. No capability
  record carries `treatment_instructions`. The standing rule from Stage 5
  holds: *«Preserve the knowledge. Validate the treatment. Protect the
  patient.»*

---

## 9. RBAC (new permissions)

Least privilege. A researcher measures; a reviewer reconciles; a national
administrator approves and publishes.

| Permission | anon | practitioner | researcher | reviewer | regional admin | national admin |
|-----------|:----:|:----:|:----:|:----:|:----:|:----:|
| `census.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `census.create` | | | ✓ | ✓ | ✓ | ✓ |
| `census.approve` | | | | | | ✓ |
| `census.review` | | | | ✓ | ✓ | ✓ |
| `census.snapshot` | | | | | | ✓ |
| `census.export` | | | ✓ | ✓ | ✓ | ✓ |
| `census.merge` | | | | ✓ | ✓ | ✓ |
| `reproduction.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

A census researcher still cannot `evidence.verify` (Stage 3 authority) and
cannot issue certifications (Stage 5 authority). The dimensions stay
independent.

---

## 10. Audit

Every state-changing action writes to the append-only `audit_log`:

`census.created`, `census.methodology_approved`, `census.observation_created`,
`census.observation_reviewed`, `census.observation_correction`,
`census.snapshot_generated`, `census.snapshot_published`,
`census.duplicate_flagged`, `census.practitioner_merged`.

Observation corrections create a new version and preserve the original;
assessment and certification history is never silently rewritten.

---

## 11. Import / export

Census collections participate in the existing atomic transfer system:

- `exportCollection('capability_censuses')` produces a standalone-importable
  collection file that **rides along** the referenced scoped capabilities and
  the referenced methodology, so a census file can be imported on a clean
  install without broken references.
- `importBundle` validates all references atomically; a single broken
  reference (e.g. a made-up location id) rejects the **entire** import and
  changes nothing.
- Stable ids, relationships, versions, review history and privacy settings
  are preserved.

---

## 12. Offline operation

The census works through `SCA.store` like every other stage. A field
researcher can, fully offline:

- create a methodology (draft),
- create a census and observations,
- record practitioner references,
- flag a possible duplicate,
- export a census collection file,
- and later import it on another device.

No external API, cloud profile, mapping service or AI service is required.
The map layer is rendered from documented locations only; no external tile
or geocoding dependency exists in Stage 6.

---

## 13. Build / Runtime Integrity test

Stage 6 introduces a new class of test, distinct from the unit suites:
`tests/build-runtime-integrity.test.js`. The defect class it targets is
exactly the one that escaped Stages 4 and 5 — modules present on disk and
fully unit-tested, but never reachable from the running app.

It checks, against the **shipped** build (not the test loader):

1. **App shell** — every `<script src>` and `<link href>` in `index.html`
   exists on disk.
2. **No orphaned production modules** — every `.js` under `src/` and `data/`
   is shipped in `index.html`.
3. **Service-worker precache** — every precache entry exists, and every
   shipped asset is precached (opening the app once makes it fully
   offline-capable).
4. **Cache version currency** — `SCA.BUILD_STEP` advances with the build
   and the SW `CACHE` name reflects it.
5. **Route registry** — every route the UI links to is registered in
   `app.js`.
6. **Clean install** — all `index.html` scripts load in browser order into
   a fresh sandbox with an empty DOM (exactly what a new device does), the
   store seeds the 240 capabilities, and `router.start()` boots.
7. **Route boot** — every registered page function exists and renders in a
   DOM stub, both with real records and with unknown ids; pages degrade
   honestly instead of crashing.
8. **No fixture leakage** — the integrity suite leaves the baseline intact
   and stores zero fabricated practitioners, censuses or methodologies.

The lesson, encoded as a standing project rule: *"tests passing" ≠ "shipped
app works".*

---

## 14. What Stage 6 does not implement

- National practitioner census or national capability counts from partial
  data.
- Region or capability rankings, "best" region, reputation or risk scores.
- A reproduction score (Stage 5's reproduction pathway is represented; Stage
  6 only counts the people already documented).
- Automatic evidence-level or competence-level changes from census data.
- A national synchronization backend, marketplace, dependency graph,
  predictive analytics or AI assessment.
- Any mandatory network service.

---

## 15. Test state

- 12 suites, **9,046 checks, 0 failures**.
- New: `tests/capability-census.test.js` (870 checks) and
  `tests/build-runtime-integrity.test.js` (274 checks).
- All Stage 1–5 suites continue to pass unchanged.
- The 240 capability inventory is untouched: every record remains E0 / S0 /
  null maturity. No real practitioners, censuses or institutions are seeded;
  all test data is explicitly marked `TEST FIXTURE` and wiped at the end of
  each suite.
