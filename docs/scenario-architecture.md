# Stage 15 — Capability Scenario Analysis Foundation

Frozen scope v1.1 (§28 + amendments A1–A9) + Implementation
Authorization v1.0. Stages 1–14 remain frozen; Stage 15 owns
exactly the transient scenario-analysis engine and its single
page, and consumes every other stage's authority without
duplicating or mutating it.

## What Stage 15 answers

- If a documented subject (capability, resource, material, tool,
  energy source, institution …) becomes unavailable, what
  documented dependencies does it have?
- Which records are directly connected, and which follow through
  derived multi-hop paths?
- What documented recovery, fallback, reserve, continuity,
  reproduction and repair pathways exist for the affected
  capabilities?
- What remains Unknown?

The Atlas **does not predict outcomes**. A scenario analysis
documents dependencies and pathways; it never declares
resilience, likelihood, impact severity or failure probability.

## Entities (exactly zero)

| Entity | Collection | Notes |
|---|---|---|
| — none — | — | Stage 15 is a pure derived read layer. |

No Scenario, ScenarioResult, ScenarioRun, ImpactAssessment or
RunHistory entity exists; no collection, no stored state, no
lifecycle, no permissions. Requests are transient and recomputed
from the local dataset on every run.

## The scenario request

A request names:

- a **scenario kind**: `DISRUPTION` (one of the six frozen
  Stage 14 disruption codes) or `FAILURE_SCENARIO` (a Stage 8
  `FailureScenario` reference — Stage 8 remains the sole
  authority for equipment/system failure modes);
- a **subject**: one canonical node type and id (person node
  types excluded);
- an optional **location scope** (`location_ids`, canonical
  Stage 1 locations only);
- a **traversal depth**: default 2, maximum 5 (a traversal
  property, never a risk score);
- a **mode**: exactly `STRUCTURE` (the only mode that exists).

Unknown kinds, unknown disruption codes, unknown scenarios,
non-existent subjects, invented geography and depths above 5 are
rejected — never approximated.

## Traversal rules (A4 direction map)

Only `DOCUMENTED` and `VERIFIED` graph edges are traversed.
`PROPOSED` edges never enter an analysis; they surface only as
explicitly-labeled **unverified context**.

Every one of the 19 frozen relationship types has one pinned
classification:

| Section | Direction | Types |
|---|---|---|
| CASCADE | REVERSE (dependents of the failed node) | DEPENDS_ON, REQUIRES, USES_RESOURCE, USES_ENERGY, REQUIRES_INSTITUTION |
| CASCADE | FORWARD (things the failure affects through its dependents) | SUPPORTS, ENABLES, MAINTAINS, PRODUCES |
| RECOVERY (display, not cascade) | — | FALLS_BACK_TO, RECOVERED_BY, MODERNIZED_BY, REPAIRS, FAILS_UNDER |
| REPRODUCTION (display, counts only) | — | TEACHES, REPRODUCES |
| Excluded from analysis | — | LOCATED_IN, EVIDENCED_BY, DOCUMENTED_IN |

Traversal is breadth-first, cycle-safe (a node enters a cascade
once), depth-capped (default 2 / max 5) and node-capped
(500 — a bounded result, never a completeness claim).

## Evidence bases (§11, Stage 9 semantics)

Every derived statement carries exactly one basis:

- **DOCUMENTED** — a direct reviewed edge (depth 1) with its
  supporting path displayed;
- **DERIVED** — a multi-hop path through documented edges
  (Stage 9 `GRAPH_DERIVED` semantics);
- **UNKNOWN** — not represented in the dataset; never a finding
  of absence (an empty cascade is Unknown, not "unaffected");
- **NOT_APPLICABLE** — the question does not apply (e.g. an
  equipment failure scenario asked of a resource).

## Capability sections (§10 A–K)

For every affected capability the analysis composes:

- direct connections (both directions, with edge status);
- the dependency cascade;
- recovery pathways (Stage 9 profiles + Stage 8 repair
  capabilities, consumed through their frozen APIs);
- fallback pathways (Stage 7 edges + Stage 14 derived views);
- reserve and continuity coverage (Stage 14 read APIs);
- human reproduction capacity (Stage 5/14 counts only — the
  One-Person Test wording is census-honest: "available
  evidence/census scope", never "only one person exists");
- repair capacity (Stage 8 search API);
- intervention / pilot / marketplace context (contextual only —
  analysis never creates, recommends or triggers them);
- known gaps (Stage 14 gap conditions, documented not scored);
- recovery and continuity chains with explicit missing links;
- unknowns.

## Comparison view (§20)

The comparison runs multiple scenarios **on the same subject**
and presents factual structural differences as parallel columns.
It declares no winner, assigns no ordering and computes no
score. Comparisons across different subjects are rejected.

## Privacy

The engine inherits the frozen graph privacy rules: person
nodes never enter cascades; anonymous users see counts only,
never practitioner names; an anonymous user cannot run a
scenario on a practitioner as subject.

## Determinism and integrity

Identical requests produce byte-identical results. The engine is
offline-only (zero network references) and writes nothing: a
full analysis plus comparison leaves the store byte-identical.
`SCA.scenario.integrity()` self-describes the frozen caps (19
types, four evidence bases, depth 5, node cap 500).

## Route

Exactly one route: `#/scenarios`. The request is encoded in the
query string so it can be shared; the result is recomputed on
every load. There is no `#/scenarios/:id` route because there is
no persistent Scenario record.

## What Stage 15 deliberately is not

- no prediction, simulation or outcome forecasting;
- no likelihood, severity, probability or impact scores;
- no ScenarioRanking, RiskScore, ResilienceScore or
  FailureProbability artifact (prohibited and tested);
- no new entities, collections, permissions, relationship
  types, vocabularies or UI primitives beyond `#/scenarios`;
- no writes, no automatic interventions, no recommendations.

## Files

| File | Role |
|---|---|
| `src/scenario/workflow.js` | The engine: validation, direction map, traversal, composition, comparison, integrity. |
| `src/pages/scenarios.js` | The single transient page. |
| `tests/scenario-system.test.js` | §28's 21 categories + A9 additions. |
| `tests/build-runtime-integrity.test.js` | Stage 15 runtime proofs (offline boot, determinism, zero writes, no ghost permissions, zero Stage 15 collections). |
