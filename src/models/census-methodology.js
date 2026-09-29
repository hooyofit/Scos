/*
 * Census methodology (Stage 6). A census may only produce ESTIMATED
 * counts when an approved methodology documents its estimation method.
 * The methodology is the scientific instrument of the census: approval
 * rests with the national administrator.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'census_methodologies',
    required: ['title', 'population_definition', 'data_collection_method'],
    fields: {
      title: { type: 'string' },
      description: { type: 'string' },
      version: { type: 'string' },
      status: { type: 'string', enum: 'methodology_statuses' },
      population_definition: { type: 'string' },
      sampling_method: { type: 'string' },
      data_collection_method: { type: 'string' },
      inclusion_criteria: { type: 'string' },
      exclusion_criteria: { type: 'string' },
      verification_procedure: { type: 'string' },
      estimation_method: { type: 'string' },
      uncertainty_treatment: { type: 'string' },
      date_range_start: { type: 'string' },
      date_range_end: { type: 'string' },
      responsible_organization: { type: 'string' },
      approved_by: { type: 'string' },
      approval_reason: { type: 'string' },
      approved_at: { type: 'string' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.census_methodology = m;
  SCA.models.census_methodologies = m;
})(SCA);
