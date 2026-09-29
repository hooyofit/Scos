/*
 * Organization model (Stage 5). Workshops, training centers, cooperatives,
 * universities, NGOs, businesses, government and community organizations.
 *
 * One organization registry only — practitioners, apprentices,
 * apprenticeships, training programs and certifications reference it by
 * id. No duplicate organization databases. Some capabilities are held by
 * households/workshops/communities rather than individuals: that is
 * represented through knowledge_holder_type on practitioner records and
 * through organizations with capability presence.
 *
 * No precise location is stored. Contact details are NOT stored on this
 * record; contact is handled through consent-gated channels later.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'organizations',
    required: ['name', 'org_type'],
    fields: {
      name: { type: 'string' },
      org_type: { type: 'string', enum: 'organization_types' },
      description: { type: 'string' },
      region: { type: 'string' },
      region_ids: { type: 'array' },
      community: { type: 'string' },
      capability_ids: { type: 'array' },
      documentation_consent: { type: 'boolean' },
      contact_visibility: { type: 'string', enum: 'contact_visibility_levels' },
      notes: { type: 'string' },
      provenance: { type: 'string' },
      version: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.organization = m;
  SCA.models.organizations = m;
})(SCA);
