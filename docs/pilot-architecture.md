# Regional Capability Pilots — Stage 11 Architecture

Stage 11 adds exactly one operational layer: the **PilotProject**, a
regional coordination umbrella. It organizes existing
capability-strengthening activities — Stage 10 interventions, Stage 5
organizations / training programs / practitioners, Stage 8 workshops —
under one documented regional effort with a lifecycle of its own.

## The coordination boundary (frozen scope v1.1)

A pilot **coordinates; it never re-governs.** This is the Stage 11
equivalent of the Stage 6 dimension-separation rule and it is
structural, not stylistic:

- A pilot record holds **no outcome field of any kind**. The
  `SCA.pilots.overview()` read shows categorical **counts** of the
  constituent interventions' own Stage 10 outcome statuses, with
  explicit count bases. Never a rate, percentage, score, ranking or
  weighted average. A pilot with no constituent interventions shows
  "Not applicable" — never UNKNOWN, because there is no intervention
  population to evaluate; outcome semantics stay owned by Stage 10.
- Concluding a pilot records only that the **coordination activity
  ended**. It never implies success, and conclusion is governed as an
  administrative lifecycle transition (reason required, audited).
- Constituent membership is many-to-many and **transfers no
  authority**: adding or removing an intervention on a pilot never
  modifies the intervention. Stage 10 keeps full lifecycle and outcome
  authority; competence stays with Stage 5; the census methodology
  stays with Stage 6.
- A pilot is **NOT a graph node**: it never writes to the Stage 7
  graph, and the 19-type registry is untouched.

## Regional scope without a Region entity

Regional scope is expressed **only** through canonical Stage 1
`Location` references (`location_ids`). There is no Region entity, no
free-floating regional identity and no invented coordinates — the
displayed regional label derives from and is validated against the
canonical Location records. Consequently there is also **no geographic
RBAC**: the existing flat permission family is used as-is, and the
application never claims a user can act on a pilot "because it is in
their region."

## Baseline reference

`census_snapshot_id` optionally references an **immutable Stage 6
census snapshot**. This is a dated historical "began against" reference:
versioned in the UI, never recalculated, never regenerated, and never
presented as a current measurement.

## Lifecycle (frozen transition table)

```
PROPOSED -> APPROVED -> ACTIVE -> CONCLUDED
PROPOSED / APPROVED / ACTIVE -> CANCELLED
CONCLUDED, CANCELLED: terminal, immutable, no resurrection, no RETIRED state
```

| Transition | Gate | Authority |
| --- | --- | --- |
| PROPOSED → APPROVED | name + objective; **creator/approver separation at every role level, including NATIONAL** | `pilot.approve` (regional_administrator, national_administrator) |
| APPROVED → ACTIVE | **≥ 1 valid resolvable constituent activity** (intervention, organization, workshop or training program — standalone pilots are legitimate; practitioners/locations alone never activate; an empty APPROVED plan is legitimate plan-first) | `pilot.update` |
| ACTIVE → CONCLUDED | explicit documented reason; administrative only, never a result | `pilot.conclude` (regional_administrator, national_administrator) |
| any non-terminal → CANCELLED | explicit reason; audited; terminal | `pilot.update` |

**Mutability:** PROPOSED is fully editable (every change
history-recorded). APPROVED and ACTIVE change only through explicit,
audited **amendments** with a mandatory reason. Terminal records are
immutable historical records. No silent mutation anywhere: every edit,
amendment and transition lands in the record's history snapshots and
in `audit_log` with actor, timestamp and reason.

## Privacy and visibility

- Anonymous users see only **APPROVED, ACTIVE and CONCLUDED** pilots;
  PROPOSED planning material and CANCELLED records are staff-only.
  (No outcome information exists on a pilot at any state, so the
  public states expose coordination facts only.)
- Practitioner references follow the existing Stage 5 privacy/masking
  rules everywhere: public views show **counts, never identities**.

## RBAC (flat family, exactly five permissions)

| Permission | Holders |
| --- | --- |
| `pilot.read` | anon + all roles (public states for anon) |
| `pilot.create` | researcher, community_steward, project_manager (+ NATIONAL) |
| `pilot.update` | researcher, community_steward, project_manager (+ NATIONAL) |
| `pilot.approve` | regional_administrator, national_administrator (never the creator; project_manager never approves) |
| `pilot.conclude` | regional_administrator, national_administrator |

There is deliberately **no `pilot.export`** permission: export uses
the existing global export machinery. Reviewers read pilots but hold no
pilot lifecycle authority.

## Transfer / import semantics

- `pilot_projects` is a first-class exportable collection; its
  canonical references are carried on export.
- Import is **atomic**: a bundle whose active pilots reference missing
  records is rejected whole, changing nothing.
- **No privilege escalation through import:** a pilot whose creator
  "reviewed" it, an ACTIVE pilot with no resolvable constituents, and
  any pilot carrying a forbidden outcome/score field are all
  rejected — even in terminal history.
- **Terminal-history exemption** (the Stage 7/8 frozen pattern): a
  CONCLUDED or CANCELLED pilot may keep references that no longer
  resolve — preserved history, never silently deleted. Active pilots
  (PROPOSED/APPROVED/ACTIVE) are held to the full standard.

## Integrity

`SCA.pilots.integrity()` raises honest flags and never mutates:
invalid statuses, missing lifecycle bookkeeping (approval trails,
timestamps, cancellation reasons), unresolvable references (errors on
active records, warnings on terminal history), ACTIVE pilots whose
constituents have all vanished (flagged, never auto-concluded), and
any forbidden outcome/score field.

## What Stage 11 deliberately did NOT build

No Region, PilotOutcome, PilotParticipant, PilotMetric, PilotScore,
PilotPriority, PilotMeasurement or any other shadow entity.
Measurement/Indicator remain deferred to Stage 12 (the National
Observatory), the Marketplace stays Stage 13, and the 240-capability
inventory and all frozen Stage 1–10 behavior are byte-identical under
the full regression suite.
