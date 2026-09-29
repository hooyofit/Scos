/*
 * FieldNote model (Stage 4): a lightweight preliminary impression or memo.
 * Field notes NEVER automatically become evidence; they may be submitted
 * into review like any field record, but nothing promotes them silently.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'field_notes',
    required: ['session_id', 'text'],
    fields: {
      session_id: { type: 'string' },
      author: { type: 'string' },
      date: { type: 'string' },
      text: { type: 'string' },
      tags: { type: 'array' },
      related_capabilities: { type: 'array' },
      related_participants: { type: 'array' },
      follow_up_items: { type: 'array' },
      status: { type: 'string', enum: 'field_record_statuses' },
      conflict_status: { type: 'boolean' },
      conflict_refs: { type: 'array' },
      rejection_reason: { type: 'string' },
      access_level: { type: 'string', enum: 'research_access_levels' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.field_note = m;
  SCA.models.field_notes = m;
})(SCA);
