/* CapabilityFamily model. Codes: W L A P F C H M R S T G. */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'families',
    required: ['code', 'name'],
    fields: {
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      display_order: { type: 'number' },
      status: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.family = m;
  SCA.models.families = m;
})(SCA);
