/*
 * Capability census (Stage 6). A census is a measurement exercise, never
 * a claim of national truth. Scope is explicit: a census may cover one
 * community or the national system; capability scope is a defined set of
 * capabilities/families (empty arrays mean "all capabilities").
 *
 * Scope references are kept FLAT (location_ids, capability_ids,
 * family_ids) so the atomic import/export layer can verify them.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capability_censuses',
    required: ['title', 'scope_level'],
    fields: {
      title: { type: 'string' },
      description: { type: 'string' },
      scope_level: { type: 'string', enum: 'census_scope_levels' },
      population_scope: { type: 'string' },
      location_ids: { type: 'array' },
      capability_ids: { type: 'array' },
      family_ids: { type: 'array' },
      methodology_id: { type: 'string' },
      methodology_version: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      status: { type: 'string', enum: 'census_statuses' },
      owner: { type: 'string' },
      research_project_ids: { type: 'array' },
      approved_by: { type: 'string' },
      approval_reason: { type: 'string' },
      version: { type: 'string' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.capability_census = m;
  SCA.models.capability_censuses = m;
})(SCA);
