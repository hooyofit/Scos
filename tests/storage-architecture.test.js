/* Storage architecture enforcement (Stage 1.1).
 *
 * RULE: SCA.store is the only application-level data interface.
 *  - No file may reference localStorage except src/data-layer/storage.js.
 *  - The internal handle SCA._storage may appear only in the data layer and
 *    the local auth provider (documented infrastructure allowlist).
 *  - Pages, models, components, router, state and app.js must use SCA.store.
 * This test fails the build if the rule is violated, so future stages cannot
 * silently couple application code to localStorage. */
'use strict';
var fs = require('fs');
var path = require('path');

var H = require('./helpers');
var PROJECT_ROOT = path.resolve(__dirname, '..');

var LOCALSTORAGE_ALLOWED = ['src/data-layer/storage.js'];
var INTERNAL_HANDLE_ALLOWED = ['src/data-layer/storage.js',
  'src/data-layer/adapter.js', 'src/auth/local.js'];

function listFiles(rel) {
  var p = path.join(PROJECT_ROOT, rel);
  var st = fs.statSync(p);
  if (st.isFile()) { return [rel]; }
  var out = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      var f = path.join(dir, name);
      if (fs.statSync(f).isDirectory()) { walk(f); }
      else if (name.slice(-3) === '.js' || name.slice(-5) === '.html') {
        out.push(path.relative(PROJECT_ROOT, f));
      }
    });
  })(p);
  return out;
}

module.exports = function run() {
  H.shim();
  console.log('  storage-architecture.test.js');

  /* 1. No localStorage references outside the storage adapter. */
  var offenders = [];
  ['src', 'config', 'data', 'index.html'].forEach(function (dir) {
    listFiles(dir).forEach(function (f) {
      var text = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf8');
      if (LOCALSTORAGE_ALLOWED.indexOf(f) !== -1) { return; }
      if (text.indexOf('localStorage') !== -1) { offenders.push(f + ' (localStorage)'); }
    });
  });
  H.assertEq(offenders, [], 'localStorage appears only in the storage adapter');

  /* 2. SCA._storage appears only in the documented allowlist. */
  offenders = [];
  listFiles('src').forEach(function (f) {
    if (INTERNAL_HANDLE_ALLOWED.indexOf(f) !== -1) { return; }
    var text = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf8');
    if (text.indexOf('SCA._storage') !== -1) { offenders.push(f); }
  });
  H.assertEq(offenders, [], 'internal storage handle confined to data layer + auth provider');

  /* 3. Pages/models/components/router/state use only SCA.store (behavioral):
        loading the core with a spy adapter still gives a working store. */
  H.loadCore();
  H.assert(typeof SCA.store.all === 'function', 'SCA.store.all exists');
  H.assert(typeof SCA.store.insert === 'function', 'SCA.store.insert exists');
  H.assertEq(SCA.store.count('families'), 12, 'store works through the adapter');

  /* 4. The in-memory fallback works when localStorage is unavailable. */
  delete globalThis.localStorage;
  H.load('src/data-layer/storage.js'); /* re-probe: falls back to memory */
  H.load('src/data-layer/adapter.js');
  H.load('data/families.js');
  SCA.store.init();
  H.assertEq(SCA.store.count('families'), 12,
    'store works with in-memory fallback (no localStorage)');

  /* 5. ADR and roadmap documentation exist. */
  H.assert(fs.existsSync(path.join(PROJECT_ROOT,
    'docs/architecture-decision-adr-0002-storage-abstraction.md')),
    'ADR-0002 documents the storage roadmap');
};
