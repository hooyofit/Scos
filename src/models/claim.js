/*
 * Claim model (Stage 3). A claim is something SOMEBODY asserts — preserved
 * without being declared true. It is deliberately separate from sources,
 * artifacts, and verification: a claim may have multiple sources,
 * conflicting sources, historical evidence but no living practitioner, or
 * living practice with weak technical validation. Disputed ≠ false;
 * Rejected keeps the original claim_text and the reason for rejection.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'claims',
    required: ['capability_id', 'claim_text', 'claim_type'],
    fields: {
      capability_id: { type: 'string' },
      claim_text: { type: 'string' },
      claim_type: { type: 'string', enum: 'claim_types' },
      claimant: { type: 'string' },
      source_ids: { type: 'array' },
      artifact_ids: { type: 'array' },
      context: { type: 'string' },
      region_id: { type: 'string' },
      region: { type: 'string' },
      date: { type: 'string' },
      evidence_level: { type: 'string', enum: 'evidence_levels' },
      verification_status: { type: 'string', enum: 'verification_states' },
      reviewer: { type: 'string' },
      review_notes: { type: 'string' },
      rejection_reason: { type: 'string' },
      superseded_by: { type: 'string' },
      entered_by: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.claim = m;
  SCA.models.claims = m;
})(SCA);
