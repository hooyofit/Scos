# Stage 9: Failure & Recovery System — Architecture

**Build step:** 9 of 17 · **Status:** Build complete, awaiting inspection
**Predecessors:** Stages 1–8 frozen (Stage 8.1 corrections applied)
**Scope:** frozen Stage 9 Scope v2.1 (25 pins) — no functionality beyond the frozen scope is implemented

---

## 1. Purpose

Stage 9 documents what is known about **what happens when an important capability, tool, workshop, energy source or place fails**, and **what documented paths exist to recover**: fallback capabilities, the Stage 8 repair network, substitutions, local fabrication and external support. It also gives the "lost skills of independence" lens: when a community depends on a capability as a fallback, is that fallback capability itself alive, reproducible and repairable?

Stage 9 is deliberately a **documentation and composition layer**, not an impact-scoring engine. It answers descriptive questions (what is documented?) and never evaluative ones (how bad is it? how ready are we?).

## 2. Architectural rules (permanent, frozen)

1. **Exactly one new operational entity: `RecoveryProfile`.** It documents ONE recovery target of ONE recovery kind for ONE subject asset. Multiple targets require multiple profiles. The reserved `FallbackSystem` schema stub is **absorbed** (marked as such; never a second entity).
2. **Subject asset types are exactly the Stage 8 five** (`CAPABILITY`, `TOOL`, `WORKSHOP`, `ENERGY_SOURCE`, `LOCATION`), consumed from the Stage 7 node registry through `SCA.repair.ASSET_TYPES` — no duplicate asset identity system.
3. **Exactly five recovery kinds** (frozen vocabulary, in `SCA.enums.recovery_kinds`):
   - `FALLBACK_CAPABILITY` — another capability substitutes
   - `REPAIR_NETWORK` — a Stage 8 repair capability repairs
   - `SUBSTITUTION` — a spare part, material, tool or capability substitutes
   - `FABRICATION` — a fabrication-capable repair capability or workshop fabricates
   - `EXTERNAL_SUPPORT` — an external organization supports

   Which target collections are valid for which kind (the implementation pin resolved by this build, reported for inspection):

   | Kind | Valid target types |
   |---|---|
   | `FALLBACK_CAPABILITY` | `CAPABILITY` |
   | `REPAIR_NETWORK` | `REPAIR_CAPABILITY` |
   | `FABRICATION` | `REPAIR_CAPABILITY` (operations include `FABRICATION`), `WORKSHOP` |
   | `SUBSTITUTION` | `SPARE_PART`, `MATERIAL`, `TOOL`, `CAPABILITY` |
   | `EXTERNAL_SUPPORT` | `ORGANIZATION` |

   Possession of one operation never implies another: a `FABRICATION` profile may only target a repair capability whose documented `repair_operations` include `FABRICATION`.
4. **Targets are never practitioners.** Recovery is documented against assets and organizations, never persons (Stage 9 v1 privacy rule).
5. **A RecoveryProfile is NOT a graph node.** The Stage 7 vocabulary remains exactly 19 relationship types. No Stage 9 operation creates a graph edge; no graph edge creates a RecoveryProfile. Edge citations are **soft references**: an unresolvable citation is flagged honestly (integrity warning), never blocks a valid record, and never causes the missing edge to be created.
6. **Stage 8 remains authoritative** for `FailureScenario`, `RepairCapability`, `RepairRecord`, `SparePart`, `Tool`, `Material`, `Workshop`, repair pathways and repair searches. Stage 9 consumes them **only** through their existing public interfaces (`SCA.repair`, `SCA.graph`, `SCA.training`).
7. **No scores of any kind.** No resilience, risk, criticality, vulnerability or readiness numbers. `expected_recovery_time`, `recovery_radius` and `recovery_cost` are descriptive free text only.
8. **No inference from absence.** Absence of documentation is always Unknown, never "no impact", "no coverage" or "none exist". Views say this explicitly.
9. **No second competency, census or provenance system.** Provenance references point at existing Stage 3 evidence / knowledge artifacts and Stage 4 field observations. Reproduction information comes from the Stage 5 public API.
10. **The 240-capability inventory is never modified.** All Stage 9 data is additive in new collections.

## 3. Data model

`recovery_profiles` (model: `src/models/recovery-profile.js`, canonical schema: `schemas/recovery-profile.schema.json`):

- `name`, `asset_type` + `asset_id` (subject), `failure_scenario_id` (optional Stage 8 context)
- `recovery_kind`, `target_type` + `target_id` (exactly one target)
- `description`, `conditions`, `required_resources`, `limitations`, `notes`
- `expected_recovery_time`, `recovery_radius`, `recovery_cost` (descriptive text)
- `edge_citations` (soft), `source_ids`, `knowledge_artifact_ids`, `field_observation_ids` (provenance)
- lifecycle: `status`, `reviewer`, `reviewed_at`, `review_reason`, `supersedes_id`, `version`, `history`

### Lifecycle (frozen)

```
PROPOSED → DOCUMENTED → VERIFIED
                ↘ REJECTED (review outcome OR audited administrative retirement)
any active → SUPERSEDED (correction)
```

- `DOCUMENTED` requires provenance (at least one evidence source, knowledge artifact or field observation).
- `VERIFIED` requires a reviewer (`recovery.review`) and an explicit reason. Creators can never verify.
- **There is deliberately NO `RETIRED` state.** Administrative retirement is `REJECTED` with an explicit reason — audited, never silent, never a deletion.
- Verified or retired profiles are never edited in place; corrections supersede.
- **Supersession follows the Stage 8.1 proven pattern:** retire the original first, then create and validate the successor; if successor creation fails, the original is restored byte-exactly (except the store-managed `updated_at`) and the failed attempt is audited (`recovery.profile_supersede_rolled_back`). The persistent invariant holds: at most ONE active profile per signature.

### Duplicate signature (frozen)

`subject asset + recovery kind + target reference` is the signature. At most one ACTIVE (`PROPOSED`/`DOCUMENTED`/`VERIFIED`) profile may exist per signature. Retired history frees the signature.

## 4. Workflow (`SCA.recovery`, `src/recovery/workflow.js`)

- **Lifecycle:** `createRecoveryProfile`, `updateRecoveryProfile` (PROPOSED/DOCUMENTED only), `documentRecoveryProfile`, `verifyRecoveryProfile`, `rejectRecoveryProfile` (also retirement), `supersedeRecoveryProfile`.
- **Retrieval:** `getRecoveryProfile`, `searchRecoveryProfiles`, `activeProfilesFor`.
- **Three frozen views (read-time compositions; nothing persisted, no hidden duplicate graph):**
  - `failureImpact(user, {asset_type, asset_id}, {depth})` — documented failure scenarios for the subject, plus affected nodes derived by traversing **reverse dependency edges through the frozen Stage 7 API** (breadth-first, depth-capped, cycle-safe). Every affected node carries a **basis**:
    - `DIRECT_DOCUMENTED` — a single-hop DOCUMENTED/VERIFIED dependency edge explicitly documents the dependency;
    - `GRAPH_DERIVED` — structural derivation only (multi-hop or a not-yet-reviewed edge), **never asserted as a certain consequence**;
    - no documentation at all → the view states Unknown, never "unaffected".
    Per affected node the view reports documented fallback edges (Stage 7 `FALLS_BACK_TO`), Stage 8 repair coverage (through `SCA.repair.searchRepairCapabilities`) and Stage 9 recovery profiles — as documentation-or-Unknown, never scores.
  - `fallbackReadiness(user, capabilityId)` — for a capability that other things may fall back TO: living status, evidence level, documented `FALLS_BACK_TO` edges and `FALLBACK_CAPABILITY` profiles targeting it, Stage 5 reproduction summary (the public API is already count-only, so practitioner **names never enter this view for any role** — stricter than the Stage 8 masking rule), and Stage 8 repair coverage. Descriptive only; no readiness score exists.
  - `recoveryOverview(user, {asset_type, asset_id})` — one composed page view: failure scenarios, impact summary, recovery options grouped under exactly the five kinds, repair coverage, and explicit unknowns.
- **Integrity:** `SCA.recovery.integrity(user)` — flags invalid statuses/kinds, unresolvable subjects, targets, scenarios and provenance, missing reviewer trails on VERIFIED records, and duplicate active signatures as **errors**; soft edge citations and orphan supersession references as **warnings**. It never deletes or "fixes" anything silently.

## 5. Permissions (RBAC, additive)

| Permission | Roles |
|---|---|
| `recovery.read` | everyone including anonymous (public coverage; records are not personal data, and targets are never practitioners) |
| `recovery.create` | researcher, technician, practitioner, workshop, community_steward |
| `recovery.update` | researcher, technician, community_steward |
| `recovery.review` | reviewer, regional_administrator (verification, rejection AND audited retirement) |

Deliberately **no `recovery.export`** (frozen scope): export uses the existing global export machinery. Anonymous visitors see only reviewed (`DOCUMENTED`/`VERIFIED`) records; history (`REJECTED`/`SUPERSEDED`) is staff-only. National administrator holds all four (consistency rule).

## 6. Transfer (import/export)

- `recovery_profiles` joins the exportable collections; full bundles and single-collection exports both carry it.
- **Hard references** (active records): subject asset (dynamic, Stage 7 registry — exactly the Stage 8 mechanism), failure scenario, and all provenance ids must resolve in the candidate dataset; **the recovery target resolves through its own frozen type→collection map** (targets include non-node collections like repair capabilities, spare parts and organizations).
- **Single-collection exports carry the canonical target, subject and provenance records**, so a recovery-only file is independently importable.
- **Retired-history exemption (frozen precedent):** REJECTED/SUPERSEDED profiles keep broken references by design — audited retirement, never silent deletion; active records are held to the full standard.
- **Edge citations are soft by design:** never validated on import, never blocking, never created.
- Imports remain **atomic**: validation runs over the whole candidate dataset before any mutation; a rejected import changes nothing.
- `SCA.BUILD_STEP = 9`; the service-worker cache version follows.

## 7. Pages

- `#/recovery` — Failure & Recovery area: honest scope notices, documented-profile counts by kind (never claims about what exists), search by name/kind, an impact & readiness composer (capability picker → `failureImpact` + `fallbackReadiness`), and a create form for permitted roles. Anonymous visitors see reviewed records only.
- `#/recovery-profile/:id` — profile detail with status, kind, subject, target, provenance counts, review trail and honest degradation for unknown ids.

## 8. What Stage 9 deliberately does NOT do

- No new graph relationship types; no graph writes of any kind.
- No resilience/risk/readiness scores, weights, rankings or traffic lights.
- No modification of Stage 8 models, workflows, or the 240-capability inventory.
- No person-targeted recovery profiles; no practitioner names in any Stage 9 view.
- No Intervention planning (deferred, per the frozen roadmap).
- No fabricated recovery data: every fixture in the test suites is marked `TEST FIXTURE`.

## 9. Testing

`tests/recovery-system.test.js` (15th suite) covers: frozen model shape; kind→target validation (all five kinds, both valid and invalid targets); duplicate signature guard; full lifecycle incl. retirement-as-REJECTED; supersession incl. same-signature corrections and byte-exact rollback; the graph boundary (19 types unchanged, no auto edges, soft citations flagged not blocking); the Stage 8 public-API-only boundary; the three views incl. `DIRECT_DOCUMENTED` vs `GRAPH_DERIVED` vs Unknown; privacy (anon visibility, count-only practitioner data, never-person targets); integrity honest flags; export/import incl. round-trip, standalone single-collection import, soft-citation tolerance, hard-reference rejection and the retired-history exemption; and frozen boundaries (240 unchanged, one entity, no second engines). `tests/build-runtime-integrity.test.js` (permanent requirement) extends to BUILD_STEP 9, recovery route boots (happy path + unknown id), and zero fixture leakage.

All fixtures are `TEST FIXTURE`-marked; every suite wipes its store and confirms the pristine baseline at teardown.
