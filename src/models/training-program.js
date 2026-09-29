/*
 * TrainingProgram model (Stage 5). A structured training design for one or
 * more capabilities. A program can exist WITHOUT being tied to a formal
 * school — a workshop, a cooperative or an individual trainer can run one.
 *
 * suggested_milestones is an array of strings: the program's own
 * milestones (terminology understood, tools identified, safety understood,
 * etc.). Apprenticeships copy and track them per apprentice. There is no
 * universal checklist.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'training_programs',
    required: ['title'],
    fields: {
      program_code: { type: 'string' },
      title: { type: 'string' },
      capability_ids: { type: 'array' },
      description: { type: 'string' },
      objective: { type: 'string' },
      prerequisites: { type: 'string' },
      methodology: { type: 'string' },
      curriculum: { type: 'array' },
      suggested_milestones: { type: 'array' },
      practical_requirements: { type: 'string' },
      safety_requirements: { type: 'string' },
      assessment_method: { type: 'string' },
      trainer_requirements: { type: 'string' },
      duration: { type: 'string' },
      organization_id: { type: 'string' },
      status: { type: 'string', enum: 'training_program_statuses' },
      approved_by: { type: 'string' },
      approved_at: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.training_program = m;
  SCA.models.training_programs = m;
})(SCA);
