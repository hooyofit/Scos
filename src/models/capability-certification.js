/*
 * CapabilityCertification model (Stage 5). A formal competence decision,
 * always grounded in an accepted CompetenceAssessment. Attendance is not
 * certification. Certification is competence-based, issued by a separate
 * authority (never the certified person), and always audited.
 *
 * E5 evidence (Stage 3) and L5 competence (Stage 5) are SEPARATE
 * dimensions: a highly competent practitioner can exist before the Atlas
 * has E5 historical/technical evidence, and E5 evidence for a capability
 * never makes every practitioner competent.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capability_certifications',
    required: ['capability_id', 'assessment_id', 'certification_level',
      'issued_by', 'issued_date', 'status'],
    fields: {
      certification_code: { type: 'string' },
      practitioner_id: { type: 'string' },
      apprentice_id: { type: 'string' },
      capability_id: { type: 'string' },
      assessment_id: { type: 'string' },
      certification_level: { type: 'string', enum: 'competence_levels' },
      issued_by: { type: 'string' },
      issued_date: { type: 'string' },
      expiry_date: { type: 'string' },
      scope: { type: 'string' },
      limitations: { type: 'string' },
      evidence_ids: { type: 'array' },
      organization_id: { type: 'string' },
      safety_notes: { type: 'string' },
      suspension_reason: { type: 'string' },
      revocation_reason: { type: 'string' },
      superseded_by_id: { type: 'string' },
      status: { type: 'string', enum: 'certification_statuses' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.capability_certification = m;
  SCA.models.capability_certifications = m;
})(SCA);
