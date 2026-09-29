/*
 * Census observation (Stage 6). A measurement record, not a capability.
 *
 * COUNT SEMANTICS: every count is stored as a structured entry
 *   { value: <number|null>, basis: 'OBSERVED'|'ESTIMATED'|'UNKNOWN', note? }
 * - OBSERVED: what the research actually documented within the census
 *   scope and methodology. "trainer_count = 0 (OBSERVED)" is only valid
 *   when the methodology actually established zero trainers in the
 *   surveyed scope.
 * - ESTIMATED: only permitted when the census methodology is approved
 *   AND documents an estimation method (enforced in the workflow).
 * - UNKNOWN: no defensible value -> value MUST be null. Never a silent 0.
 *
 * Nothing here is ever automatically converted into a capability
 * E-level, a practitioner competence level, or a presence state.
 */
(function (SCA) {
  'use strict';
  var COUNT_FIELDS = ['practitioner_count', 'verified_practitioner_count',
    'trainer_count', 'active_apprentice_count', 'workshop_count',
    'institution_count'];

  var m = {
    collection: 'census_observations',
    required: ['census_id', 'capability_id', 'location_id'],
    fields: {
      census_id: { type: 'string' },
      capability_id: { type: 'string' },
      location_id: { type: 'string' },
      observation_date: { type: 'string' },
      presence: { type: 'string', enum: 'capability_presence' },
      documentation_coverage: { type: 'string', enum: 'documentation_coverage' },
      evidence_status: { type: 'string', enum: 'evidence_levels' },
      survey_status: { type: 'string', enum: 'survey_statuses' },
      confidence: { type: 'string', enum: 'census_confidence' },
      source_ids: { type: 'array' },
      research_session_ids: { type: 'array' },
      observation_ids: { type: 'array' },
      practitioner_ids: { type: 'array' },
      organization_ids: { type: 'array' },
      notes: { type: 'string' },
      review_status: { type: 'string', enum: 'census_observation_review_statuses' },
      reviewer: { type: 'string' },
      review_date: { type: 'string' },
      review_reason: { type: 'string' },
      supersedes_id: { type: 'string' },
      superseded_by_id: { type: 'string' },
      version: { type: 'string' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  /* Count objects are validated by the census workflow (they carry
   * basis semantics); the model exposes the field names so tests, the UI
   * and the matrix renderer share one source of truth. */
  COUNT_FIELDS.forEach(function (f) { m.fields[f] = { type: 'object' }; });
  m.countFields = COUNT_FIELDS;
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.census_observation = m;
  SCA.models.census_observations = m;
})(SCA);
