/*
 * CompetenceAssessment model (Stage 5). A formal assessment of what a
 * practitioner or apprentice has actually DEMONSTRATED, for one
 * capability, by a named assessor, ideally linked to evidence.
 *
 * The assessment PRINCIPLE: competence is based on evidence of capability.
 * Never based on followers, age, reputation alone, years alive, social
 * status, wealth, title or attendance. experience_years may be recorded
 * as CONTEXT, but experience alone never equals demonstrated competence.
 *
 * No numerical scores (unless explicitly required later). The result is a
 * controlled outcome + an L0-L5 level, set by the assessment, never
 * automatically.
 *
 * review_status: an assessment must be reviewed (assessment.review) before
 * it can be applied to a practitioner's competence_level. Assessment
 * history is never silently rewritten: superseding appends a new
 * assessment, the old one is marked SUPERSEDED.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'competence_assessments',
    required: ['practitioner_id', 'capability_id', 'assessor_id',
      'assessment_type', 'result'],
    fields: {
      practitioner_id: { type: 'string' },
      apprentice_id: { type: 'string' },
      capability_id: { type: 'string' },
      assessor_id: { type: 'string' },
      assessor_practitioner_id: { type: 'string' },
      assessment_type: { type: 'string', enum: 'assessment_types' },
      criteria: { type: 'string' },
      evidence_ids: { type: 'array' },
      observation_ids: { type: 'array' },
      session_id: { type: 'string' },
      demonstrations: { type: 'array' },
      practical_hours: { type: 'number' },
      observed_tasks: { type: 'array' },
      strengths: { type: 'string' },
      limitations: { type: 'string' },
      safety_notes: { type: 'string' },
      result: { type: 'string', enum: 'assessment_results' },
      competence_level: { type: 'string', enum: 'competence_levels' },
      review_status: { type: 'string', enum: 'assessment_review_statuses' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      assessment_date: { type: 'string' },
      review_date: { type: 'string' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.competence_assessment = m;
  SCA.models.competence_assessments = m;
})(SCA);
