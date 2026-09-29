/*
 * Offline collection queue model (Stage 4). Each pending local change gets
 * a queue entry. sync_status is honest: a record stored locally is
 * LOCAL_ONLY — never SYNCHRONIZED — until an explicit export/import/sync
 * step says otherwise. For future multi-device sync: detect, preserve both,
 * flag CONFLICT, human review. No automatic resolution.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'research_queue',
    required: ['entity_type', 'local_id', 'operation'],
    fields: {
      entity_type: { type: 'string' },
      local_id: { type: 'string' },
      operation: { type: 'string' },
      dependency_ids: { type: 'array' },
      sync_status: { type: 'string', enum: 'queue_statuses' },
      retry_count: { type: 'number' },
      last_error: { type: 'string' },
      incoming_record: { type: 'object' },
      device_note: { type: 'string' },
      created_at: { type: 'string' },
      modified_at: { type: 'string' },
      version: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.research_queue = m;
  SCA.models['research_queue'] = m;
})(SCA);
