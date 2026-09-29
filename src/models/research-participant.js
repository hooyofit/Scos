/*
 * ResearchParticipant model (Stage 4). Privacy-aware: distinct from the
 * Practitioner model. A participant may be anonymous — then participant_code
 * is the internal identifier and public_name is a non-identifying label.
 * Private contact details are never stored here; contact_permission and
 * attribution_preference are consent decisions, not contact data.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'participants',
    required: ['participant_code', 'public_name'],
    fields: {
      participant_code: { type: 'string' },
      linked_practitioner_id: { type: 'string' },
      public_name: { type: 'string' },
      anonymous: { type: 'boolean' },
      role: { type: 'string', enum: 'participant_roles' },
      community: { type: 'string' },
      region: { type: 'string' },
      languages: { type: 'array' },
      expertise_summary: { type: 'string' },
      contact_permission: { type: 'boolean' },
      attribution_preference: { type: 'string' },
      consent_id: { type: 'string' },
      verification_status: { type: 'string' },
      access_level: { type: 'string', enum: 'research_access_levels' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.research_participant = m;
  SCA.models.participants = m;
})(SCA);
