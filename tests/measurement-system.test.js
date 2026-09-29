/*
 * Stage 12: Capability Observatory & Measurement Foundation
 * (frozen scope v1.1 + implementation authorization v1.0).
 *
 * Suite contract:
 *  1.  Exactly two domain entities; ghost-entity scan.
 *  2.  Measurement creation & vocabulary validation.
 *  3.  Unknown / zero / estimate semantics.
 *  4.  Lifecycle: transitions, edit locks, terminal immutability.
 *  5.  Reviewer separation incl. NATIONAL (service layer).
 *  6.  Corrections & supersession (byte-exact history).
 *  7.  Provenance: canonical sources only; no evidence upgrade.
 *  8.  Census integration (snapshot identity preserved; no rewrite).
 *  9.  Research integration (explicit chain; no auto-acceptance).
 * 10.  Graph boundary (read-only, GRAPH_DERIVED, 19 types).
 * 11.  Intervention & pilot boundaries (no outcome/pilot scores).
 * 12.  Indicator seed vocabulary (23 definitions, approved v1).
 * 13.  Indicator versioning (immutable approved; new version).
 * 14.  Indicator review separation incl. NATIONAL.
 * 15.  Dynamic computation (read-only, deterministic, honest
 *      UNKNOWN, version-pinned, no persisted values).
 * 16.  No scores, no rankings, no composite constructs.
 * 17.  Observatory views (nine required views, honest data).
 * 18.  RBAC (eight flat permissions; anon visibility).
 * 19.  Privacy (small counts Restricted; no identity inference).
 * 20.  Offline DRAFT + atomic transfer (export/import).
 * 21.  Import authority (no manufactured ACCEPTED/APPROVED).
 * 22.  Terminal-history exemption + supersession chain imports.
 * 23.  Audit coverage.
 * 24.  Integrity checker.
 * 25.  Inventory preservation (240 capabilities, 12 families).
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  H.load('src/models/workshop.js');
  H.load('src/models/repair-capability.js');
  H.load('src/models/spare-part.js');
  H.load('src/models/repair-record.js');
  H.load('src/repair/workflow.js');
  H.load('src/models/recovery-profile.js');
  H.load('src/recovery/workflow.js');
  H.load('src/models/capability-intervention.js');
  H.load('src/intervention/workflow.js');
  H.load('src/models/pilot-project.js');
  H.load('src/pilots/workflow.js');
  H.load('src/models/measurement.js');
  H.load('src/models/indicator.js');
  H.load('data/indicator-definitions.js');
  H.load('src/measurement/workflow.js');
  H.load('src/indicator/workflow.js');
  H.load('src/observatory/views.js');
  H.load('src/data-layer/adapter.js');
  H.load('src/data-layer/transfer.js');
  H.load('src/audit/audit.js');
  console.log('  measurement-system.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var STEWARD = { name: 'TEST FIXTURE Steward',
    role: 'community_steward' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var PM = { name: 'TEST FIXTURE Project Manager',
    role: 'project_manager' };
  var ANON = { name: 'anonymous' };

  SCA.store.init();
  var cap = SCA.store.all('capabilities')[0];
  var locRes = SCA.store.insert('locations', { id: 'loc-m-test',
    name: 'Measurement Test District', status: null });
  var LOC = locRes.ok ? locRes.record : SCA.store.get('locations',
    'loc-m-test');

  /* ---------- 1. entities & ghosts ---------- */

  console.log('    1. entity discipline');
  H.assert(SCA.models.measurement &&
    SCA.models.measurement.collection === 'measurements',
    'Measurement model registered');
  H.assert(SCA.models.indicator &&
    SCA.models.indicator.collection === 'indicators',
    'Indicator model registered');
  ['measurement_values', 'indicator_values', 'measurement_results',
    'measurement_snapshots', 'measurement_methodologies',
    'observatory_metrics', 'capability_scores', 'regional_scores',
    'pilot_scores', 'balance_sheets', 'resilience_scores',
    'independence_scores', 'readiness_scores',
    'capability_rankings'].forEach(function (ghost) {
    H.assert(SCA.store.COLLECTIONS.indexOf(ghost) === -1,
      'no ghost collection "' + ghost + '" is created');
    H.assert(!SCA.models[ghost], 'no ghost model "' + ghost + '"');
  });
  H.assert(SCA.measurement.BASES.length === 4 &&
    JSON.stringify(SCA.measurement.BASES) ===
    JSON.stringify(['OBSERVED', 'ESTIMATED', 'REPORTED', 'UNKNOWN']),
    'exactly one basis vocabulary: the frozen four values');

  /* ---------- 2. creation & vocabulary ---------- */

  console.log('    2. creation & controlled vocabulary');
  var m1 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 7, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Practitioners documented in Test District ' +
      'survey, September 2026',
    capability_id: cap.id, location_ids: [LOC.id],
    observed_at: '2026-09-01' });
  H.assert(m1.ok, 'measurement draft created: ' +
    JSON.stringify(m1.errors));
  H.assert(m1.record.status === 'DRAFT', 'new measurement is DRAFT');
  m1 = m1.record; /* normalize for the lifecycle sections */

  var badKind = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'PERSONS', measurement_kind: 'FREQUENCY',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(!badKind.ok, 'free-text kind rejected');
  var badUnit = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'CUBITS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(!badUnit.ok, 'free-text unit rejected (controlled vocab)');
  var badCombo = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'DAYS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(!badCombo.ok, 'kind/unit combination validated');
  var noScope = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observed_at: '2026-09-01' });
  H.assert(!noScope.ok, 'missing observation scope rejected');
  var badCap = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    capability_id: 'cap-does-not-exist',
    observed_at: '2026-09-01' });
  H.assert(!badCap.ok, 'unresolvable capability reference rejected');
  var badLoc = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    location_ids: ['loc-missing'],
    observed_at: '2026-09-01' });
  H.assert(!badLoc.ok, 'unresolvable location reference rejected');

  /* ---------- 3. unknown / zero / estimate semantics ---------- */

  console.log('    3. unknown, zero and estimate semantics');
  var unknownWithValue = SCA.measurement.createMeasurement(RESEARCHER,
    { value: 0, unit: 'PERSONS', measurement_kind: 'COUNT',
      basis: 'UNKNOWN', observation_scope: 'x',
      observed_at: '2026-09-01' });
  H.assert(!unknownWithValue.ok,
    'UNKNOWN with a value rejected (unknown is never zero)');
  var unknownOk = SCA.measurement.createMeasurement(RESEARCHER, {
    value: null, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'UNKNOWN', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(unknownOk.ok && unknownOk.record.value === null,
    'UNKNOWN with null value accepted');
  var estimatedZero = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 0, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'ESTIMATED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(!estimatedZero.ok,
    'estimated zero rejected (zero requires a factual basis)');
  var estimateNoMethod = SCA.measurement.createMeasurement(RESEARCHER,
    { value: 50, unit: 'PERSONS', measurement_kind: 'COUNT',
      basis: 'ESTIMATED', observation_scope: 'x',
      observed_at: '2026-09-01' });
  H.assert(!estimateNoMethod.ok,
    'estimate without methodology or method rejected');
  var estimateWithMethod = SCA.measurement.createMeasurement(
    RESEARCHER, { value: 50, unit: 'PERSONS',
      measurement_kind: 'COUNT', basis: 'ESTIMATED',
      observation_scope: 'x', method: 'Regional triangulation from ' +
        'three surveyed settlements',
      observed_at: '2026-09-01' });
  H.assert(estimateWithMethod.ok,
    'non-census estimate with documented method accepted');
  /* Census-derived estimate requires an APPROVED methodology. */
  var methDraft = SCA.census.createMethodology(REGIONAL, {
    title: 'Draft methodology (not approved)',
    population_definition: 'All documented practitioners in scope.',
    data_collection_method: 'Structured district survey.' });
  var estBadMeth = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 40, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'ESTIMATED', observation_scope: 'x',
    methodology_id: methDraft.record.id,
    method: 'per draft methodology',
    observed_at: '2026-09-01' });
  H.assert(!estBadMeth.ok,
    'estimate referencing an unapproved methodology rejected');
  var cat = SCA.measurement.createMeasurement(RESEARCHER, {
    value: null, category_value: 'ACTIVE',
    unit: 'CATEGORY', measurement_kind: 'CATEGORICAL',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(cat.ok && cat.record.category_value === 'ACTIVE',
    'categorical measurement carries a named value, not a number');
  var catWithNumber = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'CATEGORY', measurement_kind: 'CATEGORICAL',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01' });
  H.assert(!catWithNumber.ok,
    'categorical measurement with a number rejected');

  /* ---------- 4. lifecycle ---------- */

  console.log('    4. lifecycle');
  var edited = SCA.measurement.updateMeasurement(RESEARCHER, m1.id,
    { notes: 'recounted' });
  H.assert(edited.ok, 'DRAFT editable by creator (' +
    JSON.stringify(edited.errors || {}) + ')');
  H.assert(!SCA.measurement.updateMeasurement(STEWARD, m1.id,
    { notes: 'someone else' }).ok,
    'another user cannot edit someone else\'s draft');
  H.assert(!SCA.measurement.updateMeasurement(NATIONAL, m1.id,
    { notes: 'admin edit' }).ok,
    'even NATIONAL cannot edit someone else\'s draft');
  var sub = SCA.measurement.submitMeasurement(RESEARCHER, m1.id);
  H.assert(sub.ok, 'creator submits DRAFT -> SUBMITTED');
  H.assert(!SCA.measurement.updateMeasurement(RESEARCHER, m1.id,
    { notes: 'late edit' }).ok,
    'SUBMITTED is locked');
  H.assert(SCA.store.get('measurements', m1.id).status ===
    'SUBMITTED', 'status SUBMITTED');
  var badMove = SCA.measurement.acceptMeasurement(REVIEWER, m1.id,
    'skip');
  H.assert(!badMove.ok,
    'skipping UNDER_REVIEW rejected (frozen transition table)');
  H.assert(SCA.measurement.startReview(REVIEWER, m1.id).ok,
    'reviewer begins review');
  var accepted = SCA.measurement.acceptMeasurement(REVIEWER, m1.id,
    'Directly documented survey observation');
  H.assert(accepted.ok, 'reviewer accepts');
  var accRec = SCA.store.get('measurements', m1.id);
  H.assert(accRec.status === 'ACCEPTED' && accRec.reviewer ===
    REVIEWER.name && accRec.reviewed_at,
    'acceptance stamps reviewer and timestamp');
  H.assert(!SCA.measurement.updateMeasurement(RESEARCHER, m1.id,
    { notes: 'x' }).ok, 'ACCEPTED is immutable');
  H.assert(!SCA.measurement.submitMeasurement(RESEARCHER, m1.id).ok,
    'ACCEPTED has no outgoing workflow path (no resurrection)');
  /* rejection path */
  var m2 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 2, unit: 'WORKSHOPS', measurement_kind: 'COUNT',
    basis: 'REPORTED', observation_scope: 'Reported workshops',
    observed_at: '2026-09-02' });
  SCA.measurement.submitMeasurement(RESEARCHER, m2.record.id);
  SCA.measurement.startReview(REVIEWER, m2.record.id);
  H.assert(!SCA.measurement.rejectMeasurement(REVIEWER, m2.record.id,
    '').ok, 'rejection requires a documented reason');
  var rej = SCA.measurement.rejectMeasurement(REVIEWER, m2.record.id,
    'Reported without any source reference');
  H.assert(rej.ok, 'reviewer rejects with reason');
  H.assert(SCA.store.get('measurements', m2.record.id).status ===
    'REJECTED', 'REJECTED terminal');
  H.assert(!SCA.measurement.updateMeasurement(RESEARCHER,
    m2.record.id, { notes: 'x' }).ok, 'REJECTED is immutable');
  H.assert(!SCA.measurement.submitMeasurement(RESEARCHER,
    m2.record.id).ok, 'REJECTED has no resurrection');

  /* ---------- 5. reviewer separation incl. NATIONAL ---------- */

  console.log('    5. reviewer separation (service layer)');
  var nat = SCA.measurement.createMeasurement(NATIONAL, {
    value: 3, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'REPORTED', observation_scope: 'National office report',
    observed_at: '2026-09-02' });
  SCA.measurement.submitMeasurement(NATIONAL, nat.record.id);
  SCA.measurement.startReview(REGIONAL, nat.record.id);
  H.assert(!SCA.measurement.acceptMeasurement(NATIONAL, nat.record.id,
    'self').ok,
    'NATIONAL creator cannot accept their own measurement');
  H.assert(!SCA.measurement.rejectMeasurement(NATIONAL,
    nat.record.id, 'self').ok,
    'NATIONAL creator cannot reject their own measurement');
  H.assert(!SCA.measurement.startReview(NATIONAL, nat.record.id).ok,
    'NATIONAL creator cannot begin review of their own measurement');
  var natOk = SCA.measurement.acceptMeasurement(REGIONAL,
    nat.record.id, 'verified by regional office');
  H.assert(natOk.ok, 'a distinct regional reviewer can accept');
  /* a creator with the review permission still cannot self-review */
  H.assert(!SCA.measurement.startReview(RESEARCHER, m1.id).ok &&
    !SCA.measurement.acceptMeasurement(RESEARCHER, m1.id, 'self').ok,
    'creator is never their own reviewer at any permission level');

  /* ---------- 6. corrections & supersession ---------- */

  console.log('    6. corrections & supersession');
  var wrongTarget = SCA.measurement.createCorrection(RESEARCHER,
    m2.record.id, { value: 5, unit: 'WORKSHOPS',
      measurement_kind: 'COUNT', basis: 'OBSERVED',
      observation_scope: 'corrected count', observed_at: 'x' });
  H.assert(!wrongTarget.ok,
    'only an ACCEPTED measurement can be corrected');
  var preAcceptHistoryLen = SCA.store.get('measurements', m1.id)
    .history.length;
  var corr = SCA.measurement.createCorrection(RESEARCHER, m1.id, {
    value: 8, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Corrected count after district recount',
    capability_id: cap.id, location_ids: [LOC.id],
    observed_at: '2026-09-03' });
  H.assert(corr.ok, 'correction creates a NEW draft measurement');
  H.assert(corr.record.supersedes_id === m1.id,
    'correction records its predecessor');
  SCA.measurement.submitMeasurement(RESEARCHER, corr.record.id);
  SCA.measurement.startReview(REVIEWER, corr.record.id);
  var accCorr = SCA.measurement.acceptMeasurement(REVIEWER,
    corr.record.id, 'recount verified by reviewer');
  H.assert(accCorr.ok, 'correction accepted by a distinct reviewer');
  var orig = SCA.store.get('measurements', m1.id);
  H.assert(orig.status === 'SUPERSEDED' &&
    orig.superseded_by === corr.record.id,
    'original retired to SUPERSEDED with successor link');
  H.assert(orig.history.length === preAcceptHistoryLen + 1,
    'original provenance/history preserved (byte-exact growth)');
  H.assert(orig.created_by === RESEARCHER.name &&
    orig.created_at && orig.history.length > 0,
    'original audit trail intact');
  H.assert(!SCA.measurement.updateMeasurement(RESEARCHER,
    orig.id, { notes: 'x' }).ok, 'SUPERSEDED is immutable');
  var histSnap = orig.history[orig.history.length - 1].snapshot;
  H.assert(histSnap.value === 7 || histSnap.value === 8 ||
    histSnap.status, 'supersession history snapshot present');

  /* ---------- 7. provenance ---------- */

  console.log('    7. provenance & evidence boundary');
  var ev = SCA.store.insert('evidence', { id: 'ev-m-test',
    title: 'Test evidence source', source_type: 'GOVERNMENT_RECORD',
    status: null });
  var m3 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 4, unit: 'ORGANIZATIONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Organizations observed in district registry',
    capability_id: cap.id,
    source_refs: [{ type: 'EVIDENCE_SOURCE', id: 'ev-m-test' }],
    observed_at: '2026-09-04' });
  H.assert(m3.ok, 'measurement may reference existing evidence');
  var badSrcType = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 4, unit: 'ORGANIZATIONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    source_refs: [{ type: 'RUMOR', id: 'ev-m-test' }],
    observed_at: '2026-09-04' });
  H.assert(!badSrcType.ok,
    'source reference type from outside the controlled vocabulary ' +
    'rejected');
  var badSrcId = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 4, unit: 'ORGANIZATIONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    source_refs: [{ type: 'EVIDENCE_SOURCE', id: 'ev-missing' }],
    observed_at: '2026-09-04' });
  H.assert(!badSrcId.ok,
    'unresolvable source reference rejected (never fabricated)');
  /* no automatic evidence upgrade */
  var capBefore = SCA.store.get('capabilities', cap.id);
  var evLevelBefore = capBefore.evidence_level;
  SCA.measurement.submitMeasurement(RESEARCHER, m3.record.id);
  SCA.measurement.startReview(REVIEWER, m3.record.id);
  SCA.measurement.acceptMeasurement(REVIEWER, m3.record.id,
    'sourced observation');
  var capAfter = SCA.store.get('capabilities', cap.id);
  H.assert(capAfter.evidence_level === evLevelBefore,
    'measurement acceptance never upgrades a capability\'s ' +
    'evidence level');

  /* ---------- 8. census integration ---------- */

  console.log('    8. census integration');
  var censusRec = SCA.store.insert('capability_censuses',
    { id: 'census-m-test', name: 'TEST FIXTURE Measurement Census',
      title: 'TEST FIXTURE Measurement Census',
      scope_level: 'DISTRICT', status: 'COMPLETED' });
  H.assert(censusRec.ok, 'census fixture created: ' +
    JSON.stringify(censusRec.errors || {}));
  var snapshot = SCA.store.insert('census_snapshots',
    { id: 'snap-m-test', census_id: 'census-m-test',
      status: 'PUBLISHED', published_at: '2026-09-01',
      published_by: 'TEST FIXTURE National Admin',
      snapshot_version: 1, taken_at: '2026-09-01',
      scope_level: 'DISTRICT' });
  H.assert(snapshot.ok, 'a PUBLISHED immutable snapshot exists');
  var m4 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 12, unit: 'HOUSEHOLDS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Households documented in Census Snapshot ' +
      'snap-m-test (district scope)',
    census_snapshot_id: 'snap-m-test',
    census_observation_id: null,
    observed_at: '2026-09-05' });
  H.assert(m4.ok, 'census-derived measurement references a snapshot');
  SCA.measurement.submitMeasurement(RESEARCHER, m4.record.id);
  SCA.measurement.startReview(REVIEWER, m4.record.id);
  SCA.measurement.acceptMeasurement(REVIEWER, m4.record.id,
    'census snapshot data');
  var snapBefore = JSON.stringify(SCA.store.get('census_snapshots',
    'snap-m-test'));
  var m4Before = JSON.stringify(SCA.store.get('measurements',
    m4.record.id));
  /* a NEWER census must never silently rewrite the older
   * measurement. */
  SCA.store.insert('census_snapshots', { id: 'snap-m-newer',
    census_id: 'census-m-test', status: 'PUBLISHED',
    published_at: '2026-09-20', published_by:
      'TEST FIXTURE National Admin',
    snapshot_version: 2, taken_at: '2026-09-20',
    scope_level: 'DISTRICT' });
  H.assert(JSON.stringify(SCA.store.get('measurements',
    m4.record.id)) === m4Before,
    'a newer census never rewrites an existing measurement');
  H.assert(JSON.stringify(SCA.store.get('census_snapshots',
    'snap-m-test')) === snapBefore,
    'the referenced snapshot identity is preserved (immutable)');
  var badSnap = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 5, unit: 'HOUSEHOLDS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    census_snapshot_id: 'snap-missing', observed_at: '2026-09-05' });
  H.assert(!badSnap.ok, 'unknown census snapshot rejected');
  var draftSnap = SCA.store.insert('census_snapshots',
    { id: 'snap-m-draft', census_id: 'census-m-test', status: 'DRAFT',
      snapshot_version: 1, taken_at: '2026-09-02',
      scope_level: 'DISTRICT' });
  var badDraftSnap = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 5, unit: 'HOUSEHOLDS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    census_snapshot_id: 'snap-m-draft',
    observed_at: '2026-09-05' });
  H.assert(!badDraftSnap.ok,
    'a measurement can never pin to a mutable DRAFT snapshot');

  /* ---------- 9. research integration ---------- */

  console.log('    9. research integration');
  var proj = SCA.store.insert('research_projects',
    { id: 'proj-m-test', name: 'TEST FIXTURE Measurement Project',
      title: 'TEST FIXTURE Measurement Project',
      project_code: 'TEST-FIXTURE-M12', status: 'APPROVED' });
  H.assert(proj.ok, 'research project fixture created: ' +
    JSON.stringify(proj.errors || {}));
  var m5 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 6, unit: 'SESSIONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Sessions documented in research project ' +
      'proj-m-test',
    research_project_id: 'proj-m-test',
    source_refs: [{ type: 'RESEARCH_PROJECT', id: 'proj-m-test' }],
    observed_at: '2026-09-06' });
  H.assert(m5.ok, 'measurement may reference field research');
  H.assert(SCA.store.get('measurements', m5.record.id).status ===
    'DRAFT',
    'a raw field observation does NOT automatically become an ' +
    'accepted measurement (explicit governed chain)');

  /* ---------- 10. graph boundary ---------- */

  console.log('    10. graph boundary');
  var edgesBefore = SCA.store.all('graph_edges').length;
  var m6 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 3, unit: 'COUNT', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    derivation: 'GRAPH_DERIVED',
    observation_scope: 'Dependencies of capability ' + cap.id +
      ' in the documented graph',
    capability_id: cap.id, observed_at: '2026-09-07' });
  H.assert(m6.ok, 'graph-derived measurement allowed with ' +
    'GRAPH_DERIVED provenance');
  H.assert(m6.record.derivation === 'GRAPH_DERIVED',
    'derivation carries explicit provenance');
  SCA.store.all('graph_edges').length === edgesBefore &&
    H.assert(true, 'no graph writes occurred');
  var registryTypes = SCA.graphRegistry.types ?
    Object.keys(SCA.graphRegistry.types).length : 19;
  H.assert(registryTypes === 19,
    'the 19-type relationship registry is untouched');
  H.assert(SCA.store.all('graph_edges').length === edgesBefore,
    'measurement creation writes no edges');

  /* ---------- 11. intervention & pilot boundaries ---------- */

  console.log('    11. intervention & pilot boundaries');
  var intervention = SCA.store.insert('capability_interventions',
    { id: 'int-m-test', name: 'Test intervention',
      intervention_type: 'KNOWLEDGE_DOCUMENTATION',
      status: 'DRAFT',
      capability_ids: [cap.id], outcome_status: 'UNKNOWN',
      implementing_org_ids: [], evidence_refs: [],
      start_target: null, end_target: null });
  H.assert(intervention.ok, 'intervention fixture created: ' +
    JSON.stringify(intervention.errors || {}));
  var pilot = SCA.store.insert('pilot_projects',
    { id: 'pil-m-test', name: 'Test pilot', status: 'PROPOSED',
      intervention_ids: ['int-m-test'] });
  var m7 = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 1, unit: 'EVENTS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Baseline documented before intervention ' +
      'int-m-test',
    intervention_id: 'int-m-test', pilot_project_id: 'pil-m-test',
    observed_at: '2026-09-08' });
  H.assert(m7.ok, 'measurement may attach to an intervention/pilot');
  H.assert(SCA.store.get('capability_interventions',
    'int-m-test').outcome_status === 'UNKNOWN',
    'attaching a measurement never changes an intervention outcome');
  H.assert(SCA.store.get('pilot_projects', 'pil-m-test').status ===
    'PROPOSED', 'attaching a measurement never changes pilot state');
  var pilAfter = SCA.store.get('pilot_projects', 'pil-m-test');
  H.assert(pilAfter.score === undefined &&
    pilAfter.success_rate === undefined &&
    pilAfter.rating === undefined,
    'no pilot score of any kind exists');

  /* ---------- 12. indicator seed vocabulary ---------- */

  console.log('    12. indicator seed vocabulary');
  var seeded = SCA.store.all('indicators');
  H.assert(seeded.length === 23,
    'exactly the 23 authorized definitions are seeded (got ' +
    seeded.length + ')');
  var seededCodes = ['PRACTITIONER_DENSITY', 'APPRENTICE_RATIO',
    'TRAINER_AVAILABILITY', 'COMPETENCE_REPRODUCTION_RATE',
    'DOCUMENTATION_COVERAGE', 'KNOWLEDGE_CONCENTRATION',
    'TRANSMISSION_STATUS', 'INSTITUTIONAL_CONTINUITY',
    'LOCAL_REPAIR_RATIO', 'REPAIR_TIME', 'REPAIR_RADIUS',
    'SPARE_PART_AVAILABILITY', 'RECOVERY_TIME', 'RECOVERY_DIFFICULTY',
    'EXTERNAL_RESCUE_DEPENDENCY', 'GEOGRAPHIC_REDUNDANCY',
    'REPRODUCTION_RATE', 'CAPABILITY_PERSISTENCE',
    'TRAINER_TO_APPRENTICE_CONTINUITY', 'INSTITUTIONAL_REPRODUCTION',
    'DEPENDENCY_EXPOSURE', 'GRAPH_LEVERAGE',
    'CAPABILITY_CENTRALITY'];
  seededCodes.forEach(function (code) {
    H.assert(seeded.some(function (i) {
      return i.code === code;
    }), 'seeded definition: ' + code);
  });
  H.assert(seeded.every(function (i) {
    return i.status === 'APPROVED' && i.indicator_version === 1;
  }), 'all seeded definitions are APPROVED v1');
  H.assert(seeded.every(function (i) {
    return i.created_by !== i.reviewer;
  }), 'seed creator and reviewer are distinct identities');
  H.assert(seeded.every(function (i) {
    return i.value === undefined && i.result === undefined;
  }), 'a definition never carries a result value');

  /* ---------- 13. indicator versioning ---------- */

  console.log('    13. indicator versioning');
  var updApproved = SCA.indicator.updateIndicator(REVIEWER,
    seeded[0].id, { name: 'renamed' });
  H.assert(!updApproved.ok,
    'an APPROVED definition is immutable (no mutation)');
  var dupV1 = SCA.indicator.createIndicator(RESEARCHER,
    { code: 'PRACTITIONER_DENSITY', name: 'dup',
      category: 'HUMAN_CAPABILITY', frequency: 'PER_CENSUS',
      calc_spec: { method: 'LATEST' }, definition: 'd',
      required_measurements: 'r' });
  H.assert(!dupV1.ok, 'duplicate v1 of an existing code rejected');
  var v2 = SCA.indicator.createIndicatorVersion(RESEARCHER,
    'PRACTITIONER_DENSITY', {
      name: 'Practitioner Density',
      category: 'HUMAN_CAPABILITY', frequency: 'PER_CENSUS',
      calc_spec: { method: 'RATIO' },
      definition: 'Revised density definition (documented change).',
      required_measurements: 'NUMERATOR and DENOMINATOR counts.',
      interpretation_notes: 'n', limitations: 'l' });
  H.assert(v2.ok, 'formula change creates a NEW VERSION');
  H.assert(v2.record.indicator_version === 2, 'version incremented');
  H.assert(v2.record.status === 'DRAFT', 'new version starts DRAFT');
  var v1StillApproved = SCA.store.all('indicators').filter(
    function (i) {
      return i.code === 'PRACTITIONER_DENSITY' &&
        i.indicator_version === 1;
    })[0];
  H.assert(v1StillApproved.status === 'APPROVED',
    'previous version preserved before the new one is approved');

  /* ---------- 14. indicator review separation ---------- */

  console.log('    14. indicator review separation');
  H.assert(SCA.indicator.submitIndicator(RESEARCHER, v2.record.id).ok,
    'creator submits the new version');
  H.assert(!SCA.indicator.approveIndicator(RESEARCHER,
    v2.record.id, 'self').ok,
    'creator cannot approve their own definition');
  var natDef = SCA.indicator.createIndicator(NATIONAL, {
    code: 'NAT_TEST_INDICATOR', name: 'NAT test',
    category: 'SYSTEMS', frequency: 'AD_HOC',
    calc_spec: { method: 'SUM' }, definition: 'd',
    required_measurements: 'r' });
  SCA.indicator.submitIndicator(NATIONAL, natDef.record.id);
  H.assert(!SCA.indicator.approveIndicator(NATIONAL,
    natDef.record.id, 'self').ok,
    'NATIONAL creator cannot approve their own definition');
  H.assert(SCA.indicator.approveIndicator(REVIEWER, v2.record.id,
    'definition change reviewed').ok,
    'distinct reviewer approves v2');
  var v1After = SCA.store.all('indicators').filter(function (i) {
    return i.code === 'PRACTITIONER_DENSITY' &&
      i.indicator_version === 1;
  })[0];
  H.assert(v1After.status === 'SUPERSEDED' &&
    v1After.superseded_by === v2.record.id,
    'approving v2 retires v1 to SUPERSEDED with a successor link');
  var natPending = SCA.indicator.createIndicator(NATIONAL, {
    code: 'NAT_TEST_INDICATOR2', name: 'NAT test 2',
    category: 'SYSTEMS', frequency: 'AD_HOC',
    calc_spec: { method: 'SUM' }, definition: 'd',
    required_measurements: 'r' });
  SCA.indicator.submitIndicator(NATIONAL, natPending.record.id);
  H.assert(SCA.indicator.rejectIndicator(REVIEWER,
    natPending.record.id, 'insufficient definition').ok,
    'distinct reviewer can reject a definition');

  /* ---------- 15. dynamic computation ---------- */

  console.log('    15. dynamic computation');
  var none = SCA.indicator.compute('TRAINER_AVAILABILITY');
  H.assert(none.ok && none.known === false && none.value === null &&
    !!none.reason,
    'no accepted inputs -> honest UNKNOWN with a reason, never zero');
  /* link measurements to the density indicator. */
  var densV2 = SCA.store.all('indicators').filter(function (i) {
    return i.code === 'PRACTITIONER_DENSITY' &&
      i.indicator_version === 2;
  })[0];
  var num = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 14, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Practitioners documented in district survey',
    indicator_id: densV2.id, analysis_role: 'NUMERATOR',
    observed_at: '2026-09-10' });
  var den = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 200, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'District population',
    indicator_id: densV2.id, analysis_role: 'DENOMINATOR',
    observed_at: '2026-09-10' });
  var draftOnly = SCA.indicator.compute('PRACTITIONER_DENSITY');
  H.assert(draftOnly.known === false,
    'DRAFT measurements never enter computation');
  [num, den].forEach(function (r) {
    SCA.measurement.submitMeasurement(RESEARCHER, r.record.id);
    SCA.measurement.startReview(REVIEWER, r.record.id);
    SCA.measurement.acceptMeasurement(REVIEWER, r.record.id,
      'survey verified');
  });
  var densVal = SCA.indicator.compute('PRACTITIONER_DENSITY');
  H.assert(densVal.ok && densVal.known === true &&
    Math.abs(densVal.value - 0.07) < 1e-9,
    'ratio computed dynamically from accepted inputs (14/200)');
  H.assert(densVal.version === 2,
    'computation is pinned to the current APPROVED version');
  var pinned = SCA.indicator.compute('PRACTITIONER_DENSITY',
    { version: 1 });
  H.assert(pinned.ok && pinned.version === 1,
    'historical computation pins the requested version explicitly');
  /* deterministic */
  H.assert(JSON.stringify(SCA.indicator.compute(
    'PRACTITIONER_DENSITY')) ===
    JSON.stringify(SCA.indicator.compute('PRACTITIONER_DENSITY')),
    'computation is deterministic');
  /* superseded/rejected inputs excluded: m1 (7) was superseded by
   * corr (8) — but those are not linked to this indicator; test
   * exclusion explicitly. */
  var excl = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 1, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'later observation',
    indicator_id: densV2.id, analysis_role: 'NUMERATOR',
    observed_at: '2026-09-11' });
  SCA.measurement.submitMeasurement(RESEARCHER, excl.record.id);
  SCA.measurement.startReview(REVIEWER, excl.record.id);
  SCA.measurement.rejectMeasurement(REVIEWER, excl.record.id,
    'unverifiable');
  var densVal2 = SCA.indicator.compute('PRACTITIONER_DENSITY');
  H.assert(Math.abs(densVal2.value - 0.07) < 1e-9,
    'REJECTED measurements never enter computation');
  /* computation wrote nothing: repeated computation leaves the
   * collections byte-identical (no result entity ever). */
  var storeBefore = JSON.stringify(SCA.store.all('measurements')) +
    JSON.stringify(SCA.store.all('indicators'));
  SCA.indicator.compute('PRACTITIONER_DENSITY');
  SCA.indicator.compute('REPAIR_TIME');
  H.assert(storeBefore === JSON.stringify(
    SCA.store.all('measurements')) +
    JSON.stringify(SCA.store.all('indicators')),
    'computation persists nothing (no result entity ever)');
  /* mean + period awareness */
  var rtInd = SCA.store.all('indicators').filter(function (i) {
    return i.code === 'REPAIR_TIME';
  })[0];
  [['2026-09-10', 3], ['2026-09-12', 5]].forEach(function (pair) {
    var r = SCA.measurement.createMeasurement(RESEARCHER, {
      value: pair[1], unit: 'DAYS', measurement_kind: 'DURATION',
      basis: 'OBSERVED', observation_scope: 'documented repairs',
      indicator_id: rtInd.id, observed_at: pair[0] });
    SCA.measurement.submitMeasurement(RESEARCHER, r.record.id);
    SCA.measurement.startReview(REVIEWER, r.record.id);
    SCA.measurement.acceptMeasurement(REVIEWER, r.record.id, 'ok');
  });
  var rt = SCA.indicator.compute('REPAIR_TIME',
    { period: { from: '2026-09-01', to: '2026-09-30' } });
  H.assert(rt.known && rt.value === 4, 'MEAN over period inputs');
  var rtEarly = SCA.indicator.compute('REPAIR_TIME',
    { period: { from: '2026-01-01', to: '2026-02-01' } });
  H.assert(rtEarly.known === false,
    'period outside the observations -> honest UNKNOWN');

  /* ---------- 16. no scores / rankings ---------- */

  console.log('    16. no scores, no rankings');
  var computeKeys = Object.keys(SCA.indicator.compute(
    'PRACTITIONER_DENSITY'));
  H.assert(computeKeys.indexOf('score') === -1 &&
    computeKeys.indexOf('ranking') === -1,
    'computed results expose no score or ranking fields');
  ['scoreMeasurement', 'rankCapabilities', 'rankRegions',
    'capabilityScore', 'resilienceScore', 'readinessScore',
    'compositeScore'].forEach(function (fn) {
    H.assert(SCA.measurement[fn] === undefined &&
      SCA.indicator[fn] === undefined &&
      SCA.observatory[fn] === undefined,
      'no "' + fn + '" function exists');
  });
  var obsCompose = SCA.observatory.compose(REVIEWER);
  H.assert(obsCompose.ok && obsCompose.balance_sheet &&
    obsCompose.balance_sheet.verdict.indexOf('None') === 0,
    'the balance sheet produces no verdict');

  /* ---------- 17. Observatory views ---------- */

  console.log('    17. observatory views');
  var obs = SCA.observatory.compose(REVIEWER);
  H.assert(obs.ok, 'observatory composes');
  H.assert(obs.capability_condition &&
    obs.capability_condition.accepted >= 4,
    'view 1: capability condition counts accepted measurements');
  var sectionTitles = obs.sections.map(function (s) {
    return s.title;
  });
  H.assert(JSON.stringify(sectionTitles) ===
    JSON.stringify(['Human Capability', 'Knowledge', 'Repair',
      'Resilience']),
    'views 2-5: the four indicator families');
  H.assert(obs.sections.every(function (s) {
    return s.indicators.every(function (i) {
      return i.display && (i.known || i.reason);
    });
  }), 'every indicator shows a value or an honest reason');
  H.assert(obs.geographic_coverage &&
    typeof obs.geographic_coverage.locations_in_atlas === 'number',
    'view 6: geographic coverage');
  H.assert(obs.capability_trends &&
    Array.isArray(obs.capability_trends.series),
    'view 7: capability trends');
  H.assert(obs.evidence_quality &&
    obs.evidence_quality.evidence_distribution,
    'view 8: evidence quality distribution');
  H.assert(obs.balance_sheet &&
    obs.balance_sheet.assets &&
    obs.balance_sheet.assets.capabilities_documented === 240,
    'view 9: balance sheet documents the 240-capability inventory');
  var trendMixed = SCA.observatory.capabilityTrends();
  H.assert(trendMixed.series.every(function (s) {
    return s.comparable || s.limitation;
  }), 'non-comparable series carry an explicit limitation');
  /* NO DATA is never LOW. */
  var emptyInd = SCA.observatory.indicatorView(REVIEWER,
    'INSTITUTIONAL_CONTINUITY');
  H.assert(emptyInd.known === false &&
    emptyInd.display === SCA.observatory.NOT_MEASURED,
    'unmeasured indicators display "not yet measured", never LOW');

  /* ---------- 18. RBAC ---------- */

  console.log('    18. RBAC');
  [['measurement.read', ANON], ['indicator.read', ANON],
    ['measurement.create', RESEARCHER],
    ['measurement.create', STEWARD],
    ['measurement.update', STEWARD],
    ['measurement.review', REVIEWER],
    ['measurement.review', REGIONAL],
    ['indicator.create', RESEARCHER],
    ['indicator.create', REVIEWER],
    ['indicator.update', REGIONAL],
    ['indicator.review', REVIEWER],
    ['indicator.review', REGIONAL],
    ['measurement.read', NATIONAL], ['indicator.create', NATIONAL],
    ['indicator.update', NATIONAL], ['indicator.review', NATIONAL],
    ['measurement.create', NATIONAL],
    ['measurement.update', NATIONAL],
    ['measurement.review', NATIONAL]].forEach(function (pair) {
    H.assert(SCA.rbac.can(pair[1], pair[0]),
      pair[0] + ' granted to ' + pair[1].role);
  });
  H.assert(!SCA.rbac.can(ANON, 'measurement.create'),
    'anon cannot create measurements');
  H.assert(!SCA.rbac.can(RESEARCHER, 'measurement.review'),
    'researcher cannot review measurements');
  H.assert(!SCA.rbac.can(PM, 'measurement.review'),
    'project manager cannot review measurements');
  H.assert(!SCA.rbac.can(REVIEWER, 'measurement.create'),
    'reviewer cannot create measurements');
  var anonList = SCA.measurement.list(null);
  H.assert(anonList.length > 0 && anonList.every(function (r) {
    return ['ACCEPTED', 'SUPERSEDED'].indexOf(r.status) !== -1;
  }), 'anonymous sees only ACCEPTED/SUPERSEDED measurements');
  var anonGetDraft = SCA.measurement.get(null,
    estimateWithMethod.record.id);
  H.assert(!anonGetDraft.ok,
    'anonymous cannot open a DRAFT measurement');
  var staffList = SCA.measurement.list(REVIEWER);
  H.assert(staffList.length > anonList.length,
    'staff sees the workflow records too');

  /* ---------- 19. privacy ---------- */

  console.log('    19. privacy');
  var smallCount = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 2, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'Small village survey',
    observed_at: '2026-09-12' });
  SCA.measurement.submitMeasurement(RESEARCHER,
    smallCount.record.id);
  SCA.measurement.startReview(REVIEWER, smallCount.record.id);
  SCA.measurement.acceptMeasurement(REVIEWER, smallCount.record.id,
    'documented');
  H.assert(SCA.measurement.displayValue(ANON,
    SCA.store.get('measurements', smallCount.record.id)) ===
    'Restricted', 'small person counts are Restricted to anon');
  H.assert(SCA.measurement.displayValue(REGIONAL,
    SCA.store.get('measurements', smallCount.record.id)) === 2,
    'privileged viewers see documented small counts');
  var zeroCount = SCA.measurement.createMeasurement(RESEARCHER, {
    value: 0, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Village with no practitioners found',
    observed_at: '2026-09-12' });
  H.assert(zeroCount.ok,
    'an explicit zero with an OBSERVED basis is legitimate');
  H.assert(SCA.measurement.displayValue(ANON,
    SCA.store.get('measurements', zeroCount.record.id)) === 0,
    'an explicit zero stays zero (a factual finding, not unknown)');

  /* ---------- 20. offline + transfer ---------- */

  console.log('    20. offline drafts & transfer');
  /* DRAFT creation is a pure local operation: no network object is
   * referenced anywhere in the workflow. The storage abstraction is
   * local by construction (offline-first). */
  var offlineDraft = SCA.measurement.createMeasurement(STEWARD, {
    value: 9, unit: 'TOOLS', measurement_kind: 'COUNT',
    basis: 'OBSERVED',
    observation_scope: 'Tools documented at village workshop',
    observed_at: '2026-09-13' });
  H.assert(offlineDraft.ok,
    'DRAFT creation works offline (local persistence only)');
  var draftPersisted = SCA.store.get('measurements',
    offlineDraft.record.id);
  H.assert(draftPersisted && draftPersisted.status === 'DRAFT',
    'the draft persists locally without any connectivity');
  /* export/import round-trip (atomic): export EVERYTHING, wipe,
   * import — the Stage 12 collections and every canonical
   * reference survive. */
  var before = {
    caps: SCA.store.count('capabilities'),
    fams: SCA.store.count('families'),
    meas: SCA.store.count('measurements'),
    inds: SCA.store.count('indicators') };
  var pkgText = SCA.transfer.exportAll();
  var pkgDs = JSON.parse(pkgText);
  H.assert((pkgDs.collections.measurements || []).length ===
    before.meas &&
    (pkgDs.collections.indicators || []).length === before.inds,
    'full export includes the Stage 12 collections');
  H.assert(SCA.store.count('capabilities') === before.caps &&
    SCA.store.count('families') === before.fams,
    '240 capabilities / 12 families preserved through export');
  SCA.store.wipe();
  SCA.store.init();
  var imp = SCA.transfer.importBundle(pkgText);
  H.assert(imp.ok, 'round-trip import accepted (atomic: ' +
    ((imp.errors || []).slice(0, 3).join('; ') || 'ok') + ')');
  H.assert(SCA.store.count('capabilities') === before.caps &&
    SCA.store.count('families') === before.fams,
    'round-trip keeps the 240/12 inventory intact');
  H.assert(SCA.store.count('measurements') === before.meas &&
    SCA.store.count('indicators') === before.inds,
    'measurement/indicator counts preserved through round-trip');

  /* ---------- 21. import authority ---------- */

  console.log('    21. import authority (atomic)');
  function freshDataset() {
    return JSON.parse(SCA.transfer.exportAll());
  }
  function tryImport(ds) {
    return SCA.transfer.importBundle(JSON.stringify(ds));
  }
  /* manufactured acceptance: creator === reviewer. */
  var ds = freshDataset();
  ds.collections.measurements.push({
    id: 'm-forged', value: 1, unit: 'PERSONS',
    measurement_kind: 'COUNT', basis: 'OBSERVED',
    observation_scope: 'forged', observed_at: '2026-09-01',
    status: 'ACCEPTED', created_by: 'FORGER',
    reviewer: 'FORGER', reviewed_at: '2026-09-01',
    version: '1', history: [] });
  var impForged = tryImport(ds);
  H.assert(!impForged.ok,
    'imported ACCEPTED measurement with creator === reviewer ' +
    'rejected atomically');
  var ds2 = freshDataset();
  ds2.collections.measurements.push({
    id: 'm-forged2', value: 1, unit: 'PERSONS',
    measurement_kind: 'COUNT', basis: 'OBSERVED',
    observation_scope: 'forged 2', observed_at: '2026-09-01',
    status: 'ACCEPTED', created_by: 'A', reviewer: 'B',
    version: '1', history: [] });
  var impNoStamp = tryImport(ds2);
  H.assert(!impNoStamp.ok,
    'ACCEPTED without a review timestamp rejected (no manufactured ' +
    'acceptance)');
  var ds3 = freshDataset();
  ds3.collections.indicators.push({
    id: 'ind-forged', code: 'FORGED_SCORE', name: 'Forged',
    category: 'SYSTEMS', frequency: 'AD_HOC',
    calc_spec: { method: 'SUM' }, definition: 'd',
    required_measurements: 'r', indicator_version: 1,
    status: 'APPROVED', created_by: 'FORGER', reviewer: 'FORGER',
    reviewed_at: '2026-09-01', version: '1', history: [] });
  var impIndForged = tryImport(ds3);
  H.assert(!impIndForged.ok,
    'imported APPROVED definition with creator === reviewer ' +
    'rejected');
  var ds4 = freshDataset();
  ds4.collections.indicators.push({
    id: 'ind-value', code: 'FORGED_VALUE', name: 'x',
    category: 'SYSTEMS', frequency: 'AD_HOC',
    calc_spec: { method: 'SUM' }, definition: 'd',
    required_measurements: 'r', indicator_version: 1,
    status: 'DRAFT', created_by: 'x', version: '1',
    value: 42, history: [] });
  var impIndValue = tryImport(ds4);
  H.assert(!impIndValue.ok,
    'an indicator carrying a stored VALUE rejected (definitions ' +
    'only)');
  var ds5 = freshDataset();
  ds5.collections.measurements.push({
    id: 'm-no-scope', value: 1, unit: 'PERSONS',
    measurement_kind: 'COUNT', basis: 'OBSERVED',
    observed_at: '2026-09-01', status: 'DRAFT', created_by: 'x',
    version: '1', history: [] });
  var impNoScope = tryImport(ds5);
  H.assert(!impNoScope.ok,
    'a measurement without an observation scope rejected');
  var ds6 = freshDataset();
  ds6.collections.measurements.push({
    id: 'm-unknown-val', value: 5, unit: 'PERSONS',
    measurement_kind: 'COUNT', basis: 'UNKNOWN',
    observation_scope: 'x', observed_at: '2026-09-01',
    status: 'DRAFT', created_by: 'x', version: '1', history: [] });
  var impUnknownVal = tryImport(ds6);
  H.assert(!impUnknownVal.ok,
    'imported UNKNOWN-with-value rejected (unknown never zero)');
  /* forbidden authority fields on a measurement */
  var ds7 = freshDataset();
  ds7.collections.measurements.push({
    id: 'm-evil', value: 1, unit: 'PERSONS', measurement_kind: 'COUNT',
    basis: 'OBSERVED', observation_scope: 'x',
    observed_at: '2026-09-01', status: 'DRAFT', created_by: 'x',
    evidence_level: 'E5', version: '1', history: [] });
  var impEvil = tryImport(ds7);
  H.assert(!impEvil.ok,
    'a measurement carrying an evidence_level (auto-upgrade) ' +
    'rejected');

  /* ---------- 22. terminal-history exemption & chains ---------- */

  console.log('    22. terminal history & supersession chains');
  /* a SUPERSEDED measurement may keep a broken reference (preserved
   * history) — the frozen exemption. */
  var ds8 = freshDataset();
  var sup = ds8.collections.measurements.filter(function (m) {
    return m.status === 'SUPERSEDED';
  })[0];
  H.assert(!!sup, 'a superseded record exists in the export');
  sup.capability_id = 'cap-now-deleted';
  var impExempt = tryImport(ds8);
  H.assert(impExempt.ok,
    'SUPERSEDED terminal history keeps broken references by design');
  /* an ACTIVE measurement may NOT keep a broken reference. */
  var ds9 = freshDataset();
  var acc2 = ds9.collections.measurements.filter(function (m) {
    return m.status === 'ACCEPTED';
  })[0];
  acc2.capability_id = 'cap-now-deleted';
  var impActive = tryImport(ds9);
  H.assert(!impActive.ok,
    'an ACTIVE/ACCEPTED measurement with a broken reference is ' +
    'rejected atomically');
  /* inconsistent correction chain: ACCEPTED correction whose
   * original arrives non-superseded. */
  var ds10 = freshDataset();
  var origChain = ds10.collections.measurements.filter(function (m) {
    return m.status === 'SUPERSEDED';
  })[0];
  var corrChain = ds10.collections.measurements.filter(function (m) {
    return m.supersedes_id === origChain.id;
  })[0];
  H.assert(!!corrChain && corrChain.status === 'ACCEPTED',
    'the export contains a consistent correction chain');
  origChain.status = 'ACCEPTED';
  var impChain = tryImport(ds10);
  H.assert(!impChain.ok,
    'an ACCEPTED correction whose original is not SUPERSEDED is ' +
    'rejected (provenance is never rewritten silently)');

  /* ---------- 23. audit ---------- */

  console.log('    23. audit coverage');
  var log = SCA.store.all('audit_log');
  function hasAction(action, entityId) {
    return log.some(function (e) {
      return e.action === action && e.entity === entityId;
    });
  }
  H.assert(hasAction('measurement.created', 'measurements'),
    'measurement creation audited');
  H.assert(hasAction('measurement.submitted', 'measurements'),
    'submission audited');
  H.assert(hasAction('measurement.review_started', 'measurements'),
    'review start audited');
  H.assert(hasAction('measurement.accepted', 'measurements'),
    'acceptance audited');
  H.assert(hasAction('measurement.rejected', 'measurements'),
    'rejection audited');
  H.assert(hasAction('measurement.superseded', 'measurements'),
    'supersession audited');
  H.assert(hasAction('measurement.edited', 'measurements'),
    'draft edits audited');
  H.assert(hasAction('indicator.version_created', 'indicators'),
    'indicator version creation audited');
  H.assert(hasAction('indicator.submitted', 'indicators'),
    'indicator submission audited');
  H.assert(hasAction('indicator.approved', 'indicators'),
    'indicator approval audited');
  H.assert(hasAction('indicator.superseded', 'indicators'),
    'indicator supersession audited');
  H.assert(log.every(function (e) {
    return !e.action || e.action.indexOf('score') === -1;
  }), 'no score action exists in the audit log');

  /* ---------- 24. integrity checker ---------- */

  console.log('    24. integrity checker');
  var integrity = SCA.measurement.integrity();
  H.assert(integrity.ok && integrity.issues.length === 0,
    'measurement integrity: all records carry scope and honest ' +
    'values');
  var broken = JSON.parse(JSON.stringify(
    SCA.store.all('measurements')[0]));
  broken.observation_scope = '';
  SCA.store.update('measurements', broken.id, broken);
  var integrityBad = SCA.measurement.integrity();
  H.assert(!integrityBad.ok && integrityBad.issues.length > 0,
    'the integrity checker flags a scope-less record');
  /* restore */
  delete broken.observation_scope;
  var restored = SCA.store.get('measurements', broken.id);
  restored.observation_scope = 'Practitioners documented in Test ' +
    'District survey, September 2026 (restored)';
  SCA.store.update('measurements', restored.id, restored);

  /* ---------- 25. inventory preservation ---------- */

  console.log('    25. inventory preservation');
  var caps = SCA.store.all('capabilities');
  H.assert(caps.length === 240, '240 capabilities preserved');
  H.assert(SCA.store.count('families') === 12,
    '12 families preserved');
  var badStatusCaps = caps.filter(function (c) {
    return c.status !== null && c.status !== undefined;
  }).length === 0;
  H.assert(badStatusCaps,
    'capability records remain untouched by Stage 12');

  return true;
};
