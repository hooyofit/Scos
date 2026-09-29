/*
 * Schema migration framework.
 * Every dataset records its schema_version. Migrations are registered as
 * { to_version, description, up(dataset), down(dataset) } and applied in
 * order, with rollback support. Exported/imported bundles therefore remain
 * compatible across future build steps.
 */
(function (SCA) {
  'use strict';
  var registered = [];

  function currentVersion(dataset) {
    return (dataset && dataset.schema_version) || 1;
  }

  /* Apply all pending migrations up to targetVersion (default: this build). */
  function migrate(dataset, targetVersion) {
    var target = targetVersion || SCA.SCHEMA_VERSION;
    if (!dataset) { dataset = { schema_version: 1, collections: {} }; }
    var applied = [];
    var v = currentVersion(dataset);

    if (v > target) {
      return {
        dataset: dataset,
        applied: applied,
        error: 'Dataset schema version ' + v + ' is newer than this build supports (' + target + ').'
      };
    }

    registered.forEach(function (m) {
      if (m.to_version <= v || m.to_version > target) { return; }
      m.up(dataset);
      dataset.schema_version = m.to_version;
      applied.push({ to_version: m.to_version, description: m.description });
      v = m.to_version;
    });

    return { dataset: dataset, applied: applied, error: null };
  }

  /* Roll the dataset back to toVersion by applying down() in reverse order. */
  function rollback(dataset, toVersion) {
    var target = toVersion || 1;
    var applied = [];
    var v = currentVersion(dataset);

    for (var i = registered.length - 1; i >= 0; i--) {
      var m = registered[i];
      if (m.to_version > v || m.to_version <= target) { continue; }
      m.down(dataset);
      dataset.schema_version = m.to_version - 1;
      applied.push({ to_version: m.to_version, description: m.description });
      v = m.to_version - 1;
    }
    return { dataset: dataset, applied: applied, error: null };
  }

  SCA.migrations = {
    register: function (m) {
      if (!m || typeof m.up !== 'function' || typeof m.down !== 'function' ||
          typeof m.to_version !== 'number') {
        throw new Error('Invalid migration definition.');
      }
      registered.push(m);
    },
    all: function () { return registered.slice(); },
    currentVersion: currentVersion,
    migrate: migrate,
    rollback: rollback
  };
})(SCA);
