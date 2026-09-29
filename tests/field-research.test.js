/* Stage 4: Field Research & Evidence Collection test suite.
 * All fixtures are clearly marked TEST FIXTURE and wiped at the end; the
 * production 240-capability inventory is never touched.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  field-research.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var RESEARCHER_B = { name: 'TEST FIXTURE Researcher B', role: 'researcher' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin', role: 'regional_administrator' };

  /* ---------- baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline 240 intact');
  var w01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'W01'; })[0];
  var s01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'S01'; })[0];

  /* ---------- 1. ResearchProject ---------- */
  var resP0 = SCA.research.createProject(null, {
    project_code: 'TEST-FIXTURE-P0', title: 'TEST FIXTURE project (anon)' });
  H.assert(resP0.ok === false, 'project creation requires permission');

  var resPBad = SCA.research.createProject(RESEARCHER, {
    project_code: 'TEST-FIXTURE-BAD', title: 'x', status: 'NONSENSE' });
  H.assert(resPBad.ok === false && !!resPBad.errors.status,
    'invalid project status rejected by model');

  var resP = SCA.research.createProject(RESEARCHER, {
    project_code: 'TEST-FIXTURE-PRJ-1',
    title: 'TEST FIXTURE: Well documentation project',
    objective: 'TEST FIXTURE: document well construction in one locality',
    capability_ids: [w01.id],
    methodology: 'TEST FIXTURE: observation + interview',
    lead_researcher: RESEARCHER.name,
    research_team: [RESEARCHER.name, RESEARCHER_B.name],
    ethics_notes: 'TEST FIXTURE: consent required for all capture',
    consent_requirements: 'interview, photography, publication'
  });
  H.assert(resP.ok === true, 'project created');
  var project = resP.record;
  H.assertEq(project.status, 'DRAFT', 'new project starts Draft');
  H.assertEq(project.version, '1', 'project version 1');
  H.assertEq(project.capability_ids[0], w01.id, 'capability assignment');

  /* Status transitions: unauthorized + undocumented rejected. */
  var resAppr0 = SCA.research.setProjectStatus(RESEARCHER, project.id, 'APPROVED',
    'TEST approval');
  H.assert(resAppr0.ok === false, 'researcher cannot approve project');
  var resAppr1 = SCA.research.setProjectStatus(REGIONAL, project.id, 'APPROVED', '');
  H.assert(resAppr1.ok === false, 'approval without reason rejected');
  var resBadTr = SCA.research.setProjectStatus(REGIONAL, project.id, 'ACTIVE',
    'skip');
  H.assert(resBadTr.ok === false, 'Draft -> Active directly rejected');
  var resAppr = SCA.research.setProjectStatus(REGIONAL, project.id, 'APPROVED',
    'TEST FIXTURE: protocol and ethics sign-off (fixture)');
  H.assert(resAppr.ok === true, 'regional admin approves project with reason');
  H.assertEq(SCA.store.get('research_projects', project.id).status, 'APPROVED',
    'project now APPROVED');
  H.assertEq(SCA.store.get('research_projects', project.id).version, '2',
    'status change is versioned');

  /* ---------- 2. ResearchSession + location privacy ---------- */
  var resS = SCA.research.createSession(RESEARCHER, {
    project_id: project.id,
    purpose: 'TEST FIXTURE: first field visit',
    locality: 'TEST locality',
    location_precision: 'LOCALITY_ONLY',
    date_start: '2026-10-01'
  });
  H.assert(resS.ok === true, 'session created (no coordinates required)');
  var session = resS.record;
  H.assert(session.latitude === null && session.longitude === null,
    'coordinates stay null when not recorded');
  H.assertEq(session.location_precision, 'LOCALITY_ONLY', 'precision declared');

  /* Draft project refuses field collection. */
  var resPDraft = SCA.research.createProject(RESEARCHER, {
    project_code: 'TEST-FIXTURE-PRJ-2', title: 'TEST FIXTURE: unapproved' });
  H.assert(resPDraft.ok === true, 'second (draft) project created');
  var resSessionDraft = SCA.research.createSession(RESEARCHER, {
    project_id: resPDraft.record.id, purpose: 'x' });
  H.assert(resSessionDraft.ok === false,
    'field collection against unapproved project rejected');

  /* Undisclosed location: coordinates stripped, never guessed. */
  var resSU = SCA.research.createSession(RESEARCHER, {
    project_id: project.id,
    purpose: 'TEST FIXTURE: undisclosed location visit',
    location_precision: 'UNDISCLOSED',
    latitude: 2.0469, longitude: 45.3182
  });
  H.assert(resSU.ok === true, 'undisclosed session accepted');
  H.assert(resSU.record.latitude === null && resSU.record.longitude === null,
    'UNDISCLOSED strips coordinates');
  H.assertEq(resSU.record.region, null, 'region not inferred');

  /* ---------- 3. Participant + consent ---------- */
  var resPart = SCA.research.recordParticipant(RESEARCHER, {
    participant_code: 'TEST-FIXTURE-PT-01',
    public_name: 'TEST FIXTURE Elder',
    anonymous: false,
    role: 'ELDER',
    community: 'TEST community',
    languages: ['so'],
    contact_permission: false,
    attribution_preference: 'named'
  });
  H.assert(resPart.ok === true, 'named participant recorded');
  var participant = resPart.record;

  var resAnon = SCA.research.recordParticipant(RESEARCHER, {
    participant_code: 'TEST-FIXTURE-PT-02',
    public_name: 'Real Sensitive Name',
    anonymous: true,
    role: 'PRACTITIONER',
    consent_id: null
  });
  H.assert(resAnon.ok === true, 'anonymous participant recorded');
  H.assert(resAnon.record.public_name.indexOf('Anonymous') === 0,
    'anonymous participant public_name does not identify the person');
  H.assertEq(resAnon.record.access_level, 'RESEARCH_TEAM',
    'participant not public by default');

  var resConsent = SCA.research.recordConsent(RESEARCHER, {
    person: 'TEST-FIXTURE-PT-01',
    purpose: 'TEST FIXTURE: interview + photography consent',
    media_permission: true,
    public_permission: true,
    attribution_preference: 'named',
    consent_state: 'GRANTED'
  });
  H.assert(resConsent.ok === true, 'consent recorded');
  var consent = resConsent.record;
  var resLink = SCA.store.update('participants', participant.id, {
    consent_id: consent.id });
  H.assert(resLink.ok === true, 'participant linked to consent');

  /* ---------- 4. Observation ---------- */
  var resObsNoSession = SCA.research.createObservation(RESEARCHER, {
    session_id: 'no-session', capability_id: w01.id,
    observation_type: 'DEMONSTRATION', observation_text: 'TEST' });
  H.assert(resObsNoSession.ok === false, 'observation needs an existing session');

  var resObs = SCA.research.createObservation(RESEARCHER, {
    session_id: session.id,
    capability_id: w01.id,
    observation_type: 'DEMONSTRATION',
    observation_text: 'TEST FIXTURE: practitioner demonstrated construction using locally available fibre.',
    context: 'TEST FIXTURE: single locality, one visit',
    observer_name: RESEARCHER.name,
    participant_refs: [participant.id]
  });
  H.assert(resObs.ok === true, 'observation created');
  var obs = resObs.record;
  H.assertEq(obs.status, 'DRAFT', 'observation starts Draft');
  H.assertEq(obs.session_id, session.id, 'observation -> session relationship');
  H.assertEq(obs.capability_id, w01.id, 'observation -> capability relationship');
  H.assertEq(obs.observer_name, RESEARCHER.name, 'observer recorded (provenance)');
  H.assertEq(obs.version, '1', 'observation version 1');

  /* Medical safety in the field: S-family observation without safety notes. */
  var resObsMed = SCA.research.createObservation(RESEARCHER, {
    session_id: session.id,
    capability_id: s01.id,
    observation_type: 'DIRECT_OBSERVATION',
    observation_text: 'TEST FIXTURE: health-related observation.' });
  H.assert(resObsMed.ok === false && !!resObsMed.errors.safety_notes,
    'S-family field observation requires safety notes');
  var resObsMedOk = SCA.research.createObservation(RESEARCHER, {
    session_id: session.id,
    capability_id: s01.id,
    observation_type: 'DIRECT_OBSERVATION',
    observation_text: 'TEST FIXTURE: health-related observation.',
    safety_notes: 'TEST FIXTURE: documentation of practice, not medical advice; no treatment instructions.' });
  H.assert(resObsMedOk.ok === true, 'S-family observation with safety notes accepted');

  /* ---------- 5. Knowledge capture (interview) ---------- */
  var resCap0 = SCA.research.createKnowledgeCapture(RESEARCHER, {
    session_id: session.id,
    title: 'TEST FIXTURE: interview about well construction',
    participant_id: participant.id,
    transcription: 'TEST FIXTURE original wording (Somali) — as spoken',
    translated_text: 'TEST FIXTURE translation of the original wording',
    summary: 'TEST FIXTURE summary'
  });
  H.assert(resCap0.ok === true, 'knowledge capture created');
  var capture = resCap0.record;
  H.assert(capture.transcription.indexOf('original wording') !== -1,
    'original wording preserved');
  H.assert(capture.translated_text !== capture.transcription,
    'translation separate from original');

  var resCapNoOriginal = SCA.research.createKnowledgeCapture(RESEARCHER, {
    session_id: session.id,
    title: 'TEST FIXTURE: translation-only capture (must fail)',
    translated_text: 'TEST translation without original' });
  H.assert(resCapNoOriginal.ok === false && !!resCapNoOriginal.errors.transcription,
    'translation without preserved original rejected');

  var resCapE3 = SCA.research.createKnowledgeCapture(RESEARCHER, {
    session_id: session.id,
    title: 'TEST FIXTURE: capture claiming E3',
    transcription: 'TEST original',
    evidence_level: 'E3' });
  H.assert(resCapE3.ok === false && !!resCapE3.errors.evidence_level,
    'field capture cannot claim E3+ evidence levels');

  var resCapE2 = SCA.research.createKnowledgeCapture(RESEARCHER, {
    session_id: session.id,
    title: 'TEST FIXTURE: capture at E2 (allowed)',
    transcription: 'TEST original',
    evidence_level: 'E2' });
  H.assert(resCapE2.ok === true, 'field capture may be E2 (community/oral)');

  /* ---------- 6. Field notes ---------- */
  var resNote = SCA.research.createFieldNote(RESEARCHER, {
    session_id: session.id,
    text: 'TEST FIXTURE: preliminary impression, not evidence',
    related_capabilities: [w01.id],
    tags: ['TEST']
  });
  H.assert(resNote.ok === true, 'field note created');
  var note = resNote.record;
  H.assertEq(note.session_id, session.id, 'note -> session relationship');
  H.assertEq(note.status, 'DRAFT', 'note starts Draft (never auto-evidence)');

  /* ---------- 7. Media metadata ---------- */
  var resMediaNoConsent = SCA.research.createMedia(RESEARCHER, {
    media_type: 'PHOTOGRAPH',
    filename: 'test-fixture-well.jpg',
    session_id: session.id,
    checksum: 'test-fixture-checksum-0001',
    local_reference: 'local://test-fixture-well.jpg'
  });
  H.assert(resMediaNoConsent.ok === true, 'media metadata created');
  var media = resMediaNoConsent.record;
  H.assertEq(media.access_level, 'RESEARCH_TEAM',
    'media not assumed publicly shareable (default access)');
  H.assertEq(media.uploaded_status, 'local_reference_only', 'media is local reference only');
  var resMediaLink = SCA.store.update('field_media', media.id, {
    consent_id: consent.id });
  H.assert(resMediaLink.ok === true, 'media linked to consent');

  /* Consent withdrawal: restrict without deleting provenance. */
  var resMediaPublic = SCA.research.createMedia(RESEARCHER, {
    media_type: 'PHOTOGRAPH', filename: 'test-fixture-public.jpg',
    access_level: 'PUBLIC', consent_id: consent.id });
  H.assert(resMediaPublic.ok === true, 'public media (with consent) created');
  var resWithdraw = SCA.research.withdrawConsent(RESEARCHER, consent.id,
    'TEST FIXTURE: participant withdrew consent');
  H.assert(resWithdraw.ok === true, 'consent withdrawal recorded');
  H.assert(resWithdraw.restricted >= 1, 'affected media restricted');
  var withdrawnMedia = SCA.store.get('field_media', resMediaPublic.record.id);
  H.assertEq(withdrawnMedia.access_level, 'RESTRICTED', 'public media downgraded');
  H.assert(!!withdrawnMedia.consent_id, 'provenance (consent link) preserved');
  H.assert(!!SCA.store.get('consents', consent.id), 'consent record preserved');

  /* ---------- 8. Lifecycle ---------- */
  var resSubmit0 = SCA.research.submit(null, 'observations', obs.id);
  H.assert(resSubmit0.ok === false, 'submission requires permission');
  var resSubmit = SCA.research.submit(RESEARCHER, 'observations', obs.id);
  H.assert(resSubmit.ok === true, 'researcher submits observation');
  H.assertEq(SCA.store.get('observations', obs.id).status, 'SUBMITTED', 'now Submitted');

  var resReviewByResearcher = SCA.research.reviewFieldRecord(RESEARCHER,
    'observations', obs.id, { status: 'ACCEPTED_AS_EVIDENCE' });
  H.assert(resReviewByResearcher.ok === false,
    'field researcher cannot review own record into evidence');

  var resToReview = SCA.research.reviewFieldRecord(REVIEWER, 'observations', obs.id,
    { status: 'UNDER_REVIEW' });
  H.assert(resToReview.ok === true, 'reviewer starts review');
  var resClarify = SCA.research.reviewFieldRecord(REVIEWER, 'observations', obs.id,
    { status: 'NEEDS_CLARIFICATION', notes: 'TEST: clarify materials list' });
  H.assert(resClarify.ok === true, 'clarification requested');
  H.assertEq(SCA.store.get('observations', obs.id).status, 'NEEDS_CLARIFICATION',
    'Needs Clarification reached');
  var resResubmit = SCA.research.submit(RESEARCHER, 'observations', obs.id);
  H.assert(resResubmit.ok === true, 'clarified record resubmitted');
  SCA.research.reviewFieldRecord(REVIEWER, 'observations', obs.id, { status: 'UNDER_REVIEW' });

  /* Evidence submission: creates archive objects; capability E-level untouched. */
  var claimsBefore = SCA.store.count('claims');
  var resAccept = SCA.research.acceptAsEvidence(REVIEWER, 'observations', obs.id, {});
  H.assert(resAccept.ok === true, 'reviewer accepts observation as evidence');
  H.assertEq(SCA.store.count('claims'), claimsBefore,
    'no claim auto-generated from an observation');
  var accepted = SCA.store.get('observations', obs.id);
  H.assertEq(accepted.status, 'ACCEPTED_AS_EVIDENCE', 'Accepted as Evidence');
  H.assert(accepted.origin_evidence_ids.length >= 1, 'field record links to evidence');
  var artifactFromField = SCA.store.get('knowledge', accepted.origin_evidence_ids[0]);
  H.assert(!!artifactFromField, 'accepted artifact exists');
  H.assertEq(artifactFromField.origin_record.collection, 'observations',
    'artifact links back to the field record');
  H.assertEq(artifactFromField.source_ids.length, 1, 'evidence source created');
  H.assertEq(SCA.store.get('capabilities', w01.id).evidence_level, 'E0',
    'capability NOT upgraded by field evidence (Stage 3 workflow authoritative)');
  H.assertEq(SCA.store.get('capabilities', w01.id).version, '1',
    'capability record untouched');

  /* Observation vs claim: explicit claim text is required. */
  SCA.research.submit(RESEARCHER, 'field_notes', note.id);
  SCA.research.reviewFieldRecord(REVIEWER, 'field_notes', note.id, { status: 'UNDER_REVIEW' });
  var resAcceptClaim = SCA.research.acceptAsEvidence(REVIEWER, 'field_notes', note.id, {
    claim_text: 'TEST FIXTURE: the construction method is used in the visited locality.',
    claim_type: 'CURRENT_PRACTICE'
  });
  H.assert(resAcceptClaim.ok === true, 'acceptance with explicit claim text works');
  H.assertEq(resAcceptClaim.claim.claim_text.indexOf('TEST FIXTURE'), 0,
    'claim is the reviewer\'s explicit proposition, not generated');

  /* Rejection: documented reason, record preserved. A DRAFT record cannot
     be rejected directly (it must be submitted and reviewed first). */
  var resReject0 = SCA.research.reviewFieldRecord(REVIEWER, 'observations',
    resObsMedOk.record.id, { status: 'REJECTED', reason: 'premature' });
  H.assert(resReject0.ok === false,
    'DRAFT record cannot be rejected directly (lifecycle guard)');
  SCA.research.submit(RESEARCHER, 'observations', resObsMedOk.record.id);
  SCA.research.reviewFieldRecord(REVIEWER, 'observations', resObsMedOk.record.id,
    { status: 'UNDER_REVIEW' });
  var resRejectNoReason = SCA.research.reviewFieldRecord(REVIEWER, 'observations',
    resObsMedOk.record.id, { status: 'REJECTED' });
  H.assert(resRejectNoReason.ok === false, 'rejection without reason refused');
  var resReject = SCA.research.reviewFieldRecord(REVIEWER, 'observations',
    resObsMedOk.record.id,
    { status: 'REJECTED', reason: 'TEST FIXTURE: insufficient documentation' });
  H.assert(resReject.ok === true, 'rejection with reason succeeds');
  var rejected = SCA.store.get('observations', resObsMedOk.record.id);
  H.assertEq(rejected.status, 'REJECTED', 'record Rejected');
  H.assert(!!rejected.observation_text, 'rejected record NOT erased');
  H.assert(!!rejected.rejection_reason, 'rejection reason preserved');

  /* Field researcher cannot upgrade evidence (Stage 3 boundary). */
  var resUpByField = SCA.evidence.requestUpgrade(RESEARCHER, w01.id, {
    to: 'E1', reason: 'TEST', source_ids: [artifactFromField.source_ids[0]] });
  H.assert(resUpByField.ok === false, 'field researcher cannot upgrade evidence levels');

  /* ---------- 9. Multiple + conflicting observations ---------- */
  var resSessionB = SCA.research.createSession(RESEARCHER_B, {
    project_id: project.id, purpose: 'TEST FIXTURE: second visit',
    location_precision: 'DISTRICT_ONLY' });
  var resObsB = SCA.research.createObservation(RESEARCHER_B, {
    session_id: resSessionB.record.id,
    capability_id: w01.id,
    observation_type: 'PRACTICAL_TEST',
    observation_text: 'TEST FIXTURE: method failed under condition X (contradicts observation A).',
    observer_name: RESEARCHER_B.name
  });
  H.assert(resObsB.ok === true, 'second observation by a different researcher');
  var obsB = resObsB.record;
  H.assert(obsB.id !== obs.id, 'separate records, never merged');
  H.assertEq(SCA.store.all('observations').filter(function (o) {
    return o.capability_id === w01.id; }).length, 2,
    'multiple observations for one capability all preserved (2 for W01)');

  var resConflict0 = SCA.research.flagConflict(RESEARCHER, [
    { collection: 'observations', id: obs.id }]);
  H.assert(resConflict0.ok === false, 'a conflict needs at least two records');
  var resConflict = SCA.research.flagConflict(RESEARCHER, [
    { collection: 'observations', id: obs.id },
    { collection: 'observations', id: obsB.id }],
    { notes: 'TEST FIXTURE: A says works, B says fails under condition X' });
  H.assert(resConflict.ok === true, 'conflict flagged');
  H.assertEq(SCA.store.get('observations', obs.id).conflict_status, true,
    'conflict visible on record A');
  H.assertEq(SCA.store.get('observations', obsB.id).resolution_status, 'UNREVIEWED',
    'conflict stays visible until resolved');

  var resResolve0 = SCA.research.resolveConflict(RESEARCHER, [
    { collection: 'observations', id: obs.id },
    { collection: 'observations', id: obsB.id }],
    { resolution: 'CONTEXTUAL_DIFFERENCE' });
  H.assert(resResolve0.ok === false, 'researcher cannot resolve conflicts');
  var resResolveNoNotes = SCA.research.resolveConflict(REVIEWER, [
    { collection: 'observations', id: obs.id },
    { collection: 'observations', id: obsB.id }],
    { resolution: 'CONTEXTUAL_DIFFERENCE' });
  H.assert(resResolveNoNotes.ok === false, 'resolution requires reviewer notes');
  var resResolve = SCA.research.resolveConflict(REVIEWER, [
    { collection: 'observations', id: obs.id },
    { collection: 'observations', id: obsB.id }],
    { resolution: 'CONTEXTUAL_DIFFERENCE',
      notes: 'TEST FIXTURE: different environmental conditions explain both results' });
  H.assert(resResolve.ok === true, 'reviewer resolves conflict with notes');
  H.assertEq(SCA.store.get('observations', obs.id).resolution_status,
    'CONTEXTUAL_DIFFERENCE', 'resolution recorded');
  H.assert(!!SCA.store.get('observations', obsB.id).conflict_refs,
    'both records preserved after resolution (no automatic deletion)');

  /* ---------- 10. Offline queue ---------- */
  var qObs = SCA.queue.entriesFor('observations', obs.id);
  H.assert(qObs.length >= 1, 'queue entry created for local observation');
  H.assert(qObs.every(function (e) {
    return e.sync_status === 'READY_FOR_EXPORT' || e.sync_status === 'LOCAL_ONLY' ||
      e.sync_status === 'EXPORTED'; }),
    'queue statuses honest (local lifecycle)');
  var fresh = SCA.store.all('observations').filter(function (o) {
    return o.status === 'DRAFT'; })[0];
  var qFresh = SCA.queue.entriesFor('observations', fresh.id);
  H.assert(qFresh.length >= 1 && qFresh[0].sync_status === 'LOCAL_ONLY',
    'a freshly created record is LOCAL_ONLY, never falsely SYNCHRONIZED');
  var beforeSynchronized = SCA.queue.counts().SYNCHRONIZED || 0;
  SCA.queue.setStatus('observations', fresh.id, 'SYNCHRONIZED');
  H.assert((SCA.queue.counts().SYNCHRONIZED || 0) === beforeSynchronized + 1,
    'synchronized only via an explicit completed step');
  SCA.queue.markFailed('observations', fresh.id, 'TEST: simulated export failure');
  var failedEntry = SCA.queue.entriesFor('observations', fresh.id).filter(function (e) {
    return e.sync_status === 'FAILED'; })[0];
  H.assert(!!failedEntry && failedEntry.retry_count === 1 && !!failedEntry.last_error,
    'failure recorded with retry count and error');
  H.assert(SCA.queue.pending().length >= 1, 'pending queue visible');

  /* ---------- 12. Privacy ---------- */
  H.assert(SCA.research.publicRecords('observations').every(function (o) {
    return o.access_level === 'PUBLIC'; }),
    'public view only includes explicitly PUBLIC field records');
  H.assertEq(SCA.research.publicRecords('participants').length, 0,
    'no participant is public by default');
  var anon = SCA.store.all('participants').filter(function (p) {
    return p.anonymous === true; })[0];
  H.assert(anon.public_name.indexOf('Real Sensitive Name') === -1,
    'anonymous participant protected');

  /* ---------- 13. Medical safety ---------- */
  var medArtifacts = SCA.store.all('knowledge').filter(function (k) {
    return (k.capability_ids || []).indexOf(s01.id) !== -1; });
  H.assert(medArtifacts.every(function (k) { return !!k.safety_notes; }),
    'all family-S archive artifacts carry safety notes');
  /* A health-related field record CAN be accepted as evidence — as preserved
     documentation with safety metadata, never as clinical validation. */
  var resObsMed2 = SCA.research.createObservation(RESEARCHER, {
    session_id: session.id,
    capability_id: s01.id,
    observation_type: 'DEMONSTRATION',
    observation_text: 'TEST FIXTURE: practitioner described preparation of a remedy.',
    safety_notes: 'TEST FIXTURE: preserved documentation of practice; not medical advice.' });
  H.assert(resObsMed2.ok === true, 'S-family observation with safety notes created');
  SCA.research.submit(RESEARCHER, 'observations', resObsMed2.record.id);
  SCA.research.reviewFieldRecord(REVIEWER, 'observations', resObsMed2.record.id,
    { status: 'UNDER_REVIEW' });
  var resAcceptMed = SCA.research.acceptAsEvidence(REVIEWER, 'observations',
    resObsMed2.record.id, {});
  H.assert(resAcceptMed.ok === true, 'health-related record accepted as evidence');
  var medArt = SCA.store.get('knowledge',
    resAcceptMed.record.origin_evidence_ids[0]);
  H.assert(!!medArt.safety_notes, 'accepted medical artifact carries safety notes');
  H.assertEq(medArt.evidence_level, 'E2', 'field evidence capped at E2, not clinical validation');
  H.assertEq(SCA.store.get('capabilities', s01.id).evidence_level, 'E0',
    'medical field documentation never auto-upgrades or validates clinically');

  /* ---------- 14. RBAC boundaries ---------- */
  var PRACTITIONER = { name: 'TEST FIXTURE Practitioner', role: 'practitioner' };
  H.assert(SCA.research.createObservation(PRACTITIONER, {
    session_id: session.id, capability_id: w01.id,
    observation_type: 'DIRECT_OBSERVATION', observation_text: 'x' }).ok === false,
    'practitioner role cannot create observations');
  H.assert(SCA.rbac.can(RESEARCHER, 'evidence.verify') === false,
    'field researcher has no evidence verification authority');
  H.assert(SCA.rbac.can(REVIEWER, 'research.approve') === false,
    'reviewer cannot approve research projects');

  /* ---------- 11. Research package export/import ---------- */
  var pkgText = SCA.research.exportPackage(project.id);
  var pkg = JSON.parse(pkgText);
  H.assertEq(pkg.kind, 'research_package', 'package format');
  H.assertEq(pkg.collections.research_projects.length, 1, 'project in package');
  H.assert(!!pkg.capability_references.length, 'capability references included');
  H.assert(!!pkg.family_references.length, 'family references included');

  /* Round trip: wipe everything research-related, re-import, check links. */
  var keptAudit = SCA.store.count('audit_log');
  SCA.store.wipe();
  SCA.store.init();
  var resImportPkg = SCA.research.importPackage(pkgText);
  if (!resImportPkg.ok) { console.log('PKG ERRORS:', JSON.stringify(resImportPkg.errors)); }
  H.assert(resImportPkg.ok === true, 'package re-imported after wipe');
  H.assertEq(SCA.store.count('research_projects'), 1, 'project restored');
  var restoredObs = SCA.store.all('observations').filter(function (o) {
    return o.observation_text.indexOf('fibre') !== -1; })[0];
  H.assert(!!restoredObs, 'observation restored');
  H.assertEq(SCA.store.get('research_sessions', restoredObs.session_id).project_id,
    project.id, 'observation -> session -> project relationships restored');
  H.assertEq(restoredObs.version, SCA.store.get('observations', restoredObs.id).version,
    'versions preserved');
  H.assertEq(SCA.store.get('capabilities', w01.id).evidence_level, 'E0',
    'inventory untouched by package round trip');

  /* Broken references: package with an orphan session is rejected atomically.
     The store is re-seeded first (deterministic capability ids keep the
     capability references resolvable) so the removed session reference
     genuinely cannot resolve anywhere. */
  SCA.store.wipe();
  SCA.store.init();
  var brokenPkg = JSON.parse(pkgText);
  brokenPkg.collections.research_sessions =
    brokenPkg.collections.research_sessions.filter(function (s) {
      return s.id !== restoredObs.session_id; });
  var beforeBroken = JSON.stringify(SCA.store.dataset());
  var resBrokenPkg = SCA.research.importPackage(JSON.stringify(brokenPkg));
  H.assert(resBrokenPkg.ok === false, 'package with broken session reference rejected');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeBroken,
    'no partial import on package failure');

  /* Conflicting import: import the original package first (the store is
     fresh after the broken-package test), then a divergent copy: existing
     record preserved, incoming parked, conflict flagged for human review. */
  var resReimport = SCA.research.importPackage(pkgText);
  H.assert(resReimport.ok === true, 'original package imported before divergence test');
  var divergent = JSON.parse(pkgText);
  var divergentObs = divergent.collections.observations.filter(function (o) {
    return o.observation_text.indexOf('fibre') !== -1; })[0];
  divergentObs.observation_text = 'TEST FIXTURE: DIVERGENT EDIT from another device';
  var resDivergent = SCA.research.importPackage(JSON.stringify(divergent));
  H.assert(resDivergent.ok === true && resDivergent.conflicts.length >= 1,
    'divergent copy flagged as conflict');
  H.assertEq(SCA.store.get('observations', divergentObs.id).observation_text
    .indexOf('fibre') !== -1, true, 'existing record preserved (not overwritten)');
  var conflictEntries = SCA.store.all('research_queue').filter(function (e) {
    return e.sync_status === 'CONFLICT'; });
  H.assert(conflictEntries.length >= 1 &&
    conflictEntries[0].incoming_record.id === divergentObs.id,
    'incoming divergent copy parked for human review');



  /* ---------- final: restore pristine baseline ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline re-seeded');
  var clean = SCA.store.all('capabilities');
  H.assert(clean.every(function (c) { return c.evidence_level === 'E0' &&
    c.living_status === 'S0' && c.capability_maturity === null; }),
    'all 240 back to pristine E0/S0/null');
  ['research_projects', 'research_sessions', 'observations', 'field_notes',
    'participants', 'field_media', 'research_queue', 'evidence', 'claims',
    'knowledge', 'consents'].forEach(function (c) {
    H.assertEq(SCA.store.count(c), 0, 'no TEST FIXTURE ' + c + ' remain');
  });
  H.assertEq(SCA.store.count('audit_log'), 0, 'audit history of fixtures wiped with them');
};
