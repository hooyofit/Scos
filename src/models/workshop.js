/*
 * Workshop model (Stage 8, operationalized from the Stage 7
 * registry-grade record).
 *
 * Principle 2: workshop EXISTENCE is not workshop COMPETENCE. This
 * record documents that a workshop exists (with its own evidence
 * lifecycle: UNDOCUMENTED -> REPORTED -> DOCUMENTED -> VERIFIED, plus
 * INACTIVE/CLOSED). What a workshop can actually repair is documented
 * SEPARATELY, one RepairCapability at a time. A workshop record never
 * means "can repair everything in its category".
 *
 * No fabricated data: every field defaults to honest documentation;
 * unknown means UNKNOWN, never an invented service list.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'workshops',
    required: ['name'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      notes: { type: 'string' },

      organization_id: { type: 'string' },
      location_id: { type: 'string' },
      region_ids: { type: 'array' },

      /* Descriptive service lists: what the workshop REPORTS/what is
       * documented it offers — never a claim of competence per asset. */
      services: { type: 'array' },
      supported_asset_types: { type: 'array' },
      supported_models: { type: 'array' },

      /* Links maintained by the repair workflow as capabilities are
       * documented/superseded; competence lives in RepairCapability. */
      repair_capability_ids: { type: 'array' },
      practitioner_ids: { type: 'array' },
      tool_ids: { type: 'array' },
      material_ids: { type: 'array' },

      /* Convenience mirrors of the linked repair capabilities (per
       * operation kind). These are VIEWS over RepairCapability records,
       * maintained by the workflow — never independently editable
       * claims. Null means "not yet documented". */
      diagnostic_capabilities: { type: 'string' },
      repair_capabilities: { type: 'string' },
      fabrication_capabilities: { type: 'string' },
      testing_capabilities: { type: 'string' },

      apprentice_capacity: { type: 'string' },

      operating_status: { type: 'string', enum: 'workshop_operating_statuses' },
      availability: { type: 'string' },

      status: { type: 'string', enum: 'workshop_lifecycle' },
      verification_reason: { type: 'string' },
      documentation_status: { type: 'string' },

      contact_visibility: { type: 'string', enum: 'contact_visibility' },
      public_visibility: { type: 'boolean' },
      contact_name: { type: 'string' },
      contact_details: { type: 'string' },

      source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      field_observation_ids: { type: 'array' },

      limitations: { type: 'string' },
      safety_notes: { type: 'string' },

      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.workshop = m;
  SCA.models.workshops = m;
})(SCA);
