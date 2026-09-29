/*
 * Stage 11: Regional Capability Pilots test suite.
 *
 * All test data is explicitly marked TEST FIXTURE. No real Somali
 * pilot, organization, intervention, census or practitioner claims
 * are fabricated; the 240-capability inventory is never modified;
 * every fixture is wiped at teardown and the pristine Stage 1–10
 * baseline is confirmed.
 *
 * The suite exercises the frozen Stage 11 scope v1.1 and
 * implementation authorization v1.0:
 *  - exactly one new entity (PilotProject); no Region, no
 *    PilotOutcome/PilotParticipant/PilotMetric/PilotScore/Measurement
 *    (Stage 12 territory) or any other shadow entity;
 *  - lifecycle PROPOSED -> APPROVED -> ACTIVE -> CONCLUDED with
 *    CANCELLED reachable from PROPOSED/APPROVED/ACTIVE; terminals
 *    immutable; no resurrection; no RETIRED state;
 *  - approval gate: creator/approver separation at every level
 *    including NATIONAL; project_manager never approves;
 *    APPROVED pilots may be empty (plan-first);
 *  - activation gate: >=1 valid RESOLVING constituent activity
 *    (intervention/organization/workshop/training program);
 *    standalone pilots legitimate; practitioners/locations alone
 *    never activate a pilot;
 *  - amendments: PROPOSED editable, APPROVED/ACTIVE audited-amendment
 *    only, terminals immutable;
 *  - many-to-many intervention membership, no authority transfer;
 *  - canonical Location references; immutable census snapshot
 *    reference; no invented coordinates;
 *  - overview: categorical Stage 10 outcome counts with count bases;
 *    no rate/score/ranking; no mutation; no-intervention case shows
 *    "Not applicable", never UNKNOWN;
 *  - privacy: anonymous sees APPROVED/ACTIVE/CONCLUDED only;
 *    practitioner identities masked;
 *  - RBAC: flat permission family, no geographic engine;
 *  - transfer: hard references for active records, terminal-history
 *    exemption, atomic import, no privilege escalation, forbidden
 *    outcome fields rejected, round-trip integrity;
 *  - NOT a graph node: no graph writes ever; 240 capabilities and
 *    12 families byte-identical.
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
  H.load('src/data-layer/adapter.js');
  H.load('src/data-layer/transfer.js');
  H.load('src/audit/audit.js');
  console.log('  pilot-system.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var PM = { name: 'TEST FIXTURE Project Manager',
    role: 'project_manager' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var PRACTITIONER = { name: 'TEST FIXTURE Practitioner',
    role: 'practitioner' };
  var ANON = null;

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  var baseCaps = SCA.store.all('capabilities');
  var baseCapsJson = JSON.stringify(baseCaps);
  H.assertEq(baseCaps.length, 240,
    'baseline: 240 capabilities intact');
  H.assertEq(SCA.store.all('families').length, 12,
    'baseline: 12 families intact');
  var edgesBefore = SCA.store.count('graph_edges');
  var graphTypesBefore = JSON.stringify(
    Object.keys(SCA.graphRegistry.RELATIONSHIPS));

  /* ---------- fixtures ---------- */
  var capA = baseCaps[0];

  var org = SCA.store.insert('organizations', {
    name: 'TEST FIXTURE Pilot Org' });
  var orgId = org.ok ? org.record.id : org.id;
  var loc = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Pilot Region' });
  var locId = loc.ok ? loc.record.id : loc.id;
  var pract = SCA.store.insert('practitioners', {
    public_name: 'TEST FIXTURE Pilot Practitioner' });
  var practId = pract.ok ? pract.record.id : pract.id;
  var prog = SCA.store.insert('training_programs', {
    title: 'TEST FIXTURE Pilot Program',
    name: 'TEST FIXTURE Program' });
  var progId = prog.ok ? prog.record.id : prog.id;
  var ws = SCA.repair.createWorkshop(RESEARCHER,
    { name: 'TEST FIXTURE Pilot Workshop' }).record;

  /* Two canonical Stage 10 interventions (researcher-created,
   * regionally-approved so they are visible states). */
  function makeIntervention(name) {
    var r = SCA.intervention.createIntervention(RESEARCHER, {
      name: name,
      intervention_type: 'KNOWLEDGE_DOCUMENTATION',
      objective: 'TEST FIXTURE objective',
      capability_ids: [capA.id],
      required_skills: ['TEST FIXTURE pilot coordination skills']
    }).record;
    SCA.intervention.submitIntervention(RESEARCHER, r.id);
    SCA.intervention.reviewIntervention(REVIEWER, r.id);
    SCA.intervention.approveIntervention(REGIONAL, r.id,
      'TEST FIXTURE approval');
    return SCA.store.get('capability_interventions', r.id);
  }
  var ivA = makeIntervention('TEST FIXTURE Pilot Intervention A');
  var ivB = makeIntervention('TEST FIXTURE Pilot Intervention B');

  /* A census snapshot (immutable Stage 6 record) for the baseline
   * reference. */
  var meth = SCA.census.createMethodology(RESEARCHER, {
    title: 'TEST FIXTURE Pilot Methodology',
    population_definition: 'T', data_collection_method: 'T' }).record;
  SCA.census.approveMethodology(NATIONAL, meth.id, 'TEST FIXTURE');
  var cen = SCA.census.createCensus(RESEARCHER, {
    title: 'TEST FIXTURE Pilot Census',
    scope_level: 'REGION', methodology_id: meth.id }).record;
  var snap = SCA.census.generateSnapshot(NATIONAL, cen.id,
    'TEST FIXTURE Pilot Snapshot').record;

  /* ================================================================
   * 1. Frozen model shape: one entity, exact vocabularies.
   * ================================================================ */
  console.log('    1. frozen model shape');
  H.assert(SCA.models.pilot_project,
    'exactly one Stage 11 model: pilot_project registered');
  ['region', 'pilot_outcome', 'pilot_participant', 'pilot_metric',
    'pilot_score', 'pilot_priority', 'pilot_measurement',
    'pilot_governance', 'pilot_evaluation', 'pilot_dependency',
    'pilot_graph', 'pilot_organization', 'measurement', 'indicator']
    .forEach(function (ghost) {
      H.assert(!SCA.models[ghost],
        'no ghost model: ' + ghost + ' (never created)');
    });
  H.assert(SCA.store.COLLECTIONS.indexOf('pilot_projects') !== -1,
    'pilot_projects is a registered collection');
  H.assert(SCA.transfer.EXPORTABLE.indexOf('pilot_projects') !== -1,
    'pilot_projects is exportable (first-class data)');
  H.assertEq(SCA.enums.pilot_statuses.length, 5,
    'exactly five pilot lifecycle states');
  H.assertEq(SCA.pilots.STATUSES.join(','),
    'PROPOSED,APPROVED,ACTIVE,CONCLUDED,CANCELLED',
    'exact frozen status vocabulary (no RETIRED)');
  H.assertEq(JSON.stringify(SCA.pilots.TRANSITIONS),
    JSON.stringify({
      PROPOSED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['CONCLUDED', 'CANCELLED'],
      CONCLUDED: [],
      CANCELLED: []
    }),
    'exact frozen transition table (cancellation from ' +
    'PROPOSED/APPROVED/ACTIVE; terminals dead)');
  H.assert(!SCA.pilots.export,
    'no pilot export permission path (global machinery only)');

  /* ================================================================
   * 2. Creation, validation, canonical references.
   * ================================================================ */
  console.log('    2. creation and validation');
  var denyCreate = SCA.pilots.createPilot(ANON,
    { name: 'TEST FIXTURE anon pilot' });
  H.assert(!denyCreate.ok,
    'anonymous users cannot create pilots');
  var denyCreate2 = SCA.pilots.createPilot(PRACTITIONER,
    { name: 'TEST FIXTURE practitioner pilot' });
  H.assert(!denyCreate2.ok,
    'practitioners cannot create pilots (least privilege)');

  var noName = SCA.pilots.createPilot(PM, { objective: 'x' });
  H.assert(!noName.ok && noName.errors.name,
    'a pilot requires a name');

  var badRefs = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Bad Refs',
    objective: 'TEST FIXTURE objective',
    location_ids: [locId, 'missing-location'],
    intervention_ids: ['missing-intervention'] });
  H.assert(!badRefs.ok && badRefs.errors.location_ids &&
    badRefs.errors.intervention_ids,
    'missing canonical references are rejected at creation ' +
    '(never silently created)');

  var badSnap = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Bad Snapshot',
    objective: 'TEST FIXTURE objective',
    census_snapshot_id: 'missing-snapshot' });
  H.assert(!badSnap.ok && badSnap.errors.census_snapshot_id,
    'unknown census snapshot references are rejected');

  var pilot = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Regional Pilot',
    objective: 'TEST FIXTURE pilot objective',
    location_ids: [locId],
    intervention_ids: [ivA.id, ivB.id],
    organization_ids: [orgId],
    practitioner_ids: [practId],
    census_snapshot_id: snap.id }).record;
  H.assert(!!pilot.id, 'project_manager creates a PROPOSED pilot');
  H.assertEq(pilot.status, 'PROPOSED', 'new pilots start PROPOSED');
  H.assertEq(pilot.created_by, 'TEST FIXTURE Project Manager',
    'creation is attributed');
  H.assert(pilot.approved_at === null && pilot.reviewer === null,
    'no approval trail exists yet');
  H.assert(!('latitude' in pilot) && !('longitude' in pilot),
    'a pilot carries no coordinates of its own (canonical ' +
    'Location references only)');
  H.assert(!('outcome_status' in pilot) && !('score' in pilot),
    'a pilot carries no outcome or score field');

  /* ================================================================
   * 3. Approval gate: creator/approver separation.
   * ================================================================ */
  console.log('    3. approval gate');
  var pmApprove = SCA.pilots.approvePilot(PM, pilot.id, 'self');
  H.assert(!pmApprove.ok && pmApprove.errors.permission,
    'project_manager CANNOT approve (permission separation)');

  /* The creator guard: NATIONAL creates its own pilot and must not
   * be able to approve it either (the guard applies at every role
   * level, even though NATIONAL holds the permission). */
  var natPilot = SCA.pilots.createPilot(NATIONAL, {
    name: 'TEST FIXTURE National Created Pilot',
    objective: 'TEST FIXTURE objective' }).record;
  var natSelf = SCA.pilots.approvePilot(NATIONAL, natPilot.id,
    'TEST FIXTURE self');
  H.assert(!natSelf.ok && natSelf.errors.creator,
    'NATIONAL cannot approve its own pilot (separation applies at ' +
    'every role level)');

  var noReason = SCA.pilots.approvePilot(REGIONAL, pilot.id, '');
  H.assert(!noReason.ok && noReason.errors.reason,
    'approval requires an explicit documented reason');

  var reviewerApprove = SCA.pilots.approvePilot(REVIEWER, pilot.id,
    'TEST FIXTURE reviewer');
  H.assert(!reviewerApprove.ok && reviewerApprove.errors.permission,
    'reviewers read pilots but hold no approval authority');

  var approved = SCA.pilots.approvePilot(REGIONAL, pilot.id,
    'TEST FIXTURE regional approval');
  H.assert(approved.ok, 'regional_administrator approves a pilot ' +
    '(existing flat role — no geographic engine)');
  pilot = SCA.store.get('pilot_projects', pilot.id);
  H.assertEq(pilot.status, 'APPROVED', 'pilot is APPROVED');
  H.assertEq(pilot.reviewer, 'TEST FIXTURE Regional Admin',
    'approval trail recorded');
  H.assert(!!pilot.approved_at, 'approval timestamp recorded');

  /* Frozen scope v1.1 authority: national_administrator approves
   * ANOTHER user's PROPOSED pilot (declared in the permission
   * matrix — not merely inherited from the NATIONAL consistency
   * rule). */
  var natTarget = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE National Approval Pilot',
    objective: 'TEST FIXTURE objective' }).record;
  var natApprove = SCA.pilots.approvePilot(NATIONAL, natTarget.id,
    'TEST FIXTURE national approval');
  H.assert(natApprove.ok, 'national_administrator approves another ' +
    'user\'s PROPOSED pilot');
  var natSaved = SCA.store.get('pilot_projects', natTarget.id);
  H.assertEq(natSaved.status, 'APPROVED',
    'the NATIONAL-approved pilot is APPROVED');
  H.assertEq(natSaved.reviewer, 'TEST FIXTURE National Admin',
    'the NATIONAL approval trail is recorded');
  H.assert(SCA.rbac.rolesFor('pilot.approve')
    .indexOf('national_administrator') !== -1 &&
    SCA.rbac.rolesFor('pilot.conclude')
      .indexOf('national_administrator') !== -1,
    'the DECLARED permission matrix lists national_administrator ' +
    'for approve and conclude (not only the consistency repair)');

  /* Empty plan-first pilots are legitimate. */
  var empty = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Plan First Pilot',
    objective: 'TEST FIXTURE objective' }).record;
  var ok = SCA.pilots.approvePilot(REGIONAL, empty.id,
    'TEST FIXTURE plan-first approval');
  H.assert(ok.ok, 'an APPROVED pilot may have zero constituents ' +
    '(plan-first is legitimate)');

  /* ================================================================
   * 4. Activation gate: valid constituent activities.
   * ================================================================ */
  console.log('    4. activation gate');
  var actEmpty = SCA.pilots.activatePilot(PM, empty.id);
  H.assert(!actEmpty.ok && actEmpty.errors.constituents,
    'an empty APPROVED pilot cannot be activated');

  /* Practitioners and locations alone are references, not
   * activities. */
  var peopleOnly = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE People Only Pilot',
    objective: 'TEST FIXTURE objective',
    practitioner_ids: [practId],
    location_ids: [locId] }).record;
  SCA.pilots.approvePilot(REGIONAL, peopleOnly.id, 'TEST FIXTURE');
  var actPeople = SCA.pilots.activatePilot(PM, peopleOnly.id);
  H.assert(!actPeople.ok && actPeople.errors.constituents,
    'practitioner/location references alone do not activate a pilot');

  /* A dangling constituent id is not an activity. */
  var dangling = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Dangling Pilot',
    objective: 'TEST FIXTURE objective',
    intervention_ids: [ivA.id] }).record;
  SCA.pilots.approvePilot(REGIONAL, dangling.id, 'TEST FIXTURE');
  SCA.store.remove('capability_interventions', ivA.id);
  var actDangling = SCA.pilots.activatePilot(PM, dangling.id);
  H.assert(!actDangling.ok && actDangling.errors.constituents,
    'a deleted constituent blocks activation (references must ' +
    'resolve)');
  /* Restore the fixture intervention for later sections. */
  SCA.store.insert('capability_interventions', ivA);

  /* Each of the four activity types permits activation. */
  function activityCase(name, field, id, extraAssert) {
    var rec = SCA.pilots.createPilot(PM, {
      name: name, objective: 'TEST FIXTURE objective' }).record;
    SCA.pilots.approvePilot(REGIONAL, rec.id, 'TEST FIXTURE');
    var amend = SCA.pilots.amendPilot(PM, rec.id,
      (function () { var p = {}; p[field] = [id]; return p; })(),
      'TEST FIXTURE constituent amendment');
    H.assert(amend.ok, name + ': constituent amended in (audited)');
    var act = SCA.pilots.activatePilot(PM, rec.id);
    H.assert(act.ok, name + ' permits activation' +
      (extraAssert || ''));
    return rec;
  }
  activityCase('TEST FIXTURE Standalone Org Pilot',
    'organization_ids', orgId,
    ' (standalone pilots are legitimate)');
  activityCase('TEST FIXTURE Standalone Workshop Pilot',
    'workshop_ids', ws.id);
  activityCase('TEST FIXTURE Standalone Training Pilot',
    'training_program_ids', progId);
  activityCase('TEST FIXTURE Intervention Pilot',
    'intervention_ids', ivB.id);

  var activated = SCA.pilots.activatePilot(PM, pilot.id);
  H.assert(activated.ok, 'a multi-constituent pilot activates');
  pilot = SCA.store.get('pilot_projects', pilot.id);
  H.assertEq(pilot.status, 'ACTIVE', 'pilot is ACTIVE');
  H.assert(!!pilot.activated_at, 'activation timestamp recorded');

  /* ================================================================
   * 5. Conclusion: administrative, never an outcome.
   * ================================================================ */
  console.log('    5. conclusion');
  var conclNoPerm = SCA.pilots.concludePilot(PM, pilot.id, 'x');
  H.assert(!conclNoPerm.ok && conclNoPerm.errors.permission,
    'project_manager cannot conclude');
  var conclNoReason = SCA.pilots.concludePilot(REGIONAL, pilot.id, '');
  H.assert(!conclNoReason.ok && conclNoReason.errors.reason,
    'conclusion requires an explicit reason');
  var conclNoPermAnon = SCA.pilots.concludePilot(ANON, pilot.id, 'x');
  H.assert(!conclNoPermAnon.ok &&
    conclNoPermAnon.errors.permission,
    'unauthorized roles cannot conclude');
  var concluded = SCA.pilots.concludePilot(REGIONAL, pilot.id,
    'TEST FIXTURE coordination ended');
  H.assert(concluded.ok, 'regional_administrator concludes a pilot');
  pilot = SCA.store.get('pilot_projects', pilot.id);
  H.assertEq(pilot.status, 'CONCLUDED', 'pilot is CONCLUDED');
  H.assert(!!pilot.concluded_at, 'conclusion timestamp recorded');

  /* Frozen scope v1.1 authority: national_administrator concludes
   * ANOTHER user's ACTIVE pilot. */
  var natPilot2 = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE National Conclusion Pilot',
    objective: 'TEST FIXTURE objective',
    intervention_ids: [ivB.id] }).record;
  SCA.pilots.approvePilot(REGIONAL, natPilot2.id, 'TEST FIXTURE');
  SCA.pilots.activatePilot(PM, natPilot2.id);
  var natConcl = SCA.pilots.concludePilot(NATIONAL, natPilot2.id,
    'TEST FIXTURE national conclusion');
  H.assert(natConcl.ok, 'national_administrator concludes another ' +
    'user\'s ACTIVE pilot');
  H.assertEq(SCA.store.get('pilot_projects', natPilot2.id).status,
    'CONCLUDED', 'the NATIONAL-concluded pilot is CONCLUDED');
  /* Conclusion must never fabricate outcome data. */
  H.assert(!('outcome_status' in pilot) && !('score' in pilot),
    'conclusion never implies success: no outcome field exists');

  /* ================================================================
   * 6. Cancellation: explicit, reason-required, terminal.
   * ================================================================ */
  console.log('    6. cancellation');
  ['PROPOSED', 'APPROVED', 'ACTIVE'].forEach(function (fromState) {
    var rec = SCA.pilots.createPilot(PM, {
      name: 'TEST FIXTURE Cancel From ' + fromState,
      objective: 'TEST FIXTURE objective',
      organization_ids: [orgId] }).record;
    if (fromState !== 'PROPOSED') {
      SCA.pilots.approvePilot(REGIONAL, rec.id, 'TEST FIXTURE');
    }
    if (fromState === 'ACTIVE') {
      SCA.pilots.activatePilot(PM, rec.id);
    }
    var noReason = SCA.pilots.cancelPilot(PM, rec.id, '');
    H.assert(!noReason.ok && noReason.errors.reason,
      'cancellation from ' + fromState + ' requires a reason');
    var cancelled = SCA.pilots.cancelPilot(PM, rec.id,
      'TEST FIXTURE cancellation from ' + fromState);
    H.assert(cancelled.ok, 'cancellation from ' + fromState +
      ' is permitted');
    var saved = SCA.store.get('pilot_projects', rec.id);
    H.assertEq(saved.status, 'CANCELLED',
      'pilot cancelled from ' + fromState + ' is CANCELLED');
    H.assert(!!saved.cancelled_at &&
      saved.last_reason.indexOf('cancellation') !== -1,
      'cancellation preserves actor/timestamp/reason (audited)');
  });

  /* ================================================================
   * 7. Invalid transitions, terminal immutability, no resurrection.
   * ================================================================ */
  console.log('    7. invalid transitions and terminals');
  /* CONCLUDED pilot: dead end. */
  var concludedResurrect = SCA.pilots.approvePilot(REGIONAL, pilot.id,
    'TEST FIXTURE resurrect');
  H.assert(!concludedResurrect.ok && concludedResurrect.errors.status,
    'CONCLUDED -> APPROVED does not exist');
  var concludedAmend = SCA.pilots.amendPilot(PM, pilot.id,
    { objective: 'rewritten' }, 'TEST FIXTURE reason');
  H.assert(!concludedAmend.ok && concludedAmend.errors.status,
    'CONCLUDED pilots are immutable (amendment refused)');
  var concludedEdit = SCA.pilots.updatePilot(PM, pilot.id,
    { objective: 'rewritten' });
  H.assert(!concludedEdit.ok && concludedEdit.errors.status,
    'CONCLUDED pilots are immutable (edit refused)');
  /* CANCELLED pilot: dead end. */
  var cancelledPilot = SCA.store.all('pilot_projects')
    .filter(function (r) { return r.status === 'CANCELLED'; })[0];
  var cancelResurrect = SCA.pilots.approvePilot(REGIONAL,
    cancelledPilot.id, 'TEST FIXTURE resurrect');
  H.assert(!cancelResurrect.ok && cancelResurrect.errors.status,
    'CANCELLED -> APPROVED does not exist (no resurrection)');
  var cancelActivate = SCA.pilots.activatePilot(PM, cancelledPilot.id);
  H.assert(!cancelActivate.ok && cancelActivate.errors.status,
    'CANCELLED -> ACTIVE does not exist');
  var cancelAgain = SCA.pilots.cancelPilot(PM, cancelledPilot.id,
    'TEST FIXTURE double cancel');
  H.assert(!cancelAgain.ok && cancelAgain.errors.status,
    'CANCELLED -> CANCELLED does not exist');
  /* Skipped states: no direct PROPOSED -> ACTIVE/CONCLUDED. */
  var fresh = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Fresh Pilot',
    objective: 'TEST FIXTURE objective' }).record;
  var skipActive = SCA.pilots.activatePilot(PM, fresh.id);
  H.assert(!skipActive.ok && skipActive.errors.status,
    'PROPOSED -> ACTIVE does not exist (approval first)');
  var skipConclude = SCA.pilots.concludePilot(REGIONAL, fresh.id, 'x');
  H.assert(!skipConclude.ok && skipConclude.errors.status,
    'PROPOSED -> CONCLUDED does not exist');

  /* ================================================================
   * 8. Amendments: audited state-dependent mutability.
   * ================================================================ */
  console.log('    8. amendments');
  var prop = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Editable Pilot',
    objective: 'v1',
    organization_ids: [orgId] }).record;
  var edited = SCA.pilots.updatePilot(PM, prop.id,
    { objective: 'v2' });
  H.assert(edited.ok, 'PROPOSED pilots are fully editable');
  H.assertEq(SCA.store.get('pilot_projects', prop.id).objective, 'v2',
    'PROPOSED edit applied');
  SCA.pilots.approvePilot(REGIONAL, prop.id, 'TEST FIXTURE');
  var silent = SCA.pilots.updatePilot(PM, prop.id,
    { objective: 'v3' });
  H.assert(!silent.ok && silent.errors.status,
    'APPROVED pilots refuse silent edits (amendment required)');
  var noReasonAmend = SCA.pilots.amendPilot(PM, prop.id,
    { objective: 'v3' }, '');
  H.assert(!noReasonAmend.ok && noReasonAmend.errors.reason,
    'amendments require an explicit reason');
  var amended = SCA.pilots.amendPilot(PM, prop.id,
    { objective: 'v3' }, 'TEST FIXTURE audited amendment');
  H.assert(amended.ok, 'APPROVED pilots accept audited amendments');
  var savedProp = SCA.store.get('pilot_projects', prop.id);
  H.assertEq(savedProp.objective, 'v3', 'amendment applied');
  H.assertEq(savedProp.last_reason, 'TEST FIXTURE audited amendment',
    'amendment reason recorded');
  H.assert((savedProp.history || []).some(function (h) {
    return h.change_type === 'AMENDMENT';
  }), 'amendment is history-recorded (no silent mutation)');
  SCA.pilots.activatePilot(PM, prop.id);
  var activeAmend = SCA.pilots.amendPilot(PM, prop.id,
    { workshop_ids: [ws.id] }, 'TEST FIXTURE active amendment');
  H.assert(activeAmend.ok, 'ACTIVE pilots accept audited amendments');

  /* ================================================================
   * 9. Relationships: many-to-many, no authority transfer.
   * ================================================================ */
  console.log('    9. relationships');
  var pilotX = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Pilot X',
    objective: 'TEST FIXTURE objective',
    intervention_ids: [ivB.id] }).record;
  var pilotY = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Pilot Y',
    objective: 'TEST FIXTURE objective',
    intervention_ids: [ivB.id] }).record;
  H.assert(!!pilotX.id && !!pilotY.id,
    'one intervention may belong to multiple pilots (many-to-many)');
  var ivBefore = JSON.stringify(
    SCA.store.get('capability_interventions', ivB.id));
  /* Amend X to drop the intervention; the intervention record must
   * not change at all. */
  SCA.pilots.approvePilot(REGIONAL, pilotX.id, 'TEST FIXTURE');
  SCA.pilots.amendPilot(PM, pilotX.id, { intervention_ids: [] },
    'TEST FIXTURE detach');
  H.assertEq(JSON.stringify(
    SCA.store.get('capability_interventions', ivB.id)), ivBefore,
    'removing an intervention from a pilot never modifies the ' +
    'intervention (no authority transfer)');
  H.assertEq(SCA.store.get('capability_interventions', ivB.id).status,
    'APPROVED', 'Stage 10 keeps full lifecycle authority');

  /* ================================================================
   * 10. Read-only overview: counts, bases, Not-applicable.
   * ================================================================ */
  console.log('    10. read-only overview');
  /* Give ivB a reviewer-assessed outcome for the count test. */
  SCA.intervention.activateIntervention(RESEARCHER, ivB.id);
  SCA.intervention.completeIntervention(RESEARCHER, ivB.id);
  var outcome = SCA.intervention.setOutcomeStatus(REVIEWER, ivB.id,
    'SUCCESSFUL', 'TEST FIXTURE outcome', { });
  H.assert(outcome.ok || (outcome.errors &&
    outcome.errors.outcome_evidence),
    'outcome attempt recorded (evidence gate honored)');
  /* Attach outcome evidence so the assessment succeeds. */
  var ev = SCA.store.insert('evidence', {
    title: 'TEST FIXTURE Outcome Evidence',
    name: 'TEST FIXTURE Evidence' });
  var evId = ev.ok ? ev.record.id : ev.id;
  var ivSaved = SCA.store.get('capability_interventions', ivB.id);
  ivSaved.outcome_evidence_source_ids = [evId];
  SCA.store.update('capability_interventions', ivB.id, ivSaved);
  SCA.intervention.setOutcomeStatus(REVIEWER, ivB.id, 'SUCCESSFUL',
    'TEST FIXTURE outcome');

  var ovPilot = SCA.store.get('pilot_projects', pilotY.id);
  var ovBefore = JSON.stringify(ovPilot);
  var ov = SCA.pilots.overview(ovPilot);
  H.assert(ov.ok, 'overview resolves');
  H.assert(!ov.not_applicable, 'pilot with interventions is ' +
    'applicable');
  H.assertEq(ov.intervention_outcomes.SUCCESSFUL, 1,
    'SUCCESSFUL count is categorical and count-based');
  H.assert(ov.intervention_outcomes.UNKNOWN !== undefined,
    'all five outcome codes carry explicit counts (bases)');
  H.assert(!ov.intervention_outcomes.rate &&
    !ov.score && !ov.percentage,
    'no rate/score/percentage ever exists in the overview');
  H.assert(JSON.stringify(SCA.store.get('pilot_projects', pilotY.id))
    === ovBefore, 'overview never mutates any record');

  /* Standalone pilot: Not applicable, never UNKNOWN. */
  var standalone = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Standalone Pilot',
    objective: 'TEST FIXTURE objective',
    organization_ids: [orgId] }).record;
  var ovAlone = SCA.pilots.overview(standalone);
  H.assert(ovAlone.ok && ovAlone.not_applicable,
    'a no-intervention pilot is Not applicable');
  H.assertEq(ovAlone.intervention_outcome_summary,
    SCA.pilots.NOT_APPLICABLE,
    'the summary is the pinned Not-applicable text');
  H.assert(ovAlone.intervention_outcomes === null,
    'no UNKNOWN is displayed (there is no intervention ' +
    'population to evaluate — outcome semantics stay in Stage 10)');
  H.assertEq(ovAlone.constituent_counts.organizations, 1,
    'constituent counts are still reported (references are real)');

  /* ================================================================
   * 11. Privacy and visibility.
   * ================================================================ */
  console.log('    11. privacy and visibility');
  var hidden = SCA.pilots.getPilot(ANON, fresh.id);
  H.assert(!hidden.ok && hidden.errors.permission,
    'anonymous users cannot see PROPOSED pilots');
  var hiddenCancel = SCA.pilots.getPilot(ANON, cancelledPilot.id);
  H.assert(!hiddenCancel.ok,
    'anonymous users cannot see CANCELLED pilots');
  var anonVisible = SCA.pilots.getPilot(ANON,
    SCA.store.get('pilot_projects', prop.id).id);
  H.assert(anonVisible.ok,
    'anonymous users see ACTIVE pilots (public states)');
  var anonList = SCA.pilots.searchPilots(ANON, {});
  H.assert(anonList.ok && anonList.results.every(function (r) {
    return ['APPROVED', 'ACTIVE', 'CONCLUDED']
      .indexOf(r.status) !== -1;
  }), 'anonymous search returns public states only');
  /* Practitioner masking: the record references practitioners but
   * the overview exposes counts only. */
  var ovMasked = SCA.pilots.overview(
    SCA.store.get('pilot_projects', pilotY.id));
  H.assertEq(ovMasked.constituent_counts.practitioners, 0,
    'practitioner counts come from references only');
  var practRefPilot = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Practitioner Ref Pilot',
    objective: 'TEST FIXTURE objective',
    practitioner_ids: [practId] }).record;
  var ovPract = SCA.pilots.overview(practRefPilot);
  H.assertEq(ovPract.constituent_counts.practitioners, 1,
    'a referenced practitioner appears as a COUNT');
  H.assert(JSON.stringify(ovPract).indexOf(practId) === -1,
    'the overview never leaks practitioner identity ids');

  /* ================================================================
   * 12. RBAC matrix: flat family, no geographic engine.
   * ================================================================ */
  console.log('    12. RBAC');
  H.assert(SCA.rbac.can(ANON, 'pilot.read'),
    'anon holds pilot.read');
  H.assert(SCA.rbac.can(REVIEWER, 'pilot.read'),
    'reviewers hold pilot.read');
  H.assert(!SCA.rbac.can(REVIEWER, 'pilot.approve') &&
    !SCA.rbac.can(REVIEWER, 'pilot.conclude'),
    'reviewers hold NO pilot lifecycle authority');
  H.assert(!SCA.rbac.can(PM, 'pilot.approve'),
    'project_manager never approves');
  H.assert(SCA.rbac.can(PM, 'pilot.create') &&
    SCA.rbac.can(PM, 'pilot.update'),
    'project_manager creates and updates');
  H.assert(SCA.rbac.can(REGIONAL, 'pilot.approve') &&
    SCA.rbac.can(REGIONAL, 'pilot.conclude'),
    'regional_administrator approves and concludes (existing flat ' +
    'role — NOT a geographic engine)');
  H.assert(SCA.rbac.can(NATIONAL, 'pilot.approve') &&
    SCA.rbac.can(NATIONAL, 'pilot.conclude'),
    'national_administrator approves and concludes (frozen scope ' +
    'v1.1: both administrative authorities, explicitly declared)');
  H.assert(Object.keys(SCA.rbac.matrix).every(function (p) {
    return p.indexOf('pilot.') !== 0 ||
      ['pilot.read', 'pilot.create', 'pilot.update', 'pilot.approve',
        'pilot.conclude'].indexOf(p) !== -1;
  }), 'exactly the five pinned pilot permissions exist (no ' +
  'pilot.export, no geographic variants)');

  /* ================================================================
   * 13. Transfer: export/import, atomicity, escalation guards.
   * ================================================================ */
  console.log('    13. transfer');
  var exported = JSON.parse(
    SCA.transfer.exportCollection('pilot_projects'));
  H.assertEq(exported.kind, 'collection', 'pilot export is JSON');
  H.assert(exported.records.length > 0,
    'pilot export carries the records');
  var carried = {};
  Object.keys(exported.referenced || {}).forEach(function (c) {
    carried[c] = exported.referenced[c].length;
  });
  H.assert((carried.capability_interventions || 0) > 0,
    'a standalone pilot export carries the constituent ' +
    'interventions (self-contained, no escalation)');
  H.assert((carried.locations || 0) > 0,
    'a standalone pilot export carries the canonical locations');

  /* Full round-trip: export EVERYTHING, wipe, import — the pilots
   * and every canonical reference survive (atomic). */
  var pre = SCA.store.count('pilot_projects');
  var fullText = SCA.transfer.exportAll();
  SCA.store.wipe();
  SCA.store.init();
  var imported = SCA.transfer.importBundle(fullText);
  H.assert(imported.ok, 'full round-trip import succeeds (atomic: ' +
    ((imported.errors || []).join('; ') || 'ok') + ')');
  H.assertEq(SCA.store.count('pilot_projects'), pre,
    'round-trip preserves every pilot');
  H.assertEq(SCA.store.count('capabilities'), 240,
    'round-trip keeps the 240 inventory intact');

  /* Atomic rejection: an ACTIVE pilot with a broken reference. */
  var broken = { kind: 'bundle', schema_version: 1, collections: {
    pilot_projects: [{
      id: 'test-broken-pilot', name: 'TEST FIXTURE Broken',
      objective: 'TEST FIXTURE objective', status: 'ACTIVE',
      created_by: 'TEST FIXTURE Project Manager',
      approved_at: '2026-01-01', reviewer: 'TEST FIXTURE Regional',
      activated_at: '2026-01-02',
      intervention_ids: ['missing-intervention'] }] } };
  var resBroken = SCA.transfer.importBundle(JSON.stringify(broken));
  H.assert(!resBroken.ok,
    'broken references reject the import atomically');
  H.assertEq(SCA.store.count('pilot_projects'), pre,
    'a rejected import changes nothing (atomic)');

  /* No privilege escalation: imported APPROVED pilot whose creator
   * "reviewed" it. */
  var selfApproved = { kind: 'bundle', schema_version: 1,
    collections: { pilot_projects: [{
      id: 'test-self-approved', name: 'TEST FIXTURE Self',
      objective: 'TEST FIXTURE objective', status: 'APPROVED',
      created_by: 'TEST FIXTURE Sneaky', reviewer:
      'TEST FIXTURE Sneaky', approved_at: '2026-01-01' }] } };
  var resSelf = SCA.transfer.importBundle(
    JSON.stringify(selfApproved));
  H.assert(!resSelf.ok,
    'imported creator==reviewer pilots are rejected (no privilege ' +
    'escalation through import)');

  /* Imported ACTIVE pilot with no resolvable constituents. */
  var emptyActive = { kind: 'bundle', schema_version: 1,
    collections: { pilot_projects: [{
      id: 'test-empty-active', name: 'TEST FIXTURE Empty Active',
      objective: 'TEST FIXTURE objective', status: 'ACTIVE',
      created_by: 'TEST FIXTURE Project Manager',
      reviewer: 'TEST FIXTURE Regional', approved_at: '2026-01-01',
      activated_at: '2026-01-02' }] } };
  var resEmptyActive = SCA.transfer.importBundle(
    JSON.stringify(emptyActive));
  H.assert(!resEmptyActive.ok,
    'import cannot manufacture an ACTIVE pilot the activation gate ' +
    'would refuse');

  /* Forbidden outcome fields are rejected — even in terminal
   * history. */
  var scored = { kind: 'bundle', schema_version: 1,
    collections: { pilot_projects: [{
      id: 'test-scored', name: 'TEST FIXTURE Scored',
      objective: 'TEST FIXTURE objective', status: 'CONCLUDED',
      created_by: 'TEST FIXTURE Project Manager',
      reviewer: 'TEST FIXTURE Regional', approved_at: '2026-01-01',
      activated_at: '2026-01-02', concluded_at: '2026-01-03',
      score: '0.8' }] } };
  var resScored = SCA.transfer.importBundle(JSON.stringify(scored));
  H.assert(!resScored.ok,
    'an imported pilot carrying a score is rejected (a pilot ' +
    'coordinates; it never re-governs)');

  /* A valid NATIONAL approval survives transfer: an imported
   * APPROVED pilot whose reviewer is a DIFFERENT national
   * administrator (creator/reviewer separation intact) is
   * accepted. */
  var natBundle = { kind: 'bundle', schema_version: 1,
    collections: { pilot_projects: [{
      id: 'test-nat-approved', name: 'TEST FIXTURE Nat Approved',
      objective: 'TEST FIXTURE objective', status: 'APPROVED',
      created_by: 'TEST FIXTURE Project Manager',
      reviewer: 'TEST FIXTURE National Admin',
      approved_at: '2026-01-01' }] } };
  var resNat = SCA.transfer.importBundle(JSON.stringify(natBundle));
  H.assert(resNat.ok, 'a valid NATIONAL approval imports (authority ' +
    'boundary survives transfer)');

  /* Terminal-history exemption: a CONCLUDED pilot may keep a
   * reference that no longer resolves. */
  var historic = { kind: 'bundle', schema_version: 1,
    collections: { pilot_projects: [{
      id: 'test-historic', name: 'TEST FIXTURE Historic',
      objective: 'TEST FIXTURE objective', status: 'CONCLUDED',
      created_by: 'TEST FIXTURE Project Manager',
      reviewer: 'TEST FIXTURE Regional', approved_at: '2026-01-01',
      activated_at: '2026-01-02', concluded_at: '2026-01-03',
      intervention_ids: ['long-gone-intervention'] }] } };
  var resHistoric = SCA.transfer.importBundle(JSON.stringify(historic));
  H.assert(resHistoric.ok,
    'terminal history keeps broken references by design (frozen ' +
    'exemption, preserved — never silently deleted)');

  /* ================================================================
   * 14. Graph boundary and inventory preservation.
   * ================================================================ */
  console.log('    14. graph and inventory');
  H.assertEq(SCA.store.count('graph_edges'), edgesBefore,
    'pilots never write to the Stage 7 graph');
  H.assertEq(JSON.stringify(
    Object.keys(SCA.graphRegistry.RELATIONSHIPS)), graphTypesBefore,
    'the 19-type graph registry is untouched');
  H.assertEq(JSON.stringify(SCA.store.all('capabilities')),
    baseCapsJson, '240 capabilities byte-identical');

  /* ================================================================
   * 15. Integrity checker.
   * ================================================================ */
  console.log('    15. integrity');
  var integ = SCA.pilots.integrity(RESEARCHER);
  H.assert(integ.ok, 'integrity passes on honest fixture data (' +
    (integ.errors || []).join('; ') + ')');
  /* An ACTIVE pilot with all constituents deleted is flagged. */
  var flagPilot = SCA.pilots.createPilot(PM, {
    name: 'TEST FIXTURE Flagged Pilot',
    objective: 'TEST FIXTURE objective',
    workshop_ids: [ws.id] }).record;
  SCA.pilots.approvePilot(REGIONAL, flagPilot.id, 'TEST FIXTURE');
  SCA.pilots.activatePilot(PM, flagPilot.id);
  SCA.store.remove('workshops', ws.id);
  var integFlag = SCA.pilots.integrity(RESEARCHER);
  H.assert(!integFlag.ok && integFlag.errors.some(function (e) {
    return e.indexOf('ACTIVE pilot has no resolvable constituent') !== -1;
  }), 'an honest flag is raised, never a silent auto-conclusion');

  /* ---------- teardown ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.all('capabilities').length, 240,
    'teardown: 240 capabilities restored');
  H.assertEq(SCA.store.count('pilot_projects'), 0,
    'teardown: zero pilot fixtures remain (pristine baseline)');
  H.assertEq(SCA.store.count('capability_interventions'), 0,
    'teardown: zero intervention fixtures remain');
};
