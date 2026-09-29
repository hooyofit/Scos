/*
 * EvidenceSource model (Stage 3). Sources must be real; nothing here is
 * fabricated. A source type is a CLASSIFICATION, not a credibility rating:
 * "Academic Publication" does not make a source credible. Credibility and
 * relevance remain human review decisions (review_status, reliability_notes).
 * independence_group lets reviewers mark sources that derive from the same
 * original (ten copies of one article are one stream, not ten).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'evidence',
    required: ['title'],
    fields: {
      title: { type: 'string' },
      source_type: { type: 'string', enum: 'source_types' },
      author: { type: 'string' },
      organization: { type: 'string' },
      publication_date: { type: 'string' },
      publication_place: { type: 'string' },
      language: { type: 'string' },
      url: { type: 'string' },
      identifier: { type: 'string' },
      citation: { type: 'string' },
      description: { type: 'string' },
      reliability_notes: { type: 'string' },
      independence_group: { type: 'string' },
      geographic_scope: { type: 'string' },
      temporal_scope: { type: 'string' },
      access_status: { type: 'string', enum: 'access_levels' },
      source_owner: { type: 'string' },
      entered_by: { type: 'string' },
      reviewed_by: { type: 'string' },
      review_status: { type: 'string', enum: 'verification_states' },
      review_notes: { type: 'string' },
      superseded_by: { type: 'string' },
      evidence_level: { type: 'string', enum: 'evidence_levels' },
      region: { type: 'string' },
      verification_status: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.evidence = m;
  SCA.models.evidence_source = m;
})(SCA);
