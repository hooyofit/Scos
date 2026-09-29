/*
 * FieldObservation model (Stage 4). An observation is what the researcher
 * PERSONALLY observed or documented — never automatically a verified fact,
 * never automatically a claim. confidence_note is free text, deliberately
 * NOT a numerical truth score. Observations carry the field record
 * lifecycle and conflict-tracking fields.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'observations',
    required: ['session_id', 'capability_id', 'observation_type', 'observation_text'],
    fields: {
      session_id: { type: 'string' },
      capability_id: { type: 'string' },
      observer_id: { type: 'string' },
      observer_name: { type: 'string' },
      observation_type: { type: 'string', enum: 'observation_types' },
      observation_text: { type: 'string' },
      context: { type: 'string' },
      date: { type: 'string' },
      duration: { type: 'string' },
      materials_observed: { type: 'array' },
      tools_observed: { type: 'array' },
      environmental_conditions: { type: 'string' },
      procedure_summary: { type: 'string' },
      decision_points: { type: 'string' },
      outcome_observed: { type: 'string' },
      limitations: { type: 'string' },
      unexpected_events: { type: 'string' },
      evidence_refs: { type: 'array' },
      media_refs: { type: 'array' },
      participant_refs: { type: 'array' },
      confidence_note: { type: 'string' },
      status: { type: 'string', enum: 'field_record_statuses' },
      conflict_status: { type: 'boolean' },
      conflict_refs: { type: 'array' },
      conflict_notes: { type: 'string' },
      resolution_status: { type: 'string', enum: 'conflict_resolution' },
      resolution_notes: { type: 'string' },
      rejection_reason: { type: 'string' },
      access_level: { type: 'string', enum: 'research_access_levels' },
      sensitivity: { type: 'string', enum: 'sensitivity_levels' },
      safety_notes: { type: 'string' },
      origin_evidence_ids: { type: 'array' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.field_observation = m;
  SCA.models.observations = m;
})(SCA);
