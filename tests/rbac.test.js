/* RBAC tests: the permission matrix behaves as designed. */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  rbac.test.js');

  function user(role) { return { id: 'u1', role: role }; }

  /* Anonymous visitors. */
  H.assert(SCA.rbac.can(null, 'data.read') === true, 'anonymous can read public data');
  H.assert(SCA.rbac.can(null, 'data.export') === false, 'anonymous cannot export');
  H.assert(SCA.rbac.can(null, 'capability.create') === false, 'anonymous cannot create capabilities');
  H.assertEq(SCA.rbac.roleOf(null), 'anon', 'roleOf(null) is anon');

  /* Public User. */
  H.assert(SCA.rbac.can(user('public'), 'data.read') === true, 'public user can read');
  H.assert(SCA.rbac.can(user('public'), 'data.export') === false, 'public user cannot export');
  H.assert(SCA.rbac.can(user('public'), 'profile.manage') === true, 'public user manages own profile');

  /* Researcher. */
  H.assert(SCA.rbac.can(user('researcher'), 'capability.create') === true, 'researcher creates capabilities');
  H.assert(SCA.rbac.can(user('researcher'), 'evidence.create') === true, 'researcher adds evidence');
  H.assert(SCA.rbac.can(user('researcher'), 'data.export') === true, 'researcher can export');
  H.assert(SCA.rbac.can(user('researcher'), 'data.import') === false, 'researcher cannot import');
  H.assert(SCA.rbac.can(user('researcher'), 'users.manage') === false, 'researcher cannot manage users');

  /* Practitioner. */
  H.assert(SCA.rbac.can(user('practitioner'), 'practitioner.create') === true, 'practitioner can create own record');
  H.assert(SCA.rbac.can(user('practitioner'), 'data.import') === false, 'practitioner cannot import');

  /* Apprentice. */
  H.assert(SCA.rbac.can(user('apprentice'), 'apprentice.enroll') === true, 'apprentice can enroll');
  H.assert(SCA.rbac.can(user('apprentice'), 'dashboard.view') === false, 'apprentice cannot view dashboard');

  /* Reviewer / Project Manager. */
  H.assert(SCA.rbac.can(user('reviewer'), 'dashboard.view') === true, 'reviewer views dashboard');
  H.assert(SCA.rbac.can(user('reviewer'), 'projects.manage') === false, 'reviewer cannot manage projects');
  H.assert(SCA.rbac.can(user('project_manager'), 'projects.manage') === true, 'project manager manages projects');
  H.assert(SCA.rbac.can(user('project_manager'), 'users.manage') === false, 'project manager cannot manage users');

  /* Administrators. */
  H.assert(SCA.rbac.can(user('regional_administrator'), 'data.import') === true, 'regional admin can import');
  H.assert(SCA.rbac.can(user('regional_administrator'), 'users.manage') === false, 'regional admin cannot manage users');
  H.assert(SCA.rbac.can(user('national_administrator'), 'users.manage') === true, 'national admin manages users');
  H.assert(SCA.rbac.can(user('national_administrator'), 'roles.assign') === true, 'national admin assigns roles');

  /* Consistency: national administrator holds EVERY permission, and every
     permission defines a non-empty role list. */
  var na = user('national_administrator');
  SCA.rbac.permissions().forEach(function (p) {
    H.assert(SCA.rbac.can(na, p) === true, 'national admin holds permission ' + p);
    H.assert(SCA.rbac.rolesFor(p).length > 0, 'permission ' + p + ' has roles');
  });
};
