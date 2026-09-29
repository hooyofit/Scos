/*
 * FieldMedia model (Stage 4): METADATA about media captured in the field,
 * not a media-hosting system. A media file existing is never an assumption
 * that it is publicly shareable: access_level and consent_id govern it,
 * and consent withdrawal restricts the record without deleting provenance.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'field_media',
    required: ['media_type', 'filename'],
    fields: {
      session_id: { type: 'string' },
      observation_id: { type: 'string' },
      artifact_id: { type: 'string' },
      participant_id: { type: 'string' },
      media_type: { type: 'string', enum: 'media_types' },
      filename: { type: 'string' },
      local_reference: { type: 'string' },
      checksum: { type: 'string' },
      captured_at: { type: 'string' },
      description: { type: 'string' },
      language: { type: 'string' },
      consent_id: { type: 'string' },
      access_level: { type: 'string', enum: 'research_access_levels' },
      sensitivity: { type: 'string', enum: 'sensitivity_levels' },
      uploaded_status: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.field_media = m;
  SCA.models['field_media'] = m;
})(SCA);
