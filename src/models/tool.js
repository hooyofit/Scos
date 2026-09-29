/*
 * Tool / Equipment model (Stage 8, operationalized from the Stage 7
 * registry-grade record).
 *
 * Tools that repairs require, workshops hold, and capabilities depend
 * on. A tool record documents the tool and its documented condition —
 * it does NOT imply every workshop listed holds it in working order
 * right now (availability and condition are separate documented
 * fields, defaulting to UNKNOWN).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'tools',
    required: ['name'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      notes: { type: 'string' },
      tool_type: { type: 'string' },

      workshop_ids: { type: 'array' },
      location_ids: { type: 'array' },

      specifications: { type: 'string' },
      supported_operations: { type: 'array' },
      supported_asset_types: { type: 'array' },

      /* Descriptive, never invented: quantity is text because units
       * vary (pieces, sets, meters). */
      quantity: { type: 'string' },
      availability_status: { type: 'string', enum: 'availability_statuses' },
      condition: { type: 'string' },

      maintenance_requirements: { type: 'string' },
      fabrication_possible: { type: 'string', enum: 'fabrication_possibilities' },

      status: { type: 'string' },
      source_ids: { type: 'array' },
      limitations: { type: 'string' },
      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.tool = m;
  SCA.models.tools = m;
})(SCA);
