/*
 * KnowledgeArtifact model (Stage 3). An artifact is CAPTURED KNOWLEDGE, not
 * automatically validated truth. Fields stay null when unknown — never
 * invented. capability_ids/source_ids/region_ids/practitioner_ids are
 * relationship lists; consent_id points to a Consent record.
 * capability_id is kept as the single-link form for compatibility with the
 * Step 1 skeleton; new records use capability_ids.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'knowledge',
    required: ['title'],
    fields: {
      title: { type: 'string' },
      artifact_type: { type: 'string' },
      capability_id: { type: 'string' },
      capability_ids: { type: 'array' },
      source_ids: { type: 'array' },
      region_ids: { type: 'array' },
      practitioner_ids: { type: 'array' },
      contributor: { type: 'string' },
      creator: { type: 'string' },
      description: { type: 'string' },
      original_language: { type: 'string' },
      translated_text: { type: 'string' },
      transcription: { type: 'string' },
      claim_text: { type: 'string' },
      context: { type: 'string' },
      historical_period: { type: 'string' },
      materials: { type: 'array' },
      tools: { type: 'array' },
      procedure_summary: { type: 'string' },
      decision_points: { type: 'string' },
      environmental_conditions: { type: 'string' },
      failure_modes: { type: 'string' },
      troubleshooting: { type: 'string' },
      limitations: { type: 'string' },
      safety_notes: { type: 'string' },
      modern_equivalent: { type: 'string' },
      comparison_notes: { type: 'string' },
      measurements: { type: 'string' },
      media_references: { type: 'array' },
      file_url: { type: 'string' },
      consent_id: { type: 'string' },
      language: { type: 'string' },
      access_level: { type: 'string', enum: 'access_levels' },
      consent_status: { type: 'string' },
      evidence_level: { type: 'string', enum: 'evidence_levels' },
      verification_status: { type: 'string', enum: 'verification_states' },
      reviewer: { type: 'string' },
      review_notes: { type: 'string' },
      /* Stage 4: interview / knowledge-capture fields. The ORIGINAL
         wording (transcription) is preserved separately from translation
         and is never overwritten by it. */
      capture_type: { type: 'string' },
      session_id: { type: 'string' },
      participant_id: { type: 'string' },
      interviewer: { type: 'string' },
      interview_date: { type: 'string' },
      summary: { type: 'string' },
      follow_up_required: { type: 'boolean' },
      origin_record: { type: 'object' },
      sensitivity: { type: 'string', enum: 'sensitivity_levels' },
      entered_by: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.knowledge_artifact = m;
  SCA.models.knowledge = m;
})(SCA);
