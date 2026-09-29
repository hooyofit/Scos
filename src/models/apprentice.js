/*
 * Apprentice model (extended for Stage 5).
 *
 * An apprentice is a learner on a pathway toward demonstrated competence —
 * never merely a student record. Certification of an apprentice must be
 * competence-based: attendance is not certification.
 *
 * current_level / target_level use the L0-L5 competence scale (Stage 5),
 * not the capability maturity scale.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'apprentices',
    required: ['public_name', 'capability_id'],
    fields: {
      user_id: { type: 'string' },
      public_name: { type: 'string' },
      anonymous_option: { type: 'boolean' },
      apprentice_code: { type: 'string' },
      capability_id: { type: 'string' },
      capability_ids: { type: 'array' },
      mentor_ids: { type: 'array' },
      mentor_id: { type: 'string' },
      training_start: { type: 'string' },
      current_level: { type: 'string', enum: 'competence_levels' },
      target_level: { type: 'string', enum: 'competence_levels' },
      practical_hours: { type: 'number' },
      demonstrations_completed: { type: 'number' },
      assessments: { type: 'array' },
      assessment_status: { type: 'string' },
      certification_status: { type: 'string', enum: 'certification_statuses' },
      employment: { type: 'string' },
      trainer_ready: { type: 'boolean' },
      portfolio: { type: 'array' },
      region: { type: 'string' },
      region_ids: { type: 'array' },
      community: { type: 'string' },
      organization_id: { type: 'string' },
      consent_id: { type: 'string' },
      evidence_ids: { type: 'array' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.apprentice = m;
  SCA.models.apprentices = m;
})(SCA);
