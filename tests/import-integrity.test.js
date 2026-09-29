/* Stage 2.1 corrections: status semantics and atomic import integrity.
 *
 * Covers the seven required Stage 2.1 checks:
 *  1. S0 is accepted as a valid living_status.
 *  2. S0 is displayed as Unknown / not yet documented.
 *  3. capability_maturity may remain null.
 *  4. capabilities-only export/import cannot create unresolved family refs.
 *  5. Failed imports do not partially modify the dataset.
 *  6. Full export -> wipe -> import restores all 240 capabilities and 12 families.
 *  7. (Existing suites continue to pass — enforced by run-all.)
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  import-integrity.test.js');

  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline: 240 capabilities');

  var fam = SCA.store.all('families')[0];
  var sample = SCA.store.all('capabilities')[0];

  /* 1. S0 is accepted as a valid living_status. */
  var okS0 = SCA.models.capability.validate(Object.assign({}, sample, {
    living_status: 'S0' }));
  H.assert(okS0.valid === true, 'S0 is a valid living_status');
  var badStatus = SCA.models.capability.validate(Object.assign({}, sample, {
    living_status: 'S99' }));
  H.assert(badStatus.valid === false, 'invalid status codes are still rejected');
  var freeText = SCA.models.capability.validate(Object.assign({}, sample, {
    living_status: 'Not yet documented' }));
  H.assert(freeText.valid === false,
    'free-text status in an enum field is rejected (ADR-0003 rule 6)');

  /* 2. S0 is displayed as Unknown / not yet documented. */
  H.assertEq(SCA.enums.label(SCA.enums.living_status, 'S0'),
    'Unknown / not yet documented', 'S0 label explains its meaning');

  /* 3. capability_maturity may remain null. */
  H.assertEq(sample.capability_maturity, null, 'inventory records carry null maturity');
  var okMaturity = SCA.models.capability.validate(Object.assign({}, sample, {
    capability_maturity: null }));
  H.assert(okMaturity.valid === true, 'null capability_maturity is valid');

  /* 4. capabilities-only export/import cannot create unresolved family refs.
       New format: the export carries the referenced families automatically. */
  var text = SCA.transfer.exportCollection('capabilities');
  var pkg = JSON.parse(text);
  H.assertEq(pkg.records.length, 240, 'capabilities-only export holds 240 records');
  H.assert(pkg.referenced && pkg.referenced.families.length === 12,
    'capabilities-only export carries the 12 referenced families');

  SCA.store.wipe();
  H.assertEq(SCA.store.count('capabilities'), 0, 'store emptied');
  var resNew = SCA.transfer.importBundle(text);
  H.assert(resNew.ok === true, 'new-format capabilities-only import succeeds into empty store');
  H.assertEq(SCA.store.count('capabilities'), 240, '240 capabilities restored');
  H.assertEq(SCA.store.count('families'), 12, '12 families restored automatically');
  var famIds = {};
  SCA.store.all('families').forEach(function (f) { famIds[f.id] = true; });
  H.assert(SCA.store.all('capabilities').every(function (c) { return famIds[c.family_id]; }),
    'every family reference resolves after standalone import');

  /* Old-style export (no referenced families) is rejected atomically. */
  /* Stage 4 note: family/capability ids are now deterministic ('fam-W'
     style), so a re-seeded store WOULD resolve the exported family ids.
     To keep exercising the original intent (old-format file whose family
     references do not resolve -> atomic rejection), the fixture points
     its first record at a family id that cannot exist. */
  var staleRecords = JSON.parse(JSON.stringify(pkg.records));
  staleRecords[0].family_id = 'fam-DOES-NOT-EXIST-FIXTURE';
  var oldStyle = JSON.stringify({
    app: 'somali-capability-atlas',
    kind: 'collection',
    collection: 'capabilities',
    schema_version: 1,
    records: staleRecords
  });
  SCA.store.wipe();
  var before = JSON.stringify(SCA.store.dataset());
  var resOld = SCA.transfer.importBundle(oldStyle);
  H.assert(resOld.ok === false, 'old-format import without families is rejected');
  H.assert(resOld.errors.length >= 1 &&
    resOld.errors[0].indexOf('families') !== -1,
    'rejection explains the missing families dependency');
  H.assertEq(JSON.stringify(SCA.store.dataset()), before,
    'rejected import changed nothing (store still empty)');

  /* 5. Failed imports never partially modify a NON-empty dataset. */
  SCA.store.wipe();
  SCA.store.init();
  var beforeFull = JSON.stringify(SCA.store.dataset());
  var resBad = SCA.transfer.importBundle(oldStyle);
  H.assert(resBad.ok === false, 'old-format import rejected against a full store too');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeFull,
    'full store unchanged after rejected import');
  var resNotJson = SCA.transfer.importBundle('this is not json');
  H.assert(resNotJson.ok === false, 'non-JSON import rejected');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeFull,
    'store unchanged after non-JSON import');
  var resForeign = SCA.transfer.importBundle(JSON.stringify({
    app: 'some-other-app', kind: 'bundle', schema_version: 1,
    collections: { capabilities: [] } }));
  H.assert(resForeign.ok === false, 'foreign app import rejected');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeFull,
    'store unchanged after foreign import');

  /* A families-only export missing one family would orphan the 20
     capabilities in that family: must be rejected atomically too. */
  var famText = JSON.parse(SCA.transfer.exportCollection('families'));
  var probe = SCA.store.all('capabilities')[0];
  var probeId = probe.id;
  famText.records = famText.records.filter(function (f) { return f.id !== probe.family_id; });
  var resFam = SCA.transfer.importBundle(JSON.stringify(famText));
  H.assert(resFam.ok === false,
    'families-only import that orphans capabilities is rejected');
  H.assertEq(SCA.store.count('capabilities'), 240, 'capabilities untouched by rejection');
  H.assert(SCA.store.get('capabilities', probeId) !== null, 'records untouched');

  /* 6. Full export -> wipe -> import restores 240 + 12. */
  var bundleText = SCA.transfer.exportAll();
  SCA.store.wipe();
  var resFull = SCA.transfer.importBundle(bundleText);
  H.assert(resFull.ok === true, 'full bundle import succeeds');
  H.assertEq(SCA.store.count('capabilities'), 240, '240 capabilities after full round trip');
  H.assertEq(SCA.store.count('families'), 12, '12 families after full round trip');

  /* The 240 records themselves are unchanged by Stage 2.1 (no record edits). */
  var caps = SCA.store.all('capabilities');
  var e0 = caps.filter(function (c) { return c.evidence_level === 'E0' &&
    c.verification_status === 'Unverified' && c.living_status === 'S0' &&
    c.capability_maturity === null && c.version === '1'; });
  H.assertEq(e0.length, 240, 'all 240 records keep the E0/S0/null-maturity baseline');

  /* Standard baseline for any later suites. */
  SCA.store.wipe();
  SCA.store.init();
};
