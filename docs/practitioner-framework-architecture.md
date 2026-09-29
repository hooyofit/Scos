# Stage 5 — Practitioner, Apprenticeship & Capability Reproduction Framework

Architecture Decision Record for the human side of the Somali Capability
Atlas (SCOS).

> **Note on this document's filename:** the Stage 5 specification's §39
> doc filename arrived corrupted (an unfilled placeholder token), the same
> corruption seen in the Stage 4 spec. This document uses a clean,
> descriptive filename instead; content follows the §39 requirement.

## Principle

«A capability survives when knowledge can reproduce itself across people
and generations.»

The Atlas must eventually answer: Who knows how to do this? Who can
demonstrate it? Who can teach it? Who is learning it? What evidence
supports their competence? Is the capability concentrated in one person?
Can this capability reproduce itself?

The objective is **not** to rank people. It is to understand and
strengthen capability continuity.

## Concepts kept distinct (never collapsed)

| Concept | Where it lives |
|---|---|
| Practitioner identity | `practitioners` record (privacy-structural) |
| Documentation/participation status | `verification_status` (10 states, controlled transitions) |
| Demonstrated competence (level) | `competence_level` L0-L5 |
| Assessment outcome | `competence_status` (assessment_results) |
| Teaching ability | `can_teach` + `trainer_readiness` (separate question) |
| Learning pathway | `apprenticeships` record |
| Formal competence decision | `capability_certifications` record |

Listing a practitioner is **never** automatic verification. Nobody becomes
"Verified" because they appear in the directory.

## Models

- **Practitioner** (extended, Stage 1 origin): capability/region/community
  references, knowledge holder type (individual/household/workshop/
  cooperative/community/institution — not all knowledge is
  individual-person knowledge), experience as *context*, verification
  pathways as a distinct-recorded list, trainer readiness, succession
  (access-controlled), version + provenance. No precise address, no phone,
  no sensitive personal data.
- **Apprentice** (extended): capability + mentors, L-scale levels, passport
  inputs, anonymous mode.
- **Apprenticeship**: mentor ↔ apprentice ↔ capability (optionally under a
  program). Configurable milestones copied per program — **no universal
  checklist**. Interruption reasons recorded, never judged:
  discontinuation is not automatically failure.
- **CompetenceAssessment**: assessor + criteria + evidence links +
  demonstrations + practical hours + observed tasks + result + L-level.
  Starts `PENDING`; only an `ACCEPTED` (reviewed) assessment can be applied
  to a person's demonstrated level — intentionally, never automatically.
  History is never silently rewritten.
- **TrainingProgram**: Draft → Approved (regional/national admin, reason
  required) → Active → Paused → Retired. Can exist without a formal school.
- **CapabilityCertification**: always grounded in an ACCEPTED assessment
  (attendance is not certification), issued by a separate authority, fully
  audited.
- **Organization**: one shared registry (workshop/training center/
  cooperative/university/NGO/business/government/community organization).
  No duplicate organization databases.

## Status & competence scales

- Practitioner status: Candidate → Documented → Community Confirmed →
  Demonstrated → Assessed → Verified (+ Inactive/Retired/Deceased/
  Withdrawn). Controlled transition map; Verified needs the
  `practitioner.verify` authority and a documented reason.
- Competence levels L0 Unknown … L5 Trainer/Master Practitioner: describe
  *demonstrated* competence within the Atlas framework. Never assigned
  automatically; never social rankings.

## Assessment principle

Competence is based on **evidence of capability**. Never used as proof:
followers, age, reputation alone, years alive, social status, wealth,
title, attendance. `experience_years` is recorded as context only.

A person can remain Documented / Not Yet Assessed without being falsely
downgraded — no informal listing requires a formal assessment.

## Verification pathways (§16)

Self-reported, community referred, practitioner demonstrated, assessor
verified, institution verified, evidence supported. Recorded as **distinct
entries**, never collapsed into one "trusted" score. Assessor/institution
verification requires the `practitioner.verify` authority.

## Reproduction loop (§19)

Capability → Practitioner → Demonstrated competence → Trainer → Apprentice
→ Practice → Assessment → Competent Practitioner → New Trainer → Next
Apprentice.

The system captures the relationships (apprenticeships with
`successor_pathway`, mentor records, trainer designations) without
pretending the loop exists where no data was entered, and **without
computing any national reproduction score**. Per-capability
`reproductionProfile()` reports raw measurements (practitioner/trainer/
apprenticeship counts, organizations, geographic coverage, last verified);
**Unknown (null), not zero**, where a value cannot be calculated reliably.

## Certification authority (§14)

Issue: roles holding `certification.issue` (trainer, reviewer, regional
and national administrator). Revoke/suspend: `certification.revoke`
(reviewer + administrators). Self-certification and self-assessment are
structurally rejected (effective issuer/assessor compared against the
person being certified/assessed). Every issuance, suspension and revocation
is audited with reasons.

## Evidence integration (§27, §28)

Assessments reference EvidenceSource, KnowledgeArtifact, FieldObservation
(via `observation_ids`), research sessions and field evidence — no
duplication. Field observation → competence evidence requires explicit
review (Stage 4's acceptAsEvidence + Stage 5's assessment review), and
research participants become practitioners only through the intentional,
audited `promoteFromParticipant` action.

**E-levels and L-levels are independent dimensions.** A highly competent
practitioner can exist before the Atlas holds E5 evidence; E5 evidence
never makes practitioners competent. Stage 3's evidence verification
(`requestUpgrade`) remains the only path to raise a capability's
E-level — Stage 5 code contains no such path.

## Privacy (§23, §24, §34)

- Public name, anonymous (masked at creation, private name nulled),
  organization-only or community attribution.
- `publicPractitioners()` shows only consented, public, non-anonymous
  records and never private names, notes or succession.
- Succession: designated with audit, shown only to verification authority
  or where disclosure was explicitly authorized.
- The Apprentice Passport summarizes the learner's pathway offline,
  exports as portable JSON, and never exposes private information.
- Contact visibility is a controlled enum; no private contact details
  appear in public pages.

## Medical safety (§29)

For S01-S20: practitioner listing ≠ medical endorsement; competence ≠
clinical safety; historical practice ≠ clinical validation; certification
≠ medical authorization. Assessments and certifications for family-S
capabilities require safety notes, state that certification is not medical
authorization, and contain no treatment instructions. The capability
inventory's E0/Unverified state is untouched.

«Preserve the knowledge. Validate the treatment. Protect the patient.»

## RBAC (§30)

New permissions: `practitioner.read/create/edit/verify`,
`apprentice.read/create/edit`, `apprenticeship.manage`,
`training.read/create/edit/approve`, `assessment.create`,
`assessment.review`, `certification.issue/revoke`, `reproduction.read`.

Least privilege: a researcher can document practitioners but cannot
assess, verify or certify anyone; assessors cannot review their own
assessments' acceptance (separate `assessment.review` authority); the
practitioner/apprentice roles cannot certify anyone; approval of training
programs is a separate authority (`training.approve`, administrators
only, reason required). `training.approve` is an addition beyond the
spec's suggested list — required by the program lifecycle.

## Offline-first (§25, §40, §41, §42)

Everything works through `SCA.store` (localStorage confined to the storage
adapter; no direct application-level access). A field researcher can
register practitioners, apprentices, apprenticeships, assessments,
certification candidates and evidence references offline and export them
later. No network service, no external API, no cloud-only profile, no
mapping dependency, no AI service. No large frameworks — the system stays
usable on modest Android devices.

## Import / export (§33)

The new collections join the atomic transfer system: full-bundle
round trips preserve stable IDs, relationships, versions, assessment and
certification history, privacy settings and audit records. Broken
relationships cause total rejection with zero mutations (verified in the
Stage 5 suite).

## Test integrity (§36, §38)

All test people/institutions are explicitly marked TEST FIXTURE; no real
practitioners, apprentices or institutions are fabricated. The suite
wipes every fixture and re-seeds the pristine 240-capability baseline at
the end. No existing test was weakened. Two corrections were made to
*fresh Stage 5 code* during development (assessment application to
apprentices; certification status follow-through) — no Stage 1-4 test
required any change.

## Stage 4 defect found and fixed during Stage 5

While wiring Stage 5, inspection showed that **Stage 4's browser wiring
was incomplete**: `index.html` and `service-worker.js` never received the
Stage 4 script includes (research models, research workflow,
field-research page), and the SW cache name was still at Step 3. The test
suite passed because tests load sources via `tests/helpers.js`, not via
`index.html` — the browser app would have broken on the Stage 4 pages.
Stage 5 now wires every source file into `index.html` (69 scripts, all
present) and the service worker shell (75 entries), verified
programmatically. This is reported per the test-integrity rules.

## Not implemented (deliberately, §43)

No national practitioner census, no practitioner/capability rankings, no
reputation scores, no economic marketplace, no dependency graph, no
predictive analytics, no AI competence assessment, no automatic
certification, no national synchronization backend, no mass practitioner
research. The production database remains 240 capabilities with no real
practitioner data until deliberately entered later.
