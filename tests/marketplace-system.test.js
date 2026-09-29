/*
 * Stage 13: Capability Marketplace (frozen scope v1.0 +
 * implementation authorization v1.0).
 *
 * Suite contract:
 *  1.  Exactly one domain entity; ghost-entity/field scan.
 *  2.  Creation & frozen vocabularies (kinds, 12 service kinds,
 *      5 availability values, provider types, location scopes).
 *  3.  Privacy is structural (no contact fields; on-behalf-of
 *      audited; no fabricated community authorship).
 *  4.  Provider references (existing records only, all 4 types).
 *  5.  Capability / repair / location references (canonical only;
 *      zero capability links is honest).
 *  6.  Geography rules (SPECIFIC/ANYWHERE; no inference).
 *  7.  Lifecycle: transitions, edit locks, terminal immutability,
 *      no resurrection, no automatic transitions.
 *  8.  Reviewer separation incl. NATIONAL (service layer).
 *  9.  Publication gate: provider must be publicly visible.
 * 10.  Provider retirement: honest rendering, NO auto mutation.
 * 11.  Availability amendments (PUBLISHED only, audited).
 * 12.  Pause/resume (audited; matching/public exclusion).
 * 13.  Matching: derived, read-only, basis displayed, deterministic.
 * 14.  Deterministic ordering; no ranking fields anywhere.
 * 15.  RBAC: exactly five flat permissions; anon visibility.
 * 16.  Graph boundary (19 types; listing is not a node).
 * 17.  Stage 10/11/12 boundaries (no coupling, no marketplace
 *      measurements, no indicator changes).
 * 18.  Audit coverage for every state-changing operation.
 * 19.  Anonymous visibility (PUBLISHED only).
 * 20.  Offline DRAFT (local persistence; no optimistic PUBLISHED).
 * 21.  Atomic transfer (round-trip; hard references resolve).
 * 22.  Import authority (no manufactured publication; structural
 *      pins hold; terminal immutability; unresolved provider
 *      rejected atomically with zero mutations).
 * 23.  Clean install (zero listings; no fabricated data).
 * 24.  Inventory preservation (240 capabilities, 12 families).
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
  H.load('src/models/marketplace-listing.js');
  H.load('src/marketplace/workflow.js');
  H.load('src/data-layer/adapter.js');
  H.load('src/data-layer/transfer.js');
  H.load('src/audit/audit.js');
  console.log('  marketplace-system.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var STEWARD = { name: 'TEST FIXTURE Steward',
    role: 'community_steward' };
  var PRACTITIONER = { name: 'TEST FIXTURE Practitioner',
    role: 'practitioner' };
  var TECHNICIAN = { name: 'TEST FIXTURE Technician',
    role: 'technician' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var REGIONAL = { name: 'TEST FIXTURE Regional Admin',
    role: 'regional_administrator' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var APPRENTICE = { name: 'TEST FIXTURE Apprentice',
    role: 'apprentice' };
  var ANON = { name: 'anonymous' };

  SCA.store.init();
  /* D2 §5 defense in depth: resumeListing resolves the reviewer
   * (and the pause/resume path) against THIS deployment's local
   * roster — accounts are local and never travel in bundles, so
   * the pause/resume fixtures need the reviewer and creator
   * accounts to exist locally, exactly as in a real deployment. */
  var rosterRev = SCA.store.insert('users', {
    name: REVIEWER.name, email: 'mp-early-reviewer@test.local',
    role: 'reviewer' });
  var rosterTech = SCA.store.insert('users', {
    name: TECHNICIAN.name, email: 'mp-early-technician@test.local',
    role: 'technician' });
  H.assert(rosterRev.ok && rosterTech.ok,
    'fixture: reviewer and creator accounts exist on the local ' +
    'roster (accounts are local, never bundled)');
  var cap = SCA.store.all('capabilities')[0];
  var cap2 = SCA.store.all('capabilities')[1];
  var locRes = SCA.store.insert('locations', { id: 'loc-mp-test',
    name: 'Marketplace Test District', status: null });
  var LOC = locRes.ok ? locRes.record :
    SCA.store.get('locations', 'loc-mp-test');

  /* Provider fixtures: EXISTING frozen records (raw inserts — the
   * listing never creates providers, and neither do the tests). */
  SCA.store.insert('practitioners', { id: 'pr-mp-a',
    public_name: 'Test Practitioner A', anonymous_option: false,
    documentation_consent: true, status: null });
  SCA.store.insert('practitioners', { id: 'pr-mp-nb',
    public_name: 'Test Practitioner On Behalf',
    anonymous_option: false, documentation_consent: true,
    status: null });
  SCA.store.insert('practitioners', { id: 'pr-mp-noc',
    public_name: 'Consent Withdrawn Practitioner',
    anonymous_option: false, documentation_consent: false,
    status: null });
  SCA.store.insert('organizations', { id: 'org-mp-a',
    name: 'Test Organization A', documentation_consent: true,
    status: null });
  SCA.store.insert('workshops', { id: 'ws-mp-a',
    name: 'Test Workshop A', status: 'VERIFIED' });
  SCA.store.insert('workshops', { id: 'ws-mp-gone',
    name: 'Inactive Workshop', status: 'CLOSED' });
  SCA.store.insert('training_programs', { id: 'tp-mp-a',
    name: 'Test Training Program A', status: 'ACTIVE' });
  SCA.store.insert('training_programs', { id: 'tp-mp-retired',
    name: 'Retired Training Program', status: 'RETIRED' });
  SCA.store.insert('repair_capabilities', { id: 'rc-mp-a',
    capability_id: cap.id, signature: 'mp-test',
    workshop_id: 'ws-mp-a', asset_type: 'CAPABILITY',
    asset_id: cap.id, status: 'VERIFIED' });

  /* ---------- 1. entities & ghosts ---------- */

  console.log('    1. entity discipline');
  H.assert(SCA.models.marketplaceListing &&
    SCA.models.marketplaceListing.collection ===
    'marketplace_listings',
    'MarketplaceListing model registered');
  H.assert(SCA.marketplace &&
    SCA.marketplace.STATUSES.length === 6,
    'SCA.marketplace service registered with the six frozen states');
  ['marketplace_providers', 'marketplace_matches',
    'marketplace_match_records', 'marketplace_availability_records',
    'marketplace_ratings', 'marketplace_reviews',
    'marketplace_requests', 'marketplace_offers',
    'marketplace_scores', 'match_scores', 'provider_scores',
    'listing_scores', 'trust_levels', 'verification_scores',
    'provider_rankings', 'listing_rankings', 'popularity_counts',
    'response_counts'].forEach(function (ghost) {
    H.assert(SCA.store.COLLECTIONS.indexOf(ghost) === -1,
      'no ghost collection "' + ghost + '" is created');
    H.assert(!SCA.models[ghost], 'no ghost model "' + ghost + '"');
  });
  H.assert(SCA.marketplace.SERVICE_KINDS.length === 12,
    'exactly the twelve frozen service kinds');
  H.assert(JSON.stringify(SCA.marketplace.SERVICE_KINDS) ===
    JSON.stringify(['REPAIR', 'MAINTENANCE', 'TRAINING',
      'APPRENTICESHIP_HOSTING', 'TECHNICAL_ASSISTANCE',
      'FABRICATION', 'LOCAL_PRODUCTION', 'AGRICULTURAL_SERVICES',
      'FISHERIES_SERVICES', 'WATER_SERVICES',
      'ENVIRONMENTAL_KNOWLEDGE', 'RESEARCH_FIELD_SERVICES']),
    'the service-kind vocabulary matches the frozen list exactly');
  H.assert(JSON.stringify(SCA.marketplace.AVAILABILITY) ===
    JSON.stringify(['BY_ARRANGEMENT', 'SCHEDULED_WINDOWS',
      'SEASONAL', 'LIMITED', 'UNKNOWN']),
    'exactly the five frozen availability values');
  H.assert(SCA.marketplace.KINDS.length === 2 &&
    SCA.marketplace.KINDS.indexOf('OFFER') !== -1 &&
    SCA.marketplace.KINDS.indexOf('NEED') !== -1,
    'exactly two listing kinds: OFFER and NEED');
  H.assert(SCA.marketplace.PROVIDER_TYPES.length === 4,
    'exactly the four frozen provider types');

  /* ---------- 2. creation & vocabularies ---------- */

  console.log('    2. creation & controlled vocabulary');
  var l1 = SCA.marketplace.createListing(PRACTITIONER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'PRACTITIONER', provider_id: 'pr-mp-a',
    capability_ids: [cap.id], location_ids: [LOC.id],
    location_scope: 'SPECIFIC',
    availability_status: 'BY_ARRANGEMENT',
    description: 'Welding repair offered at the workshop' });
  H.assert(l1.ok, 'OFFER draft created: ' +
    JSON.stringify(l1.errors));
  H.assert(l1.record.status === 'DRAFT',
    'a new listing is DRAFT (never optimistically published)');
  H.assert(l1.record.availability_status === 'BY_ARRANGEMENT',
    'declared availability recorded');
  l1 = l1.record;

  var l2 = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'TRAINING',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    capability_ids: [], location_scope: 'ANYWHERE',
    description: 'Seeking weaving training for members' });
  H.assert(l2.ok, 'NEED draft created with zero capability links ' +
    '(honest)');
  H.assert(l2.record.availability_status === 'UNKNOWN',
    'availability defaults to UNKNOWN (not yet documented)');
  H.assert(l2.record.location_scope === 'ANYWHERE' &&
    l2.record.location_ids.length === 0,
    'ANYWHERE scope carries no location references');
  l2 = l2.record;

  var badKind = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'SWAP', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a' });
  H.assert(!badKind.ok, 'free-text listing kind rejected');
  var badService = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'HAIRCUTTING',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a' });
  H.assert(!badService.ok,
    'free-text service kind rejected (frozen 12-value vocab)');
  var badAvail = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    availability_status: 'WHENEVER' });
  H.assert(!badAvail.ok,
    'free-text availability rejected (frozen 5-value vocab)');
  var badProviderType = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'HOUSEHOLD', provider_id: 'org-mp-a' });
  H.assert(!badProviderType.ok,
    'unknown provider type rejected (4 frozen types only)');

  /* ---------- 3. privacy is structural ---------- */

  console.log('    3. privacy & on-behalf-of');
  var contact = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    phone: '555-0100' });
  H.assert(!contact.ok && contact.errors.phone,
    'a listing with a phone field is REJECTED (contact fields are ' +
    'structurally prohibited)');
  var priced = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    price: 100 });
  H.assert(!priced.ok && priced.errors.price,
    'a listing with a price field is REJECTED (no pricing in ' +
    'Stage 13)');
  var scored = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    score: 9 });
  H.assert(!scored.ok && scored.errors.score,
    'a listing with a score field is REJECTED (no rankings)');

  var nbMissing = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'PRACTITIONER', provider_id: 'pr-mp-nb',
    location_scope: 'ANYWHERE' });
  H.assert(!nbMissing.ok && nbMissing.errors.on_behalf_of,
    'listing another actor\'s practitioner record requires an ' +
    'explicit on-behalf-of reason');
  var nbOk = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'PRACTITIONER', provider_id: 'pr-mp-nb',
    on_behalf_of: { reason: 'Recorded with the practitioner at ' +
      'the community meeting, Sept 2026' },
    location_scope: 'ANYWHERE' });
  H.assert(nbOk.ok, 'on-behalf-of creation accepted with reason');
  nbOk = nbOk.record;
  var nbAudit = SCA.audit.forEntity('marketplace_listings',
    nbOk.id).filter(function (e) {
    return e.action === 'marketplace.created_on_behalf'; });
  H.assert(nbAudit.length === 1 && nbAudit[0].reason,
    'the on-behalf-of creation is explicitly audited with its ' +
    'reason');
  var selfOk = SCA.marketplace.createListing(PRACTITIONER, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'PRACTITIONER', provider_id: 'pr-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(selfOk.ok,
    'a practitioner user listing their own record needs no ' +
    'on-behalf-of reason');

  /* ---------- 4. provider references ---------- */

  console.log('    4. provider references');
  var badProvider = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'PRACTITIONER', provider_id: 'pr-does-not-exist',
    on_behalf_of: { reason: 'x' } });
  H.assert(!badProvider.ok,
    'a listing never manufactures provider identity (unknown ' +
    'practitioner rejected)');
  var badWs = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'FABRICATION',
    provider_type: 'WORKSHOP', provider_id: 'ws-unknown' });
  H.assert(!badWs.ok, 'unknown workshop provider rejected');
  var wsOk = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'FABRICATION',
    provider_type: 'WORKSHOP', provider_id: 'ws-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(wsOk.ok, 'existing workshop provider accepted');
  wsOk = wsOk.record;
  var tpOk = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'APPRENTICESHIP_HOSTING',
    provider_type: 'TRAINING_PROGRAM', provider_id: 'tp-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(tpOk.ok, 'existing training program provider accepted');
  tpOk = tpOk.record;

  /* ---------- 5. capability / repair / location refs ---------- */

  console.log('    5. canonical references');
  var badCap = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    capability_ids: ['cap-does-not-exist'] });
  H.assert(!badCap.ok,
    'unknown capability reference rejected (a listing never ' +
    'silently creates capability records)');
  var badLoc = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_ids: ['loc-does-not-exist'] });
  H.assert(!badLoc.ok, 'unknown location reference rejected');
  var repairRefOffKind = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'FABRICATION',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    repair_capability_id: 'rc-mp-a' });
  H.assert(!repairRefOffKind.ok,
    'a repair-capability reference is only meaningful on a REPAIR ' +
    'listing');
  var repairRefOk = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'WORKSHOP', provider_id: 'ws-mp-a',
    capability_ids: [cap.id],
    repair_capability_id: 'rc-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(repairRefOk.ok,
    'a canonical Stage 8 repair-capability reference is accepted ' +
    'on a REPAIR listing');
  H.assert(repairRefOk.record.repair_capability_id === 'rc-mp-a',
    'the repair reference is stored');
  repairRefOk = repairRefOk.record;

  /* ---------- 6. geography ---------- */

  console.log('    6. geography rules');
  var specificNoLoc = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'SPECIFIC' });
  H.assert(!specificNoLoc.ok,
    'SPECIFIC scope requires at least one valid location');
  var anywhereWithLoc = SCA.marketplace.createListing(RESEARCHER, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE', location_ids: [LOC.id] });
  H.assert(!anywhereWithLoc.ok,
    'ANYWHERE scope is not location-bound (no location refs)');

  /* ---------- 7. lifecycle ---------- */

  console.log('    7. lifecycle discipline');
  H.assertEq(SCA.marketplace.TRANSITIONS.DRAFT, ['SUBMITTED'],
    'DRAFT only moves to SUBMITTED');
  H.assertEq(SCA.marketplace.TRANSITIONS.SUBMITTED,
    ['PUBLISHED', 'REJECTED'],
    'SUBMITTED moves to PUBLISHED or REJECTED');
  H.assertEq(SCA.marketplace.TRANSITIONS.PUBLISHED,
    ['PAUSED', 'WITHDRAWN'],
    'PUBLISHED pauses or withdraws');
  H.assertEq(SCA.marketplace.TRANSITIONS.PAUSED,
    ['PUBLISHED', 'WITHDRAWN'],
    'PAUSED resumes or withdraws');
  H.assertEq(SCA.marketplace.TRANSITIONS.REJECTED, [],
    'REJECTED is terminal');
  H.assertEq(SCA.marketplace.TRANSITIONS.WITHDRAWN, [],
    'WITHDRAWN is terminal');

  var editDraft = SCA.marketplace.updateListing(PRACTITIONER, l1.id,
    { description: 'Welding repair — revised description' });
  H.assert(editDraft.ok, 'the creator may edit their own DRAFT');
  var editForeign = SCA.marketplace.updateListing(RESEARCHER, l1.id,
    { description: 'sneaky edit' });
  H.assert(!editForeign.ok,
    'another user may never edit someone else\'s draft');

  var submitRes = SCA.marketplace.submitListing(PRACTITIONER, l1.id);
  H.assert(submitRes.ok, 'the creator submits the draft');
  H.assert(SCA.store.get('marketplace_listings', l1.id).status ===
    'SUBMITTED', 'the listing is now SUBMITTED');
  var editLocked = SCA.marketplace.updateListing(PRACTITIONER, l1.id,
    { description: 'late edit' });
  H.assert(!editLocked.ok, 'a SUBMITTED listing is locked');

  /* ---------- 8. reviewer separation ---------- */

  console.log('    8. reviewer separation incl. NATIONAL');
  var selfPublish = SCA.marketplace.publishListing(PRACTITIONER,
    l1.id, 'my own listing');
  H.assert(!selfPublish.ok,
    'the creator cannot publish their own listing (service layer)');
  var submit2 = SCA.marketplace.submitListing(STEWARD, l2.id);
  H.assert(submit2.ok, 'NEED listing submitted');
  var natCreate = SCA.marketplace.createListing(NATIONAL, {
    listing_kind: 'OFFER', service_kind: 'WATER_SERVICES',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(natCreate.ok, 'NATIONAL creates a listing');
  var natSubmit = SCA.marketplace.submitListing(NATIONAL,
    natCreate.record.id);
  H.assert(natSubmit.ok, 'NATIONAL submits their listing');
  var natSelfPublish = SCA.marketplace.publishListing(NATIONAL,
    natCreate.record.id, 'self publish');
  H.assert(!natSelfPublish.ok,
    'NATIONAL cannot publish their own listing (separation ' +
    'applies at every role level)');
  var natSelfReject = SCA.marketplace.rejectListing(NATIONAL,
    natCreate.record.id, 'self reject');
  H.assert(!natSelfReject.ok,
    'NATIONAL cannot reject their own listing either');
  var unauthorized = SCA.marketplace.publishListing(APPRENTICE,
    l1.id, 'no authority');
  H.assert(!unauthorized.ok,
    'an unauthorized role cannot publish');
  var rejectNoReason = SCA.marketplace.rejectListing(REVIEWER,
    l1.id, '');
  H.assert(!rejectNoReason.ok,
    'rejection requires an explicit documented reason');
  var rejectOk = SCA.marketplace.rejectListing(REVIEWER, l1.id,
    'The referenced repair capability does not match the ' +
    'description — resubmit with correct links');
  H.assert(rejectOk.ok, 'an authorized reviewer rejects another ' +
    'creator\'s listing');
  H.assert(SCA.store.get('marketplace_listings', l1.id).status ===
    'REJECTED', 'the listing is REJECTED (terminal)');
  var resurrect = SCA.marketplace.submitListing(PRACTITIONER, l1.id);
  H.assert(!resurrect.ok, 'a terminal listing cannot be resurrected');
  var editTerminal = SCA.marketplace.updateListing(PRACTITIONER,
    l1.id, { description: 'zombie edit' });
  H.assert(!editTerminal.ok,
    'a terminal listing is immutable');

  /* ---------- 9. publication gate ---------- */

  console.log('    9. publication gate (provider visibility)');
  var submit3 = SCA.marketplace.submitListing(TECHNICIAN, wsOk.id);
  H.assert(submit3.ok, 'workshop listing submitted');
  var pubWs = SCA.marketplace.publishListing(REVIEWER, wsOk.id,
    'References verified at the workshop visit');
  H.assert(pubWs.ok, 'a VERIFIED workshop anchors a published ' +
    'listing');
  H.assert(SCA.store.get('marketplace_listings', wsOk.id).status ===
    'PUBLISHED', 'the listing is PUBLISHED');

  /* Inactive workshop: the draft may EXIST, but publication is
   * gated (a listing may be drafted before its workshop is
   * documented — publication is where visibility is enforced). */
  var inactiveDraft = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'MAINTENANCE',
    provider_type: 'WORKSHOP', provider_id: 'ws-mp-gone',
    location_scope: 'ANYWHERE' });
  H.assert(inactiveDraft.ok,
    'the draft references an existing (inactive) workshop record');
  SCA.marketplace.submitListing(TECHNICIAN, inactiveDraft.record.id);
  var pubInactive = SCA.marketplace.publishListing(REVIEWER,
    inactiveDraft.record.id, 'attempt');
  H.assert(!pubInactive.ok && pubInactive.errors.provider_id,
    'publication is refused: an inactive workshop is not a ' +
    'publicly visible provider');
  var consentDraft = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'PRACTITIONER', provider_id: 'pr-mp-noc',
    on_behalf_of: { reason: 'x' },
    location_scope: 'ANYWHERE' });
  H.assert(consentDraft.ok, 'consent-withdrawn practitioner draft ' +
    'created (record exists; the gate is at publication)');
  SCA.marketplace.submitListing(STEWARD, consentDraft.record.id);
  var pubConsent = SCA.marketplace.publishListing(REVIEWER,
    consentDraft.record.id, 'attempt');
  H.assert(!pubConsent.ok,
    'publication refused: documentation consent is withdrawn');
  var retiredTpDraft = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'APPRENTICESHIP_HOSTING',
    provider_type: 'TRAINING_PROGRAM', provider_id: 'tp-mp-retired',
    location_scope: 'ANYWHERE' });
  H.assert(retiredTpDraft.ok, 'retired training program draft ' +
    'created');
  SCA.marketplace.submitListing(STEWARD, retiredTpDraft.record.id);
  var pubRetired = SCA.marketplace.publishListing(REVIEWER,
    retiredTpDraft.record.id, 'attempt');
  H.assert(!pubRetired.ok,
    'publication refused: a RETIRED training program is not an ' +
    'anchor for a new publication');
  var tpSubmit = SCA.marketplace.submitListing(STEWARD, tpOk.id);
  H.assert(tpSubmit.ok, 'the training program NEED is submitted');
  var pubTp = SCA.marketplace.publishListing(REVIEWER, tpOk.id,
    'The organization and program references check out');
  H.assert(pubTp.ok, 'an ACTIVE training program NEED is published');
  var pubNoReason = SCA.marketplace.publishListing(REVIEWER, l2.id,
    '');
  H.assert(!pubNoReason.ok,
    'publication requires an explicit documented reason');
  var pubL2 = SCA.marketplace.publishListing(REVIEWER, l2.id,
    'Community request verified with the organization');
  H.assert(pubL2.ok, 'the NEED listing is published');

  /* ---------- 10. provider retirement: honest, no auto mutation ---------- */

  console.log('    10. provider retirement (honest rendering)');
  /* Retire the workshop AFTER publication (Stage 8 owns the
   * workshop; the test changes the workshop record, not the
   * listing). */
  var wsRec = SCA.store.get('workshops', 'ws-mp-a');
  wsRec.status = 'CLOSED';
  SCA.store.update('workshops', 'ws-mp-a', wsRec);
  var wsListing = SCA.store.get('marketplace_listings', wsOk.id);
  H.assert(wsListing.status === 'PUBLISHED',
    'provider retirement does NOT auto-mutate the listing ' +
    'lifecycle');
  var ps = SCA.marketplace.providerStatus(wsListing);
  H.assert(ps.available === false && ps.message &&
    ps.message.indexOf('no longer available') !== -1,
    'providerStatus reports the honest unavailability message');
  var mm1 = SCA.marketplace.matches(REVIEWER);
  var gonePair = mm1.pairs.filter(function (p) {
    return p.offer_id === wsOk.id; });
  H.assert(gonePair.length === 0,
    'matching honestly excludes a listing whose provider is gone ' +
    '(a VIEW rule — never a lifecycle mutation)');
  /* A human pauses instead. */
  var pauseGone = SCA.marketplace.pauseListing(TECHNICIAN, wsOk.id,
    'Workshop closed — pausing until a successor is arranged');
  H.assert(pauseGone.ok, 'a human pauses the listing');
  H.assert(SCA.store.get('marketplace_listings', wsOk.id).status ===
    'PAUSED', 'the pause is an audited human transition');
  var resumeGone = SCA.marketplace.resumeListing(TECHNICIAN, wsOk.id,
    'try to resume');
  H.assert(!resumeGone.ok,
    'resume is refused while the provider is unavailable (no ' +
    'silent return to PUBLISHED)');
  var restore = SCA.store.get('workshops', 'ws-mp-a');
  restore.status = 'VERIFIED';
  SCA.store.update('workshops', 'ws-mp-a', restore);
  var resumeBack = SCA.marketplace.resumeListing(TECHNICIAN, wsOk.id,
    'Workshop reopened');
  H.assert(resumeBack.ok, 'resume works once the provider is ' +
    'publicly visible again');

  /* ---------- 11. availability amendments ---------- */

  console.log('    11. availability amendments');
  var amendOther = SCA.marketplace.amendAvailability(STEWARD,
    wsOk.id, 'SEASONAL', null, 'not mine');
  H.assert(!amendOther.ok,
    'only the listing\'s creator may amend availability');
  var amendNoReason = SCA.marketplace.amendAvailability(TECHNICIAN,
    wsOk.id, 'SEASONAL', null, '');
  H.assert(!amendNoReason.ok,
    'an availability amendment requires a documented reason');
  var amendBadVocab = SCA.marketplace.amendAvailability(TECHNICIAN,
    wsOk.id, 'SOMETIMES', null, 'why');
  H.assert(!amendBadVocab.ok,
    'amendments use the frozen availability vocabulary');
  var amendOk = SCA.marketplace.amendAvailability(TECHNICIAN, wsOk.id,
    'SEASONAL', 'During the dry season', 'Workshop operates ' +
    'seasonally after the schedule change');
  H.assert(amendOk.ok, 'the creator amends declared availability on ' +
    'a PUBLISHED listing');
  var amended = SCA.store.get('marketplace_listings', wsOk.id);
  H.assert(amended.availability_status === 'SEASONAL',
    'the amendment is stored');
  H.assert(amended.history.some(function (h) {
    return h.change_type === 'AMENDMENT'; }),
    'the amendment is recorded in byte-exact history');
  var structuralOnPublished = SCA.marketplace.updateListing(
    TECHNICIAN, wsOk.id, { service_kind: 'TRAINING' });
  H.assert(!structuralOnPublished.ok,
    'structural changes to a published listing are refused ' +
    '(withdraw + successor listing is the path)');

  /* ---------- 12. pause / resume ---------- */

  console.log('    12. pause / resume');
  var pauseNoReason = SCA.marketplace.pauseListing(TECHNICIAN, wsOk.id,
    '');
  H.assert(!pauseNoReason.ok, 'pausing requires a reason');
  var pauseForeign = SCA.marketplace.pauseListing(REVIEWER, wsOk.id,
    'not mine');
  H.assert(!pauseForeign.ok,
    'only the creator may pause their own listing');
  var pauseOk = SCA.marketplace.pauseListing(TECHNICIAN, wsOk.id,
    'Seasonal closure — pausing discovery temporarily');
  H.assert(pauseOk.ok, 'the creator pauses the published listing');
  H.assert(SCA.store.get('marketplace_listings', wsOk.id).status ===
    'PAUSED', 'the listing is PAUSED');
  var anonList = SCA.marketplace.list(ANON);
  H.assert(anonList.filter(function (r) {
    return r.id === wsOk.id; }).length === 0,
    'a PAUSED listing is not publicly discoverable');
  var mPaused = SCA.marketplace.matches(REVIEWER);
  H.assert(mPaused.pairs.filter(function (p) {
    return p.offer_id === wsOk.id || p.need_id === wsOk.id;
  }).length === 0, 'a PAUSED listing is absent from matching');
  var pausePause = SCA.marketplace.pauseListing(TECHNICIAN, wsOk.id,
    'again');
  H.assert(!pausePause.ok, 'a PAUSED listing cannot pause again');
  var resumeOk = SCA.marketplace.resumeListing(TECHNICIAN, wsOk.id,
    'Seasonal reopening');
  H.assert(resumeOk.ok, 'the creator resumes the listing');
  H.assert(SCA.store.get('marketplace_listings', wsOk.id).status ===
    'PUBLISHED', 'the listing is PUBLISHED again');

  /* ---------- 13. matching ---------- */

  console.log('    13. matching (derived, read-only)');
  var beforeCount = SCA.store.count('marketplace_listings');
  var mm = SCA.marketplace.matches(REVIEWER);
  H.assert(mm.ok, 'matching is available to readers');
  var pair = mm.pairs.filter(function (p) {
    return (p.offer_id === repairRefOk.id &&
      p.need_id === l2.id); })[0];
  /* repairRefOk: OFFER REPAIR by ws-mp-a; l2: NEED TRAINING by
   * org-mp-a with zero caps and no locations. Only REPAIR offers
   * share l2's TRAINING service kind? No — verify the pair set
   * only on real overlap: build a controlled pair instead. */
  /* The controlled OFFER must be in the published set. */
  var refSubmit = SCA.marketplace.submitListing(TECHNICIAN,
    repairRefOk.id);
  H.assert(refSubmit.ok, 'controlled OFFER submitted');
  var refPub = SCA.marketplace.publishListing(REVIEWER,
    repairRefOk.id, 'verified offer');
  H.assert(refPub.ok, 'controlled OFFER published');
  var needFix = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    capability_ids: [cap.id], location_ids: [LOC.id],
    location_scope: 'SPECIFIC' });
  H.assert(needFix.ok, 'controlled NEED created');
  var needPub = SCA.marketplace.submitListing(STEWARD,
    needFix.record.id);
  var needPubRes = SCA.marketplace.publishListing(REVIEWER,
    needFix.record.id, 'verified need');
  H.assert(needPubRes.ok, 'controlled NEED published');
  var mm2 = SCA.marketplace.matches(REVIEWER);
  var capPair = mm2.pairs.filter(function (p) {
    return p.offer_id === repairRefOk.id &&
      p.need_id === needFix.record.id; })[0];
  H.assert(capPair &&
    capPair.basis.some(function (b) {
      return b.indexOf('shared capability') === 0; }),
    'a capability-overlap pair carries its displayed basis');
  H.assert(capPair.basis.some(function (b) {
    return b.indexOf('service kind') === 0; }),
    'the shared service kind is part of the displayed basis');
  var kindOnly = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'MAINTENANCE',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE' });
  SCA.marketplace.submitListing(STEWARD, kindOnly.record.id);
  SCA.marketplace.publishListing(REVIEWER, kindOnly.record.id,
    'verified');
  var wsMaint = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'MAINTENANCE',
    provider_type: 'WORKSHOP', provider_id: 'ws-mp-a',
    location_scope: 'ANYWHERE' });
  SCA.marketplace.submitListing(TECHNICIAN, wsMaint.record.id);
  SCA.marketplace.publishListing(REVIEWER, wsMaint.record.id,
    'verified');
  var mm3 = SCA.marketplace.matches(REVIEWER);
  var skPair = mm3.pairs.filter(function (p) {
    return p.offer_id === wsMaint.record.id &&
      p.need_id === kindOnly.record.id; })[0];
  H.assert(skPair && skPair.basis.length === 1 &&
    skPair.basis[0].indexOf('service kind: MAINTENANCE') === 0,
    'a service-kind-only overlap pairs with exactly that basis');
  H.assert(mm3.pairs.filter(function (p) {
    return p.offer_id === p.need_id; }).length === 0,
    'a listing never pairs with itself');
  var offerOffer = mm3.pairs.filter(function (p) {
    var o = SCA.store.get('marketplace_listings', p.offer_id);
    var n = SCA.store.get('marketplace_listings', p.need_id);
    return o.listing_kind !== 'OFFER' || n.listing_kind !== 'NEED'; });
  H.assert(offerOffer.length === 0,
    'matching pairs ONLY published OFFERs with published NEEDs');
  var mm4 = SCA.marketplace.matches(REVIEWER);
  H.assertEq(mm3.pairs, mm4.pairs,
    'matching is deterministic and reproducible');
  H.assert(SCA.store.count('marketplace_listings') === beforeCount +
    3, 'matching created NO records (read-only, non-persistent)');

  /* ---------- 14. ordering & ranking absence ---------- */

  console.log('    14. deterministic ordering, no rankings');
  var ordered = SCA.marketplace.list(REVIEWER);
  var sorted = ordered.slice().sort(function (a, b) {
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? 1 : -1;
    }
    return a.id < b.id ? -1 : 1;
  });
  H.assertEq(ordered.map(function (r) { return r.id; }),
    sorted.map(function (r) { return r.id; }),
    'the register is ordered by recency then stable id (documented, ' +
    'deterministic)');
  var allListings = SCA.store.all('marketplace_listings');
  var rankingFields = ['score', 'ranking', 'rating', 'trust',
    'popularity', 'demand', 'response_count', 'match_count'];
  H.assert(allListings.every(function (r) {
    return rankingFields.every(function (f) {
      return r[f] === undefined; }); }),
    'no listing record carries any ranking/score/demand field');
  var forbiddenList = SCA.marketplace.FORBIDDEN_FIELDS;
  H.assert(forbiddenList.indexOf('price') !== -1 &&
    forbiddenList.indexOf('phone') !== -1 &&
    forbiddenList.indexOf('score') !== -1 &&
    forbiddenList.indexOf('intervention_id') !== -1,
    'the structural forbidden-field pin covers pricing, contact, ' +
    'ranking and Stage 10/11 coupling');

  /* ---------- 15. RBAC ---------- */

  console.log('    15. RBAC (five flat permissions)');
  var perms = SCA.rbac.permissions().filter(function (p) {
    return p.indexOf('marketplace.') === 0; });
  H.assertEq(perms.sort(),
    ['marketplace.create', 'marketplace.read',
      'marketplace.review', 'marketplace.update',
      'marketplace.withdraw'].sort(),
    'exactly the five flat marketplace permissions');
  H.assert(SCA.rbac.rolesFor('marketplace.export').length === 0,
    'deliberately NO marketplace.export permission');
  H.assert(SCA.rbac.rolesFor('marketplace.delete').length === 0,
    'deliberately NO marketplace.delete permission');
  H.assertEq(SCA.rbac.rolesFor('marketplace.create'),
    ['researcher', 'community_steward', 'practitioner',
      'technician', 'workshop', 'trainer', 'project_manager',
      'national_administrator'],
    'the frozen creation matrix (NATIONAL via the consistency rule)');
  H.assertEq(SCA.rbac.rolesFor('marketplace.review'),
    ['reviewer', 'regional_administrator',
      'national_administrator'],
    'review authority: reviewer, regional AND NATIONAL (explicitly ' +
    'declared)');
  var anonCanRead = SCA.rbac.can(ANON, 'marketplace.read');
  H.assert(anonCanRead, 'anonymous visitors hold marketplace.read');
  var anonCreate = SCA.marketplace.createListing(ANON, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a' });
  H.assert(!anonCreate.ok, 'anonymous visitors cannot create');
  var apprenticeCreate = SCA.marketplace.createListing(APPRENTICE, {
    listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a' });
  H.assert(!apprenticeCreate.ok, 'apprentices cannot create');
  var pubRead = SCA.rbac.can({ name: 'x', role: 'public' },
    'marketplace.read');
  H.assert(pubRead, 'public-role users may read');

  /* ---------- 16. graph boundary ---------- */

  console.log('    16. graph boundary');
  H.assert(SCA.graphRegistry &&
    Object.keys(SCA.graphRegistry.RELATIONSHIPS).length === 19,
    'the graph registry still holds exactly the 19 frozen types');
  var edgesBefore = SCA.store.count('graph_edges');
  SCA.marketplace.publishListing(REVIEWER, l2.id,
    'post-publication re-check does not touch the graph');
  H.assert(SCA.store.count('graph_edges') === edgesBefore,
    'marketplace operations create NO graph edges');
  H.assert(!SCA.graphRegistry.NODE_TYPES.MARKETPLACE_LISTING,
    'MarketplaceListing is not a graph node type');

  /* ---------- 17. Stage 10/11/12 boundaries ---------- */

  console.log('    17. frozen-stage boundaries');
  H.assert(allListings.every(function (r) {
    return r.intervention_id === undefined &&
      r.pilot_project_id === undefined; }),
    'no listing references interventions or pilots (v1.0 pin)');
  H.assert(SCA.store.count('measurements') === 0,
    'Stage 13 creates no measurements');
  var indCount = SCA.store.count('indicators');
  H.assert(indCount === 23,
    'the 23 seeded indicator definitions are untouched (23, found ' +
    indCount + ')');
  var compBefore = SCA.indicator.compute ?
    JSON.stringify(SCA.indicator.compute('PRACTITIONER_DENSITY')) :
    null;
  var indAfter = SCA.indicator ?
    JSON.stringify(SCA.indicator.compute('PRACTITIONER_DENSITY')) :
    null;
  H.assert(compBefore === indAfter,
    'indicator computation is unaffected by marketplace activity');
  var measCount = SCA.store.count('measurements');
  H.assert(measCount === 0,
    'no marketplace measurements exist (Observatory stays ' +
    'authoritative)');

  /* ---------- 18. audit coverage ---------- */

  console.log('    18. audit coverage');
  function hasAction(id, action) {
    return SCA.audit.forEntity('marketplace_listings', id)
      .some(function (e) { return e.action === action; });
  }
  H.assert(hasAction(wsOk.id, 'marketplace.created'),
    'creation is audited');
  H.assert(hasAction(wsOk.id, 'marketplace.submitted'),
    'submission is audited');
  H.assert(hasAction(wsOk.id, 'marketplace.published'),
    'publication is audited');
  H.assert(hasAction(l1.id, 'marketplace.rejected'),
    'rejection is audited');
  H.assert(hasAction(wsOk.id, 'marketplace.paused'),
    'pause is audited');
  H.assert(hasAction(wsOk.id, 'marketplace.resumed'),
    'resume is audited');
  H.assert(hasAction(wsOk.id, 'marketplace.availability_amended'),
    'availability amendment is audited');
  var wd = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'WORKSHOP', provider_id: 'ws-mp-a',
    location_scope: 'ANYWHERE' });
  SCA.marketplace.submitListing(TECHNICIAN, wd.record.id);
  SCA.marketplace.publishListing(REVIEWER, wd.record.id,
    'to be withdrawn');
  var wdRes = SCA.marketplace.withdrawListing(TECHNICIAN,
    wd.record.id, 'No longer offering this service');
  H.assert(wdRes.ok, 'the creator withdraws a published listing');
  H.assert(hasAction(wd.record.id, 'marketplace.withdrawn'),
    'withdrawal is audited');
  var withdrawnRec = SCA.store.get('marketplace_listings',
    wd.record.id);
  H.assert(withdrawnRec.status === 'WITHDRAWN' &&
    withdrawnRec.withdraw_reason && withdrawnRec.withdrawn_by &&
    withdrawnRec.withdrawn_at,
    'withdrawal records reason, actor and timestamp');
  var wdSubmit = SCA.marketplace.submitListing(TECHNICIAN,
    wd.record.id);
  H.assert(!wdSubmit.ok, 'a WITHDRAWN listing is terminal');
  var anonGet = SCA.marketplace.get(ANON, wd.record.id);
  H.assert(!anonGet.ok, 'anonymous visitors cannot read a ' +
    'WITHDRAWN listing');

  /* ---------- 19. anonymous visibility ---------- */

  console.log('    19. anonymous visibility');
  var anonList2 = SCA.marketplace.list(ANON);
  H.assert(anonList2.every(function (r) {
    return r.status === 'PUBLISHED'; }),
    'anonymous visitors see only PUBLISHED listings');
  var anonGetDraft = SCA.marketplace.get(ANON, nbOk.id);
  H.assert(!anonGetDraft.ok,
    'anonymous visitors cannot read a DRAFT');
  var staffGet = SCA.marketplace.get(REVIEWER, nbOk.id);
  H.assert(staffGet.ok,
    'staff readers can read workflow material per RBAC');

  /* ---------- 20. offline DRAFT ---------- */

  console.log('    20. offline DRAFT');
  /* The storage abstraction is local; "offline" is structurally
   * true. The honest-offline pin: a DRAFT survives a storage
   * re-init from the same local dataset, and nothing ever claims
   * PUBLISHED before a reviewer publishes. */
  var offDraft = SCA.marketplace.createListing(STEWARD, {
    listing_kind: 'NEED', service_kind: 'WATER_SERVICES',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(offDraft.ok && offDraft.record.status === 'DRAFT',
    'a DRAFT is created with no network dependency');
  H.assert(SCA.store.get('marketplace_listings',
    offDraft.record.id).status === 'DRAFT',
    'the local dataset holds the DRAFT — the app never claims ' +
    'PUBLISHED before publication');

  /* ---------- 21. atomic transfer ---------- */

  console.log('    21. atomic transfer');
  var before = {
    caps: SCA.store.count('capabilities'),
    fams: SCA.store.count('families'),
    mp: SCA.store.count('marketplace_listings') };
  var pkgText = SCA.transfer.exportAll();
  var pkgDs = JSON.parse(pkgText);
  H.assert((pkgDs.collections.marketplace_listings || []).length ===
    before.mp,
    'the full export includes the marketplace collection');
  H.assert(SCA.store.count('capabilities') === before.caps &&
    SCA.store.count('families') === before.fams,
    '240 capabilities / 12 families preserved through export');
  SCA.store.wipe();
  SCA.store.init();
  /* Accounts are local and never travel in a bundle (frozen
   * privacy pin: the users collection is excluded from every
   * export). A real restore re-establishes accounts alongside the
   * data bundle; the round-trip does the same, so the PUBLISHED
   * listings' reviewer resolves against the deployment's own
   * roster (D1: reviewer authority is local, never a string). */
  var revAcct = SCA.store.insert('users', {
    name: REVIEWER.name, email: 'test-fixture-reviewer@test.local',
    role: 'reviewer' });
  H.assert(revAcct.ok, 'the reviewer account is restored locally ' +
    'before the data bundle imports');
  /* D2 §6/§7: pause and withdrawal provenance resolve against the
   * local roster too — the creator account is restored alongside
   * the bundle, exactly as in a real restore. */
  var techAcct = SCA.store.insert('users', {
    name: TECHNICIAN.name, email: 'test-fixture-technician@test.local',
    role: 'technician' });
  H.assert(techAcct.ok, 'the creator account is restored locally ' +
    'before the data bundle imports (pause/withdrawal actors ' +
    'resolve locally)');
  var imp = SCA.transfer.importBundle(pkgText);
  H.assert(imp.ok, 'round-trip import accepted (atomic: ' +
    ((imp.errors || []).slice(0, 3).join('; ') || 'ok') + ')');
  H.assert(SCA.store.count('capabilities') === before.caps &&
    SCA.store.count('families') === before.fams,
    'round-trip keeps the 240/12 inventory intact');
  H.assert(SCA.store.count('marketplace_listings') === before.mp,
    'listing counts preserved through the round-trip');
  var pubSurvived = SCA.store.get('marketplace_listings', wsOk.id);
  H.assert(pubSurvived && pubSurvived.status === 'PUBLISHED' &&
    pubSurvived.availability_status === 'SEASONAL',
    'published state and audited amendments survive the round-trip');
  var wSurvived = SCA.store.get('marketplace_listings',
    wd.record.id);
  H.assert(wSurvived && wSurvived.status === 'WITHDRAWN',
    'terminal history survives the round-trip immutably');

  /* ---------- 22. import authority ---------- */

  console.log('    22. import authority (atomic)');
  function freshDataset() {
    return JSON.parse(SCA.transfer.exportAll());
  }
  function tryImport(ds) {
    return SCA.transfer.importBundle(JSON.stringify(ds));
  }
  /* manufactured publication: creator === reviewer. */
  var dsA = freshDataset();
  dsA.collections.marketplace_listings.push({
    id: 'mp-forged', listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE', availability_status: 'UNKNOWN',
    status: 'PUBLISHED', created_by: 'FORGER', reviewer: 'FORGER',
    reviewed_at: '2026-09-01', version: '1', history: [] });
  var impForged = tryImport(dsA);
  H.assert(!impForged.ok,
    'an import never manufactures publication by its own creator');
  /* publication without provenance. */
  var dsB = freshDataset();
  dsB.collections.marketplace_listings.push({
    id: 'mp-norev', listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE', availability_status: 'UNKNOWN',
    status: 'PUBLISHED', created_by: 'A', version: '1',
    history: [] });
  var impNoRev = tryImport(dsB);
  H.assert(!impNoRev.ok,
    'a PUBLISHED import requires reviewer and timestamp');
  /* unresolved hard reference (active record). */
  var dsC = freshDataset();
  dsC.collections.marketplace_listings.push({
    id: 'mp-brokenref', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'PRACTITIONER',
    provider_id: 'pr-gone-with-the-import', location_scope:
    'ANYWHERE', availability_status: 'UNKNOWN', status: 'DRAFT',
    created_by: 'X', version: '1', history: [] });
  var impBroken = tryImport(dsC);
  H.assert(!impBroken.ok,
    'an active listing with an unresolved provider is rejected');
  var countAfterReject = SCA.store.count('marketplace_listings');
  H.assert(countAfterReject === before.mp,
    'the rejected import mutated NOTHING (atomic rejection, zero ' +
    'partial records)');
  /* forbidden field. */
  var dsD = freshDataset();
  dsD.collections.marketplace_listings.push({
    id: 'mp-priced', listing_kind: 'OFFER', service_kind: 'REPAIR',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE', availability_status: 'UNKNOWN',
    status: 'DRAFT', created_by: 'X', price: 50, version: '1',
    history: [] });
  var impPriced = tryImport(dsD);
  H.assert(!impPriced.ok,
    'a listing carrying a forbidden field is rejected at import');
  /* structural geography rules hold for every import. */
  var dsE = freshDataset();
  dsE.collections.marketplace_listings.push({
    id: 'mp-specific-noloc', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'ORGANIZATION',
    provider_id: 'org-mp-a', location_scope: 'SPECIFIC',
    availability_status: 'UNKNOWN', status: 'DRAFT',
    created_by: 'X', version: '1', history: [] });
  var impSpec = tryImport(dsE);
  H.assert(!impSpec.ok,
    'a SPECIFIC import without locations is rejected');
  /* terminal history may keep broken references (frozen
   * exemption) and is never resurrected by import. */
  var dsF = freshDataset();
  var wRec = JSON.parse(JSON.stringify(wSurvived));
  wRec.provider_id = 'pr-also-gone';
  dsF.collections.marketplace_listings =
    dsF.collections.marketplace_listings.filter(function (r) {
      return r.id !== wRec.id; }).concat([wRec]);
  var impTerminal = tryImport(dsF);
  H.assert(impTerminal.ok,
    'terminal history keeps broken references by design (frozen ' +
    'terminal-history exemption)');
  H.assert(SCA.store.get('marketplace_listings',
    wRec.id).status === 'WITHDRAWN',
    'the terminal record stays WITHDRAWN through import (no ' +
    'resurrection)');

  /* ---------- 22b. D1 targeted correction regression ----------
   * Authorization D1 §7 tests 1-6: terminal resurrection is
   * blocked, reviewer strings are not publication authority, and
   * a legitimately reviewed PUBLISHED listing still imports. */

  console.log('    22b. D1 correction regression (resurrection + ' +
    'reviewer authority)');
  var d1Baseline = {
    mp: SCA.store.count('marketplace_listings'),
    caps: SCA.store.count('capabilities'),
    audit: SCA.store.count('audit_log') };
  function d1Unchanged(label) {
    H.assert(SCA.store.count('marketplace_listings') ===
      d1Baseline.mp && SCA.store.count('capabilities') ===
      d1Baseline.caps && SCA.store.count('audit_log') ===
      d1Baseline.audit,
      label + ': the rejected D1 import mutated NOTHING ' +
      '(atomic rejection, no partial records, no audit corruption)');
  }
  function cloneListing(src, over) {
    var c = JSON.parse(JSON.stringify(src));
    Object.keys(over || {}).forEach(function (k) {
      c[k] = over[k]; });
    return c;
  }
  /* A PUBLISHED candidate that carries complete-looking provenance
   * (reviewer, timestamp, reason) — only the LOCAL terminal record
   * makes it illegal. */
  var provenance = { status: 'PUBLISHED',
    reviewer: REVIEWER.name,
    reviewed_at: '2026-09-01T00:00:00Z',
    review_reason: 'TEST FIXTURE D1 provenance reason' };

  /* Test 1 — REJECTED -> PUBLISHED resurrection. */
  var dsR = freshDataset();
  var rejRec = SCA.store.get('marketplace_listings', l1.id);
  H.assert(rejRec && rejRec.status === 'REJECTED',
    'D1 fixture: the local store holds the REJECTED terminal ' +
    'record');
  dsR.collections.marketplace_listings =
    dsR.collections.marketplace_listings.filter(
      function (r) { return r.id !== l1.id; })
      .concat([cloneListing(rejRec, provenance)]);
  var impR = tryImport(dsR);
  H.assert(!impR.ok, 'D1 test 1: a REJECTED listing cannot be ' +
    'resurrected as PUBLISHED through import');
  H.assert(SCA.store.get('marketplace_listings', l1.id).status ===
    'REJECTED', 'D1 test 1: the terminal record stays REJECTED');
  d1Unchanged('D1 test 1');

  /* Test 2 — WITHDRAWN -> PUBLISHED resurrection. */
  var dsW = freshDataset();
  var wdRec = SCA.store.get('marketplace_listings', wRec.id);
  H.assert(wdRec && wdRec.status === 'WITHDRAWN',
    'D1 fixture: the local store holds the WITHDRAWN terminal ' +
    'record');
  dsW.collections.marketplace_listings =
    dsW.collections.marketplace_listings.filter(
      function (r) { return r.id !== wRec.id; })
      .concat([cloneListing(wdRec, provenance)]);
  var impW = tryImport(dsW);
  H.assert(!impW.ok, 'D1 test 2: a WITHDRAWN listing cannot be ' +
    'resurrected as PUBLISHED through import');
  H.assert(SCA.store.get('marketplace_listings', wRec.id).status ===
    'WITHDRAWN', 'D1 test 2: the terminal record stays WITHDRAWN');
  d1Unchanged('D1 test 2');

  /* Terminal -> other non-terminal transitions are equally barred. */
  var dsT = freshDataset();
  dsT.collections.marketplace_listings =
    dsT.collections.marketplace_listings.filter(
      function (r) { return r.id !== l1.id; })
      .concat([cloneListing(rejRec, { status: 'DRAFT' })]);
  var impT = tryImport(dsT);
  H.assert(!impT.ok, 'D1 extra: a REJECTED listing cannot be ' +
    'resurrected as DRAFT through import');
  var dsU = freshDataset();
  dsU.collections.marketplace_listings =
    dsU.collections.marketplace_listings.filter(
      function (r) { return r.id !== wRec.id; })
      .concat([cloneListing(wdRec, { status: 'SUBMITTED' })]);
  var impU = tryImport(dsU);
  H.assert(!impU.ok, 'D1 extra: a WITHDRAWN listing cannot be ' +
    'resurrected as SUBMITTED through import');
  var dsV = freshDataset();
  dsV.collections.marketplace_listings =
    dsV.collections.marketplace_listings.filter(
      function (r) { return r.id !== l1.id; })
      .concat([cloneListing(rejRec, { status: 'PAUSED' })]);
  var impV = tryImport(dsV);
  H.assert(!impV.ok, 'D1 extra: a REJECTED listing cannot be ' +
    'resurrected as PAUSED through import');
  d1Unchanged('D1 extras');

  /* An UNCHANGED terminal re-import stays legal (immutability
   * never blocks honest re-import of terminal history). */
  var dsSame = freshDataset();
  var impSame = tryImport(dsSame);
  H.assert(impSame.ok, 'D1 extra: an unchanged bundle still ' +
    'imports (terminal history is not frozen out of transfers)');
  d1Unchanged('D1 unchanged');

  /* Test 3 — forged reviewer (resolves to no account). */
  var ds3 = freshDataset();
  ds3.collections.marketplace_listings.push(cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id),
    { id: 'mp-d1-forged', created_by: 'TEST FIXTURE Steward',
      reviewer: 'Mystery Reviewer' }));
  var imp3 = tryImport(ds3);
  H.assert(!imp3.ok, 'D1 test 3: a reviewer string that resolves ' +
    'to no account on this deployment is not publication authority');
  d1Unchanged('D1 test 3');

  /* Test 4 — real account, no marketplace.review authority. */
  var unauthAcct = SCA.store.insert('users', {
    name: 'TEST FIXTURE Unauthorized Reviewer',
    email: 'd1-unauthorized@test.local', role: 'researcher' });
  H.assert(unauthAcct.ok, 'D1 fixture: a real account without ' +
    'review authority exists on the roster');
  var ds4 = freshDataset();
  ds4.collections.marketplace_listings.push(cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id),
    { id: 'mp-d1-unauthorized', created_by: 'TEST FIXTURE Steward',
      reviewer: 'TEST FIXTURE Unauthorized Reviewer' }));
  var imp4 = tryImport(ds4);
  H.assert(!imp4.ok, 'D1 test 4: a real user without ' +
    'marketplace.review authority cannot publish through import');
  d1Unchanged('D1 test 4');

  /* Test 5 — missing review reason. */
  var ds5 = freshDataset();
  ds5.collections.marketplace_listings.push(cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id),
    { id: 'mp-d1-noreason', created_by: 'TEST FIXTURE Steward',
      review_reason: '' }));
  var imp5 = tryImport(ds5);
  H.assert(!imp5.ok, 'D1 test 5: a PUBLISHED import without a ' +
    'documented review reason is rejected');
  d1Unchanged('D1 test 5');

  /* Test 6 — legitimately reviewed PUBLISHED listing imports. */
  var ds6 = freshDataset();
  ds6.collections.marketplace_listings.push(cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id),
    { id: 'mp-d1-valid', created_by: 'TEST FIXTURE Steward' }));
  var imp6 = tryImport(ds6);
  H.assert(imp6.ok, 'D1 test 6: a legitimately reviewed PUBLISHED ' +
    'listing (valid reviewer account with review authority, ' +
    'creator/reviewer separation, documented reason, timestamp) ' +
    'imports successfully (' +
    ((imp6.errors || []).slice(0, 2).join('; ') || 'ok') + ')');
  var validImp = SCA.store.get('marketplace_listings', 'mp-d1-valid');
  H.assert(validImp && validImp.status === 'PUBLISHED' &&
    validImp.reviewer === REVIEWER.name,
    'D1 test 6: the valid publication lands PUBLISHED with its ' +
    'provenance intact');
  var d1CountOk = SCA.store.count('marketplace_listings') ===
    d1Baseline.mp + 1;
  H.assert(d1CountOk, 'D1 test 6: exactly one new listing was ' +
    'imported (no side effects beyond the valid record)');

  /* ---------- 22c. D2 targeted correction regression ----------
   * Authorization D2 §11: PAUSED is definitionally a
   * post-publication state — the only legitimate path into
   * PAUSED is PUBLISHED -> PAUSED — so PAUSED imports carry the
   * same publication provenance foundation as PUBLISHED, pause
   * and withdrawal actors resolve against the local roster (an
   * actor string is never authority), and resumeListing verifies
   * publication provenance before returning a record to PUBLISHED
   * (defense in depth). */

  console.log('    22c. D2 correction regression (PAUSED ' +
    'provenance + actor authority + resume defense)');
  var PAUSE_STAMP = { status: 'PAUSED',
    paused_by: TECHNICIAN.name,
    paused_at: '2026-09-02T00:00:00Z',
    pause_reason: 'TEST FIXTURE D2 pause reason' };

  /* D2.4 fixtures (created BEFORE the atomicity baseline: the
   * fixture creations are legitimate local activity, and only the
   * rejected imports must leave the store untouched). */
  var lDraft = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE' });
  H.assert(lDraft.ok && lDraft.record.status === 'DRAFT',
    'D2 fixture: a local DRAFT listing exists');
  var lSub = SCA.marketplace.createListing(TECHNICIAN, {
    listing_kind: 'OFFER', service_kind: 'TRAINING',
    provider_type: 'ORGANIZATION', provider_id: 'org-mp-a',
    location_scope: 'ANYWHERE' });
  SCA.marketplace.submitListing(TECHNICIAN, lSub.record.id);
  H.assert(SCA.store.get('marketplace_listings', lSub.record.id)
    .status === 'SUBMITTED',
    'D2 fixture: a local SUBMITTED listing exists');

  /* Atomicity baseline: taken AFTER the fixture creations (they
   * are legitimate local activity) and BEFORE every rejected D2
   * import — each rejection must leave the store byte-identical. */
  var d2Baseline = {
    mp: SCA.store.count('marketplace_listings'),
    caps: SCA.store.count('capabilities'),
    audit: SCA.store.count('audit_log') };
  function d2Unchanged(label) {
    H.assert(SCA.store.count('marketplace_listings') ===
      d2Baseline.mp && SCA.store.count('capabilities') ===
      d2Baseline.caps && SCA.store.count('audit_log') ===
      d2Baseline.audit,
      label + ': the rejected D2 import mutated NOTHING ' +
      '(atomic rejection, no partial records, no provenance or ' +
      'lifecycle corruption)');
  }

  /* D2.2 — PAUSED import without publication provenance. */
  var dsP1 = freshDataset();
  var noPub = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  noPub.id = 'mp-d2-nopub';
  delete noPub.reviewer; delete noPub.reviewed_at;
  delete noPub.review_reason;
  dsP1.collections.marketplace_listings.push(noPub);
  var impP1 = tryImport(dsP1);
  H.assert(!impP1.ok, 'D2.2: a PAUSED import without publication ' +
    'provenance is rejected (PAUSED is a post-publication state)');
  d2Unchanged('D2.2 no provenance');

  /* D2.2 variant — reviewer resolves but no documented reason. */
  var dsP2 = freshDataset();
  var noReason = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  noReason.id = 'mp-d2-noreason';
  noReason.review_reason = '';
  dsP2.collections.marketplace_listings.push(noReason);
  var impP2 = tryImport(dsP2);
  H.assert(!impP2.ok, 'D2.2: a PAUSED import requires the same ' +
    'documented review reason as a PUBLISHED import');
  d2Unchanged('D2.2 no review reason');

  /* D2.2 variant — reviewer without marketplace.review authority. */
  var dsP3 = freshDataset();
  var unauthRev = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  unauthRev.id = 'mp-d2-unauthrev';
  unauthRev.reviewer = 'TEST FIXTURE Unauthorized Reviewer';
  dsP3.collections.marketplace_listings.push(unauthRev);
  var impP3 = tryImport(dsP3);
  H.assert(!impP3.ok, 'D2.2: a real account without ' +
    'marketplace.review authority cannot found a PAUSED import ' +
    'either');
  d2Unchanged('D2.2 unauthorized reviewer');

  /* D2.1 — forged reviewer string on a fully-faked PAUSED record. */
  var dsP4 = freshDataset();
  var forgedRev = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  forgedRev.id = 'mp-d2-forgedrev';
  forgedRev.reviewer = 'Mystery Reviewer';
  dsP4.collections.marketplace_listings.push(forgedRev);
  var impP4 = tryImport(dsP4);
  H.assert(!impP4.ok, 'D2.1: a forged PAUSED record cannot reach ' +
    'the deployment (its publication cannot be manufactured)');
  d2Unchanged('D2.1 forged reviewer');

  /* D2.3 — pause actor that resolves to no local account. */
  var dsP5 = freshDataset();
  var mysteryPause = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  mysteryPause.id = 'mp-d2-mystery-pause';
  mysteryPause.paused_by = 'Mystery Person';
  dsP5.collections.marketplace_listings.push(mysteryPause);
  var impP5 = tryImport(dsP5);
  H.assert(!impP5.ok, 'D2.3: a PAUSED import with paused_by = ' +
    '"Mystery Person" (no authorized local account) is rejected');
  d2Unchanged('D2.3 mystery pause actor');

  /* D2.3 variant — real account, but not the creator (the frozen
   * pause workflow is creator-only). */
  var dsP6 = freshDataset();
  var foreignPause = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  foreignPause.id = 'mp-d2-foreign-pause';
  foreignPause.paused_by = REVIEWER.name;
  dsP6.collections.marketplace_listings.push(foreignPause);
  var impP6 = tryImport(dsP6);
  H.assert(!impP6.ok, 'D2.3: a pause actor that is not the ' +
    'listing\'s creator is rejected (creator-only frozen rule)');
  d2Unchanged('D2.3 foreign pause actor');

  /* D2.3 (withdrawal) — forged withdrawal actor on terminal
   * history. The record is an otherwise unchanged WITHDRAWN, so
   * only the actor provenance makes it illegal. */
  var dsP7 = freshDataset();
  var mysteryWd = cloneListing(
    SCA.store.get('marketplace_listings', wd.record.id),
    { withdrawn_by: 'Mystery Person' });
  dsP7.collections.marketplace_listings =
    dsP7.collections.marketplace_listings.filter(
      function (r) { return r.id !== mysteryWd.id; })
    .concat([mysteryWd]);
  var impP7 = tryImport(dsP7);
  H.assert(!impP7.ok, 'D2.3: a WITHDRAWN import whose withdrawn_by ' +
    'resolves to no authorized local account is rejected');
  H.assert(SCA.store.get('marketplace_listings', wd.record.id)
    .status === 'WITHDRAWN',
    'D2.3: the terminal record stays WITHDRAWN (unmodified)');
  d2Unchanged('D2.3 mystery withdrawal actor');

  /* D2.4 — DRAFT -> PAUSED through import (manufactured history). */
  var dsP8 = freshDataset();
  var draftPause = cloneListing(lDraft.record,
    Object.assign({}, provenance, PAUSE_STAMP));
  dsP8.collections.marketplace_listings =
    dsP8.collections.marketplace_listings.filter(
      function (r) { return r.id !== draftPause.id; })
    .concat([draftPause]);
  var impP8 = tryImport(dsP8);
  H.assert(!impP8.ok, 'D2.4: a DRAFT listing cannot be moved to ' +
    'PAUSED through import (the only path into PAUSED is ' +
    'PUBLISHED -> PAUSED)');
  H.assert(SCA.store.get('marketplace_listings', lDraft.record.id)
    .status === 'DRAFT',
    'D2.4: the local record stays DRAFT (no manufactured history)');
  d2Unchanged('D2.4 DRAFT -> PAUSED');

  /* D2.4 — SUBMITTED -> PAUSED through import. */
  var dsP9 = freshDataset();
  var subPause = cloneListing(
    SCA.store.get('marketplace_listings', lSub.record.id),
    Object.assign({}, provenance, PAUSE_STAMP));
  dsP9.collections.marketplace_listings =
    dsP9.collections.marketplace_listings.filter(
      function (r) { return r.id !== subPause.id; })
    .concat([subPause]);
  var impP9 = tryImport(dsP9);
  H.assert(!impP9.ok, 'D2.4: a SUBMITTED listing cannot be moved ' +
    'to PAUSED through import');
  H.assert(SCA.store.get('marketplace_listings', lSub.record.id)
    .status === 'SUBMITTED',
    'D2.4: the local record stays SUBMITTED');
  d2Unchanged('D2.4 SUBMITTED -> PAUSED');

  /* ---------- legitimate transfers stay open (D2 §12) ---------- */

  /* A legitimately paused listing (valid publication provenance +
   * creator pause provenance) imports as PAUSED. */
  var dsP10 = freshDataset();
  var legitPause = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  legitPause.id = 'mp-d2-legit-pause';
  dsP10.collections.marketplace_listings.push(legitPause);
  var impP10 = tryImport(dsP10);
  H.assert(impP10.ok, 'D2 §12: a legitimately paused listing ' +
    '(valid publication + pause provenance) imports ACCEPTED (' +
    ((impP10.errors || []).slice(0, 2).join('; ') || 'ok') + ')');
  var landedPause = SCA.store.get('marketplace_listings',
    'mp-d2-legit-pause');
  H.assert(landedPause && landedPause.status === 'PAUSED' &&
    landedPause.reviewer === REVIEWER.name &&
    landedPause.paused_by === TECHNICIAN.name,
    'D2 §12: the legitimate pause lands PAUSED with reviewer and ' +
    'pause provenance intact');

  /* A live PUBLISHED -> PAUSED pause through import (same id). */
  var dsP11 = freshDataset();
  var livePause = cloneListing(
    SCA.store.get('marketplace_listings', wsOk.id), PAUSE_STAMP);
  dsP11.collections.marketplace_listings =
    dsP11.collections.marketplace_listings.filter(
      function (r) { return r.id !== livePause.id; })
    .concat([livePause]);
  var impP11 = tryImport(dsP11);
  H.assert(impP11.ok, 'D2 §11: a legitimate PUBLISHED -> PAUSED ' +
    'import is ACCEPTED');
  H.assert(SCA.store.get('marketplace_listings', wsOk.id)
    .status === 'PAUSED',
    'D2 §11: the local PUBLISHED listing imports to PAUSED');

  /* Unchanged bundle (now including legitimately PAUSED records)
   * still imports — honest transfers are never frozen out. */
  var dsP12 = freshDataset();
  var impP12 = tryImport(dsP12);
  H.assert(impP12.ok, 'D2 §12: an unchanged bundle including ' +
    'legitimately PAUSED records still imports');

  /* ---------- D2.1 resume defense in depth (D2 §5) ----------
   * A store record whose status says PAUSED but whose provenance
   * is missing/forged can never resume to PUBLISHED. These
   * hand-inserted records intentionally pollute the local store
   * (simulating a hand-edited store); no import follows them,
   * and the next section wipes the store (clean install). */
  var handA = SCA.store.insert('marketplace_listings', {
    id: 'mp-d2-hand-a', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'ORGANIZATION',
    provider_id: 'org-mp-a', location_scope: 'ANYWHERE',
    availability_status: 'UNKNOWN', status: 'PAUSED',
    created_by: TECHNICIAN.name, version: '1', history: [] });
  H.assert(handA.ok, 'D2 fixture: a hand-inserted PAUSED record ' +
    '(no provenance) exists in the local store');
  var resA = SCA.marketplace.resumeListing(TECHNICIAN,
    'mp-d2-hand-a', 'TEST resume attempt');
  H.assert(!resA.ok, 'D2.1: a hand-edited PAUSED record with NO ' +
    'publication provenance cannot resume (status is not proof)');
  H.assert(SCA.store.get('marketplace_listings', 'mp-d2-hand-a')
    .status === 'PAUSED', 'D2.1: the forged record stays PAUSED');

  var handB = SCA.store.insert('marketplace_listings', {
    id: 'mp-d2-hand-b', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'ORGANIZATION',
    provider_id: 'org-mp-a', location_scope: 'ANYWHERE',
    availability_status: 'UNKNOWN', status: 'PAUSED',
    created_by: TECHNICIAN.name, reviewer: REVIEWER.name,
    reviewed_at: '2026-09-01T00:00:00Z', version: '1',
    history: [] });
  H.assert(handB.ok, 'D2 fixture: a PAUSED record with a resolving ' +
    'reviewer but NO review reason exists');
  var resB = SCA.marketplace.resumeListing(TECHNICIAN,
    'mp-d2-hand-b', 'TEST resume attempt');
  H.assert(!resB.ok, 'D2.1: a PAUSED record without a documented ' +
    'review reason cannot resume');
  H.assert(SCA.store.get('marketplace_listings', 'mp-d2-hand-b')
    .status === 'PAUSED',
    'D2.1: the undocumented record stays PAUSED');

  var handC = SCA.store.insert('marketplace_listings', {
    id: 'mp-d2-hand-c', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'ORGANIZATION',
    provider_id: 'org-mp-a', location_scope: 'ANYWHERE',
    availability_status: 'UNKNOWN', status: 'PAUSED',
    created_by: TECHNICIAN.name, reviewer: 'Mystery Reviewer',
    reviewed_at: '2026-09-01T00:00:00Z',
    review_reason: 'TEST forged provenance', version: '1',
    history: [] });
  H.assert(handC.ok, 'D2 fixture: a PAUSED record with a forged ' +
    'reviewer string exists');
  var resC = SCA.marketplace.resumeListing(TECHNICIAN,
    'mp-d2-hand-c', 'TEST resume attempt');
  H.assert(!resC.ok, 'D2.1: a forged reviewer string is not ' +
    'publication authority — resume is refused');
  H.assert(SCA.store.get('marketplace_listings', 'mp-d2-hand-c')
    .status === 'PAUSED', 'D2.1: the forged record stays PAUSED');

  var handD = SCA.store.insert('marketplace_listings', {
    id: 'mp-d2-hand-d', listing_kind: 'OFFER',
    service_kind: 'REPAIR', provider_type: 'ORGANIZATION',
    provider_id: 'org-mp-a', location_scope: 'ANYWHERE',
    availability_status: 'UNKNOWN', status: 'PAUSED',
    created_by: TECHNICIAN.name, reviewer: TECHNICIAN.name,
    reviewed_at: '2026-09-01T00:00:00Z',
    review_reason: 'TEST self-review provenance', version: '1',
    history: [] });
  H.assert(handD.ok, 'D2 fixture: a PAUSED record whose creator is ' +
    'also its reviewer exists');
  var resD = SCA.marketplace.resumeListing(TECHNICIAN,
    'mp-d2-hand-d', 'TEST resume attempt');
  H.assert(!resD.ok, 'D2.1: creator/reviewer separation holds at ' +
    'resume time — a self-reviewed record cannot resume');
  H.assert(SCA.store.get('marketplace_listings', 'mp-d2-hand-d')
    .status === 'PAUSED',
    'D2.1: the self-reviewed record stays PAUSED');

  /* ---------- 23. clean install ---------- */

  console.log('    23. clean install');
  SCA.store.wipe();
  SCA.store.init();
  H.assert(SCA.store.count('marketplace_listings') === 0,
    'a clean install ships ZERO listings (no fabricated ' +
    'marketplace activity)');
  var cleanOverview = SCA.marketplace.overview(REVIEWER);
  H.assert(cleanOverview.ok && cleanOverview.counts.total === 0 &&
    cleanOverview.counts.by_kind.OFFER === 0 &&
    cleanOverview.counts.by_kind.NEED === 0,
    'the clean overview is honestly zero with its explicit basis');

  /* ---------- 24. inventory preservation ---------- */

  console.log('    24. inventory preservation');
  var caps = SCA.store.all('capabilities');
  H.assert(caps.length === 240, '240 capabilities preserved');
  H.assert(SCA.store.count('families') === 12,
    '12 families preserved');

  return true;
};
