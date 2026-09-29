/*
 * Energy Source model (Stage 7, registry-grade).
 *
 * Energy sources capabilities depend on (e.g. solar, grid electricity, diesel). Registry-grade.
 *
 * No fabricated data: every field defaults to honest documentation.
 * Records are created through explicit entry or atomic import - never
 * invented by the system.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'energy_sources',
    required: ['name'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      notes: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.energy_source = m;
  SCA.models.energy_sources = m;
})(SCA);
