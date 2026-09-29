/*
 * Material model (Stage 8, operationalized from the Stage 7
 * registry-grade record).
 *
 * Principle: "material exists" is NOT "material is suitable". Existence
 * (availability, locations, suppliers) and suitability (for which
 * repairs/parts, with what specification and substitution role) are
 * separate documented claims, each defaulting to UNKNOWN.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'materials',
    required: ['name'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      notes: { type: 'string' },
      material_type: { type: 'string' },
      specification: { type: 'string' },

      availability_status: { type: 'string', enum: 'availability_statuses' },
      stock_locations: { type: 'array' },
      supplier_ids: { type: 'array' },

      /* Suitability references: documented, never inferred from
       * existence. */
      supported_repairs: { type: 'array' },
      supported_parts: { type: 'array' },

      substitution_role: { type: 'string' },

      fabrication_use: { type: 'string' },
      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },

      status: { type: 'string' },
      source_ids: { type: 'array' },
      limitations: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.material = m;
  SCA.models.materials = m;
})(SCA);
