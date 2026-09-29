# Somali Capability Atlas

**Internal architecture name:** SCOS — Somali Capability Operating System

An evidence-based digital platform for documenting, preserving, validating, connecting, teaching and reproducing Somali capabilities.

**Philosophy:** *Modernize without forgetting.*

This build contains **Stage 1 (frozen)** through **Stage 6 (frozen)**,
**Stage 7 (Capability Dependency Graph, frozen)**, **Stage 8 / 8.1
(Repair & Spare-Part Network, frozen)**, **Stage 9 (Failure &
Recovery, frozen)**, **Stage 10 (Capability Intervention
Foundation, frozen)**, **Stage 11 (Regional Capability
Pilots, frozen)** and **Stage 12 (Capability Observatory &
Measurement)**: PWA structure, component
architecture, database schema, data models, authentication abstraction, roles
and permissions, offline data layer, JSON import/export, separated
configuration, the 12 capability families (W L A P F C H M R S T G),
exactly 240 inventory records — 20 per family — all E0 / Unverified, plus
the field research workflow and the human side of capability: practitioners
with distinct verification pathways, L0-L5 demonstrated competence
assessments, apprenticeships with configurable milestones, training
programs, competence-based certification, trainer development, succession
planning and the capability reproduction loop. See
docs/practitioner-framework-architecture.md.

**Stage 11** adds the regional coordination layer: PilotProject — a
regional umbrella that coordinates existing Stage 10 interventions,
Stage 5 organizations / training programs / practitioners and Stage 8
workshops through a PROPOSED → APPROVED → ACTIVE → CONCLUDED
lifecycle (with audited terminal cancellation). A pilot coordinates;
it never re-governs: it carries no outcome field of any kind — the
read-only overview shows categorical counts of its constituent
interventions' Stage 10 outcome statuses with explicit count bases,
and a pilot with no interventions shows "Not applicable", never
UNKNOWN. Approval enforces creator/approver separation at every role
level (including NATIONAL); activation requires at least one valid
resolvable constituent activity (standalone pilots are legitimate);
regional scope is expressed only through canonical Location
references (no Region entity, no geographic RBAC); and the optional
census baseline references an immutable Stage 6 snapshot. See
docs/pilot-architecture.md.

**Stage 12** adds the observatory layer: **Measurement** (an
accepted observation of the world with an explicit Stage 6 count
basis — OBSERVED / ESTIMATED / REPORTED / UNKNOWN; unknown is never
zero, an estimate always documents its method, every record carries
an observation scope) and **Indicator** (a versioned analytical
definition computed dynamically from accepted measurements —
read-only, deterministic, version-pinned, persisting nothing; no
stored values, no scores, no rankings, and a missing input is an
honest "not yet measured", never zero or LOW). Lifecycle is
DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED with locked review
states, immutable terminals, retire-first corrections with
byte-exact history, and creator/reviewer separation enforced at the
service layer for every role including NATIONAL. The Observatory
composes nine read-only views including the Balance Sheet, whose
verdict is always "None — the balance sheet does not judge". Import
is atomic and authority-honest: it can never manufacture an
acceptance. See docs/measurement-architecture.md.

**Stage 13** adds the Capability Marketplace: a discovery and
connection layer recording that a capability service can be
PROVIDED (OFFER) or is NEEDED (NEED) across twelve frozen service
kinds (repair, maintenance, training, apprenticeship hosting,
technical assistance, fabrication, local production, agricultural,
fisheries, water, environmental knowledge, research/field
services). One entity, **MarketplaceListing**, references — and
never duplicates or re-governs — existing authoritative records:
the provider is a polymorphic reference to an existing
practitioner, organization, workshop or training program; locations
are canonical Stage 1 references; capability links may be zero
("not yet documented" is honest). Lifecycle is
DRAFT → SUBMITTED → PUBLISHED with PUBLISHED ⇄ PAUSED and terminal
REJECTED / WITHDRAWN; a creator can never publish their own listing
(separation enforced at the service layer for every role including
NATIONAL). Privacy is structural: a listing carries no contact,
pricing, booking, rating or ranking field of any kind — connection
happens through the provider's own stage-defined public profile. A
provider that later retires renders the honest notice "Referenced
provider no longer available" and the lifecycle is never
auto-mutated; a human pauses or withdraws the listing. Matching is
a derived read-only view pairing published OFFERs with published
NEEDs on shared capability, service kind or location, always
displaying its basis and creating no records. Import is atomic and
authority-honest: it can never manufacture a publication. See
docs/marketplace-architecture.md.

**Stage 6** adds the measurement layer: a methodology → census →
observation → review → snapshot lifecycle; every count carried as a
`{ value, basis }` pair (OBSERVED / ESTIMATED / REPORTED / UNKNOWN) so a
number is never silently confused with a guess; estimates rejected unless
the approved methodology documents an estimation method; unknown-aware
views (coverage, matrix, gaps, regional profile, map layer, national
overview) where **Unknown is information** and "not surveyed" never means
"absent"; small-count privacy (Restricted) for public viewers; immutable
published snapshots with geographic redundancy rows that carry raw counts
and no scores; practitioner deduplication via explicit reviewer flag +
merge; and a Build/Runtime Integrity suite proving the shipped app boots,
every route renders, and the service-worker precache is complete. See
docs/capability-census-architecture.md.

**There is no fake data in this project.** Unknown fields display
**"Not yet documented"** rather than fabricated information. The 240 records
are INVENTORY records: a record means a capability has been identified as a
research subject — not that it is verified, was universally practiced, is
currently practiced, or should be revived. No sources, practitioners, regions
or rankings are attached without verified evidence.

**Stage 3** adds the evidence infrastructure: EvidenceSource, KnowledgeArtifact,
Claim, Consent and AuditLog models; a controlled verification workflow
(Unreviewed -> ... -> Superseded); one-step-at-a-time evidence-level upgrades
requiring a reviewer, a reason and cited sources; independence groups; regional
attribution; consent records; append-only audit history; an Evidence Archive
and Knowledge Archive UI; and atomic import/export for all evidence
collections. See docs/architecture-decision-adr-0004-evidence-knowledge-archive.md.
The core principle throughout: **a claim can be preserved without being
declared true.**

**Stage 4** adds the field research machine: ResearchProject, ResearchSession,
FieldObservation, FieldNote, ResearchParticipant, FieldMedia and an honest
offline collection queue; a controlled Draft -> Submitted -> Under Review ->
Accepted/Rejected lifecycle; consent-integrated participants; location
privacy (precise coordinates never required); conflict flagging and
resolution; review-gated evidence submission into the Stage 3 archive
(field captures capped at E2; capability evidence levels still change only
through the Stage 3 controlled upgrade); exportable/importable research
packages with atomic merge; and a field research dashboard. See
docs/field-research-architecture.md.

## Quick start (three ways)

### 1. Open directly from the filesystem (fully offline)

```
open index.html          # macOS
xdg-open index.html      # Linux
```

or double-click `index.html`. The app runs entirely from local files with no server and no network. Data is stored in the browser's localStorage.

Note: PWA install and the service worker require http(s), see below.

### 2. Serve locally (enables service worker + PWA install)

```
python3 -m http.server 8080
# then open http://localhost:8080
```

### 3. Deploy to any static host

See [docs/deployment-guides.md](docs/deployment-guides.md). Guides included for Cloudflare Pages, Netlify, GitHub Pages, and self-hosting (nginx or plain Python), plus offline distribution.

## Structure

```
somali-capability-atlas/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── README.md
├── config/          app.config.js — all configuration
├── data/            families.js (12 families), capabilities-mock-structure.json
├── schemas/         canonical JSON Schemas for every entity
├── docs/            architecture, data model, deployment, roadmap, portability, ADR
├── icons/           icon.svg
├── styles/          main.css
├── src/
│   ├── sca.js       namespace, version, shared utilities
│   ├── i18n.js      bilingual framework (English now; Somali later)
│   ├── app.js       entry point
│   ├── components/  ui.js, navbar.js, footer.js
│   ├── pages/       home, capability atlas, knowledge, people, map, training, census, graph, repair, export, auth pages
│   ├── router/      hash-based router (works on file://)
│   ├── state/       pub/sub state
│   ├── auth/        interface.js (contract) + local.js (provider)
│   ├── rbac/        roles.js + permissions.js
│   ├── data-layer/  storage.js, adapter.js, transfer.js, migration.js
│   ├── models/      one model per entity + shared validation
│   ├── training/    practitioner / apprentice / assessment workflow
│   ├── census/      census workflow
│   ├── graph/       relationship workflow (19-type vocabulary)
│   └── repair/      repair & spare-part workflow (Stage 8)
└── tests/           validation, migration, rbac, export-import, evidence,
                     field-research, practitioner, census, graph,
                     repair-network and build/runtime-integrity suites
```

## Storage architecture (Stage 1.1 rule)

`UI → SCA.store → storage adapter → localStorage today / IndexedDB later /
hosted backend eventually.` SCA.store is the only application-level data
interface; pages and models never touch localStorage. Enforced by an
automated test. See
[docs/architecture-decision-adr-0002-storage-abstraction.md](docs/architecture-decision-adr-0002-storage-abstraction.md).

## Import integrity (Stage 2.1)

Imports are atomic: structure, schema version, migrations and referential
integrity are all checked before a single dataset replacement, so a failed
import changes nothing. A capabilities-only export carries the referenced
capability families with it automatically, so it can be imported standalone;
an old-style capabilities file without them is rejected with a clear
dependency error rather than creating a partially valid dataset.
Status semantics (S0–S7 vs E0–E5 vs maturity) are documented in
[docs/architecture-decision-adr-0003-status-semantics.md](docs/architecture-decision-adr-0003-status-semantics.md).

## Data export (Day-1 feature)

Sign in with a role that has the `data.export` permission, then open **Export**. Every collection can be downloaded as plain JSON, plus a full versioned bundle:

```
capabilities.json, families.json, practitioners.json,
evidence.json, locations.json, apprentices.json, knowledge.json
```

User accounts are **never** part of an export. Import requires the `data.import` permission and replaces the imported collections while preserving accounts.

## Tests

```
node tests/run-all.js
```

Runs with no dependencies: syntax check of every JS file, then 14 suites —
validation, migration, RBAC, export/import, evidence, knowledge, field
research, practitioner/apprenticeship, census, the capability
dependency graph, the repair & spare-part network, and the
build/runtime integrity suite that boots the shipped app in a DOM
sandbox.
Current state: 10,574 checks, 0 failures.

## Honest limitations of this build

These are documented in [docs/architecture-decision-adr-0001-portable-offline-first.md](docs/architecture-decision-adr-0001-portable-offline-first.md):

- Accounts are local to this browser/device. Step 1 auth is a demo-grade local provider behind a real abstraction; a hosted provider arrives in a later step.
- Password reset tokens are shown locally (no email service exists yet).
- The service worker and PWA install require http(s); from `file://` the app still works, just without precache/install.
- localStorage persistence on `file://` varies by browser; for reliable offline use, deploy to a static host or run the served version.
- The Capability Marketplace (Stage 13) is a DISCOVERY AND CONNECTION layer only: it records that a capability service can be provided (OFFER) or is needed (NEED). It deliberately contains no pricing, messaging, booking, delivery, ratings or rankings. See [docs/marketplace-architecture.md](docs/marketplace-architecture.md).
- The National Capability Reserve (Stage 14) documents the conditions for continuity — people, knowledge, tools, materials, institutions and fallback pathways — and never declares resilience. No scores, rankings, battery percentages or predicted outcomes exist anywhere. See [docs/reserve-architecture.md](docs/reserve-architecture.md).
- The Scenario Analysis foundation (Stage 15) documents what is connected and what pathways exist under a defined disruption. It is a pure derived read layer: no new records, no prediction, no likelihood or impact scores — it never declares what WILL happen, only what is documented. Results are transient and recomputed from the local dataset. See [docs/scenario-architecture.md](docs/scenario-architecture.md).
- Cross-device offline sync is deliberately not built yet. See [docs/roadmap-13-stages.md](docs/roadmap-13-stages.md).

## Roles

Public User, Researcher, Community Steward, Practitioner, Apprentice, Technician, Workshop, Trainer, Reviewer, Project Manager, Regional Administrator, National Administrator. See the About page in the app for descriptions and [docs/capability-data-model.md](docs/capability-data-model.md) for the permission design.
