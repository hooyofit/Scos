/*
 * Consent model (Stage 3). Consent governs documentation of people and
 * their knowledge. Withdrawal preserves the audit history while current
 * access rules are enforced against the withdrawal status. "person" may be
 * a practitioner record id, or a free-text attribution for contributors
 * who are not practitioners — no precise personal locations here.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'consents',
    required: ['person', 'purpose'],
    fields: {
      person: { type: 'string' },
      practitioner_id: { type: 'string' },
      purpose: { type: 'string' },
      artifact_ids: { type: 'array' },
      media_permission: { type: 'boolean' },
      public_permission: { type: 'boolean' },
      attribution_preference: { type: 'string' },
      consent_state: { type: 'string', enum: 'consent_states' },
      consent_date: { type: 'string' },
      expiry: { type: 'string' },
      withdrawal_date: { type: 'string' },
      withdrawal_reason: { type: 'string' },
      recorded_by: { type: 'string' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.consent = m;
  SCA.models.consents = m;
})(SCA);
