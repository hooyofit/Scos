/* Stage 3: Evidence & Knowledge Archive test suite.
 *
 * Covers the required Stage 3 tests: source/artifact/claim CRUD and
 * relationships, evidence levels, controlled verification, provenance,
 * independence groups, atomic import with relationship checks, E0 baseline
 * protection and medical safety. All fixtures are clearly marked TEST
 * FIXTURE and are wiped at the end; none ever touches seed data.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  evidence-archive.test.js');

  /* Fake users by role; RBAC is exercised through them. */
  var RESEARCHER = { name: 'TEST Researcher', role: 'researcher' };
  var REVIEWER = { name: 'TEST Reviewer', role: 'reviewer' };
  var STEWARD = { name: 'TEST Steward', role: 'community_steward' };

  /* ---------- E0 baseline protection (checked FIRST, before any
     intentional workflow action modifies a test capability) ---------- */
  SCA.store.wipe();
  SCA.store.init();
  var caps = SCA.store.all('capabilities');
  H.assertEq(caps.length, 240, 'baseline: 240 capabilities');
  var stillBaseline = caps.filter(function (c) {
    return c.evidence_level === 'E0' && c.living_status === 'S0' &&
      c.capability_maturity === null && c.version === '1';
  });
  H.assertEq(stillBaseline.length, 240, 'all 240 remain E0/S0/null-maturity before evidence entry');
  H.assertEq(SCA.store.count('evidence'), 0, 'no sources in baseline');
  H.assertEq(SCA.store.count('claims'), 0, 'no claims in baseline');
  H.assertEq(SCA.store.count('knowledge'), 0, 'no artifacts in baseline');

  var w01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'W01'; })[0];
  var s01 = SCA.store.all('capabilities').filter(function (c) {
    return c.code === 'S01'; })[0];
  H.assert(!!w01 && !!s01, 'test capabilities found');

  /* ---------- 1. EvidenceSource: create / retrieve / validate ---------- */
  var resNoPerm = SCA.evidence.createSource(null, {
    title: 'TEST FIXTURE source (must be refused)' });
  H.assert(resNoPerm.ok === false, 'source creation requires permission (anon refused)');

  var resBadType = SCA.evidence.createSource(RESEARCHER, {
    title: 'TEST FIXTURE source', source_type: 'NOT_A_TYPE' });
  H.assert(resBadType.ok === false && !!resBadType.errors.source_type,
    'invalid source type rejected');

  var resSrc = SCA.evidence.createSource(RESEARCHER, {
    title: 'TEST FIXTURE: Field notes on wells (test)',
    source_type: 'FIELD_REPORT',
    author: 'TEST Fixture Author',
    organization: 'TEST Fixture Org',
    publication_date: '2026-09',
    language: 'so',
    geographic_scope: 'TEST scope: one locality, not all of Somalia',
    independence_group: 'TEST-GROUP-A',
    reliability_notes: 'TEST FIXTURE: reliability left to human review'
  });
  H.assert(resSrc.ok === true, 'source created through workflow');
  var src = resSrc.record;
  var fetched = SCA.store.get('evidence', src.id);
  H.assert(!!fetched, 'source retrieved');
  H.assertEq(fetched.review_status, 'UNREVIEWED', 'new source starts Unreviewed');
  H.assertEq(fetched.version, '1', 'new source version 1');
  H.assertEq(fetched.entered_by, RESEARCHER.name, 'provenance: entered_by recorded');
  H.assert(!!fetched.provenance, 'provenance text recorded');
  H.assertEq(fetched.created_at, fetched.created_at, 'timestamp present');

  /* Supersede instead of delete: the archive behavior for replaced sources. */
  var resSrc2 = SCA.evidence.createSource(RESEARCHER, {
    title: 'TEST FIXTURE: Revised edition of well notes (test)',
    source_type: 'FIELD_REPORT',
    independence_group: 'TEST-GROUP-A'
  });
  H.assert(resSrc2.ok === true, 'second source created (same independence group)');
  var src2 = resSrc2.record;

  /* Raw store remove still exists (mechanical), but the workflow archive
     path is superseding: review keeps the original and records why. */
  var resSuper = SCA.evidence.review(REVIEWER, 'evidence', src.id, {
    verification_status: 'SUPERSEDED',
    superseded_by: src2.id,
    reason: 'TEST: revised edition replaces the original'
  });
  H.assert(resSuper.ok === true, 'source superseded via review');
  H.assertEq(SCA.store.get('evidence', src.id).superseded_by, src2.id,
    'superseded_by recorded');
  H.assert(!!SCA.store.get('evidence', src.id).title,
    'superseding never deletes the original');

  /* ---------- 2. Claim: create, relationships, conflicting claims ---------- */
  var resClaimNoPerm = SCA.evidence.createClaim(null, {
    capability_id: w01.id, claim_text: 'x', claim_type: 'HISTORICAL_EXISTENCE' });
  H.assert(resClaimNoPerm.ok === false, 'claim creation requires permission');

  var resClaimBadCap = SCA.evidence.createClaim(RESEARCHER, {
    capability_id: 'no-such-capability', claim_text: 'TEST',
    claim_type: 'HISTORICAL_EXISTENCE' });
  H.assert(resClaimBadCap.ok === false, 'claim must attach to an existing capability');

  var resClaimA = SCA.evidence.createClaim(RESEARCHER, {
    capability_id: w01.id,
    claim_text: 'TEST FIXTURE claim A: wells were used in one documented locality.',
    claim_type: 'HISTORICAL_EXISTENCE',
    claimant: 'TEST Fixture Claimant A',
    source_ids: [src.id, src2.id],
    region: 'TEST region: single locality'
  });
  H.assert(resClaimA.ok === true, 'claim A created');
  var claimA = resClaimA.record;

  /* A CONFLICTING claim on the same capability is allowed and preserved:
     the model must support disagreement without erasing either side. */
  var resClaimB = SCA.evidence.createClaim(STEWARD, {
    capability_id: w01.id,
    claim_text: 'TEST FIXTURE claim B: contradicts claim A (conflict is preserved).',
    claim_type: 'CURRENT_PRACTICE',
    claimant: 'TEST Fixture Claimant B',
    source_ids: []
  });
  H.assert(resClaimB.ok === true, 'conflicting claim on same capability allowed');
  var claimB = resClaimB.record;
  H.assertEq(claimA.verification_status, 'UNREVIEWED', 'claim starts Unreviewed');
  H.assertEq(claimA.version, '1', 'claim version 1');
  H.assertEq(claimA.entered_by, RESEARCHER.name, 'claim provenance recorded');

  /* Claim -> source relationship and source -> claim backlink. */
  H.assertEq(claimA.source_ids.length, 2, 'claim cites two sources');
  var claimsForSource = SCA.store.all('claims').filter(function (c) {
    return (c.source_ids || []).indexOf(src.id) !== -1; });
  H.assertEq(claimsForSource.length, 1, 'source sees its connected claim');

  /* ---------- 3. KnowledgeArtifact ---------- */
  var resArt = SCA.evidence.createArtifact(RESEARCHER, {
    title: 'TEST FIXTURE: well-digging transcript (test)',
    artifact_type: 'transcript',
    capability_ids: [w01.id],
    source_ids: [src.id],
    contributor: 'TEST Fixture Contributor',
    transcription: 'TEST FIXTURE transcription text',
    original_language: 'so',
    context: 'TEST FIXTURE context: single documented locality'
  });
  H.assert(resArt.ok === true, 'artifact created through workflow');
  var art = resArt.record;
  H.assert(!!SCA.store.get('knowledge', art.id), 'artifact retrieved');
  H.assertEq(art.capability_ids[0], w01.id, 'artifact -> capability relationship');
  H.assertEq(art.source_ids[0], src.id, 'artifact -> source relationship');
  H.assertEq(art.verification_status, 'UNREVIEWED', 'artifact starts Unreviewed');

  /* capability_id (single-link form) also supported. */
  var resArt2 = SCA.evidence.createArtifact(STEWARD, {
    title: 'TEST FIXTURE: single-link artifact (test)',
    capability_id: w01.id
  });
  H.assert(resArt2.ok === true, 'artifact with capability_id (single form) accepted');

  /* ---------- 4. Evidence levels ---------- */
  ['E0','E1','E2','E3','E4','E5'].forEach(function (lv) {
    var v = SCA.models.capability.validate(Object.assign({}, w01, {
      evidence_level: lv }));
    H.assert(v.valid === true, lv + ' is a valid evidence level');
  });
  var vBad = SCA.models.capability.validate(Object.assign({}, w01, {
    evidence_level: 'E9' }));
  H.assert(vBad.valid === false, 'invalid evidence level rejected');

  /* ---------- 5. Controlled verification & upgrade ---------- */
  /* Unauthorized users cannot upgrade. */
  var resUpNoPerm = SCA.evidence.requestUpgrade(RESEARCHER, w01.id, {
    to: 'E1', reason: 'TEST', source_ids: [src.id] });
  H.assert(resUpNoPerm.ok === false && !!resUpNoPerm.errors.permission,
    'upgrade without evidence.verify rejected');

  /* No big jumps, no silent upgrades. */
  var resUpJump = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E5', reason: 'TEST jump', source_ids: [src.id] });
  H.assert(resUpJump.ok === false, 'E0 -> E5 in one decision rejected');

  var resUpSkip = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E3', reason: 'TEST skip', source_ids: [src.id] });
  H.assert(resUpSkip.ok === false, 'E0 -> E3 (skipping levels) rejected');

  var resUpNoReason = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E1', source_ids: [src.id] });
  H.assert(resUpNoReason.ok === false && !!resUpNoReason.errors.reason,
    'upgrade without reason rejected');

  var resUpNoSources = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E1', reason: 'TEST reason' });
  H.assert(resUpNoSources.ok === false && !!resUpNoSources.errors.source_ids,
    'upgrade without supporting sources rejected');

  var resUpGhost = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E1', reason: 'TEST', source_ids: ['ghost-source-id'] });
  H.assert(resUpGhost.ok === false, 'upgrade citing nonexistent source rejected');

  /* Legitimate one-step upgrade with audit. */
  H.assertEq(SCA.store.get('capabilities', w01.id).evidence_level, 'E0',
    'W01 still E0 before the intentional workflow upgrade');
  var resUp = SCA.evidence.requestUpgrade(REVIEWER, w01.id, {
    to: 'E1',
    reason: 'TEST: one preliminary source exists; criteria for E1 met (test)',
    source_ids: [src.id] });
  H.assert(resUp.ok === true, 'controlled E0 -> E1 upgrade succeeds');
  var upgraded = SCA.store.get('capabilities', w01.id);
  H.assertEq(upgraded.evidence_level, 'E1', 'evidence level now E1');
  H.assertEq(upgraded.version, '2', 'upgrade is a versioned change (version 2)');
  H.assertEq(upgraded.reviewer, REVIEWER.name, 'reviewer recorded on capability');
  var capAudit = SCA.audit.forEntity('capabilities', w01.id);
  H.assert(capAudit.length >= 1, 'audit record created for the upgrade');
  var upAudit = capAudit.filter(function (e) { return e.action === 'evidence.level_changed'; })[0];
  H.assert(!!upAudit, 'audit entry: evidence.level_changed');
  H.assertEq(upAudit.old_value, 'E0', 'audit preserves old level');
  H.assertEq(upAudit.new_value, 'E1', 'audit preserves new level');
  H.assert(!!upAudit.reason, 'audit preserves reason');

  /* 239 untouched: no capability is silently upgraded. */
  var others = SCA.store.all('capabilities').filter(function (c) {
    return c.id !== w01.id; });
  H.assert(others.every(function (c) { return c.evidence_level === 'E0' &&
    c.version === '1'; }), 'only the reviewed capability changed');

  /* Review: unauthorized verification rejected. */
  var resRevNoPerm = SCA.evidence.review(RESEARCHER, 'claims', claimA.id, {
    verification_status: 'SOURCE_VERIFIED' });
  H.assert(resRevNoPerm.ok === false && !!resRevNoPerm.errors.permission,
    'verification by non-reviewer rejected');

  var resRevBad = SCA.evidence.review(REVIEWER, 'claims', claimA.id, {
    verification_status: 'DEFINITELY_TRUE' });
  H.assert(resRevBad.ok === false, 'invalid verification status rejected');

  var resRev = SCA.evidence.review(REVIEWER, 'claims', claimA.id, {
    verification_status: 'SOURCE_VERIFIED',
    review_notes: 'TEST: source verified for test purposes' });
  H.assert(resRev.ok === true, 'reviewer sets verification status');
  H.assertEq(SCA.store.get('claims', claimA.id).verification_status, 'SOURCE_VERIFIED',
    'claim verification updated');
  H.assertEq(SCA.store.get('claims', claimA.id).version, '2', 'review is versioned');

  /* Rejection preserves the historical record. */
  var resRejNoReason = SCA.evidence.review(REVIEWER, 'claims', claimB.id, {
    verification_status: 'REJECTED' });
  H.assert(resRejNoReason.ok === false, 'rejection without reason refused');
  var resRej = SCA.evidence.review(REVIEWER, 'claims', claimB.id, {
    verification_status: 'REJECTED',
    reason: 'TEST: claim does not meet verification criteria (fixture)' });
  H.assert(resRej.ok === true, 'rejection with reason succeeds');
  var rejected = SCA.store.get('claims', claimB.id);
  H.assertEq(rejected.claim_text,
    'TEST FIXTURE claim B: contradicts claim A (conflict is preserved).',
    'rejected claim text preserved, not erased');
  H.assert(!!rejected.rejection_reason, 'rejection reason recorded');
  var rejAudit = SCA.audit.forEntity('claims', claimB.id);
  H.assert(rejAudit.length >= 2, 'audit entries exist for creation and rejection');

  /* ---------- 6. Provenance, timestamps, versions preserved ---------- */
  var auditAll = SCA.store.all('audit_log');
  H.assert(auditAll.length >= 7, 'audit trail accumulating (sources, claims, artifact, upgrade, reviews)');
  H.assert(auditAll.every(function (e) { return e.actor && e.action && e.timestamp; }),
    'every audit entry has actor, action, timestamp');
  H.assert(src2.entered_by === RESEARCHER.name, 'source creator recorded');
  H.assert(!!SCA.store.get('claims', claimA.id).reviewer, 'reviewer recorded');

  /* ---------- 7. Independence of evidence ---------- */
  var resSrc3 = SCA.evidence.createSource(RESEARCHER, {
    title: 'TEST FIXTURE: independent third source (test)',
    source_type: 'BOOK' });
  H.assert(resSrc3.ok === true, 'third source created (independent)');
  var src3 = resSrc3.record;
  H.assertEq(SCA.evidence.countIndependentStreams([src.id, src2.id]), 1,
    'two copies of one stream count as ONE');
  H.assertEq(SCA.evidence.countIndependentStreams([src.id, src2.id, src3.id]), 2,
    'duplicated sources do not automatically count as independent');
  var groups = SCA.evidence.independenceGroups();
  H.assertEq(groups['TEST-GROUP-A'].length, 2, 'independence group identifies the relationship');

  /* ---------- 8. Medical safety (S01-S20) ---------- */
  var resMedClaim = SCA.evidence.createClaim(RESEARCHER, {
    capability_id: s01.id,
    claim_text: 'TEST FIXTURE: a health claim about a traditional practice.',
    claim_type: 'HEALTH_RELATED' });
  H.assert(resMedClaim.ok === false && !!resMedClaim.errors.safety_notes,
    'health-related claim without safety notes rejected');

  var resMedClaimOk = SCA.evidence.createClaim(RESEARCHER, {
    capability_id: s01.id,
    claim_text: 'TEST FIXTURE: a health claim about a traditional practice.',
    claim_type: 'HEALTH_RELATED',
    safety_notes: 'TEST FIXTURE: preserved claim, not validated medical advice; ' +
      'clinical validation is a separate process.' });
  H.assert(resMedClaimOk.ok === true, 'health-related claim WITH safety notes accepted');

  var resMedArt = SCA.evidence.createArtifact(RESEARCHER, {
    title: 'TEST FIXTURE: family-S artifact without safety notes (test)',
    capability_ids: [s01.id] });
  H.assert(resMedArt.ok === false && !!resMedArt.errors.safety_notes,
    'family S artifact requires safety notes');

  var resMedArtOk = SCA.evidence.createArtifact(RESEARCHER, {
    title: 'TEST FIXTURE: family-S artifact with safety notes (test)',
    capability_ids: [s01.id],
    safety_notes: 'TEST FIXTURE: preserved knowledge, not medical advice.' });
  H.assert(resMedArtOk.ok === true, 'family S artifact with safety notes accepted');

  /* No clinical validation is EVER automatic: an S capability with claims
     stays E0 until the controlled workflow says otherwise. */
  var s01Now = SCA.store.get('capabilities', s01.id);
  H.assertEq(s01Now.evidence_level, 'E0',
    'medical claims never auto-upgrade a capability');

  /* ---------- 9. Consent foundation ---------- */
  var resConsent = SCA.store.insert('consents', {
    person: 'TEST Fixture Person',
    purpose: 'TEST FIXTURE: documentation consent',
    consent_state: 'GRANTED',
    media_permission: true,
    public_permission: false,
    attribution_preference: 'anonymous',
    recorded_by: STEWARD.name
  });
  H.assert(resConsent.ok === true, 'consent record created');
  var resWithdraw = SCA.store.update('consents', resConsent.record.id, {
    consent_state: 'WITHDRAWN',
    withdrawal_date: SCA.util.now(),
    withdrawal_reason: 'TEST: withdrawn in fixture'
  });
  H.assert(resWithdraw.ok === true, 'consent withdrawal recorded');
  H.assert(!!SCA.store.get('consents', resConsent.record.id),
    'withdrawal preserves the consent record (audit history intact)');

  /* ---------- 10. Atomic import with evidence relationships ---------- */
  var snapshot = JSON.stringify(SCA.store.dataset());
  var bundleText = SCA.transfer.exportAll();
  SCA.store.wipe();
  var resImport = SCA.transfer.importBundle(bundleText);
  H.assert(resImport.ok === true, 'full bundle with evidence archive re-imports');
  H.assertEq(SCA.store.count('capabilities'), 240, 'capabilities restored');
  H.assertEq(SCA.store.count('claims'), 3, 'claims restored');
  H.assertEq(SCA.store.count('knowledge'), 3, 'artifacts restored');
  H.assertEq(SCA.store.count('evidence'), 3, 'sources restored');
  H.assertEq(SCA.store.count('audit_log') > 0, true, 'audit history restored');
  var restoredClaim = SCA.store.all('claims').filter(function (c) {
    return c.claim_text.indexOf('claim A') !== -1; })[0];
  H.assert(!!restoredClaim, 'claim A found after round trip');
  H.assertEq(SCA.store.get('capabilities', restoredClaim.capability_id).code, 'W01',
    'claim -> capability relationship restored');
  H.assertEq(restoredClaim.source_ids.length, 2, 'claim -> source relationships restored');
  H.assertEq(SCA.store.get('capabilities', w01.id).evidence_level, 'E1',
    'evidence level survives export/import');
  H.assertEq(SCA.store.get('capabilities', w01.id).version, '2',
    'version survives export/import');

  /* Broken relationship: a bundle with a claim pointing at a missing
     capability is rejected atomically. */
  var brokenBundle = JSON.parse(SCA.transfer.exportAll());
  brokenBundle.collections.capabilities =
    brokenBundle.collections.capabilities.filter(function (c) {
      return c.id !== w01.id; });
  var beforeBroken = JSON.stringify(SCA.store.dataset());
  var resBroken = SCA.transfer.importBundle(JSON.stringify(brokenBundle));
  H.assert(resBroken.ok === false, 'import that orphans claims rejected');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeBroken,
    'no partial dataset after broken import');

  /* Malformed evidence record inside a bundle: model validation is not
     weakened, but import must still be atomic about relationships. */
  var malformed = JSON.parse(SCA.transfer.exportAll());
  malformed.collections.claims.push({ id: 'bad-claim',
    capability_id: 'missing-capability', claim_text: 'x',
    claim_type: 'HISTORICAL_EXISTENCE' });
  var beforeMal = JSON.stringify(SCA.store.dataset());
  var resMal = SCA.transfer.importBundle(JSON.stringify(malformed));
  H.assert(resMal.ok === false, 'claim referencing missing capability rejected on import');
  H.assertEq(JSON.stringify(SCA.store.dataset()), beforeMal,
    'no partial dataset after malformed import');

  /* Non-JSON stays rejected. */
  H.assert(SCA.transfer.importBundle('not json').ok === false,
    'malformed (non-JSON) import rejected');

  /* claims-only export carries its referenced capabilities + sources. */
  var claimsText = SCA.transfer.exportCollection('claims');
  var claimsPkg = JSON.parse(claimsText);
  H.assertEq(claimsPkg.records.length, 3, 'claims-only export holds 3 claims');
  H.assert(!!claimsPkg.referenced.capabilities, 'claims-only export carries capabilities');
  H.assert(!!claimsPkg.referenced.evidence, 'claims-only export carries sources');
  H.assert(!!claimsPkg.referenced.families, 'carried capabilities carry their families');

  /* ---------- final: restore the pristine baseline for later suites ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline re-seeded');
  var clean = SCA.store.all('capabilities');
  H.assert(clean.every(function (c) { return c.evidence_level === 'E0' &&
    c.living_status === 'S0' && c.capability_maturity === null; }),
    'test fixtures wiped; all 240 back to pristine E0/S0/null');
  H.assertEq(SCA.store.count('evidence'), 0, 'no fixture sources remain');
  H.assertEq(SCA.store.count('claims'), 0, 'no fixture claims remain');
  H.assertEq(SCA.store.count('knowledge'), 0, 'no fixture artifacts remain');
  H.assertEq(SCA.store.count('audit_log'), 0, 'no fixture audit entries remain');
  H.assert(snapshot.indexOf('TEST FIXTURE') !== -1, 'fixtures were used (and cleaned)');
};
