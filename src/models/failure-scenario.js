/*
 * Failure Scenario model (Stage 8, operationalized from the Stage 7
 * registry-grade record; the fuller failure & recovery SYSTEM remains
 * Stage 9).
 *
 * A documented failure scenario: a category (controlled taxonomy,
 * free-text explanatory notes allowed), symptoms, conditions, possible
 * causes, diagnostic methods and known repair pathways. The system
 * NEVER infers root cause from symptoms: possible_causes is a list of
 * documented possibilities, each traceable to its source.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'failure_scenarios',
    required: ['name', 'failure_category'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      notes: { type: 'string' },

      failure_category: { type: 'string', enum: 'failure_categories' },
      failure_category_notes: { type: 'string' },

      /* Which canonical assets this scenario applies to. asset_type is
       * a Stage 7 graph node type; asset_ids reference that canonical
       * collection. */
      asset_type: { type: 'string' },
      asset_ids: { type: 'array' },
      models: { type: 'array' },

      symptoms: { type: 'array' },
      conditions: { type: 'string' },

      /* Documented possibilities — never an inferred root cause. */
      possible_causes: { type: 'array' },
      diagnostic_methods: { type: 'array' },

      known_repair_paths: { type: 'array' },
      known_part_requirements: { type: 'array' },
      known_tool_requirements: { type: 'array' },
      known_material_requirements: { type: 'array' },
      fallback_paths: { type: 'array' },

      safety_notes: { type: 'string' },
      hazard_types: { type: 'array' },
      ppe_requirements: { type: 'string' },
      qualification_requirements: { type: 'string' },

      status: { type: 'string' },
      source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      limitations: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.failure_scenario = m;
  SCA.models.failure_scenarios = m;
})(SCA);
