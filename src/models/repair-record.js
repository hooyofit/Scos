/*
 * Repair Record model (Stage 8).
 *
 * A RepairRecord is HISTORICAL DOCUMENTATION of one repair event: what
 * failed, how it was diagnosed, who repaired it, with what tools,
 * materials and parts, and what happened. It is NOT automatically a
 * validated engineering procedure, and it never upgrades capability
 * evidence by itself (ACCEPTED means "reviewed as documentation", per
 * the Stage 8 specification).
 *
 * Lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> ACCEPTED / REJECTED,
 * ARCHIVED as the historical end-state. Only authorized reviewers move
 * a record to ACCEPTED, with an explicit reason, through the audited
 * workflow.
 *
 * Diagnosis is recorded independently from repair (Principle 3), and
 * substitutes/fabrication are recorded explicitly so a completed repair
 * also documents substitute-part and fabrication knowledge
 * (Principle 8).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'repair_records',
    required: ['asset_type', 'asset_id', 'date'],
    fields: {
      asset_type: { type: 'string' },
      asset_id: { type: 'string' },

      location_id: { type: 'string' },
      region_id: { type: 'string' },

      date: { type: 'string' },

      failure_type: { type: 'string', enum: 'failure_categories' },
      failure_category_notes: { type: 'string' },
      failure_scenario_id: { type: 'string' },

      symptoms: { type: 'string' },
      diagnosis: { type: 'string' },
      root_cause: { type: 'string' },

      repair_action: { type: 'string' },

      /* Person references: protected by the repair privacy model —
         technician and apprentice identities are only resolvable by
         users with repair person visibility, never anonymous. */
      technician_ids: { type: 'array' },
      workshop_id: { type: 'string' },

      tools_used: { type: 'array' },
      materials_used: { type: 'array' },
      parts_used: { type: 'array' },
      substitutes_used: { type: 'array' },
      substitute_notes: { type: 'string' },

      repair_time: { type: 'string' },
      downtime: { type: 'string' },
      repair_cost: { type: 'string' },

      external_dependency: { type: 'string' },
      local_substitute: { type: 'boolean' },
      fabrication_used: { type: 'boolean' },

      test_result: { type: 'string' },
      return_to_service: { type: 'boolean' },

      lesson: { type: 'string' },
      knowledge_artifact_id: { type: 'string' },

      apprentice_ids: { type: 'array' },
      apprentice_participation_notes: { type: 'string' },

      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },
      ppe_requirements: { type: 'string' },
      qualification_requirements: { type: 'string' },

      source_ids: { type: 'array' },

      review_status: { type: 'string', enum: 'repair_record_statuses' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.repair_record = m;
  SCA.models.repair_records = m;
})(SCA);
