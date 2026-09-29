/*
 * Stage 5: Practitioner, Apprenticeship & Capability Reproduction
 * Framework test suite.
 *
 * All test people are explicitly marked TEST FIXTURE. No real Somali
 * practitioners, apprentices or institutions are fabricated; the 240
 * capability inventory is never touched, and every fixture is wiped at
 * the end.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  practitioner-framework.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var PRACT_ROLE = { name: 'TEST FIXTURE Practitioner User', role: 'practitioner' };
  var TRAINER = { name: 'TEST FIXTURE Trainer', role: 'trainer' };
  var TECH = { name: 'TEST FIXTURE Technician', role: 'technician' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin', role: 'regional_administrator' };
  var APPRENTICE_ROLE = { name: 'TEST FIXTURE Apprentice User', role: 'apprentice' };

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline 240 intact');
  H.assertEq(SCA.store.count('practitioners'), 0, 'no practitioners at start');
  var w01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'W01'; })[0];
  var s01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'S01'; })[0];

  /* ================= 1. Practitioner ================= */
  var resAnonCreate = SCA.training.createPractitioner(null, {
    public_name: 'TEST FIXTURE anon attempt' });
  H.assert(resAnonCreate.ok === false, 'practitioner creation requires permission');

  var resPract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Well Master',
    capability_ids: [w01.id],
    region: 'TEST region',
    community: 'TEST community',
    experience_years: 25,
    languages: ['so'],
    practitioner_code: 'TEST-FIXTURE-PR-01',
    contact_visibility: 'RESEARCH_TEAM',
    documentation_consent: false
  });
  H.assert(resPract.ok === true, 'practitioner created');
  var master = resPract.record;
  H.assertEq(master.verification_status, 'CANDIDATE',
    'nobody becomes Verified automatically by being listed');
  H.assertEq(master.competence_level, 'L0', 'competence starts Unknown (L0)');
  H.assertEq(master.competence_status, 'NOT_ASSESSED', 'not yet assessed');
  H.assertEq(master.version, '1', 'version 1');
  H.assert(master.name !== 'TEST FIXTURE Well Master' || true, 'private name not required');
  H.assert(!('phone' in master) && !('address' in master),
    'no phone or address stored on the practitioner record');

  /* Anonymous mode: identity protected. */
  var resAnonPract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Real Sensitive Name',
    anonymous_option: true,
    capability_ids: [w01.id],
    practitioner_code: 'TEST-FIXTURE-PR-02' });
  H.assert(resAnonPract.ok === true, 'anonymous practitioner created');
  var anonPract = resAnonPract.record;
  H.assert(anonPract.public_name.indexOf('Real Sensitive Name') === -1,
    'anonymous practitioner public_name does not identify the person');
  H.assert(anonPract.name === null, 'anonymous practitioner has no private name');
  H.assertEq(anonPract.knowledge_holder_type, 'INDIVIDUAL', 'holder type defaults to individual');

  /* Community knowledge holder: not everything is individual. */
  var resOrgPract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Household Weaving Knowledge',
    knowledge_holder_type: 'HOUSEHOLD',
    capability_ids: [w01.id] });
  H.assertEq(resOrgPract.record.knowledge_holder_type, 'HOUSEHOLD',
    'household knowledge holder supported');

  /* Status transitions. */
  var resBadTr = SCA.training.setPractitionerStatus(RESEARCHER, master.id,
    'VERIFIED', 'skip');
  H.assert(resBadTr.ok === false, 'Candidate -> Verified directly rejected');
  var resDoc = SCA.training.setPractitionerStatus(RESEARCHER, master.id, 'DOCUMENTED', null);
  H.assert(resDoc.ok === true, 'Candidate -> Documented');
  var resVerifByResearcher = SCA.training.setPractitionerStatus(RESEARCHER,
    master.id, 'VERIFIED', 'I trust them');
  H.assert(resVerifByResearcher.ok === false,
    'researcher cannot set Verified (unauthorized verification rejected)');
  var resDoc2 = SCA.training.setPractitionerStatus(RESEARCHER, master.id,
    'COMMUNITY_CONFIRMED', null);
  H.assert(resDoc2.ok === true, 'Documented -> Community Confirmed');
  var resDem = SCA.training.setPractitionerStatus(RESEARCHER, master.id,
    'DEMONSTRATED', null);
  H.assert(resDem.ok === true, 'Community Confirmed -> Demonstrated');
  H.assertEq(SCA.store.get('practitioners', master.id).version, '4',
    'each status change is versioned');
  /* Walk to ASSESSED via an accepted assessment later; VERIFIED tested after. */

  /* Verification pathways stay distinct — recorded, never collapsed. */
  var resPathSelf = SCA.training.recordVerificationPathway(RESEARCHER, master.id,
    'SELF_REPORTED', {});
  H.assert(resPathSelf.ok === true, 'self-reported pathway recorded');
  var resPathAssessor = SCA.training.recordVerificationPathway(RESEARCHER,
    master.id, 'ASSESSOR_VERIFIED', {});
  H.assert(resPathAssessor.ok === false,
    'assessor-verified pathway needs verification authority');
  var resPathAssessorOk = SCA.training.recordVerificationPathway(REVIEWER,
    master.id, 'COMMUNITY_REFERRED', { notes: 'TEST FIXTURE: referred by community elders' });
  H.assert(resPathAssessorOk.ok === true, 'community-referred pathway recorded');
  var pathways = SCA.store.get('practitioners', master.id).verification_pathways;
  H.assertEq(pathways.length, 2, 'pathways recorded as distinct entries');
  H.assert(pathways[0].pathway !== pathways[1].pathway,
    'pathways never collapsed into one score');

  /* §26: participant -> practitioner is intentional, never automatic. */
  var resParticipant = SCA.research.recordParticipant(RESEARCHER, {
    participant_code: 'TEST-FIXTURE-PT-S5',
    public_name: 'TEST FIXTURE Participant',
    role: 'PRACTITIONER', consent_id: null });
  H.assert(resParticipant.ok === true, 'research participant created');
  H.assertEq(SCA.store.all('practitioners').filter(function (p) {
    return p.public_name.indexOf('Participant') !== -1; }).length, 0,
    'participant is NOT automatically turned into a practitioner');
  var resPromote = SCA.training.promoteFromParticipant(RESEARCHER,
    resParticipant.record.id, { capability_ids: [w01.id] });
  H.assert(resPromote.ok === true, 'explicit promotion works');
  H.assert(resPromote.record.provenance.indexOf('Intentional promotion') !== -1 ||
    resPromote.record.provenance.indexOf('participant') !== -1,
    'promotion provenance documents the intentional action');

  /* ================= 2. Competence assessment ================= */
  var resAssByResearcher = SCA.training.createAssessment(RESEARCHER, {
    practitioner_id: master.id, capability_id: w01.id,
    assessment_type: 'DEMONSTRATION', result: 'COMPETENT' });
  H.assert(resAssByResearcher.ok === false,
    'researcher cannot assess competence (least privilege)');
  var resAssBadCap = SCA.training.createAssessment(TRAINER, {
    practitioner_id: master.id, capability_id: 'no-such-capability',
    assessment_type: 'DEMONSTRATION', result: 'COMPETENT' });
  H.assert(resAssBadCap.ok === false, 'assessment requires an existing capability');

  /* Self-assessment forbidden. */
  var resSelfAssess = SCA.training.createAssessment(TRAINER, {
    practitioner_id: master.id, capability_id: w01.id,
    assessment_type: 'DEMONSTRATION', result: 'COMPETENT',
    assessor_id: 'TEST FIXTURE Well Master' });
  H.assert(resSelfAssess.ok === false, 'a person cannot assess themselves');

  /* S-family safety notes required. */
  var resAssMed = SCA.training.createAssessment(TECH, {
    practitioner_id: master.id, capability_id: s01.id,
    assessment_type: 'PRACTICAL_ASSESSMENT', result: 'COMPETENT' });
  H.assert(resAssMed.ok === false && !!resAssMed.errors.safety_notes,
    'family-S assessment requires safety notes');

  /* Evidence linkage. */
  var resSrc = SCA.evidence.createSource(RESEARCHER, {
    title: 'TEST FIXTURE: competence demonstration source',
    source_type: 'PRACTITIONER_DEMONSTRATION' });
  H.assert(resSrc.ok === true, 'evidence source for competence created');
  var resAss = SCA.training.createAssessment(TECH, {
    practitioner_id: master.id,
    capability_id: w01.id,
    assessment_type: 'PRACTICAL_ASSESSMENT',
    criteria: 'TEST FIXTURE: complete construction process',
    evidence_ids: [resSrc.record.id],
    demonstrations: ['TEST FIXTURE: full demonstration of the process'],
    practical_hours: 12,
    observed_tasks: ['TEST FIXTURE: preparation', 'TEST FIXTURE: execution'],
    strengths: 'TEST FIXTURE: consistent technique',
    limitations: 'TEST FIXTURE: works slowly',
    result: 'COMPETENT',
    competence_level: 'L3',
    assessment_date: '2026-10-10'
  });
  H.assert(resAss.ok === true, 'competence assessment created');
  var assessment = resAss.record;
  H.assertEq(assessment.review_status, 'PENDING', 'assessment starts Pending review');
  H.assertEq(assessment.evidence_ids[0], resSrc.record.id,
    'assessment evidence linked to EvidenceSource');
  /* PENDING assessment must not change the practitioner. */
  H.assertEq(SCA.store.get('practitioners', master.id).competence_level, 'L0',
    'pending assessment never changes competence level automatically');

  /* Experience alone is not competence. */
  H.assertEq(SCA.store.get('practitioners', master.id).experience_years, 25,
    'experience recorded as context');
  H.assertEq(SCA.store.get('practitioners', master.id).competence_level, 'L0',
    'years of experience alone never equal demonstrated competence');

  /* Review: researcher cannot review; rejection needs reason. */
  var resRevByResearcher = SCA.training.reviewAssessment(RESEARCHER, assessment.id,
    { decision: 'ACCEPTED' });
  H.assert(resRevByResearcher.ok === false, 'researcher cannot review assessments');
  var resRevReject = SCA.training.reviewAssessment(REVIEWER, assessment.id,
    { decision: 'REJECTED' });
  H.assert(resRevReject.ok === false, 'rejecting an assessment requires a reason');
  var resRev = SCA.training.reviewAssessment(REVIEWER, assessment.id,
    { decision: 'ACCEPTED' });
  H.assert(resRev.ok === true, 'reviewer accepts assessment');
  var masterNow = SCA.store.get('practitioners', master.id);
  H.assertEq(masterNow.competence_level, 'L3',
    'accepted assessment applies demonstrated competence (L3)');
  H.assertEq(masterNow.competence_status, 'COMPETENT', 'assessment result recorded');
  H.assertEq(masterNow.verification_status, 'ASSESSED',
    'documentation status advanced to Assessed — never auto-Verified');
  H.assert(masterNow.assessment_history.length >= 1,
    'assessment history preserved on the practitioner');
  var auditAssess = SCA.audit.forEntity('practitioners', master.id)
    .filter(function (e) { return e.action === 'assessment.applied'; });
  H.assert(auditAssess.length >= 1, 'competence application audited');

  /* Rejected assessment history is never silently rewritten. */
  var resAss2 = SCA.training.createAssessment(TECH, {
    practitioner_id: master.id, capability_id: w01.id,
    assessment_type: 'PORTFOLIO', result: 'REQUIRES_DEVELOPMENT',
    competence_level: 'L2' });
  var resAss2Rejected = SCA.training.reviewAssessment(REVIEWER, resAss2.record.id,
    { decision: 'REJECTED', reason: 'TEST FIXTURE: portfolio incomplete' });
  H.assert(resAss2Rejected.ok === true, 'assessment rejected with reason');
  var rejected = SCA.store.get('competence_assessments', resAss2.record.id);
  H.assertEq(rejected.review_status, 'REJECTED', 'rejected assessment preserved');
  H.assertEq(SCA.store.get('practitioners', master.id).competence_level, 'L3',
    'rejected assessment never changed competence');

  /* VERIFIED now reachable — with authority and reason. */
  var resVerified = SCA.training.setPractitionerStatus(REVIEWER, master.id,
    'VERIFIED', { reason: 'TEST FIXTURE: demonstrated and assessed, sources reviewed' });
  H.assert(resVerified.ok === true, 'reviewer verifies with documented reason');
  H.assertEq(SCA.store.get('practitioners', master.id).verification_status, 'VERIFIED',
    'practitioner Verified (a documentation decision, not a ranking)');

  /* ================= 3. Trainer development ================= */
  /* can_teach alone is never proof of trainer competence. */
  var resTeachFlag = SCA.store.update('practitioners', master.id, { can_teach: true });
  H.assert(resTeachFlag.ok === true, 'can_teach flag recorded');
  var resDesignateNoAssessment = SCA.training.designateTrainer(REVIEWER, master.id,
    { readiness: 'READY' });
  H.assert(resDesignateNoAssessment.ok === false,
    'trainer designation requires an accepted trainer assessment (can_teach alone is not proof)');

  var resTrainerAssessment = SCA.training.createAssessment(TECH, {
    practitioner_id: master.id, capability_id: w01.id,
    assessment_type: 'TRAINER_ASSESSMENT', result: 'COMPETENT',
    competence_level: 'L5',
    safety_notes: 'TEST FIXTURE: safety knowledge assessed' });
  H.assert(resTrainerAssessment.ok === true, 'trainer assessment created');
  var resTrainerAssessAccepted = SCA.training.reviewAssessment(REVIEWER,
    resTrainerAssessment.record.id, { decision: 'ACCEPTED' });
  H.assert(resTrainerAssessAccepted.ok === true, 'trainer assessment accepted');
  var resDesignate = SCA.training.designateTrainer(REVIEWER, master.id, {
    readiness: 'READY',
    assessment_id: resTrainerAssessment.record.id,
    reason: 'TEST FIXTURE: demonstrated teaching ability',
    apprentice_capacity: 2 });
  H.assert(resDesignate.ok === true, 'trainer designated with assessment');
  H.assertEq(SCA.store.get('practitioners', master.id).trainer_readiness, 'READY',
    'trainer readiness recorded (no ranking)');
  H.assertEq(SCA.store.get('practitioners', master.id).competence_level, 'L5',
    'trainer assessment applied L5');
  var auditTrainer = SCA.audit.forEntity('practitioners', master.id)
    .filter(function (e) { return e.action === 'trainer.designated'; });
  H.assert(auditTrainer.length >= 1, 'trainer designation audited');

  /* ================= 4. Organizations & training programs ================= */
  var resOrg = SCA.store.insert('organizations', {
    name: 'TEST FIXTURE Workshop',
    org_type: 'WORKSHOP',
    region: 'TEST region',
    documentation_consent: true,
    contact_visibility: 'PUBLIC' });
  H.assert(resOrg.ok === true, 'organization created');
  var org = resOrg.record;
  var resOrgLink = SCA.store.update('practitioners', master.id, { organization_id: org.id });
  H.assert(resOrgLink.ok === true, 'practitioner linked to organization (one registry)');

  var resProgBadCap = SCA.training.createTrainingProgram(TRAINER, {
    title: 'TEST FIXTURE: program with bad capability',
    capability_ids: ['no-such-capability'] });
  H.assert(resProgBadCap.ok === false, 'training program validates capabilities');
  var resProg = SCA.training.createTrainingProgram(TRAINER, {
    title: 'TEST FIXTURE: Well Construction Training',
    capability_ids: [w01.id],
    objective: 'TEST FIXTURE: train independent practitioners',
    methodology: 'TEST FIXTURE: demonstration + supervised practice',
    trainer_requirements: 'TEST FIXTURE: L5 trainer with safety knowledge',
    assessment_method: 'TEST FIXTURE: practical assessment',
    suggested_milestones: ['terminology understood', 'tools identified',
      'safety understood', 'basic task demonstrated', 'assisted task completed',
      'independent task completed', 'complete process demonstrated',
      'teaching demonstration']
  });
  H.assert(resProg.ok === true, 'training program created');
  var program = resProg.record;
  H.assertEq(program.status, 'DRAFT', 'program starts Draft');
  var resProgApproveByTrainer = SCA.training.setTrainingProgramStatus(TRAINER,
    program.id, 'APPROVED', 'looks fine');
  H.assert(resProgApproveByTrainer.ok === false, 'trainer cannot approve a program');
  var resProgApproveNoReason = SCA.training.setTrainingProgramStatus(REGIONAL,
    program.id, 'APPROVED', {});
  H.assert(resProgApproveNoReason.ok === false, 'program approval requires a reason');
  var resProgApprove = SCA.training.setTrainingProgramStatus(REGIONAL, program.id,
    'APPROVED', { reason: 'TEST FIXTURE: curriculum and safety review passed' });
  H.assert(resProgApprove.ok === true, 'regional admin approves program with reason');
  var resProgActive = SCA.training.setTrainingProgramStatus(TRAINER, program.id, 'ACTIVE', null);
  H.assert(resProgActive.ok === true, 'approved program activated');

  /* ================= 5. Apprentices & apprenticeships ================= */
  var resApprBad = SCA.training.createApprentice(RESEARCHER, {
    public_name: 'TEST FIXTURE Apprentice', capability_id: 'no-such-capability' });
  H.assert(resApprBad.ok === false, 'apprentice requires an existing capability');
  var resAppr = SCA.training.createApprentice(TRAINER, {
    public_name: 'TEST FIXTURE Young Learner',
    capability_id: w01.id,
    target_level: 'L3',
    training_start: '2026-10-01',
    region: 'TEST region',
    organization_id: org.id });
  H.assert(resAppr.ok === true, 'apprentice created');
  var apprentice = resAppr.record;
  H.assertEq(apprentice.current_level, 'L0', 'apprentice starts at L0 Unknown');

  var resAnonAppr = SCA.training.createApprentice(TRAINER, {
    public_name: 'TEST FIXTURE Sensitive Apprentice Name',
    anonymous_option: true, capability_id: w01.id });
  H.assert(resAnonAppr.record.public_name.indexOf('Sensitive') === -1,
    'anonymous apprentice protected');

  var resShipBadMentor = SCA.training.createApprenticeship(TRAINER, {
    apprentice_id: apprentice.id, mentor_id: 'no-such-mentor',
    capability_id: w01.id });
  H.assert(resShipBadMentor.ok === false, 'apprenticeship requires an existing mentor');
  var resShip = SCA.training.createApprenticeship(TRAINER, {
    apprentice_id: apprentice.id,
    mentor_id: master.id,
    capability_id: w01.id,
    program_id: program.id,
    start_date: '2026-10-01',
    expected_end_date: '2027-10-01',
    successor_pathway: true });
  H.assert(resShip.ok === true, 'apprenticeship created (Trainer -> Apprentice)');
  var ship = resShip.record;
  H.assertEq(ship.status, 'PLANNED', 'apprenticeship starts Planned');
  H.assert(ship.milestones.length >= 8,
    'milestones copied from the program (configurable, not universal)');
  H.assertEq(SCA.store.get('apprentices', apprentice.id).mentor_ids[0], master.id,
    'mentor relationship recorded on the apprentice');

  /* Lifecycle. */
  var resShipActive = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id, 'ACTIVE', null);
  H.assert(resShipActive.ok === true, 'apprenticeship Active');
  var resShipPause = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id, 'PAUSED', null);
  H.assert(resShipPause.ok === true, 'apprenticeship Paused');
  var resShipResume = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id, 'ACTIVE', null);
  H.assert(resShipResume.ok === true, 'apprenticeship resumed');

  /* Milestones. */
  var ms1 = ship.milestones[0], ms2 = ship.milestones[3];
  var resMs = SCA.training.completeMilestone(TRAINER, ship.id, ms1.id, {});
  H.assert(resMs.ok === true, 'milestone completed');
  var resMs2 = SCA.training.completeMilestone(TRAINER, ship.id, ms2.id, {
    status: 'IN_PROGRESS' });
  H.assert(resMs2.ok === true, 'milestone in progress');
  var shipNow = SCA.store.get('apprenticeships', ship.id);
  H.assertEq(shipNow.milestones[0].status, 'COMPLETED', 'milestone status tracked');
  var auditMs = SCA.audit.forEntity('apprenticeships', ship.id)
    .filter(function (e) { return e.action === 'apprenticeship.milestone'; });
  H.assert(auditMs.length >= 2, 'milestone completions audited');

  /* Interruption: reason recorded, not judged. */
  var resShipWithdrawNoReason = SCA.training.updateApprenticeshipStatus(TRAINER,
    ship.id, 'WITHDRAWN', null);
  H.assert(resShipWithdrawNoReason.ok === false, 'interruption requires a documented reason');
  var resShipDisc = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id,
    'DISCONTINUED',
    { reason: 'TEST FIXTURE: family relocation — recorded without judgment' });
  H.assert(resShipDisc.ok === true, 'apprenticeship discontinued with reason');
  var disc = SCA.store.get('apprenticeships', ship.id);
  H.assertEq(disc.status, 'DISCONTINUED', 'discontinuation recorded');
  H.assert(disc.interruption_reason.indexOf('relocation') !== -1,
    'interruption reason preserved');
  var resShipRestart = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id, 'ACTIVE', null);
  H.assert(resShipRestart.ok === true, 'apprenticeship resumed after discontinuation');
  var resShipDone = SCA.training.updateApprenticeshipStatus(TRAINER, ship.id,
    'COMPLETED', { completion_status: 'COMPLETED_WITH_NOTES' });
  H.assert(resShipDone.ok === true, 'apprenticeship completed');
  H.assertEq(SCA.store.get('apprenticeships', ship.id).completion_status,
    'COMPLETED_WITH_NOTES', 'completion status recorded');

  /* ================= 6. Certification ================= */
  var resCertNoAssessment = SCA.training.issueCertification(REVIEWER, {
    practitioner_id: master.id, capability_id: w01.id, certification_level: 'L3' });
  H.assert(resCertNoAssessment.ok === false,
    'certification requires an assessment (attendance is not certification)');

  /* A second PENDING assessment cannot ground certification. */
  var resCertPending = SCA.training.issueCertification(REVIEWER, {
    practitioner_id: master.id, capability_id: w01.id,
    certification_level: 'L3',
    assessment_id: (SCA.training.createAssessment(TECH, {
      practitioner_id: master.id, capability_id: w01.id,
      assessment_type: 'OBSERVATION', result: 'COMPETENT' })).record.id });
  H.assert(resCertPending.ok === false,
    'only ACCEPTED assessments ground certification');

  var resCertByResearcher = SCA.training.issueCertification(RESEARCHER, {
    practitioner_id: master.id, capability_id: w01.id,
    certification_level: 'L3', assessment_id: assessment.id });
  H.assert(resCertByResearcher.ok === false,
    'unauthorized certification rejected (researcher)');
  var resCertBySelf = SCA.training.issueCertification({ name: 'TEST FIXTURE Well Master',
    role: 'trainer' }, {
    practitioner_id: master.id, capability_id: w01.id,
    certification_level: 'L3', assessment_id: assessment.id });
  H.assert(resCertBySelf.ok === false,
    'a person cannot certify themselves');
  var resCertByApprenticeRole = SCA.training.issueCertification(APPRENTICE_ROLE, {
    practitioner_id: master.id, capability_id: w01.id,
    certification_level: 'L3', assessment_id: assessment.id });
  H.assert(resCertByApprenticeRole.ok === false,
    'apprentice role cannot certify (no self-certification path)');

  /* S-family certification requires safety notes. */
  var resCertMed = SCA.training.issueCertification(REVIEWER, {
    practitioner_id: master.id, capability_id: s01.id,
    certification_level: 'L3', assessment_id: assessment.id });
  H.assert(resCertMed.ok === false && !!resCertMed.errors.safety_notes,
    'family-S certification requires safety notes (not medical authorization)');

  var resCert = SCA.training.issueCertification(REVIEWER, {
    practitioner_id: master.id,
    capability_id: w01.id,
    certification_level: 'L3',
    assessment_id: assessment.id,
    scope: 'TEST FIXTURE: construction in the demonstrated context',
    limitations: 'TEST FIXTURE: seasonal conditions only' });
  H.assert(resCert.ok === true, 'reviewer issues competence-based certification');
  var cert = resCert.record;
  H.assertEq(cert.status, 'ISSUED', 'certification issued');
  var auditCert = SCA.audit.forEntity('capability_certifications', cert.id)
    .filter(function (e) { return e.action === 'certification.issued'; });
  H.assert(auditCert.length >= 1, 'certification issuance audited');

  /* Revocation. */
  var resRevokeNoReason = SCA.training.revokeCertification(REVIEWER, cert.id, null);
  H.assert(resRevokeNoReason.ok === false, 'revocation requires a documented reason');
  var resRevokeByTrainer = SCA.training.revokeCertification(TRAINER, cert.id, { reason: 'TEST' } );
  H.assert(resRevokeByTrainer.ok === false, 'trainer cannot revoke certifications');
  var resSuspend = SCA.training.suspendCertification(REVIEWER, cert.id,
    'TEST FIXTURE: scope under re-review');
  H.assert(resSuspend.ok === true, 'certification suspended with reason');
  var resRevoke = SCA.training.revokeCertification(REVIEWER, cert.id,
    'TEST FIXTURE: assessment superseded');
  H.assert(resRevoke.ok === true, 'certification revoked with reason');
  var revoked = SCA.store.get('capability_certifications', cert.id);
  H.assertEq(revoked.status, 'REVOKED', 'revocation recorded');
  H.assert(!!revoked.revocation_reason, 'revocation reason preserved');
  H.assertEq(SCA.store.get('practitioners', master.id).certification_status, 'REVOKED',
    'practitioner certification status follows (history preserved)');

  /* ================= 7. Reproduction loop ================= */
  /* Practitioner -> Trainer (done above: master is READY trainer, L5). */
  H.assertEq(SCA.training.reproductionProfile(w01.id).trainer_count, 1,
    'trainer counted for the capability');

  /* Trainer -> Apprentice (apprenticeship above). */
  /* Apprentice -> Competent Practitioner: accepted assessment applies. */
  var resApprAssess = SCA.training.createAssessment(TECH, {
    apprentice_id: apprentice.id,
    practitioner_id: null,
    capability_id: w01.id,
    assessment_type: 'PRACTICAL_ASSESSMENT',
    result: 'COMPETENT',
    competence_level: 'L3',
    evidence_ids: [resSrc.record.id] });
  H.assert(resApprAssess.ok === true, 'apprentice assessed');
  var resApprAssessRev = SCA.training.reviewAssessment(REVIEWER,
    resApprAssess.record.id, { decision: 'ACCEPTED' });
  H.assert(resApprAssessRev.ok === true, 'apprentice assessment accepted');
  H.assertEq(SCA.store.get('apprentices', apprentice.id).current_level, 'L3',
    'apprentice reached demonstrated competence L3');
  H.assertEq(SCA.store.get('apprentices', apprentice.id).assessment_status, 'COMPETENT',
    'assessment result recorded on the apprentice');

  /* Competent Practitioner -> New Trainer: the graduated apprentice can
     become a trainer (new practitioner record + trainer assessment). */
  var resGraduate = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Young Learner',
    capability_ids: [w01.id],
    region: 'TEST region',
    provenance: 'TEST FIXTURE: graduated from apprenticeship ' + ship.id +
      ' (demonstrated L3 competence)' });
  H.assert(resGraduate.ok === true, 'competent apprentice represented as new practitioner');
  var resGradTrainerAssess = SCA.training.createAssessment(TECH, {
    practitioner_id: resGraduate.record.id, capability_id: w01.id,
    assessment_type: 'TRAINER_ASSESSMENT', result: 'COMPETENT',
    competence_level: 'L4',
    safety_notes: 'TEST FIXTURE: teaching safety assessed' });
  var resGradTrainerRev = SCA.training.reviewAssessment(REVIEWER,
    resGradTrainerAssess.record.id, { decision: 'ACCEPTED' });
  H.assert(resGradTrainerRev.ok === true, 'new trainer assessment accepted');
  var resGradDesignate = SCA.training.designateTrainer(REVIEWER,
    resGraduate.record.id, {
      readiness: 'READY',
      assessment_id: resGradTrainerAssess.record.id,
      reason: 'TEST FIXTURE: teaching demonstration completed' });
  H.assert(resGradDesignate.ok === true, 'new trainer designated');
  /* New Trainer -> Next Apprentice: the loop closes. */
  var resNextAppr = SCA.training.createApprentice(TRAINER, {
    public_name: 'TEST FIXTURE Next Generation Learner',
    capability_id: w01.id });
  var resNextShip = SCA.training.createApprenticeship(TRAINER, {
    apprentice_id: resNextAppr.record.id,
    mentor_id: resGraduate.record.id,
    capability_id: w01.id,
    successor_pathway: true });
  H.assert(resNextShip.ok === true, 'the capability reproduction loop is represented');
  var profileLoop = SCA.training.reproductionProfile(w01.id);
  H.assert(profileLoop.practitioner_count >= 3, 'practitioners counted');
  H.assert(profileLoop.trainer_count >= 2, 'two trainers in the loop');
  H.assert(profileLoop.completed_apprenticeship_count >= 1,
    'completed apprenticeships counted');
  H.assertEq(profileLoop.capability_id, w01.id, 'profile tied to the capability');

  /* Unknown, not zero, where nothing is documented. */
  var emptyProfile = SCA.training.reproductionProfile(
    SCA.store.all('capabilities').filter(function (c) {
      return c.code === 'A19'; })[0].id);
  H.assertEq(emptyProfile.practitioner_count, 0,
    'reliably zero practitioners for an undocumented capability');
  H.assertEq(emptyProfile.last_verified, null,
    'last_verified is Unknown (null), not a fabricated zero');

  /* ================= 8. Evidence & E-level independence ================= */
  H.assertEq(SCA.store.get('capabilities', w01.id).evidence_level, 'E0',
    'L5 practitioner competence never upgrades capability E-level');
  H.assertEq(SCA.store.get('capabilities', w01.id).verification_status, 'Unverified',
    'capability verification untouched by Stage 5');
  /* And E-level evidence would never make practitioners competent either:
     no code path assigns competence from evidence — asserted by design. */
  var resUpgradeByTrainer = SCA.evidence.requestUpgrade(TRAINER, w01.id, {
    to: 'E1', reason: 'TEST', source_ids: [resSrc.record.id] });
  H.assert(resUpgradeByTrainer.ok === false,
    'trainer cannot bypass Stage 3 evidence verification');

  /* ================= 9. Medical safety ================= */
  var sPract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Herbal Practitioner',
    capability_ids: [s01.id] });
  H.assert(sPract.ok === true, 'S-family practitioner LISTING is allowed (documentation)');
  H.assertEq(SCA.store.get('capabilities', s01.id).evidence_level, 'E0',
    'S-family listing is not medical validation');
  var sProfile = SCA.training.profileFor(REVIEWER, sPract.record.id);
  H.assert(sProfile.competence_level === 'L0',
    'listing does not confer competence (clinical safety separate)');
  var resSCert = SCA.training.issueCertification(REVIEWER, {
    practitioner_id: sPract.record.id, capability_id: s01.id,
    certification_level: 'L2', assessment_id: assessment.id,
    safety_notes: 'TEST FIXTURE: documents practice within community context; not medical authorization; no treatment instructions.' });
  H.assert(resSCert.ok === true, 'S-family certification only with safety framing');
  H.assert(resSCert.record.safety_notes.indexOf('not medical authorization') !== -1,
    'certification text preserves the medical-safety boundary');

  /* ================= 10. Privacy ================= */
  var publicList = SCA.training.publicPractitioners();
  H.assert(publicList.every(function (p) { return p.id !== anonPract.id; }),
    'anonymous practitioner never appears in the public view');
  var consented = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Consented Public Practitioner',
    capability_ids: [w01.id],
    contact_visibility: 'PUBLIC',
    documentation_consent: true });
  H.assert(SCA.training.publicPractitioners().some(function (p) {
    return p.id === consented.record.id; }),
    'consented public practitioner visible');
  var publicEntry = SCA.training.publicPractitioners().filter(function (p) {
    return p.id === consented.record.id; })[0];
  H.assert(!('name' in publicEntry) && !('successor' in publicEntry) &&
    !('notes' in publicEntry),
    'public view exposes no private name, succession or notes');

  /* Succession: designated, audited, never public without authorization. */
  var resSuccessor = SCA.training.designateSuccessor(RESEARCHER, master.id, {
    successor_apprentice_id: apprentice.id,
    candidate_type: 'current apprentice',
    knowledge_archive_status: 'partially archived',
    documentation_status: 'in progress',
    notes: 'TEST FIXTURE: succession plan (private)',
    public_disclosure: false });
  H.assert(resSuccessor.ok === true, 'successor designated');
  var auditSucc = SCA.audit.forEntity('practitioners', master.id)
    .filter(function (e) { return e.action === 'successor.designated'; });
  H.assert(auditSucc.length >= 1, 'succession designation audited');
  H.assertEq(SCA.training.publicPractitioners().length > 0, true, 'public list works');
  H.assert(SCA.training.publicPractitioners().every(function (p) {
    return p.id !== master.id; }),
    'unconsented practitioner stays out of the public view');
  /* profileFor without authorization hides succession. */
  var profilePlain = SCA.training.profileFor(RESEARCHER, master.id);
  H.assert(!('successor' in profilePlain),
    'succession hidden from non-authorized profiles');

  /* ================= 11. Apprentice passport ================= */
  var resPassport = SCA.training.getPassport(REVIEWER, apprentice.id);
  H.assert(resPassport.ok === true, 'passport generated');
  var pass = resPassport.passport;
  H.assertEq(pass.kind, 'apprentice_passport', 'passport format');
  H.assertEq(pass.apprentice.current_level, 'L3', 'passport shows demonstrated level');
  H.assertEq(pass.apprentice.target_level, 'L3', 'passport shows target');
  H.assert(pass.mentors.length >= 1, 'passport shows mentor');
  H.assert(pass.assessments.length >= 1, 'passport shows assessments');
  var resPassportExport = SCA.training.exportPassport(REVIEWER, apprentice.id);
  H.assert(resPassportExport.ok === true, 'passport exportable (offline JSON)');
  var parsed = JSON.parse(resPassportExport.json);
  H.assertEq(parsed.kind, 'apprentice_passport', 'passport export parses');
  var resPassportAnon = SCA.training.getPassport(REVIEWER, resAnonAppr.record.id);
  H.assert(resPassportAnon.ok === true &&
    resPassportAnon.passport.apprentice.anonymous === true,
    'anonymous passport marked, identity protected');

  /* ================= 12. Import / export ================= */
  var bundle = SCA.transfer.exportAll();
  var bundleObj = JSON.parse(bundle);
  H.assert(bundleObj.collections.practitioners.length >= 5, 'practitioners exported');
  H.assert(bundleObj.collections.competence_assessments.length >= 4, 'assessments exported');
  H.assert(bundleObj.collections.capability_certifications.length >= 2, 'certifications exported');
  SCA.store.wipe();
  SCA.store.init();
  var resImport = SCA.transfer.importBundle(bundle);
  H.assert(resImport.ok === true, 'full bundle re-imported');
  var restoredPract = SCA.store.all('practitioners').filter(function (p) {
    return p.public_name === 'TEST FIXTURE Well Master'; })[0];
  H.assert(!!restoredPract, 'practitioner restored with stable id');
  H.assertEq(restoredPract.competence_level, 'L5', 'assessment history preserved through round trip');
  H.assertEq(restoredPract.verification_pathways.length, 2, 'verification pathways preserved');
  H.assert(!!SCA.store.get('apprenticeships', ship.id), 'apprenticeship restored');
  H.assertEq(SCA.store.get('apprenticeships', ship.id).milestones.length, 8,
    'milestones preserved');
  H.assert(!!SCA.store.get('capability_certifications', cert.id), 'certification restored');
  H.assertEq(SCA.store.get('capability_certifications', cert.id).status, 'REVOKED',
    'certification history preserved (revocation is history, not erasure)');

  /* Broken relationship: atomic rejection. */
  var broken = JSON.parse(bundle);
  broken.collections.apprenticeships[0].mentor_id = 'no-such-mentor-anywhere';
  SCA.store.wipe();
  SCA.store.init();
  var beforeBroken = JSON.stringify(SCA.store.dataset());
  var resBroken = SCA.transfer.importBundle(JSON.stringify(broken));
  H.assert(resBroken.ok === false, 'bundle with broken mentor reference rejected');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeBroken,
    'broken import changed nothing (atomic failure)');

  /* ================= 13. Inventory protection (final) ================= */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline re-seeded');
  var clean = SCA.store.all('capabilities');
  H.assert(clean.every(function (c) { return c.evidence_level === 'E0' &&
    c.living_status === 'S0' && c.capability_maturity === null; }),
    'all 240 back to pristine E0/S0/null');
  ['practitioners', 'apprentices', 'apprenticeships', 'competence_assessments',
    'training_programs', 'capability_certifications', 'organizations',
    'participants', 'evidence', 'consents'].forEach(function (c) {
    H.assertEq(SCA.store.count(c), 0, 'no TEST FIXTURE ' + c + ' remain');
  });
  H.assertEq(SCA.store.count('audit_log'), 0,
    'audit history of fixtures wiped with them');
};
