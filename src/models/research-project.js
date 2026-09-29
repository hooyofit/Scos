/*
 * ResearchProject model (Stage 4). A project is an approved container for
 * fieldwork. Field collection is only allowed against an APPROVED (or
 * ACTIVE/PAUSED) project. The research protocol is plain structured data:
 * different projects can use different protocols without code changes.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'research_projects',
    required: ['project_code', 'title'],
    fields: {
      project_code: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      objective: { type: 'string' },
      capability_ids: { type: 'array' },
      family_ids: { type: 'array' },
      geographic_scope: { type: 'string' },
      historical_scope: { type: 'string' },
      methodology: { type: 'string' },
      lead_researcher: { type: 'string' },
      research_team: { type: 'array' },
      reviewer: { type: 'string' },
      status: { type: 'string', enum: 'project_statuses' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      research_protocol: { type: 'object' },
      ethics_notes: { type: 'string' },
      safety_notes: { type: 'string' },
      consent_requirements: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.research_project = m;
  SCA.models.research_projects = m;
})(SCA);
