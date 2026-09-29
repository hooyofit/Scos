/*
 * Shared test helpers: browser shims for Node and a loader that mirrors
 * the script order in index.html (the subset needed for logic tests).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

/* In-memory localStorage shim. */
function makeLocalStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    clear: function () { m = {}; }
  };
}

var PROJECT_ROOT = path.resolve(__dirname, '..');

function shim() {
  globalThis.window = globalThis;
  globalThis.localStorage = makeLocalStorage();
  if (!globalThis.TextEncoder) {
    globalThis.TextEncoder = require('util').TextEncoder;
  }
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    globalThis.crypto = require('node:crypto').webcrypto;
  }
}

/* Load an app file into the global context, in the same order as index.html. */
function load(rel) {
  var abs = path.join(PROJECT_ROOT, rel);
  var src = fs.readFileSync(abs, 'utf8');
  vm.runInThisContext(src, { filename: rel });
}

/* Loads all files needed for logic (non-DOM) testing. */
function loadCore() {
  shim();
  load('src/sca.js');
  load('config/app.config.js');
  load('src/i18n.js');
  load('src/data-layer/storage.js');
  load('src/data-layer/migration.js');
  load('src/models/enums.js');
  load('src/rbac/roles.js');
  load('src/rbac/permissions.js');
  load('src/models/shared.js');
  load('src/models/user.js');
  load('src/models/family.js');
  load('src/models/capability.js');
  load('src/models/practitioner.js');
  load('src/models/apprentice.js');
  load('src/models/evidence.js');
  load('src/models/location.js');
  load('src/models/knowledge-artifact.js');
  load('src/models/claim.js');
  load('src/models/consent.js');
  load('src/models/audit-log.js');
  load('src/models/research-project.js');
  load('src/models/research-session.js');
  load('src/models/field-observation.js');
  load('src/models/field-note.js');
  load('src/models/research-participant.js');
  load('src/models/field-media.js');
  load('src/models/research-queue.js');
  load('src/models/census-methodology.js');
  load('src/models/capability-census.js');
  load('src/models/census-observation.js');
  load('src/models/census-snapshot.js');
  load('src/models/geographic-redundancy.js');
  load('src/models/graph-edge.js');
  load('src/models/workshop.js');
  load('src/models/resource.js');
  load('src/models/material.js');
  load('src/models/tool.js');
  load('src/models/energy-source.js');
  load('src/models/failure-scenario.js');
  load('src/graph/registry.js');
  load('src/data-layer/adapter.js');
  load('src/data-layer/transfer.js');
  load('src/audit/audit.js');
  load('src/evidence/workflow.js');
  load('src/research/queue.js');
  load('src/research/workflow.js');
  load('src/training/workflow.js');
  load('src/census/workflow.js');
  load('src/graph/workflow.js');
  load('data/families.js');
  load('data/capabilities.js');
  load('src/auth/interface.js');
  load('src/auth/local.js');
}

/* Minimal assertion helpers. */
var failures = 0;
var checks = 0;
function assert(cond, label) {
  checks++;
  if (!cond) {
    failures++;
    console.log('    FAIL: ' + label);
    throw new Error('assertion failed: ' + label);
  }
}
function assertEq(actual, expected, label) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log('    FAIL: ' + label);
    console.log('      expected: ' + JSON.stringify(expected));
    console.log('      actual:   ' + JSON.stringify(actual));
    throw new Error('assertion failed: ' + label);
  }
}

module.exports = {
  makeLocalStorage: makeLocalStorage,
  load: load,
  loadCore: loadCore,
  shim: shim,
  assert: assert,
  assertEq: assertEq,
  stats: function () { return { checks: checks, failures: failures }; }
};
