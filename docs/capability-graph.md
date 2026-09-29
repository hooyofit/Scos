# Capability Dependency Graph & Systems Relationships Foundation (Stage 7)

**Status:** Accepted (Stage 7, 2026-09-28)
**Depends on:** ADR-0002 (storage abstraction), ADR-0003 (status semantics), ADR-0004 (evidence archive), the Stage 3 evidence archive and Stage 6 build/runtime integrity suite

## Purpose

Stage 7 builds the **relationship layer** of the Atlas: a first-class,
inspected, privacy-aware dependency graph that connects capabilities to
everything that sustains them — the workshops that repair them, the
materials and tools they require, the energy they consume, the
institutions they depend on, the practitioners who teach them, the
fallback systems that substitute when they fail, and the failure
scenarios that break them.

Every relationship is a **documented claim with provenance, a status
and a history** — never a silent link. The graph records what is
*known* about how capabilities hang together as systems, so that later
stages (repair network, failure & recovery) attach to a foundation
instead of inventing their own private relationship stores.

## Most important principle

**A relationship is a claim, not a fact.** The chain is:

    Proposed edge → (provenance attached) → Documented → (review) → Verified

- Any researcher can record (propose) a relationship; only a reviewer
  can mark it DOCUMENTED or VERIFIED; only an administrator can retire
  a broken edge, and retirement is a recorded rejection — never a
  silent deletion.
- An edge with no provenance can be recorded but **cannot advance** to
  DOCUMENTED. Verification additionally requires an explicit reviewer
  reason. No self-verification, no automatic verification.
- "No relationship documented does not mean independence. Everything
  not represented in the graph is **Unknown**." The graph UI says this
  on every view.

## The relationship vocabulary

19 relationship types across 10 categories, all controlled vocabulary
(no free text in enums):

| Category | Types |
| --- | --- |
| dependency | `DEPENDS_ON`, `REQUIRES`, `USES_RESOURCE`, `USES_ENERGY`, `REQUIRES_INSTITUTION` |
| support | `SUPPORTS`, `ENABLES` |
| maintenance | `MAINTAINS`, `REPAIRS` |
| training | `TEACHES` |
| production | `PRODUCES` |
| fallback | `FALLS_BACK_TO` |
| failure | `FAILS_UNDER`, `RECOVERED_BY` |
| modernization | `MODERNIZED_BY` |
| reproduction | `REPRODUCES` |
| location / evidence | `LOCATED_IN`, `EVIDENCED_BY`, `DOCUMENTED_IN` |

Each type declares its **allowed source and target node types** (14
node types: capability, practitioner, apprentice, organization,
workshop, location, resource, material, tool, energy source, training
program, knowledge artifact, evidence source, failure scenario).
An edge outside the allowed matrix is rejected at creation and at
import — the vocabulary cannot be bent by data.

`DEPENDENCY_TYPES` (the five dependency types) drive every "what does
this need / who needs this" inspection. A caller-supplied type filter
**intersects** with it and can never override it.

## Lifecycle, supersession and history

- Statuses: `PROPOSED → DOCUMENTED → VERIFIED`, plus `REJECTED` and
  `SUPERSEDED` as retired states. Every transition is permission-checked
  (no shortcuts) and appends an immutable snapshot to the edge history.
- **VERIFIED edges are never edited in place.** A correction creates a
  replacement edge (which starts over at PROPOSED) and marks the old
  edge SUPERSEDED with a required reason. The verified record, its
  provenance and its audit trail survive untouched — modernize without
  forgetting.
- Retirement (REJECTED by an administrator) is the only path for an
  orphaned or broken edge, always with a recorded reason. Retired
  edges are **preserved history**: excluded from every traversal and
  from canonical duplicate detection, but never deleted, and their
  known-broken references are exempt from import resolution (see
  Export/import below).

## Privacy

Edges may touch person-linked nodes (practitioner, apprentice). The
privacy rules are conservative and mechanical:

- A PRACTITIONER or APPRENTICE node in an edge is only resolvable by
  a signed-in user with `graph.people`; anonymous users see the edge
  count and the relationship type, never the person.
- Edges carrying restricted location privacy are only traversable by
  users with `graph.restricted`; the same edge seen by a researcher
  omits the restricted region.
- Every traversal function (outgoing, incoming, dependencies,
  dependents, neighborhood, path, subgraph, cycles) applies the same
  filters — there is no unfiltered internal call.

## RBAC

Six new permissions: `graph.read`, `graph.create`, `graph.update`,
`graph.review`, `graph.admin`, `graph.people`, `graph.restricted`
(seven with read). Researchers create; reviewers advance; national
administrators retire and resolve; everyone authenticated may read;
anonymous users may still browse the capability graph — the person and
restricted-region details are what privacy protects, not the idea of
relationships.

## Traversal API

- `outgoing / incoming / neighbors` — one-hop, filtered by edge
  status, relationship type, node type and privacy.
- `dependencies / dependents` — the "needs / needed by" views,
  dependency-types-only by construction.
- `path(from, to)` — breadth-first, deterministic order, cycle-safe,
  depth-capped (25 hard cap). Direction matters: a path follows edge
  direction.
- `subgraph(node, depth)` — bounded neighborhood expansion.
- `cycles(node)` — real cycle detection (the W01 → A02 → S01
  SUPPORTS triangle is the standing test fixture).
- `neighborhood(node)` — grouped view: dependencies, dependents,
  training (who teaches this), maintenance (who repairs this),
  fallback, failure. Incoming edges keep their direction and are
  never silently flipped.
- `integrity()` — the graph integrity checker: orphans (dangling
  source/target), unknown relationship types, invalid node types,
  broken provenance, invalid lifecycle states (DOCUMENTED/VERIFIED
  without provenance or reviewer), and canonical duplicates (same
  type/source/target/scope with active status — proposing one returns
  the existing edge with instructions to attach provenance instead).

## Pages

- `#/graph` — overview (counts by status and category, integrity
  summary, privacy legend) plus the node inspector: type a capability
  and see its dependency neighborhood honestly.
- `#/graph/:id` — edge detail: full lifecycle, provenance list,
  history, reviewer actions for those with permission.
- The capability detail page (`#/capabilities/:id`) gains a live
  relationships section — the graph is visible from the inventory,
  not only from its own page.

## Audit

Every state change is audited through the Stage 3 append-only audit
service (`graph.created`, `graph.documented`, `graph.verified`,
`graph.rejected`, `graph.updated`, `graph.provenance_added`,
`graph.superseded`, `graph.retired`), each with actor, old/new value,
reason and edge version. History and audit are separate by design:
history explains the record, audit explains the action.

## Export/import

`graph_edges` is exportable (collection export and full export) and
the export **carries referenced canonical nodes** (capabilities,
families, practitioners and every other node the edges touch), so a
graph export re-imports standalone into an empty Atlas — the frozen
Stage 2 atomic semantics, unchanged.

Import validates the whole bundle before any mutation: vocabulary,
node-type matrix, statuses, and full source/target/provenance
resolution for **active** edges. Broken references never create a
partially valid dataset. Retired (REJECTED/SUPERSEDED) edges are the
one deliberate exemption: an integrity-retired orphan keeps its broken
references by design, and exempting retired history is what keeps a
real research dataset — one that has retired corrupt edges through the
audited path — exportable and importable. Active edges are held to the
full standard; the integrity checker re-flags retired corruption
honestly after import.

## Honest limitations of this stage

- The graph is a **research instrument**, not a rendered map: Stage 7
  ships inspection (traversal, grouping, integrity), not a visual
  layout engine. A visual layer can build directly on `subgraph()`.
- Dependency **weighting, criticality and risk labels are deliberately
  absent**. The owner's standing rule holds: no risk labels, no
  criticality scores. The graph records what is documented.
- Cycle detection reports cycles; it does not judge them. Many real
  capability systems contain legitimate mutual support.
- Support entity records (workshops, resources, materials, tools,
  energy sources, failure scenarios) are modelled as first-class
  records but ship **empty** — they are canvases for Stages 8 and 9,
  not fabricated data.

## Test coverage

`tests/capability-graph.test.js` (129 checks): creation matrix,
vocabulary enforcement, provenance gating, the full lifecycle and its
audit trail, RBAC denials, privacy (anonymous, researcher, restricted
reviewer), traversal (path, cycles, neighborhood), integrity against
injected corruption, retirement of every corrupt edge through the
audited path, atomic import (broken bundle, bad vocabulary, duplicate)
and the standalone round-trip. The build/runtime integrity suite boots
every graph route in the DOM sandbox and proves the clean install
contains zero fabricated relationships.
