# Stage 14 — National Capability Reserve & Institutional Continuity

Frozen scope v1.1 + Gate C implementation authorization. Stages 1-13
remain frozen; Stage 14 owns exactly the reserve/continuity/asset
records and their presentation, and consumes every other stage's
authority without duplicating or mutating it.

## What Stage 14 answers

- What capabilities require deliberate continuity?
- What people reproduce them? What knowledge preserves them?
- What tools, materials and spare parts sustain them?
- What institutions steward them?
- What fallback and recovery pathways exist?
- What documented continuity gaps remain?

A reserve or plan **never implies a capability is resilient**. Stage
14 documents the conditions for resilience; it does not declare it.

## Entities (exactly three)

| Entity | Collection | Notes |
|---|---|---|
| CapabilityReserve | `capability_reserves` | A deliberately maintained reserve structure. Standalone collection. |
| ContinuityPlan | `continuity_plans` | What must be preserved/reproduced for one capability. `reserve_id` optional. |
| CapabilityAsset | `capability_assets` | One documented continuity component; polymorphic authoritative reference. |

No shadow entities exist (no ReserveAsset, ReserveGap,
ContinuityResult, ContinuityAssessment, ReserveScore,
ResilienceScore, BatteryState, SpineNode, FailureTestResult,
OnePersonResult, ThreeGenerationResult, SuccessorRecord).

## Lifecycles

**Reserve:** `DRAFT → SUBMITTED → VERIFIED → ACTIVE ⇄ SUSPENDED`,
plus `SUBMITTED → REJECTED` and `ACTIVE/SUSPENDED → RETIRED`.
REJECTED and RETIRED are terminal and immutable; no resurrection; no
automatic transitions.

- **VERIFIED** = the reserve definition passed review.
- **ACTIVE** = additionally has a documented custodian (resolving
  to an authoritative organization) and is formally maintained.
- **SUSPENDED** → ACTIVE or RETIRED; reversible by review
  authority with the custodian standard re-applied.

**Plan:** `DRAFT → SUBMITTED → REVIEWED → ACTIVE`, plus
`SUBMITTED → REJECTED` and `ACTIVE → RETIRED`. No SUSPENDED state.

**Independence (frozen §11):** a suspended reserve never
auto-mutates a plan. The UI displays the referenced reserve's state
honestly. Activating a plan never activates a reserve.

## Authority (exactly five permissions)

`reserve.read`, `reserve.create`, `reserve.update`,
`reserve.review`, `reserve.retire`. They govern all three entities
(there are no plan.* or asset.* permissions). There is
deliberately no `reserve.activate/suspend/resume/publish/export/
delete`. Creator/reviewer separation is enforced at the service
layer at every role level **including NATIONAL**. The national
administrator holds every permission through the frozen RBAC
consistency rule; separation is enforced by the workflow guard.

Transition authority:

| Transition | Permission | Guard |
|---|---|---|
| DRAFT → SUBMITTED | reserve.update | creator only |
| SUBMITTED → VERIFIED / REJECTED | reserve.review | reviewer ≠ creator; reason required |
| VERIFIED → ACTIVE | reserve.review | reviewer ≠ creator; documented custodian resolving |
| ACTIVE → SUSPENDED | reserve.update | creator only; reason required |
| SUSPENDED → ACTIVE | reserve.review | reviewer ≠ creator; custodian re-checked |
| ACTIVE/SUSPENDED → RETIRED | reserve.retire | reason, actor, timestamp |
| Plan SUBMITTED → REVIEWED / REJECTED | reserve.review | reviewer ≠ creator; reason |
| Plan REVIEWED → ACTIVE | reserve.review | reviewer ≠ creator; reason |
| Plan ACTIVE → RETIRED | reserve.retire | reason, actor, timestamp |

## Frozen vocabularies

- **Reserve types (8, array):** HUMAN_RESERVE, KNOWLEDGE_RESERVE,
  TECHNICAL_RESERVE, MATERIAL_RESERVE, BIOLOGICAL_RESERVE,
  INSTITUTIONAL_RESERVE, GEOGRAPHIC_RESERVE, FALLBACK_RESERVE.
- **Asset categories (13):** HUMAN, KNOWLEDGE, TOOL, EQUIPMENT,
  MATERIAL, SPARE_PART, DOCUMENTATION, TRAINING, WORKSHOP,
  INSTITUTION, BIOLOGICAL, ENERGY, FALLBACK_CAPABILITY. Each maps
  to authoritative existing sources (Stage 14 creates none):
  HUMAN→practitioners/apprentices, KNOWLEDGE/DOCUMENTATION→
  knowledge/evidence, TOOL→tools, EQUIPMENT→tools/materials/
  spare parts, MATERIAL→materials, SPARE_PART→spare_parts,
  TRAINING→training_programs, WORKSHOP→workshops,
  INSTITUTION→organizations, ENERGY→energy_sources,
  FALLBACK_CAPABILITY→capabilities. **BIOLOGICAL** has no source
  entity and may be documentation-only ("Not yet documented", no
  reference, notes retained; no biological entity is ever created).
- **Disruption scenarios (6):** IMPORTS_UNAVAILABLE_6_MONTHS,
  ELECTRICITY_UNAVAILABLE_72_HOURS, INTERNET_UNAVAILABLE_30_DAYS,
  FUEL_UNAVAILABLE, EXTERNAL_TECHNICIANS_UNAVAILABLE,
  CRITICAL_KNOWLEDGE_HOLDER_UNAVAILABLE. These are
  dependency-availability scenarios for examination — no predicted
  outcomes, no failure probability. Stage 8 FailureScenario stays
  authoritative for equipment/system failure modes; neither system
  creates or mutates the other's records.
- **Known gaps (13):** NO_TRAINER, NO_APPRENTICE,
  SINGLE_KNOWLEDGE_HOLDER, NO_DOCUMENTATION, NO_LOCAL_REPAIR,
  NO_SPARE_PART, NO_FALLBACK, SINGLE_LOCATION,
  EXTERNAL_TECHNICIAN_DEPENDENCY, EXTERNAL_MATERIAL_DEPENDENCY,
  ENERGY_DEPENDENCY, INSTITUTIONAL_GAP, UNKNOWN. A gap is a
  documented condition, never a score.

## Derived read-only views (never persisted)

- **One-Person Test:** "One practitioner is currently documented
  within the available evidence/census scope" — NEVER "only one
  practitioner exists" (Stage 6 census semantics).
- **Three-Generation Test:** derived from Stage 5 reproduction
  data over the frozen states NOT_DOCUMENTED, PRACTITIONER_ONLY,
  TRAINER_PRESENT, APPRENTICE_PRESENT, COMPETENT_SUCCESSOR,
  TRAINER_SUCCESSOR, REPRODUCTION_DOCUMENTED (strongest-first
  deterministic precedence).
- **National Capability Battery:** presentational view of
  documented components of ACTIVE reserves. No percentage, no
  score, no ranking.
- **Capability Spine:** conceptual navigation only
  (Knowledge → People → Energy → Water → Food → Health →
  Materials/Repair → Mobility/Trade → Governance → Reproduction).
  Not a taxonomy; the twelve frozen families remain authoritative.

## Provenance and transfer (Stage 13 lessons from day one)

Every imported non-DRAFT state requires legitimate provenance:

- **VERIFIED/REJECTED (reserve), REVIEWED/REJECTED (plan):** a
  distinct reviewer with real local-roster `reserve.review`
  authority, a documented reason, a timestamp; the rejection actor
  must be the reviewing actor.
- **ACTIVE/SUSPENDED:** the review foundation PLUS a custodian
  that resolves. The only legitimate path into SUSPENDED is
  ACTIVE → SUSPENDED, which by definition passed the ACTIVE gate.
- **RETIRED:** a retirement actor resolving to a local-roster
  account with `reserve.retire` authority, plus reason/timestamp.
- **Path guards:** imports never manufacture lifecycle history
  (e.g., a local DRAFT reserve cannot be imported into VERIFIED/
  ACTIVE/SUSPENDED; the only legitimate path into VERIFIED is
  SUBMITTED).
- **Terminal protection:** a local REJECTED/RETIRED record can be
  re-imported UNCHANGED but never resurrected.
- **Assets:** category vocabulary, authoritative-source mapping
  and reference resolution; malformed or unresolvable references
  reject.
- Users never travel in bundles; the importing deployment's local
  roster is the only authority. Every rejection is atomic and
  byte-identical — no partial mutation, no partial audit.

## Boundaries

- **No automatic coupling** with interventions, pilots,
  marketplace, certification, evidence, maturity, census, recovery
  or plan/reserve lifecycles.
- **No scores/rankings** of any kind (ReserveScore,
  ContinuityScore, ResilienceScore, BatteryPercentage, RiskScore,
  FailureProbability etc. are prohibited).
- **Graph stays at 19 relationship types** — asset references are
  not graph edges.
- **Stage 12** remains the only measurement path; **Stage 13** the
  only marketplace; **Stage 5** owns practitioners and person
  privacy (essential_people are structured references, never
  free-text inventories); **Stage 3** owns evidence/knowledge.
- Successor/secondary custodian fields are optional documented
  references — a populated field never implies the role is staffed.

## Routes

`#/reserves` and `#/reserves/:id`. Continuity plans have no
separate route: they render inside reserve detail and capability
detail (the capability detail page gains a read-only continuity
section). BUILD_STEP = 14; service-worker cache `sca-step14-v1`.

## Clean baseline

240 capabilities, 12 families, 19 graph relationship types; zero
production CapabilityReserve, ContinuityPlan or CapabilityAsset
records; no seeded custodians, assets or continuity claims.
