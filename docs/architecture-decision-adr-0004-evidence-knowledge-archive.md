# ADR-0004: Evidence & Knowledge Archive (Stage 3)

**Status:** Accepted (Stage 3, 2026-09-28)
**Depends on:** ADR-0002 (storage abstraction), ADR-0003 (status semantics)

## Context

Stage 2 loaded 240 capability records, all at baseline (E0 / S0 / null
maturity / Unverified). Stage 3 builds the infrastructure that lets the
Atlas later hold rigorous research: sources, evidence, claims, provenance,
review, verification, consent and audit history. **Stage 3 does not research
the 240 capabilities.** It builds the system that can hold research.

## Core principle

**A claim can be preserved without being declared true.** The architecture
never collapses these into one field:

| Layer | Meaning | Where it lives |
|---|---|---|
| Claim | What somebody asserts | `claims` (claim_text + claimant) |
| Source | What a document/source records | `evidence` (EvidenceSource) |
| Artifact | What captured knowledge contains | `knowledge` (KnowledgeArtifact) |
| Interpretation | What the research team concludes | review_notes / reviewer fields |
| Verification | What has been independently verified | verification_states on evidence objects |
| Evidence level | What the Atlas's evidence criteria support | E0–E5 on capabilities |
| Unknown | What is not established | null / "Not yet documented" |

## Evidence levels (E0–E5)

- **E0 — Unknown:** no evidence entered in the Atlas yet. E0 does NOT mean
  false, nonexistent, historically absent, discontinued or unimportant.
- **E1 — Preliminary:** a lead, initial observation, unverified reference,
  archival lead, preliminary interview or unconfirmed historical reference
  exists, but is insufficient for stronger classification.
- **E2 — Community / Oral:** supported by documented community/oral
  knowledge. The source should identify context where possible: who
  provided it, community/context, approximate location, date, circumstances,
  and consent. E2 documents knowledge; it is not proof of performance.
- **E3 — Documented:** supported by a credible, traceable documented
  source (book, archive, academic publication, institutional report,
  technical document, historical record, credible field documentation).
- **E4 — Multiple Independent Streams:** supported by multiple reasonably
  independent evidence streams (e.g. oral + archival; academic +
  practitioner). Copies of the same source are NOT independent.
- **E5 — Strong Historical + Technical/Living Evidence:** substantial
  evidence across appropriate dimensions (historical documentation, living
  practitioners, demonstration, independent technical/scientific evidence,
  repeatable observation, measurements). E5 does not mean "perfectly
  proven" or "universally superior".

Evidence level is **independent** of living status, maturity, usefulness,
superiority, priority, safety and economic value. E5 + S7 can still be
technically inferior to a modern alternative for a given application;
E2 + S7 means well-documented community knowledge with unvalidated
technical performance.

## Claim / Source / Artifact distinction

- **EvidenceSource** (`evidence`): a real, traceable source. `source_type`
  is a classification, NOT a credibility rating — "Academic Publication"
  does not make a source credible; review does.
- **KnowledgeArtifact** (`knowledge`): captured knowledge (transcript,
  recording, photograph, document). An artifact preserves knowledge; it is
  not automatically validated truth.
- **Claim** (`claims`): an assertion by a claimant, attached to a
  capability, optionally citing sources and artifacts. Claims may conflict;
  conflicting claims are both preserved. A claim may have historical
  evidence but no living practitioner, or living practice with weak
  technical validation — the model allows all of it.

## Verification workflow

1. Create source (`SCA.evidence.createSource`) — provenance + audit.
2. Create claim or artifact (`createClaim` / `createArtifact`) — attached to
   a capability, provenance + audit.
3. Review (`SCA.evidence.review`) — a holder of `evidence.review` sets a
   controlled verification status. Rejected and Disputed decisions require
   a reason; the original text is never erased (history is preserved).
   Superseded requires a reference to the replacing record.
4. Evidence level (`SCA.evidence.requestUpgrade`) — a holder of
   `evidence.verify` may advance a capability **one level at a time**,
   with a documented reason and at least one cited source. Every change
   is audited (old level, new level, reason, reviewer, timestamp) and
   bumps the capability's version. There is no path from E0 to E5 in one
   decision, and no UI dropdown that silently rewrites evidence levels.

Verification states (evidence objects): Unreviewed, Under Review,
Community Documented, Source Verified, Technically Reviewed, Independently
Corroborated, Disputed, Rejected, Superseded. **Disputed does not mean
false. Rejected does not erase the historical record.** The 240 capability
records keep their frozen Stage 2 label "Unverified" — a capability-level
inventory label, distinct from this scale.

## Provenance and audit

Every evidence object records entered_by, provenance text, created_at,
updated_at and version; reviews record reviewer, review notes and version.
`SCA.audit.log` appends immutable entries (actor, action, entity, old/new
value, reason, timestamp, version) for: source/artifact/claim creation,
reviews, verification changes, evidence-level changes, supersession,
disputes and rejections. History is append-only: corrections add entries,
never overwrite them.

## Independence of evidence

Sources may declare an `independence_group`: ten copies of one article are
one stream, not ten. `countIndependentStreams()` de-duplicates by group for
review purposes. There is **no automated credibility score** — this stage
is traceability, not AI judgment.

## Regional attribution

Sources carry geographic_scope / temporal_scope; artifacts carry region_ids;
claims carry region_id/region. One source documenting one coastal community
never generalizes to "Somali traditional practice everywhere". No region is
inferred without evidence.

## Practitioner attribution and consent

Evidence may reference practitioners; no practitioners exist in the
baseline and none are fabricated. The Consent model (`consents`) records
person, purpose, coverage, media/public permission, attribution preference,
dates, expiry and withdrawal. Withdrawal preserves the audit history while
current access rules respect the withdrawal. Precise personal locations
are never exposed unnecessarily (ADR-aligned with the Stage 1 privacy
architecture).

## Medical safety (S01–S20)

Preserve the knowledge. Validate the treatment. Protect the patient.
Health-related/safety-related claims and artifacts linked to family S
**require safety notes** stating they are preserved knowledge, not
validated medical advice; the workflow refuses them otherwise. No clinical
validation is ever automatic, and this stage adds no treatment
instructions. The distinction between historical practice, community
belief, practitioner claim, clinical evidence and safety assessment is
preserved by keeping claims, sources, verification and evidence levels
separate.

## Import/export integrity

Evidence collections (`evidence`, `knowledge`, `claims`, `consents`,
`audit_log`) are exportable with provenance, relationships, IDs, versions
and verification state. Single-collection exports carry their referenced
records transitively (claims -> capabilities -> families, -> sources).
Imports remain **atomic**: every relationship is validated against the
candidate merged dataset before the single dataset replacement; broken
references are rejected with a clear dependency error and zero mutations.

## Storage and future migration

All Stage 3 records live in the same single dataset through `SCA.store`
(ADR-0002). No code touches localStorage directly; no second persistence
system exists. The storage seam remains: IndexedDB or a hosted backend can
replace the adapter without application changes.

## No-fabrication rule

Nothing in this stage invents sources, books, papers, practitioners,
interviews, locations, historical claims, measurements, evidence levels or
validation results. Test fixtures are clearly marked "TEST FIXTURE" and
wiped by the test suite; they never touch seed data.
