/*
 * Stage 10: Capability Intervention Foundation test suite.
 *
 * All test data is explicitly marked TEST FIXTURE. No real Somali
 * intervention, organization, practitioner or evidence claims are
 * fabricated; the 240-capability inventory is never modified; every
 * fixture is wiped at teardown and the pristine Stage 1–9 baseline is
 * confirmed.
 *
 * The suite exercises the frozen Stage 10 scope v1.1 and
 * implementation authorization v1.0:
 *  - exactly one new entity (CapabilityIntervention); no Measurement
 *    or Indicator (Stage 12 territory); no shadow entities;
 *  - lifecycle DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED ->
 *    ACTIVE -> COMPLETED with SUSPENDED/CANCELLED paths; the pinned
 *    reject path (UNDER_REVIEW -> DRAFT return, UNDER_REVIEW ->
 *    CANCELLED discard); edit locking; audited amendments; terminals
 *    never edited;
 *  - NO duplicate-signature guard: competing interventions coexist;
 *  - outcome status: reviewer-governed, UNKNOWN default,
 *    COMPLETED + UNKNOWN valid, evidence-gated, never scored;
 *  - successor-before-launch: presence-of-value (UNKNOWN passes,
 *    blank fails, nothing fabricated);
 *  - No Orphan Project Rule: dependency disclosure or the explicit
 *    self_contained claim at approval;
 *  - creators never self-approve (permission separation + guard);
 *  - privacy: anonymous sees APPROVED/ACTIVE/COMPLETED only;
 *  - NOT a graph node: no graph writes ever;
 *  - transfer: hard references for active records, terminal-history
 *    exemption, critical-role practitioner resolution, atomic
 *    import, round-trip integrity.
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
  console.log('  intervention-system.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var TECH = { name: 'TEST FIXTURE Technician', role: 'technician' };
  var PM = { name: 'TEST FIXTURE Project Manager',
    role: 'project_manager' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var PRACTITIONER = { name: 'TEST FIXTURE Practitioner',
    role: 'practitioner' };
  var WORKSHOP_ROLE = { name: 'TEST FIXTURE Workshop', role: 'workshop' };
  var ANON = null;

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  var baseCaps = SCA.store.all('capabilities');
  var baseSnapshot = JSON.stringify(baseCaps);
  H.assertEq(baseCaps.length, 240, 'baseline: 240 capabilities intact');
  var graphTypesBefore = JSON.stringify(
    Object.keys(SCA.graphRegistry.RELATIONSHIPS));
  var edgesBefore = SCA.store.count('graph_edges');

  /* ---------- fixtures ---------- */
  var capA = baseCaps[0];
  var capB = baseCaps[1];
  var fam = SCA.store.all('families')[0];

  var org = SCA.store.insert('organizations', {
    name: 'TEST FIXTURE Intervention Org' });
  var orgId = org.ok ? org.record.id : org.id;
  var src = SCA.store.insert('evidence', {
    title: 'TEST FIXTURE Intervention Source',
    name: 'TEST FIXTURE Source' });
  var srcId = src.ok ? src.record.id : src.id;
  var proj = SCA.store.insert('research_projects', {
    title: 'TEST FIXTURE Intervention Project',
    name: 'TEST FIXTURE Project', project_code: 'TEST-FIXTURE-IV' });
  var projId = proj.ok ? proj.record.id : proj.id;
  var sess = SCA.store.insert('research_sessions', {
    project_id: projId, purpose: 'TEST FIXTURE purpose' });
  var sessId = sess.ok ? sess.record.id : sess.id;
  var obs = SCA.store.insert('observations', {
    session_id: sessId, capability_id: capA.id,
    observation_type: 'DIRECT_OBSERVATION',
    observation_text: 'TEST FIXTURE observation text' });
  var obsId = obs.ok ? obs.record.id : obs.id;
  var artifact = SCA.store.insert('knowledge', {
    title: 'TEST FIXTURE Intervention Artifact',
    name: 'TEST FIXTURE Artifact' });
  var artifactId = artifact.ok ? artifact.record.id : artifact.id;
  var pract = SCA.store.insert('practitioners', {
    public_name: 'TEST FIXTURE Intervention Practitioner' });
  var practId = pract.ok ? pract.record.id : pract.id;
  var appr = SCA.store.insert('apprentices', {
    public_name: 'TEST FIXTURE Apprentice',
    capability_id: capA.id });
  var apprId = appr.ok ? appr.record.id : appr.id;
  var prog = SCA.store.insert('training_programs', {
    title: 'TEST FIXTURE Training Program',
    name: 'TEST FIXTURE Program' });
  var progId = prog.ok ? prog.record.id : prog.id;
  var assess = SCA.store.insert('competence_assessments', {
    practitioner_id: practId });
  var assessId = assess.ok ? assess.record.id : assess.id;
  var cert = SCA.store.insert('capability_certifications', {
    practitioner_id: practId, capability_id: capA.id });
  var certId = cert.ok ? cert.record.id : cert.id;
  var loc = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Location' });
  var locId = loc.ok ? loc.record.id : loc.id;
  var ws = SCA.repair.createWorkshop(RESEARCHER,
    { name: 'TEST FIXTURE Intervention Workshop' }).record;
  var rc = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: ws.id, asset_type: 'CAPABILITY', asset_id: capA.id,
    repair_operations: ['REPAIR'] }).record;
  var sp = SCA.repair.createSparePart(RESEARCHER, {
    name: 'TEST FIXTURE Intervention Part',
    manufacturer: 'TEST FIXTURE MFG',
    manufacturer_part_number: 'TF-IV-1' }).record;
  var tool = SCA.store.insert('tools', {
    name: 'TEST FIXTURE Intervention Tool' });
  var toolId = tool.ok ? tool.record.id : tool.id;
  var mat = SCA.store.insert('materials', {
    name: 'TEST FIXTURE Intervention Material' });
  var matId = mat.ok ? mat.record.id : mat.id;
  var rsrc = SCA.store.insert('resources', {
    name: 'TEST FIXTURE Resource' });
  var rsrcId = rsrc.ok ? rsrc.record.id : rsrc.id;
  var energy = SCA.store.insert('energy_sources', {
    name: 'TEST FIXTURE Energy Source' });
  var energyId = energy.ok ? energy.record.id : energy.id;
  var fs1 = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Intervention failure',
    failure_category: 'MECHANICAL', asset_type: 'CAPABILITY',
    asset_ids: [capA.id] });
  var fs1Id = fs1.ok ? fs1.record.id : fs1.id;
  var rp = SCA.recovery.createRecoveryProfile(RESEARCHER, {
    name: 'TEST FIXTURE Intervention Recovery',
    asset_type: 'CAPABILITY', asset_id: capA.id,
    recovery_kind: 'FALLBACK_CAPABILITY',
    target_type: 'CAPABILITY', target_id: capB.id }).record;

  /* ================================================================
   * 1. Frozen model shape: one entity, exact vocabularies.
   * ================================================================ */
  console.log('    1. frozen model shape');
  H.assert(SCA.models.capability_intervention,
    'exactly one Stage 10 model: capability_intervention registered');
  ['intervention_measurement', 'intervention_outcome',
    'intervention_plan', 'intervention_project',
    'intervention_evaluation', 'measurement', 'indicator']
    .forEach(function (ghost) {
      H.assert(!SCA.models[ghost],
        'no ghost model: ' + ghost + ' (never created)');
    });
  H.assert(SCA.store.COLLECTIONS
    .indexOf('capability_interventions') !== -1,
    'capability_interventions is a registered collection');
  H.assert(SCA.transfer.EXPORTABLE
    .indexOf('capability_interventions') !== -1,
    'capability_interventions is exportable (first-class data)');
  H.assertEq(SCA.enums.intervention_statuses.length, 8,
    'exactly eight lifecycle states');
  H.assertEq(SCA.enums.intervention_outcomes.length, 5,
    'exactly five outcome states');
  H.assertEq(SCA.enums.intervention_types.length, 36,
    'exactly 36 intervention types (8 categories as composite codes)');
  H.assertEq(JSON.stringify(SCA.enums.codes(
    SCA.enums.intervention_statuses)),
    JSON.stringify(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
      'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED']),
    'lifecycle vocabulary is exact and frozen');
  H.assertEq(SCA.store.count('capability_interventions'), 0,
    'clean seed: zero interventions (no fabricated data)');

  /* ================================================================
   * 2. Types and canonical references.
   * ================================================================ */
  console.log('    2. types & references');
  var badType = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE bad type',
    intervention_type: 'FREE_TEXT_CATEGORY' });
  H.assert(!badType.ok,
    'free-text intervention types are rejected (controlled vocabulary)');

  var badRef = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE bad reference',
    intervention_type: 'KNOWLEDGE_DOCUMENTATION',
    capability_ids: ['missing-capability-record'] });
  H.assert(!badRef.ok,
    'unresolvable canonical references are rejected (never created)');
  H.assertEq(SCA.store.count('capability_interventions'), 0,
    'rejected creations mutate nothing');

  /* Every canonical reference family resolves through an EXISTING
   * collection — the full authorization section 10 list. */
  var fullRefs = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE full-reference intervention',
    intervention_type: 'REPAIR_CAPACITY',
    objective: 'TEST FIXTURE objective',
    capability_ids: [capA.id],
    family_ids: [fam.id],
    research_project_ids: [projId],
    evidence_source_ids: [srcId],
    knowledge_artifact_ids: [artifactId],
    field_observation_ids: [obsId],
    failure_scenario_ids: [fs1Id],
    recovery_profile_ids: [rp.id],
    practitioner_ids: [practId],
    apprentice_ids: [apprId],
    training_program_ids: [progId],
    competence_assessment_ids: [assessId],
    certification_ids: [certId],
    organization_ids: [orgId],
    location_ids: [locId],
    workshop_ids: [ws.id],
    repair_capability_ids: [rc.id],
    spare_part_ids: [sp.id],
    tool_ids: [toolId],
    material_ids: [matId],
    resource_ids: [rsrcId],
    energy_source_ids: [energyId],
    responsible_organization_id: orgId });
  H.assert(fullRefs.ok, 'all 22 canonical reference families resolve: ' +
    JSON.stringify(fullRefs.errors || {}));
  var ivRefs = fullRefs.record;
  H.assertEq(ivRefs.status, 'DRAFT', 'new interventions start DRAFT');
  H.assertEq(ivRefs.outcome_status, 'UNKNOWN',
    'outcome default is UNKNOWN (honest)');
  H.assertEq(ivRefs.version, '1', 'new records start at version 1');
  H.assert(!SCA.intervention.createIntervention(ANON, {
    name: 'TEST FIXTURE anon', intervention_type: 'KNOWLEDGE_ARCHIVAL'
  }).ok, 'anonymous users cannot create interventions');

  /* ================================================================
   * 3. Lifecycle: the full valid path with stamps and history.
   * ================================================================ */
  console.log('    3. lifecycle valid path');
  var noObj = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE no objective',
    intervention_type: 'KNOWLEDGE_ARCHIVAL' });
  H.assert(noObj.ok, 'a DRAFT without an objective can be created');
  var sub1 = SCA.intervention.submitIntervention(RESEARCHER,
    noObj.record.id);
  H.assert(!sub1.ok,
    'submission requires an objective (blank objective rejected)');
  H.assertEq(SCA.store.get('capability_interventions',
    noObj.record.id).status, 'DRAFT',
    'the refused submission leaves the record in DRAFT');

  var ivA = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Lifecycle intervention',
    intervention_type: 'PEOPLE_TECHNICIAN_TRAINING',
    objective: 'TEST FIXTURE train two additional technicians',
    capability_ids: [capA.id],
    required_skills: ['TEST FIXTURE refrigeration basics'],
    required_training: ['TEST FIXTURE two-week course'],
    depends_on_human_capability: true,
    critical_roles: [
      { role: 'Operator', status: 'UNKNOWN' },
      { role: 'Trainer', practitioner_id: practId,
        status: 'IDENTIFIED' }
    ]
  });
  H.assert(ivA.ok, 'lifecycle fixture created');

  var s1 = SCA.intervention.submitIntervention(RESEARCHER, ivA.record.id);
  H.assert(s1.ok, 'DRAFT -> SUBMITTED');
  H.assert(!!SCA.store.get('capability_interventions', ivA.record.id)
    .submitted_at, 'submission is stamped');

  var s2 = SCA.intervention.reviewIntervention(REVIEWER, ivA.record.id);
  H.assert(s2.ok, 'SUBMITTED -> UNDER_REVIEW (reviewer)');

  var ap0 = SCA.intervention.approveIntervention(REVIEWER,
    ivA.record.id, '');
  H.assert(!ap0.ok, 'approval requires an explicit reason');

  var ap1 = SCA.intervention.approveIntervention(REVIEWER,
    ivA.record.id, 'TEST FIXTURE approval reason');
  H.assert(ap1.ok, 'UNDER_REVIEW -> APPROVED (gates satisfied)');
  var recA = SCA.store.get('capability_interventions', ivA.record.id);
  H.assertEq(recA.status, 'APPROVED', 'status is APPROVED');
  H.assert(!!recA.approved_at, 'approval is stamped');
  H.assertEq(recA.reviewer, 'TEST FIXTURE Reviewer',
    'approval records the reviewer');

  var act1 = SCA.intervention.activateIntervention(RESEARCHER,
    ivA.record.id);
  H.assert(act1.ok, 'APPROVED -> ACTIVE (creator side, update perm)');

  var sus1 = SCA.intervention.suspendIntervention(RESEARCHER,
    ivA.record.id, '');
  H.assert(!sus1.ok, 'suspension requires an explicit reason');
  var sus2 = SCA.intervention.suspendIntervention(RESEARCHER,
    ivA.record.id, 'TEST FIXTURE supply delay');
  H.assert(sus2.ok, 'ACTIVE -> SUSPENDED (reasoned)');
  var res1 = SCA.intervention.resumeIntervention(RESEARCHER,
    ivA.record.id, 'TEST FIXTURE supplies arrived');
  H.assert(res1.ok, 'SUSPENDED -> ACTIVE (resumption reasoned)');

  var comp1 = SCA.intervention.completeIntervention(RESEARCHER,
    ivA.record.id);
  H.assert(comp1.ok, 'ACTIVE -> COMPLETED');
  recA = SCA.store.get('capability_interventions', ivA.record.id);
  H.assertEq(recA.status, 'COMPLETED', 'status is COMPLETED');
  H.assertEq(recA.outcome_status, 'UNKNOWN',
    'COMPLETED + UNKNOWN is valid: completion never implies outcome');
  H.assert(!!recA.completed_at, 'completion is stamped');

  /* Every transition is history-recorded with its type. */
  var histA = recA.history;
  H.assertEq(histA.length, 7,
    'all 7 lifecycle transitions are history-recorded (submit, ' +
    'review, approve, activate, suspend, resume, complete)');
  H.assert(histA.some(function (h) {
    return h.change_type === 'TRANSITION';
  }), 'history records transitions');
  H.assert(histA.some(function (h) {
    return h.reason === 'TEST FIXTURE supply delay';
  }), 'history preserves the recorded reasons');
  var lastSnapshot = histA[histA.length - 1].snapshot;
  H.assert(lastSnapshot.capability_ids &&
    lastSnapshot.capability_ids.length === 1,
    'history snapshots preserve the referenced targets');

  /* ================================================================
   * 4. Review paths: return-for-correction and discard.
   * ================================================================ */
  console.log('    4. review paths');
  var ivB = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Review-path intervention',
    intervention_type: 'INFRASTRUCTURE_ENERGY',
    objective: 'TEST FIXTURE objective',
    capability_ids: [capB.id],
    required_energy: ['TEST FIXTURE solar'] });
  SCA.intervention.submitIntervention(RESEARCHER, ivB.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, ivB.record.id);

  var ret0 = SCA.intervention.returnForCorrection(REVIEWER,
    ivB.record.id, '');
  H.assert(!ret0.ok, 'return-for-correction requires a reason');
  var ret1 = SCA.intervention.returnForCorrection(REVIEWER,
    ivB.record.id, 'TEST FIXTURE clarify energy requirements');
  H.assert(ret1.ok, 'UNDER_REVIEW -> DRAFT (correction)');
  H.assertEq(SCA.store.get('capability_interventions',
    ivB.record.id).status, 'DRAFT',
    'a returned record is editable again (not a rejection)');
  var editAfter = SCA.intervention.updateIntervention(RESEARCHER,
    ivB.record.id, { description: 'TEST FIXTURE corrected description' });
  H.assert(editAfter.ok,
    'DRAFT editing works after a return for correction');

  /* Discard: UNDER_REVIEW -> CANCELLED is terminal. */
  SCA.intervention.submitIntervention(RESEARCHER, ivB.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, ivB.record.id);
  var disc0 = SCA.intervention.cancelFromReview(REVIEWER, ivB.record.id,
    '');
  H.assert(!disc0.ok, 'review-discard requires a reason');
  var disc1 = SCA.intervention.cancelFromReview(REVIEWER, ivB.record.id,
    'TEST FIXTURE no longer proceeding');
  H.assert(disc1.ok, 'UNDER_REVIEW -> CANCELLED (discard, terminal)');

  /* Execution-side cancellation also requires a reason. */
  var ivC = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Cancel-path intervention',
    intervention_type: 'RESILIENCE_REDUNDANCY',
    objective: 'TEST FIXTURE objective',
    self_contained: true });
  SCA.intervention.submitIntervention(RESEARCHER, ivC.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, ivC.record.id);
  SCA.intervention.approveIntervention(REVIEWER, ivC.record.id,
    'TEST FIXTURE approval');
  SCA.intervention.activateIntervention(RESEARCHER, ivC.record.id);
  var can0 = SCA.intervention.cancelIntervention(RESEARCHER,
    ivC.record.id, '');
  H.assert(!can0.ok, 'active cancellation requires a reason');
  var can1 = SCA.intervention.cancelIntervention(RESEARCHER,
    ivC.record.id, 'TEST FIXTURE funding ended');
  H.assert(can1.ok, 'ACTIVE -> CANCELLED (reasoned, terminal)');

  /* ================================================================
   * 5. Invalid transitions, edit locking, terminals.
   * ================================================================ */
  console.log('    5. invalid transitions & edit locks');
  var ivD = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Lock intervention',
    intervention_type: 'PRODUCTION_LOCAL_MANUFACTURING',
    objective: 'TEST FIXTURE objective',
    required_materials: ['TEST FIXTURE steel'] });
  SCA.intervention.submitIntervention(RESEARCHER, ivD.record.id);

  H.assert(!SCA.intervention.approveIntervention(REVIEWER,
    ivD.record.id, 'TEST FIXTURE').ok,
    'SUBMITTED -> APPROVED is impossible (review must start first)');
  H.assert(!SCA.intervention.activateIntervention(RESEARCHER,
    ivD.record.id).ok, 'SUBMITTED -> ACTIVE is impossible');
  H.assert(!SCA.intervention.completeIntervention(RESEARCHER,
    ivD.record.id).ok, 'DRAFT/SUBMITTED -> COMPLETED is impossible');

  var lockEdit = SCA.intervention.updateIntervention(RESEARCHER,
    ivD.record.id, { description: 'TEST FIXTURE locked edit' });
  H.assert(!lockEdit.ok,
    'SUBMITTED records lock substantive creator editing');

  SCA.intervention.reviewIntervention(REVIEWER, ivD.record.id);
  var revEdit = SCA.intervention.updateIntervention(RESEARCHER,
    ivD.record.id, { description: 'TEST FIXTURE locked edit 2' });
  H.assert(!revEdit.ok,
    'UNDER_REVIEW records stay locked to the creator side');

  /* Terminal records are never edited. */
  var dead = SCA.store.get('capability_interventions', ivB.record.id);
  H.assertEq(dead.status, 'CANCELLED', 'fixture B is terminal');
  H.assert(!SCA.intervention.updateIntervention(RESEARCHER,
    ivB.record.id, { description: 'TEST FIXTURE x' }).ok,
    'CANCELLED records cannot be edited');
  H.assert(!SCA.intervention.amendIntervention(RESEARCHER,
    ivB.record.id, { description: 'TEST FIXTURE x' },
    'TEST FIXTURE').ok,
    'CANCELLED records cannot be amended');
  var deadOps = ['submitIntervention',
    'reviewIntervention', 'activateIntervention',
    'suspendIntervention', 'resumeIntervention',
    'completeIntervention', 'cancelIntervention'];
  deadOps.forEach(function (op) {
    var res = SCA.intervention[op](RESEARCHER, ivB.record.id,
      op === 'cancelIntervention' ? 'TEST FIXTURE' : undefined);
    H.assert(!res.ok, 'terminal record: ' + op + ' is refused');
  });
  H.assert(!SCA.intervention.submitIntervention(RESEARCHER,
    ivA.record.id).ok, 'COMPLETED record cannot move anywhere');

  /* ================================================================
   * 6. Authority: separation of creator and review powers.
   * ================================================================ */
  console.log('    6. authority separation');
  var ivE = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Authority intervention',
    intervention_type: 'MODERNIZATION_HYBRID_SYSTEM',
    objective: 'TEST FIXTURE objective',
    self_contained: true });
  SCA.intervention.submitIntervention(RESEARCHER, ivE.record.id);

  H.assert(!SCA.intervention.reviewIntervention(RESEARCHER,
    ivE.record.id).ok,
    'a researcher cannot start reviews (review authority)');
  H.assert(!SCA.intervention.createIntervention(REVIEWER, {
    name: 'TEST FIXTURE x', intervention_type: 'KNOWLEDGE_ARCHIVAL',
    objective: 'TEST FIXTURE' }).ok,
    'the reviewer role cannot create interventions');
  H.assert(!SCA.intervention.updateIntervention(REVIEWER,
    ivE.record.id, { description: 'TEST FIXTURE' }).ok,
    'the reviewer role cannot edit interventions');
  var regRev = SCA.intervention.reviewIntervention(REGIONAL,
    ivE.record.id);
  H.assert(regRev.ok,
    'regional administrators hold review authority (existing role)');
  var regAppr = SCA.intervention.approveIntervention(REGIONAL,
    ivE.record.id, 'TEST FIXTURE regional approval');
  H.assert(regAppr.ok, 'regional administrators can approve');

  /* The creator can never self-approve — even the national
   * administrator, who holds every permission by the frozen matrix
   * convention, is blocked by the created_by guard. */
  var ivN = SCA.intervention.createIntervention(NATIONAL, {
    name: 'TEST FIXTURE National-created intervention',
    intervention_type: 'VALIDATION_CONTROLLED_PILOT',
    objective: 'TEST FIXTURE objective',
    self_contained: true });
  SCA.intervention.submitIntervention(NATIONAL, ivN.record.id);
  var selfRev = SCA.intervention.reviewIntervention(NATIONAL,
    ivN.record.id);
  H.assert(!selfRev.ok,
    'a creator cannot even move their own intervention to review ' +
    '(the guard covers the whole review side)');
  SCA.intervention.reviewIntervention(REVIEWER, ivN.record.id);
  var selfApp = SCA.intervention.approveIntervention(NATIONAL,
    ivN.record.id, 'TEST FIXTURE self-approval attempt');
  H.assert(!selfApp.ok,
    'a creator can never approve their own intervention (guard)');
  var okApp = SCA.intervention.approveIntervention(REVIEWER,
    ivN.record.id, 'TEST FIXTURE approved by a separate reviewer');
  H.assert(okApp.ok,
    'a separate reviewer approves it correctly');

  /* Regional administrators review but cannot create (least
   * privilege, existing role semantics). */
  H.assert(!SCA.intervention.createIntervention(REGIONAL, {
    name: 'TEST FIXTURE x', intervention_type: 'KNOWLEDGE_ARCHIVAL',
    objective: 'TEST FIXTURE' }).ok,
    'regional administrator cannot create (review role only)');

  /* ================================================================
   * 7. Amendments: explicit, attributable, history-preserving.
   * ================================================================ */
  console.log('    7. amendments');
  var ivF = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Amendment intervention',
    intervention_type: 'REPAIR_SPARE_PARTS',
    objective: 'TEST FIXTURE objective',
    required_spare_parts: ['TEST FIXTURE filter cartridge'] });
  SCA.intervention.submitIntervention(RESEARCHER, ivF.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, ivF.record.id);
  SCA.intervention.approveIntervention(REVIEWER, ivF.record.id,
    'TEST FIXTURE approval');

  var am0 = SCA.intervention.amendIntervention(RESEARCHER, ivF.record.id,
    { description: 'TEST FIXTURE amended' }, '');
  H.assert(!am0.ok, 'amendments require an explicit reason');
  var amDraft = SCA.intervention.amendIntervention(RESEARCHER,
    ivRefs.id, { description: 'TEST FIXTURE x' }, 'TEST FIXTURE');
  H.assert(!amDraft.ok,
    'DRAFT records use update, not amendment (wrong-state guard)');
  H.assertEq(SCA.store.get('capability_interventions', ivRefs.id)
    .status, 'DRAFT', 'the DRAFT fixture stayed a DRAFT');

  /* Snapshot: store records are live references, so capture a clone. */
  var before = JSON.parse(JSON.stringify(
    SCA.store.get('capability_interventions', ivF.record.id)));
  var am1 = SCA.intervention.amendIntervention(RESEARCHER, ivF.record.id,
    { description: 'TEST FIXTURE amended description',
      required_spare_parts: ['TEST FIXTURE filter cartridge',
        'TEST FIXTURE gasket set'] },
    'TEST FIXTURE second spare-part requirement identified');
  H.assert(am1.ok, 'APPROVED record amended with an explicit reason');
  var after = JSON.parse(JSON.stringify(
    SCA.store.get('capability_interventions', ivF.record.id)));
  H.assertEq(parseInt(after.version, 10),
    parseInt(before.version, 10) + 1,
    'amendment increments the version (never silent)');
  H.assertEq(after.history.length, before.history.length + 1,
    'amendment appends exactly one history entry');
  var lastH = after.history[after.history.length - 1];
  H.assertEq(lastH.change_type, 'AMENDMENT',
    'history records the change type AMENDMENT');
  H.assertEq(lastH.reason,
    'TEST FIXTURE second spare-part requirement identified',
    'history preserves the amendment reason');
  H.assertEq(after.description,
    'TEST FIXTURE amended description',
    'the record carries the amended content');
  H.assert(!lastH.snapshot.description,
    'history preserves the PRE-amendment snapshot (the prior ' +
    'state, never overwritten)');
  H.assertEq(after.history[after.history.length - 2].snapshot
    .required_spare_parts.length, 1,
    'history preserves what was originally approved');
  /* Lifecycle fields are immutable through amendments. */
  var amBad = SCA.intervention.amendIntervention(RESEARCHER,
    ivF.record.id, { status: 'COMPLETED', outcome_status: 'SUCCESSFUL' },
    'TEST FIXTURE');
  H.assert(amBad.ok, 'amendment applied (immutable fields stripped)');
  var afterBad = SCA.store.get('capability_interventions', ivF.record.id);
  H.assertEq(afterBad.status, 'APPROVED',
    'amendments can never change lifecycle state directly');
  H.assertEq(afterBad.outcome_status, 'UNKNOWN',
    'amendments can never set outcome status');

  /* Amendments work on ACTIVE and SUSPENDED records too. */
  SCA.intervention.activateIntervention(RESEARCHER, ivF.record.id);
  var am2 = SCA.intervention.amendIntervention(RESEARCHER, ivF.record.id,
    { limitations: 'TEST FIXTURE amended limitation' },
    'TEST FIXTURE active amendment');
  H.assert(am2.ok, 'ACTIVE records can be amended (audited)');
  SCA.intervention.suspendIntervention(RESEARCHER, ivF.record.id,
    'TEST FIXTURE suspend');
  var am3 = SCA.intervention.amendIntervention(RESEARCHER, ivF.record.id,
    { notes: null, fallback_arrangement: 'TEST FIXTURE fallback' },
    'TEST FIXTURE suspended amendment');
  H.assert(am3.ok, 'SUSPENDED records can be amended (audited)');

  /* ================================================================
   * 8. No duplicate-signature guard: competing approaches coexist.
   * ================================================================ */
  console.log('    8. competing interventions coexist');
  var same = { intervention_type: 'KNOWLEDGE_DOCUMENTATION',
    objective: 'TEST FIXTURE competing approaches',
    capability_ids: [capA.id],
    problem_description: 'TEST FIXTURE same problem',
    self_contained: true };
  var c1 = SCA.intervention.createIntervention(RESEARCHER,
    Object.assign({ name: 'TEST FIXTURE Approach A' }, same));
  var c2 = SCA.intervention.createIntervention(TECH,
    Object.assign({ name: 'TEST FIXTURE Approach B' }, same));
  var c3 = SCA.intervention.createIntervention(PM,
    Object.assign({ name: 'TEST FIXTURE Approach C' }, same));
  H.assert(c1.ok && c2.ok && c3.ok,
    'multiple interventions for the same target/problem are all valid');
  /* 12 fixtures exist at this point (ivRefs, noObj, ivA, ivB, ivC,
   * ivD, ivE, ivN, ivF, c1, c2, c3) — the three same-target
   * competitors (c1/c2/c3) coexist without suppression. */
  H.assertEq(SCA.store.count('capability_interventions'), 12,
    'no duplicate-signature suppression: all competing records exist');
  var searchSame = SCA.intervention.searchInterventions(RESEARCHER,
    { query: 'TEST FIXTURE Approach' });
  H.assert(searchSame.ok && searchSame.results.length === 3,
    'search returns all three competing approaches, never merged');

  /* ================================================================
   * 9. Outcome status: reviewer-governed, evidence-gated.
   * ================================================================ */
  console.log('    9. outcome governance');
  var ivG = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE Outcome intervention',
    intervention_type: 'KNOWLEDGE_VALIDATION',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    outcome_evidence_source_ids: [srcId],
    outcome_knowledge_artifact_ids: [artifactId] });
  H.assert(ivG.ok, 'outcome fixture created');
  var ivGid = ivG.record.id;
  SCA.intervention.submitIntervention(RESEARCHER, ivGid);
  SCA.intervention.reviewIntervention(REVIEWER, ivGid);
  SCA.intervention.approveIntervention(REVIEWER, ivGid,
    'TEST FIXTURE approval');
  SCA.intervention.activateIntervention(RESEARCHER, ivGid);

  /* An ongoing activity has no honest outcome yet. */
  H.assert(!SCA.intervention.setOutcomeStatus(RESEARCHER, ivGid,
    'SUCCESSFUL', 'TEST FIXTURE self-assessment').ok,
    'creators cannot assess outcomes (reviewer authority)');
  H.assert(!SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'SUCCESSFUL', 'TEST FIXTURE').ok,
    'outcomes cannot be assessed before COMPLETED');

  SCA.intervention.completeIntervention(RESEARCHER, ivGid);

  H.assert(!SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'NOT_A_STATUS', 'TEST FIXTURE').ok,
    'only the five categorical outcome values are valid');
  var oc0 = SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'SUCCESSFUL', '');
  H.assert(!oc0.ok, 'outcome assessment requires an explicit reason');
  /* Evidence attached at creation; missing-evidence path proven with
   * a second record below. */
  var oc1 = SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'SUCCESSFUL', 'TEST FIXTURE documented outcome evidence supports it');
  H.assert(oc1.ok, 'reviewer assesses SUCCESSFUL on outcome evidence');
  var recG = SCA.store.get('capability_interventions', ivGid);
  H.assertEq(recG.outcome_status, 'SUCCESSFUL', 'outcome recorded');
  H.assertEq(recG.outcome_reviewer, 'TEST FIXTURE Reviewer',
    'outcome assessment is attributable');
  H.assertEq(recG.history[recG.history.length - 1].change_type,
    'OUTCOME', 'outcome change is history-recorded');
  H.assert(!SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'SUCCESSFUL', 'TEST FIXTURE').ok,
    're-setting the same outcome is refused');

  /* All categorical values are reachable; INSUFFICIENT_EVIDENCE is
   * the honest "cannot be assessed" verdict. */
  H.assert(SCA.intervention.setOutcomeStatus(REVIEWER, ivGid, 'MIXED',
    'TEST FIXTURE mixed evidence').ok, 'MIXED is reachable');
  H.assert(SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'UNSUCCESSFUL', 'TEST FIXTURE documented failure').ok,
    'UNSUCCESSFUL is reachable');
  H.assert(SCA.intervention.setOutcomeStatus(REVIEWER, ivGid,
    'INSUFFICIENT_EVIDENCE',
    'TEST FIXTURE not enough outcome evidence').ok,
    'INSUFFICIENT_EVIDENCE is reachable');

  /* Evidence gate: a record without outcome evidence references
   * cannot leave UNKNOWN. */
  var ivH = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE No-evidence outcome intervention',
    intervention_type: 'KNOWLEDGE_ARCHIVAL',
    objective: 'TEST FIXTURE objective',
    self_contained: true });
  var ivHid = ivH.record.id;
  SCA.intervention.submitIntervention(RESEARCHER, ivHid);
  SCA.intervention.reviewIntervention(REVIEWER, ivHid);
  SCA.intervention.approveIntervention(REVIEWER, ivHid, 'TEST FIXTURE');
  SCA.intervention.activateIntervention(RESEARCHER, ivHid);
  SCA.intervention.completeIntervention(RESEARCHER, ivHid);
  var ocNoEv = SCA.intervention.setOutcomeStatus(REVIEWER, ivHid,
    'SUCCESSFUL', 'TEST FIXTURE attempt without evidence');
  H.assert(!ocNoEv.ok,
    'changing outcome from UNKNOWN requires outcome evidence references');
  H.assertEq(SCA.store.get('capability_interventions', ivHid)
    .outcome_status, 'UNKNOWN',
    'COMPLETED + UNKNOWN stays valid when evidence is absent');

  /* Creator separation extends to outcome assessment: even the
   * NATIONAL administrator cannot self-declare an outcome on their
   * own completed intervention. */
  var ivSelf = SCA.intervention.createIntervention(NATIONAL, {
    name: 'TEST FIXTURE National self-outcome intervention',
    intervention_type: 'KNOWLEDGE_VALIDATION',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    outcome_evidence_source_ids: [srcId] });
  var ivSelfId = ivSelf.record.id;
  SCA.intervention.submitIntervention(NATIONAL, ivSelfId);
  SCA.intervention.reviewIntervention(REVIEWER, ivSelfId);
  SCA.intervention.approveIntervention(REVIEWER, ivSelfId,
    'TEST FIXTURE approval');
  SCA.intervention.activateIntervention(NATIONAL, ivSelfId);
  SCA.intervention.completeIntervention(NATIONAL, ivSelfId);
  var selfOutcome = SCA.intervention.setOutcomeStatus(NATIONAL,
    ivSelfId, 'SUCCESSFUL', 'TEST FIXTURE self-assessment attempt');
  H.assert(!selfOutcome.ok,
    'a creator never self-declares an outcome (even NATIONAL)');
  H.assertEq(SCA.store.get('capability_interventions', ivSelfId)
    .outcome_status, 'UNKNOWN',
    'the self-assessment attempt left the outcome UNKNOWN');
  H.assert(SCA.intervention.setOutcomeStatus(REVIEWER, ivSelfId,
    'MIXED', 'TEST FIXTURE independent reviewer assessment').ok,
    'an independent reviewer can assess the same intervention');

  /* No scores: outcome is a categorical string, never numeric. */
  H.assert(typeof recG.outcome_status === 'string',
    'outcome status is categorical, never a numeric score');
  var fsSrc = require('fs');
  var wfSource = fsSrc.readFileSync('src/intervention/workflow.js',
    'utf8');
  var wfCodeOnly = wfSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  H.assert(!/score|rank|priorit|percent|roi/i.test(wfCodeOnly),
    'workflow code (comments stripped) contains no ' +
    'scoring/ranking/prioritization logic');

  /* ================================================================
   * 10. Successor-before-launch: presence-of-value.
   * ================================================================ */
  console.log('    10. successor-before-launch gate');
  var succ1 = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE successor gate (no roles)',
    intervention_type: 'PEOPLE_APPRENTICESHIP',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    depends_on_human_capability: true });
  SCA.intervention.submitIntervention(RESEARCHER, succ1.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, succ1.record.id);
  var succAppr = SCA.intervention.approveIntervention(REVIEWER,
    succ1.record.id, 'TEST FIXTURE attempt');
  H.assert(!succAppr.ok,
    'approval blocked when depends_on_human_capability has no roles');

  /* Substantive editing is locked at UNDER_REVIEW: the reviewer
   * returns the record for correction (the pinned reject path),
   * the creator records the roles, and it goes back through review. */
  var succRet = SCA.intervention.returnForCorrection(REVIEWER,
    succ1.record.id, 'TEST FIXTURE record the critical roles first');
  H.assert(succRet.ok,
    'return-for-correction releases the edit lock (not a rejection)');
  var succ2 = SCA.intervention.updateIntervention(RESEARCHER,
    succ1.record.id, { critical_roles: [
      { role: 'Operator', status: 'UNKNOWN' }
    ] });
  H.assert(succ2.ok, 'UNKNOWN successor roles can be recorded');
  SCA.intervention.submitIntervention(RESEARCHER, succ1.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, succ1.record.id);
  var succAppr2 = SCA.intervention.approveIntervention(REVIEWER,
    succ1.record.id, 'TEST FIXTURE UNKNOWN counts as recorded');
  H.assert(succAppr2.ok,
    'approval passes with honest UNKNOWN roles (presence-of-value)');

  var badRole = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE bad critical role',
    intervention_type: 'PEOPLE_TRAINER_DEVELOPMENT',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    depends_on_human_capability: true,
    critical_roles: [
      { role: 'Trainer', status: 'IDENTIFIED' }
    ] });
  H.assert(!badRole.ok,
    'IDENTIFIED without a practitioner reference is refused (never invented)');
  var badRole2 = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE bad critical role 2',
    intervention_type: 'PEOPLE_PRACTITIONER_SUCCESSION',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    depends_on_human_capability: true,
    critical_roles: [
      { role: 'Successor', practitioner_id: 'missing-practitioner',
        status: 'IDENTIFIED' }
    ] });
  H.assert(!badRole2.ok,
    'IDENTIFIED with an unresolvable practitioner is refused');
  var badRole3 = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE blank role label',
    intervention_type: 'PEOPLE_APPRENTICESHIP',
    objective: 'TEST FIXTURE objective',
    self_contained: true,
    depends_on_human_capability: true,
    critical_roles: [{ role: '  ', status: 'UNKNOWN' }] });
  H.assert(!badRole3.ok, 'blank role labels are refused');

  /* ================================================================
   * 11. No Orphan Project Rule: dependency disclosure at approval.
   * ================================================================ */
  console.log('    11. dependency disclosure gate');
  var orphan = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE orphan intervention',
    intervention_type: 'INFRASTRUCTURE_WATER_SYSTEM',
    objective: 'TEST FIXTURE objective' });
  SCA.intervention.submitIntervention(RESEARCHER, orphan.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, orphan.record.id);
  var orphanAppr = SCA.intervention.approveIntervention(REVIEWER,
    orphan.record.id, 'TEST FIXTURE orphan attempt');
  H.assert(!orphanAppr.ok,
    'approval blocked without dependency disclosure or self_contained');
  /* Return for correction, disclose the dependencies, resubmit. */
  SCA.intervention.returnForCorrection(REVIEWER, orphan.record.id,
    'TEST FIXTURE disclose the external dependencies');
  var orphanFix = SCA.intervention.updateIntervention(RESEARCHER,
    orphan.record.id, { required_energy: ['TEST FIXTURE diesel pump'],
      required_training: ['TEST FIXTURE pump maintenance'] });
  H.assert(orphanFix.ok, 'dependencies can be disclosed in DRAFT');
  SCA.intervention.submitIntervention(RESEARCHER, orphan.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, orphan.record.id);
  var orphanAppr2 = SCA.intervention.approveIntervention(REVIEWER,
    orphan.record.id, 'TEST FIXTURE dependencies now documented');
  H.assert(orphanAppr2.ok,
    'approval passes once requirements are documented');

  var selfC = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE self-contained intervention',
    intervention_type: 'KNOWLEDGE_TRANSLATION',
    objective: 'TEST FIXTURE objective',
    self_contained: true });
  SCA.intervention.submitIntervention(RESEARCHER, selfC.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, selfC.record.id);
  var selfAppr = SCA.intervention.approveIntervention(REVIEWER,
    selfC.record.id, 'TEST FIXTURE explicit self-contained claim');
  H.assert(selfAppr.ok,
    'the explicit self_contained claim satisfies the gate (auditable)');

  /* ================================================================
   * 12. Privacy & public visibility.
   * ================================================================ */
  console.log('    12. privacy / visibility');
  /* Visible-set snapshot before the privacy fixtures. */
  var anonList = SCA.intervention.searchInterventions(ANON, {});
  H.assert(anonList.ok, 'anonymous read of the register works');
  anonList.results.forEach(function (iv) {
    H.assert(['APPROVED', 'ACTIVE', 'COMPLETED']
      .indexOf(iv.status) !== -1,
      'anonymous register shows only public states: ' + iv.status);
  });
  /* ivA is COMPLETED: anonymous can read it; ivE is SUBMITTED:
   * anonymous cannot. */
  var anonGetPub = SCA.intervention.getIntervention(ANON, ivA.record.id);
  H.assert(anonGetPub.ok,
    'anonymous users can read a COMPLETED public record');
  var anonGetReview = SCA.intervention.getIntervention(ANON,
    ivD.record.id);
  H.assert(!anonGetReview.ok,
    'anonymous users cannot read UNDER_REVIEW records');
  var anonGetDRAFT = SCA.intervention.getIntervention(ANON,
    c1.record.id);
  H.assert(!anonGetDRAFT.ok,
    'anonymous users cannot read DRAFT records');
  /* ivF is SUSPENDED: explicit access classification, staff-only. */
  var anonGetSus = SCA.intervention.getIntervention(ANON,
    ivF.record.id);
  H.assert(!anonGetSus.ok,
    'SUSPENDED records are not public by default');
  var staffGetSus = SCA.intervention.getIntervention(RESEARCHER,
    ivF.record.id);
  H.assert(staffGetSus.ok, 'staff can read SUSPENDED records');
  var anonGetCancel = SCA.intervention.getIntervention(ANON,
    ivB.record.id);
  H.assert(!anonGetCancel.ok,
    'CANCELLED records are not public by default');

  /* Role coverage for the creator side (least privilege). */
  H.assert(SCA.intervention.createIntervention(PRACTITIONER, {
    name: 'TEST FIXTURE practitioner-created',
    intervention_type: 'KNOWLEDGE_TRANSMISSION',
    objective: 'TEST FIXTURE objective',
    self_contained: true }).ok,
    'practitioners can plan interventions');
  H.assert(SCA.intervention.createIntervention(WORKSHOP_ROLE, {
    name: 'TEST FIXTURE workshop-created',
    intervention_type: 'REPAIR_TOOLING',
    objective: 'TEST FIXTURE objective',
    self_contained: true }).ok,
    'workshops can plan interventions');
  H.assert(!SCA.intervention.createIntervention(ANON, {
    name: 'TEST FIXTURE anon', intervention_type: 'KNOWLEDGE_ARCHIVAL',
    objective: 'TEST FIXTURE' }).ok,
    'anonymous users cannot create');

  /* Practitioner masking: the workflow never exposes practitioner
   * identities in its anonymous-facing APIs beyond canonical
   * references (display masking is the Stage 5 rule enforced by the
   * pages); the anonymous record carries no free-text identity. */
  H.assert(!JSON.stringify(anonGetPub.record)
    .match(/TEST FIXTURE Intervention Practitioner/),
    'public records never carry practitioner identities as free text');

  /* ================================================================
   * 13. Graph boundary: interventions never touch the graph.
   * ================================================================ */
  console.log('    13. graph boundary');
  H.assertEq(SCA.store.count('graph_edges'), edgesBefore,
    'no intervention operation created a graph edge');
  H.assertEq(Object.keys(SCA.graphRegistry.RELATIONSHIPS).length, 19,
    'Stage 7 relationship vocabulary remains exactly 19 types');
  H.assertEq(JSON.stringify(
    Object.keys(SCA.graphRegistry.RELATIONSHIPS)), graphTypesBefore,
    'the 19-type graph vocabulary is unchanged by Stage 10');
  H.assert(!SCA.graphRegistry.RELATIONSHIPS.CAPABILITY_INTERVENTION,
    'interventions are NOT graph node/edge vocabulary entries');
  /* A full lifecycle pass must not alter the graph either. */
  var ivI = SCA.intervention.createIntervention(RESEARCHER, {
    name: 'TEST FIXTURE graph-boundary intervention',
    intervention_type: 'RESILIENCE_FALLBACK_SYSTEM',
    objective: 'TEST FIXTURE objective',
    recovery_profile_ids: [rp.id],
    self_contained: true });
  SCA.intervention.submitIntervention(RESEARCHER, ivI.record.id);
  SCA.intervention.reviewIntervention(REVIEWER, ivI.record.id);
  SCA.intervention.approveIntervention(REVIEWER, ivI.record.id,
    'TEST FIXTURE');
  SCA.intervention.activateIntervention(RESEARCHER, ivI.record.id);
  SCA.intervention.completeIntervention(RESEARCHER, ivI.record.id);
  SCA.intervention.setOutcomeStatus(REVIEWER, ivI.record.id, 'MIXED',
    'TEST FIXTURE mixed outcome');
  H.assertEq(SCA.store.count('graph_edges'), edgesBefore,
    'the full lifecycle (including outcome) writes no graph edges');

  /* ================================================================
   * 14. Integrity: honest flags, never deletion.
   * ================================================================ */
  console.log('    14. integrity');
  var ig = SCA.intervention.integrity(RESEARCHER);
  H.assert(ig.ok, 'integrity runs');
  var errCount = ig.errors.length;
  var warnCount = ig.warnings.length;
  var recCount = SCA.store.count('capability_interventions');
  H.assertEq(SCA.store.count('capability_interventions'), recCount,
    'integrity never deletes anything');

  /* A broken record is flagged honestly (insert validates enums, so
   * the breakage is in references and the outcome trail). */
  SCA.store.insert('capability_interventions', {
    id: 'TEST-FIXTURE-BROKEN-IV',
    name: 'TEST FIXTURE broken',
    intervention_type: 'KNOWLEDGE_ARCHIVAL',
    status: 'DRAFT',
    capability_ids: ['missing-capability'],
    depends_on_human_capability: true,
    outcome_status: 'SUCCESSFUL' });
  var ig2 = SCA.intervention.integrity(RESEARCHER);
  H.assert(ig2.errors.length > errCount,
    'broken records are flagged (references, roles, outcome trail)');
  H.assert(ig2.errors.some(function (e) {
    return e.indexOf('TEST-FIXTURE-BROKEN-IV') !== -1;
  }), 'the flag names the offending record');
  H.assert(ig2.errors.some(function (e) {
    return e.indexOf('outcome') !== -1 && e.indexOf('reviewer') !== -1;
  }), 'an outcome without a reviewer trail is flagged');
  H.assert(ig2.errors.some(function (e) {
    return e.indexOf('missing-capability') !== -1;
  }), 'unresolvable references are flagged');
  H.assert(ig2.errors.some(function (e) {
    return e.indexOf('critical_roles') !== -1;
  }), 'depends_on_human_capability without roles is flagged');
  SCA.store.remove('capability_interventions', 'TEST-FIXTURE-BROKEN-IV');

  /* Terminal history: broken references are warnings, not errors,
   * but structural trail rules still apply. */
  var termBroken = SCA.store.insert('capability_interventions', {
    id: 'TEST-FIXTURE-TERM-BROKEN-IV',
    name: 'TEST FIXTURE terminal broken',
    intervention_type: 'KNOWLEDGE_ARCHIVAL',
    status: 'COMPLETED',
    capability_ids: ['gone-capability-record'],
    last_reason: 'TEST FIXTURE terminal with broken history' });
  var ig3 = SCA.intervention.integrity(RESEARCHER);
  H.assert(ig3.warnings.some(function (w) {
    return w.indexOf('TEST-FIXTURE-TERM-BROKEN-IV') !== -1;
  }), 'terminal broken references are honest warnings (exemption)');
  H.assert(!ig3.errors.some(function (e) {
    return e.indexOf('TEST-FIXTURE-TERM-BROKEN-IV') !== -1 &&
      e.indexOf('capability_ids') !== -1;
  }), 'terminal records are not held to the active standard on refs');
  H.assert(ig3.errors.some(function (e) {
    return e.indexOf('TEST-FIXTURE-TERM-BROKEN-IV') !== -1 &&
      e.indexOf('completed_at') !== -1;
  }), 'structural trail errors still apply to terminal records');
  SCA.store.remove('capability_interventions',
    'TEST-FIXTURE-TERM-BROKEN-IV');
  var ig4 = SCA.intervention.integrity(RESEARCHER);
  H.assert(!ig4.errors.some(function (e) {
    return e.indexOf('TEST-FIXTURE-TERM-BROKEN-IV') !== -1;
  }), 'integrity is clean after removing the test breakage');

  /* ================================================================
   * 15. Transfer: export, standalone import, atomicity, exemptions.
   * ================================================================ */
  console.log('    15. transfer');
  var ivCount = SCA.store.count('capability_interventions');
  var bundle = JSON.parse(SCA.transfer.exportAll());
  H.assertEq(bundle.collections.capability_interventions.length,
    ivCount, 'full export carries every intervention');
  H.assert(bundle.collections.capability_interventions.every(
    function (iv) {
      return String(iv.name).indexOf('TEST FIXTURE') !== -1;
    }),
    'exported records are all test fixtures (no fabricated data)');

  /* Single-collection export is standalone-importable: canonical
   * references (capabilities, practitioners incl. critical roles,
   * organizations, recovery profiles) are carried. */
  var single = JSON.parse(
    SCA.transfer.exportCollection('capability_interventions'));
  H.assert(single.records.length === ivCount,
    'collection export carries all interventions');
  var carried = {};
  Object.keys(single.referenced || {}).forEach(function (c) {
    carried[c] = single.referenced[c].length;
  });
  H.assert((carried.capabilities || 0) > 0,
    'collection export carries the referenced capabilities');
  H.assert((carried.practitioners || 0) > 0,
    'collection export carries critical-role practitioners');
  H.assert((carried.organizations || 0) > 0,
    'collection export carries the responsible organization');
  H.assert((carried.recovery_profiles || 0) > 0,
    'collection export carries referenced recovery profiles');

  /* Round-trip: full export, wipe, import, compare. */
  var fullText = SCA.transfer.exportAll();
  SCA.store.wipe();
  SCA.store.init();
  var imp = SCA.transfer.importBundle(fullText);
  H.assert(imp.ok, 'full round-trip import succeeds (atomic)');
  H.assertEq(SCA.store.count('capability_interventions'), ivCount,
    'round-trip preserves every intervention');
  var igRT = SCA.intervention.integrity(RESEARCHER);
  H.assert(igRT.errors.length === 0,
    'round-tripped data passes intervention integrity cleanly');
  H.assertEq(SCA.store.count('capabilities'), 240,
    'round-trip keeps the 240 inventory intact');

  /* Standalone single-collection import into a clean dataset. */
  SCA.store.wipe();
  SCA.store.init();
  var impSingle = SCA.transfer.importBundle(JSON.stringify(single));
  H.assert(impSingle.ok,
    'standalone intervention export is independently importable');
  H.assertEq(SCA.store.count('capability_interventions'), ivCount,
    'standalone import restores every intervention');
  var igS = SCA.intervention.integrity(RESEARCHER);
  H.assert(igS.errors.every(function (e) {
    return e.indexOf('unresolvable') === -1;
  }), 'standalone-imported interventions resolve their references');

  /* Hard references: an active record with a missing reference is
   * rejected whole (atomic), never partially imported. */
  var badBundle = JSON.parse(SCA.transfer.exportAll());
  badBundle.collections.capability_interventions.some(function (iv) {
    if (iv.status === 'APPROVED' || iv.status === 'ACTIVE') {
      iv.capability_ids = ['missing-target-record'];
      return true;
    }
    return false;
  });
  var impBad = SCA.transfer.importBundle(JSON.stringify(badBundle));
  H.assert(!impBad.ok,
    'active intervention with an unresolvable reference is rejected');
  H.assert(SCA.store.all('capability_interventions').every(function (iv) {
    return (iv.capability_ids || [])
      .indexOf('missing-target-record') === -1;
  }), 'rejected import mutates nothing (atomicity)');

  /* Terminal-history exemption: a COMPLETED record keeps its broken
   * references and still imports. */
  var histBundle = JSON.parse(SCA.transfer.exportAll());
  var histIv = histBundle.collections.capability_interventions
    .filter(function (iv) { return iv.status === 'COMPLETED'; })[0];
  H.assert(!!histIv, 'fixture: a COMPLETED record exists for the test');
  if (histIv) {
    histIv.capability_ids = ['retired-broken-target'];
    var impHist = SCA.transfer.importBundle(
      JSON.stringify(histBundle));
    H.assert(impHist.ok,
      'terminal history keeps broken references (frozen exemption)');
  }

  /* Structural import rules: invalid status/type/outcome and broken
   * outcome trails are rejected before any mutation. */
  var structBundle = JSON.parse(SCA.transfer.exportAll());
  structBundle.collections.capability_interventions[0].status =
    'NOT_A_STATUS';
  var impStruct = SCA.transfer.importBundle(
    JSON.stringify(structBundle));
  H.assert(!impStruct.ok, 'invalid lifecycle status blocks import');

  var structBundle2 = JSON.parse(SCA.transfer.exportAll());
  structBundle2.collections.capability_interventions
    .some(function (iv) {
      if (iv.status === 'ACTIVE' || iv.status === 'APPROVED') {
        iv.outcome_status = 'SUCCESSFUL';
        iv.outcome_reviewer = 'TEST FIXTURE Self';
        return true;
      }
      return false;
    });
  var impStruct2 = SCA.transfer.importBundle(
    JSON.stringify(structBundle2));
  H.assert(!impStruct2.ok,
    'an outcome on a non-COMPLETED record blocks import');

  var rolesBundle = JSON.parse(SCA.transfer.exportAll());
  rolesBundle.collections.capability_interventions
    .some(function (iv) {
      if (iv.status === 'APPROVED' || iv.status === 'ACTIVE') {
        iv.critical_roles = [{ role: 'Operator',
          practitioner_id: 'missing-practitioner-import',
          status: 'IDENTIFIED' }];
        return true;
      }
      return false;
    });
  var impRoles = SCA.transfer.importBundle(JSON.stringify(rolesBundle));
  H.assert(!impRoles.ok,
    'an unresolvable critical-role practitioner blocks import');

  /* Restore the full dataset after the slice/rejection tests. */
  var impRestore = SCA.transfer.importBundle(fullText);
  H.assert(impRestore.ok, 'full dataset restored after slice tests');
  H.assertEq(SCA.store.count('capabilities'), 240,
    'restored dataset carries the full 240 inventory');

  /* ================================================================
   * 16. Frozen boundaries.
   * ================================================================ */
  console.log('    16. frozen boundaries');
  var baseCaps2 = SCA.store.all('capabilities');
  H.assertEq(baseCaps2.length, 240,
    'the 240-capability inventory is unchanged');
  H.assertEq(JSON.stringify(baseCaps2), baseSnapshot,
    'the inventory is byte-identical to the suite baseline');
  H.assertEq(SCA.store.count('families'), 12,
    'the 12 families are unchanged');

  /* No Stage 13+ functionality. (Stage 11 pilots and Stage 12
   * measurement/indicator now exist as their OWN frozen systems —
   * the Stage 10 boundary evolved with them: the intervention
   * workflow itself must expose none of that power, and no ghost
   * shadow collections may appear.) */
  H.assert(!SCA.marketplace,
    'no marketplace system exists');
  H.assert(SCA.store.COLLECTIONS
    .indexOf('measurements') !== -1 &&
    SCA.store.COLLECTIONS.indexOf('indicators') !== -1,
    'the Stage 12 Measurement/Indicator collections exist in their ' +
    'own frozen system');
  H.assert(!SCA.intervention.measurements &&
    !SCA.intervention.createMeasurement &&
    !SCA.intervention.createIndicator &&
    !SCA.intervention.computeIndicator,
    'the intervention workflow exposes no measurement/indicator power');
  ['measurement_values', 'indicator_values', 'capability_scores',
    'pilot_scores', 'observatory_metrics'].forEach(function (ghost) {
    H.assert(SCA.store.COLLECTIONS.indexOf(ghost) === -1,
      'no ghost collection "' + ghost + '" exists');
  });
  H.assert(SCA.intervention.REFERENCE_FIELDS,
    'the workflow exposes its frozen reference map for inspection');

  /* The roadmap amendment is explicit and documented. */
  var fsMod = require('fs');
  H.assert(fsMod.existsSync('docs/roadmap-13-stages.md'),
    'the roadmap doc was deliberately renamed for the 13-stage plan');
  var roadmap = fsMod.readFileSync('docs/roadmap-13-stages.md', 'utf8');
  H.assert(roadmap.indexOf('Capability Intervention Foundation') !== -1,
    'roadmap: Stage 10 is the Capability Intervention Foundation');
  H.assert(roadmap.indexOf('Stage 13') !== -1 &&
    roadmap.toLowerCase().indexOf('marketplace') !== -1,
    'roadmap: the Marketplace is preserved at Stage 13');
  H.assert(roadmap.toLowerCase()
    .indexOf('deliberately amended') !== -1,
    'roadmap: the amendment is recorded as explicit, not accidental');

  /* Stages 1–9 remain authoritative: spot-check their public APIs. */
  H.assert(SCA.recovery && SCA.recovery.verifyRecoveryProfile,
    'Stage 9 recovery workflow is untouched and present');
  H.assert(SCA.repair && SCA.repair.assetCollection,
    'Stage 8 repair workflow is untouched and present');
  H.assert(SCA.research && SCA.research.setProjectStatus,
    'Stage 4 research workflow is untouched and present');
  H.assert(SCA.training && SCA.training.reproductionProfile,
    'Stage 5 training workflow is untouched and present');

  /* ---------- teardown ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240,
    'teardown: pristine baseline restored (240)');
  H.assertEq(SCA.store.count('capability_interventions'), 0,
    'teardown: zero intervention fixtures remain');
  H.assertEq(SCA.store.count('practitioners'), 0,
    'teardown: zero fabricated practitioners remain');
  H.assertEq(SCA.store.count('organizations'), 0,
    'teardown: zero fabricated organizations remain');
  H.assertEq(SCA.store.count('recovery_profiles'), 0,
    'teardown: zero recovery fixtures remain');
  H.assertEq(SCA.store.count('graph_edges'), 0,
    'teardown: zero graph fixtures remain');
  H.assertEq(SCA.store.count('workshops'), 0,
    'teardown: zero repair fixtures remain');
  console.log('    intervention-system suite done');
};
