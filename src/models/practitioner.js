/*
 * Practitioner model (extended for Stage 5).
 *
 * Privacy is structural: anonymous_option, documentation_consent and
 * contact_visibility are required architecture, and no precise location
 * is stored on this record. "name" is the private full name; it is
 * access-controlled and never public without consent. "public_name" is
 * what the atlas may display.
 *
 * Stage 5 distinctions (do not collapse these):
 *  - identity (who this record is about)
 *  - status (documentation/participation state: practitioner_statuses)
 *  - competence_level (DEMONSTRATED competence: L0-L5)
 *  - competence_status (assessment outcome, from assessment_results)
 *  - can_teach / trainer_readiness (teaching ability — a separate question)
 *  - evidence_ids (what supports the competence assessment)
 *
 * L-levels are NEVER assigned automatically and NEVER from reputation,
 * age, title, wealth or attendance.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'practitioners',
    required: ['public_name'],
    fields: {
      user_id: { type: 'string' },
      name: { type: 'string' },
      public_name: { type: 'string' },
      anonymous_option: { type: 'boolean' },
      practitioner_code: { type: 'string' },
      capability_ids: { type: 'array' },
      capabilities: { type: 'array' },
      region_ids: { type: 'array' },
      region: { type: 'string' },
      community: { type: 'string' },
      knowledge_holder_type: { type: 'string', enum: 'knowledge_holder_types' },
      experience_years: { type: 'number' },
      competence_level: { type: 'string', enum: 'competence_levels' },
      competence_status: { type: 'string', enum: 'assessment_results' },
      services: { type: 'array' },
      languages: { type: 'array' },
      can_teach: { type: 'boolean' },
      trainer_readiness: { type: 'string', enum: 'trainer_readiness' },
      trainer_assessment_id: { type: 'string' },
      certification_status: { type: 'string', enum: 'certification_statuses' },
      apprentice_capacity: { type: 'number' },
      documentation_consent: { type: 'boolean' },
      consent_id: { type: 'string' },
      contact_visibility: { type: 'string', enum: 'contact_visibility_levels' },
      verification_status: { type: 'string', enum: 'practitioner_statuses' },
      verification_pathways: { type: 'array' },
      evidence_ids: { type: 'array' },
      training_history: { type: 'array' },
      assessment_history: { type: 'array' },
      availability: { type: 'string' },
      organization_id: { type: 'string' },
      organization: { type: 'string' },
      /* Succession planning is sensitive: access-controlled, never public
         unless explicitly authorized (see Stage 5 workflow). */
      successor: { type: 'object' },
      references: { type: 'array' },
      notes: { type: 'string' },
      bio: { type: 'string' },
      safety_notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.practitioner = m;
  SCA.models.practitioners = m;
})(SCA);
