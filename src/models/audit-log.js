/*
 * AuditLog model (Stage 3). Audit entries are append-only history: they are
 * never edited or deleted, only added. Every evidence action writes one
 * through SCA.audit.log. old_value/new_value store the changed state so a
 * rejected or superseded decision keeps its history.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'audit_log',
    required: ['actor', 'action', 'entity', 'entity_id'],
    fields: {
      actor: { type: 'string' },
      action: { type: 'string' },
      entity: { type: 'string' },
      entity_id: { type: 'string' },
      entity_code: { type: 'string' },
      old_value: { type: 'string' },
      new_value: { type: 'string' },
      reason: { type: 'string' },
      version: { type: 'string' },
      timestamp: { type: 'string' },
      created_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.audit_log = m;
})(SCA);
