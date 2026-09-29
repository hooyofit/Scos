/*
 * The 12 user roles. Role codes are identifiers; descriptions describe the
 * FUNCTION of the role, they do not assert anything about real people.
 */
(function (SCA) {
  'use strict';
  SCA.roles = [
    { code: 'public', label: 'Public User',
      description: 'Browses the public atlas.' },
    { code: 'researcher', label: 'Researcher',
      description: 'Documents capabilities and contributes evidence.' },
    { code: 'community_steward', label: 'Community Steward',
      description: 'Coordinates documentation and consent within a community.' },
    { code: 'practitioner', label: 'Practitioner',
      description: 'Holds and demonstrates a living capability.' },
    { code: 'apprentice', label: 'Apprentice',
      description: 'Learns a capability under a mentor.' },
    { code: 'technician', label: 'Technician',
      description: 'Maintains, repairs and validates technical capabilities.' },
    { code: 'workshop', label: 'Workshop',
      description: 'Provides space, tools and training for making and repair.' },
    { code: 'trainer', label: 'Trainer',
      description: 'Teaches and assesses capability transmission.' },
    { code: 'reviewer', label: 'Reviewer',
      description: 'Reviews evidence, records and verification decisions.' },
    { code: 'project_manager', label: 'Project Manager',
      description: 'Plans and runs pilot projects.' },
    { code: 'regional_administrator', label: 'Regional Administrator',
      description: 'Administers data and users for a region.' },
    { code: 'national_administrator', label: 'National Administrator',
      description: 'Administers the platform at national level.' }
  ];

  SCA.roleLabel = function (code) {
    var r = SCA.roles.filter(function (x) { return x.code === code; })[0];
    return r ? r.label : SCA.UNKNOWN_LABEL;
  };
  SCA.roleCodes = SCA.roles.map(function (r) { return r.code; });
})(SCA);
