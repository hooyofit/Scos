/*
 * Census snapshot (Stage 6). A snapshot freezes what the census actually
 * measured at a point in time, with unknowns preserved as unknowns.
 * DRAFT snapshots can be regenerated; a PUBLISHED snapshot is IMMUTABLE
 * (enforced in the data layer) - a later census produces a NEW snapshot,
 * never an overwrite of history.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'census_snapshots',
    required: ['census_id'],
    fields: {
      census_id: { type: 'string' },
      label: { type: 'string' },
      generated_at: { type: 'string' },
      methodology_version: { type: 'string' },
      capabilities_in_scope: { type: 'number' },
      capabilities_surveyed: { type: 'number' },
      capabilities_not_surveyed: { type: 'number' },
      locations_in_scope: { type: 'number' },
      locations_surveyed: { type: 'number' },
      practitioners_documented: { type: 'number' },
      practitioners_referenced: { type: 'number' },
      trainers_documented: { type: 'number' },
      apprentices_documented: { type: 'number' },
      workshops_documented: { type: 'number' },
      institutions_documented: { type: 'number' },
      evidence_sources: { type: 'number' },
      knowledge_artifacts: { type: 'number' },
      unknown_fields: { type: 'array' },
      status: { type: 'string', enum: 'snapshot_statuses' },
      published_at: { type: 'string' },
      published_by: { type: 'string' },
      version: { type: 'string' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.census_snapshot = m;
  SCA.models.census_snapshots = m;
})(SCA);
