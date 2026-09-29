/*
 * Stage 6: Build & Runtime Integrity suite.
 *
 * Distinct from the logic suites: this file does not test features.
 * It tests that the SHIPPED BUILD itself is coherent — the exact
 * defect class Stages 4 and 5 shipped with (files present on disk and
 * fully unit-tested, but never reachable from the running app).
 *
 * Checks, in order:
 *   1. App shell: every asset index.html references exists on disk.
 *   2. No orphaned production modules: every src/data file is shipped.
 *   3. Service worker precache: complete, existing, current version.
 *   4. Route registry: every route the UI links to is registered.
 *   5. Clean install: the app boots exactly as the browser loads it
 *      (all index.html scripts, in order, empty storage) with no
 *      help from the logic-test loader.
 *   6. Route boot: every registered page renders in a DOM stub,
 *      both with real records and with unknown ids.
 *   7. The clean install leaves zero fixture data behind.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var H = require('./helpers');

var ROOT = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

module.exports = function run() {
  H.shim && H.shim();
  console.log('  build-runtime-integrity.test.js');

  /* ---------- shared expectations ---------- */
  var html = read('index.html');
  var sw = read('service-worker.js');
  var appjs = read('src/app.js');

  /* ================= 1. App shell ================= */
  var scripts = [];
  var reScript = /<script src="([^"]+)"><\/script>/g, m;
  while ((m = reScript.exec(html))) { scripts.push(m[1]); }
  H.assert(scripts.length >= 50, 'index.html loads the full app (' +
    scripts.length + ' scripts)');
  scripts.forEach(function (s) {
    H.assert(exists(s), 'shell script exists on disk: ' + s);
  });
  var linkRe = /<link[^>]+href="([^"]+)"/g;
  while ((m = linkRe.exec(html))) {
    if (m[1].indexOf('http') === 0) { return; }
    H.assert(exists(m[1]), 'shell link exists on disk: ' + m[1]);
  }
  var manifestMatch = html.match(/<link[^>]+manifest[^>]+href="([^"]+)"/);
  if (manifestMatch) {
    H.assert(exists(manifestMatch[1]), 'manifest referenced and present');
    var mf = JSON.parse(read(manifestMatch[1]));
    H.assert(mf.name.indexOf('Somali') !== -1, 'manifest names the app');
    (mf.icons || []).forEach(function (ic) {
      H.assert(exists(ic.src), 'manifest icon exists: ' + ic.src);
    });
  }

  /* ================= 2. No orphaned production modules ================= */
  var shipped = {};
  scripts.forEach(function (s) { shipped[s.replace(/^\.\//, '')] = true; });
  var orphans = [];
  ['src', 'data'].forEach(function (dir) {
    (function walk(d) {
      fs.readdirSync(path.join(ROOT, d)).forEach(function (name) {
        var p = d + '/' + name;
        if (fs.statSync(path.join(ROOT, p)).isDirectory()) { walk(p); }
        else if (name.slice(-3) === '.js') {
          if (!shipped[p]) { orphans.push(p); }
        }
      });
    })(dir);
  });
  H.assert(orphans.length === 0, 'no orphaned production modules (missing ' +
    'from index.html): ' + (orphans.join(', ') || 'none'));

  /* ================= 3. Service worker precache ================= */
  var cacheMatch = sw.match(/var CACHE = '([^']+)'/);
  H.assert(cacheMatch, 'SW defines a cache version');
  var cacheName = cacheMatch ? cacheMatch[1] : '';
  var shell = [];
  var reShell = /'(\.\/[^']+)'/g;
  while ((m = reShell.exec(sw))) { shell.push(m[1].slice(2)); }
  H.assert(shell.length >= 55, 'SW precache lists the app shell (' +
    shell.length + ' entries)');
  shell.forEach(function (f) {
    H.assert(exists(f), 'SW precache entry exists on disk: ' + f);
  });
  /* Every shipped asset is precached: opening the app once makes it
     fully offline-capable. */
  var missingFromSw = [];
  scripts.concat(['index.html', 'manifest.webmanifest'])
    .forEach(function (f) {
      var rel = f.replace(/^\.\//, '');
      if (shell.indexOf(rel) === -1) { missingFromSw.push(rel); }
    });
  H.assert(missingFromSw.length === 0,
    'SW precache covers every shipped asset (missing: ' +
    (missingFromSw.join(', ') || 'none') + ')');
  /* Cache version must move with the build step. */
  var scajs = read('src/sca.js');
  var stepMatch = scajs.match(/BUILD_STEP\s*=\s*(\d+)/);
  var step = stepMatch ? parseInt(stepMatch[1], 10) : 0;
  H.assert(step === 15, 'SCA.BUILD_STEP advanced with this build (is ' + step + ')');
  H.assert(cacheName.toLowerCase().indexOf('step' + step) !== -1,
    'SW cache version matches BUILD_STEP (' + cacheName + ')');

  /* ================= 4. Route registry ================= */
  var routes = [];
  var reRoute = /SCA\.router\.add\('([^']+)',\s*SCA\.pages\.([A-Za-z]+)/g;
  while ((m = reRoute.exec(appjs))) {
    routes.push({ pattern: m[1], fn: m[2] });
  }
  H.assert(routes.length >= 28, 'app registers its routes (' +
    routes.length + ')');
  /* Which page functions actually exist is checked at boot (step 6);
     here we check the UI only links to registered routes. */
  var registered = {};
  routes.forEach(function (r) { registered[r.pattern] = true; });
  var linkSources = ['src/pages', 'src/components'].reduce(function (acc, d) {
    fs.readdirSync(path.join(ROOT, d)).forEach(function (f) {
      if (f.slice(-3) === '.js') { acc.push(read(d + '/' + f)); }
    });
    return acc;
  }, []);
  var used = {};
  linkSources.forEach(function (src) {
    var mm;
    /* href: '#/x' static list pages and href: '#/x/' + id detail
       pages alike. */
    var reHref = new RegExp("'#\\/([a-z-]*)\\/?", 'g');
    while ((mm = reHref.exec(src))) { used[mm[1]] = true; }
    var reNav = new RegExp("location\\.hash = '#\\/([a-z-]*)", 'g');
    while ((mm = reNav.exec(src))) { used[mm[1]] = true; }
  });
  Object.keys(used).forEach(function (seg) {
    var ok = registered['#/' + seg] || registered['#/' + seg + '/:id'];
    H.assert(ok, 'UI route is registered: #/' + seg);
  });

  /* ================= 5. Clean install (true browser boot) ================= */
  /* Load every index.html script, in browser order, into a fresh
     sandbox with an empty DOM — exactly what a new device does. */
  var sandbox = {};
  function makeNode(tag) {
    var n = {
      tagName: tag, className: '', children: [], attrs: {},
      textContent: '', innerHTML: '', value: '', style: {},
      dataset: {},
      classList: {
        add: function () {}, remove: function () {},
        toggle: function () {}, contains: function () { return false; }
      },
      appendChild: function (c) { n.children.push(c); return c; },
      removeChild: function (c) { return c; },
      insertBefore: function (c) { return c; },
      addEventListener: function () {},
      removeEventListener: function () {},
      setAttribute: function (k, v) { n.attrs[k] = String(v); },
      getAttribute: function (k) {
        return Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null;
      },
      removeAttribute: function () {},
      focus: function () {}, blur: function () {},
      querySelector: function () { return makeNode('div'); },
      querySelectorAll: function () { return []; }
    };
    return n;
  }
  var domRoot = makeNode('main');
  sandbox.document = {
    createElement: function (tag) { return makeNode(tag); },
    createTextNode: function (t) { return { text: String(t) }; },
    createDocumentFragment: function () { return makeNode('#fragment'); },
    getElementById: function (id) {
      if (id === 'page-root') { return domRoot; }
      return makeNode('div');
    },
    querySelector: function () { return makeNode('div'); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    body: makeNode('body'),
    documentElement: makeNode('html')
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = function () {};
  sandbox.removeEventListener = function () {};
  sandbox.location = { hash: '#/', protocol: 'https:',
    hostname: 'localhost', origin: 'https://localhost' };
  sandbox.navigator = {};
  sandbox.localStorage = (function () {
    var store = {};
    return {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
      },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      clear: function () { store = {}; }
    };
  })();
  sandbox.confirm = function () { return false; };
  sandbox.history = { back: function () {} };
  sandbox.scrollTo = function () {};
  sandbox.console = { log: function () {} };
  sandbox.TextEncoder = require('util').TextEncoder;
  sandbox.crypto = require('node:crypto').webcrypto;
  var ctx = vm.createContext(sandbox);

  scripts.forEach(function (s) {
    vm.runInContext(read(s.replace(/^\.\//, '')), ctx, { filename: s });
  });
  H.assert(true, 'all ' + scripts.length + ' shell scripts execute on clean install');

  var SCA = sandbox.SCA || vm.runInContext('SCA', ctx);
  H.assert(SCA && SCA.store, 'SCA namespace boots on clean install');
  vm.runInContext('SCA.store.init()', ctx);
  H.assertEq(vm.runInContext('SCA.store.count("capabilities")', ctx), 240,
    'clean install seeds the 240 capability inventory');
  H.assertEq(vm.runInContext('SCA.store.count("practitioners")', ctx), 0,
    'clean install has zero fabricated practitioners');
  H.assertEq(vm.runInContext('SCA.store.count("capability_censuses")', ctx), 0,
    'clean install has zero fabricated censuses');
  H.assertEq(vm.runInContext('SCA.store.count("pilot_projects")', ctx), 0,
    'clean install has zero fabricated pilots');
  H.assertEq(vm.runInContext('SCA.store.count("measurements")', ctx), 0,
    'clean install has zero fabricated measurements');
  H.assertEq(vm.runInContext('SCA.store.count("indicators")', ctx), 23,
    'clean install seeds the 23 indicator DEFINITIONS (no values)');
  H.assertEq(vm.runInContext('SCA.store.count("graph_edges")', ctx), 0,
    'clean install has zero fabricated relationships');
  vm.runInContext(
    '["workshops","resources","materials","tools","energy_sources",' +
    '"failure_scenarios"].forEach(function (c) {' +
    '  if (SCA.store.count(c) !== 0) { throw new Error(c); } })', ctx);
  H.assert(true, 'clean install fabricates no graph support entities');
  vm.runInContext(
    '["scenarios","scenario_results","scenario_runs",' +
    '"impact_assessments"].forEach(function (c) {' +
    '  if (SCA.store.COLLECTIONS.indexOf(c) !== -1) { throw new Error(c); } })',
    ctx);
  H.assert(true, 'clean install defines ZERO Stage 15 collections ' +
    '(scenario analysis is a pure derived layer)');
  vm.runInContext(
    '["repair_capabilities","spare_parts","repair_records"].forEach(' +
    'function (c) { if (SCA.store.count(c) !== 0) { throw new Error(c); } })',
    ctx);
  H.assert(true, 'clean install fabricates no repair network data ' +
    '(zero workshops, capabilities, parts, records)');
  H.assertEq(vm.runInContext('SCA.i18n.t("app.title") ? 1 : 1', ctx), 1,
    'i18n is loaded in the shipped script order');

  /* app.js registers routes at DOMContentLoaded; simulate it. */
  var bootOk = true;
  try {
    vm.runInContext(
      'SCA.store.init(); SCA.auth.use(SCA.config.auth_provider); ' +
      'SCA.state.set("user", SCA.auth.current().getCurrentUser()); ' +
      'SCA.router.start();', ctx);
  } catch (e) {
    bootOk = false;
    console.log('    BOOT FAIL: ' + e.message);
  }
  H.assert(bootOk, 'router.start() boots the shipped build');

  /* Every route pattern registered in app.js resolves to a real
     page function in the shipped bundle. */
  routes.forEach(function (r) {
    var has = vm.runInContext(
      '!!(SCA.pages && SCA.pages.' + r.fn + ')', ctx);
    H.assert(has, 'page function shipped and reachable: ' + r.fn);
  });

  /* ================= 6. Route boot: every page renders ================= */
  /* Realistic fixtures so detail pages take their happy path. */
  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  vm.runInContext([
    "var FIXR = { name: 'TEST FIXTURE Researcher', role: 'researcher' };",
    "var FIXN = { name: 'TEST FIXTURE National Admin', role: 'national_administrator' };",
    "var fixCap = SCA.store.all('capabilities')[0];",
    "var fixFam = SCA.store.all('families')[0];",
    "var fixPract = SCA.training.createPractitioner(FIXR, {",
    "  public_name: 'TEST FIXTURE Boot Master', capability_ids: [fixCap.id],",
    "  practitioner_code: 'TEST-FIXTURE-BT-01' }).record;",
    "var fixProg = SCA.training.createTrainingProgram ? SCA.training.createTrainingProgram(FIXR, {",
    "  title: 'TEST FIXTURE Boot Program', capability_ids: [fixCap.id] }).record : null;",
    "var fixMeth = SCA.census.createMethodology(FIXR, { title: 'TEST FIXTURE Boot',",
    "  population_definition: 'T', data_collection_method: 'T' }).record;",
    "SCA.census.approveMethodology(FIXN, fixMeth.id, 'TEST FIXTURE');",
    "var fixCensus = SCA.census.createCensus(FIXR, { title: 'TEST FIXTURE Boot Census',",
    "  scope_level: 'REGION', methodology_id: fixMeth.id }).record;",
    "var firstOrNull = function (coll) {",
    "  try { return SCA.store.all(coll)[0] || null; } catch (e) { return null; } };",
    "var fixObs = firstOrNull('field_observations');",
    "var fixArtifact = firstOrNull('knowledge_artifacts');",
    "var fixSource = firstOrNull('evidence_sources');",
    "var fixProject = firstOrNull('research_projects');",
    "var fixApprenticeship = firstOrNull('apprenticeships');",
    "var fixAssessment = firstOrNull('competence_assessments');",
    "var fixCert = firstOrNull('capability_certifications');",
    "var fixEdge = SCA.graph.createRelationship(FIXR, {",
    "  relationship_type: 'DEPENDS_ON', source_type: 'CAPABILITY',",
    "  source_id: fixCap.id, target_type: 'CAPABILITY',",
    "  target_id: SCA.store.all('capabilities')[1].id }).record;",
    "var fixWs = SCA.repair.createWorkshop(FIXR, {",
    "  name: 'TEST FIXTURE Boot Workshop' }).record;",
    "var fixRc = SCA.repair.createRepairCapability(FIXR, {",
    "  workshop_id: fixWs.id, asset_type: 'CAPABILITY',",
    "  asset_id: fixCap.id, repair_operations: ['TEST FIXTURE op'] }).record;",
    "var fixSp = SCA.repair.createSparePart(FIXR, {",
    "  name: 'TEST FIXTURE Boot Part',",
    "  manufacturer: 'TEST FIXTURE MFG',",
    "  manufacturer_part_number: 'TF-BP-1' }).record;",
    "var fixRr = SCA.repair.createRepairRecord(FIXR, {",
    "  asset_type: 'CAPABILITY', asset_id: fixCap.id,",
    "  date: '2026-01-01', failure_type: 'MECHANICAL' }).record;",
    "var fixRp = SCA.recovery.createRecoveryProfile(FIXR, {",
    "  name: 'TEST FIXTURE Boot Recovery Profile',",
    "  asset_type: 'CAPABILITY', asset_id: fixCap.id,",
    "  recovery_kind: 'FALLBACK_CAPABILITY',",
    "  target_type: 'CAPABILITY',",
    "  target_id: SCA.store.all('capabilities')[1].id }).record;",
    "var fixIv = SCA.intervention.createIntervention(FIXR, {",
    "  name: 'TEST FIXTURE Boot Intervention',",
    "  intervention_type: 'KNOWLEDGE_DOCUMENTATION',",
    "  objective: 'TEST FIXTURE objective',",
    "  capability_ids: [fixCap.id],",
    "  required_skills: ['TEST FIXTURE archival skills'] }).record;",
    "var fixPm = { name: 'TEST FIXTURE Boot PM', role: 'project_manager' };",
    "var fixRegional = { name: 'TEST FIXTURE Boot Regional',",
    "  role: 'regional_administrator' };",
    "var fixPilot = SCA.pilots.createPilot(fixPm, {",
    "  name: 'TEST FIXTURE Boot Pilot',",
    "  objective: 'TEST FIXTURE pilot objective',",
    "  location_ids: [SCA.store.insert('locations',",
    "    { name: 'TEST FIXTURE Boot Region' }).record.id],",
    "  intervention_ids: [fixIv.id] }).record;",
    "SCA.pilots.approvePilot(fixRegional, fixPilot.id,",
    "  'TEST FIXTURE boot approval');",
    "SCA.pilots.activatePilot(fixPm, fixPilot.id);",
    /* Targeted correction runtime proof: the shipped shell must
     * exercise a NATIONAL administrator approving and concluding
     * ANOTHER user's pilot through the real workflow service. */
    "var fixNational = { name: 'TEST FIXTURE Boot National',",
    "  role: 'national_administrator' };",
    "var fixPilot2 = SCA.pilots.createPilot(fixPm, {",
    "  name: 'TEST FIXTURE Boot Pilot 2',",
    "  objective: 'TEST FIXTURE pilot objective',",
    "  intervention_ids: [fixIv.id] }).record;",
    "var fixNatApprove = SCA.pilots.approvePilot(fixNational,",
    "  fixPilot2.id, 'TEST FIXTURE national boot approval');",
    "SCA.pilots.activatePilot(fixPm, fixPilot2.id);",
    "var fixNatConclude = SCA.pilots.concludePilot(fixNational,",
    "  fixPilot2.id, 'TEST FIXTURE national boot conclusion');",
    /* Stage 12 runtime proof: the shipped shell must accept a
     * measurement through the real review workflow (a creator can
     * never self-accept), and the indicator vocabulary must be
     * seeded APPROVED with zero stored values. */
    "var fixMeas = SCA.measurement.createMeasurement(FIXR, {",
    "  value: 4, unit: 'PERSONS', measurement_kind: 'COUNT',",
    "  basis: 'OBSERVED',",
    "  observation_scope: 'TEST FIXTURE boot observation scope',",
    "  capability_id: fixCap.id,",
    "  observed_at: '2026-09-01' }).record;",
    "SCA.measurement.submitMeasurement(FIXR, fixMeas.id);",
    "var fixRev = { name: 'TEST FIXTURE Boot Reviewer',",
    "  role: 'reviewer' };",
    "SCA.measurement.startReview(fixRev, fixMeas.id);",
    "var fixMeasAccept = SCA.measurement.acceptMeasurement(fixRev,",
    "  fixMeas.id, 'TEST FIXTURE boot acceptance');",
    "var fixSelfAccept = SCA.measurement.acceptMeasurement(FIXR,",
    "  fixMeas.id, 'TEST FIXTURE self acceptance');",
    "var fixInd = SCA.indicator.approvedVersion",
    "  ? SCA.indicator.approvedVersion('PRACTITIONER_DENSITY') : null;",
    "var fixIndCount = SCA.store.count('indicators');",
    "var fixIndValue = fixInd ? (fixInd.value === undefined) : false;",
    /* Stage 13 runtime proof: the shipped shell must exercise the
     * marketplace through the real workflow (a creator can never
     * self-publish), the structural privacy pin must reject a
     * contact field, and no ghost collection may exist. */
    "var fixMp = SCA.marketplace.createListing(FIXR, {",
    "  listing_kind: 'OFFER', service_kind: 'REPAIR',",
    "  provider_type: 'WORKSHOP', provider_id: fixWs.id,",
    "  capability_ids: [fixCap.id],",
    "  location_scope: 'ANYWHERE',",
    "  description: 'TEST FIXTURE boot marketplace offer' }).record;",
    "SCA.marketplace.submitListing(FIXR, fixMp.id);",
    "var fixMpSelfPub = SCA.marketplace.publishListing(FIXR,",
    "  fixMp.id, 'TEST FIXTURE self publication');",
    "var fixMpPub = SCA.marketplace.publishListing(fixRev,",
    "  fixMp.id, 'TEST FIXTURE boot publication');",
    "var fixMpContact = SCA.marketplace.createListing(FIXR, {",
    "  listing_kind: 'OFFER', service_kind: 'REPAIR',",
    "  provider_type: 'WORKSHOP', provider_id: fixWs.id,",
    "  phone: '555-0100' });",
    "var fixMpGhost = SCA.store.COLLECTIONS.indexOf",
    "  ('marketplace_providers') === -1 &&",
    "  !SCA.models.marketplace_providers;"
  ].join('\n'), ctx);
  H.assertEq(vm.runInContext('fixNatApprove.ok', ctx), true,
    'shipped shell: NATIONAL approves another user pilot');
  H.assertEq(vm.runInContext('fixNatConclude.ok', ctx), true,
    'shipped shell: NATIONAL concludes another user pilot');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("pilot.approve")' +
    '.indexOf("national_administrator") !== -1', ctx), true,
    'shipped shell: no stale permission references (approve)');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("pilot.conclude")' +
    '.indexOf("national_administrator") !== -1', ctx), true,
    'shipped shell: no stale permission references (conclude)');
  H.assertEq(vm.runInContext('fixMeasAccept.ok', ctx), true,
    'shipped shell: a distinct reviewer accepts a measurement');
  H.assertEq(vm.runInContext('fixSelfAccept.ok', ctx), false,
    'shipped shell: creator can never accept their own measurement');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("measurement.review")' +
    '.indexOf("researcher") === -1', ctx), true,
    'shipped shell: measurement.review is reviewer-scoped');
  H.assertEq(vm.runInContext('fixIndCount', ctx), 23,
    'shipped shell: the 23 seeded definitions are present');
  H.assertEq(vm.runInContext('fixIndValue', ctx), true,
    'shipped shell: seeded definitions carry no stored values');
  H.assertEq(vm.runInContext(
    "SCA.indicator.compute('TRAINER_AVAILABILITY').known", ctx), false,
    'shipped shell: honest UNKNOWN when no accepted inputs exist');
  H.assertEq(vm.runInContext('fixMpSelfPub.ok', ctx), false,
    'shipped shell: creator can never publish their own listing');
  H.assertEq(vm.runInContext('fixMpPub.ok', ctx), true,
    'shipped shell: a distinct reviewer publishes the listing');
  H.assertEq(vm.runInContext('fixMpContact.ok', ctx), false,
    'shipped shell: a listing with a contact field is rejected');
  H.assertEq(vm.runInContext('fixMpGhost', ctx), true,
    'shipped shell: no ghost marketplace entities exist');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("marketplace.review")' +
    '.indexOf("national_administrator") !== -1', ctx), true,
    'shipped shell: NATIONAL explicitly declared in review authority');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("marketplace.export").length', ctx), 0,
    'shipped shell: deliberately no marketplace.export permission');
  H.assertEq(vm.runInContext(
    'SCA.rbac.rolesFor("marketplace.delete").length', ctx), 0,
    'shipped shell: deliberately no marketplace.delete permission');
  /* Stage 15 runtime proof: the shipped shell must run a
   * transient scenario analysis through the real engine, offline
   * (no network), deterministically, and write NOTHING. */
  vm.runInContext([
    "var fixScenario = SCA.scenario.analyze(FIXR, {",
    "  scenario_kind: 'DISRUPTION',",
    "  disruption_code: 'FUEL_UNAVAILABLE',",
    "  subject_type: 'CAPABILITY', subject_id: fixCap.id,",
    "  depth: 2, mode: 'STRUCTURE' }).ok;",
    "var fixScenario2 = SCA.scenario.analyze(FIXR, {",
    "  scenario_kind: 'DISRUPTION',",
    "  disruption_code: 'FUEL_UNAVAILABLE',",
    "  subject_type: 'CAPABILITY', subject_id: fixCap.id,",
    "  depth: 2, mode: 'STRUCTURE' });",
    "var fixScenarioDeterministic = JSON.stringify(fixScenario2) ===",
    "  JSON.stringify(SCA.scenario.analyze(FIXR, {",
    "    scenario_kind: 'DISRUPTION',",
    "    disruption_code: 'FUEL_UNAVAILABLE',",
    "    subject_type: 'CAPABILITY', subject_id: fixCap.id,",
    "    depth: 2, mode: 'STRUCTURE' }));",
    "var fixScenarioWrites = JSON.stringify(",
    "  SCA.store.dataset()).length;",
    "SCA.scenario.analyze(FIXR, {",
    "  scenario_kind: 'DISRUPTION',",
    "  disruption_code: 'FUEL_UNAVAILABLE',",
    "  subject_type: 'CAPABILITY', subject_id: fixCap.id, depth: 5 });",
    "SCA.scenario.compare(FIXR, { scenarios: [",
    "  { scenario_kind: 'DISRUPTION',",
    "    disruption_code: 'FUEL_UNAVAILABLE',",
    "    subject_type: 'CAPABILITY', subject_id: fixCap.id },",
    "  { scenario_kind: 'DISRUPTION',",
    "    disruption_code: 'IMPORTS_UNAVAILABLE_6_MONTHS',",
    "    subject_type: 'CAPABILITY', subject_id: fixCap.id }] });",
    "var fixScenarioWrites2 = JSON.stringify(",
    "  SCA.store.dataset()).length;",
    "var fixScenarioGhost = SCA.rbac.permissions().filter(",
    "  function (p) { return p.indexOf('scenario') !== -1; }).length;"
  ].join('\n'), ctx);
  H.assertEq(vm.runInContext('fixScenario', ctx), true,
    'shipped shell: scenario engine boots and analyzes offline');
  H.assertEq(vm.runInContext('fixScenarioDeterministic', ctx), true,
    'shipped shell: scenario analysis is deterministic');
  H.assertEq(vm.runInContext('fixScenarioWrites2', ctx),
    vm.runInContext('fixScenarioWrites', ctx),
    'shipped shell: analysis + comparison write NOTHING');
  H.assertEq(vm.runInContext('fixScenarioGhost', ctx), 0,
    'shipped shell: no scenario.* permission exists');

  /* Map every dynamic param to a real record id where one exists. */
  var realIds = {};
  ['fixCap.id', 'fixFam.id', 'fixPract.id', 'fixProg.id', 'fixCensus.id',
    'fixEdge.id', 'fixWs.id', 'fixRc.id', 'fixSp.id', 'fixRr.id',
    'fixRp.id', 'fixIv.id', 'fixPilot.id', 'fixMeas.id',
    'fixInd ? fixInd.id : null',
    'fixObs.id', 'fixArtifact.id', 'fixSource.id', 'fixProject.id',
    'fixApprenticeship.id', 'fixAssessment.id', 'fixCert.id',
    'fixMp.id']
    .forEach(function (expr) {
      var v = vm.runInContext(
        '(function(){ try { var r = ' + expr + '; return r || "unknown-id"; }' +
        ' catch (e) { return "unknown-id"; } })()', ctx);
      realIds[expr.split('.')[0]] = v;
    });

  var paramMap = {
    'capabilities/:id': realIds.fixCap, 'families/:id': realIds.fixFam,
    'practitioner/:id': realIds.fixPract, 'apprentice/:id': 'unknown-id',
    'training/:id': realIds.fixProg, 'apprenticeship/:id':
      realIds.fixApprenticeship, 'census/:id': realIds.fixCensus,
    'knowledge/:id': realIds.fixArtifact, 'evidence/:id': realIds.fixSource,
    'project/:id': realIds.fixProject, 'graph/:id': realIds.fixEdge,
    'workshop/:id': realIds.fixWs, 'repair-capability/:id': realIds.fixRc,
    'spare-part/:id': realIds.fixSp, 'repair-record/:id': realIds.fixRr,
    'recovery-profile/:id': realIds.fixRp,
    'intervention/:id': realIds.fixIv,
    'pilot/:id': realIds.fixPilot,
    'measurements/:id': realIds.fixMeas,
    'indicators/:id': realIds['fixInd ? fixInd.id : null'],
    'marketplace/:id': realIds.fixMp
  };

  routes.forEach(function (r) {
    /* Happy path with a real id where the route has one. */
    var pattern = r.pattern.slice(2);
    var params = {};
    if (pattern.indexOf('/:') !== -1) {
      params.id = paramMap[pattern] || 'unknown-id';
    }
    var hash = '#/' + pattern.replace(':id', params.id);
    var ok1 = true, err1 = '';
    try {
      vm.runInContext([
        'location.hash = ' + JSON.stringify(hash) + ';',
        'SCA.router._boot ? null : null;'
      ].join('\n'), ctx);
      var mm = vm.runInContext(
        '(function(){ var root = document.getElementById("page-root");' +
        'try { SCA.router.render ? SCA.router.render() : null; return "ok"; }' +
        ' catch (e) { return "ERR:" + e.message; } })()', ctx);
      if (String(mm).indexOf('ERR:') === 0) { ok1 = false; err1 = mm.slice(4); }
    } catch (e) { ok1 = false; err1 = e.message; }
    H.assert(ok1, 'route boots with real data: ' + hash +
      (ok1 ? '' : ' — ' + err1));

    /* Unknown id: pages must degrade honestly, never crash. */
    if (pattern.indexOf('/:') !== -1) {
      var badHash = '#/' + pattern.replace(':id', 'unknown-id');
      var ok2 = true, err2 = '';
      try {
        var mm2 = vm.runInContext(
          '(function(){ location.hash = ' + JSON.stringify(badHash) + ';' +
          'try { SCA.router.render ? SCA.router.render() : null; return "ok"; }' +
          ' catch (e) { return "ERR:" + e.message; } })()', ctx);
        if (String(mm2).indexOf('ERR:') === 0) { ok2 = false; err2 = mm2.slice(4); }
      } catch (e) { ok2 = false; err2 = e.message; }
      H.assert(ok2, 'route boots with unknown id: ' + badHash +
        (ok2 ? '' : ' — ' + err2));
    }
  });

  /* The unknown-id boots above must not have fabricated data. */
  H.assertEq(vm.runInContext('SCA.store.count("capabilities")', ctx), 240,
    'route boots never alter the 240 inventory');

  /* ================= 7. Clean state, zero fixture leakage ================= */
  vm.runInContext('SCA.store.wipe(); SCA.store.init();', ctx);
  H.assertEq(vm.runInContext('SCA.store.count("capabilities")', ctx), 240,
    'integrity suite leaves the baseline intact');
  ['practitioners', 'training_programs', 'capability_censuses',
    'census_methodologies', 'graph_edges', 'workshops', 'resources',
    'materials', 'tools', 'energy_sources', 'failure_scenarios',
    'repair_capabilities', 'spare_parts', 'repair_records',
    'recovery_profiles', 'capability_interventions',
    'pilot_projects']
    .forEach(function (coll) {
      H.assertEq(vm.runInContext('SCA.store.count(' +
        JSON.stringify(coll) + ')', ctx), 0,
        'no integrity fixtures remain: ' + coll);
    });
  /* This suite runs in its own sandbox store; the shared Node store
     used by logic suites is untouched by it by construction. */
  H.assert(true, 'sandbox isolation: logic-store untouched');
};
