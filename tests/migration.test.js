/* Migration framework tests: up, down, version checks. */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  migration.test.js');

  var ds = {
    schema_version: 1,
    collections: {
      families: [{ id: 'a', name: 'Water & Hydrology', code: 'FAM-01' }]
    }
  };

  SCA.migrations.register({
    to_version: 2,
    description: 'test migration: add notes field',
    up: function (dataset) {
      dataset.collections.families.forEach(function (f) { f.notes = null; });
    },
    down: function (dataset) {
      dataset.collections.families.forEach(function (f) { delete f.notes; });
    }
  });

  var up = SCA.migrations.migrate(ds, 2);
  H.assert(up.error === null, 'no migration error');
  H.assertEq(up.dataset.schema_version, 2, 'version bumped to 2');
  H.assert(up.applied.length === 1, 'one migration applied');
  H.assert(up.dataset.collections.families[0].notes === null, 'up transformer ran');

  var down = SCA.migrations.rollback(up.dataset, 1);
  H.assertEq(down.dataset.schema_version, 1, 'rollback restores version 1');
  H.assert(!('notes' in down.dataset.collections.families[0]), 'down transformer ran');

  /* Migrating to the current build version is a no-op when already there. */
  var noop = SCA.migrations.migrate({ schema_version: SCA.SCHEMA_VERSION, collections: {} });
  H.assert(noop.applied.length === 0 && noop.error === null, 'no pending migrations at current version');

  /* A dataset from the future is refused, not corrupted. */
  var future = SCA.migrations.migrate({ schema_version: 99, collections: {} }, SCA.SCHEMA_VERSION);
  H.assert(future.error !== null, 'newer dataset refused with error');

  /* Default target is this build's schema version. */
  var def = SCA.migrations.migrate({ schema_version: 1, collections: { families: [] } });
  H.assertEq(def.dataset.schema_version, SCA.SCHEMA_VERSION, 'default migration reaches current version');
};
