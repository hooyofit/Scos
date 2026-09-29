/*
 * Geographic redundancy measurement (Stage 6). RAW per-capability counts
 * of locations with documented data, generated together with a census
 * snapshot. These are measurements, NOT a resilience score; converting
 * them into one requires later methodological work (Stage 6 explicitly
 * does not).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'geographic_redundancies',
    required: ['capability_id', 'snapshot_id'],
    fields: {
      capability_id: { type: 'string' },
      snapshot_id: { type: 'string' },
      surveyed_location_count: { type: 'number' },
      documented_location_count: { type: 'number' },
      verified_location_count: { type: 'number' },
      trainer_location_count: { type: 'number' },
      apprentice_location_count: { type: 'number' },
      organization_location_count: { type: 'number' },
      methodology_version: { type: 'string' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.geographic_redundancy = m;
  SCA.models.geographic_redundancies = m;
})(SCA);
