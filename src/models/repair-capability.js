/*
 * Repair Capability model (Stage 8).
 *
 * THE central Stage 8 distinction: a repair capability is a specific,
 * documented claim about WHAT a workshop (or practitioner) can do to a
 * specific asset — never inferred from a job title, a workshop category
 * or years of experience.
 *
 *   "Workshop A can repair Pump Model X" — expressible.
 *   "Workshop A can repair all pumps" — NOT expressible by this record.
 *
 * Diagnosis, repair, fabrication and testing are independent operations
 * (Principles 3 and 4): each is a separate boolean, never inferred from
 * the others.
 *
 * Lifecycle mirrors the frozen Stage 7 graph-edge lifecycle:
 * PROPOSED -> DOCUMENTED -> VERIFIED, with REJECTED/SUPERSEDED as
 * audited retirement. A VERIFIED repair capability is never silently
 * edited in place: corrections supersede through the workflow.
 *
 * No fabricated data: every field defaults to honest documentation.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'repair_capabilities',
    required: ['workshop_id', 'asset_type', 'asset_id'],
    fields: {
      /* Where this capability is anchored. Either the workshop or at
         least one practitioner must be documented; a floating
         capability with neither is an integrity error. */
      workshop_id: { type: 'string' },
      practitioner_ids: { type: 'array' },

      /* The specific asset: asset_type is a Stage 7 graph node type
         (CAPABILITY, TOOL, WORKSHOP, ENERGY_SOURCE, LOCATION) and
         asset_id references that canonical collection. Canonical
         references only — the graph and the repair network share the
         same entity space; no duplicate asset records. */
      asset_type: { type: 'string' },
      asset_id: { type: 'string' },
      manufacturer: { type: 'string' },
      model: { type: 'string' },

      /* Independent operations (Principles 3 and 4). */
      diagnostic_capability: { type: 'boolean' },
      repair_operations: { type: 'array' },
      fabrication_capability: { type: 'boolean' },
      testing_capability: { type: 'boolean' },

      competence_status: { type: 'string', enum: 'repair_competence_statuses' },
      linked_assessment_id: { type: 'string' },
      linked_certification_id: { type: 'string' },

      supported_conditions: { type: 'string' },
      limitations: { type: 'string' },
      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },
      region_ids: { type: 'array' },

      /* Provenance: without it a capability may exist as PROPOSED but
         must not become DOCUMENTED or VERIFIED. */
      evidence_source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      field_observation_ids: { type: 'array' },

      status: { type: 'string', enum: 'repair_capability_statuses' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      supersedes_id: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.repair_capability = m;
  SCA.models.repair_capabilities = m;
})(SCA);
