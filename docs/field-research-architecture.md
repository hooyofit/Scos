# Field Research & Evidence Collection Architecture (Stage 4)

**Status:** Accepted (Stage 4, 2026-09-28)
**Depends on:** ADR-0002 (storage abstraction), ADR-0003 (status semantics), ADR-0004 (evidence archive)

> Note: the build specification's suggested filename for this document
> arrived corrupted (an unfilled placeholder). This is the Stage 4
> architecture document that specification required.

## Purpose

Stage 4 builds the **field research machine** — not the research itself.
A real researcher, interviewer, community researcher or technician can
collect structured information where internet, electricity and GPS may all
be unavailable, with consent, provenance, review and audit built in. The
system is **offline-first, provenance-first, consent-aware and
audit-friendly**.

## Most important principle

A field observation is never turned directly into a verified fact. The
chain is always:

    Observation → Field Record → (submit → review) → Evidence → Review → Verification

And these stay distinguishable at all times:

- "A practitioner told us X" — interview / knowledge capture
- "We observed X" — field observation
- "A published source documents X" — evidence source
- "X has been technically validated" — Stage 3 verification / controlled upgrade

## Models

| Model | Collection | Purpose |
|---|---|---|
| ResearchProject | research_projects | Approved container for fieldwork; carries a plain-structured research protocol |
| ResearchSession | research_sessions | One field visit; location privacy below |
| FieldObservation | observations | What the researcher personally observed |
| KnowledgeCapture | knowledge (extends Stage 3 KnowledgeArtifact) | Interviews etc.; original wording preserved, translation separate |
| FieldNote | field_notes | Lightweight preliminary impressions; never auto-evidence |
| ResearchParticipant | participants | Privacy-aware participant registry (distinct from Practitioner) |
| FieldMedia | field_media | Media METADATA (no cloud media system) |
| Consent | consents (Stage 3, reused) | One consent system, not two |
| ResearchQueue | research_queue | Honest offline collection queue |

## Field record lifecycle

Draft → Submitted → Under Review → (Needs Clarification → Submitted) →
Accepted as Evidence | Rejected → Archived.

- Submission requires `research.submit`; every transition is audited and versioned.
- Rejection requires a documented reason; **rejected never means erased** —
  the record and its reason are both preserved.
- Acceptance as evidence (`SCA.research.acceptAsEvidence`) is review-gated
  (`research.review`) and only possible from Under Review.

## Observation vs claim

The application never generates a claim from an observation. "The
practitioner demonstrated construction using locally available fibre"
(observation) does not become "this method produces a structure that
survives seasonal winds" (claim) unless a reviewer explicitly writes that
claim. `acceptAsEvidence` creates a KnowledgeArtifact + EvidenceSource
automatically, but a Claim only when the reviewer provides explicit
`claim_text` — recorded as the reviewer's proposition, not the observation.

## Evidence level protection

Field collection can produce at most **E1/E2** (preliminary, community/oral).
Field captures claiming E3+ are refused. Acceptance into the archive writes
E2 evidence objects — and **never touches the capability's evidence level**:
capability E-levels change only through the Stage 3 controlled upgrade
(`SCA.evidence.requestUpgrade`: one level per review, `evidence.verify`
role, reason + cited sources + audit). Field researchers hold no
verification authority.

## Offline-first collection

Everything runs through `SCA.store` (ADR-0002): a single local dataset,
no network calls anywhere in the collection workflow. A researcher can
create sessions, participants, consents, observations, captures, notes and
media metadata with the device fully offline — the storage layer has no
network dependency. The PWA shell (service worker) caches the application
itself.

## The collection queue

Every locally created/changed field record gets a `research_queue` entry:
entity_type, local_id, operation, dependency_ids, retry_count, last_error,
and an honest `sync_status`: Local Only → Ready for Export (on submit) →
Exported / Imported → Synchronized, plus Conflict and Failed. A record
stored locally is **Local Only** — the system never pretends it is
synchronized. Failures record retry counts and errors.

## Research packages

`SCA.research.exportPackage(projectId)` produces a portable research
package: the project, its sessions, participants, consents, observations,
field notes, media metadata, field-created knowledge artifacts and claims,
the queue state, plus the **capability and family references** needed to
work offline. `importPackage` performs an **atomic merge** (upsert):
structure and every relationship are validated first against
(store + package); broken references cause total rejection with zero
mutations. On id collisions with divergent content: **detect → preserve
both → flag Conflict → human review**. The existing record is never
overwritten; the incoming copy is parked in the queue with the full
incoming record for a reviewer. No automatic resolution.

## Location privacy

Precise coordinates are never required. `location_precision` declares the
level: exact / approximate / locality only / district only / region only /
undisclosed. UNDISCLOSED strips coordinates and locality — they are
deleted, not guessed. Context (community, ecological environment,
settlement context, season) is recorded only when known; unknown stays
null. One source documenting one locality never generalizes to "Somali
traditional practice everywhere".

## Participant privacy and consent

Participants may be anonymous: the internal `participant_code` identifies
them; `public_name` is masked and never contains identifying data. Private
contact details are not stored on participant records. Consent reuses the
Stage 3 Consent model with explicit scope (interview, photography, video,
audio, publication, attribution, research/educational/commercial use).
Withdrawal is documented, restricts affected media (access downgraded to
RESTRICTED) and **preserves provenance and audit history** — nothing is
silently deleted.

## Access levels and sensitive knowledge

Field records use research access levels: Public / Research Team /
Reviewer Only / Restricted / Confidential — default **Research Team**.
Sensitive-knowledge marking (public / restricted / confidential) supports
cultural restrictions, community ownership and commercial or
environmental sensitivity. Captured knowledge is never automatically
published; the public views include only records explicitly marked PUBLIC.

## Media

FieldMedia is metadata (type, filename, local reference, checksum, captured
date, language, consent, access level, sensitivity, uploaded status).
A media file existing is never an assumption that it is shareable: default
access is Research Team, explicit consent is expected, and consent
withdrawal restricts the record.

## Conflict handling

Multiple observations for one capability remain separate records — never
merged into an artificial master observation. Contradictory records are
both preserved. `flagConflict` marks the records (conflict_status,
conflict_refs, conflict_notes, resolution Unreviewed); `resolveConflict`
(reviewer-only, notes required) sets a resolution state: Unreviewed, Under
Investigation, Contextual Difference, Corroborated, Unresolved, Resolved,
Rejected. A conflict stays visible until properly resolved. No automatic
choice, no automatic deletion.

## Medical field research (S01–S20)

Preserve the knowledge. Validate the treatment. Protect the patient.
S-family observations and captures require safety notes at creation and at
evidence acceptance; no treatment instructions are generated; accepted
health-related evidence is E2 documentation with safety metadata — never
clinical validation or a recommendation.

## RBAC

research.read (signed-in roles), research.create/edit/submit (researcher,
community steward, reviewer, project manager, admins), research.review
(reviewer, admins), research.approve (regional + national admin),
research.export, participant.manage, consent.manage, media.manage.
Verification authority stays with Stage 3 (`evidence.review` /
`evidence.verify`) — collecting evidence never grants the power to verify
it. Reviewers received `knowledge.create` so they can create archive
artifacts when accepting field records.

## No automatic AI research

No automatic web research, no AI-generated claims/evidence/practitioner
profiles, no automatic evidence grading or verification decisions. Human
researchers and reviewers remain responsible for every evidence decision.

## Stage 4 storage corrections (report-worthy)

1. **Deterministic seed ids**: family/capability ids are now `fam-<code>` /
   `cap-<code>` instead of random UUIDs. Codes are permanent identifiers,
   so a fresh install generates identical ids — exports and research
   packages resolve references across devices. Record codes, names and
   families are unchanged.
2. **insert() preserves provided updated_at**: imported records keep their
   provenance timestamps instead of being stamped "now".
3. **Model registration aliases**: models are now registered by collection
   name as well as model name, so store-level validation actually runs for
   claims, consents and all Stage 4 collections.
4. **One stale test corrected** (tests/import-integrity.test.js): with
   deterministic ids a re-seeded store resolves exported family ids, so the
   old-format-fixture now points at a genuinely missing family. Original
   behavioral intent (unresolvable references → atomic rejection) preserved
   and still exercised.

## Future synchronization

The queue, stable ids, versions, timestamps and conflict-parking are the
preparation for a later multi-device synchronization engine. Stage 4
deliberately does not build that engine.
