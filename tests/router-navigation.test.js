/* Router navigation tests: declared routes must resolve (F1 regression suite).
 *
 * F1 root cause (Stage 15 frozen build): router.add() stored patterns with
 * their leading '#', while match() strips the '#' from location.hash before
 * comparing — so the first segment of every pattern ('#') never equaled the
 * first segment of every hash (''), and every route rendered "Page not found".
 *
 * This suite pins the corrected behavior: every pattern declared in app.js
 * must match when used as a location hash, and every navbar link must resolve
 * to a declared route.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var H = require('./helpers');

var PROJECT_ROOT = path.resolve(__dirname, '..');

module.exports = function run() {
  H.shim();
  H.load('src/sca.js');
  /* Minimal ui stub: only needed if a deliberate 404 renders. */
  SCA.ui = {
    el: function () { return { appendChild: function (c) { return c; } }; },
    emptyState: function (o) { return o; }
  };
  H.load('src/router/router.js');
  console.log('  router-navigation.test.js');

  function noop() {}

  /* --- R1: root route resolves -------------------------------------- */
  SCA.router.add('#/', noop);
  var m1 = SCA.router.match('#/');
  H.assert(m1 !== null, 'root pattern "#/" matches hash "#/"');
  H.assert(m1.handler === noop, 'root match returns the registered handler');
  H.assertEq(Object.keys(m1.params).length, 0, 'root match has no params');

  /* --- R2: static route resolves ------------------------------------ */
  SCA.router.add('#/capabilities', noop);
  H.assert(SCA.router.match('#/capabilities') !== null,
    'static pattern "#/capabilities" matches its hash');

  /* --- R3: param route resolves ------------------------------------- */
  SCA.router.add('#/capabilities/:id', noop);
  var m3 = SCA.router.match('#/capabilities/cap-R04');
  H.assert(m3 !== null, 'param route "#/capabilities/:id" matches a real id');
  H.assertEq(m3.params.id, 'cap-R04', 'param extracts the id segment');

  /* --- R4: params are URI-decoded ----------------------------------- */
  var m4 = SCA.router.match('#/capabilities/a%20b');
  H.assert(m4 !== null && m4.params.id === 'a b',
    'params are decodeURIComponent-ed');

  /* --- R5: invalid hash still fails (404 preserved) ----------------- */
  H.assert(SCA.router.match('#/this-route-does-not-exist') === null,
    'undeclared hash returns null (Page not found preserved)');

  /* --- R6: patterns without a leading # are accepted too ------------ */
  SCA.router.add('/plain', noop);
  H.assert(SCA.router.match('#/plain') !== null,
    'pattern without leading # also resolves (harmless normalization)');

  /* --- R7: F1 regression — every declared app.js route resolves ----- */
  var appSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app.js'), 'utf8');
  var re = /SCA\.router\.add\('([^']+)',/g;
  var patterns = [];
  var mm;
  while ((mm = re.exec(appSrc)) !== null) { patterns.push(mm[1]); }
  H.assert(patterns.length >= 28,
    'app.js declares its routes (' + patterns.length + ' found)');

  /* A fresh router so the extraction tests are self-contained. */
  H.shim();
  delete SCA.router;
  H.load('src/router/router.js');
  patterns.forEach(function (p) { SCA.router.add(p, noop); });
  patterns.forEach(function (p) {
    H.assert(SCA.router.match(p) !== null,
      'declared pattern resolves as a hash: ' + p);
  });

  /* Detail patterns resolve with a sample id. */
  patterns.forEach(function (p) {
    if (p.indexOf(':') === -1) { return; }
    H.assert(SCA.router.match(p.replace(/:id/, 'sample-id')) !== null,
      'declared detail pattern resolves with an id: ' + p);
  });

  /* --- R8: every navbar link resolves to a declared route ----------- */
  var navSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/navbar.js'),
    'utf8');
  var reNav = /\{ hash: '(#[^']+)',/g;
  var navHashes = [];
  while ((mm = reNav.exec(navSrc)) !== null) { navHashes.push(mm[1]); }
  H.assert(navHashes.length >= 19,
    'navbar declares its primary links (' + navHashes.length + ' found)');
  navHashes.forEach(function (h) {
    H.assert(SCA.router.match(h) !== null,
      'navbar link resolves to a declared route: ' + h);
  });

  /* --- R9: a hash with an extra segment does not false-match -------- */
  H.assert(SCA.router.match('#/capabilities/cap-R04/extra') === null,
    'overlong hash returns null (segment count enforced)');
};
