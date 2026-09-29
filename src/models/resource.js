/*
 * Resource model (Stage 7, registry-grade).
 *
 * Natural or produced resources that capabilities use (e.g. fish, water, fuel wood). Registry-grade; a full resource registry is a later stage.
 *
 * No fabricated data: every field defaults to honest documentation.
 * Records are created through explicit entry or atomic import - never
 * invented by the system.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'resources',
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
  SCA.models.resource = m;
  SCA.models.resources = m;
})(SCA);
