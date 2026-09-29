/* Validation tests: models, enums, and the "Not yet documented" rule. */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  validation.test.js');

  /* Required fields on Capability. */
  var v1 = SCA.models.capability.validate({
    code: 'CAP-001', name: 'Test capability', family_id: 'fam-1'
  });
  H.assert(v1.valid === true, 'valid minimal capability passes');

  var v2 = SCA.models.capability.validate({ code: 'CAP-002' });
  H.assert(v2.valid === false, 'capability missing name and family is invalid');
  H.assert(!!v2.errors.name, 'missing name reported');
  H.assert(!!v2.errors.family_id, 'missing family_id reported');

  /* Enum validation: unknown codes rejected, valid codes and null accepted. */
  var v3 = SCA.models.capability.validate({
    code: 'CAP-003', name: 'T', family_id: 'f', evidence_level: 'E9'
  });
  H.assert(v3.valid === false && !!v3.errors.evidence_level, 'bogus evidence level E9 rejected');

  var v4 = SCA.models.capability.validate({
    code: 'CAP-004', name: 'T', family_id: 'f', evidence_level: 'E3'
  });
  H.assert(v4.valid === true, 'valid evidence level E3 accepted');

  var v5 = SCA.models.capability.validate({
    code: 'CAP-005', name: 'T', family_id: 'f', evidence_level: null
  });
  H.assert(v5.valid === true, 'null (unknown) evidence level is valid: never fabricated');

  var v6 = SCA.models.capability.validate({
    code: 'CAP-006', name: 'T', family_id: 'f', capability_maturity: 'L12'
  });
  H.assert(v6.valid === false && !!v6.errors.capability_maturity, 'bogus maturity L12 rejected');

  var v7 = SCA.models.capability.validate({
    code: 'CAP-007', name: 'T', family_id: 'f', action: 'INVENT'
  });
  H.assert(v7.valid === false && !!v7.errors.action, 'bogus action INVENT rejected');

  /* Type validation on other models. */
  var v8 = SCA.models.practitioner.validate({
    public_name: 'P', experience_years: 'many'
  });
  H.assert(v8.valid === false && !!v8.errors.experience_years, 'non-numeric experience_years rejected');

  var v9 = SCA.models.practitioner.validate({
    public_name: 'P', documentation_consent: 'yes'
  });
  H.assert(v9.valid === false && !!v9.errors.documentation_consent, 'non-boolean consent rejected');

  var v10 = SCA.models.user.validate({ name: 'U', email: 'u@x.co', role: 'wizard' });
  H.assert(v10.valid === false && !!v10.errors.role, 'unknown role rejected by user model');

  var v11 = SCA.models.user.validate({ name: 'U', email: 'u@x.co', role: 'researcher' });
  H.assert(v11.valid === true, 'valid user passes');

  /* Family codes are the permanent letters W L A P F C H M R S T G. */
  var codes = SCA.store.all('families').map(function (f) { return f.code; });
  H.assertEq(codes.sort().join(''), 'ACFGHLMPRSTW', 'family codes are exactly the 12 spec letters');
  H.assert(SCA.store.all('families').every(function (f) { return 'status' in f; }),
    'family records carry a status field');

  /* Extended capability fields: array typing works. */
  var v12 = SCA.models.capability.validate({
    code: 'CAP-008', name: 'T', family_id: 'f',
    regions: ['Woqooyi Galbeed', 'Bari'], source_ids: [], materials: null
  });
  H.assert(v12.valid === true, 'array fields accept arrays and null');

  var v13 = SCA.models.capability.validate({
    code: 'CAP-009', name: 'T', family_id: 'f', regions: 'Somaliland'
  });
  H.assert(v13.valid === false && !!v13.errors.regions, 'non-array regions rejected');

  var v14 = SCA.models.practitioner.validate({
    public_name: 'P', capabilities: ['W-001'], languages: ['so', 'en']
  });
  H.assert(v14.valid === true, 'practitioner array fields validate');

  /* Display rule: blanks become "Not yet documented", never fabricated. */
  H.assertEq(SCA.util.display(null), 'Not yet documented', 'null displays correctly');
  H.assertEq(SCA.util.display('  '), 'Not yet documented', 'whitespace displays correctly');
  H.assertEq(SCA.util.display(undefined), 'Not yet documented', 'undefined displays correctly');
  H.assertEq(SCA.util.display('x'), 'x', 'known value passes through');

  /* Store-level validation and referential integrity. */
  var fam = SCA.store.all('families')[0];
  H.assert(!!fam, 'families seeded');

  var ins1 = SCA.store.insert('capabilities', {
    code: 'CAP-T1', name: 'Cap T1', family_id: fam.id
  });
  H.assert(ins1.ok === true, 'valid capability inserts');

  var ins2 = SCA.store.insert('capabilities', {
    code: 'CAP-T2', name: 'Cap T2', family_id: 'does-not-exist'
  });
  H.assert(ins2.ok === false && !!ins2.errors.family_id, 'capability with unknown family rejected');

  var ins3 = SCA.store.insert('capabilities', { code: 'CAP-T3' });
  H.assert(ins3.ok === false, 'invalid capability rejected by store');

  /* Clean up test data so later suites see a clean dataset. */
  SCA.store.wipe();
  SCA.store.init();
};
