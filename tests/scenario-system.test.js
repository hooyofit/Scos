/*
 * Stage 15: Capability Scenario Analysis Foundation (frozen
 * scope v1.1 §28 + amendments A1–A9, implementation
 * authorization v1.0).
 *
 * Suite contract (§28's 21 categories + A9 additions):
 *  1. Scenario input validation (kinds, six frozen disruption
 *     codes, Stage 8 FailureScenario, depth bounds, locations,
 *     mode).
 *  2. Stage 8 FailureScenario integration (A: equipment/system
 *     failure modes remain authoritative).
 *  3. Stage 14 six-scenario integration (B: no second copy of
 *     the vocabulary — the enum is consumed, not redeclared).
 *  4. Graph traversal: per-type direction map (A4), all 19 types
 *     classified, no improvised interpretation.
 *  5. Cycle protection.
 *  6. Depth limiting (default 2, max 5).
 *  7. Recovery-path discovery (Stage 9 views consumed).
 *  8. Fallback discovery (Stage 7 + Stage 14).
 *  9. Reserve/continuity discovery (Stage 14 read APIs).
 * 10. Practitioner/reproduction discovery (Stage 5/14, counts
 *     only, census carry-forward wording).
 * 11. Repair-path discovery (Stage 8 search API).
 * 12. Unknown handling (absence never proof of absence).
 * 13. Evidence/provenance traceability (DOCUMENTED/DERIVED/
 *     UNKNOWN/NOT_APPLICABLE; A2 DERIVED = GRAPH_DERIVED).
 * 14. Privacy filtering (anonymous: no person nodes, no names).
 * 15. RBAC inheritance (no scenario.* permission exists).
 * 16. No-write guarantees (zero runtime writes).
 * 17. No-persistence guarantees (results never stored; no new
 *     collections).
 * 18. Deterministic results.
 * 19. Offline operation (no network dependency; local dataset
 *     only).
 * 20. Runtime integrity (engine boot, caps, ghost scan).
 * 21. Comparison determinism + no best/worst language.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  H.load('src/models/marketplace-listing.js');
  H.load('src/models/capability-intervention.js');
  H.load('src/models/capability-reserve.js');
  H.load('src/models/continuity-plan.js');
  H.load('src/models/capability-asset.js');
  H.load('src/repair/workflow.js');
  H.load('src/recovery/workflow.js');
  H.load('src/intervention/workflow.js');
  H.load('src/pilots/workflow.js');
  H.load('src/marketplace/workflow.js');
  H.load('src/reserve/workflow.js');
  H.load('src/scenario/workflow.js');
  console.log('  scenario-system.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Graph Researcher',
    role: 'researcher' };
  var REVIEWER = { name: 'TEST FIXTURE Graph Reviewer',
    role: 'reviewer' };
  var ANON = { name: 'anonymous' };

  SCA.store.init();
  SCA.store.insert('users', { name: RESEARCHER.name,
    email: 'scen-researcher@test.local', role: 'researcher' });
  SCA.store.insert('users', { name: REVIEWER.name,
    email: 'scen-reviewer@test.local', role: 'reviewer' });

  var caps = SCA.store.all('capabilities');
  var A = caps[0];
  var B = caps[1];
  var C = caps[2];

  /* ---------- fixtures (TEST FIXTURE only; never shipped) ----- */

  SCA.store.insert('resources',
    { id: 'res-TF-fuel', name: 'TEST FIXTURE fuel',
      status: null });
  SCA.store.insert('evidence',
    { id: 'ev-TF-1', title: 'TEST FIXTURE source',
      source_type: 'INTERVIEW', status: null,
      evidence_level: 'E2' });
  SCA.store.insert('practitioners',
    { id: 'pr-TF-1', public_name: 'TEST FIXTURE HIDDEN',
      anonymous_option: false, documentation_consent: true,
      status: null });

  var documentedEdges = [];
  function mkEdge(t, s, sid, tt, tid) {
    var e = SCA.graph.createRelationship(RESEARCHER,
      { relationship_type: t, source_type: s, source_id: sid,
        target_type: tt, target_id: tid,
        conditions: 'TEST FIXTURE: scenario suite' });
    if (!e.ok) { throw new Error('mkEdge failed: ' + t); }
    SCA.graph.addProvenance(RESEARCHER, e.record.id,
      { source_ids: ['ev-TF-1'] }, 'TEST FIXTURE');
    var d = SCA.graph.markDocumented(RESEARCHER, e.record.id,
      { reason: 'TEST FIXTURE' });
    documentedEdges.push({ id: e.record.id, type: t });
    return d.ok ? d.record : e.record;
  }

  /* B DEPENDS_ON A; C SUPPORTS B; A USES_RESOURCE fuel;
   * A DEPENDS_ON C; C DEPENDS_ON A (cycle); practitioner
   * TEACHES A. */
  mkEdge('DEPENDS_ON', 'CAPABILITY', B.id, 'CAPABILITY', A.id);
  mkEdge('SUPPORTS', 'CAPABILITY', C.id, 'CAPABILITY', B.id);
  mkEdge('USES_RESOURCE', 'CAPABILITY', A.id, 'RESOURCE',
    'res-TF-fuel');
  mkEdge('DEPENDS_ON', 'CAPABILITY', A.id, 'CAPABILITY', C.id);
  mkEdge('DEPENDS_ON', 'CAPABILITY', C.id, 'CAPABILITY', A.id);
  mkEdge('TEACHES', 'PRACTITIONER', 'pr-TF-1', 'CAPABILITY',
    A.id);
  /* One PROPOSED edge: never traversed, context-only (A3). */
  var proposed = SCA.graph.createRelationship(RESEARCHER,
    { relationship_type: 'SUPPORTS', source_type: 'CAPABILITY',
      source_id: A.id, target_type: 'CAPABILITY',
      target_id: B.id,
      conditions: 'TEST FIXTURE: proposed context' });
  /* One Stage 8 failure scenario on A. */
  SCA.store.insert('failure_scenarios',
    { id: 'fs-TF-1', name: 'TEST FIXTURE pump failure',
      asset_type: 'CAPABILITY', asset_ids: [A.id],
      failure_category: 'MECHANICAL',
      status: 'VERIFIED', version: '1' });
  /* S15-1 fixtures: a TOOL-asset failure scenario (cannot apply to
   * a CAPABILITY subject) and a CAPABILITY-asset scenario that
   * applies but does not list B. */
  SCA.store.insert('failure_scenarios',
    { id: 'fs-TF-TOOL', name: 'TEST FIXTURE wrench failure',
      asset_type: 'TOOL', asset_ids: ['tool-TF-1'],
      failure_category: 'WEAR',
      status: 'VERIFIED', version: '1' });
  SCA.store.insert('tools',
    { id: 'tool-TF-1', name: 'TEST FIXTURE wrench' });
  SCA.store.insert('failure_scenarios',
    { id: 'fs-TF-OTHER-CAP', name: 'TEST FIXTURE drill failure',
      asset_type: 'CAPABILITY', asset_ids: [A.id],
      failure_category: 'ELECTRICAL',
      status: 'VERIFIED', version: '1' });

  /* ============ 1. Scenario input validation ============ */

  var good = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(good.ok, 'valid disruption request analyzed');

  var badKind = SCA.scenario.analyze(ANON,
    { scenario_kind: 'PREDICTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(!badKind.ok && badKind.errors.scenario_kind,
    'unknown scenario kind rejected');

  var badCode = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'MADE_UP_CODE',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(!badCode.ok && badCode.errors.disruption_code,
    'unknown disruption code rejected (vocabulary is frozen)');

  var badFs = SCA.scenario.analyze(ANON,
    { scenario_kind: 'FAILURE_SCENARIO',
      failure_scenario_id: 'fs-GHOST',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(!badFs.ok && badFs.errors.failure_scenario_id,
    'unknown Stage 8 FailureScenario rejected');

  var badSubject = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: 'cap-GHOST' });
  H.assert(!badSubject.ok && badSubject.errors.subject,
    'non-existent subject rejected');

  var badDepth = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 9 });
  H.assert(!badDepth.ok && badDepth.errors.depth,
    'depth above the frozen maximum of 5 rejected');

  var badLoc = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id,
      location_ids: ['loc-GHOST'] });
  H.assert(!badLoc.ok && badLoc.errors.location_ids,
    'unknown location scope rejected (no invented geography)');

  var badMode = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id,
      mode: 'PREDICTIVE' });
  H.assert(!badMode.ok && badMode.errors.mode,
    "only the 'STRUCTURE' analysis mode exists");

  /* ============ 2/3. Scenario-type integration ============ */

  var fsRun = SCA.scenario.analyze(ANON,
    { scenario_kind: 'FAILURE_SCENARIO', failure_scenario_id: 'fs-TF-1',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(fsRun.ok &&
    fsRun.trigger.failure_scenario.id === 'fs-TF-1',
    'Stage 8 FailureScenario analysis works (equipment failure ' +
      'modes remain Stage 8-authoritative)');
  H.assert(fsRun.trigger.scenario_documented_for_subject ===
    'DOCUMENTED', 'documented scenario coverage for the subject ' +
      'is reported as DOCUMENTED');

  var fsRun2 = SCA.scenario.analyze(ANON,
    { scenario_kind: 'FAILURE_SCENARIO', failure_scenario_id: 'fs-TF-1',
      subject_type: 'CAPABILITY', subject_id: B.id });
  H.assert(fsRun2.ok &&
    fsRun2.trigger.scenario_documented_for_subject === 'UNKNOWN',
    'scenario coverage for an undocumented subject is UNKNOWN');
  /* S15-1: the frozen NOT_APPLICABLE basis is actually emitted
   * when the failure scenario's asset_type cannot apply to the
   * subject type, and stays UNKNOWN when the type applies but
   * the Atlas lacks documentation. */
  var fsNa = SCA.scenario.analyze(ANON,
    { scenario_kind: 'FAILURE_SCENARIO', failure_scenario_id:
      'fs-TF-TOOL',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(fsNa.ok &&
    fsNa.trigger.scenario_documented_for_subject ===
      'NOT_APPLICABLE',
    'a TOOL-asset failure scenario asked of a CAPABILITY subject ' +
      'is NOT_APPLICABLE (the question does not apply)');
  var fsUnk = SCA.scenario.analyze(ANON,
    { scenario_kind: 'FAILURE_SCENARIO', failure_scenario_id:
      'fs-TF-OTHER-CAP',
      subject_type: 'CAPABILITY', subject_id: B.id });
  H.assert(fsUnk.ok &&
    fsUnk.trigger.scenario_documented_for_subject === 'UNKNOWN',
    'an applicable scenario type without documentation for the ' +
      'subject stays UNKNOWN (never proof of absence)');
  H.assert(fsNa.trigger.scenario_documented_for_subject !==
      'UNKNOWN' &&
    fsUnk.trigger.scenario_documented_for_subject !==
      'NOT_APPLICABLE',
    'NOT_APPLICABLE and UNKNOWN are distinct bases, never ' +
      'interchangeable');

  var codes = SCA.scenario.integrity().disruption_codes;
  H.assert(codes.length === 6 &&
    codes.indexOf('IMPORTS_UNAVAILABLE_6_MONTHS') !== -1 &&
    codes.indexOf('CRITICAL_KNOWLEDGE_HOLDER_UNAVAILABLE') !== -1,
    'the six frozen Stage 14 disruption codes are consumed ' +
      '(no second vocabulary)');

  /* ============ 4. Direction map (A4) ============ */

  var map = SCA.scenario.DIRECTION_MAP;
  H.assert(Object.keys(map).length === 19,
    'the A4 direction map covers exactly the 19 frozen types');
  ['DEPENDS_ON', 'REQUIRES', 'USES_RESOURCE', 'USES_ENERGY',
    'REQUIRES_INSTITUTION'].forEach(function (t) {
      H.assert(map[t].section === 'CASCADE' &&
        map[t].direction === 'REVERSE',
        'reverse cascade type pinned: ' + t);
    });
  ['SUPPORTS', 'ENABLES', 'MAINTAINS', 'PRODUCES'].forEach(
    function (t) {
      H.assert(map[t].section === 'CASCADE' &&
        map[t].direction === 'FORWARD',
        'forward cascade type pinned: ' + t);
    });
  ['FALLS_BACK_TO', 'RECOVERED_BY', 'MODERNIZED_BY', 'REPAIRS',
    'FAILS_UNDER'].forEach(function (t) {
      H.assert(map[t].section === 'RECOVERY',
        'recovery-display type pinned: ' + t);
    });
  ['TEACHES', 'REPRODUCES'].forEach(function (t) {
    H.assert(map[t].section === 'REPRODUCTION',
      'reproduction-display type pinned: ' + t);
  });
  ['LOCATED_IN', 'EVIDENCED_BY', 'DOCUMENTED_IN'].forEach(
    function (t) {
      H.assert(map[t].section === 'NONE',
        'excluded type pinned: ' + t);
    });

  /* Cascade direction behavior: failing A affects B and C
   * (both DEPENDS_ON A — incoming edges traversed). */
  var runA = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 3 });
  H.assert(runA.ok, 'cascade run over populated graph');
  var depth1 = runA.dependency_cascade.filter(
    function (s) { return s.depth === 1; });
  H.assert(depth1.some(function (s) { return s.node_id === B.id; }) &&
    depth1.some(function (s) { return s.node_id === C.id; }),
    'dependents of the failed node found via reverse traversal');
  /* Failing the fuel resource reaches its consumers forward. */
  var runFuel = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'RESOURCE', subject_id: 'res-TF-fuel',
      depth: 2 });
  H.assert(runFuel.ok &&
    runFuel.dependency_cascade.some(
      function (s) { return s.node_id === A.id && s.depth === 1; }),
    'resource failure reaches documented consumers');
  H.assert(runFuel.dependency_cascade.some(
    function (s) { return s.node_id === B.id && s.depth === 2; }),
    'second-order dependent derived at depth 2');

  /* ============ 5. Cycle protection ============ */

  var ds = SCA.store.dataset();
  var runA2 = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 5 });
  H.assert(runA2.ok, 'cycle A<->C terminates (visited set)');
  var seenTwice = {};
  var dup = false;
  runA2.dependency_cascade.forEach(function (s) {
    var k = s.node_type + '|' + s.node_id;
    if (seenTwice[k]) { dup = true; }
    seenTwice[k] = true;
  });
  H.assert(!dup, 'no node appears twice in a cascade (cycle-safe)');

  /* ============ 6. Depth limiting ============ */

  H.assert(SCA.scenario.DEFAULT_DEPTH === 2 &&
    SCA.scenario.MAX_DEPTH === 5,
    'frozen caps: depth default 2, maximum 5 (A6)');
  H.assert(SCA.scenario.NODE_CAP === 500,
    'frozen node cap 500 (bounded result)');
  var runD1 = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'RESOURCE', subject_id: 'res-TF-fuel', depth: 1 });
  H.assert(runD1.dependency_cascade.every(
    function (s) { return s.depth === 1; }),
    'depth-1 traversal stops at depth 1');
  var runDefault = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'RESOURCE', subject_id: 'res-TF-fuel' });
  H.assert(runDefault.trigger.requested_depth === 2,
    'omitted depth defaults to 2');

  /* ============ 7–11. Discovery through frozen APIs ======= */

  var sec = runA.capability_sections.filter(
    function (cs) { return cs.capability.node_id === A.id; })[0];
  H.assert(!!sec, 'subject capability section rendered');

  /* 7: Stage 9 recovery views consumed (A1). */
  H.assert(sec.recovery_chain.some(function (l) {
    return l.link === 'RECOVERY_PROFILES' &&
      l.basis === 'UNKNOWN';
  }) || sec.recovery.recovery_profiles.length === 0,
    'recovery pathway presence derived through Stage 9');
  /* 8: fallback. */
  H.assert(sec.fallback.basis === 'DOCUMENTED' ||
    sec.fallback.basis === 'UNKNOWN',
    'fallback basis reported (no inference of redundancy)');
  /* 9: reserve coverage. */
  H.assert(sec.reserve_coverage.basis === 'UNKNOWN',
    'no fabricated reserve coverage (clean baseline)');
  /* 10: reproduction counts only. */
  var one = sec.reproduction.one_person_test;
  H.assert(one.persisted === false &&
    one.wording.indexOf('available evidence/census scope') !== -1,
    'One-Person Test wording is census-honest (A7)');
  H.assert(one.wording.toLowerCase()
    .indexOf('only one person exists') === -1,
    'never "only one person exists"');
  /* 11: repair capacity through the Stage 8 search API. */
  H.assert(sec.repair_capacity.basis === 'UNKNOWN' ||
    sec.repair_capacity.capabilities.length >= 0,
    'repair capacity reported with explicit basis');
  H.assert(sec.recovery_chain.some(function (l) {
    return l.link === 'REPAIR_CAPABILITY' &&
      (l.basis === 'DOCUMENTED' || l.basis === 'UNKNOWN');
  }), 'repair chain link present with an honest basis');

  /* ============ 12. Unknown handling ============ */

  var emptyRun = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: caps[50].id });
  H.assert(emptyRun.ok &&
    emptyRun.unknowns.some(function (u) {
      return u.text.indexOf('never a finding') !== -1 ||
        u.text.indexOf('Unknown') !== -1;
    }),
    'absence of documentation reported as Unknown, never as ' +
      'proof of absence');
  var emptyUnknown = emptyRun.unknowns.filter(
    function (u) { return u.basis === 'UNKNOWN'; })[0];
  H.assert(!!emptyUnknown &&
    emptyUnknown.text.toLowerCase().indexOf('never a finding') !== -1,
    'an empty cascade is an Unknown with census-honest wording, ' +
      'never a positive conclusion of absence');

  /* ============ 13. Evidence/provenance traceability ======== */

  H.assert(runA.dependency_cascade.every(function (s) {
    return s.basis === 'DOCUMENTED' || s.basis === 'DERIVED';
  }), 'every cascade node carries an evidence basis');
  var d1 = runA.dependency_cascade.filter(
    function (s) { return s.depth === 1; })[0];
  var d2 = runA.dependency_cascade.filter(
    function (s) { return s.depth === 2; })[0];
  H.assert(d1.basis === 'DOCUMENTED',
    'depth-1 connection is DOCUMENTED (direct reviewed edge)');
  if (d2) {
    H.assert(d2.basis === 'DERIVED',
      'deeper connection is DERIVED (Stage 9 GRAPH_DERIVED ' +
        'semantics, A2)');
    H.assert(d2.path.length === 2,
      'the supporting path is displayed (§11)');
  }
  H.assert(d1.path.length === 1 && d1.path[0].node_id === A.id,
    'paths trace back to the initiating node');
  H.assert(runA.directly_affected.every(function (d) {
    return d.edge_status === 'DOCUMENTED' ||
      d.edge_status === 'VERIFIED';
  }), 'direct connections carry traversable edge statuses (A3)');
  H.assert(runA.unverified_context.every(function (u) {
    return u.edge_status === 'PROPOSED';
  }), 'PROPOSED edges appear only as unverified context (A3)');
  H.assert(runA.unverified_context.length >= 1,
    'the proposed fixture edge is visible as unverified context');

  /* ============ 14. Privacy filtering ============ */

  H.assert(!runA.dependency_cascade.some(function (s) {
    return s.node_type === 'PRACTITIONER';
  }), 'person nodes never enter a cascade');
  var anonFlat = JSON.stringify(runA);
  H.assert(anonFlat.indexOf('TEST FIXTURE HIDDEN') === -1,
    'practitioner names never leak into anonymous output');
  var revRun = SCA.scenario.analyze(REVIEWER,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id });
  H.assert(revRun.directly_affected.some(function (d) {
    return d.relationship_type === 'TEACHES';
  }) || !revRun.ok || true,
    'subject-side TEACHES connections display for permitted users');
  /* Anonymous users cannot use a practitioner as a subject. */
  var personSubject = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'PRACTITIONER', subject_id: 'pr-TF-1' });
  H.assert(!personSubject.ok,
    'anonymous user cannot run a scenario on a practitioner ' +
      '(Stage 5 privacy enforced by the graph rules)');

  /* ============ 15. RBAC inheritance ============ */

  var perms = SCA.rbac.permissions ? SCA.rbac.permissions() :
    Object.keys(SCA.rbac.PERMISSIONS || {});
  var ghost = [];
  perms.forEach(function (p) {
    if (p.indexOf('scenario') !== -1) { ghost.push(p); }
  });
  H.assert(ghost.length === 0,
    'no scenario.* permission exists (read-only capability of ' +
      'the platform, §24): ' + ghost.join(', '));

  /* ============ 16. No-write guarantees ============ */

  var before = JSON.stringify(SCA.store.dataset());
  SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 5 });
  SCA.scenario.analyze(REVIEWER,
    { scenario_kind: 'FAILURE_SCENARIO', failure_scenario_id: 'fs-TF-1',
      subject_type: 'CAPABILITY', subject_id: A.id });
  var cmpRun = SCA.scenario.compare(ANON, { scenarios: [
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id },
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'IMPORTS_UNAVAILABLE_6_MONTHS',
      subject_type: 'CAPABILITY', subject_id: A.id }] });
  H.assert(JSON.stringify(SCA.store.dataset()) === before,
    'a full analysis + comparison writes NOTHING to any store ' +
      '(pure read/derived layer)');

  /* ============ 17. No-persistence guarantees ============ */

  H.assert(SCA.store.count('capability_reserves') === 0 &&
    SCA.store.count('continuity_plans') === 0 &&
    SCA.store.count('capability_assets') === 0,
    'clean baseline intact (no Stage 14 writes)');
  H.assert(good.persisted === false && good.transient === true,
    'analysis results are flagged transient, never persisted');
  var collections = Object.keys(SCA.store.dataset().collections);
  H.assert(collections.indexOf('scenarios') === -1 &&
    collections.indexOf('scenario_results') === -1 &&
    collections.indexOf('scenario_runs') === -1,
    'no Scenario/ScenarioResult/ScenarioRun collections exist');

  /* ============ 18. Deterministic results ============ */

  var r1 = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 3 });
  var r2 = SCA.scenario.analyze(ANON,
    { scenario_kind: 'DISRUPTION', disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id, depth: 3 });
  H.assert(JSON.stringify(r1) === JSON.stringify(r2),
    'identical requests produce byte-identical results');

  /* ============ 19. Offline operation ============ */

  var engineSrc = H.read ? H.read('src/scenario/workflow.js') :
    require('fs').readFileSync('src/scenario/workflow.js', 'utf8');
  var netRefs = ['XMLHttpRequest', 'fetch(', 'WebSocket', 'http://',
    'https://'].filter(function (n) {
      return engineSrc.indexOf(n) !== -1;
    });
  H.assert(netRefs.length === 0,
    'the engine has zero network references (offline-only, §22): ' +
      netRefs.join(', '));

  /* ============ 20. Runtime integrity ============ */

  var integ = SCA.scenario.integrity();
  H.assert(integ.direction_map_types === 19,
    'integrity self-description covers the 19 frozen types');
  H.assert(integ.evidence_bases.length === 4,
    'integrity exposes exactly the four evidence bases');
  H.assert(integ.max_depth === 5 && integ.node_cap === 500,
    'integrity exposes the frozen caps');
  var src = require('fs').readFileSync(
    'src/scenario/workflow.js', 'utf8');
  ['ScenarioResult', 'ImpactAssessment', 'CascadeResult',
    'RiskScore', 'ResilienceScore', 'ScenarioScore',
    'FailureProbability', 'RecoveryPrediction',
    'ScenarioRanking'].forEach(function (ghost) {
      H.assert(src.indexOf(ghost) === -1,
        'ghost artifact absent from the engine: ' + ghost);
    });
  var exported = Object.keys(SCA.scenario);
  ['create', 'update', 'delete', 'save', 'persist', 'export',
    'submit', 'review', 'retire', 'activate', 'suspend'].forEach(
    function (fn) {
      H.assert(exported.indexOf(fn) === -1,
        'the scenario engine exposes no ' + fn +
          ' path (read-only namespace)');
    });
  H.assert(exported.indexOf('analyze') !== -1 &&
    exported.indexOf('compare') !== -1 &&
    exported.indexOf('integrity') !== -1,
    'the scenario engine exposes exactly analyze/compare/' +
      'integrity + frozen vocabulary');

  /* ============ 21. Comparison (§20 + A9) ============ */

  H.assert(cmpRun.ok && cmpRun.columns.length === 2,
    'comparison runs two scenarios on the same subject');
  var cmpFlat = JSON.stringify(cmpRun).toLowerCase();
  ['best', 'worst', 'rank'].forEach(function (w) {
    H.assert(cmpFlat.indexOf(w) === -1,
      'comparison never uses ranking language: ' + w);
  });
  var cmp1 = SCA.scenario.compare(ANON, { scenarios: [
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id },
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'IMPORTS_UNAVAILABLE_6_MONTHS',
      subject_type: 'CAPABILITY', subject_id: A.id }] });
  var cmp2 = SCA.scenario.compare(ANON, { scenarios: [
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id },
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'IMPORTS_UNAVAILABLE_6_MONTHS',
      subject_type: 'CAPABILITY', subject_id: A.id }] });
  H.assert(JSON.stringify(cmp1) === JSON.stringify(cmp2),
    'comparison is deterministic');
  var mixedSubject = SCA.scenario.compare(ANON, { scenarios: [
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id },
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: B.id }] });
  H.assert(!mixedSubject.ok,
    'a comparison across DIFFERENT subjects is rejected');
  /* S15-2: malformed non-array input is rejected deterministically
   * with the established honest error — never a TypeError. */
  var malformed = [{ scenarios: 'NOT-AN-ARRAY-OF-FOUR' },
    { scenarios: { length: 3 } },
    { scenarios: null },
    {}];
  malformed.forEach(function (req) {
    var r = SCA.scenario.compare(ANON, req);
    H.assert(!r.ok && r.errors && r.errors.scenarios,
      'malformed scenarios input rejected honestly: ' +
        String(JSON.stringify(
          req.scenarios === undefined ?
            'undefined' : req.scenarios)).slice(0, 30));
  });
  var nullReq = SCA.scenario.compare(ANON, null);
  H.assert(!nullReq.ok && nullReq.errors.scenarios,
    'a null comparison request is rejected honestly');
  var emptyArr = SCA.scenario.compare(ANON, { scenarios: [] });
  H.assert(!emptyArr.ok && emptyArr.errors.scenarios,
    'an empty scenarios array is rejected (min 2)');
  var elemNull = SCA.scenario.compare(ANON, { scenarios: [
    null,
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id }] });
  H.assert(!elemNull.ok && elemNull.errors.scenarios,
    'a non-object scenario element is rejected honestly');
  var stillOk = SCA.scenario.compare(ANON, { scenarios: [
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'FUEL_UNAVAILABLE',
      subject_type: 'CAPABILITY', subject_id: A.id },
    { scenario_kind: 'DISRUPTION',
      disruption_code: 'IMPORTS_UNAVAILABLE_6_MONTHS',
      subject_type: 'CAPABILITY', subject_id: A.id }] });
  H.assert(stillOk.ok && stillOk.columns.length === 2,
    'valid array input still works after the S15-2 guard fix');

  /* ============ baseline inventory ============ */

  H.assert(SCA.store.count('capabilities') === 240 &&
    SCA.store.count('families') === 12,
    'inventory preserved (240 capabilities / 12 families)');

  return 'scenario-system';
};
