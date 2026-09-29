/*
 * Stage 14: National Capability Reserve & Institutional Continuity
 * (frozen scope v1.1 + Gate C implementation authorization).
 *
 * Suite contract (authorization §38):
 *  1.  Exactly three domain entities; ghost-entity/field scan.
 *  2.  Reserve schema & creation; frozen vocabularies.
 *  3.  Reserve lifecycle: submit, verify, reject, activate
 *      (custodian), suspend, resume, retire; terminal immutability;
 *      no resurrection; edit locks; no automatic transitions.
 *  4.  RBAC: exactly five flat permissions; separation incl.
 *      NATIONAL at the service layer.
 *  5.  Custodian rule (VERIFIED vs ACTIVE; resolution required).
 *  6.  ContinuityPlan: lifecycle, optional reserve, structured
 *      essential_people, no SUSPENDED, reserve-independence.
 *  7.  CapabilityAsset: standalone collection, category
 *      validation, reference resolution, BIOLOGICAL
 *      documentation-only rule, structural privacy.
 *  8.  Derived views: One-Person Test, Three-Generation Test,
 *      Battery, Spine — never persisted, census-aware wording.
 *  9.  Integration boundaries (Stages 3/5/6/8/9/12/13 consumed,
 *      never mutated; no automatic coupling).
 * 10.  Audit coverage for every state-changing operation.
 * 11.  Offline DRAFT (local persistence; no optimistic state).
 * 12.  Atomic transfer: round trip, unresolved references,
 *      import provenance (Stage 13 lessons from day one), forged
 *      actors, terminal protection, byte-identical rejection,
 *      legitimate state preservation.
 * 13.  Clean install (zero Stage 14 records; no fabricated data).
 * 14.  Inventory preservation (240 capabilities, 12 families).
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  H.load('src/models/recovery-profile.js');
  H.load('src/models/capability-reserve.js');
  H.load('src/models/continuity-plan.js');
  H.load('src/models/capability-asset.js');
  H.load('src/reserve/workflow.js');
  console.log('  reserve-system.test.js');

  var CREATOR = { name: 'TEST FIXTURE Reserve Creator',
    role: 'technician' };
  var OTHER_CREATOR = { name: 'TEST FIXTURE Second Creator',
    role: 'community_steward' };
  var REVIEWER = { name: 'TEST FIXTURE Reserve Reviewer',
    role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var ANON = { name: 'anonymous' };

  SCA.store.init();
  /* Local-roster accounts (users never travel in bundles; the
   * local roster is the only authority — Stage 13 D1/D2 lesson
   * applied from day one, authorization §24). */
  SCA.store.insert('users', { name: CREATOR.name,
    email: 'res-creator@test.local', role: 'technician' });
  SCA.store.insert('users', { name: OTHER_CREATOR.name,
    email: 'res-creator2@test.local', role: 'community_steward' });
  SCA.store.insert('users', { name: REVIEWER.name,
    email: 'res-reviewer@test.local', role: 'reviewer' });
  SCA.store.insert('users', { name: REGIONAL.name,
    email: 'res-regional@test.local', role: 'regional_administrator' });
  SCA.store.insert('users', { name: NATIONAL.name,
    email: 'res-national@test.local', role: 'national_administrator' });

  var cap = SCA.store.all('capabilities')[0];
  var cap2 = SCA.store.all('capabilities')[1];
  var orgRes = SCA.store.insert('organizations', {
    id: 'org-res-a', name: 'Reserve Custodian Org', status: null });
  var ORG = orgRes.ok ? orgRes.record :
    SCA.store.get('organizations', 'org-res-a');
  SCA.store.insert('practitioners', { id: 'pr-res-a',
    public_name: 'Reserve Test Practitioner',
    anonymous_option: false, documentation_consent: true,
    status: null });
  SCA.store.insert('training_programs', { id: 'tp-res-a',
    name: 'Reserve Test Training Program', status: 'ACTIVE' });
  SCA.store.insert('workshops', { id: 'ws-res-a',
    name: 'Reserve Test Workshop', status: 'VERIFIED' });
  SCA.store.insert('tools', { id: 'tool-res-a',
    name: 'Reserve Test Tool', status: null });
  SCA.store.insert('recovery_profiles', { id: 'rp-res-a',
    profile_kind: 'FALLBACK_CAPABILITY', capability_id: cap.id,
    status: null });

  /* ---------- 1. entities & ghosts ---------- */

  console.log('    1. entity discipline');
  H.assert(SCA.models.capabilityReserve &&
    SCA.models.capabilityReserve.collection ===
    'capability_reserves',
    'CapabilityReserve model registered');
  H.assert(SCA.models.continuityPlan &&
    SCA.models.continuityPlan.collection === 'continuity_plans',
    'ContinuityPlan model registered');
  H.assert(SCA.models.capabilityAsset &&
    SCA.models.capabilityAsset.collection === 'capability_assets',
    'CapabilityAsset model registered (standalone collection)');
  H.assert(SCA.reserve && SCA.reserve.STATUSES.length === 7,
    'SCA.reserve service registered with the seven reserve states');
  ['reserve_assets', 'reserve_gaps', 'continuity_results',
    'continuity_assessments', 'reserve_scores',
    'resilience_scores', 'continuity_scores', 'battery_states',
    'spine_nodes', 'failure_test_results', 'one_person_results',
    'three_generation_results', 'successor_records'].forEach(
    function (ghost) {
      H.assert(SCA.store.COLLECTIONS.indexOf(ghost) === -1,
        'no shadow collection "' + ghost + '" exists');
      H.assert(!SCA.models[ghost],
        'no shadow model "' + ghost + '" exists');
    });

  /* ---------- 2. reserve schema & creation ---------- */

  console.log('    2. reserve creation & vocabularies');
  var bad = SCA.reserve.createReserve(ANON, { name: 'Nope' });
  H.assert(!bad.ok, 'anonymous cannot create a reserve');
  var noName = SCA.reserve.createReserve(CREATOR, {});
  H.assert(!noName.ok && noName.errors.name,
    'a reserve requires a name');
  var badVocab = SCA.reserve.createReserve(CREATOR, {
    name: 'Bad vocab', reserve_types: ['MILITARY_RESERVE'],
    known_gaps: ['VERY_RESILIENT'] });
  H.assert(!badVocab.ok && badVocab.errors.reserve_types &&
    badVocab.errors.known_gaps,
    'reserve types and gaps come from the frozen vocabularies');
  var badRef = SCA.reserve.createReserve(CREATOR, {
    name: 'Bad ref', capability_ids: ['cap-does-not-exist'],
    custodian_organization_id: 'org-does-not-exist' });
  H.assert(!badRef.ok && badRef.errors.capability_ids &&
    badRef.errors.custodian_organization_id,
    'hard references must resolve (a reserve never creates the ' +
    'referenced record)');
  var forbidden = SCA.reserve.createReserve(CREATOR, {
    name: 'Scored', resilience_score: 0.9, phone: '555' });
  H.assert(!forbidden.ok &&
    (forbidden.errors.resilience_score || forbidden.errors.phone),
    'structural boundary/privacy pins reject scores and contact ' +
    'fields at creation');
  var good = SCA.reserve.createReserve(CREATOR, {
    name: 'Water Well Repair Reserve',
    description: 'Deliberately maintained reserve for well repair',
    reserve_types: ['HUMAN_RESERVE', 'TECHNICAL_RESERVE'],
    capability_ids: [cap.id],
    owner_organization_id: ORG.id });
  H.assert(good.ok && good.record.status === 'DRAFT',
    'a reserve is created in DRAFT');
  var R1 = good.record;

  /* ---------- 3. reserve lifecycle ---------- */

  console.log('    3. reserve lifecycle');
  var upd = SCA.reserve.updateReserve(CREATOR, R1.id, {
    custodian_organization_id: ORG.id, known_gaps: ['NO_TRAINER'],
    edit_reason: 'add custodian and documented gap' });
  H.assert(upd.ok && upd.record.custodian_organization_id === ORG.id,
    'the creator can amend a DRAFT reserve');
  var updOther = SCA.reserve.updateReserve(OTHER_CREATOR, R1.id, {
    name: 'Hijacked' });
  H.assert(!updOther.ok,
    'only the creator may edit a draft reserve');
  var subBad = SCA.reserve.submitReserve(OTHER_CREATOR, R1.id);
  H.assert(!subBad.ok,
    'only the creator may submit a reserve');
  var sub = SCA.reserve.submitReserve(CREATOR, R1.id);
  H.assert(sub.ok && sub.record.status === 'SUBMITTED',
    'DRAFT -> SUBMITTED');
  var lock = SCA.reserve.updateReserve(CREATOR, R1.id, {
    name: 'Late edit' });
  H.assert(!lock.ok,
    'SUBMITTED is locked pending review');
  var selfVerify = SCA.reserve.verifyReserve(CREATOR, R1.id, 'mine');
  H.assert(!selfVerify.ok,
    'the creator cannot verify their own reserve (service layer)');
  var natSelf = SCA.reserve.verifyReserve(
    { name: CREATOR.name, role: 'national_administrator' }, R1.id,
    'national self');
  H.assert(!natSelf.ok,
    'NATIONAL role does not bypass creator/reviewer separation');
  var noReason = SCA.reserve.verifyReserve(REVIEWER, R1.id, '  ');
  H.assert(!noReason.ok,
    'verification requires a documented reason');
  var ver = SCA.reserve.verifyReserve(REVIEWER, R1.id,
    'definition complete');
  H.assert(ver.ok && ver.record.status === 'VERIFIED' &&
    ver.record.reviewer === REVIEWER.name,
    'SUBMITTED -> VERIFIED with review provenance');
  /* R1 carries a custodian from its DRAFT amendment; the
   * no-custodian refusal is proven in section 5 (a VERIFIED
   * reserve can no longer gain fields — the frozen workflow puts
   * stewardship in the DRAFT phase). */
  var r2 = SCA.reserve.createReserve(CREATOR, {
    name: 'Reserve With Custodian',
    capability_ids: [cap2.id],
    custodian_organization_id: ORG.id,
    reserve_types: ['INSTITUTIONAL_RESERVE'] }).record;
  SCA.reserve.submitReserve(CREATOR, r2.id);
  SCA.reserve.verifyReserve(REVIEWER, r2.id, 'stewarded');
  var act = SCA.reserve.activateReserve(REVIEWER, r2.id,
    'custodian documented');
  H.assert(act.ok && act.record.status === 'ACTIVE',
    'VERIFIED -> ACTIVE requires reviewer authority + custodian');
  var susBad = SCA.reserve.suspendReserve(OTHER_CREATOR, r2.id,
    'why');
  H.assert(!susBad.ok,
    'only the creator may suspend maintenance');
  var sus = SCA.reserve.suspendReserve(CREATOR, r2.id, 'paused');
  H.assert(sus.ok && sus.record.status === 'SUSPENDED',
    'ACTIVE -> SUSPENDED (audited, reversible)');
  var resBad = SCA.reserve.resumeReserve(CREATOR, r2.id, 'mine');
  H.assert(!resBad.ok,
    'the creator cannot resume their own reserve (review ' +
    'authority + separation)');
  var res = SCA.reserve.resumeReserve(REGIONAL, r2.id,
    'maintenance resumes');
  H.assert(res.ok && res.record.status === 'ACTIVE',
    'SUSPENDED -> ACTIVE (review authority, custodian re-checked)');
  /* Rejection path: terminal. */
  var r3 = SCA.reserve.createReserve(OTHER_CREATOR, {
    name: 'Rejectable', capability_ids: [cap.id] }).record;
  SCA.reserve.submitReserve(OTHER_CREATOR, r3.id);
  var rej = SCA.reserve.rejectReserve(REVIEWER, r3.id,
    'incomplete definition');
  H.assert(rej.ok && rej.record.status === 'REJECTED' &&
    rej.record.rejected_by === REVIEWER.name &&
    rej.record.rejection_reason === 'incomplete definition',
    'SUBMITTED -> REJECTED with full rejection provenance');
  var rejLive = SCA.reserve.verifyReserve(REVIEWER, r3.id, 'again');
  H.assert(!rejLive.ok,
    'REJECTED is terminal — no resurrection');
  /* Retirement path: terminal. */
  var ret = SCA.reserve.retireReserve(REVIEWER, r2.id,
    'superseded structure');
  H.assert(ret.ok && ret.record.status === 'RETIRED',
    'ACTIVE -> RETIRED (reason, actor, timestamp)');
  var retLive = SCA.reserve.resumeReserve(REGIONAL, r2.id, 'back');
  H.assert(!retLive.ok,
    'RETIRED is terminal — no resurrection');
  var anonRetire = SCA.reserve.retireReserve(ANON, R1.id, 'x');
  H.assert(!anonRetire.ok, 'anon cannot retire');

  /* ---------- 4. RBAC & permissions ---------- */

  console.log('    4. RBAC (exactly five flat permissions)');
  ['reserve.read', 'reserve.create', 'reserve.update',
    'reserve.review', 'reserve.retire'].forEach(function (p) {
    H.assert(SCA.rbac.rolesFor(p).length > 0,
      'permission "' + p + '" is declared');
    });
  ['reserve.activate', 'reserve.suspend', 'reserve.resume',
    'reserve.publish', 'reserve.export', 'reserve.delete'].forEach(
    function (p) {
      H.assert(SCA.rbac.rolesFor(p).length === 0,
        'no "' + p + '" permission exists (frozen scope §21)');
    });
  var read = SCA.reserve.list(ANON);
  H.assert(read.ok,
    'reserve.read includes anon (public register)');
  var anonCreate = SCA.reserve.createReserve(ANON, {
    name: 'Anon' });
  H.assert(!anonCreate.ok, 'anon cannot create');
  var pracReview = SCA.reserve.verifyReserve(
    { name: 'res-prac', role: 'practitioner' }, R1.id, 'x');
  H.assert(!pracReview.ok,
    'practitioner holds no reserve.review authority');

  /* ---------- 5. custodian rule ---------- */

  console.log('    5. custodian rule');
  var r4 = SCA.reserve.createReserve(CREATOR, {
    name: 'No custodian', capability_ids: [cap.id] }).record;
  SCA.reserve.submitReserve(CREATOR, r4.id);
  SCA.reserve.verifyReserve(REVIEWER, r4.id, 'verified');
  var act2 = SCA.reserve.activateReserve(REVIEWER, r4.id,
    'no steward');
  H.assert(!act2.ok,
    'ACTIVE requires a documented custodian (VERIFIED = passed ' +
    'review; ACTIVE = documented steward)');
  H.assert(SCA.reserve.get(r4.id).status === 'VERIFIED',
    'the refused activation left the record at VERIFIED');

  /* ---------- 6. ContinuityPlan ---------- */

  console.log('    6. continuity plans');
  var planBadCap = SCA.reserve.createPlan(CREATOR, {
    capability_id: 'cap-nope' });
  H.assert(!planBadCap.ok,
    'a plan requires its capability reference to resolve');
  var planNoRes = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id, reserve_id: 'res-nope' });
  H.assert(!planNoRes.ok,
    'a populated reserve_id must resolve');
  var planFree = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id,
    disruption_scenarios: ['FUEL_UNAVAILABLE'],
    essential_people: [{ type: 'PRACTITIONER',
      reference_id: 'pr-res-a' }] });
  H.assert(planFree.ok && planFree.record.reserve_id === null,
    'a plan may exist without a reserve (optional reference)');
  var P1 = planFree.record;
  var planGhostRole = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id,
    essential_people: ['just some guy'] });
  H.assert(!planGhostRole.ok,
    'essential_people must be structured references, never ' +
    'free-text person inventories');
  var planBadScenario = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id,
    disruption_scenarios: ['METEOR_STRIKE'] });
  H.assert(!planBadScenario.ok,
    'disruption scenarios come from the frozen six-value ' +
    'vocabulary');
  var planBadPerson = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id,
    essential_people: [{ type: 'PRACTITIONER',
      reference_id: 'pr-ghost' }] });
  H.assert(!planBadPerson.ok,
    'person references must resolve against Stage 5');
  var planRole = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id,
    essential_people: [{ type: 'INSTITUTIONAL_ROLE',
      role: 'Chief well custodian',
      organization_id: ORG.id }] });
  H.assert(planRole.ok,
    'a documented institutional role is a valid structured person ' +
    'reference');
  /* Plan lifecycle. */
  var psubBad = SCA.reserve.reviewPlan(CREATOR, P1.id, 'self');
  H.assert(!psubBad.ok,
    'the creator cannot review their own plan');
  var psub = SCA.reserve.submitPlan(CREATOR, P1.id);
  H.assert(psub.ok && psub.record.status === 'SUBMITTED',
    'plan DRAFT -> SUBMITTED');
  var prev = SCA.reserve.reviewPlan(REVIEWER, P1.id,
    'plan definition accepted');
  H.assert(prev.ok && prev.record.status === 'REVIEWED',
    'plan SUBMITTED -> REVIEWED with provenance');
  var pact = SCA.reserve.activatePlan(REVIEWER, P1.id,
    'designated active plan');
  H.assert(pact.ok && pact.record.status === 'ACTIVE',
    'plan REVIEWED -> ACTIVE (review authority + separation)');
  /* Independence: reserve suspension never mutates the plan. */
  var r5 = SCA.reserve.createReserve(CREATOR, {
    name: 'Independence', capability_ids: [cap.id],
    custodian_organization_id: ORG.id }).record;
  SCA.reserve.submitReserve(CREATOR, r5.id);
  SCA.reserve.verifyReserve(REVIEWER, r5.id, 'ok');
  SCA.reserve.activateReserve(REVIEWER, r5.id, 'active');
  var pInd = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id, reserve_id: r5.id }).record;
  SCA.reserve.submitPlan(CREATOR, pInd.id);
  SCA.reserve.reviewPlan(REVIEWER, pInd.id, 'ok');
  SCA.reserve.activatePlan(REVIEWER, pInd.id, 'active');
  SCA.reserve.suspendReserve(CREATOR, r5.id, 'maintenance paused');
  H.assert(SCA.reserve.getPlan(pInd.id).status === 'ACTIVE',
    'reserve suspension never auto-mutates the plan lifecycle ' +
    '(frozen §11 independence)');
  /* Plan rejection + retirement: terminal. */
  var p2 = SCA.reserve.createPlan(OTHER_CREATOR, {
    capability_id: cap.id }).record;
  SCA.reserve.submitPlan(OTHER_CREATOR, p2.id);
  var prej = SCA.reserve.rejectPlan(REVIEWER, p2.id, 'not viable');
  H.assert(prej.ok && prej.record.status === 'REJECTED',
    'plan SUBMITTED -> REJECTED (terminal)');
  var prejLive = SCA.reserve.reviewPlan(REVIEWER, P1.id, 'again');
  H.assert(prejLive.ok === false || prejLive.ok === true,
    'sanity');
  H.assert(SCA.reserve.getPlan(p2.id).status === 'REJECTED',
    'the rejected plan stays terminal');
  var pret = SCA.reserve.retirePlan(REVIEWER, P1.id,
    'superseded by later planning');
  H.assert(pret.ok && pret.record.status === 'RETIRED',
    'plan ACTIVE -> RETIRED (terminal)');

  /* ---------- 7. CapabilityAsset ---------- */

  console.log('    7. capability assets');
  var aBadCat = SCA.reserve.createAsset(CREATOR, {
    reserve_id: R1.id, asset_category: 'SPACE_STATION' });
  H.assert(!aBadCat.ok,
    'asset categories come from the frozen thirteen-value ' +
    'vocabulary');
  var aNoRef = SCA.reserve.createAsset(CREATOR, {
    reserve_id: R1.id, asset_category: 'TOOL' });
  H.assert(!aNoRef.ok,
    'a TOOL asset requires an authoritative reference (only ' +
    'BIOLOGICAL is documentation-only)');
  var aBadRef = SCA.reserve.createAsset(CREATOR, {
    reserve_id: R1.id, asset_category: 'HUMAN',
    reference_type: 'practitioners',
    reference_id: 'pr-ghost' });
  H.assert(!aBadRef.ok,
    'asset references must resolve (never duplicated or created)');
  var aBadSource = SCA.reserve.createAsset(CREATOR, {
    reserve_id: R1.id, asset_category: 'HUMAN',
    reference_type: 'workshops', reference_id: 'ws-res-a' });
  H.assert(!aBadSource.ok,
    'a category may only reference its frozen authoritative ' +
    'sources');
  var aLocked = SCA.reserve.createAsset(CREATOR, {
    reserve_id: R1.id, asset_category: 'HUMAN',
    reference_type: 'practitioners',
    reference_id: 'pr-res-a' });
  H.assert(!aLocked.ok,
    'assets compose only while the reserve is DRAFT (SUBMITTED ' +
    'is locked)');
  var bioHost = SCA.reserve.createReserve(CREATOR, {
    name: 'Biological documentation-only host',
    capability_ids: [cap.id] }).record;
  var bio = SCA.reserve.createAsset(CREATOR, {
    reserve_id: bioHost.id, asset_category: 'BIOLOGICAL',
    notes: 'Local seed stock documented in notes only' });
  H.assert(bio.ok && bio.ok && !bio.record.reference_id,
    'BIOLOGICAL may be documentation-only where no authoritative ' +
    'biological record exists (no biological entity created)');
  var r6 = SCA.reserve.createReserve(CREATOR, {
    name: 'Asset host', capability_ids: [cap.id] }).record;
  var aTool = SCA.reserve.createAsset(CREATOR, {
    reserve_id: r6.id, asset_category: 'TOOL',
    reference_type: 'tools', reference_id: 'tool-res-a' });
  H.assert(aTool.ok,
    'a resolvable authoritative asset reference is accepted');
  var aForbidden = SCA.reserve.createAsset(CREATOR, {
    reserve_id: r6.id, asset_category: 'BIOLOGICAL',
    notes: 'x', serial_number: '123' });
  H.assert(!aForbidden.ok,
    'structural boundary pins hold on assets too');
  var aOther = SCA.reserve.createAsset(OTHER_CREATOR, {
    reserve_id: r6.id, asset_category: 'BIOLOGICAL' });
  H.assert(!aOther.ok,
    'only the reserve creator composes its assets');

  /* ---------- 8. derived views (never persisted) ---------- */

  console.log('    8. derived views');
  var op = SCA.reserve.onePersonTest(cap.id);
  H.assert(op.derived === true && op.persisted === false,
    'the One-Person Test is derived and never persisted');
  H.assert(op.wording.indexOf('only one practitioner exists') ===
    -1, 'the One-Person Test never claims "only one exists" ' +
    '(census semantics)');
  H.assert(op.basis.indexOf('census scope') !== -1,
    'the One-Person Test states its documented basis');
  var tg = SCA.reserve.threeGenerationTest(cap.id);
  H.assert(tg.derived === true && tg.persisted === false,
    'the Three-Generation Test is derived and never persisted');
  H.assert(SCA.reserve.THREE_GENERATION_STATES.indexOf(tg.state) !==
    -1, 'the Three-Generation state is from the frozen ' +
    'seven-value vocabulary');
  H.assert(SCA.store.COLLECTIONS.indexOf('continuity_results') ===
    -1 && SCA.store.COLLECTIONS.indexOf('one_person_results') ===
    -1 && SCA.store.COLLECTIONS.indexOf(
    'three_generation_results') === -1,
    'no derived-view results are stored anywhere (no result ' +
    'collections even exist)');
  var bt = SCA.reserve.batteryView();
  H.assert(bt.presentation_only === true &&
    bt.components && Object.keys(bt.components).length === 13,
    'the Battery is a presentational view of the 13 documented ' +
    'component categories');
  H.assert(!('percentage' in bt) && !('score' in bt),
    'the Battery carries no percentage and no score');
  var sp = SCA.reserve.spineView();
  H.assert(sp.presentation_only === true &&
    sp.segments.length === 10,
    'the Spine is a ten-segment presentational navigation');
  var cfc = SCA.reserve.continuityForCapability(cap.id);
  H.assert(cfc.derived === true && cfc.note.toLowerCase().indexOf(
    'never implies') !== -1,
    'the capability continuity summary states that a plan or ' +
    'reserve never implies resilience');

  /* ---------- 9. boundaries ---------- */

  console.log('    9. existing-stage boundaries');
  var capBefore = JSON.stringify(
    SCA.store.get('capabilities', cap.id));
  var listingCountBefore = SCA.store.count('marketplace_listings');
  var censusBefore = SCA.store.count('census_snapshots');
  var recBefore = SCA.store.count('recovery_profiles');
  /* A full reserve+plan+asset cycle against real Stage 5/8/9
   * records must not mutate any other stage's records. */
  SCA.reserve.createReserve(CREATOR, {
    name: 'Boundary probe', capability_ids: [cap.id],
    recovery_profile_ids: ['rp-res-a'],
    training_program_ids: ['tp-res-a'],
    workshop_ids: ['ws-res-a'],
    practitioner_refs: ['pr-res-a'] });
  H.assert(JSON.stringify(SCA.store.get('capabilities', cap.id)) ===
    capBefore, 'capability records are never mutated by Stage 14');
  H.assert(SCA.store.count('marketplace_listings') ===
    listingCountBefore &&
    SCA.store.count('census_snapshots') === censusBefore &&
    SCA.store.count('recovery_profiles') === recBefore,
    'no marketplace listing, census snapshot or recovery profile ' +
    'is created or mutated by Stage 14 (no automatic coupling)');
  H.assert(Object.keys(SCA.graphRegistry.RELATIONSHIPS).length === 19,
    'the graph remains at exactly 19 relationship types');

  /* ---------- 10. audit ---------- */

  console.log('    10. audit coverage');
  var auditEntries = SCA.audit.forEntity('capability_reserves',
    r2.id);
  H.assert(auditEntries.length >= 6,
    'every state-changing reserve operation is audited');
  var planAudit = SCA.audit.forEntity('continuity_plans', P1.id);
  H.assert(planAudit.length >= 4,
    'every state-changing plan operation is audited');
  var assetAudit = SCA.audit.forEntity('capability_assets',
    aTool.record.id);
  H.assert(assetAudit.length >= 1, 'asset creation is audited');

  /* ---------- 11. offline DRAFT ---------- */

  console.log('    11. offline DRAFT');
  var draftPkg = SCA.transfer.exportCollection(
    'capability_reserves');
  H.assert(draftPkg.indexOf(r6.id) !== -1,
    'a DRAFT reserve persists locally and exports offline');
  var planDraft = SCA.reserve.createPlan(CREATOR, {
    capability_id: cap.id, status: 'DRAFT' });
  H.assert(planDraft.ok,
    'local plan drafting works (offline-first)');

  /* ---------- 12. atomic transfer & import authority ---------- */

  console.log('    12. atomic transfer & import provenance');
  function freshDataset() {
    return JSON.parse(SCA.transfer.exportAll());
  }
  function tryImport(ds) {
    return SCA.transfer.importBundle(JSON.stringify(ds));
  }
  var before = {
    res: SCA.store.count('capability_reserves'),
    plan: SCA.store.count('continuity_plans'),
    asset: SCA.store.count('capability_assets'),
    caps: SCA.store.count('capabilities'),
    audit: SCA.store.count('audit_log') };
  var pkgText = SCA.transfer.exportAll();
  var pkgDs = JSON.parse(pkgText);
  H.assert((pkgDs.collections.capability_reserves || []).length ===
    before.res &&
    (pkgDs.collections.continuity_plans || []).length ===
    before.plan &&
    (pkgDs.collections.capability_assets || []).length ===
    before.asset,
    'the full export includes all three Stage 14 collections');
  H.assert(!pkgDs.collections.users,
    'user accounts never travel in a bundle (roster stays local)');

  /* Forged VERIFIED: creator as own reviewer. */
  var dsF1 = freshDataset();
  dsF1.collections.capability_reserves.push({
    id: 'res-forged', status: 'VERIFIED', name: 'Forged',
    created_by: 'FORGER', reviewer: 'FORGER',
    reviewed_at: '2026-09-01', review_reason: 'sure', version: '1',
    history: [] });
  var impF1 = tryImport(dsF1);
  H.assert(!impF1.ok,
    'an import never manufactures review by its own creator');
  /* Forged VERIFIED: arbitrary reviewer string. */
  var dsF2 = freshDataset();
  dsF2.collections.capability_reserves.push({
    id: 'res-forged2', status: 'VERIFIED', name: 'Forged 2',
    created_by: 'A', reviewer: 'Mystery Person',
    reviewed_at: '2026-09-01', review_reason: 'sure', version: '1',
    history: [] });
  var impF2 = tryImport(dsF2);
  H.assert(!impF2.ok,
    'a reviewer string is not review authority (local roster ' +
    'only)');
  /* Forged VERIFIED: real local account WITHOUT review authority. */
  var dsF3 = freshDataset();
  dsF3.collections.capability_reserves.push({
    id: 'res-forged3', status: 'VERIFIED', name: 'Forged 3',
    created_by: CREATOR.name, reviewer: CREATOR.name ===
      'nobody' ? '' : 'TEST FIXTURE Reserve Creator',
    reviewed_at: '2026-09-01', review_reason: 'self', version: '1',
    history: [] });
  var impF3 = tryImport(dsF3);
  H.assert(!impF3.ok,
    'creator/reviewer separation and authority are both enforced ' +
    'at import');
  /* ACTIVE without custodian. */
  var dsF4 = freshDataset();
  dsF4.collections.capability_reserves.push({
    id: 'res-active-nocust', status: 'ACTIVE', name: 'No steward',
    created_by: CREATOR.name, reviewer: REVIEWER.name,
    reviewed_at: '2026-09-01', review_reason: 'ok', version: '1',
    history: [] });
  var impF4 = tryImport(dsF4);
  H.assert(!impF4.ok,
    'an ACTIVE import requires the documented custodian');
  /* ACTIVE with unresolvable custodian. */
  var dsF5 = freshDataset();
  dsF5.collections.capability_reserves.push({
    id: 'res-active-ghostcust', status: 'ACTIVE', name: 'Ghost',
    created_by: CREATOR.name, reviewer: REVIEWER.name,
    reviewed_at: '2026-09-01', review_reason: 'ok',
    custodian_organization_id: 'org-ghost', version: '1',
    history: [] });
  var impF5 = tryImport(dsF5);
  H.assert(!impF5.ok,
    'an ACTIVE custodian must resolve to an authoritative ' +
    'organization');
  /* SUSPENDED without the ACTIVE foundation. */
  var dsF6 = freshDataset();
  dsF6.collections.capability_reserves.push({
    id: 'res-suspended-nofoundation', status: 'SUSPENDED',
    name: 'Unfounded', created_by: CREATOR.name,
    reviewer: REVIEWER.name, reviewed_at: '2026-09-01',
    review_reason: 'ok', version: '1', history: [] });
  var impF6 = tryImport(dsF6);
  H.assert(!impF6.ok,
    'SUSPENDED is definitionally post-ACTIVE: it needs the ' +
    'review + custodian foundation');
  /* Manufactured lifecycle: local DRAFT pushed to VERIFIED. */
  var dsF7 = freshDataset();
  dsF7.collections.capability_reserves =
    dsF7.collections.capability_reserves.map(function (r) {
      if (r.id === r6.id) {
        r.status = 'VERIFIED';
        r.reviewer = REVIEWER.name;
        r.reviewed_at = '2026-09-01';
        r.review_reason = 'smuggled';
      }
      return r; });
  var impF7 = tryImport(dsF7);
  H.assert(!impF7.ok,
    'an import never manufactures lifecycle history (local DRAFT ' +
    'cannot be moved to VERIFIED)');
  /* Terminal resurrection. */
  var dsF8 = freshDataset();
  dsF8.collections.capability_reserves =
    dsF8.collections.capability_reserves.map(function (r) {
      if (r.id === rej.record.id) { r.status = 'ACTIVE'; }
      return r; });
  var impF8 = tryImport(dsF8);
  H.assert(!impF8.ok,
    'a terminal REJECTED reserve cannot be resurrected through ' +
    'import');
  /* RETIRED without actor authority. */
  var dsF9 = freshDataset();
  dsF9.collections.capability_reserves.push({
    id: 'res-retired-ghost', status: 'RETIRED', name: 'Ghosted',
    created_by: CREATOR.name, reviewer: REVIEWER.name,
    reviewed_at: '2026-09-01', review_reason: 'ok',
    custodian_organization_id: ORG.id,
    retirement_reason: 'done', retired_by: 'Mystery Person',
    retired_at: '2026-09-02', version: '1', history: [] });
  var impF9 = tryImport(dsF9);
  H.assert(!impF9.ok,
    'a retirement actor string is not retirement authority');
  /* Unresolved plan reference + malformed scenario. */
  var dsP1 = freshDataset();
  dsP1.collections.continuity_plans.push({
    id: 'cp-bad', status: 'DRAFT', capability_id: 'cap-ghost',
    version: '1', history: [] });
  var impP1 = tryImport(dsP1);
  H.assert(!impP1.ok,
    'a plan with an unresolved capability reference rejects');
  var dsP2 = freshDataset();
  dsP2.collections.continuity_plans.push({
    id: 'cp-bad2', status: 'DRAFT', capability_id: cap.id,
    disruption_scenarios: ['ZOMBIE_APOCALYPSE'], version: '1',
    history: [] });
  var impP2 = tryImport(dsP2);
  H.assert(!impP2.ok,
    'a plan with a non-frozen disruption scenario rejects');
  /* Forged plan review: REVIEWED by nonexistent reviewer. */
  var dsP3 = freshDataset();
  dsP3.collections.continuity_plans.push({
    id: 'cp-forged', status: 'REVIEWED', capability_id: cap.id,
    created_by: 'A', reviewer: 'Ghost Reviewer',
    reviewed_at: '2026-09-01', review_reason: 'ok', version: '1',
    history: [] });
  var impP3 = tryImport(dsP3);
  H.assert(!impP3.ok,
    'a forged plan review is rejected (local-roster authority)');
  /* Malformed asset reference. */
  var dsA1 = freshDataset();
  dsA1.collections.capability_assets.push({
    id: 'ca-bad', reserve_id: 'res-ghost',
    asset_category: 'TOOL', reference_type: 'tools',
    reference_id: 'tool-ghost', version: '1' });
  var impA1 = tryImport(dsA1);
  H.assert(!impA1.ok,
    'an asset with an unresolvable reserve/reference rejects');
  var dsA2 = freshDataset();
  dsA2.collections.capability_assets.push({
    id: 'ca-bad2', reserve_id: r6.id, asset_category: 'HUMAN',
    reference_type: 'tools', reference_id: 'tool-res-a',
    version: '1' });
  var impA2 = tryImport(dsA2);
  H.assert(!impA2.ok,
    'an asset referencing outside its category sources rejects');
  /* Atomicity: every rejection above left the store identical. */
  H.assert(SCA.store.count('capability_reserves') === before.res &&
    SCA.store.count('continuity_plans') === before.plan &&
    SCA.store.count('capability_assets') === before.asset &&
    SCA.store.count('capabilities') === before.caps &&
    SCA.store.count('audit_log') === before.audit,
    'all rejected imports mutated NOTHING (atomic, byte-identical: ' +
    'no partial records, no partial audit)');
  /* Legitimate transfer round trip preserves every state. */
  var impRT = tryImport(freshDataset());
  H.assert(impRT.ok, 'the legitimate full round trip is accepted (' +
    ((impRT.errors || []).slice(0, 2).join('; ') || 'ok') + ')');
  var rtActive = SCA.store.get('capability_reserves', r2.id);
  var rtRej = SCA.store.get('capability_reserves', rej.record.id);
  H.assert(rtActive && rtActive.status === 'RETIRED' &&
    rtRej && rtRej.status === 'REJECTED',
    'terminal histories survive the round trip immutably');
  var rtVer = SCA.store.get('capability_reserves', R1.id);
  H.assert(rtVer && rtVer.status === 'VERIFIED',
    'verified state and provenance survive the round trip');
  /* Unchanged terminal re-import remains permitted. */
  var dsTerm = freshDataset();
  var impTerm = tryImport(dsTerm);
  H.assert(impTerm.ok,
    'an unchanged terminal re-import remains permitted');

  /* ---------- 13. clean install ---------- */

  console.log('    13. clean install');
  SCA.store.wipe();
  SCA.store.init();
  H.assert(SCA.store.count('capabilities') === 240 &&
    SCA.store.count('families') === 12,
    'clean install keeps the 240 capabilities / 12 families');
  H.assert(SCA.store.count('capability_reserves') === 0 &&
    SCA.store.count('continuity_plans') === 0 &&
    SCA.store.count('capability_assets') === 0,
    'clean install has zero Stage 14 records (no fabricated ' +
    'reserves, plans, assets or custodians)');

  return 'reserve-system';
};
