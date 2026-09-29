/*
 * Spare Part model (Stage 8).
 *
 * Principle 5: availability is NOT compatibility. Principle 6: similar
 * is NOT compatible — no compatibility relationship is ever created
 * from visual or naming similarity or assumption. Compatibility is a
 * separately documented, evidence-backed claim with its own lifecycle:
 * UNKNOWN -> REPORTED -> DOCUMENTED -> TESTED -> VERIFIED (REJECTED
 * documents known incompatibility).
 *
 * A part is NOT a Stage 7 graph node type. Per the Stage 8
 * specification, compatibility between a part and an asset is NOT a
 * graph relationship: it lives on this record (asset_type/asset_ids +
 * compatibility_status) as structured references with their own
 * verification, while the graph remains the authoritative relationship
 * system for workshop/capability/failure semantics.
 *
 * Stock counts are honest: missing data is UNKNOWN (null), never zero.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'spare_parts',
    required: ['name'],
    fields: {
      name: { type: 'string' },
      part_number: { type: 'string' },
      manufacturer: { type: 'string' },
      manufacturer_part_number: { type: 'string' },

      /* Which canonical assets this part is documented for. asset_type
         is a Stage 7 graph node type; asset_ids reference that
         canonical collection. */
      asset_type: { type: 'string' },
      asset_ids: { type: 'array' },
      models: { type: 'array' },

      function: { type: 'string' },
      specification: { type: 'string' },
      required_quantity: { type: 'string' },

      /* Stock data: descriptive counts as text (units vary: pieces,
         sets, litres). Missing stock data stays null = UNKNOWN. */
      local_stock: { type: 'string' },
      regional_stock: { type: 'string' },
      stock_locations: { type: 'array' },

      supplier_ids: { type: 'array' },
      import_sources: { type: 'string' },

      alternative_part_ids: { type: 'array' },
      substitute_material_ids: { type: 'array' },
      substitution_notes: { type: 'string' },

      /* Local fabrication pathway (Principle 4: repair is not
       * fabrication). Fabrication is decomposed, never a boolean
       * "locally manufacturable". */
      fabrication_possible: { type: 'string', enum: 'fabrication_possibilities' },
      fabrication_specification: { type: 'string' },
      drawing_artifact_ids: { type: 'array' },
      tooling_requirements: { type: 'string' },
      compatible_workshop_ids: { type: 'array' },

      cost: { type: 'string' },
      lead_time: { type: 'string' },

      availability_status: { type: 'string', enum: 'availability_statuses' },
      compatibility_status: { type: 'string', enum: 'compatibility_statuses' },
      compatibility_notes: { type: 'string' },
      last_verified: { type: 'string' },

      status: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },

      source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },

      limitations: { type: 'string' },
      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.spare_part = m;
  SCA.models.spare_parts = m;
})(SCA);
