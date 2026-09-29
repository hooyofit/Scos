/*
 * Evidence framework, capability statuses, actions, maturity levels and
 * privacy access levels. These are classifications, not automatic judgments.
 * A preserved claim is not a validated truth. See docs/capability-data-model.md.
 */
(function (SCA) {
  'use strict';
  function find(list, code) {
    for (var i = 0; i < list.length; i++) { if (list[i].code === code) { return list[i]; } }
    return null;
  }

  SCA.enums = {
    evidence_levels: [
      { code: 'E0', label: 'Unknown' },
      { code: 'E1', label: 'Preliminary' },
      { code: 'E2', label: 'Community / oral evidence' },
      { code: 'E3', label: 'Documented' },
      { code: 'E4', label: 'Multiple independent evidence streams' },
      { code: 'E5', label: 'Strong historical + technical/living evidence' }
    ],
    living_status: [
      { code: 'S0', label: 'Unknown / not yet documented' },
      { code: 'S1', label: 'Historical record only' },
      { code: 'S2', label: 'Documented' },
      { code: 'S3', label: 'Living practitioner' },
      { code: 'S4', label: 'Active transmission' },
      { code: 'S5', label: 'Multiple practitioners' },
      { code: 'S6', label: 'Institutionalized' },
      { code: 'S7', label: 'Self-reproducing' }
    ],
    actions: [
      { code: 'RECOVER', label: 'Recover' },
      { code: 'PRESERVE', label: 'Preserve' },
      { code: 'VALIDATE', label: 'Validate' },
      { code: 'MODERNIZE', label: 'Modernize' },
      { code: 'BUILD', label: 'Build' },
      { code: 'BACKUP', label: 'Backup' },
      { code: 'DOCUMENT', label: 'Document' }
    ],
    maturity: [
      { code: 'L0', label: 'Consumer' },
      { code: 'L1', label: 'Operator' },
      { code: 'L2', label: 'Maintainer' },
      { code: 'L3', label: 'Repairer' },
      { code: 'L4', label: 'Fabricator' },
      { code: 'L5', label: 'Manufacturer' },
      { code: 'L6', label: 'Designer' },
      { code: 'L7', label: 'Innovator' },
      { code: 'L8', label: 'Teacher' },
      { code: 'L9', label: 'Ecosystem reproducer' }
    ],
    /* Stage 3: evidence archive classifications. These are categories for
       traceability, NOT credibility judgments: a source typed "Academic
       Publication" is not thereby credible; review stays human. */
    source_types: [
      { code: 'ACADEMIC_PUBLICATION', label: 'Academic Publication' },
      { code: 'BOOK', label: 'Book' },
      { code: 'ARCHIVE', label: 'Archive' },
      { code: 'GOVERNMENT_RECORD', label: 'Government Record' },
      { code: 'INSTITUTIONAL_REPORT', label: 'Institutional Report' },
      { code: 'NGO_DEVELOPMENT_REPORT', label: 'NGO/Development Report' },
      { code: 'TECHNICAL_MANUAL', label: 'Technical Manual' },
      { code: 'FIELD_REPORT', label: 'Field Report' },
      { code: 'INTERVIEW', label: 'Interview' },
      { code: 'ORAL_HISTORY', label: 'Oral History' },
      { code: 'PRACTITIONER_DEMONSTRATION', label: 'Practitioner Demonstration' },
      { code: 'COMMUNITY_RECORD', label: 'Community Record' },
      { code: 'PHOTOGRAPH', label: 'Photograph' },
      { code: 'VIDEO', label: 'Video' },
      { code: 'AUDIO', label: 'Audio' },
      { code: 'DATASET', label: 'Dataset' },
      { code: 'MAP', label: 'Map' },
      { code: 'NEWSPAPER_PERIODICAL', label: 'Newspaper/Periodical' },
      { code: 'WEBSITE', label: 'Website' },
      { code: 'OTHER_SOURCE_TYPE', label: 'Other' }
    ],
    claim_types: [
      { code: 'HISTORICAL_EXISTENCE', label: 'Historical existence' },
      { code: 'CURRENT_PRACTICE', label: 'Current practice' },
      { code: 'TECHNICAL_FUNCTION', label: 'Technical function' },
      { code: 'PERFORMANCE', label: 'Performance' },
      { code: 'ENVIRONMENTAL_FUNCTION', label: 'Environmental function' },
      { code: 'ECONOMIC_FUNCTION', label: 'Economic function' },
      { code: 'SOCIAL_FUNCTION', label: 'Social function' },
      { code: 'HEALTH_RELATED', label: 'Health-related' },
      { code: 'SAFETY_RELATED', label: 'Safety-related' },
      { code: 'PRACTITIONER_KNOWLEDGE', label: 'Practitioner knowledge' },
      { code: 'OTHER_CLAIM_TYPE', label: 'Other' }
    ],
    /* Controlled verification status for evidence objects (Stage 3).
       Disputed does not mean false; Rejected preserves the historical
       record and records the reason; Superseded points to what replaced it.
       The 240 capability records keep their frozen Stage 2 value
       "Unverified" — a capability-level label, distinct from this scale. */
    verification_states: [
      { code: 'UNREVIEWED', label: 'Unreviewed' },
      { code: 'UNDER_REVIEW', label: 'Under Review' },
      { code: 'COMMUNITY_DOCUMENTED', label: 'Community Documented' },
      { code: 'SOURCE_VERIFIED', label: 'Source Verified' },
      { code: 'TECHNICALLY_REVIEWED', label: 'Technically Reviewed' },
      { code: 'INDEPENDENTLY_CORROBORATED', label: 'Independently Corroborated' },
      { code: 'DISPUTED', label: 'Disputed' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],
    /* Stage 4: field research classifications. */
    project_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'APPROVED', label: 'Approved' },
      { code: 'ACTIVE', label: 'Active' },
      { code: 'PAUSED', label: 'Paused' },
      { code: 'COMPLETED', label: 'Completed' },
      { code: 'ARCHIVED', label: 'Archived' }
    ],
    location_precision: [
      { code: 'EXACT', label: 'Exact' },
      { code: 'APPROXIMATE', label: 'Approximate' },
      { code: 'LOCALITY_ONLY', label: 'Locality only' },
      { code: 'DISTRICT_ONLY', label: 'District only' },
      { code: 'REGION_ONLY', label: 'Region only' },
      { code: 'UNDISCLOSED', label: 'Undisclosed' }
    ],
    observation_types: [
      { code: 'DIRECT_OBSERVATION', label: 'Direct Observation' },
      { code: 'DEMONSTRATION', label: 'Demonstration' },
      { code: 'PRACTICAL_TEST', label: 'Practical Test' },
      { code: 'ENVIRONMENTAL_OBSERVATION', label: 'Environmental Observation' },
      { code: 'MATERIAL_OBSERVATION', label: 'Material Observation' },
      { code: 'EQUIPMENT_OBSERVATION', label: 'Equipment Observation' },
      { code: 'PROCESS_OBSERVATION', label: 'Process Observation' },
      { code: 'OTHER_OBSERVATION', label: 'Other' }
    ],
    media_types: [
      { code: 'PHOTOGRAPH', label: 'Photograph' },
      { code: 'VIDEO', label: 'Video' },
      { code: 'AUDIO', label: 'Audio' },
      { code: 'SCAN', label: 'Scan' },
      { code: 'DOCUMENT', label: 'Document' },
      { code: 'OTHER_MEDIA', label: 'Other' }
    ],
    participant_roles: [
      { code: 'PRACTITIONER', label: 'Practitioner' },
      { code: 'ELDER', label: 'Elder' },
      { code: 'FARMER', label: 'Farmer' },
      { code: 'FISHER', label: 'Fisher' },
      { code: 'TECHNICIAN', label: 'Technician' },
      { code: 'CRAFTSPERSON', label: 'Craftsman/craftswoman' },
      { code: 'TRADER', label: 'Trader' },
      { code: 'COMMUNITY_MEMBER', label: 'Community member' },
      { code: 'RESEARCHER', label: 'Researcher' },
      { code: 'INSTITUTIONAL_REPRESENTATIVE', label: 'Institutional representative' },
      { code: 'OTHER_PARTICIPANT', label: 'Other' }
    ],
    /* Field record lifecycle. Rejected never means erased: the record and
       the documented reason are preserved. */
    field_record_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'SUBMITTED', label: 'Submitted' },
      { code: 'UNDER_REVIEW', label: 'Under Review' },
      { code: 'NEEDS_CLARIFICATION', label: 'Needs Clarification' },
      { code: 'ACCEPTED_AS_EVIDENCE', label: 'Accepted as Evidence' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'ARCHIVED', label: 'Archived' }
    ],
    conflict_resolution: [
      { code: 'UNREVIEWED', label: 'Unreviewed' },
      { code: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
      { code: 'CONTEXTUAL_DIFFERENCE', label: 'Contextual Difference' },
      { code: 'CORROBORATED', label: 'Corroborated' },
      { code: 'UNRESOLVED', label: 'Unresolved' },
      { code: 'RESOLVED', label: 'Resolved' },
      { code: 'REJECTED_CONFLICT', label: 'Rejected' }
    ],
    queue_statuses: [
      { code: 'LOCAL_ONLY', label: 'Local Only' },
      { code: 'READY_FOR_EXPORT', label: 'Ready for Export' },
      { code: 'EXPORTED', label: 'Exported' },
      { code: 'IMPORTED', label: 'Imported' },
      { code: 'SYNCHRONIZED', label: 'Synchronized' },
      { code: 'CONFLICT', label: 'Conflict' },
      { code: 'FAILED', label: 'Failed' }
    ],
    /* Field research access levels: stricter than the public archive set. */
    research_access_levels: [
      { code: 'PUBLIC', label: 'Public' },
      { code: 'RESEARCH_TEAM', label: 'Research Team' },
      { code: 'REVIEWER_ONLY', label: 'Reviewer Only' },
      { code: 'RESTRICTED', label: 'Restricted' },
      { code: 'CONFIDENTIAL', label: 'Confidential' }
    ],
    sensitivity_levels: [
      { code: 'PUBLIC', label: 'Public' },
      { code: 'RESTRICTED', label: 'Restricted' },
      { code: 'CONFIDENTIAL', label: 'Confidential' }
    ],
    settlement_contexts: [
      { code: 'URBAN', label: 'Urban' },
      { code: 'RURAL', label: 'Rural' },
      { code: 'COASTAL', label: 'Coastal' },
      { code: 'PASTORAL', label: 'Pastoral' },
      { code: 'AGRICULTURAL', label: 'Agricultural' },
      { code: 'OTHER_CONTEXT', label: 'Other' }
    ],
    consent_states: [
      { code: 'GRANTED', label: 'Granted' },
      { code: 'WITHDRAWN', label: 'Withdrawn' }
    ],
    access_levels: [
      { code: 'PUBLIC', label: 'Public' },
      { code: 'RESEARCH', label: 'Research' },
      { code: 'COMMUNITY', label: 'Community' },
      { code: 'RESTRICTED', label: 'Restricted' },
      { code: 'PRIVATE', label: 'Private' }
    ],
    /* ---- Stage 5: practitioner, apprenticeship & capability reproduction ---- */

    /* Documentation/participation status, NOT a ranking. Nobody becomes
       "Verified" automatically by being listed. */
    practitioner_statuses: [
      { code: 'CANDIDATE', label: 'Candidate' },
      { code: 'DOCUMENTED', label: 'Documented' },
      { code: 'COMMUNITY_CONFIRMED', label: 'Community Confirmed' },
      { code: 'DEMONSTRATED', label: 'Demonstrated' },
      { code: 'ASSESSED', label: 'Assessed' },
      { code: 'VERIFIED', label: 'Verified' },
      { code: 'INACTIVE', label: 'Inactive' },
      { code: 'RETIRED', label: 'Retired' },
      { code: 'DECEASED', label: 'Deceased' },
      { code: 'WITHDRAWN', label: 'Withdrawn' }
    ],
    /* Demonstrated competence within the Atlas framework. L0 is Unknown.
       Never assigned automatically; never a social status ranking. */
    competence_levels: [
      { code: 'L0', label: 'Unknown' },
      { code: 'L1', label: 'Observer / Beginner' },
      { code: 'L2', label: 'Assisted Practitioner' },
      { code: 'L3', label: 'Independent Practitioner' },
      { code: 'L4', label: 'Advanced Practitioner' },
      { code: 'L5', label: 'Trainer / Master Practitioner' }
    ],
    assessment_types: [
      { code: 'DEMONSTRATION', label: 'Demonstration' },
      { code: 'PRACTICAL_ASSESSMENT', label: 'Practical Assessment' },
      { code: 'OBSERVATION', label: 'Observation' },
      { code: 'PORTFOLIO', label: 'Portfolio' },
      { code: 'COMMUNITY_VERIFICATION', label: 'Community Verification' },
      { code: 'TECHNICAL_ASSESSMENT', label: 'Technical Assessment' },
      { code: 'TRAINER_ASSESSMENT', label: 'Trainer Assessment' },
      { code: 'OTHER', label: 'Other' }
    ],
    assessment_results: [
      { code: 'NOT_ASSESSED', label: 'Not Assessed' },
      { code: 'REQUIRES_DEVELOPMENT', label: 'Requires Development' },
      { code: 'DEMONSTRATED', label: 'Demonstrated' },
      { code: 'COMPETENT', label: 'Competent' },
      { code: 'COMPETENT_WITH_LIMITATIONS', label: 'Competent with Limitations' },
      { code: 'NOT_YET_COMPETENT', label: 'Not Yet Competent' },
      { code: 'INCONCLUSIVE', label: 'Assessment Inconclusive' }
    ],
    assessment_review_statuses: [
      { code: 'PENDING', label: 'Pending Review' },
      { code: 'ACCEPTED', label: 'Accepted' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],
    apprenticeship_statuses: [
      { code: 'PLANNED', label: 'Planned' },
      { code: 'ACTIVE', label: 'Active' },
      { code: 'PAUSED', label: 'Paused' },
      { code: 'COMPLETED', label: 'Completed' },
      { code: 'WITHDRAWN', label: 'Withdrawn' },
      { code: 'DISCONTINUED', label: 'Discontinued' }
    ],
    /* Discontinuation is NOT automatically failure. interruption_reason
       records why, without judgment. */
    completion_statuses: [
      { code: 'COMPLETED', label: 'Completed' },
      { code: 'COMPLETED_WITH_NOTES', label: 'Completed with Notes' },
      { code: 'PARTIALLY_COMPLETED', label: 'Partially Completed' },
      { code: 'NOT_COMPLETED', label: 'Not Completed' }
    ],
    training_program_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'APPROVED', label: 'Approved' },
      { code: 'ACTIVE', label: 'Active' },
      { code: 'PAUSED', label: 'Paused' },
      { code: 'RETIRED', label: 'Retired' }
    ],
    certification_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'PENDING', label: 'Pending' },
      { code: 'ISSUED', label: 'Issued' },
      { code: 'SUSPENDED', label: 'Suspended' },
      { code: 'REVOKED', label: 'Revoked' },
      { code: 'EXPIRED', label: 'Expired' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],
    /* Verification pathways stay DISTINCT. Never collapsed into one
       "trusted" score. */
    verification_pathways: [
      { code: 'SELF_REPORTED', label: 'Self-reported' },
      { code: 'COMMUNITY_REFERRED', label: 'Community referred' },
      { code: 'PRACTITIONER_DEMONSTRATED', label: 'Practitioner demonstrated' },
      { code: 'ASSESSOR_VERIFIED', label: 'Assessor verified' },
      { code: 'INSTITUTION_VERIFIED', label: 'Institution verified' },
      { code: 'EVIDENCE_SUPPORTED', label: 'Evidence supported' }
    ],
    /* Knowledge can live outside individual persons. */
    knowledge_holder_types: [
      { code: 'INDIVIDUAL', label: 'Individual practitioner' },
      { code: 'HOUSEHOLD', label: 'Household' },
      { code: 'WORKSHOP', label: 'Workshop' },
      { code: 'COOPERATIVE', label: 'Cooperative' },
      { code: 'COMMUNITY', label: 'Community' },
      { code: 'INSTITUTION', label: 'Institution' }
    ],
    organization_types: [
      { code: 'WORKSHOP', label: 'Workshop' },
      { code: 'TRAINING_CENTER', label: 'Training center' },
      { code: 'COOPERATIVE', label: 'Cooperative' },
      { code: 'UNIVERSITY', label: 'University' },
      { code: 'NGO', label: 'NGO' },
      { code: 'BUSINESS', label: 'Business' },
      { code: 'GOVERNMENT', label: 'Government institution' },
      { code: 'COMMUNITY_ORGANIZATION', label: 'Community organization' }
    ],
    /* Contact visibility: private contact details never appear in public
       pages. */
    contact_visibility_levels: [
      { code: 'PRIVATE', label: 'Private (internal only)' },
      { code: 'RESEARCH_TEAM', label: 'Research team' },
      { code: 'PUBLIC', label: 'Public' }
    ],
    milestone_statuses: [
      { code: 'PENDING', label: 'Pending' },
      { code: 'IN_PROGRESS', label: 'In Progress' },
      { code: 'COMPLETED', label: 'Completed' },
      { code: 'SKIPPED', label: 'Skipped (not applicable)' }
    ],
    trainer_readiness: [
      { code: 'NOT_ASSESSED', label: 'Not Assessed' },
      { code: 'IN_DEVELOPMENT', label: 'In Development' },
      { code: 'READY', label: 'Ready to Teach' },
      { code: 'ACTIVE_TRAINER', label: 'Active Trainer' }
    ],
    has: function (list, code) { return !!find(list, code); },
    /* Stage 6: census states. Survey status describes COVERAGE OF
       KNOWLEDGE, never capability absence: "Not Surveyed" means the
       Atlas has no data, not that the capability is absent. */
    census_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'APPROVED', label: 'Approved' },
      { code: 'ACTIVE', label: 'Active' },
      { code: 'PAUSED', label: 'Paused' },
      { code: 'COMPLETED', label: 'Completed' },
      { code: 'ARCHIVED', label: 'Archived' }
    ],
    census_scope_levels: [
      { code: 'COMMUNITY', label: 'One community' },
      { code: 'DISTRICT', label: 'One district' },
      { code: 'CITY', label: 'One city' },
      { code: 'REGION', label: 'One region' },
      { code: 'MULTI_REGION', label: 'Several regions' },
      { code: 'NATIONAL', label: 'National system' }
    ],
    survey_statuses: [
      { code: 'NOT_SURVEYED', label: 'Not Surveyed' },
      { code: 'PLANNED', label: 'Planned' },
      { code: 'IN_PROGRESS', label: 'In Progress' },
      { code: 'PARTIALLY_SURVEYED', label: 'Partially Surveyed' },
      { code: 'SURVEYED', label: 'Surveyed' },
      { code: 'VERIFIED', label: 'Verified' },
      { code: 'EXPIRED', label: 'Expired' }
    ],
    /* Descriptive presence states. Never assigned automatically from
       counts and never rankings. */
    capability_presence: [
      { code: 'UNKNOWN', label: 'Unknown' },
      { code: 'HISTORICALLY_DOCUMENTED', label: 'Historically Documented' },
      { code: 'CURRENTLY_REPORTED', label: 'Currently Reported' },
      { code: 'CURRENTLY_OBSERVED', label: 'Currently Observed' },
      { code: 'PRACTICED', label: 'Practiced' },
      { code: 'ACTIVELY_TAUGHT', label: 'Actively Taught' },
      { code: 'INSTITUTIONALLY_SUPPORTED', label: 'Institutionally Supported' },
      { code: 'NO_LONGER_DOCUMENTED', label: 'No Longer Documented' },
      { code: 'DISPUTED', label: 'Disputed' }
    ],
    documentation_coverage: [
      { code: 'UNDOCUMENTED', label: 'Undocumented' },
      { code: 'PARTIALLY_DOCUMENTED', label: 'Partially documented' },
      { code: 'DOCUMENTED', label: 'Documented' },
      { code: 'INDEPENDENTLY_DOCUMENTED', label: 'Independently documented' },
      { code: 'INSTITUTIONALLY_DOCUMENTED', label: 'Institutionally documented' }
    ],
    /* Count basis semantics: a census count is either what the research
       actually documented (OBSERVED), a methodology-backed estimate
       (ESTIMATED), or has no defensible value (UNKNOWN -> null). */
    count_bases: [
      { code: 'OBSERVED', label: 'Observed' },
      { code: 'ESTIMATED', label: 'Estimated' },
      { code: 'UNKNOWN', label: 'Unknown / not established' }
    ],
    /* ============================================================
     * STAGE 12: Capability Observatory & Measurement Foundation
     * (frozen scope v1.1 + implementation authorization v1.0).
     * ============================================================ */

    /* Measurement lifecycle (frozen scope v1.1 §8). DRAFT is the only
       editable state; SUBMITTED and UNDER_REVIEW are locked; ACCEPTED,
       REJECTED and SUPERSEDED are terminal and immutable. A correction
       NEVER edits an accepted measurement: it creates a successor and
       retires the original (SUPERSEDED), preserving provenance. */
    measurement_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'SUBMITTED', label: 'Submitted' },
      { code: 'UNDER_REVIEW', label: 'Under review' },
      { code: 'ACCEPTED', label: 'Accepted' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],

    /* Count basis semantics — the Stage 12 measurement basis is the
       frozen four-value data-origin vocabulary (scope v1.1 §5):
       what the research actually documented (OBSERVED), a
       methodology-backed estimate (ESTIMATED), a value reported by a
       source without independent verification (REPORTED), or no
       defensible value (UNKNOWN -> null). Stage 6's own
       count_bases enum is NOT modified (Stage 6 remains
       authoritative); Stage 12 measurements use this vocabulary. */
    measurement_bases: [
      { code: 'OBSERVED', label: 'Observed' },
      { code: 'ESTIMATED', label: 'Estimated' },
      { code: 'REPORTED', label: 'Reported' },
      { code: 'UNKNOWN', label: 'Unknown / not established' }
    ],

    /* What kind of quantity is measured (frozen scope v1.1 §5).
       Controlled vocabulary — no free text. */
    measurement_kinds: [
      { code: 'COUNT', label: 'Count' },
      { code: 'RATIO', label: 'Ratio' },
      { code: 'RATE', label: 'Rate' },
      { code: 'DURATION', label: 'Duration' },
      { code: 'PERCENTAGE', label: 'Percentage' },
      { code: 'CATEGORICAL', label: 'Categorical state' }
    ],

    /* Controlled unit vocabulary (frozen at implementation, scope
       v1.1 §5 + authorization §4: "no arbitrary free-text unit
       strings"). A measurement's unit MUST come from this list; the
       allowed unit set is further constrained by measurement_kind
       (enforced by the workflow and tested). */
    measurement_units: [
      { code: 'COUNT', label: 'Count (dimensionless)' },
      { code: 'RATIO', label: 'Ratio (dimensionless)' },
      { code: 'PERCENT', label: 'Percent' },
      { code: 'CATEGORY', label: 'Categorical state (named)' },
      { code: 'PERSONS', label: 'Persons' },
      { code: 'HOUSEHOLDS', label: 'Households' },
      { code: 'COMMUNITIES', label: 'Communities' },
      { code: 'ORGANIZATIONS', label: 'Organizations' },
      { code: 'WORKSHOPS', label: 'Workshops' },
      { code: 'PROGRAMS', label: 'Training programs' },
      { code: 'SESSIONS', label: 'Sessions' },
      { code: 'EVENTS', label: 'Events' },
      { code: 'REPAIRS', label: 'Repairs' },
      { code: 'TOOLS', label: 'Tools' },
      { code: 'PARTS', label: 'Spare parts' },
      { code: 'DOCUMENTS', label: 'Documents' },
      { code: 'HOURS', label: 'Hours' },
      { code: 'DAYS', label: 'Days' },
      { code: 'WEEKS', label: 'Weeks' },
      { code: 'MONTHS', label: 'Months' },
      { code: 'YEARS', label: 'Years' },
      { code: 'KILOGRAMS', label: 'Kilograms' },
      { code: 'LITERS', label: 'Liters' },
      { code: 'METERS', label: 'Meters' },
      { code: 'KILOMETERS', label: 'Kilometers' },
      { code: 'HECTARES', label: 'Hectares' },
      { code: 'KILOWATT_HOURS', label: 'Kilowatt hours' }
    ],

    /* Provenance: how the measured value came to exist. DIRECT is
       documented evidence; GRAPH_DERIVED is computed from the
       Stage 7 graph (read-only — the graph is never modified). */
    measurement_derivations: [
      { code: 'DIRECT', label: 'Directly documented' },
      { code: 'GRAPH_DERIVED', label: 'Derived from the capability graph' }
    ],

    /* Declared analytical intent of a measurement within a ratio
       indicator computation (scope v1.1 §21: intent only — a
       measurement is always an INPUT, never a stored result). */
    measurement_analysis_roles: [
      { code: 'NUMERATOR', label: 'Numerator input' },
      { code: 'DENOMINATOR', label: 'Denominator input' }
    ],

    /* Canonical provenance source types (scope v1.1 §11): existing
       authoritative records ONLY. A measurement references them; it
       never duplicates or upgrades them. */
    measurement_source_types: [
      { code: 'EVIDENCE_SOURCE', label: 'Evidence source (Stage 3)' },
      { code: 'KNOWLEDGE_ARTIFACT', label: 'Knowledge artifact (Stage 3)' },
      { code: 'CLAIM', label: 'Claim (Stage 3)' },
      { code: 'FIELD_OBSERVATION', label: 'Field observation (Stage 4)' },
      { code: 'FIELD_NOTE', label: 'Field note (Stage 4)' },
      { code: 'RESEARCH_PROJECT', label: 'Research project (Stage 4)' },
      { code: 'RESEARCH_SESSION', label: 'Research session (Stage 4)' },
      { code: 'CENSUS_OBSERVATION', label: 'Census observation (Stage 6)' },
      { code: 'CENSUS_SNAPSHOT', label: 'Census snapshot (Stage 6)' },
      { code: 'REPAIR_RECORD', label: 'Repair record (Stage 8)' },
      { code: 'FAILURE_SCENARIO', label: 'Failure scenario (Stage 8)' },
      { code: 'RECOVERY_PROFILE', label: 'Recovery profile (Stage 9)' },
      { code: 'CAPABILITY_INTERVENTION',
        label: 'Capability intervention (Stage 10)' },
      { code: 'PILOT_PROJECT', label: 'Pilot project (Stage 11)' },
      { code: 'COMPETENCE_ASSESSMENT',
        label: 'Competence assessment (Stage 5)' },
      { code: 'CAPABILITY_CERTIFICATION',
        label: 'Capability certification (Stage 5)' }
    ],

    /* Indicator definition lifecycle (scope v1.1 §19/§22). A
       definition is immutable once APPROVED; a formula change
       creates a NEW VERSION (a new record). SUPERSEDED versions are
       preserved for historical, version-pinned computation. */
    indicator_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'PENDING_REVIEW', label: 'Pending review' },
      { code: 'APPROVED', label: 'Approved' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],

    /* Indicator families (scope v1.1 §18 vocabulary categories —
       descriptive groupings, never rankings). */
    indicator_categories: [
      { code: 'HUMAN_CAPABILITY', label: 'Human capability' },
      { code: 'KNOWLEDGE', label: 'Knowledge' },
      { code: 'REPAIR', label: 'Repair' },
      { code: 'RESILIENCE', label: 'Resilience' },
      { code: 'REPRODUCTION', label: 'Reproduction' },
      { code: 'SYSTEMS', label: 'Systems' }
    ],

    /* Observation frequency of an indicator definition. */
    indicator_frequencies: [
      { code: 'PER_CENSUS', label: 'Per census' },
      { code: 'PER_PROJECT', label: 'Per project' },
      { code: 'ANNUAL', label: 'Annual' },
      { code: 'CONTINUOUS', label: 'Continuous' },
      { code: 'AD_HOC', label: 'Ad hoc' }
    ],

    census_observation_review_statuses: [
      { code: 'PENDING', label: 'Pending review' },
      { code: 'ACCEPTED', label: 'Accepted' },
      { code: 'REJECTED', label: 'Rejected' },
      { code: 'SUPERSEDED', label: 'Superseded' }
    ],
    snapshot_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'PUBLISHED', label: 'Published (immutable)' }
    ],
    methodology_statuses: [
      { code: 'DRAFT', label: 'Draft' },
      { code: 'APPROVED', label: 'Approved' },
      { code: 'RETIRED', label: 'Retired' }
    ],
    location_types: [
      { code: 'COUNTRY', label: 'Country' },
      { code: 'REGION', label: 'Region' },
      { code: 'DISTRICT', label: 'District' },
      { code: 'CITY', label: 'City' },
      { code: 'COMMUNITY', label: 'Community' },
      { code: 'SITE', label: 'Site' }
    ],
    /* ---- Stage 7: capability graph ---- */

    /* Relationship lifecycle. One status field, one source of truth.
       UNKNOWN is deliberately NOT a stored status: the absence of an
       edge means "not currently represented", never "proven
       independent". */
    graph_edge_statuses: [
      { code: 'PROPOSED', label: 'Proposed (documented but unreviewed)' },
      { code: 'DOCUMENTED', label: 'Documented (provenance attached)' },
      { code: 'VERIFIED', label: 'Verified (reviewer-confirmed)' },
      { code: 'REJECTED', label: 'Rejected (reviewer outcome)' },
      { code: 'SUPERSEDED', label: 'Superseded (replaced by a new edge)' }
    ],
    /* Scope: a regional observation must never silently become a
       universal national claim. */
    graph_scopes: [
      { code: 'GENERAL', label: 'General (no geographic or contextual narrowing claimed)' },
      { code: 'NATIONAL', label: 'National' },
      { code: 'REGIONAL', label: 'Regional' },
      { code: 'LOCAL', label: 'Local' },
      { code: 'INSTITUTION_SPECIFIC', label: 'Institution-specific' },
      { code: 'TECHNOLOGY_SPECIFIC', label: 'Technology-specific' },
      { code: 'PRACTITIONER_SPECIFIC', label: 'Practitioner-specific' },
      { code: 'CONDITION_SPECIFIC', label: 'Condition-specific' }
    ],
    /* Categorical documentation-quality self-assessment. NOT a
       probability and NOT an invented numerical certainty score. */
    graph_confidence: [
      { code: 'UNASSESSED', label: 'Not assessed' },
      { code: 'LOW', label: 'Low documentation quality' },
      { code: 'MODERATE', label: 'Moderate documentation quality' },
      { code: 'HIGH', label: 'High documentation quality' }
    ],
    census_confidence: [
      { code: 'LOW', label: 'Low' },
      { code: 'MEDIUM', label: 'Medium' },
      { code: 'HIGH', label: 'High' }
    ],

    /* ---- Stage 8: repair & spare-part network ---- */

    /* Controlled failure taxonomy. Free-text explanatory notes may
       accompany a category (failure_category_notes), but a category
       code outside this list is rejected. UNKNOWN means "not yet
       determined", never "no failure". */
    failure_categories: [
      { code: 'MECHANICAL', label: 'Mechanical' },
      { code: 'ELECTRICAL', label: 'Electrical' },
      { code: 'ELECTRONIC', label: 'Electronic' },
      { code: 'STRUCTURAL', label: 'Structural' },
      { code: 'THERMAL', label: 'Thermal' },
      { code: 'HYDRAULIC', label: 'Hydraulic' },
      { code: 'PNEUMATIC', label: 'Pneumatic' },
      { code: 'CORROSION', label: 'Corrosion' },
      { code: 'WEAR', label: 'Wear' },
      { code: 'CONTAMINATION', label: 'Contamination' },
      { code: 'CALIBRATION', label: 'Calibration' },
      { code: 'SOFTWARE_CONTROL', label: 'Software / control' },
      { code: 'FUEL', label: 'Fuel' },
      { code: 'ENVIRONMENTAL', label: 'Environmental' },
      { code: 'OPERATIONAL', label: 'Operational' },
      { code: 'UNKNOWN', label: 'Unknown / not yet determined' }
    ],

    /* Workshop lifecycle. Existence is a documented claim, not an
       assumption: a workshop record is never auto-promoted to
       VERIFIED. INACTIVE/CLOSED are reachable from any active state. */
    workshop_lifecycle: [
      { code: 'UNDOCUMENTED', label: 'Undocumented (placeholder reference only)' },
      { code: 'REPORTED', label: 'Reported (existence reported, not yet documented)' },
      { code: 'DOCUMENTED', label: 'Documented (provenance attached)' },
      { code: 'VERIFIED', label: 'Verified (reviewer-confirmed)' },
      { code: 'INACTIVE', label: 'Inactive (not currently operating)' },
      { code: 'CLOSED', label: 'Closed (ceased operation)' }
    ],

    /* Spare-part compatibility lifecycle. Compatibility requires
       evidence: a part that exists locally is not thereby compatible,
       and similarity never creates compatibility. UNKNOWN is the
       honest default. */
    compatibility_statuses: [
      { code: 'UNKNOWN', label: 'Unknown / not yet assessed' },
      { code: 'REPORTED', label: 'Reported (compatibility claimed, unproven)' },
      { code: 'DOCUMENTED', label: 'Documented (specification evidence attached)' },
      { code: 'TESTED', label: 'Tested (fitment tested and recorded)' },
      { code: 'VERIFIED', label: 'Verified (reviewer-confirmed)' },
      { code: 'REJECTED', label: 'Rejected (documented incompatibility)' }
    ],

    /* Availability is descriptive, never inferred: absence of stock
       data is UNKNOWN, not "unavailable". */
    availability_statuses: [
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' },
      { code: 'IN_STOCK', label: 'Documented in stock' },
      { code: 'LIMITED', label: 'Documented limited availability' },
      { code: 'NOT_STOCKED', label: 'Documented not stocked locally' },
      { code: 'IMPORT_ONLY', label: 'Documented import-only' },
      { code: 'DISCONTINUED', label: 'Documented discontinued' }
    ],

    /* Repair-record review lifecycle. ACCEPTED means "reviewed as
       documentation/evidence", NOT "every technical conclusion in the
       record is scientifically validated". */
    repair_record_statuses: [
      { code: 'DRAFT', label: 'Draft (still being written)' },
      { code: 'SUBMITTED', label: 'Submitted for review' },
      { code: 'UNDER_REVIEW', label: 'Under review' },
      { code: 'ACCEPTED', label: 'Accepted (reviewed as documentation)' },
      { code: 'REJECTED', label: 'Rejected (review outcome)' },
      { code: 'ARCHIVED', label: 'Archived (historical record)' }
    ],

    /* Repair-capability lifecycle mirrors the Stage 7 graph-edge
       lifecycle: provenance-gated, reviewer-verified, never silently
       edited in place once VERIFIED (corrections supersede). */
    repair_capability_statuses: [
      { code: 'PROPOSED', label: 'Proposed (documented claim, unreviewed)' },
      { code: 'DOCUMENTED', label: 'Documented (provenance attached)' },
      { code: 'VERIFIED', label: 'Verified (reviewer-confirmed)' },
      { code: 'REJECTED', label: 'Rejected (retired through review)' },
      { code: 'SUPERSEDED', label: 'Superseded (replaced by a correction)' }
    ],

    /* Which operations a repair capability covers. Capability to
       diagnose, repair, fabricate and test are INDEPENDENT (Principles
       3 and 4): possession of one never implies another. */
    repair_operations: [
      { code: 'DIAGNOSTIC', label: 'Diagnostic capability' },
      { code: 'REPAIR', label: 'Repair capability' },
      { code: 'FABRICATION', label: 'Fabrication capability' },
      { code: 'TESTING', label: 'Testing capability' }
    ],

    /* Competence status for a repair capability. Stage 5 owns
       competence verification: ASSESSED/VERIFIED can only be set by
       linking an existing Stage 5 assessment/certification, never by
       self-declaration, and years of experience NEVER substitute. */
    repair_competence_statuses: [
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' },
      { code: 'REPORTED', label: 'Reported (practitioner-reported, unverified)' },
      { code: 'ASSESSED', label: 'Assessed (linked Stage 5 assessment)' },
      { code: 'VERIFIED', label: 'Verified (linked Stage 5 certification)' }
    ],

    /* Contact visibility for workshops. Private contact information is
       never exposed publicly. */
    contact_visibility: [
      { code: 'PUBLIC', label: 'Public contact information' },
      { code: 'RESTRICTED', label: 'Contact restricted to signed-in staff' }
    ],

    /* Hazard metadata (Stage 8 safety). Controlled categories plus
       free-text safety notes; detailed procedures on hazardous
       repairs are not published to anonymous users. */
    hazard_types: [
      { code: 'ELECTRICAL', label: 'Electrical hazard' },
      { code: 'PRESSURE', label: 'Pressure hazard' },
      { code: 'MECHANICAL', label: 'Mechanical hazard' },
      { code: 'HEAT_FIRE', label: 'Heat / fire hazard' },
      { code: 'HAZARDOUS_MATERIAL', label: 'Hazardous material' },
      { code: 'ENVIRONMENTAL', label: 'Environmental hazard' }
    ],

    /* Local fabrication possibility for a part or tool: decomposed and
       evidence-backed, never a single assumed boolean (the full
       fabrication pathway is inspected step by step by the workflow). */
    fabrication_possibilities: [
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' },
      { code: 'REPORTED_POSSIBLE', label: 'Reported possible (unproven)' },
      { code: 'DOCUMENTED_POSSIBLE', label: 'Documented possible (evidence attached)' },
      { code: 'DOCUMENTED_NOT_POSSIBLE', label: 'Documented not possible' }
    ],

    /* Operating status of a workshop: descriptive, not a judgment. */
    workshop_operating_statuses: [
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' },
      { code: 'FULL_TIME', label: 'Full-time operation' },
      { code: 'PART_TIME', label: 'Part-time / seasonal operation' },
      { code: 'MOBILE', label: 'Mobile / itinerant operation' }
    ],

    /* =================== Stage 9: Failure & Recovery =================== */

    /* Recovery kinds (frozen Stage 9 scope v2.1). Exactly five: a
       recovery profile documents ONE recovery target of ONE kind —
       multiple targets require multiple profiles. The kind decides
       which target collections are valid (enforced by the workflow). */
    recovery_kinds: [
      { code: 'FALLBACK_CAPABILITY', label: 'Fallback capability (another capability that can substitute)' },
      { code: 'REPAIR_NETWORK', label: 'Repair network (a Stage 8 repair capability)' },
      { code: 'SUBSTITUTION', label: 'Substitution (spare part, material, tool or capability)' },
      { code: 'FABRICATION', label: 'Fabrication (fabrication-capable repair capability or workshop)' },
      { code: 'EXTERNAL_SUPPORT', label: 'External support (an organization)' }
    ],

    /* RecoveryProfile lifecycle (frozen Stage 9 scope v2.1). Mirrors
       the Stage 7 graph-edge / Stage 8 repair-capability lifecycle:
       provenance-gated, reviewer-verified, never edited in place once
       VERIFIED (corrections supersede). There is deliberately NO
       RETIRED state: administrative retirement uses REJECTED with an
       explicit reason (audited retirement, never silent deletion). */
    recovery_statuses: [
      { code: 'PROPOSED', label: 'Proposed (documented claim, unreviewed)' },
      { code: 'DOCUMENTED', label: 'Documented (provenance attached)' },
      { code: 'VERIFIED', label: 'Verified (reviewer-confirmed)' },
      { code: 'REJECTED', label: 'Rejected (review outcome or audited administrative retirement)' },
      { code: 'SUPERSEDED', label: 'Superseded (replaced by a correction)' }
    ],

    /* Recovery target types. The target of a RecoveryProfile is a
       reference into an EXISTING record of another stage's collection —
       never a new parallel entity. Which of these is valid depends on
       the recovery kind (workflow-enforced). */
    recovery_target_types: [
      { code: 'CAPABILITY', label: 'Capability (Stage 2 inventory)' },
      { code: 'REPAIR_CAPABILITY', label: 'Repair capability (Stage 8)' },
      { code: 'WORKSHOP', label: 'Workshop (Stage 8)' },
      { code: 'SPARE_PART', label: 'Spare part (Stage 8)' },
      { code: 'MATERIAL', label: 'Material (Stage 8)' },
      { code: 'TOOL', label: 'Tool (Stage 8)' },
      { code: 'ORGANIZATION', label: 'Organization (Stage 5)' }
    ],

    /* Impact basis classification (frozen Stage 9 scope v2.1). A
       statement about the impact of a failure is classified by HOW it
       is known, never by a score. UNKNOWN means "not yet documented",
       never "no impact". */
    impact_bases: [
      { code: 'DIRECT_DOCUMENTED', label: 'Directly documented (explicit reviewed relationship or documentation)' },
      { code: 'GRAPH_DERIVED', label: 'Graph-derived (derived from dependency structure, not asserted as certain)' },
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' }
    ],

    /* =================== Stage 10: Capability Intervention =================== */

    /* Intervention lifecycle (frozen Stage 10 scope v1.1). This is a
       PLANNING record, not an evidence record: propose, submit (edit
       lock), review, approve, activate, complete. COMPLETION MEANS
       ONLY THAT THE ACTIVITY ENDED — never that the outcome was
       successful: outcome status is a separate reviewer-governed
       field. UNDER_REVIEW -> DRAFT is a return for correction (not a
       rejection); a true discard is UNDER_REVIEW -> CANCELLED.
       COMPLETED and CANCELLED are terminal: historical records are
       never edited in place and may keep unresolvable references by
       the established transfer exemption. */
    intervention_statuses: [
      { code: 'DRAFT', label: 'Draft (editable planning state)' },
      { code: 'SUBMITTED', label: 'Submitted (substantive editing locked)' },
      { code: 'UNDER_REVIEW', label: 'Under review (reviewer-controlled)' },
      { code: 'APPROVED', label: 'Approved (authorized for implementation)' },
      { code: 'ACTIVE', label: 'Active (implementation underway)' },
      { code: 'SUSPENDED', label: 'Suspended (temporarily stopped, may resume)' },
      { code: 'COMPLETED', label: 'Completed (activity ended; outcome NOT implied)' },
      { code: 'CANCELLED', label: 'Cancelled (terminated, reason required)' }
    ],

    /* Outcome status (frozen Stage 10 scope v1.1): categorical and
       reviewer-governed, NEVER a score, NEVER a percentage, NEVER
       self-declared by the implementer. UNKNOWN is the honest default
       and COMPLETED + UNKNOWN is a valid state: absence of outcome
       evidence is unknown, never "successful" or "failed". */
    intervention_outcomes: [
      { code: 'UNKNOWN', label: 'Unknown / not yet assessed' },
      { code: 'SUCCESSFUL', label: 'Successful (reviewer-assessed on outcome evidence)' },
      { code: 'MIXED', label: 'Mixed (partially successful on outcome evidence)' },
      { code: 'UNSUCCESSFUL', label: 'Unsuccessful (reviewer-assessed)' },
      { code: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence (cannot be assessed honestly)' }
    ],

    /* Intervention types (frozen Stage 10 scope v1.1): a FLAT
       controlled vocabulary. The scope's two-level categories
       (knowledge, people, infrastructure, repair, production,
       resilience, modernization, validation) are expressed as
       composite CATEGORY_SUBTYPE codes — the same convention as
       recovery_kinds — because enums never contain free text. These
       are classification labels ONLY: they carry no evaluative
       meaning, no priority, and no ranking. */
    intervention_types: [
      { code: 'KNOWLEDGE_DOCUMENTATION', label: 'Knowledge: documentation' },
      { code: 'KNOWLEDGE_ARCHIVAL', label: 'Knowledge: archival' },
      { code: 'KNOWLEDGE_VALIDATION', label: 'Knowledge: validation' },
      { code: 'KNOWLEDGE_TRANSLATION', label: 'Knowledge: translation' },
      { code: 'KNOWLEDGE_TRANSMISSION', label: 'Knowledge: transmission' },
      { code: 'PEOPLE_APPRENTICESHIP', label: 'People: apprenticeship' },
      { code: 'PEOPLE_TECHNICIAN_TRAINING', label: 'People: technician training' },
      { code: 'PEOPLE_TRAINER_DEVELOPMENT', label: 'People: trainer development' },
      { code: 'PEOPLE_PRACTITIONER_SUCCESSION', label: 'People: practitioner succession' },
      { code: 'INFRASTRUCTURE_WORKSHOP', label: 'Infrastructure: workshop' },
      { code: 'INFRASTRUCTURE_WATER_SYSTEM', label: 'Infrastructure: water system' },
      { code: 'INFRASTRUCTURE_STORAGE', label: 'Infrastructure: storage' },
      { code: 'INFRASTRUCTURE_PROCESSING', label: 'Infrastructure: processing' },
      { code: 'INFRASTRUCTURE_COMMUNICATIONS', label: 'Infrastructure: communications' },
      { code: 'INFRASTRUCTURE_ENERGY', label: 'Infrastructure: energy' },
      { code: 'INFRASTRUCTURE_TRANSPORT', label: 'Infrastructure: transport' },
      { code: 'REPAIR_CAPACITY', label: 'Repair: repair capacity' },
      { code: 'REPAIR_MAINTENANCE', label: 'Repair: maintenance' },
      { code: 'REPAIR_SPARE_PARTS', label: 'Repair: spare parts' },
      { code: 'REPAIR_LOCAL_FABRICATION', label: 'Repair: local fabrication' },
      { code: 'REPAIR_TOOLING', label: 'Repair: tooling' },
      { code: 'PRODUCTION_LOCAL_MANUFACTURING', label: 'Production: local manufacturing' },
      { code: 'PRODUCTION_MATERIAL_SUBSTITUTION', label: 'Production: material substitution' },
      { code: 'PRODUCTION_EQUIPMENT_PRODUCTION', label: 'Production: equipment production' },
      { code: 'RESILIENCE_FALLBACK_SYSTEM', label: 'Resilience: fallback system' },
      { code: 'RESILIENCE_REDUNDANCY', label: 'Resilience: redundancy' },
      { code: 'RESILIENCE_EMERGENCY_RESERVE', label: 'Resilience: emergency reserve' },
      { code: 'RESILIENCE_GEOGRAPHIC_DIVERSIFICATION', label: 'Resilience: geographic diversification' },
      { code: 'MODERNIZATION_TECHNOLOGY_IMPROVEMENT', label: 'Modernization: technology improvement' },
      { code: 'MODERNIZATION_HYBRID_SYSTEM', label: 'Modernization: hybrid system' },
      { code: 'MODERNIZATION_EFFICIENCY_IMPROVEMENT', label: 'Modernization: efficiency improvement' },
      { code: 'MODERNIZATION_SAFETY_IMPROVEMENT', label: 'Modernization: safety improvement' },
      { code: 'VALIDATION_FIELD_MEASUREMENT', label: 'Validation: field measurement / research activity' },
      { code: 'VALIDATION_LABORATORY', label: 'Validation: laboratory validation' },
      { code: 'VALIDATION_TECHNICAL_COMPARISON', label: 'Validation: technical comparison' },
      { code: 'VALIDATION_CONTROLLED_PILOT', label: 'Validation: controlled pilot' }
    ],

    /* Critical human roles on an intervention (Stage 10
       successor-before-launch). Presence-of-value semantics: an
       UNKNOWN entry is honest and passes the approval gate; a blank
       field does not. IDENTIFIED requires a canonical Stage 5
       practitioner reference that must resolve. */
    intervention_role_statuses: [
      { code: 'IDENTIFIED', label: 'Identified (canonical practitioner reference)' },
      { code: 'UNKNOWN', label: 'Unknown / not yet identified' }
    ],

    /* =================== Stage 11: Regional Capability Pilots =================== */

    /* Pilot lifecycle (frozen Stage 11 scope v1.1). A pilot is a
       COORDINATION record, never a governance record: it has NO
       outcome field of any kind. PROPOSED -> APPROVED requires the
       existing administrative authority with creator/approver
       separation (an APPROVED pilot may legitimately have zero
       constituents: plan-first). APPROVED -> ACTIVE requires at
       least ONE valid constituent activity (an intervention, an
       organization, a workshop or a training program — standalone
       pilots are legitimate; an empty pilot is not). ACTIVE ->
       CONCLUDED is an administrative terminal state that NEVER
       implies success. CANCELLED is reachable from PROPOSED, APPROVED
       and ACTIVE (reason required, audited). CONCLUDED and CANCELLED
       are terminal and immutable: no resurrection, and there is no
       RETIRED pilot state. */
    pilot_statuses: [
      { code: 'PROPOSED', label: 'Proposed (planning, fully editable)' },
      { code: 'APPROVED', label: 'Approved (authorized; may be empty plan-first)' },
      { code: 'ACTIVE', label: 'Active (execution coordinated; has constituents)' },
      { code: 'CONCLUDED', label: 'Concluded (terminal, immutable; outcome NOT implied)' },
      { code: 'CANCELLED', label: 'Cancelled (terminal, immutable, reason required)' }
    ],

    /* Stage 13: Capability Marketplace (frozen scope v1.0 §6 +
       authorization §6). Exactly the twelve frozen service kinds —
       no additional value may be introduced without a future scope
       amendment. Never free text. */
    marketplace_service_kinds: [
      { code: 'REPAIR', label: 'Repair' },
      { code: 'MAINTENANCE', label: 'Maintenance' },
      { code: 'TRAINING', label: 'Training' },
      { code: 'APPRENTICESHIP_HOSTING', label: 'Apprenticeship hosting' },
      { code: 'TECHNICAL_ASSISTANCE', label: 'Technical assistance' },
      { code: 'FABRICATION', label: 'Fabrication' },
      { code: 'LOCAL_PRODUCTION', label: 'Local production' },
      { code: 'AGRICULTURAL_SERVICES', label: 'Agricultural services' },
      { code: 'FISHERIES_SERVICES', label: 'Fisheries services' },
      { code: 'WATER_SERVICES', label: 'Water services' },
      { code: 'ENVIRONMENTAL_KNOWLEDGE', label: 'Environmental knowledge' },
      { code: 'RESEARCH_FIELD_SERVICES', label: 'Research / field services' }
    ],

    /* Listing kinds (frozen scope v1.0 §3): one record shape, two
       kinds. Matching pairs published OFFERs with published NEEDs. */
    marketplace_listing_kinds: [
      { code: 'OFFER', label: 'Offer (a service can be provided)' },
      { code: 'NEED', label: 'Need (a service is being looked for)' }
    ],

    /* Polymorphic provider types (authorization §4): EXISTING
       frozen entities only — Stage 13 never manufactures provider
       identity and never creates a marketplace provider record. */
    marketplace_provider_types: [
      { code: 'PRACTITIONER', label: 'Practitioner (Stage 5)' },
      { code: 'ORGANIZATION', label: 'Organization (Stage 5)' },
      { code: 'WORKSHOP', label: 'Workshop (Stage 8)' },
      { code: 'TRAINING_PROGRAM', label: 'Training program (Stage 5)' }
    ],

    /* Location scope (authorization §8): SPECIFIC requires at least
       one valid canonical location reference; ANYWHERE does not
       require one. No radius, no distance, no inferred locations. */
    marketplace_location_scopes: [
      { code: 'SPECIFIC', label: 'Specific documented location(s)' },
      { code: 'ANYWHERE', label: 'Not location-bound' }
    ],

    /* Declared availability (authorization §7): exactly the five
       frozen values, default UNKNOWN. Declared information only —
       never a calendar, booking or scheduling system. */
    marketplace_availability: [
      { code: 'BY_ARRANGEMENT', label: 'By arrangement' },
      { code: 'SCHEDULED_WINDOWS', label: 'Scheduled windows' },
      { code: 'SEASONAL', label: 'Seasonal' },
      { code: 'LIMITED', label: 'Limited' },
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' }
    ],

    /* Marketplace lifecycle (frozen scope v1.0 §9 + authorization
       §9): DRAFT -> SUBMITTED -> PUBLISHED with PUBLISHED <-> PAUSED,
       SUBMITTED -> REJECTED and PUBLISHED/PAUSED -> WITHDRAWN.
       REJECTED and WITHDRAWN are terminal and immutable. NO
       automatic transitions: provider retirement renders honestly
       and is handled by humans through PAUSE/WITHDRAW. */
    marketplace_statuses: [
      { code: 'DRAFT', label: 'Draft (editable, offline, never public)' },
      { code: 'SUBMITTED', label: 'Submitted (locked, awaiting review)' },
      { code: 'PUBLISHED', label: 'Published (independent review passed)' },
      { code: 'PAUSED', label: 'Paused (reversible, audited; absent from matching)' },
      { code: 'REJECTED', label: 'Rejected (terminal, immutable, reason required)' },
      { code: 'WITHDRAWN', label: 'Withdrawn (terminal, immutable, reason required)' }
    ],

    /* Stage 14: National Capability Reserve & Institutional
       Continuity (frozen scope v1.1 + Gate C authorization).
       Exactly the frozen vocabularies — no additional value may be
       introduced without a future scope amendment. Never free
       text. No scores, no rankings, no probabilities. */

    /* Reserve lifecycle (frozen §6/§9): DRAFT -> SUBMITTED ->
       VERIFIED -> ACTIVE <-> SUSPENDED, plus SUBMITTED -> REJECTED
       and ACTIVE/SUSPENDED -> RETIRED. REJECTED and RETIRED are
       terminal and immutable. VERIFIED = the reserve definition
       passed review; ACTIVE = the reserve additionally has a
       documented custodian and is formally maintained. NO
       automatic transitions of any kind. */
    reserve_statuses: [
      { code: 'DRAFT', label: 'Draft (editable, offline)' },
      { code: 'SUBMITTED', label: 'Submitted (locked, awaiting review)' },
      { code: 'VERIFIED', label: 'Verified (review passed; stewardship not yet confirmed)' },
      { code: 'ACTIVE', label: 'Active (documented custodian; formally maintained)' },
      { code: 'SUSPENDED', label: 'Suspended (reversible; maintenance paused)' },
      { code: 'REJECTED', label: 'Rejected (terminal, immutable, reason required)' },
      { code: 'RETIRED', label: 'Retired (terminal, immutable, reason required)' }
    ],

    /* Reserve types (frozen §3): a reserve may contain MULTIPLE
       types (reserve_types is an array). */
    reserve_types: [
      { code: 'HUMAN_RESERVE', label: 'Human reserve (people who can perform or teach)' },
      { code: 'KNOWLEDGE_RESERVE', label: 'Knowledge reserve (documented knowledge and procedures)' },
      { code: 'TECHNICAL_RESERVE', label: 'Technical reserve (tools, workshops, repair, fabrication)' },
      { code: 'MATERIAL_RESERVE', label: 'Material reserve (materials and substitutes)' },
      { code: 'BIOLOGICAL_RESERVE', label: 'Biological reserve (seeds, breeds, biological resources)' },
      { code: 'INSTITUTIONAL_RESERVE', label: 'Institutional reserve (organizations, training structures, memory)' },
      { code: 'GEOGRAPHIC_RESERVE', label: 'Geographic reserve (independent capability in multiple locations)' },
      { code: 'FALLBACK_RESERVE', label: 'Fallback reserve (lower-technology or alternative pathways)' }
    ],

    /* ContinuityPlan lifecycle (frozen §10): DRAFT -> SUBMITTED ->
       REVIEWED -> ACTIVE, plus SUBMITTED -> REJECTED and
       ACTIVE -> RETIRED. No SUSPENDED state. REJECTED and RETIRED
       are terminal and immutable. A plan is a documented continuity
       design; it never implies the capability IS resilient. */
    continuity_plan_statuses: [
      { code: 'DRAFT', label: 'Draft (editable, offline)' },
      { code: 'SUBMITTED', label: 'Submitted (locked, awaiting review)' },
      { code: 'REVIEWED', label: 'Reviewed (plan definition accepted by review)' },
      { code: 'ACTIVE', label: 'Active (designated as the active continuity plan)' },
      { code: 'REJECTED', label: 'Rejected (terminal, immutable, reason required)' },
      { code: 'RETIRED', label: 'Retired (terminal, immutable, reason required)' }
    ],

    /* Six-Month Failure Test scenarios (frozen §12): dependency-
       availability scenarios for examination. They document what
       should be examined; they never predict outcomes and never
       calculate failure probability. Stage 8 FailureScenario
       remains authoritative for equipment/system failure modes. */
    disruption_scenarios: [
      { code: 'IMPORTS_UNAVAILABLE_6_MONTHS', label: 'Imports unavailable for six months' },
      { code: 'ELECTRICITY_UNAVAILABLE_72_HOURS', label: 'Electricity unavailable for 72 hours' },
      { code: 'INTERNET_UNAVAILABLE_30_DAYS', label: 'Internet unavailable for 30 days' },
      { code: 'FUEL_UNAVAILABLE', label: 'Fuel unavailable' },
      { code: 'EXTERNAL_TECHNICIANS_UNAVAILABLE', label: 'External technicians unavailable' },
      { code: 'CRITICAL_KNOWLEDGE_HOLDER_UNAVAILABLE', label: 'Critical knowledge-holder unavailable' }
    ],

    /* Known gaps (frozen §17): a documented observed condition,
       never a score. Embedded in the owning ContinuityPlan/Reserve;
       no separate gap entity. */
    continuity_gaps: [
      { code: 'NO_TRAINER', label: 'No trainer documented' },
      { code: 'NO_APPRENTICE', label: 'No apprentice documented' },
      { code: 'SINGLE_KNOWLEDGE_HOLDER', label: 'Single documented knowledge-holder' },
      { code: 'NO_DOCUMENTATION', label: 'No documentation documented' },
      { code: 'NO_LOCAL_REPAIR', label: 'No local repair pathway documented' },
      { code: 'NO_SPARE_PART', label: 'No spare part documented' },
      { code: 'NO_FALLBACK', label: 'No fallback pathway documented' },
      { code: 'SINGLE_LOCATION', label: 'Single documented location' },
      { code: 'EXTERNAL_TECHNICIAN_DEPENDENCY', label: 'External-technician dependency documented' },
      { code: 'EXTERNAL_MATERIAL_DEPENDENCY', label: 'External-material dependency documented' },
      { code: 'ENERGY_DEPENDENCY', label: 'Energy dependency documented' },
      { code: 'INSTITUTIONAL_GAP', label: 'Institutional gap documented' },
      { code: 'UNKNOWN', label: 'Unknown / not yet documented' }
    ],

    /* CapabilityAsset categories (frozen §7): thirteen values.
       Each category references EXISTING authoritative records via
       its frozen source mapping; BIOLOGICAL may be documentation-
       only where no authoritative biological record exists. */
    asset_categories: [
      { code: 'HUMAN', label: 'Human (Stage 5 practitioner/apprentice)' },
      { code: 'KNOWLEDGE', label: 'Knowledge (Stage 3 knowledge/evidence)' },
      { code: 'TOOL', label: 'Tool (Stage 8)' },
      { code: 'EQUIPMENT', label: 'Equipment (Stage 8 authoritative reference where available)' },
      { code: 'MATERIAL', label: 'Material (Stage 8)' },
      { code: 'SPARE_PART', label: 'Spare part (Stage 8)' },
      { code: 'DOCUMENTATION', label: 'Documentation (Stage 3 knowledge/evidence)' },
      { code: 'TRAINING', label: 'Training (Stage 5 training program)' },
      { code: 'WORKSHOP', label: 'Workshop (Stage 8)' },
      { code: 'INSTITUTION', label: 'Institution (Stage 5 organization)' },
      { code: 'BIOLOGICAL', label: 'Biological (authoritative record if available)' },
      { code: 'ENERGY', label: 'Energy (energy source authority)' },
      { code: 'FALLBACK_CAPABILITY', label: 'Fallback capability (Stage 1 capability)' }
    ],

    /* Three-Generation Test states (frozen §15): DERIVED read-only
       from Stage 5 reproduction data; never persisted, never
       manually edited, never a separate entity or score. */
    three_generation_states: [
      { code: 'NOT_DOCUMENTED', label: 'Not documented' },
      { code: 'PRACTITIONER_ONLY', label: 'Practitioner documented only' },
      { code: 'TRAINER_PRESENT', label: 'Trainer documented' },
      { code: 'APPRENTICE_PRESENT', label: 'Apprentice documented' },
      { code: 'COMPETENT_SUCCESSOR', label: 'Competent successor documented' },
      { code: 'TRAINER_SUCCESSOR', label: 'Trainer-ready successor documented' },
      { code: 'REPRODUCTION_DOCUMENTED', label: 'Reproduction pathway documented end to end' }
    ],

    label: function (list, code) {
      var e = find(list, code);
      return e ? e.label : null;
    },
    codes: function (list) {
      return list.map(function (e) { return e.code; });
    },
    optionList: function (list) {
      /* For selects: code + label, e.g. "E3 — Documented". */
      return list.map(function (e) { return { value: e.code, label: e.code + ' — ' + e.label }; });
    }
  };
})(SCA);
