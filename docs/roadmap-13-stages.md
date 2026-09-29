# Roadmap: 14 Stages

Discipline: build one stage, produce a completion report, the project owner
inspects, then the next stage begins. No stage is started automatically.

**Explicit roadmap amendment (Stage 10, frozen scope v1.1):** the
original 12-stage roadmap placed the Capability Marketplace at Stage 10.
The Stage 10 scope review established that Intervention Planning is a
genuine architectural gap and should precede marketplace and pilot
execution, so the roadmap is DELIBERATELY amended — not an accidental
omission: Stage 10 is now the Capability Intervention Foundation and
the Marketplace moves to Stage 13, after the Regional Pilots (11) and
the National Capability Operating System (12) can supply verified
capability supply, demand and operational evidence. The Marketplace is
not deleted.

| Stage | Deliverable | Status |
|-------|-------------|--------|
| 1 | Portable Architecture Foundation — PWA, schema, models, auth abstraction, roles, offline layer, export/import, 12 families, empty capability system, documentation | **Complete** |
| 2 | Capability Inventory — 240 capability records across the 12 families, all E0/Unverified, searchable and exportable | **Complete — frozen** |
| 3 | Evidence & Knowledge Archive — sources, claims, artifacts, provenance, verification workflow, audit trail, consent | **Complete — frozen** |
| 4 | Field Research & Evidence Collection Framework — projects, sessions, offline collection queue, consent, conflicts, evidence submission | **Complete — frozen** |
| 5 | Practitioner, Apprenticeship & Capability Reproduction Framework — practitioners, competence assessments, apprenticeships, training programs, certifications, reproduction loop | **Complete — frozen** |
| 6 | Capability Census & Regional Capability Mapping Foundation — methodology, censuses, observations with count bases, unknown-aware views, immutable snapshots, geographic redundancy, practitioner dedup, build/runtime integrity test | **Complete — frozen** |
| 7 | Capability Dependency Graph & Systems Relationships Foundation — 19-type relationship vocabulary, provenance-gated lifecycle (proposed → documented → verified), supersession, privacy, traversal & integrity, graph pages | **Complete — frozen** |
| 8 | Repair & Spare-Part Network — workshops, repair capabilities, spare parts, failure scenarios, repair records, pathways (repair / spare-part / fabrication), privacy, graph integration | **Complete — frozen** |
| 9 | Failure & Recovery System — recovery profiles (fallback / repair / substitution / fabrication / external support), impact & readiness views, integrity, privacy, transfer | **Complete — frozen** |
| 10 | Capability Intervention Foundation — planned, reviewed, approved and tracked capability-strengthening interventions with dependency disclosure, successor-before-launch and reviewer-governed outcome status | **Complete — frozen** |
| 11 | Regional Capability Pilots — one PilotProject coordination umbrella over existing interventions, organizations, workshops and training programs; no outcome fields, no geographic RBAC | **Complete — frozen** |
| 12 | Capability Observatory & Measurement Foundation — measurements with Stage 6 count bases, versioned indicator definitions with dynamic read-only computation, observatory views and the non-judging balance sheet | **Built — awaiting inspection** |
| 13 | Capability Marketplace — MarketplaceListing entity (OFFER/NEED), 12 frozen service kinds, review-gated DRAFT→SUBMITTED→PUBLISHED⇄PAUSED lifecycle with terminal REJECTED/WITHDRAWN, polymorphic provider references to existing frozen records, structural privacy (no contact/pricing/ranking fields), derived read-only matching, 5 flat permissions, atomic transfer | **Complete — awaiting inspection** (deliberately moved from Stage 10 by the explicit Stage 10 roadmap amendment above) |
| 14 | National Capability Reserve & Institutional Continuity — CapabilityReserve, ContinuityPlan and CapabilityAsset entities; reserve lifecycle DRAFT→SUBMITTED→VERIFIED→ACTIVE⇄SUSPENDED with terminal REJECTED/RETIRED (VERIFIED = definition passed review; ACTIVE = documented custodian); plan lifecycle DRAFT→SUBMITTED→REVIEWED→ACTIVE with terminal REJECTED/RETIRED and no SUSPENDED; independent lifecycles with honest display; frozen vocabularies (8 reserve types, 13 asset categories, 6 disruption scenarios, 13 known gaps); structured essential-people references under Stage 5 privacy; BIOLOGICAL documentation-only rule; derived read-only One-Person Test, Three-Generation Test, National Capability Battery and Capability Spine (never stored); Stage 13 provenance lessons from day one (local-roster actors, terminal protection, atomic transfer); 5 flat permissions; #/reserves routes | **Complete — awaiting inspection** (Stage 14 scope frozen v1.1 + Gate C authorization) |

| 15 | Capability Scenario Analysis Foundation — transient derived layer (zero new entities, zero new permissions): six frozen Stage 14 disruption codes + Stage 8 failure scenarios as subjects' triggers; pinned 19-type traversal direction map (DOCUMENTED/VERIFIED edges only, PROPOSED as unverified context); evidence bases DOCUMENTED/DERIVED/UNKNOWN/NOT_APPLICABLE with displayed paths; depth default 2 / max 5, node cap 500; capability sections §10 A–K consumed through frozen Stage 5/7/8/9/12/13/14 APIs; comparison view with no ranking; single transient #/scenarios route, no :id; offline, deterministic, zero writes | **Complete — awaiting inspection** (Stage 15 scope frozen v1.1 + implementation authorization v1.0) |

## Where future modules attach

- Stages 2-3 build on the capability/evidence models and `source_ids` references.
- Stages 4-5 build on the practitioner/apprentice models and the consent and
  visibility fields already in the schema.
- Stage 6 (census) builds on the Stage 5 practitioner registry, the
  location model, and the atomic export/import system; the capability
  dependency graph remains a later stage and builds on the `dependencies`
  list field and the 19 relationship types documented in
  `docs/capability-data-model.md`.
- Stage 8 (repair & spare parts) builds on the Stage 7 graph (REPAIRS /
  MAINTAINS / RECOVERED_BY / FALLS_BACK_TO / TEACHES edges), the Stage 5
  practitioner registry (competence), the Stage 3 evidence archive
  (provenance) and the Stage 2.1 atomic export/import system. No second
  relationship engine was introduced: repair semantics are expressed in the
  frozen 19-type vocabulary. Stage 9 builds on `materials`, `tools`,
  `modern_equivalent`, `fallback`, `failure_scenarios` and the Stage 8
  repair records.
- Stage 7/12 build on regions, the export/import format, and the
  replaceable-backend seams.
- Stage 10 (capability interventions) builds on every earlier layer by
  REFERENCE only: capabilities (2), evidence (3), research projects (4),
  practitioner/training/certification records (5), census context (6),
  dependency information (7), failure scenarios and repair structures (8)
  and recovery profiles (9). It introduces no second system for any of
  them; Measurement/Indicator arrive only at Stage 12, the Marketplace
  only at Stage 13.

## Stage 1 scope (delivered)

See the completion report and `docs/architecture.md`. Deliberately NOT
built: graph visualization, failure simulation, marketplace, census,
spare-parts registry, pilot management, offline synchronization, AI
knowledge generation.
