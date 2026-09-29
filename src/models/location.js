/*
 * Location model. privacy_level controls exposure; precise practitioner
 * locations must never be public without consent. Records are references
 * for regions/districts, not tracking data about individuals.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'locations',
    required: [],
    fields: {
      name: { type: 'string' },
      location_type: { type: 'string', enum: 'location_types' },
      parent_id: { type: 'string' },
      country: { type: 'string' },
      region: { type: 'string' },
      district: { type: 'string' },
      city: { type: 'string' },
      locality: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      privacy_level: { type: 'string', enum: 'access_levels' },
      /* Hierarchical geography: Country > Region > District > City >
         Community > Site. Coordinates are OPTIONAL: the census never
         requires exact positions and never infers a location. */
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.location = m;
  SCA.models.locations = m;
})(SCA);
