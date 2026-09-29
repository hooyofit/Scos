/*
 * User model. Accounts also carry an internal `_auth` block (salt, hash,
 * provider) managed by the auth provider and NEVER exported or displayed.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'users',
    required: ['name', 'email', 'role'],
    fields: {
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', enum: 'roles' },
      phone: { type: 'string' },
      language: { type: 'string' },
      region: { type: 'string' },
      profile_photo: { type: 'string' },
      bio: { type: 'string' },
      status: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };

  m.validate = function (record) {
    return SCA.validateFields(m, record);
  };

  SCA.models = SCA.models || {};
  SCA.models.user = m;
  SCA.models.users = m;
})(SCA);
