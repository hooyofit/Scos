# Stage 13: Capability Marketplace — Architecture

*Frozen scope v1.0 + Implementation Authorization v1.0. This stage is
BUILT and awaiting inspection; Stages 1–12 are frozen.*

## What the marketplace is — and is not

The Capability Marketplace is a **discovery and connection layer**. A
marketplace listing records the documented possibility that a
capability service can be **provided (OFFER)** or is **needed (NEED)**.

It is explicitly **not** a transaction platform. It never brokers,
prices, contracts, schedules, messages, delivers, rates or ranks. A
published listing is a reviewed marketplace assertion — never a
guarantee of service quality.

## One entity: MarketplaceListing

Exactly one Stage 13 domain entity exists. There is no
MarketplaceProvider, MarketplaceMatch, MarketplaceAvailability,
MarketplaceRating, MarketplaceReview, MarketplaceRequest,
MarketplaceOffer, MarketplaceScore, MatchScore, ProviderScore,
ListingScore, TrustLevel, VerificationScore, ProviderRanking,
ListingRanking, PopularityCount, ResponseCount or any renamed
equivalent — enforced by tests and the runtime ghost scan.

`MarketplaceListing` supersedes the Stage 1 `MarketplaceService` stub
in place (the stub file was removed, not left as a tombstone).

## References to existing records (never duplicates)

A listing **references** authoritative records; it never re-governs
them:

- **Provider** — a polymorphic reference (`provider_type` +
  `provider_id`) to an EXISTING frozen record: practitioner,
  organization, workshop or training program. Stage 13 never
  manufactures provider identity or provider competence. At
  **publication** the provider must resolve to a publicly visible
  record under its OWN stage's rules (an active-set workshop, an
  APPROVED/ACTIVE training program, a consented practitioner or
  organization).
- **Capabilities** — canonical Stage 1 references. Zero links is
  honest ("Not yet documented"), never filled with a guess.
- **Repair capability** — an optional canonical Stage 8 reference,
  meaningful only on a REPAIR listing.
- **Locations** — canonical Stage 1 references only. No Region
  entity, no radius, no distance or catchment calculation, no
  inferred locations. `SPECIFIC` scope requires at least one
  location; `ANYWHERE` is not location-bound and carries none.

## Lifecycle (frozen)

```
DRAFT ──> SUBMITTED ──> PUBLISHED ⇄ PAUSED
                        │  │
             REJECTED ◀─┘  └──> WITHDRAWN
```

- **DRAFT** — the only fully editable state; creator-only;
  offline-creatable; never public.
- **SUBMITTED** — locked, awaiting review.
- **PUBLISHED** — publicly discoverable (anonymous visitors see
  published listings only).
- **PAUSED** — reversible, audited; absent from matching and public
  discovery.
- **REJECTED / WITHDRAWN** — terminal and immutable, with mandatory
  reason, actor and timestamp. No resurrection.
- **No automatic transitions of any kind.** Declared availability is
  the only amendable field set on a published listing (an explicit,
  audited amendment); structural changes require withdraw + successor
  listing.

## Reviewer separation

A creator can never publish or reject their own listing — enforced
at the **service layer**, at every role level including
national_administrator (the Stage 11r1 precedent). UI hiding is
never the rule; the workflow guard is. The reviewer verifies
references and the absence of unsupported claims; the reviewer never
certifies service quality.

## Honest provider retirement

If a referenced provider later retires (workshop closed, program
retired, consent withdrawn), the listing is **never auto-mutated**.
It renders the honest notice "Referenced provider no longer
available", matching excludes it, and a **human** pauses or
withdraws the listing. Resuming is refused while the provider is
unavailable.

## Privacy is structural

A listing carries **no** phone, email, street address, messaging
handle or private contact field, and **no** price, currency,
booking, scheduling, contract, score, ranking, rating, trust,
popularity or demand field. This is validated on every create and
update and at import — a structural pin, not a UI convention.
Connection happens through the referenced provider's own
stage-defined visibility rules (practitioners render through their
Stage 5 masking profile).

**On-behalf-of**: a creator listing another actor's practitioner
record must record an explicit reason; the creation is explicitly
audited. Community-authored listings are never fabricated.

## Matching: derived, read-only

Matching pairs published OFFERs with published NEEDs sharing at
least one capability, the same service kind, or at least one
location. The basis of every pair is displayed. It is deterministic
and reproducible, creates no records, sends no notifications,
implies no commitments, and produces no scores. Presentation
ordering (recency, then stable id) is documented and never implies
quality, trust, popularity or recommendation.

## RBAC: five flat permissions

`marketplace.read` (all roles + anonymous), `marketplace.create`,
`marketplace.update`, `marketplace.withdraw` (creator-side roles),
`marketplace.review` (reviewer, regional_administrator and
national_administrator — the latter explicitly declared). There is
deliberately **no** `marketplace.export` (listings move only inside
the atomic full transfer package) and **no** `marketplace.delete**
(nothing is ever hard-deleted; terminal listings are immutable).
No geographic permission engine of any kind exists.

## Boundaries to other stages

- **Graph**: MarketplaceListing is not a graph node; the 19 frozen
  relationship types stay 19; no marketplace operation writes edges.
- **Observatory (12)**: no marketplace measurements, no indicator
  changes, no stored values.
- **Pilots/Interventions (10/11)**: no references, no writes, no
  lifecycle coupling in v1.0.
- **Stage 6 census**: untouched; the 240/12 inventory is preserved.

## Transfer

The listing collection ships in the atomic full export. Import
validates: resolvable provider and hard references for active
records (terminal history keeps broken references by the frozen
terminal-history exemption), structural pins for every record, and
**manufacturing authority** — an import can never manufacture a
PUBLISHED listing without a distinct reviewer and a review
timestamp, nor a WITHDRAWN listing without reason/actor/timestamp.
A rejected import mutates nothing (atomic, zero partial records).

D1 targeted correction (import gate): a terminal listing
(REJECTED/WITHDRAWN) is immutable with respect to lifecycle status —
a bundle may re-import it unchanged but may never resurrect it into
any non-terminal status. A PUBLISHED import must additionally carry
a documented `review_reason` and a reviewer who resolves to a real
account holding `marketplace.review` authority (reviewer,
regional_administrator, national_administrator) on the importing
deployment's own roster: user accounts never travel in a bundle
(frozen privacy pin), so a reviewer string alone is not publication
authority.

D2 targeted correction (import/lifecycle provenance): PAUSED is
definitionally a post-publication state — the only legitimate path
into PAUSED is PUBLISHED → PAUSED — so an imported PAUSED record
must carry the SAME publication provenance foundation as a PUBLISHED
import (resolving reviewer with `marketplace.review` authority,
creator/reviewer separation, documented review reason, review
timestamp), plus pause provenance: `paused_by`, `paused_at` and a
documented `pause_reason`, where `paused_by` must be the listing's
creator and must resolve to a real local-roster account with
`marketplace.update` authority (the frozen pause workflow is
creator-only and audited). A local DRAFT or SUBMITTED record can
never be moved into PAUSED by an import (no manufactured lifecycle
history), and a WITHDRAWN import's publication provenance is
verified the same way, with `withdrawn_by` additionally required to
be the creator resolving to a real account with
`marketplace.withdraw` authority. `resumeListing` verifies the
same publication provenance before PAUSED → PUBLISHED (defense in
depth): a hand-edited store record whose status says PAUSED but
whose provenance is missing, undocumented, forged or self-reviewed
can never reach PUBLISHED. No new permissions, states, entities or
import exceptions were introduced; every rejection is atomic.

## Test coverage

`tests/marketplace-system.test.js` — D1/D2 transfer-gate regression (incl. terminal resurrection, reviewer/actor authority, PAUSED provenance, resume defense in depth) plus 24 sections of:
entity/ghost discipline, vocabularies, structural privacy, provider
and canonical references, geography, lifecycle, separation incl.
NATIONAL, publication gate, honest retirement, amendments,
pause/resume, matching, ordering, RBAC, graph/observatory/pilot
boundaries, audit coverage, anonymous visibility, offline DRAFT,
atomic transfer, import authority, clean install, inventory
preservation. `tests/build-runtime-integrity.test.js` gains Stage 13
runtime proofs in the shipped shell.
