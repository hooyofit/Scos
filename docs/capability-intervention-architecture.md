# Capability Intervention Architecture (Stage 10)

Frozen scope: Stage 10 Scope v1.1 · Implementation authorization v1.0.
This document records the architecture as BUILT, including the
implementation pins resolved during the build.

## Purpose

Stage 10 answers: *what action is being proposed or undertaken to
strengthen an existing capability, reduce a documented vulnerability,
improve recovery capacity, preserve knowledge, develop people, or
establish a missing capability pathway?*

The Atlas distinguishes four things, never collapsed into one number:

| Layer | Question | Authoritative stage |
|---|---|---|
| Capability state | What exists now? | Stages 2–6 |
| Failure exposure | What can cause failure? | Stages 7–8 |
| Recovery capacity | How does recovery occur? | Stage 9 |
| Intervention | What do humans propose/undertake to strengthen it? | **Stage 10** |

## The one entity

`CapabilityIntervention` (collection `capability_interventions`) is the
ONLY Stage 10 domain entity. There is deliberately no
InterventionMeasurement, InterventionOutcome, InterventionPlan,
InterventionProject or InterventionEvaluation:

- Measurement and Indicator stay deferred to Stage 12 (National
  Capability Operating System). Stage 10 records qualitative outcome
  status only.
- Outcome evidence flows through the EXISTING Stage 3/4 records
  (evidence sources, knowledge artifacts, field observations,
  research projects).
- Supporting planning code (workflow, page, validators, tests) is not
  a domain entity.

## Dimension separations (permanent)

- **ResearchProject (Stage 4) ≠ CapabilityIntervention (Stage 10).**
  Stage 4 governs evidence-collection activities; Stage 10 governs
  capability-strengthening actions. An intervention needing research
  references a ResearchProject; it never duplicates it.
- **FailureScenario (Stage 8)** stays authoritative for documented
  failure contexts: interventions reference `failure_scenario_ids`
  and never copy the scenario's asset/symptom/category data. Free-form
  problem text is only for problems not yet represented as a
  canonical scenario.
- **RecoveryProfile (Stage 9)** stays authoritative for recovery
  planning; interventions reference profiles, they never recreate
  recovery planning.
- **Stage 5** stays authoritative for competence, training,
  apprenticeship and certification: PEOPLE-type interventions reference
  TrainingPrograms/Apprenticeships/Assessments and never manufacture
  competence.
- **Stage 3** stays authoritative for evidence and provenance:
  external research enters ONLY through EvidenceSource; no parallel
  citation system exists.
- **Stage 7 graph**: an intervention is NOT a graph node and never
  creates, modifies, verifies, supersedes or retires a relationship.
  The 19-type registry is untouched.

## Lifecycle (frozen)

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE → COMPLETED
                       │                         │
                       ├→ DRAFT (return)          ├→ SUSPENDED
                       └→ CANCELLED (discard)     │   ├→ ACTIVE (resume)
                                                 │   ├→ COMPLETED
                                                 │   └→ CANCELLED
                                                 └→ CANCELLED
```

- **SUBMITTED/UNDER_REVIEW lock substantive creator editing.**
- **UNDER_REVIEW → DRAFT** is a return for correction (explicit
  reason, audited, edit lock released). It is not a rejection.
- **UNDER_REVIEW → CANCELLED** is the terminal discard path.
- **APPROVED/ACTIVE/SUSPENDED** change only through an explicit,
  attributable **amendment** with a mandatory reason (full snapshot in
  history, change_type AMENDMENT). No silent mutation.
- **COMPLETED/CANCELLED are terminal**: historical records are never
  edited, and transfer keeps their broken references by the
  established historical-retirement exemption.
- **COMPLETED never implies success**: completion does not touch
  outcome status, so `COMPLETED + UNKNOWN` is a valid, honest state.

## Authority matrix (implementation pin, resolved)

Transition authority follows least privilege on the four frozen
permissions. The RBAC matrix has NO overlap between creator roles and
review roles, so a creator can never self-approve — the workflow adds
a `created_by` guard as a second structural check.

| Transition | Permission | Notes |
|---|---|---|
| create, edit DRAFT | intervention.create / intervention.update | creator side |
| DRAFT → SUBMITTED | intervention.create | requires name + objective |
| SUBMITTED → UNDER_REVIEW | intervention.review | reviewer; never the creator |
| UNDER_REVIEW → APPROVED | intervention.review | reason required; gates below |
| UNDER_REVIEW → DRAFT / CANCELLED | intervention.review | reason required |
| APPROVED → ACTIVE, ACTIVE/SUSPENDED → …, COMPLETED, CANCELLED | intervention.update | execution side; suspend/cancel/resume require reasons |
| outcome status | intervention.review | reviewer-governed; implementers never self-assess |

There is deliberately **no `intervention.export` permission**: export
uses the existing global export machinery.

## Approval gates

1. **Successor-before-launch** (presence-of-value): if
   `depends_on_human_capability` is set, `critical_roles` must be
   recorded — each entry needs a role label and either a resolvable
   canonical Stage 5 practitioner reference (IDENTIFIED) or an
   explicit UNKNOWN. UNKNOWN is honest and passes; a blank field
   fails. Nothing is fabricated.
2. **No Orphan Project Rule**: approval requires documented
   requirements (any of the required_* / dependencies arrays,
   fallback/training/maintenance text, critical roles, activities) OR
   the explicit, auditable `self_contained` claim. An intervention
   must not appear self-sufficient when its operation depends on
   undocumented external capabilities.

## Outcome status (reviewer-governed, never scored)

Values: UNKNOWN (default), SUCCESSFUL, MIXED, UNSUCCESSFUL,
INSUFFICIENT_EVIDENCE.

- Categorical only: no score, percentage, rating or ranking exists
  anywhere in Stage 10.
- Assessed ONLY on a COMPLETED record (an ongoing activity has no
  honest outcome yet).
- Requires reviewer authority, an explicit reason, and outcome
  evidence references (existing Stage 3/4 records) when changing from
  UNKNOWN.
- Fully audited; the supporting evidence references are preserved on
  the record.

## No duplicate-signature guard (frozen)

Unlike RecoveryProfile, interventions deliberately do NOT enforce
one-active-per-signature. Multiple interventions addressing the same
capability, problem, scenario, recovery profile or region are
legitimate competing approaches (parallel pilots, different
organizations, alternative technologies) and are recorded
independently. Integrity never merges or suppresses them.

## Privacy, visibility, RBAC

- Anonymous users see only APPROVED / ACTIVE / COMPLETED records;
  DRAFT / SUBMITTED / UNDER_REVIEW and internal problem statements are
  staff-only; SUSPENDED / CANCELLED follow explicit access
  classification (staff-only here).
- Practitioner references follow the existing Stage 5 masking rules:
  public views show role descriptions ("Technician required: 1 —
  identity restricted") and counts, never identities.
- Location references use canonical locations; precision is never
  inferred.
- No geographic RBAC engine: "regional review" is the existing role.

## Transfer (atomic, offline-first)

- `capability_interventions` is exportable; single-collection exports
  carry referenced canonical records (including critical-role
  practitioners) so they are standalone-importable.
- Active planning records must resolve every canonical reference
  (hard requirement, atomic rejection, nothing silently created).
- COMPLETED/CANCELLED history follows the frozen terminal-history
  exemption: unresolvable references are preserved, never deleted and
  never fabricated.
- Import validates status/type/outcome enums, the outcome reviewer
  trail, and critical-role practitioner resolution BEFORE any
  mutation.

## Deliberate non-goals

No marketplace, no Stage 11–13 functionality, no Measurement/Indicator
entities, no scoring, no ranking, no prioritization engine, no
AI-generated interventions, no graph mutation, no second
research/repair/recovery/practitioner/audit system, no geographic
RBAC, no duplicate-signature suppression, no fabricated data of any
kind.

## Files

- `src/models/capability-intervention.js` — the entity model
- `src/intervention/workflow.js` — lifecycle, amendments, outcome,
  retrieval, integrity
- `src/pages/intervention.js` — register and detail workspace
- `tests/intervention-system.test.js` — the Stage 10 suite
- `schemas/intervention.schema.json` — the Stage 1 reserved stub,
  filled in place (same precedent as `recovery-profile.schema.json`)
