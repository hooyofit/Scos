/* Export / import round-trip tests, including privacy rules. */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  export-import.test.js');

  /* Fresh store: 12 families + the 240-record Stage 2 inventory seeded. */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('families'), 12, '12 families seeded');
  H.assertEq(SCA.store.count('capabilities'), 240,
    '240 inventory capabilities seeded (Stage 2 baseline)');

  /* Users are NEVER exported, even when accounts exist. */
  var insU = SCA.store.insert('users', {
    name: 'Test User', email: 'test@example.org', role: 'researcher', status: 'active',
    _auth: { provider: 'local', salt: 's', password_hash: 'sha256:abc' }
  });
  H.assert(insU.ok === true, 'test user inserted');

  var fam = SCA.store.all('families')[0];
  var insC = SCA.store.insert('capabilities', {
    code: 'CAP-T1', name: 'Test capability', family_id: fam.id,
    evidence_level: 'E3', action: 'DOCUMENT', region: 'Somaliland'
  });
  H.assert(insC.ok === true, 'test capability inserted');

  /* Full export. */
  var text = SCA.transfer.exportAll();
  var bundle = JSON.parse(text);
  H.assertEq(bundle.kind, 'bundle', 'export is a bundle');
  H.assertEq(bundle.schema_version, SCA.SCHEMA_VERSION, 'bundle carries schema version');
  H.assert(bundle.collections.families.length === 12, 'bundle contains 12 families');
  H.assertEq(bundle.collections.capabilities.length, 241,
    'bundle contains the 240 inventory records plus the test record');
  H.assert(!('users' in bundle.collections), 'users are never in an export');

  /* Exported records contain no credential material. */
  var exportedText = JSON.stringify(bundle);
  H.assert(exportedText.indexOf('password_hash') === -1, 'no password hash in export');
  H.assert(exportedText.indexOf('test@example.org') === -1, 'no email in export');

  /* Single-collection export + parse round trip. */
  var single = SCA.transfer.parse(SCA.transfer.exportCollection('capabilities'));
  H.assertEq(single.collections.capabilities.length, 241, 'single collection export parses');

  /* Wipe and re-import: everything exportable is restored, deep-equal. */
  var before = SCA.store.dataset();
  SCA.store.wipe();
  H.assertEq(SCA.store.count('families'), 0, 'store wiped');

  var beforeCap = before.collections.capabilities.filter(function (c) {
    return c.code === 'CAP-T1'; })[0];
  H.assert(!!beforeCap, 'test capability present before export');
  var res = SCA.transfer.importBundle(text);
  H.assert(res.ok === true, 'import succeeds');
  var after = SCA.store.dataset();
  H.assertEq(after.collections.capabilities.length, 241,
    'all 241 capabilities restored (240 inventory + 1 test)');
  var afterCap = after.collections.capabilities.filter(function (c) {
    return c.code === 'CAP-T1'; })[0];
  H.assertEq(afterCap, beforeCap, 'capability survives round trip unchanged');
  H.assertEq(after.collections.capabilities.filter(function (c) {
    return c.code === 'W01'; }).length, 1, 'inventory record survives round trip');
  H.assertEq(after.collections.families.length, 12, 'families restored');

  /* Users survive an import untouched (they are not part of exports). */
  var resU = SCA.transfer.importBundle(text);
  H.assert(resU.ok === true, 'second import succeeds');
  H.assertEq(SCA.store.count('users'), 0, 'import never restores or touches user accounts');

  /* Bad inputs are rejected with errors, not crashes. */
  var bad1 = SCA.transfer.importBundle('this is not json');
  H.assert(bad1.ok === false, 'non-JSON refused');

  var bad2 = SCA.transfer.importBundle(JSON.stringify({
    app: 'some-other-app', kind: 'bundle', schema_version: 1,
    collections: { capabilities: [] }
  }));
  H.assert(bad2.ok === false, 'foreign app bundle refused');
  H.assert(SCA.transfer.validateBundle({ app: 'some-other-app', kind: 'bundle', collections: {} }).ok === false,
    'validation flags foreign app identifiers');
  H.assert(SCA.transfer.validateBundle({
    app: 'somali-capability-atlas', kind: 'bundle', schema_version: 1,
    collections: { families: [] } }).ok === true,
    'structural validation passes for a genuine bundle');

  var bad3 = SCA.transfer.importBundle(JSON.stringify({
    app: 'somali-capability-atlas', kind: 'bundle', schema_version: 999,
    collections: { families: [] }
  }));
  H.assert(bad3.ok === false, 'future schema version refused');

  var bad4 = SCA.transfer.importBundle(JSON.stringify({
    app: 'somali-capability-atlas', kind: 'bundle', schema_version: 1,
    collections: { users: [{ name: 'sneaky' }] }
  }));
  H.assert(bad4.ok === false, 'importing into users collection refused');

  /* Clean up: fresh state for anyone running suites afterwards. */
  SCA.store.wipe();
  SCA.store.init();
};
