# Stage 8: Repair & Spare-Part Network — Architecture

Build step 8 of the Somali Capability Atlas (SCOS). Stage 8 adds the
*repair capability* dimension to the atlas: who can repair, diagnose,
test or fabricate for a documented capability, where, with which spare
parts, and what repair history exists — all with the same honesty rules
that froze in Stages 1-7.

Delivered models: **Workshop**, **RepairCapability**, **Tool**,
**Material**, **SparePart**, **FailureScenario**, **RepairRecord**,
plus the `SCA.repair` workflow service, the Repair pages
(`/repair`, `/workshop/:id`, `/repair-capability/:id`, `/spare-part/:id`,
`/repair-record/:id`), and the `repair-network` test suite.

## Stage 8 principles (enforced by tests)

1. **Capability ≠ practitioner.** A repair capability describes an
   operation (diagnose / repair / fabricate / test) an anchor (workshop
   or practitioner) claims to perform for an asset. It is never
   evidence of competence; competence comes only from a Stage 5
   competence assessment (linked, never auto-inferred).
2. **Existence ≠ competence.** A workshop exists at REPORTED /
   DOCUMENTED / VERIFIED. A capability exists at PROPOSED / DOCUMENTED
   / VERIFIED, with `competence_status` UNKNOWN / ASSESSED tracked
   separately.
3. **Diagnosis ≠ repair.** Four independent flags:
   `diagnostic_capability`, `repair_operations`,
   `fabrication_capability`, `testing_capability`. A diagnostic-only
   capability implies neither repair nor fabrication. The duplicate
   check covers all four so distinct capabilities never collide.
4. **Repair ≠ fabrication.** Repair operations and fabrication claims
   are recorded separately. `fabrication_capability` is a tri-state
   (UNKNOWN / REPORTED_POSSIBLE / VERIFIED) with an explicit
   specification and materials required before verification.
5. **Availability ≠ compatibility.** A spare part's
   `availability_status` (IN_STOCK / IMPORT_ONLY / FABRICATED /
   UNKNOWN...) and its `compatibility_status` (UNKNOWN → REPORTED →
   DOCUMENTED → TESTED → VERIFIED, or REJECTED) are independent
   lifecycles. "We have it" never implies "it fits".
6. **Similarity ≠ compatibility.** Documented compatibility requires
   evidence sources; TESTED requires a fitment result; VERIFIED
   requires a reviewer with an explicit reason. "Looks the same" is
   rejected at the DOCUMENTED gate.
7. **No fabricated baseline.** The repair network starts empty: zero
   workshops, capabilities, parts, records. `SCA.BUILD_STEP` is 8; the
   clean-install test asserts zero repair data and the intact
   240-capability inventory.
8. **UNKNOWN ≠ nonexistent.** Pathway and radius views report UNKNOWN
   with an explanation instead of zero, false, "unavailable" or
   "impossible".
9. **No automatic inference.** No state moves without provenance
   (source / evidence / assessment), no self-verification, no
   auto-promotion, and repair history never upgrades capability
   evidence levels (E0 stays E0 until Stage 3 evidence does it).
10. **Systemic view.** Pathways are decomposed (the 11-step repair
    pathway, 7-step spare-part pathway, 7-step fabrication pathway),
    never a single boolean such as "locally repairable".
11. **The repair network lives in the frozen graph.** No second
    relationship engine: REPAIRS, MAINTAINS, RECOVERED_BY, FALLS_BACK_TO
    and TEACHES come from the Stage 7 vocabulary (19 types,
    unchanged). Spare-part compatibility is NOT a graph relationship.
12. **Modernization means describing repairability and local
    manufacturing capacity, not inventing it.** Where documentation is
    absent the state stays UNKNOWN.

## Workshops

Anchor records for repair operations. Fields: name, region/location
references, services, contact details (private by default,
`public_visibility` controls anonymous visibility), organization
reference, related location or evidence sources, status.

Lifecycle: `REPORTED → DOCUMENTED → VERIFIED`, plus
`INACTIVE`/`CLOSED` (terminal) — `CLOSED` cannot reopen: a closed
workshop is history. REPORTED → DOCUMENTED requires provenance
(`source_ids`); → VERIFIED requires reviewer authority and an explicit
reason. Workshops carry no compatibility or competence claims; the
carry-forward rule from Stage 6 applies to every workshop count:
"documented workshops", never "only N workshops exist".

## RepairCapability

"Workshop X can repair asset Y (model Z), operations [...]" — per
asset. An anchor (`workshop_id` and/or `practitioner_ids`) is required:
a capability is always grounded in who/where claims it. Fields include
the four operation flags, manufacturer/model (a capability for one
model is not a capability for all models), limitations, tools used,
materials used, energy needs, evidence sources, related knowledge
artifacts, and Stage 5 links (`linked_assessment_id`,
`linked_certification_id`).

Lifecycle: `PROPOSED → DOCUMENTED → VERIFIED`, with `SUPERSEDED` and
`REJECTED` as preserved-history states. VERIFIED capabilities are never
edited in place; corrections go through supersession (the successor
starts at PROPOSED, records `supersedes_id`, and inherits no
verification). Competence is linked, not inferred: only an ACCEPTED
Stage 5 competence assessment may set `competence_status = ASSESSED`.
Duplicate capabilities (same anchor, asset, manufacturer, model and
all four operation signatures) are rejected — corrections go through
supersession, not duplication.

## SparePart

Manufacturer / model / manufacturer part number (uniqueness enforced,
duplicates rejected), asset references, local stock description,
availability status, import sources, compatibility lifecycle
(UNKNOWN → REPORTED → DOCUMENTED → TESTED → VERIFIED or REJECTED),
fabrication tri-state with specification and substitute materials, and
provenance. REJECTED is a finding (known incompatibility), not missing
data.

## FailureScenario

A controlled failure taxonomy: `failure_category` ∈ MECHANICAL /
ELECTRICAL / ELECTRONIC / STRUCTURAL / THERMAL / HYDRAULIC /
PNEUMATIC / CORROSION / WEAR / CONTAMINATION / CALIBRATION /
SOFTWARE_CONTROL / FUEL / ENVIRONMENTAL / OPERATIONAL / UNKNOWN —
free text is rejected. (Correction 8.1: the first draft of this
document abbreviated the taxonomy to six categories, including a
"MATERIAL" code that does not exist in the implementation. The
implementation's 16-code vocabulary above is canonical;
"material-related" failure modes are expressed through STRUCTURAL,
CORROSION, WEAR or CONTAMINATION.) Symptoms, diagnostic methods, possible causes,
documented part requirements, repair strategies, fallbacks. UNKNOWN is
a valid documented category: "the failure mode is not yet understood"
is honest data.

## RepairRecord

Event records: what failed, when, symptoms, diagnosis, root cause,
repair action, outcome, parts and **local substitutes used**, test
result, return-to-service decision, lessons, participating technicians
and apprentices, provenance. Review lifecycle:
`DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED / REJECTED → ARCHIVED`
with DRAFT-only editing, reviewer separation, explicit reasons
required, and authority separation (entry staff submit, never review).
"ACCEPTED" means *accepted as documentation* — a repair record is
evidence, not a capability upgrade.

Lessons are captured explicitly by a reviewer through the Stage 3
knowledge archive (a knowledge artifact is created and linked);
a repair record never writes to the capability's evidence level on
its own.

## Person protection (Stages 4-5 rules, unchanged)

Technician and apprentice references are protected: public views strip
identities (names, contacts, locations), counts are aggregated, and
only roles with Stage 5 person visibility resolve them. Anonymous users
see no repair records at all (safety), and public workshop views strip
private contact details. Pathway views label person data
`practitioners_visible: false` rather than leaking partially.

## Pathways and views (inspection only — no simulation)

- `repairPathway(asset)` — 11 documented stages: failure documentation,
  diagnostic capability, repair capability, fabrication capability,
  testing, spare parts, substitutes, tools, materials, energy,
  practitioner/workshop grounding. Each step reports
  DOCUMENTED / UNKNOWN with details; unknown steps explain *why* the
  information is missing. Immutable snapshot: reading a pathway never
  changes data.
- `sparePartPathway(partId)` — local stock, import pathway,
  compatibility state, fabrication pathway (embedded, 7 steps).
- `fabricationPathway(partId)` — never one boolean: reported evidence,
  specification, materials, tools, skills, testing, each step's state.
- `repairRadius(asset)` — nearest documented workshop (public fields
  only), technician presence (UNKNOWN, never identities),
  aggregate availability; results carry a scope note: derived from the
  *current documented dataset*, never from claims about the real world.
- `geographicOverview()` — descriptive counts only. Resilience
  scores and regional rankings are deliberately NOT calculated here;
  they belong to a later stage on top of audited data.
- `searchWorkshops / searchRepairCapabilities / searchSpareParts /
  searchRepairRecords` — deterministic, filterable, unranked.

## Integrity and import/export

- `SCA.repair.integrity()` checks reference integrity (workshop,
  practitioner, asset, tool, material, source, assessment, knowledge),
  duplicate manufacturer part numbers, review-trail consistency and
  unauthorized certification structures (a self-declared VERIFIED
  competence with no Stage 5 link is flagged). Retired history
  (REJECTED / SUPERSEDED / ARCHIVED / CLOSED) with intentionally
  broken references is *preserved* and flagged as historical warning —
  never silently deleted (the frozen Stage 7 rule, extended to the
  repair collections).
- Export/import uses the Stage 2.1 system unchanged: collection
  exports carry their referenced records (standalone-importable),
  imports are atomic, and dynamic asset references
  (`asset_type` + `asset_id`) resolve through the registry. A
  repair-capabilities-only export is importable on a fresh device.
- **Explicit decision — workshop import validation (correction
  8.1).** Stage 7's REFERENCES map left `workshops` with an empty
  spec, because workshops were then placeholder registry records
  with no workflow and zero production data (the Stage 7 baseline
  contained no workshop records, so the empty spec never fired on a
  real bundle). Stage 8 operationalizes workshops as repair anchors
  and therefore FILLS the spec: an ACTIVE workshop in an imported
  bundle must resolve its references, and retired workshops
  (INACTIVE/CLOSED) receive the frozen retired-history exemption —
  the same rule retired graph edges follow. This is an intentional
  Stage 8 extension of a previously empty specification, not a
  redefinition of a tested Stage 7 behavior; regression coverage
  pins both the active-workshop rejection and the retired-workshop
  exemption (tests/repair-network.test.js).

## RBAC (least privilege, new permissions)

`workshop.read/create/update/review/admin`,
`repair.create/update/read/admin`, `repair.review` (reviewer-only),
`sparepart.create/update/admin`, `sparepart.review` (reviewer-only),
`repair.records.read` (staff visibility; anonymous excluded by design).
Entry roles (researcher, technician, community steward) create and
document; only reviewers verify/accept/reject; only the national
administrator holds `repair.admin`. Permission checks run before
transition analysis in the reviewer-gated gates (the sharper refusal).

## Test suite

`tests/repair-network.test.js` — RBAC, workshop lifecycle, capability
lifecycle (including supersession and competence linking), spare-part
compatibility and fabrication lifecycles, failure taxonomy, repair
record review flow, lessons, pathways (including UNKNOWN honesty and
privacy), radius, overview, searches, integrity checker (including the
historical-warning preservation), atomic import/export with the
retired-history exemption, inventory protection and full teardown to
the pristine Stage 1-7 baseline. All fixtures are marked TEST FIXTURE.

Full state after corrections (8.1): **9,477 checks, 0 failures, 14 suites**.

## Not built (deliberately)

Resilience scoring, regional rankings, failure *simulation*,
predictive part demand, marketplace pricing, map visualization of the
repair network, and any automatic upgrade of capability evidence from
repair history. These need audited data first; the structures here are
ready for them.
