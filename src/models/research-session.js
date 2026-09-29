/*
 * ResearchSession model (Stage 4): one field visit / research activity.
 * LOCATION PRIVACY: precise coordinates are NEVER required. location_precision
 * declares how precise the recorded location is; coordinates stay null when
 * the researcher chooses UNDISCLOSED or a coarse precision. Context fields
 * stay null when unknown — never inferred.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'research_sessions',
    required: ['project_id', 'purpose'],
    fields: {
      project_id: { type: 'string' },
      researcher_ids: { type: 'array' },
      date_start: { type: 'string' },
      date_end: { type: 'string' },
      region_id: { type: 'string' },
      region: { type: 'string' },
      district: { type: 'string' },
      locality: { type: 'string' },
      community: { type: 'string' },
      country: { type: 'string' },
      general_location_description: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      location_precision: { type: 'string', enum: 'location_precision' },
      settlement_context: { type: 'string', enum: 'settlement_contexts' },
      ecological_environment: { type: 'string' },
      season: { type: 'string' },
      purpose: { type: 'string' },
      capabilities_targeted: { type: 'array' },
      participant_ids: { type: 'array' },
      status: { type: 'string' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.research_session = m;
  SCA.models.research_sessions = m;
})(SCA);
