# Capability Data Model & Evidence Framework

## Core rule

> A claim can be preserved without being declared true.

Historical and indigenous knowledge is documented and preserved. Scientific
and technical validation determines whether a practice is adopted, modified,
integrated with modern technology, or rejected. The platform is neither
anti-modern nor romantic about historical practices.

For medical knowledge in particular: **historical existence is never proof of
medical effectiveness.**

## Anti-fabrication rule

No fabricated practitioners, facts, sources, statistics, locations,
measurements, capabilities, evidence, photographs, or research results. When
information does not exist, the interface displays **"Not yet documented."**
Unknown values are stored as `null`, never as invented defaults.

## Entities

Canonical JSON Schemas live in `schemas/` (32 files: 8 implemented core
entities plus reserved stubs so the registry is complete and extensible).
Application models live in `src/models/`. Implemented now:

- **User**, **CapabilityFamily** (codes W L A P F C H M R S T G),
  **Capability**, **Practitioner**, **Apprentice**, **EvidenceSource**,
  **Location**, **KnowledgeArtifact**.

Reserved future entities (schema stubs, fields defined in their stages):
Institution, Organization, Workshop, Dependency, Resource, Material,
ToolEquipment, ModernEquivalent, FallbackSystem, FailureScenario,
RecoveryProfile, Intervention, PilotProject, TrainingProgram,
CompetenceAssessment, CapabilityCertification, MarketplaceService,
Measurement, Indicator, Consent, AccessPolicy, Provenance, AuditLog,
Notification.

Key field notes:
- The Capability model carries the full research field set, including
  regions, practitioners, knowledge_holders, materials, tools, dependencies,
  modern_equivalent, fallback, failure_scenarios, recovery_time,
  recovery_difficulty, repair_radius, recovery_radius, economic_role,
  environmental_role, knowledge_role, graph_leverage, irreplaceability,
  reproduction_pathway, priority_flags, source_ids, reviewer and version.
- The Practitioner model separates the private full name (access-controlled)
  from public_name, and carries capabilities, services, languages,
  references, training_history, assessment_history, availability,
  organization and notes for later stages.
- The Apprentice model carries demonstrations_completed, assessments,
  employment, trainer_ready and portfolio; certification is based on
  demonstrated competence, not attendance.

## Dependency relationship types (prepared, not built)

The future dependency graph (Stage 6) uses these relationship types. The
data model supports them; no visualization or graph engine exists yet.

DEPENDS_ON, SUPPORTS, ENABLES, REQUIRES, MAINTAINS, REPAIRS, PRODUCES,
TEACHES, LOCATED_IN, EVIDENCED_BY, DOCUMENTED_IN, FALLS_BACK_TO,
FAILS_UNDER, RECOVERED_BY, MODERNIZED_BY, REPRODUCES, USES_RESOURCE,
USES_ENERGY, REQUIRES_INSTITUTION.

- **User**: id, name, email, role, phone, language, region, profile_photo, bio,
  created_at, updated_at, status (+ internal `_auth`, never exported).
- **CapabilityFamily**: id, code, name, description, display_order.
- **Capability**: id, code, name, family_id, short_description, description,
  historical_status, living_status, evidence_level, verification_status,
  documentation_status, transmission_status, capability_maturity, criticality,
  centrality, reproducibility, fallback_value, external_dependency,
  knowledge_concentration, preservation_urgency, action, safety_notes,
  limitations, stewardship_notes, region, created_at, updated_at, reviewed_at.
- **Practitioner**: id, user_id, public_name, anonymous_option,
  experience_years, competence_level, region, can_teach, apprentice_capacity,
  verification_status, documentation_consent, contact_visibility, bio.
- **Apprentice**: id, user_id, capability_id, mentor_id, current_level,
  target_level, training_start, practical_hours, assessment_status,
  certification_status.
- **EvidenceSource**: id, title, source_type, author, organization,
  publication_date, url, description, evidence_level, region,
  verification_status.
- **Location**: id, country, region, district, city, locality, latitude,
  longitude, privacy_level.
- **KnowledgeArtifact**: id, capability_id, title, artifact_type, description,
  file_url, language, creator, consent_status, access_level,
  verification_status.

## Evidence levels

| Code | Meaning |
|------|---------|
| E0 | Unknown |
| E1 | Preliminary |
| E2 | Community / oral evidence |
| E3 | Documented |
| E4 | Multiple independent evidence streams |
| E5 | Strong historical + technical/living evidence |

## Capability status

| Code | Meaning |
|------|---------|
| S0 | Unknown |
| S1 | Historical record only |
| S2 | Documented |
| S3 | Living practitioner |
| S4 | Active transmission |
| S5 | Multiple practitioners |
| S6 | Institutionalized |
| S7 | Self-reproducing |

## Actions

RECOVER, PRESERVE, VALIDATE, MODERNIZE, BUILD, BACKUP, DOCUMENT.
These are classifications, not automatic judgments.

## Capability maturity

| Code | Meaning |
|------|---------|
| L0 | Consumer |
| L1 | Operator |
| L2 | Maintainer |
| L3 | Repairer |
| L4 | Fabricator |
| L5 | Manufacturer |
| L6 | Designer |
| L7 | Innovator |
| L8 | Teacher |
| L9 | Ecosystem reproducer |

## Access levels (privacy)

PUBLIC, RESEARCH, COMMUNITY, RESTRICTED, PRIVATE.

Sensitive practitioner information does not automatically become public. Every
sensitive record carries consent and visibility fields.

## Roles and permissions

The 12 roles and the permission matrix live in `src/rbac/`. Permissions
include data.read (all, including anonymous), capability.create/update,
evidence.create, practitioner.create, apprentice.enroll, knowledge.create,
projects.manage, data.export, data.import, dashboard.view, users.manage,
roles.assign, profile.manage. The National Administrator holds every
permission; the matrix enforces this automatically. Automated tests verify
key matrix cells (`tests/rbac.test.js`).
