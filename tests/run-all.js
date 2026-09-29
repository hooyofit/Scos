#!/usr/bin/env node
/*
 * Run all Step 1 test suites:
 *   node tests/run-all.js
 * Exits non-zero if anything fails. No external dependencies.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var H = require('./helpers');

/* 0. Syntax check: every JS file in the project must parse. */
console.log('  syntax check (all .js files)');
var root = path.join(__dirname, '..');
var files = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.git') { return; }
      walk(p);
    } else if (name.slice(-3) === '.js') {
      files.push(p);
    }
  });
}
walk(root);
var syntaxFailures = 0;
files.forEach(function (f) {
  try {
    var src = fs.readFileSync(f, 'utf8').replace(/^#!.*\n/, '');
    new Function(src);
  } catch (e) {
    syntaxFailures++;
    console.log('    SYNTAX FAIL: ' + f + ': ' + e.message);
  }
});
if (syntaxFailures) { process.exit(1); }
console.log('    ' + files.length + ' files parse cleanly');

/* 1. Logic suites. Each suite runs in a fresh store. */
var suites = [
  require('./validation.test.js'),
  require('./migration.test.js'),
  require('./rbac.test.js'),
  require('./export-import.test.js'),
  require('./storage-architecture.test.js'),
  require('./router-navigation.test.js'),
  require('./inventory-integrity.test.js'),
  require('./import-integrity.test.js'),
  require('./evidence-archive.test.js'),
  require('./field-research.test.js'),
  require('./practitioner-framework.test.js'),
  require('./capability-census.test.js'),
  require('./capability-graph.test.js'),
  require('./repair-network.test.js'),
  require('./recovery-system.test.js'),
  require('./intervention-system.test.js'),
  require('./pilot-system.test.js'),
  require('./measurement-system.test.js'),
  require('./marketplace-system.test.js'),
  require('./reserve-system.test.js'),
  require('./scenario-system.test.js'),
  require('./build-runtime-integrity.test.js')
];

var failed = 0;
suites.forEach(function (run) {
  try {
    run();
  } catch (e) {
    failed++;
    console.log('    suite failed: ' + e.message);
  }
});

var stats = H.stats();
console.log('');
console.log('  Checks: ' + stats.checks + ', failures: ' + (stats.failures + failed));
if (stats.failures + failed > 0) {
  console.log('  RESULT: FAIL');
  process.exit(1);
}
console.log('  RESULT: PASS');
