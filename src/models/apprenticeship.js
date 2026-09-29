/*
 * Apprenticeship model (Stage 5). The actual relationship/pathway between
 * a mentor (a practitioner) and an apprentice, for a capability, possibly
 * under a training program.
 *
 * Milestones are configurable per program/capability (copied from a
 * TrainingProgram's suggested_milestones or entered directly) — there is
 * deliberately NO universal checklist that falsely applies to every
 * capability. Each milestone is { id, title, description?, status,
 * completed_date?, evidence_ids? }.
 *
 * Discontinuation is NOT automatically failure: interruption_reason
 * records why, without judgment.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'apprenticeships',
    required: ['apprentice_id', 'mentor_id', 'capability_id'],
    fields: {
      apprentice_id: { type: 'string' },
      mentor_id: { type: 'string' },
      capability_id: { type: 'string' },
      program_id: { type: 'string' },
      organization_id: { type: 'string' },
      start_date: { type: 'string' },
      expected_end_date: { type: 'string' },
      actual_end_date: { type: 'string' },
      training_plan: { type: 'object' },
      milestones: { type: 'array' },
      practical_hours: { type: 'number' },
      demonstrations: { type: 'array' },
      assessments: { type: 'array' },
      status: { type: 'string', enum: 'apprenticeship_statuses' },
      interruption_reason: { type: 'string' },
      completion_status: { type: 'string', enum: 'completion_statuses' },
      /* The reproduction loop: does this apprenticeship explicitly aim to
         produce the next trainer/practitioner? Structured, not scored. */
      successor_pathway: { type: 'boolean' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.apprenticeship = m;
  SCA.models.apprenticeships = m;
})(SCA);
