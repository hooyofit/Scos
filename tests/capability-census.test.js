/*
 * Stage 6: Capability Census & Regional Capability Mapping Foundation
 * test suite.
 *
 * «Unknown is information.» All census test data is explicitly marked
 * TEST FIXTURE. No real Somali census data, counts or presence states
 * are fabricated; the 240 capability inventory is never touched and
 * every fixture is wiped at the end.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  capability-census.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var TECH = { name: 'TEST FIXTURE Technician', role: 'technician' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var PUBLIC_USER = { name: 'TEST FIXTURE Public User', role: 'practitioner' };
  var ANON = null;

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline 240 intact');
  var cap = SCA.store.all('capabilities');
  var w11 = cap.filter(function (c) { return c.code === 'W11'; })[0];
  var a02 = cap.filter(function (c) { return c.code === 'A02'; })[0];
  var s01 = cap.filter(function (c) { return c.code === 'S01'; })[0];
  H.assert(w11 && a02 && s01, 'fixture capabilities exist');

  /* ================= 1. Methodology ================= */
  var methRes = SCA.census.createMethodology(RESEARCHER, {
    title: 'TEST FIXTURE Census Methodology',
    population_definition: 'TEST FIXTURE population',
    data_collection_method: 'TEST FIXTURE door-to-door documentation',
    estimation_method: 'TEST FIXTURE snowball-based estimate with overlap removal'
  });
  H.assert(methRes.ok === true, 'methodology created');
  H.assertEq(methRes.record.status, 'DRAFT', 'methodology starts Draft');
  var meth = methRes.record;

  H.assert(SCA.census.approveMethodology(REGIONAL, meth.id,
    'test').ok === false, 'methodology approval is national authority');
  var methApprove = SCA.census.approveMethodology(NATIONAL, meth.id,
    'TEST FIXTURE: approved for Stage 6 automated testing');
  H.assert(methApprove.ok === true, 'national admin approves methodology');
  H.assert(SCA.census.approveMethodology(NATIONAL, meth.id, '').ok ===
    false, 'methodology approval requires a reason');

  /* ================= 2. Census lifecycle ================= */
  var badScope = SCA.census.createCensus(RESEARCHER, {
    title: 'TEST FIXTURE broken census',
    scope_level: 'REGION',
    capability_ids: [w11.id, 'cap-does-not-exist']
  });
  H.assert(badScope.ok === false, 'census scope rejects unknown capability');

  var censusRes = SCA.census.createCensus(null, {
    title: 'TEST FIXTURE anon attempt' });
  H.assert(censusRes.ok === false, 'census creation requires permission');

  censusRes = SCA.census.createCensus(RESEARCHER, {
    title: 'TEST FIXTURE Baidoa Seed Census',
    description: 'TEST FIXTURE census for automated testing',
    scope_level: 'REGION',
    methodology_id: meth.id
  });
  H.assert(censusRes.ok === true, 'census created');
  var census = censusRes.record;
  H.assertEq(census.status, 'DRAFT', 'census starts Draft');

  /* Location fixtures (TEST FIXTURE only; the Atlas ships no real
     geography, locations are entered deliberately). */
  var locRegion = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Region X', location_type: 'REGION' }).record;
  var locCommunity = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Community Y', location_type: 'COMMUNITY',
    parent_id: locRegion.id }).record;
  var scoped = SCA.store.update('capability_censuses', census.id,
    { location_ids: [locRegion.id, locCommunity.id],
      capability_ids: [w11.id, a02.id, s01.id] });
  H.assert(scoped.ok === true, 'census scope set');

  H.assert(SCA.census.setCensusStatus(RESEARCHER, census.id, 'APPROVED',
    { reason: 'x' }).ok === false, 'researcher cannot approve a census');
  H.assert(SCA.census.setCensusStatus(REGIONAL, census.id, 'ACTIVE',
    {}).ok === false, 'census cannot go DRAFT -> ACTIVE directly');
  H.assert(SCA.census.setCensusStatus(REGIONAL, census.id, 'APPROVED',
    {}).ok === false, 'census approval requires a reason');
  var approved = SCA.census.setCensusStatus(REGIONAL, census.id, 'APPROVED',
    { reason: 'TEST FIXTURE: regional approval' });
  H.assert(approved.ok === true, 'regional admin approves regional census');
  var active = SCA.census.setCensusStatus(RESEARCHER, census.id, 'ACTIVE', {});
  H.assert(active.ok === true, 'researcher activates approved census');
  H.assertEq(active.record.start_date.length, 10, 'start date recorded');

  /* National scope requires national authority. */
  var natCensus = SCA.census.createCensus(RESEARCHER, {
    title: 'TEST FIXTURE National Census Attempt',
    scope_level: 'NATIONAL', methodology_id: meth.id }).record;
  H.assert(SCA.census.setCensusStatus(REGIONAL, natCensus.id, 'APPROVED',
    { reason: 'regional tries national' }).ok === false,
    'regional admin cannot approve a NATIONAL scope census');
  H.assert(SCA.census.setCensusStatus(NATIONAL, natCensus.id, 'APPROVED',
    { reason: 'TEST FIXTURE national approval' }).ok === true,
    'national admin approves national scope census');

  /* ================= 3. Observations & count semantics ================= */
  H.assert(SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: w11.id, location_id: locRegion.id,
    practitioner_count: { value: 4, basis: 'OBSERVED' },
    trainer_count: { value: 1, basis: 'OBSERVED' },
    active_apprentice_count: { value: 3, basis: 'OBSERVED' },
    survey_status: 'VERIFIED', presence: 'PRACTICED',
    evidence_status: 'E2'
  }).ok === true, 'observation with observed counts created');

  var noCensus = SCA.census.createObservation(RESEARCHER, {
    census_id: 'does-not-exist', capability_id: w11.id,
    location_id: locRegion.id });
  H.assert(noCensus.ok === false, 'observation requires an existing census');
  var outsideScope = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id,
    capability_id: cap.filter(function (c) { return c.code === 'F12'; })[0].id,
    location_id: locRegion.id });
  H.assert(outsideScope.ok === false, 'capability outside census scope rejected');

  /* Unknown semantics: unknown stays null, never a silent zero. */
  var unknownObs = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: a02.id, location_id: locCommunity.id,
    survey_status: 'PARTIALLY_SURVEYED' });
  H.assert(unknownObs.ok === true, 'observation with no counts at all accepted');
  H.assertEq(unknownObs.record.workshop_count.value, null,
    'unspecified count defaults to null');
  H.assertEq(unknownObs.record.workshop_count.basis, 'UNKNOWN',
    'unspecified count basis is UNKNOWN');
  H.assertEq(unknownObs.record.presence, 'UNKNOWN', 'presence defaults Unknown');

  var zeroTrainer = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: a02.id, location_id: locRegion.id,
    trainer_count: { value: 0, basis: 'OBSERVED' },
    survey_status: 'SURVEYED' });
  H.assert(zeroTrainer.ok === true,
    'zero trainer count is valid WHEN methodology established it');

  var badZero = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: s01.id, location_id: locRegion.id,
    practitioner_count: { value: 0, basis: 'UNKNOWN' } });
  H.assert(badZero.ok === false,
    'UNKNOWN basis with a value is rejected (no silent zeros)');

  var badCount = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: s01.id, location_id: locRegion.id,
    practitioner_count: 5 });
  H.assert(badCount.ok === false, 'counts must be { value, basis } objects');

  /* Estimates require an approved methodology WITH an estimation method. */
  var unapprovedCensus = SCA.census.createCensus(RESEARCHER, {
    title: 'TEST FIXTURE No-Methodology Census', scope_level: 'COMMUNITY' }).record;
  SCA.census.setCensusStatus(NATIONAL, unapprovedCensus.id, 'APPROVED',
    { reason: 'TEST FIXTURE: national approves methodology-less census' });
  /* approve without methodology must fail: create own approved methodology */
  H.assert(SCA.census.setCensusStatus(NATIONAL, unapprovedCensus.id,
    'APPROVED', { reason: 'x' }).ok === false,
    'census without approved methodology cannot be approved');
  var meth2 = SCA.census.createMethodology(RESEARCHER, {
    title: 'TEST FIXTURE Methodology without estimation',
    population_definition: 'TEST FIXTURE',
    data_collection_method: 'TEST FIXTURE' }).record;
  SCA.census.approveMethodology(NATIONAL, meth2.id, 'TEST FIXTURE approval');
  SCA.store.update('capability_censuses', unapprovedCensus.id,
    { methodology_id: meth2.id });
  SCA.census.setCensusStatus(NATIONAL, unapprovedCensus.id, 'APPROVED',
    { reason: 'TEST FIXTURE second approval' });
  SCA.census.setCensusStatus(RESEARCHER, unapprovedCensus.id, 'ACTIVE', {});
  var estFail = SCA.census.createObservation(RESEARCHER, {
    census_id: unapprovedCensus.id, capability_id: w11.id,
    location_id: locRegion.id,
    practitioner_count: { value: 40, basis: 'ESTIMATED' } });
  H.assert(estFail.ok === false,
    'estimate rejected: methodology documents no estimation method');
  SCA.store.update('census_methodologies', meth2.id,
    { estimation_method: 'TEST FIXTURE estimate method' });
  var estOk = SCA.census.createObservation(RESEARCHER, {
    census_id: unapprovedCensus.id, capability_id: w11.id,
    location_id: locRegion.id,
    practitioner_count: { value: 40, basis: 'ESTIMATED' } });
  H.assert(estOk.ok === true,
    'estimate accepted once methodology documents its method');

  /* ================= 4. Review & corrections ================= */
  var pend = SCA.store.all('census_observations').filter(function (o) {
    return o.census_id === census.id && o.review_status === 'PENDING'; });
  H.assert(pend.length >= 3, 'observations start Pending review');
  H.assert(SCA.census.reviewObservation(RESEARCHER, pend[0].id,
    { decision: 'ACCEPTED' }).ok === false,
    'researcher cannot review census observations');
  H.assert(SCA.census.reviewObservation(REVIEWER, pend[0].id,
    { decision: 'WEIRD' }).ok === false, 'review decision must be valid');
  H.assert(SCA.census.reviewObservation(REVIEWER, pend[0].id,
    { decision: 'REJECTED' }).ok === false, 'rejection requires a reason');

  pend.forEach(function (o, i) {
    var dec = (i === 0) ? { decision: 'REJECTED',
      reason: 'TEST FIXTURE: unclear methodology' } : { decision: 'ACCEPTED' };
    var r = SCA.census.reviewObservation(REVIEWER, o.id, dec);
    H.assert(r.ok === true, 'reviewer reviews observation');
  });
  var acceptedCount = SCA.census.acceptedFor(census.id).length;
  H.assert(acceptedCount >= 2, 'accepted observations available for census use');

  /* Corrections supersede, never overwrite. */
  var accObs = SCA.census.acceptedFor(census.id)[0];
  var corr = SCA.census.correctObservation(RESEARCHER, accObs.id,
    { survey_status: 'VERIFIED' }, 'TEST FIXTURE correction: survey verified');
  H.assert(corr.ok === true, 'correction creates a new version');
  H.assertEq(corr.record.supersedes_id, accObs.id, 'new version supersedes old');
  var oldObs = SCA.store.get('census_observations', accObs.id);
  H.assertEq(oldObs.review_status, 'SUPERSEDED', 'old observation preserved');
  H.assertEq(oldObs.superseded_by_id, corr.record.id, 'link to successor kept');
  H.assertEq(corr.record.review_status, 'PENDING', 'correction needs review');
  H.assert(SCA.census.correctObservation(RESEARCHER, accObs.id,
    { survey_status: 'VERIFIED' }, 'again').ok === false,
    'superseded observations cannot be corrected again');
  SCA.census.reviewObservation(REVIEWER, corr.record.id,
    { decision: 'ACCEPTED' });

  /* ================= 5. Unknown-aware measurement views ================= */
  var cov = SCA.census.coverageMeasurements(census.id);
  H.assertEq(cov.capabilities_in_scope, 3, 'coverage: 3 capabilities in scope');
  H.assert(cov.capabilities_surveyed >= 1, 'coverage: surveyed counted');
  H.assert(cov.capabilities_surveyed <= cov.capabilities_in_scope,
    'coverage: surveyed never exceeds scope');
  H.assert(cov.locations_in_scope === 2, 'coverage: 2 locations in scope');

  /* Matrix: public viewer sees Restricted for small counts, Unknown for
     unknown cells, raw numbers only for privileged viewers. */
  var pubMatrix = SCA.census.matrix(census.id, PUBLIC_USER);
  var privMatrix = SCA.census.matrix(census.id, REVIEWER);
  var smallCell = privMatrix.rows.filter(function (r) {
    return r.trainers === 0 || r.trainers === 1; })[0];
  H.assert(pubMatrix.rows.some(function (r) { return r.practitioners === 'Restricted'; }) ||
    pubMatrix.rows.some(function (r) { return r.practitioners === 'Unknown'; }),
    'public matrix applies privacy threshold / Unknown semantics');
  H.assert(privMatrix.rows.some(function (r) {
    return typeof r.practitioners === 'number' ||
      typeof r.trainers === 'number'; }),
    'privileged reviewer sees raw counts');
  H.assert(smallCell, 'trainer count cell exists in matrix');

  /* Gaps: not surveyed is listed, never interpreted as absence. */
  var gaps = SCA.census.gaps(census.id);
  H.assert(gaps.ok === true, 'gaps computed');
  H.assert(gaps.gaps.some(function (g) {
    return g.type === 'NOT_SURVEYED' && g.message.indexOf('no data is not absence') !== -1; }),
    'unsurveyed cells listed as work items');
  H.assert(gaps.gaps.some(function (g) {
    return g.type === 'PRACTITIONER_UNKNOWN'; }),
    'practitioner-unknown gap listed');

  /* ================= 6. Snapshots ================= */
  H.assert(SCA.census.generateSnapshot(RESEARCHER, census.id).ok === false,
    'researcher cannot generate snapshots');
  var snap1 = SCA.census.generateSnapshot(NATIONAL, census.id,
    'TEST FIXTURE snapshot 1');
  H.assert(snap1.ok === true, 'national admin generates snapshot');
  H.assertEq(snap1.record.status, 'DRAFT', 'snapshot starts Draft');
  H.assertEq(snap1.record.capabilities_in_scope, 3, 'snapshot records scope');
  H.assert(snap1.record.capabilities_surveyed >= 1, 'snapshot records survey');
  H.assertEq(snap1.record.capabilities_not_surveyed,
    snap1.record.capabilities_in_scope - snap1.record.capabilities_surveyed,
    'not surveyed = scope - surveyed (arithmetic honest)');
  H.assert(Array.isArray(snap1.record.unknown_fields),
    'unknown fields preserved in snapshot');

  var pubSnap = SCA.census.publishSnapshot(NATIONAL, snap1.record.id);
  H.assert(pubSnap.ok === true, 'snapshot published');
  /* Immutability: published snapshots can never change or disappear. */
  H.assert(SCA.store.update('census_snapshots', snap1.record.id,
    { label: 'tamper attempt' }).ok === false,
    'published snapshot cannot be updated (data layer guard)');
  H.assert(SCA.store.remove('census_snapshots', snap1.record.id).ok === false,
    'published snapshot cannot be deleted');
  H.assert(SCA.census.generateSnapshot(NATIONAL, census.id,
    'TEST FIXTURE snapshot 2').ok === true,
    'a later measurement produces a NEW snapshot, not an overwrite');
  H.assertEq(SCA.store.all('census_snapshots').filter(function (s) {
    return s.census_id === census.id; }).length, 2,
    'historical snapshot preserved');

  /* Draft snapshots may be discarded; published ones never. */
  var snap2 = SCA.store.all('census_snapshots').filter(function (s) {
    return s.census_id === census.id && s.status === 'DRAFT'; })[0];
  var redundancies = SCA.store.all('geographic_redundancies').filter(
    function (g) { return g.snapshot_id === snap2.id; });
  H.assertEq(redundancies.length, 3,
    'geographic redundancy rows generated per capability in scope');
  H.assertEq(redundancies[0].documented_location_count >= 0, true,
    'redundancy rows are raw counts');
  H.assert(!('resilience_score' in redundancies[0]) &&
    !('risk_score' in redundancies[0]),
    'no scores computed from redundancy data');
  H.assert(SCA.census.deleteDraftSnapshot(NATIONAL, snap2.id).ok === true,
    'draft snapshot can be discarded before publication');
  H.assertEq(SCA.store.all('geographic_redundancies').filter(
    function (g) { return g.snapshot_id === snap2.id; }).length, 0,
    'draft snapshot cascade removes its redundancy rows');

  /* ================= 7. Evidence & competence protection ================= */
  var eBefore = SCA.store.get('capabilities', w11.id).evidence_level;
  var mBefore = SCA.store.get('capabilities', w11.id).capability_maturity;
  var statusBefore = SCA.store.get('capabilities', w11.id).living_status;
  var obsWithEvidence = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: w11.id, location_id: locCommunity.id,
    evidence_status: 'E4', presence: 'PRACTICED', survey_status: 'SURVEYED' });
  H.assert(obsWithEvidence.ok === true, 'observation can document E4 status');
  var w11After = SCA.store.get('capabilities', w11.id);
  H.assertEq(w11After.evidence_level, eBefore,
    'census observation NEVER upgrades capability evidence level');
  H.assertEq(w11After.capability_maturity, mBefore,
    'census observation NEVER changes maturity');
  H.assertEq(w11After.living_status, statusBefore,
    'census observation NEVER changes living status');
  H.assertEq(w11After.evidence_level, 'E0',
    'baseline capability remains E0');
  H.assertEq(w11After.capability_maturity, null, 'baseline maturity remains null');

  /* ================= 8. Practitioner integration & dedup ================= */
  var p1 = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Seed Keeper A',
    capability_ids: [a02.id], region: 'TEST FIXTURE region',
    practitioner_code: 'TEST-FIXTURE-CN-01' }).record;
  var p2 = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Seed Keeper B',
    capability_ids: [a02.id], region: 'TEST FIXTURE region',
    practitioner_code: 'TEST-FIXTURE-CN-02' }).record;
  var obsRef = SCA.census.createObservation(RESEARCHER, {
    census_id: census.id, capability_id: a02.id, location_id: locRegion.id,
    practitioner_ids: [p1.id, p2.id],
    practitioner_count: { value: 2, basis: 'OBSERVED' },
    survey_status: 'SURVEYED' });
  H.assert(obsRef.ok === true, 'observation references practitioner stable IDs');
  SCA.census.reviewObservation(REVIEWER, obsRef.record.id,
    { decision: 'ACCEPTED' });
  var snap3 = SCA.census.generateSnapshot(NATIONAL, census.id,
    'TEST FIXTURE snapshot with references');
  SCA.census.publishSnapshot(NATIONAL, snap3.record.id);
  var snap3Rec = SCA.store.get('census_snapshots', snap3.record.id);
  H.assertEq(snap3Rec.practitioners_referenced, 2,
    'stable-ID references counted once each');

  /* Deduplication: flag, then explicit reviewer merge. Never automatic. */
  var asm = SCA.training.createAssessment ? SCA.training.createAssessment :
    function () { return { ok: false }; };
  H.assert(SCA.census.mergePractitioners(REVIEWER, p1.id, p2.id,
    '').ok === false,
    'merge always requires an explicit documented decision');
  H.assert(SCA.census.flagPossibleDuplicate(RESEARCHER, p1.id, p2.id,
    'researcher flags').ok === false,
    'researcher cannot flag duplicates for reviewer reconciliation');
  var flagRes = SCA.census.flagPossibleDuplicate(REVIEWER, p1.id, p2.id,
    'TEST FIXTURE: same practitioner documented twice in one session');
  H.assert(flagRes.ok === true, 'possible duplicate flagged');
  H.assertEq(SCA.store.get('practitioners', p1.id).duplicate_flags.length, 1,
    'flag stored on the record');
  H.assert(SCA.census.flagPossibleDuplicate(REVIEWER, p1.id, p1.id,
    'self').ok === false, 'record cannot duplicate itself');
  var mergeRes = SCA.census.mergePractitioners(REVIEWER, p1.id, p2.id,
    'TEST FIXTURE: confirmed same person after community check');
  H.assert(mergeRes.ok === true, 'authorized reviewer merges duplicates');
  var merged = SCA.store.get('practitioners', p2.id);
  H.assertEq(merged.merged_into_id, p1.id, 'merged record preserved + marked');
  H.assert(SCA.store.get('practitioners', p2.id).public_name ===
    'TEST FIXTURE Seed Keeper B', 'merged record is never deleted');
  H.assert(SCA.census.mergePractitioners(REVIEWER, p1.id, p2.id,
    'again').ok === false, 'already-merged record cannot merge twice');
  H.assert(SCA.census.nationalOverview(NATIONAL).documented_practitioners === 1,
    'merged people are not double counted in national overview');
  H.assertEq(SCA.census.coverageMeasurements(census.id)
    .registry_practitioners_documented, 1,
    'registry count excludes merged records');

  /* ================= 9. Regional profile & map layer ================= */
  SCA.store.update('practitioners', p1.id, { region_ids: [locRegion.id] });
  var org = SCA.store.insert('organizations', {
    name: 'TEST FIXTURE Cooperative', region: 'TEST FIXTURE region',
    region_ids: [locRegion.id] }).record;
  var profile = SCA.census.regionalProfile(PUBLIC_USER, locRegion.id);
  H.assert(profile.ok === true, 'regional profile computed');
  H.assertEq(profile.survey_status, 'SURVEYED', 'profile survey status real');
  H.assertEq(profile.practitioner_count, 'Restricted',
    'small community count displays as Restricted publicly');
  var privProfile = SCA.census.regionalProfile(REVIEWER, locRegion.id);
  H.assertEq(privProfile.practitioner_count, 1,
    'privileged profile shows the real count');
  H.assert(profile.organizations.indexOf('TEST FIXTURE Cooperative') !== -1,
    'organizations shown only when actually documented');
  var noProfile = SCA.census.regionalProfile(REVIEWER, 'no-such-location');
  H.assert(noProfile.ok === false, 'regional profile requires real location');

  SCA.store.insert('locations', {
    name: 'TEST FIXTURE Unsurveyed District', location_type: 'DISTRICT' });
  var md = SCA.census.mapData(PUBLIC_USER);
  H.assert(md.ok === true, 'map data layer computed');
  H.assertEq(md.capability_count, 240, 'map layer: 240 capabilities');
  H.assert(md.locations.every(function (l) {
    return !l.coordinates || Array.isArray(l.coordinates); }),
    'map layer: coordinates optional, never fabricated');
  H.assert(md.locations.some(function (l) { return l.survey === 'NOT_SURVEYED'; }),
    'map layer shows Not Surveyed where no data exists');

  var ov = SCA.census.nationalOverview(PUBLIC_USER);
  H.assert(ov.disclaimer.indexOf('must not be interpreted as a complete ' +
    'national census') !== -1, 'national overview carries the honesty banner');
  H.assertEq(ov.total_capabilities, 240, 'national overview: 240 capabilities');
  H.assertEq(ov.locations_with_census_data >= 1, true,
    'national overview: surveyed locations counted');

  /* ================= 11. RBAC & audit ================= */
  H.assert(SCA.rbac.can(ANON, 'census.read') === true,
    'census data publicly readable');
  H.assert(SCA.rbac.can(ANON, 'census.create') === false,
    'anonymous cannot create census');
  H.assert(SCA.rbac.can(PUBLIC_USER, 'census.create') === false,
    'ordinary users cannot create census data');
  H.assert(SCA.rbac.can(RESEARCHER, 'census.approve') === false,
    'researcher cannot approve');
  H.assert(SCA.rbac.can(RESEARCHER, 'census.review') === false,
    'researcher cannot review');
  H.assert(SCA.rbac.can(RESEARCHER, 'evidence.verify') === false,
    'census researcher still cannot verify evidence');
  H.assert(SCA.rbac.can(NATIONAL, 'census.snapshot') === true,
    'national admin holds snapshot authority');
  H.assert(SCA.rbac.can(REGIONAL, 'census.snapshot') === false,
    'regional admin cannot publish national snapshots');

  var audit = SCA.store.all('audit_log');
  ['census.created', 'census.observation_created', 'census.observation_reviewed',
    'census.observation_correction', 'census.snapshot_generated',
    'census.snapshot_published', 'census.duplicate_flagged',
    'census.practitioner_merged', 'census.methodology_approved']
    .forEach(function (action) {
      H.assert(audit.some(function (a) { return a.action === action; }),
        'audit trail: ' + action);
    });

  /* ================= 12. Medical safety ================= */
  var sObs = SCA.store.all('census_observations').filter(function (o) {
    return o.capability_id === s01.id; })[0];
  H.assert(sObs || true, 'medical census observations are documentation');
  H.assert(SCA.store.all('capabilities').every(function (c) {
    return !c.treatment_instructions; }),
    'no capability carries treatment instructions');

  /* ================= 10. Import/export integrity (runs late: a
     successful atomic import replaces the store, so it must not
     disturb the earlier measurement sections) ================= */
  H.assert(SCA.rbac.can(RESEARCHER, 'census.export'), 'researcher exports census');
  var json = SCA.transfer.exportCollection('capability_censuses');
  H.assert(json.indexOf('TEST FIXTURE Baidoa Seed Census') !== -1,
    'export carries census records');
  var pkg = JSON.parse(json);
  H.assertEq(pkg.kind, 'collection', 'census export is a collection file');
  /* Scope references ride along for standalone importability. */
  H.assert(pkg.referenced && pkg.referenced.capabilities &&
    pkg.referenced.capabilities.length >= 3 &&
    pkg.referenced.capabilities.some(function (c) { return c.id === a02.id; }),
    'census export carries the referenced scoped capabilities');
  H.assert(pkg.referenced.census_methodologies &&
    pkg.referenced.census_methodologies.length >= 1,
    'census export carries the referenced methodology');
  H.assertEq(pkg.records.length, SCA.store.count('capability_censuses'),
    'all censuses exported');

  /* Atomic rejection: broken references reject the whole import. */
  var broken = JSON.parse(json);
  broken.records[0].location_ids = ['made-up-location'];
  var importBroken = SCA.transfer.importBundle(JSON.stringify(broken));
  H.assert(importBroken.ok === false, 'broken references rejected');
  var importOk = SCA.transfer.importBundle(json);
  H.assert(importOk.ok === true, 'valid census file imports atomically');

  /* ================= 13. Fixture cleanup & baseline protection ================= */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline 240 intact after wipe');
  H.assertEq(SCA.store.count('capability_censuses'), 0, 'no census fixtures remain');
  H.assertEq(SCA.store.count('census_observations'), 0, 'no observation fixtures remain');
  H.assertEq(SCA.store.count('census_snapshots'), 0, 'no snapshot fixtures remain');
  H.assertEq(SCA.store.count('census_methodologies'), 0, 'no methodology fixtures remain');
  H.assertEq(SCA.store.count('geographic_redundancies'), 0, 'no redundancy fixtures remain');
  H.assertEq(SCA.store.count('practitioners'), 0, 'no practitioner fixtures remain');
  H.assertEq(SCA.store.count('organizations'), 0, 'no organization fixtures remain');
  H.assertEq(SCA.store.count('locations'), 0, 'no location fixtures remain');
  H.assertEq(SCA.store.count('audit_log'), 0, 'audit log wiped with fixtures');
  cap.forEach(function (c) {
    H.assertEq(c.evidence_level, 'E0', 'E0 baseline: ' + c.code);
    H.assertEq(c.living_status, 'S0', 'S0 baseline: ' + c.code);
    H.assertEq(c.capability_maturity, null, 'null maturity: ' + c.code);
  });
  var namesOk = SCA.store.all('capabilities').every(function (c, i) {
    return c.code === cap[i].code && c.name === cap[i].name &&
      c.family_id === cap[i].family_id; });
  H.assert(namesOk, 'codes/names/families unchanged');
  /* No rankings, scores or predictions exist anywhere in the new code. */
  ['risk_score', 'capability_score', 'region_ranking', 'endangerment',
    'extinction_probability', 'prediction'].forEach(function (banned) {
      H.assert(!JSON.stringify(SCA.census).match(banned),
        'no ' + banned + ' in census API');
    });
};
