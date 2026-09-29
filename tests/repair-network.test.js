/*
 * Stage 8: Repair & Spare-Part Network Foundation test suite.
 *
 * All test data is explicitly marked TEST FIXTURE. No real Somali
 * repair claims, workshops, technicians, spare parts or repair records
 * are fabricated; the 240-capability inventory is never modified;
 * every fixture is wiped at teardown and the pristine Stage 1-7
 * baseline is confirmed.
 *
 * The suite exercises the Stage 8 principles:
 *  - capability ≠ practitioner; existence ≠ competence; diagnosis ≠
 *    repair; repair ≠ fabrication; availability ≠ compatibility;
 *  - UNKNOWN ≠ nonexistent (missing values never zero/false);
 *  - no automatic inference; no auto-verification; no fabricated
 *    baseline; provenance-gated lifecycles; reviewer separation;
 *  - pathways report UNKNOWN honestly; repair records are never
 *    published to anonymous users; person references stay protected.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  H.load('src/models/repair-capability.js');
  H.load('src/models/spare-part.js');
  H.load('src/models/repair-record.js');
  H.load('src/repair/workflow.js');
  console.log('  repair-network.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var TECH = { name: 'TEST FIXTURE Technician', role: 'technician' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var ANON = null;
  var COMMUNITY = { name: 'TEST FIXTURE Community Steward',
    role: 'community_steward' };

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240,
    'baseline 240 intact before Stage 8 fixtures');
  H.assertEq(SCA.store.count('repair_capabilities'), 0,
    'no fabricated repair capabilities at start');
  H.assertEq(SCA.store.count('spare_parts'), 0,
    'no fabricated spare parts at start');
  H.assertEq(SCA.store.count('repair_records'), 0,
    'no fabricated repair records at start');
  H.assertEq(SCA.store.count('workshops'), 0,
    'no fabricated workshops at start');

  /* ---------- shared fixture scaffolding ---------- */
  var fam = SCA.store.all('families')[0];
  var assetCap = SCA.store.insert('capabilities', {
    name: 'TEST FIXTURE Capability Pump',
    code: 'TEST-WATER-PUMP', family_id: fam.id,
    evidence_level: 'E0', living_status: 'S0'
  }).record;
  var assetCap2 = SCA.store.all('capabilities')[1];
  H.assertEq(assetCap.name, 'TEST FIXTURE Capability Pump',
    'asset fixture created');

  var src = SCA.store.insert('evidence', {
    title: 'TEST FIXTURE Field Visit', source_type: 'FIELD_REPORT',
    verification_status: 'UNREVIEWED'
  }).record;

  /* ---------- RBAC ---------- */
  H.assert(SCA.rbac.can(ANON, 'repair.read'),
    'public can browse the repair network (privacy-filtered)');
  H.assert(!SCA.rbac.can(ANON, 'repair.records.read'),
    'anonymous users cannot read detailed repair records (safety)');
  H.assert(!SCA.rbac.can(ANON, 'repair.create'),
    'anonymous users cannot create repair data');
  H.assert(SCA.rbac.can(RESEARCHER, 'repair.create'),
    'researchers can document repairs');
  H.assert(SCA.rbac.can(TECH, 'sparepart.create'),
    'technicians can document spare parts');
  H.assert(SCA.rbac.can(REVIEWER, 'repair.review'),
    'reviewers hold review authority');
  H.assert(!SCA.rbac.can(RESEARCHER, 'repair.review'),
    'entry staff never hold review authority (least privilege)');
  H.assert(SCA.rbac.can(NATIONAL, 'repair.admin'),
    'national administrator holds every repair permission');
  H.assert(!SCA.rbac.can(RESEARCHER, 'repair.admin'),
    'repair.admin is empty except the national administrator');

  /* ---------- Workshop lifecycle ---------- */
  var wsDenied = SCA.repair.createWorkshop(ANON,
    { name: 'TEST FIXTURE Denied' });
  H.assert(!wsDenied.ok, 'anonymous workshop creation denied');

  var wsA = SCA.repair.createWorkshop(RESEARCHER, {
    name: 'TEST FIXTURE Workshop Alpha',
    public_visibility: true
  });
  H.assert(wsA.ok, 'workshop created');
  H.assertEq(wsA.record.status, 'REPORTED',
    'a new workshop starts REPORTED — never automatically VERIFIED');
  H.assertEq(wsA.record.compatibility_status, undefined,
    'workshops carry no compatibility claim');

  var wsBadRegion = SCA.repair.createWorkshop(RESEARCHER, {
    name: 'TEST FIXTURE Bad Region', region_ids: ['no-such-region']
  });
  H.assert(!wsBadRegion.ok && wsBadRegion.errors.region_ids,
    'invalid regional reference rejected at creation');

  /* REPORTED -> DOCUMENTED requires provenance. */
  var noProv = SCA.repair.documentWorkshop(RESEARCHER, wsA.record.id);
  H.assert(!noProv.ok && noProv.errors.source_ids,
    'documenting a workshop without provenance rejected');

  var wsA2 = SCA.repair.updateWorkshop(RESEARCHER, wsA.record.id,
    { source_ids: [src.id], services: ['water pump repair'] });
  H.assert(wsA2.ok, 'workshop details updated with provenance');

  var wsB = SCA.repair.createWorkshop(TECH, {
    name: 'TEST FIXTURE Workshop Beta (proposed)',
    public_visibility: true,
    source_ids: [src.id]
  });
  H.assertEq(wsB.record.status, 'REPORTED',
    'second fixture workshop also starts REPORTED');
  SCA.repair.documentWorkshop(TECH, wsB.record.id);
  H.assertEq(SCA.store.get('workshops', wsB.record.id).status, 'DOCUMENTED',
    'Beta workshop documented with provenance');

  /* Verification: reviewer-gated, explicit reason, no auto-promote. */
  var vDenied = SCA.repair.verifyWorkshop(RESEARCHER, wsA.record.id,
    'should fail');
  H.assert(!vDenied.ok && vDenied.errors.permission,
    'a researcher cannot verify a workshop');
  var vSkip = SCA.repair.verifyWorkshop(REVIEWER, wsA.record.id,
    'TEST FIXTURE: skip-stage verification');
  H.assert(!vSkip.ok && vSkip.errors.status,
    'REPORTED workshop cannot be verified directly (staged lifecycle)');

  SCA.repair.documentWorkshop(RESEARCHER, wsA.record.id);
  var vNoReason = SCA.repair.verifyWorkshop(REVIEWER, wsA.record.id, '');
  H.assert(!vNoReason.ok && vNoReason.errors.reason,
    'verification without an explicit reason rejected');
  var vA = SCA.repair.verifyWorkshop(REVIEWER, wsA.record.id,
    'TEST FIXTURE: existence and services confirmed on site');
  H.assert(vA.ok, 'reviewer verifies a documented workshop');
  H.assertEq(SCA.store.get('workshops', wsA.record.id).status, 'VERIFIED',
    'workshop VERIFIED only through review');
  H.assertEq(SCA.store.get('workshops', wsA.record.id).reviewer,
    'TEST FIXTURE Reviewer', 'verification records the reviewer');

  /* Operating states: CLOSED is terminal. */
  var closed = SCA.repair.setWorkshopState(RESEARCHER, wsB.record.id,
    'CLOSED');
  H.assert(closed.ok, 'workshop can close');
  var reopen = SCA.repair.setWorkshopState(RESEARCHER, wsB.record.id,
    'REPORTED');
  H.assert(!reopen.ok,
    'CLOSED is terminal — a closed workshop is history');

  /* ---------- RepairCapability ---------- */
  var rcDenied = SCA.repair.createRepairCapability(RESEARCHER, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id,
    repair_operations: ['x']
  });
  H.assert(!rcDenied.ok && rcDenied.errors.workshop_id,
    'a capability needs a workshop or practitioner anchor');

  var rcBadAsset = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: 'no-such-asset', repair_operations: ['x']
  });
  H.assert(!rcBadAsset.ok && rcBadAsset.errors.asset_id,
    'capability to a nonexistent asset rejected');

  /* Diagnostic-only capability (Principle 3: diagnosis ≠ repair). */
  var rcDiag = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap.id, diagnostic_capability: true,
    evidence_source_ids: [src.id]
  });
  H.assert(rcDiag.ok, 'diagnostic-only capability created');
  H.assert(rcDiag.record.repair_operations.length === 0 &&
    rcDiag.record.fabrication_capability === false,
    'diagnostic capability implies neither repair nor fabrication');

  var rcNoOps = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap.id
  });
  H.assert(!rcNoOps.ok && rcNoOps.errors.repair_operations,
    'a capability must document at least one operation kind');

  var rcRepair = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap.id, repair_operations: ['seal replacement'],
    manufacturer: 'TEST FIXTURE PumpCo', model: 'TP-100',
    evidence_source_ids: [src.id]
  });
  H.assert(rcRepair.ok, 'repair capability for a specific model created');
  H.assertEq(rcRepair.record.status, 'PROPOSED', 'capability starts PROPOSED');
  H.assertEq(rcRepair.record.competence_status, 'UNKNOWN',
    'competence starts UNKNOWN — a capability is not competence');

  var rcDup = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap.id, repair_operations: ['seal replacement'],
    manufacturer: 'TEST FIXTURE PumpCo', model: 'TP-100'
  });
  H.assert(!rcDup.ok && rcDup.errors.duplicate,
    'duplicate capability rejected — corrections go through supersession');

  /* "Workshop A can repair Pump Model X" ≠ "can repair all pumps". */
  var rcOtherAsset = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap2.id, repair_operations: ['other asset']
  });
  H.assert(rcOtherAsset.ok,
    'capabilities are per-asset — another asset needs its own record');

  /* Lifecycle: PROPOSED -> DOCUMENTED (provenance) -> VERIFIED
   * (reviewer + reason). Never automatic. */
  /* Documenting without provenance is rejected (separate fixture,
   * no provenance attached). */
  var rcBare = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap2.id, repair_operations: ['bare op']
  }).record;
  var rcDocNoProv = SCA.repair.documentRepairCapability(RESEARCHER,
    rcBare.id);
  H.assert(!rcDocNoProv.ok && rcDocNoProv.errors.evidence_source_ids,
    'documenting a capability without provenance rejected');

  var rcVDirect = SCA.repair.verifyRepairCapability(REVIEWER,
    rcDiag.record.id, 'direct');
  H.assert(!rcVDirect.ok,
    'PROPOSED capabilities cannot be verified directly (staged)');

  var rcVDenied = SCA.repair.verifyRepairCapability(RESEARCHER,
    rcDiag.record.id, 'self-verify');
  H.assert(!rcVDenied.ok && rcVDenied.errors.permission,
    'a researcher cannot verify a capability');

  SCA.repair.documentRepairCapability(RESEARCHER, rcDiag.record.id);
  var rcV = SCA.repair.verifyRepairCapability(REVIEWER, rcDiag.record.id,
    'TEST FIXTURE: diagnosis demonstrated on site');
  H.assert(rcV.ok, 'reviewer verifies a documented capability');
  H.assertEq(rcV.record.status, 'VERIFIED', 'capability VERIFIED via review');

  /* VERIFIED is never edited in place. */
  var rcEdit = SCA.repair.updateRepairCapability(RESEARCHER,
    rcDiag.record.id, { limitations: 'edited' });
  H.assert(!rcEdit.ok && rcEdit.errors.status,
    'verified capabilities cannot be edited in place');

  /* Supersession: correction creates a successor, preserves both. */
  var sup = SCA.repair.supersedeRepairCapability(RESEARCHER,
    rcRepair.record.id, { repair_operations: ['seal + bearing replacement'],
      fabrication_capability: true },
    'TEST FIXTURE: operations corrected after review');
  H.assert(sup.ok, 'supersession creates the corrected capability');
  H.assertEq(sup.record.supersedes_id, rcRepair.record.id,
    'the successor records what it supersedes');
  H.assertEq(SCA.store.get('repair_capabilities', rcRepair.record.id).status,
    'SUPERSEDED', 'the old capability is preserved as SUPERSEDED history');

  /* ---- Correction 8.1: same-signature supersession ----
   * A VERIFIED capability must be correctable through supersession
   * even when the correction does NOT change the capability
   * signature (typo fix, added evidence). The original build retired
   * the old record AFTER creating the successor, so the duplicate
   * guard rejected the still-active original — making this documented
   * workflow unreachable. Retire-first order fixes it; rollback
   * keeps the invariant: at most ONE active capability per signature. */
  var sameSig = SCA.repair.supersedeRepairCapability(RESEARCHER,
    rcV.record.id, { limitations: 'TEST FIXTURE: typo corrected' },
    'TEST FIXTURE: metadata-only correction of a VERIFIED capability');
  H.assert(sameSig.ok, 'same-signature supersession of a VERIFIED ' +
    'capability succeeds');
  H.assertEq(SCA.store.get('repair_capabilities', rcV.record.id).status,
    'SUPERSEDED', 'the verified original becomes SUPERSEDED');
  var oldSameSig = SCA.store.get('repair_capabilities', rcV.record.id);
  H.assertEq(oldSameSig.review_reason,
    'TEST FIXTURE: metadata-only correction of a VERIFIED capability',
    'the retirement records its explicit reason');
  H.assertEq(sameSig.record.status, 'PROPOSED',
    'same-signature successor starts at PROPOSED');
  H.assertEq(sameSig.record.supersedes_id, rcV.record.id,
    'same-signature successor records what it supersedes');
  H.assertEq(sameSig.record.competence_status, 'UNKNOWN',
    'successor inherits no competence');
  H.assertEq(sameSig.record.linked_assessment_id, null,
    'successor inherits no assessment link');
  H.assertEq(sameSig.record.linked_certification_id, null,
    'successor inherits no certification link');
  H.assertEq(sameSig.record.reviewer, null,
    'successor inherits no reviewer');
  H.assertEq(sameSig.record.version, '1',
    'successor starts a fresh history (version 1)');
  H.assertEq(sameSig.record.history.length, 0,
    'successor starts a fresh history (empty)');
  /* While the successor is active, an INDEPENDENT equivalent is
   * still refused — duplicate protection is not weakened. */
  var dupActive = SCA.repair.createRepairCapability(RESEARCHER,
    { workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
      asset_id: assetCap.id, diagnostic_capability: true });
  H.assert(!dupActive.ok && dupActive.errors.duplicate,
    'duplicate protection still prevents two independent active ' +
    'equivalent capabilities');
  /* Failed supersession rolls the original back exactly. */
  var rbTarget = SCA.repair.createRepairCapability(RESEARCHER,
    { workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
      asset_id: assetCap.id, repair_operations: ['rollback-op'],
      evidence_source_ids: [src.id] }).record;
  SCA.repair.documentRepairCapability(RESEARCHER, rbTarget.id);
  var rbVerified = SCA.repair.verifyRepairCapability(REVIEWER,
    rbTarget.id, 'TEST FIXTURE: verified for the rollback check');
  H.assert(rbVerified.ok, 'rollback fixture verified');
  var preRollback = JSON.parse(JSON.stringify(
    SCA.store.get('repair_capabilities', rbTarget.id)));
  /* updated_at is store-managed (stamped on every write), so it is
   * excluded; everything else must match exactly. */
  delete preRollback.updated_at;
  var rbFail = SCA.repair.supersedeRepairCapability(RESEARCHER,
    rbTarget.id, { repair_operations: [] },
    'TEST FIXTURE: invalid correction');
  H.assert(!rbFail.ok, 'an invalid successor is refused');
  var rbAfter = SCA.store.get('repair_capabilities', rbTarget.id);
  H.assertEq(rbAfter.status, 'VERIFIED',
    'the original is restored to VERIFIED after a failed supersession');
  var rbAfterCmp = JSON.parse(JSON.stringify(rbAfter));
  delete rbAfterCmp.updated_at;
  H.assertEq(JSON.stringify(rbAfterCmp), JSON.stringify(preRollback),
    'rollback restores the original exactly (status, version, ' +
    'history, review trail — except the store-managed updated_at)');
  var rbCount = SCA.store.all('repair_capabilities').filter(
    function (c) { return c.supersedes_id === rbTarget.id; }).length;
  H.assertEq(rbCount, 0, 'no orphan successor survives a failed ' +
    'supersession');

  /* Competence: Stage 5 authority. */
  var pract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Repair Master',
    capability_ids: [assetCap.id],
    practitioner_code: 'TEST-FIXTURE-RP-01'
  }).record;
  var apprentice = SCA.training.createApprentice(RESEARCHER, {
    public_name: 'TEST FIXTURE Apprentice',
    capability_id: assetCap.id,
    apprentice_code: 'TEST-FIXTURE-AP-01'
  }).record;
  var rcWithPract = SCA.repair.createRepairCapability(RESEARCHER, {
    workshop_id: wsA.record.id, practitioner_ids: [pract.id],
    asset_type: 'CAPABILITY', asset_id: assetCap.id,
    testing_capability: true, evidence_source_ids: [src.id]
  });
  H.assert(rcWithPract.ok, 'capability with a linked practitioner created');

  var compBad = SCA.repair.linkCompetenceAssessment(RESEARCHER,
    rcWithPract.record.id, 'no-such-assessment');
  H.assert(!compBad.ok, 'linking a nonexistent Stage 5 assessment rejected');

  var assessment = SCA.store.insert('competence_assessments', {
    practitioner_id: pract.id, capability_id: assetCap.id,
    assessor_id: pract.id, assessment_method: 'TEST FIXTURE',
    observed_result: 'COMPETENT', review_status: 'PENDING'
  }).record;
  var compPending = SCA.repair.linkCompetenceAssessment(RESEARCHER,
    rcWithPract.record.id, assessment.id);
  H.assert(!compPending.ok && compPending.errors.assessment_id,
    'only an ACCEPTED Stage 5 assessment may be linked');

  SCA.store.update('competence_assessments', assessment.id,
    Object.assign({}, assessment, { review_status: 'ACCEPTED' }));
  var compOk = SCA.repair.linkCompetenceAssessment(RESEARCHER,
    rcWithPract.record.id, assessment.id);
  H.assert(compOk.ok, 'an accepted Stage 5 assessment links competence');
  H.assertEq(SCA.store.get('repair_capabilities', rcWithPract.record.id)
    .competence_status, 'ASSESSED',
    'competence ASSESSED only through a Stage 5 record');
  H.assert(compOk.record.linked_assessment_id === assessment.id,
    'the assessment link is recorded');

  /* ---------- Spare parts ---------- */
  var spDenied = SCA.repair.createSparePart(ANON,
    { name: 'TEST FIXTURE Denied' });
  H.assert(!spDenied.ok, 'anonymous spare-part creation denied');

  /* Locally stocked. */
  var spLocal = SCA.repair.createSparePart(RESEARCHER, {
    name: 'TEST FIXTURE Seal Kit', manufacturer: 'TEST FIXTURE PumpCo',
    manufacturer_part_number: 'TP100-SK', asset_type: 'CAPABILITY',
    asset_ids: [assetCap.id], local_stock: '4 kits (TEST FIXTURE)',
    availability_status: 'IN_STOCK'
  });
  H.assert(spLocal.ok, 'locally stocked spare part created');
  H.assertEq(spLocal.record.compatibility_status, 'UNKNOWN',
    'a new part starts UNKNOWN compatibility — availability is not ' +
    'compatibility (Principle 5)');

  /* Import-only. */
  var spImport = SCA.repair.createSparePart(TECH, {
    name: 'TEST FIXTURE Impeller', manufacturer: 'TEST FIXTURE PumpCo',
    manufacturer_part_number: 'TP100-IMP',
    availability_status: 'IMPORT_ONLY',
    import_sources: 'TEST FIXTURE supplier abroad'
  });

  /* Fabrication possible. */
  var spFab = SCA.repair.createSparePart(RESEARCHER, {
    name: 'TEST FIXTURE Gasket', manufacturer: 'TEST FIXTURE Generic',
    manufacturer_part_number: 'GSK-40',
    fabrication_possible: 'REPORTED_POSSIBLE',
    fabrication_specification: 'TEST FIXTURE: cut from sheet stock',
    substitute_material_ids: []
  });

  var spDup = SCA.repair.createSparePart(RESEARCHER, {
    name: 'TEST FIXTURE Seal Kit duplicate',
    manufacturer: 'TEST FIXTURE PumpCo',
    manufacturer_part_number: 'TP100-SK'
  });
  H.assert(!spDup.ok && spDup.errors.duplicate,
    'duplicate manufacturer part number rejected');

  /* Compatibility lifecycle: REPORTED -> DOCUMENTED (evidence) ->
   * TESTED (fitment) -> VERIFIED (reviewer). Never automatic. */
  var cReportDenied = SCA.repair.verifyCompatibility(RESEARCHER,
    spLocal.record.id, 'self verify');
  H.assert(!cReportDenied.ok && cReportDenied.errors.permission,
    'entry staff cannot verify compatibility');
  var cDocNoEvidence = SCA.repair.documentCompatibility(RESEARCHER,
    spImport.record.id, 'looks the same');
  H.assert(!cDocNoEvidence.ok,
    'documented compatibility requires evidence — similarity is not ' +
    'compatibility (Principle 6)');

  SCA.repair.reportCompatibility(RESEARCHER, spLocal.record.id,
    'TEST FIXTURE: reported to fit TP-100');
  SCA.repair.updateSparePart(RESEARCHER, spLocal.record.id,
    { source_ids: [src.id] });
  SCA.repair.documentCompatibility(RESEARCHER, spLocal.record.id,
    'TEST FIXTURE: specification matches drawing');
  SCA.repair.testCompatibility(RESEARCHER, spLocal.record.id,
    'TEST FIXTURE: fitment tested on a TP-100, passed');
  var cVerified = SCA.repair.verifyCompatibility(REVIEWER,
    spLocal.record.id, 'TEST FIXTURE: test witnessed by reviewer');
  H.assert(cVerified.ok, 'compatibility VERIFIED through review');
  H.assertEq(cVerified.record.compatibility_status, 'VERIFIED',
    'verified compatibility state');
  H.assert(!!cVerified.record.last_verified,
    'verification stamps last_verified');

  /* Rejected compatibility documents known incompatibility. */
  SCA.repair.reportCompatibility(RESEARCHER, spFab.record.id, 'reported');
  var cRejected = SCA.repair.rejectCompatibility(REVIEWER,
    spFab.record.id, 'TEST FIXTURE: bore mismatch documented');
  H.assert(cRejected.ok, 'reviewer can document a known incompatibility');
  H.assertEq(SCA.store.get('spare_parts', spFab.record.id)
    .compatibility_status, 'REJECTED',
    'REJECTED is a finding, not missing data');

  /* Invalid transitions rejected. */
  var cSkip = SCA.repair.transitionCompatibility(REVIEWER,
    spImport.record.id, 'VERIFIED', { reason: 'skip' });
  H.assert(!cSkip.ok && cSkip.errors.compatibility_status,
    'compatibility cannot skip lifecycle stages');

  /* ---------- Failure scenarios ---------- */
  var fsDenied = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Bad Category', failure_category: 'MYSTERY'
  });
  H.assert(!fsDenied.ok,
    'free-text categories cannot replace the controlled taxonomy');

  var fsMech = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Seal degradation', failure_category: 'WEAR',
    asset_type: 'CAPABILITY', asset_ids: [assetCap.id],
    symptoms: ['reduced pressure'], diagnostic_methods: ['visual check'],
    possible_causes: ['abrasive medium'],
    known_part_requirements: [spLocal.record.id],
    source_ids: [src.id]
  });
  H.assert(fsMech.ok, 'mechanical failure scenario created');
  var fsElec = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Motor burnout', failure_category: 'ELECTRICAL',
    asset_type: 'CAPABILITY', asset_ids: [assetCap.id],
    source_ids: [src.id]
  });
  var fsEnv = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Flooding damage',
    failure_category: 'ENVIRONMENTAL',
    asset_type: 'CAPABILITY', asset_ids: [assetCap.id],
    source_ids: [src.id]
  });
  var fsUnknown = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Unexplained stop', failure_category: 'UNKNOWN',
    asset_type: 'CAPABILITY', asset_ids: [assetCap.id],
    source_ids: [src.id]
  });
  H.assert(fsUnknown.ok, 'UNKNOWN is a valid documented category');

  /* ---------- Repair records ---------- */
  var rrDenied = SCA.repair.createRepairRecord(ANON, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id, date: '2026-01-01'
  });
  H.assert(!rrDenied.ok, 'anonymous repair-record creation denied');

  var rrBad = SCA.repair.createRepairRecord(RESEARCHER, {
    asset_type: 'CAPABILITY', asset_id: 'no-such-asset',
    date: '2026-01-01'
  });
  H.assert(!rrBad.ok, 'repair record for a nonexistent asset rejected');

  /* Accepted repair with substitute + apprentice participation. */
  var rrMain = SCA.repair.createRepairRecord(RESEARCHER, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id, date: '2026-01-10',
    failure_type: 'WEAR', failure_scenario_id: fsMech.record.id,
    symptoms: 'pressure drop', diagnosis: 'worn seal',
    root_cause: 'abrasive medium',
    repair_action: 'TEST FIXTURE: replaced seal with local substitute',
    workshop_id: wsA.record.id, technician_ids: [pract.id],
    parts_used: [spLocal.record.id],
    substitutes_used: [spFab.record.id],
    local_substitute: true, test_result: 'pressure restored',
    return_to_service: true, lesson: 'substitute seals work if cut well',
    apprentice_ids: [apprentice.id],
    source_ids: [src.id]
  });
  H.assert(rrMain.ok, 'accepted repair record created (DRAFT)');
  H.assertEq(rrMain.record.review_status, 'DRAFT',
    'a new repair record is a DRAFT');

  /* Fabrication repair. */
  var rrFab = SCA.repair.createRepairRecord(TECH, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id, date: '2026-02-01',
    failure_type: 'WEAR', fabrication_used: true,
    repair_action: 'TEST FIXTURE: fabricated a gasket locally',
    workshop_id: wsA.record.id, source_ids: [src.id]
  });

  /* Repair to be rejected in review. */
  var rrReject = SCA.repair.createRepairRecord(RESEARCHER, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id, date: '2026-03-01',
    failure_type: 'ELECTRICAL', source_ids: [src.id]
  });

  /* Review lifecycle with authority separation. */
  var rrAcceptDenied = SCA.repair.acceptRepairRecord(RESEARCHER,
    rrMain.record.id, 'self accept');
  H.assert(!rrAcceptDenied.ok && rrAcceptDenied.errors.permission,
    'entry staff cannot accept a repair record');
  var rrEarlyAccept = SCA.repair.acceptRepairRecord(REVIEWER,
    rrMain.record.id, 'too early');
  H.assert(!rrEarlyAccept.ok,
    'a DRAFT record cannot be accepted directly (staged review)');

  H.assert(SCA.repair.submitRepairRecord(RESEARCHER, rrMain.record.id).ok,
    'creator submits the record');
  var rrSubmitEdit = SCA.repair.updateRepairRecord(RESEARCHER,
    rrMain.record.id, { symptoms: 'edited after submit' });
  H.assert(!rrSubmitEdit.ok,
    'a submitted record is history: DRAFT-only editing');
  H.assert(SCA.repair.startRepairReview(REVIEWER, rrMain.record.id).ok,
    'reviewer starts the review');
  var rrNoReason = SCA.repair.acceptRepairRecord(REVIEWER,
    rrMain.record.id, '');
  H.assert(!rrNoReason.ok && rrNoReason.errors.reason,
    'acceptance without an explicit reason rejected');
  var rrAccepted = SCA.repair.acceptRepairRecord(REVIEWER,
    rrMain.record.id, 'TEST FIXTURE: documentation reviewed on site');
  H.assert(rrAccepted.ok, 'reviewer accepts the record');
  H.assertEq(rrAccepted.record.review_status, 'ACCEPTED',
    'ACCEPTED means reviewed as documentation');

  /* Rejected review path. */
  SCA.repair.submitRepairRecord(RESEARCHER, rrReject.record.id);
  var rrRejected = SCA.repair.rejectRepairRecord(REVIEWER,
    rrReject.record.id, 'TEST FIXTURE: insufficient documentation');
  H.assert(rrRejected.ok, 'reviewer can reject a submitted record');

  /* Archive is the historical end-state. */
  var rrArchived = SCA.repair.archiveRepairRecord(RESEARCHER,
    rrReject.record.id);
  H.assert(rrArchived.ok, 'rejected record archived as history');

  /* Lesson capture: explicit, through Stage 3, reviewer-gated. */
  var lessonDenied = SCA.repair.recordLesson(RESEARCHER,
    rrMain.record.id, { title: 'TEST FIXTURE lesson' });
  H.assert(!lessonDenied.ok && lessonDenied.errors.permission,
    'a researcher cannot capture a lesson');
  var lessonDraft = SCA.repair.recordLesson(REVIEWER,
    rrFab.record.id, { title: 'TEST FIXTURE premature' });
  H.assert(!lessonDraft.ok,
    'lessons are captured only on ACCEPTED records');

  var lesson = SCA.repair.recordLesson(REVIEWER, rrMain.record.id, {
    title: 'TEST FIXTURE: seal substitution procedure',
    artifact_type: 'FIELD_NOTE',
    capability_ids: [assetCap.id]
  });
  H.assert(lesson.ok, 'reviewer captures the lesson as a knowledge artifact');
  H.assertEq(SCA.store.get('repair_records', rrMain.record.id)
    .knowledge_artifact_id, lesson.artifact.id,
    'the record links its knowledge artifact');

  /* A repair record never upgrades capability evidence by itself. */
  H.assertEq(SCA.store.get('capabilities', assetCap.id).evidence_level,
    'E0', 'repair history never upgrades capability evidence (E0 stays)');
  H.assert(SCA.util.isBlank(
    SCA.store.get('capabilities', assetCap.id).capability_maturity),
    'repair history never invents maturity');

  /* ---------- Pathways ---------- */
  var pw = SCA.repair.repairPathway(ANON, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id
  });
  H.assert(pw.ok, 'repair pathway inspects the asset');
  var pwSteps = {};
  pw.steps.forEach(function (st) { pwSteps[st.step] = st; });
  H.assertEq(pwSteps.failure.status, 'DOCUMENTED',
    'documented failure scenarios appear in the pathway');
  H.assertEq(pwSteps.repair_capability.status, 'DOCUMENTED',
    'documented repair capabilities appear in the pathway');
  H.assert(pwSteps.practitioner_workshop.detail.practitioners_visible ===
    false, 'person identities are not exposed to anonymous pathway users');
  H.assert(pw.steps.length === 11,
    'the pathway walks all eleven documented stages');
  H.assert(pw.scope_note.indexOf('documented dataset') !== -1,
    'pathway reports carry the scope note');

  var pwUnknown = SCA.repair.repairPathway(ANON, {
    asset_type: 'CAPABILITY', asset_id: assetCap2.id
  });
  var unknownSteps = pwUnknown.steps.filter(function (st) {
    return st.status === 'UNKNOWN';
  }).length;
  H.assert(pwUnknown.ok && unknownSteps > 0,
    'an undocumented asset reports UNKNOWN links — never assumptions');

  var pwBad = SCA.repair.repairPathway(ANON, {
    asset_type: 'CAPABILITY', asset_id: 'no-such-asset'
  });
  H.assert(!pwBad.ok, 'pathway inspection validates the asset');

  /* Spare-part pathway. */
  var pp = SCA.repair.sparePartPathway(ANON, spLocal.record.id);
  H.assert(pp.ok, 'spare-part pathway inspects the part');
  H.assertEq(pp.local_stock.status, 'DOCUMENTED',
    'documented local stock reported');
  H.assertEq(pp.verification_state.value, 'VERIFIED',
    'verified compatibility reported');
  var ppMissing = SCA.repair.sparePartPathway(ANON, spFab.record.id);
  H.assertEq(ppMissing.local_stock.status, 'UNKNOWN',
    'missing stock is UNKNOWN — never zero or "unavailable"');
  H.assert(pp.local_fabrication && pp.local_fabrication.steps.length === 7,
    'the fabrication pathway is embedded, decomposed into 7 steps');

  /* Fabrication pathway: decomposed, never one boolean. */
  var fp = SCA.repair.fabricationPathway(ANON, spFab.record.id);
  H.assert(fp.ok, 'fabrication pathway inspects the part');
  var fpSteps = {};
  fp.steps.forEach(function (st) { fpSteps[st.step] = st; });
  H.assertEq(fpSteps.fabrication_possible.status, 'REPORTED',
    'reported-possible fabrication is honest about its evidence level');
  H.assert(fp.steps.length === 7,
    'fabrication decomposes into its 7 evidence steps');
  var hasBoolean = JSON.stringify(fp).indexOf('locally manufacturable') !== -1;
  H.assert(!hasBoolean,
    'the fabrication pathway is never reduced to one boolean');

  /* ---------- Repair radius ---------- */
  var radius = SCA.repair.repairRadius(ANON, {
    asset_type: 'CAPABILITY', asset_id: assetCap.id
  });
  H.assert(radius.ok, 'repair radius inspects the asset');
  H.assertEq(radius.nearest_workshop.status, 'DOCUMENTED',
    'nearest documented workshop reported');
  H.assert(radius.nearest_workshop.results.length > 0 &&
    radius.nearest_workshop.results[0].contact_details === null,
    'public radius results carry no private contact details');
  H.assertEq(radius.nearest_technician.status, 'UNKNOWN',
    'technician identities are not public');
  var radiusNote = radius.scope_note.indexOf('current surveyed dataset');
  H.assert(radiusNote !== -1,
    'radius results are labeled with dataset scope');

  /* ---------- Geographic overview (descriptive only) ---------- */
  var ov = SCA.repair.geographicOverview(ANON);
  H.assert(ov.ok, 'geographic overview computes');
  H.assert(ov.documented_repair_capabilities >= 3,
    'documented capabilities counted');
  H.assert(typeof ov.resilience_score === 'undefined' &&
    typeof ov.ranking === 'undefined',
    'no resilience scores or rankings are calculated (later stage)');

  /* ---------- Search (deterministic, unranked) ---------- */
  var wsHits = SCA.repair.searchWorkshops(ANON, { query: 'alpha' });
  H.assertEq(wsHits.length, 1,
    'workshop search filters deterministically');
  var wsSorted = SCA.repair.searchWorkshops(ANON, {});
  H.assert(wsSorted.length >= 1, 'workshop search lists documented data');
  var capHits = SCA.repair.searchRepairCapabilities(ANON,
    { asset_type: 'CAPABILITY', asset_id: assetCap.id });
  H.assert(capHits.length >= 3, 'capability search filters by asset');
  H.assert(capHits.every(function (c) {
    return c.practitioner_ids.length === 0;
  }), 'public capability search hides practitioner identities');
  var partHits = SCA.repair.searchSpareParts(ANON,
    { compatibility_status: 'VERIFIED' });
  H.assertEq(partHits.length, 1,
    'spare-part search filters by compatibility state');
  var recHitsAnon = SCA.repair.searchRepairRecords(ANON, {});
  H.assertEq(recHitsAnon.length, 0,
    'anonymous users see no repair records (safety)');
  var recHitsRev = SCA.repair.searchRepairRecords(REVIEWER, {});
  H.assertEq(recHitsRev.length, 3, 'reviewers see the repair records');

  /* ---------- Privacy ---------- */
  var anonView = SCA.repair.publicWorkshop(ANON,
    SCA.store.get('workshops', wsA.record.id));
  H.assertEq(anonView.contact_details, null,
    'public workshop views strip private contact details');
  var hidden = SCA.repair.createWorkshop(RESEARCHER, {
    name: 'TEST FIXTURE Hidden Workshop', public_visibility: false
  });
  H.assert(SCA.repair.publicWorkshop(ANON,
    SCA.store.get('workshops', hidden.record.id)) === null,
    'a workshop marked non-public is invisible to anonymous users');
  var recAnon = SCA.repair.publicRepairRecord(ANON,
    SCA.store.get('repair_records', rrMain.record.id));
  H.assert(recAnon === null,
    'repair records are null for anonymous users (not partially leaked)');
  var recStaff = SCA.repair.publicRepairRecord(REVIEWER,
    SCA.store.get('repair_records', rrMain.record.id));
  H.assertEq(recStaff.apprentice_ids.length, 1,
    'staff with person visibility resolve protected references');

  /* ---------- Graph integration ---------- */
  /* Repair semantics live in the frozen Stage 7 graph — no second
   * relationship engine. The REPAIRS/MAINTAINS/RECOVERED_BY/
   * FALLS_BACK_TO/TEACHES vocabulary covers them. */
  var gRepair = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'REPAIRS', source_type: 'WORKSHOP',
    source_id: wsA.record.id, target_type: 'CAPABILITY',
    target_id: assetCap.id,
    source_ids: [src.id],
    provenance: 'TEST FIXTURE: repair relationship'
  });
  H.assert(gRepair.ok, 'REPAIRS edge created through the Stage 7 graph');
  var gMaint = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'MAINTAINS', source_type: 'PRACTITIONER',
    source_id: pract.id, target_type: 'CAPABILITY',
    target_id: assetCap.id, source_ids: [src.id],
    provenance: 'TEST FIXTURE: maintenance relationship'
  });
  H.assert(gMaint.ok, 'MAINTAINS edge created');
  var gRecover = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'RECOVERED_BY', source_type: 'CAPABILITY',
    source_id: assetCap.id, target_type: 'WORKSHOP',
    target_id: wsA.record.id, source_ids: [src.id],
    provenance: 'TEST FIXTURE: recovery relationship'
  });
  H.assert(gRecover.ok, 'RECOVERED_BY edge created');
  var gFallback = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'FALLS_BACK_TO', source_type: 'CAPABILITY',
    source_id: assetCap.id, target_type: 'CAPABILITY',
    target_id: assetCap2.id, source_ids: [src.id],
    provenance: 'TEST FIXTURE: fallback relationship'
  });
  H.assert(gFallback.ok, 'FALLS_BACK_TO edge created');
  var gTeach = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'TEACHES', source_type: 'PRACTITIONER',
    source_id: pract.id, target_type: 'CAPABILITY',
    target_id: assetCap.id, source_ids: [src.id],
    provenance: 'TEST FIXTURE: training relationship'
  });
  H.assert(gTeach.ok, 'TEACHES edge created');
  /* No new relationship type was added for Stage 8. */
  H.assertEq(Object.keys(SCA.graphRegistry.RELATIONSHIPS).length, 19,
    'the Stage 7 relationship vocabulary is unchanged (19 types)');
  /* Spare-part compatibility is NOT a graph relationship. */
  H.assert(!SCA.graphRegistry.RELATIONSHIPS['COMPATIBLE_WITH'],
    'no COMPATIBLE_WITH relationship was invented for parts');

  /* ---------- Integrity checker ---------- */
  var ig = SCA.repair.integrity();
  H.assert(ig.ok, 'integrity passes on the fixture dataset (' +
    JSON.stringify(ig.errors) + ')');

  /* Orphan repair capability. */
  var orphanCap = SCA.store.insert('repair_capabilities', {
    workshop_id: 'ghost-workshop', asset_type: 'CAPABILITY',
    asset_id: 'ghost-asset', repair_operations: ['orphan'],
    status: 'PROPOSED'
  });
  var ig2 = SCA.repair.integrity();
  H.assert(!ig2.ok && ig2.errors.some(function (e) {
    return e.kind === 'repair_capability' && e.field === 'workshop_id';
  }), 'orphan repair capability detected');
  H.assert(ig2.errors.some(function (e) {
    return e.kind === 'repair_capability' && e.field === 'asset_id';
  }), 'broken asset reference detected');

  /* Duplicate spare part. */
  var dupPart = SCA.store.insert('spare_parts', {
    name: 'TEST FIXTURE Duplicate Part',
    manufacturer: 'TEST FIXTURE PumpCo',
    manufacturer_part_number: 'TP100-SK'
  });
  var ig3 = SCA.repair.integrity();
  H.assert(ig3.errors.some(function (e) {
    return e.kind === 'spare_part' && e.field === 'manufacturer_part_number';
  }), 'duplicate manufacturer part number detected');

  /* Unauthorized certification structure. */
  var fakeComp = SCA.store.insert('repair_capabilities', {
    workshop_id: wsA.record.id, asset_type: 'CAPABILITY',
    asset_id: assetCap.id, repair_operations: ['fake'],
    status: 'PROPOSED', competence_status: 'VERIFIED'
  });
  var ig4 = SCA.repair.integrity();
  H.assert(ig4.errors.some(function (e) {
    return e.kind === 'repair_capability' &&
      e.field === 'linked_certification_id';
  }), 'self-declared VERIFIED competence detected (no Stage 5 link)');

  /* Retired history keeps intentionally broken references. */
  SCA.store.update('repair_capabilities', orphanCap.record.id,
    Object.assign({}, orphanCap.record, { status: 'REJECTED' }));
  var ig5 = SCA.repair.integrity();
  var orphanStillErr = ig5.errors.some(function (e) {
    return e.id === orphanCap.record.id && e.field === 'workshop_id';
  });
  var orphanWarned = ig5.historical_warnings.some(function (w) {
    return w.id === orphanCap.record.id && w.field === 'workshop_id';
  });
  H.assert(!orphanStillErr && orphanWarned,
    'retired corruption is preserved history, flagged as warning — ' +
    'never silently deleted');

  /* ---------- inventory protection (before the partial-import
   * checks, which replace covered collections by design) ---------- */
  /* The 240 seeded capabilities plus exactly ONE test asset fixture
   * (created above) — nothing else was touched. */
  H.assertEq(SCA.store.count('capabilities'), 241,
    '240 capabilities + 1 fixture, nothing else');
  var seededCaps = SCA.store.all('capabilities').filter(function (c) {
    return c.id !== assetCap.id;
  });
  H.assert(seededCaps.length === 240 &&
    seededCaps.every(function (c) {
      return c.code && c.name && c.family_id;
    }),
    'inventory codes, names and families intact');
  var e0count = seededCaps.filter(function (c) {
    return c.evidence_level === 'E0';
  }).length;
  H.assert(e0count > 200,
    'E0 baseline preserved (no fabricated evidence levels)');

  /* ---------- Import/export ----------
   * A partial import REPLACES the collections it covers (Stage 2.1
   * semantic, unchanged): a repair-capabilities-only export is
   * standalone-importable on a fresh device. This section therefore
   * runs on a rebuilt minimal fixture set after each partial import. */
  var capExport = SCA.transfer.exportCollection('repair_capabilities');
  var capPkg = JSON.parse(capExport);
  H.assert(capPkg.referenced && capPkg.referenced.workshops &&
    capPkg.referenced.workshops.length >= 1,
    'a repair-capability export carries its workshops (standalone)');
  H.assert(capPkg.referenced.capabilities &&
    capPkg.referenced.capabilities.length >= 1,
    'a repair-capability export carries its asset capabilities');
  var reimport = SCA.transfer.importBundle(capExport);
  H.assert(reimport.ok,
    'repair-capability export reimports atomically');
  H.assert(reimport.counts.repair_capabilities >= 1,
    'the reimport contains the repair capabilities');

  /* ---- Correction 8.1: workshop import validation decision ----
   * Stage 8 fills the workshops REFERENCES spec in transfer.js that
   * Stage 7 left empty. This is an INTENTIONAL Stage 8 extension:
   * Stage 7 workshops were placeholder registry records with zero
   * production data, so the empty spec never fired on a real bundle.
   * Now that workshops are operational repair anchors, an ACTIVE
   * workshop in an imported bundle must resolve its references, and
   * retired workshops (INACTIVE/CLOSED) receive the frozen
   * retired-history exemption. Both directions are pinned here. */
  var wsExport = SCA.transfer.exportCollection('workshops');
  var wsPkgBad = JSON.parse(wsExport);
  wsPkgBad.records.push(Object.assign({},
    wsPkgBad.records[0] || { name: 'TEST FIXTURE' },
    { id: 'test-fixture-ws-broken-ref', name:
      'TEST FIXTURE Workshop Broken Ref', status: 'REPORTED',
      organization_id: 'nonexistent-organization' }));
  var wsImportBad = SCA.transfer.importBundle(
    JSON.stringify(wsPkgBad));
  H.assert(!wsImportBad.ok &&
    JSON.stringify(wsImportBad).indexOf('organizations') !== -1,
    'an ACTIVE workshop with a dangling organization reference is ' +
    'rejected at import (Stage 8 extension of the empty Stage 7 ' +
    'spec)');
  H.assertEq(SCA.store.all('workshops').filter(function (w) {
    return w.id === 'test-fixture-ws-broken-ref';
  }).length, 0, 'the rejected bundle mutated nothing (atomic)');
  var wsPkgRetired = JSON.parse(wsExport);
  wsPkgRetired.records.push(Object.assign({},
    wsPkgRetired.records[0] || { name: 'TEST FIXTURE' },
    { id: 'test-fixture-ws-retired', name:
      'TEST FIXTURE Workshop Retired History', status: 'CLOSED',
      organization_id: 'nonexistent-organization' }));
  var wsImportRetired = SCA.transfer.importBundle(
    JSON.stringify(wsPkgRetired));
  H.assert(wsImportRetired.ok,
    'a CLOSED workshop keeps its broken references at import ' +
    '(retired-history exemption)');
  H.assert(SCA.store.get('workshops', 'test-fixture-ws-retired') &&
    SCA.store.get('workshops', 'test-fixture-ws-retired').status ===
    'CLOSED', 'the retired workshop is preserved as history');

  /* Rebuild a minimal repair fixture set for the record-level checks
   * (the partial import above replaced the covered collections, as
   * designed). */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240,
    'baseline restored after the partial-import check');
  var xFam = SCA.store.all('families')[0];
  var xCap = SCA.store.insert('capabilities', {
    name: 'TEST FIXTURE Capability Pump X', code: 'TEST-WATER-PUMP-X',
    family_id: xFam.id, evidence_level: 'E0', living_status: 'S0'
  }).record;
  var xSrc = SCA.store.insert('evidence', {
    title: 'TEST FIXTURE Source X', source_type: 'FIELD_REPORT',
    verification_status: 'UNREVIEWED'
  }).record;
  var xWs = SCA.repair.createWorkshop(RESEARCHER, {
    name: 'TEST FIXTURE Workshop X', source_ids: [xSrc.id]
  }).record;
  var xRec = SCA.repair.createRepairRecord(RESEARCHER, {
    asset_type: 'CAPABILITY', asset_id: xCap.id, date: '2026-05-01',
    failure_type: 'WEAR', workshop_id: xWs.id, source_ids: [xSrc.id]
  }).record;
  SCA.repair.submitRepairRecord(RESEARCHER, xRec.id);
  SCA.repair.rejectRepairRecord(REVIEWER, xRec.id,
    'TEST FIXTURE: rejected for the import test');
  SCA.repair.archiveRepairRecord(RESEARCHER, xRec.id);

  var badPkg = JSON.parse(SCA.transfer.exportCollection('repair_records'));
  H.assert(badPkg.records.length >= 1, 'record export carries the record');
  badPkg.records[0].workshop_id = 'ghost-workshop';
  badPkg.records[0].review_status = 'DRAFT';
  var badImport = SCA.transfer.importBundle(JSON.stringify(badPkg));
  H.assert(!badImport.ok,
    'import with a broken active reference rejected atomically');

  var retiredPkg = JSON.parse(
    SCA.transfer.exportCollection('repair_records'));
  retiredPkg.records.forEach(function (r) {
    if (r.review_status === 'REJECTED' || r.review_status === 'ARCHIVED') {
      r.workshop_id = 'intentionally-retired-broken';
    }
  });
  var retiredImport = SCA.transfer.importBundle(
    JSON.stringify(retiredPkg));
  H.assert(retiredImport.ok,
    'retired history keeps broken references under the Stage 7 rule');

  /* ---------- teardown: restore pristine Stage 1-7 baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240,
    'teardown restores the 240 inventory');
  ['workshops', 'repair_capabilities', 'spare_parts', 'repair_records',
    'failure_scenarios', 'materials', 'tools', 'graph_edges',
    'audit_log', 'knowledge', 'evidence', 'practitioners', 'apprentices',
    'competence_assessments', 'capability_certifications',
    'training_programs', 'organizations']
    .forEach(function (coll) {
      H.assertEq(SCA.store.count(coll), 0,
        'every Stage 8 fixture removed: ' + coll);
    });
  H.assertEq(SCA.store.count('families'), 12,
    'the 12 families remain');
  H.assertEq(SCA.store.count('repair_capabilities'), 0,
    'zero fabricated production repair capabilities');
  H.assertEq(SCA.store.count('spare_parts'), 0,
    'zero fabricated production spare parts');
  H.assertEq(SCA.store.count('repair_records'), 0,
    'zero fabricated production repair records');

  console.log('    repair network suite complete — fixtures removed, ' +
    'baseline restored');
};
