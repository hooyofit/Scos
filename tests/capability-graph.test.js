/*
 * Stage 7: Capability Dependency Graph & Systems Relationship
 * Foundation test suite.
 *
 * «No relationship documented does not mean no relationship exists.»
 * All test data is explicitly marked TEST FIXTURE. No real Somali
 * dependency claims are fabricated; the 240-capability inventory is
 * never modified; every fixture is wiped at teardown and the pristine
 * baseline is confirmed.
 */
'use strict';
var H = require('./helpers');

module.exports = function run() {
  H.loadCore();
  console.log('  capability-graph.test.js');

  var RESEARCHER = { name: 'TEST FIXTURE Researcher', role: 'researcher' };
  var TECH = { name: 'TEST FIXTURE Technician', role: 'technician' };
  var REVIEWER = { name: 'TEST FIXTURE Reviewer', role: 'reviewer' };
  var NATIONAL = { name: 'TEST FIXTURE National Admin',
    role: 'national_administrator' };
  var PUBLIC_USER = { name: 'TEST FIXTURE Public User', role: 'practitioner' };
  var ANON = null;

  /* ---------- baseline + fixture nodes ---------- */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline 240 intact');

  function cap(code) {
    return SCA.store.all('capabilities').filter(function (c) {
      return c.code === code; })[0];
  }
  var W01 = cap('W01'), W05 = cap('W05'), W06 = cap('W06'),
    W08 = cap('W08'), W09 = cap('W09'), W10 = cap('W10'),
    W11 = cap('W11'), A02 = cap('A02'), S01 = cap('S01');
  H.assert(W01 && W05 && W08 && W11 && A02 && S01,
    'fixture capabilities exist');

  var energy = SCA.store.insert('energy_sources', {
    name: 'TEST FIXTURE Solar/Battery System' }).record;
  var energy2 = SCA.store.insert('energy_sources', {
    name: 'TEST FIXTURE Grid Electricity' }).record;
  var toolRec = SCA.store.insert('tools', {
    name: 'TEST FIXTURE Hand Pump Kit' }).record;
  var resource = SCA.store.insert('resources', {
    name: 'TEST FIXTURE Fish Stock' }).record;
  var material = SCA.store.insert('materials', {
    name: 'TEST FIXTURE Battery Cells' }).record;
  var workshop = SCA.store.insert('workshops', {
    name: 'TEST FIXTURE Technical Workshop' }).record;
  var failure = SCA.store.insert('failure_scenarios', {
    name: 'TEST FIXTURE Extended Drought',
    failure_category: 'ENVIRONMENTAL' }).record;
  var org = SCA.store.insert('organizations', {
    name: 'TEST FIXTURE Cooperative', org_type: 'COOPERATIVE' }).record;
  var locRegion = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Region', location_type: 'REGION',
    privacy_level: 'PUBLIC' }).record;
  var locSecret = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Restricted Site', privacy_level: 'RESTRICTED' }).record;
  var locOther = SCA.store.insert('locations', {
    name: 'TEST FIXTURE Other Region', location_type: 'REGION',
    privacy_level: 'PUBLIC' }).record;
  var src = SCA.store.insert('evidence', {
    title: 'TEST FIXTURE Evidence Source' }).record;
  var artifact = SCA.store.insert('knowledge', {
    title: 'TEST FIXTURE Knowledge Artifact' }).record;
  var pract = SCA.training.createPractitioner(RESEARCHER, {
    public_name: 'TEST FIXTURE Pump Master',
    capability_ids: [W08.id],
    practitioner_code: 'TEST-FIXTURE-GR-01' }).record;
  H.assert(energy && toolRec && resource && material && workshop &&
    failure && org && locRegion && src && artifact && pract,
    'fixture nodes created');

  var E_STASH = { evidence_level: W08.evidence_level,
    living_status: W08.living_status,
    capability_maturity: W08.capability_maturity };

  /* ================= 1. Registry & vocabulary ================= */
  var voc = SCA.graphRegistry.RELATIONSHIPS;
  var EXPECTED = ['DEPENDS_ON', 'SUPPORTS', 'ENABLES', 'REQUIRES',
    'MAINTAINS', 'REPAIRS', 'PRODUCES', 'TEACHES', 'LOCATED_IN',
    'EVIDENCED_BY', 'DOCUMENTED_IN', 'FALLS_BACK_TO', 'FAILS_UNDER',
    'RECOVERED_BY', 'MODERNIZED_BY', 'REPRODUCES', 'USES_RESOURCE',
    'USES_ENERGY', 'REQUIRES_INSTITUTION'];
  /* NOTE: the Stage 1 frozen vocabulary (docs/capability-data-model.md)
     defines exactly these 19 types. The Stage 7 spec text says "20" but
     enumerates the same 19 — the enumeration and the frozen Stage 1 doc
     win. Nothing was renamed; nothing was added. */
  H.assertEq(Object.keys(voc).length, 19,
    'exactly the 19 frozen relationship types, no silent renames');
  EXPECTED.forEach(function (t) {
    H.assert(!!voc[t], 'vocabulary preserves ' + t);
  });

  var unknownType = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'IS_NICE_TO',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id });
  H.assert(!unknownType.ok, 'unknown relationship type rejected');

  var wrongMatrix = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'TEACHES',
    source_type: 'EVIDENCE_SOURCE', source_id: src.id,
    target_type: 'ENERGY_SOURCE', target_id: energy.id });
  H.assert(!wrongMatrix.ok &&
    wrongMatrix.errors.source_type && wrongMatrix.errors.target_type,
    'semantically inappropriate relationship rejected, not approximated');

  var selfRef = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W01.id });
  H.assert(!selfRef.ok, 'self-reference rejected');

  /* ================= 2. Canonical identity ================= */
  var missingTarget = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: 'cap-NOPE' });
  H.assert(!missingTarget.ok, 'edge to a non-existent record rejected');

  var wrongType = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'LOCATED_IN',
    source_type: 'CAPABILITY', source_id: locRegion.id,
    target_type: 'LOCATION', target_id: locRegion.id });
  H.assert(!wrongType.ok, 'source type must match the actual record');

  /* ================= 3. Lifecycle ================= */
  var rel1 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'CAPABILITY', target_id: W06.id,
    conditions: 'TEST FIXTURE: mechanical pump head only' });
  H.assert(rel1.ok && rel1.record.status === 'PROPOSED',
    'creation yields PROPOSED');

  var docEarly = SCA.graph.markDocumented(RESEARCHER, rel1.record.id,
    { reason: 'TEST FIXTURE: documenting early' });
  H.assert(!docEarly.ok && !!docEarly.errors.provenance,
    'no provenance -> cannot become DOCUMENTED');

  var skipAhead = SCA.graph.verify(REVIEWER, rel1.record.id,
    { reason: 'TEST FIXTURE: skip the chain' });
  H.assert(!skipAhead.ok, 'PROPOSED cannot jump directly to VERIFIED');

  var addProv = SCA.graph.addProvenance(RESEARCHER, rel1.record.id,
    { source_ids: [src.id] }, 'TEST FIXTURE: attached evidence');
  H.assert(addProv.ok && addProv.record.source_ids.indexOf(src.id) !== -1,
    'provenance attaches to the existing edge');
  var addBroken = SCA.graph.addProvenance(RESEARCHER, rel1.record.id,
    { source_ids: ['ev-NOPE'] }, 'TEST FIXTURE: broken reference');
  H.assert(!addBroken.ok, 'broken provenance reference rejected');

  var docOk = SCA.graph.markDocumented(RESEARCHER, rel1.record.id,
    { reason: 'TEST FIXTURE: provenance attached' });
  H.assert(docOk.ok && docOk.record.status === 'DOCUMENTED',
    'PROPOSED -> DOCUMENTED with provenance + reason');

  var verifyByResearcher = SCA.graph.verify(RESEARCHER, rel1.record.id,
    { reason: 'TEST FIXTURE: self-verification attempt' });
  H.assert(!verifyByResearcher.ok, 'researcher cannot verify');
  var verifyNoReason = SCA.graph.verify(REVIEWER, rel1.record.id, {});
  H.assert(!verifyNoReason.ok, 'verification requires a reason');

  var verifyOk = SCA.graph.verify(REVIEWER, rel1.record.id,
    { reason: 'TEST FIXTURE: reviewer confirmed' });
  H.assert(verifyOk.ok && verifyOk.record.status === 'VERIFIED' &&
    verifyOk.record.reviewer === REVIEWER.name,
    'reviewer verifies with reason + audit trail');

  var editVerified = SCA.graph.updateRelationship(RESEARCHER, rel1.record.id,
    { limitations: 'TEST FIXTURE: edited after verification' },
    'TEST FIXTURE: late edit');
  H.assert(!editVerified.ok, 'VERIFIED relationships are immutable in place');

  /* Rejection path. */
  var rel2 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: W09.id,
    target_type: 'CAPABILITY', target_id: W10.id });
  H.assert(rel2.ok, 'second relationship proposed');
  var rejectByResearcher = SCA.graph.reject(RESEARCHER, rel2.record.id,
    { reason: 'TEST FIXTURE' });
  H.assert(!rejectByResearcher.ok, 'researchers cannot reject');
  var rejectOk = SCA.graph.reject(REVIEWER, rel2.record.id,
    { reason: 'TEST FIXTURE: unsupported claim' });
  H.assert(rejectOk.ok && rejectOk.record.status === 'REJECTED',
    'reviewer rejects with recorded reason');
  var resurrect = SCA.graph.updateRelationship(RESEARCHER, rel2.record.id,
    { conditions: 'TEST FIXTURE' }, 'TEST FIXTURE');
  H.assert(!resurrect.ok, 'REJECTED is terminal');
  var reproposed = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: W09.id,
    target_type: 'CAPABILITY', target_id: W10.id,
    source_ids: [src.id] });
  H.assert(reproposed.ok, 'a rejected key may be re-proposed (history is not a veto)');

  /* ================= 4. Uniqueness & scope ================= */
  var dup = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'CAPABILITY', target_id: W06.id });
  H.assert(!dup.ok && !!dup.errors.duplicate,
    'duplicate canonical relationship rejected (attach provenance instead)');

  var scoped = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'USES_ENERGY',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'ENERGY_SOURCE', target_id: energy.id,
    scope: 'REGIONAL' });
  H.assert(!scoped.ok && !!scoped.errors.scope_description,
    'scoped relationship without description rejected');
  var scopedOk = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'USES_ENERGY',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'ENERGY_SOURCE', target_id: energy.id,
    scope: 'REGIONAL', scope_description:
      'TEST FIXTURE: solar pump installations in the fixture region only',
    region_ids: [locRegion.id] });
  H.assert(scopedOk.ok, 'same key with a different scope is a distinct relationship');
  var scopedBadRegion = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'LOCATED_IN',
    source_type: 'WORKSHOP', source_id: workshop.id,
    target_type: 'LOCATION', target_id: locRegion.id,
    scope: 'LOCAL', scope_description: 'TEST FIXTURE',
    region_ids: ['loc-NOPE'] });
  H.assert(!scopedBadRegion.ok, 'broken region reference rejected');

  /* A regional observation never becomes a national claim: filtering. */
  var allView = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id });
  var ownRegionView = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { regions: [locRegion.id] });
  var otherRegionView = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { regions: [locOther.id] });
  H.assert(ownRegionView.length === allView.length,
    'the regional relationship is visible in its own region');
  H.assert(otherRegionView.length < allView.length,
    'a region-scoped relationship is excluded from another region: ' +
    'regional observations never become universal claims');

  /* Confidence is categorical, never a certainty score. */
  var confNoBasis = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'USES_RESOURCE',
    source_type: 'CAPABILITY', source_id: W05.id,
    target_type: 'RESOURCE', target_id: resource.id,
    confidence: 'HIGH' });
  H.assert(!confNoBasis.ok && !!confNoBasis.errors.confidence_basis,
    'confidence without a documented basis rejected');
  var confOk = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'USES_RESOURCE',
    source_type: 'CAPABILITY', source_id: W05.id,
    target_type: 'RESOURCE', target_id: resource.id,
    confidence: 'MODERATE', confidence_basis:
      'TEST FIXTURE: one documented installation' });
  H.assert(confOk.ok, 'categorical confidence with basis accepted');

  /* ================= 5. Traversal ================= */
  /* Chain: W09 -> W10 (berkad maintenance needs berkad construction),
     plus a full dependency network around W08. */
  var e2 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'REQUIRES',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'TOOL', target_id: toolRec.id }).record;
  var e3 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'REQUIRES_INSTITUTION',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'ORGANIZATION', target_id: org.id }).record;
  var e4 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'TEACHES',
    source_type: 'PRACTITIONER', source_id: pract.id,
    target_type: 'CAPABILITY', target_id: W08.id }).record;
  var e5 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'FALLS_BACK_TO',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'CAPABILITY', target_id: W06.id }).record;
  var e6 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'FAILS_UNDER',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'FAILURE_SCENARIO', target_id: failure.id }).record;
  var e7 = SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'REPAIRS',
    source_type: 'WORKSHOP', source_id: workshop.id,
    target_type: 'CAPABILITY', target_id: W08.id }).record;
  /* Second dependent of W06 (TEST FIXTURE claim) so reverse-dependency
     inspection sees multiple dependents. */
  SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'REQUIRES',
    source_type: 'CAPABILITY', source_id: A02.id,
    target_type: 'CAPABILITY', target_id: W06.id });

  /* Cycle: W01 SUPPORTS A02, A02 SUPPORTS S01, S01 SUPPORTS W01. */
  SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: A02.id });
  SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: A02.id,
    target_type: 'CAPABILITY', target_id: S01.id });
  SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: S01.id,
    target_type: 'CAPABILITY', target_id: W01.id });

  var outW08 = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id });
  H.assertEq(outW08.length, 6,
    'outgoing edges: DEPENDS_ON(W06), USES_ENERGY(solar), REQUIRES(tool), ' +
    'REQUIRES_INSTITUTION(org), FALLS_BACK_TO(W06), FAILS_UNDER(drought)');
  var depsW08 = SCA.graph.dependencies(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id });
  H.assertEq(depsW08.length, 4,
    'dependencies = DEPENDS_ON/REQUIRES/USES_RESOURCE/USES_ENERGY/' +
    'REQUIRES_INSTITUTION only');
  var depsW08OnlyType = SCA.graph.dependencies(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { relationship_types: ['DEPENDS_ON'] });
  H.assertEq(depsW08OnlyType.length, 1, 'relationship-type filter works');
  var nodeTypeFilter = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { node_types: ['ORGANIZATION'] });
  H.assertEq(nodeTypeFilter.length, 1, 'node-type filter works');
  var dependentsW06 = SCA.graph.dependents(RESEARCHER,
    { type: 'CAPABILITY', id: W06.id });
  H.assert(dependentsW06.length >= 2,
    'reverse dependency: multiple dependents of the fallback capability');

  /* Direction matters: A->B is not B->A. */
  H.assertEq(SCA.graph.relationship(RESEARCHER, 'DEPENDS_ON',
    { type: 'CAPABILITY', id: W08.id }, { type: 'CAPABILITY', id: W06.id }).length, 1,
    'relationship lookup respects direction');
  H.assertEq(SCA.graph.relationship(RESEARCHER, 'DEPENDS_ON',
    { type: 'CAPABILITY', id: W06.id }, { type: 'CAPABILITY', id: W08.id }).length, 0,
    'the reversed relationship does not exist');

  /* Path: W09 has no path to W08; chain traversal with depth. */
  var noPath = SCA.graph.path(RESEARCHER,
    { type: 'CAPABILITY', id: W09.id }, { type: 'CAPABILITY', id: W08.id });
  H.assert(!noPath.found, 'no invented paths: not-found is honest');
  var cycPath = SCA.graph.path(RESEARCHER,
    { type: 'CAPABILITY', id: W01.id }, { type: 'CAPABILITY', id: S01.id },
    { relationship_types: ['SUPPORTS'] });
  H.assert(cycPath.found && cycPath.distance === 2,
    'path follows direction through the cycle without hanging');

  var sub = SCA.graph.subgraph(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, 2);
  H.assert(sub.nodes.length > 1 && sub.edges.length > 1,
    'subgraph collects nodes and edges depth-limited');
  H.assert(sub.unknown_note.indexOf('does not mean') !== -1,
    'subgraph carries the unknown semantics note');

  var cyc = SCA.graph.cycles(RESEARCHER, { type: 'CAPABILITY', id: A02.id });
  H.assertEq(cyc.cycles.length, 1,
    'the 3-node support cycle is detected');
  H.assertEq(cyc.cycles[0].nodes.length, 3, 'cycle membership preserved');
  var cycEdges = SCA.graph.outgoing(RESEARCHER,
    { type: 'CAPABILITY', id: A02.id }, { relationship_types: ['SUPPORTS'] });
  H.assertEq(cycEdges.length, 1, 'cycle edges are preserved, not removed');

  var chainRes = SCA.graph.chain(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { depth: 3 });
  H.assert(chainRes.ok && chainRes.root.dependencies.length === 4,
    'dependency chain builds the inspection tree');
  H.assert(chainRes.note.indexOf('critical') !== -1,
    'the chain view states it labels nothing as critical');

  var nb = SCA.graph.neighborhood(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id });
  H.assert(nb.groups.dependencies && nb.groups.dependencies.length === 4 &&
    Array.isArray(nb.groups.dependents) &&
    nb.groups.training && nb.groups.maintenance &&
    nb.groups.fallback && nb.groups.failure,
    'neighborhood groups dependencies, dependents, training, ' +
    'maintenance, fallback and failure');
  H.assert(nb.unknown_note.indexOf('Unknown') !== -1,
    'neighborhood carries the unknown note');

  /* Depth cap prevents runaway traversal. */
  var deep = SCA.graph.chain(RESEARCHER,
    { type: 'CAPABILITY', id: W08.id }, { depth: 999 });
  H.assert(deep.depth_cap === 25, 'absolute runaway cap enforced (25)');

  /* ================= 6. Privacy ================= */
  var anonEdges = SCA.graph.edges(ANON);
  H.assert(anonEdges.every(function (e) {
    return e.status === 'DOCUMENTED' || e.status === 'VERIFIED'; }),
    'public users never see PROPOSED relationships');
  H.assert(anonEdges.every(function (e) {
    return e.source_type !== 'PRACTITIONER' && e.target_type !== 'PRACTITIONER';
  }), 'person nodes never reach public users through the graph');

  var researchEdges = SCA.graph.edges(RESEARCHER);
  H.assert(researchEdges.length > anonEdges.length,
    'researchers see working data (PROPOSED + person edges)');
  var anonNode = SCA.graph.node(ANON, 'PRACTITIONER', pract.id);
  H.assert(!anonNode.ok, 'person node lookup is privacy-guarded');
  var researchNode = SCA.graph.node(RESEARCHER, 'PRACTITIONER', pract.id);
  H.assert(researchNode.ok, 'privileged node lookup works');

  /* Restricted location: hidden from anon, visible to privileged. */
  SCA.graph.createRelationship(RESEARCHER, {
    relationship_type: 'LOCATED_IN',
    source_type: 'WORKSHOP', source_id: workshop.id,
    target_type: 'LOCATION', target_id: locSecret.id });
  var anonOutWorkshop = SCA.graph.outgoing(ANON,
    { type: 'WORKSHOP', id: workshop.id });
  H.assert(anonOutWorkshop.every(function (s) {
    return s.edge.target_id !== locSecret.id; }),
    'restricted locations are filtered for public users');

  /* ================= 7. Integrity ================= */
  var integClean = SCA.graph.integrity();
  H.assert(integClean.ok, 'graph is internally consistent after the fixtures: ' +
    JSON.stringify(integClean.issues.slice(0, 3)));

  /* Corrupt the store directly: orphan edge, invalid status, bad type. */
  var ds = SCA.store.dataset();
  ds.collections.graph_edges.push({
    id: 'edge-ORPHAN', relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: 'cap-GHOST',
    target_type: 'CAPABILITY', target_id: W01.id,
    status: 'PROPOSED', version: 1, history: [], source_ids: [],
    region_ids: [] });
  ds.collections.graph_edges.push({
    id: 'edge-BADSTATUS', relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id,
    status: 'MAYBE', version: 1, history: [] });
  ds.collections.graph_edges.push({
    id: 'edge-BADTYPE', relationship_type: 'CURES',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id,
    status: 'PROPOSED', version: 1, history: [] });
  ds.collections.graph_edges.push({
    id: 'edge-ORPHANPROV', relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id,
    status: 'PROPOSED', version: 1, history: [],
    source_ids: ['ev-GHOST'], region_ids: ['loc-GHOST'] });
  ds.collections.graph_edges.push({
    id: 'edge-FAKEDOC', relationship_type: 'SUPPORTS',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id,
    status: 'DOCUMENTED', version: 1, history: [], source_ids: [] });
  ds.collections.graph_edges.push({
    id: 'edge-DUPCANON', relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: W08.id,
    target_type: 'CAPABILITY', target_id: W06.id,
    status: 'PROPOSED', version: 1, history: [] });
  SCA.store.replaceDataset(ds);

  var integ = SCA.graph.integrity();
  var kinds = {};
  integ.issues.forEach(function (i) { kinds[i.kind] = true; });
  H.assert(!integ.ok, 'integrity check detects injected corruption');
  H.assert(kinds.ORPHAN_SOURCE, 'orphan source detected');
  H.assert(kinds.INVALID_STATUS, 'invalid status detected');
  H.assert(kinds.UNKNOWN_RELATIONSHIP_TYPE, 'unknown relationship type detected');
  H.assert(kinds.BROKEN_PROVENANCE && kinds.BROKEN_REGION,
    'broken provenance and region references detected');
  H.assert(kinds.DUPLICATE_CANONICAL, 'duplicate canonical relationship detected');
  H.assert(kinds.INVALID_LIFECYCLE, 'DOCUMENTED/VERIFIED without provenance or reviewer detected');

  /* Retire is admin-only and audited. */
  var retireByReviewer = SCA.graph.retire(REVIEWER, 'edge-ORPHAN',
    'TEST FIXTURE: reviewer cannot retire');
  H.assert(!retireByReviewer.ok, 'retirement requires graph.admin');
  var retireOk = SCA.graph.retire(NATIONAL, 'edge-ORPHAN',
    'TEST FIXTURE: orphaned edge retired');
  H.assert(retireOk.ok && retireOk.record.status === 'REJECTED' &&
    retireOk.record.review_reason.indexOf('Retired by administrator') !== -1,
    'admin retires an orphan through the audited path (history preserved)');
  H.assert((retireOk.record.history || []).length === 1,
    'retirement preserves the previous state in history');

  /* All injected corruption is retired through the audited path —
   * nothing silently deleted. The duplicate also conflicts with the
   * supersession fixture below. */
  ['edge-BADSTATUS', 'edge-BADTYPE', 'edge-ORPHANPROV', 'edge-FAKEDOC',
   'edge-DUPCANON'].forEach(function (id) {
    var r = SCA.graph.retire(NATIONAL, id,
      'TEST FIXTURE: injected corruption retired');
    H.assert(r.ok, 'admin retires ' + id + ' through the audited path');
  });

  /* ================= 8. RBAC ================= */
  H.assert(SCA.rbac.can(ANON, 'graph.read'), 'public can read the graph');
  H.assert(!SCA.rbac.can(ANON, 'graph.create'), 'anon cannot create');
  H.assert(!SCA.rbac.can(PUBLIC_USER, 'graph.create'),
    'ordinary practitioners cannot create relationships');
  H.assert(SCA.rbac.can(TECH, 'graph.create'),
    'technicians may propose relationships');
  H.assert(SCA.rbac.can(RESEARCHER, 'graph.create') &&
    !SCA.rbac.can(RESEARCHER, 'graph.review'),
    'researchers propose but never review');
  H.assert(SCA.rbac.can(REVIEWER, 'graph.review') &&
    !SCA.rbac.can(REVIEWER, 'graph.admin'),
    'reviewers review but do not hold admin powers');
  H.assert(SCA.rbac.can(NATIONAL, 'graph.admin'),
    'national administrator holds graph.admin only');

  /* ================= 9. Audit & versioning ================= */
  var auditTrail = SCA.audit.forEntity('graph_edges', rel1.record.id);
  var actions = auditTrail.map(function (a) { return a.action; });
  H.assert(actions.indexOf('graph.created') !== -1 &&
    actions.indexOf('graph.documented') !== -1 &&
    actions.indexOf('graph.verified') !== -1,
    'lifecycle operations are audited (created/documented/verified)');
  var verifiedAudit = auditTrail.filter(function (a) {
    return a.action === 'graph.verified'; })[0];
  H.assert(verifiedAudit.old_value === 'DOCUMENTED' &&
    verifiedAudit.new_value === 'VERIFIED' &&
    verifiedAudit.reason === 'TEST FIXTURE: reviewer confirmed',
    'audit records actor, old/new state, reason');

  /* Supersession: replacement is a NEW edge; history is never destroyed. */
  var superseded = SCA.graph.supersede(RESEARCHER, rel1.record.id,
    { conditions: 'TEST FIXTURE: refined operating conditions' },
    'TEST FIXTURE: superseding with refined conditions');
  H.assert(superseded.ok, 'supersession succeeds on a VERIFIED edge');
  H.assert(superseded.replacement.supersedes_id === rel1.record.id &&
    superseded.record.status === 'SUPERSEDED' &&
    superseded.record.superseded_by_id === superseded.replacement.id,
    'supersession links old and new, both preserved');
  H.assert(superseded.replacement.status === 'PROPOSED',
    'the replacement earns its own status — verification is never inherited');
  var supersededImmutable = SCA.graph.markDocumented(RESEARCHER,
    rel1.record.id, { reason: 'TEST FIXTURE' });
  H.assert(!supersededImmutable.ok, 'SUPERSEDED is terminal');

  /* Content update versioning. */
  var upd = SCA.graph.updateRelationship(RESEARCHER, e2.id,
    { limitations: 'TEST FIXTURE: revised limitations' },
    'TEST FIXTURE: revision');
  H.assert(upd.ok && upd.record.version === 2 &&
    (upd.record.history || []).length === 1 &&
    upd.record.history[0].snapshot.version === 1 &&
    upd.record.history[0].reason === 'TEST FIXTURE: revision',
    'content update increments version and preserves the prior snapshot');
  var updNoReason = SCA.graph.updateRelationship(RESEARCHER, e2.id,
    { conditions: 'x' }, '');
  H.assert(!updNoReason.ok, 'updates require a reason');

  /* ================= 11. Evidence authority separation ================= */
  var w08now = SCA.store.get('capabilities', W08.id);
  H.assert(w08now.evidence_level === E_STASH.evidence_level &&
    w08now.living_status === E_STASH.living_status &&
    w08now.capability_maturity === E_STASH.capability_maturity,
    'graph edges never touch evidence_level, living_status or maturity');
  H.assertEq(SCA.store.count('capabilities'), 240,
    'no capability was added, removed or altered by the graph');

  /* ================= 10. Atomic import/export ================= */
  var before = SCA.store.dataset();
  var edgesBefore = before.collections.graph_edges.length;

  var pkg = JSON.parse(SCA.transfer.exportCollection('graph_edges'));
  H.assert(pkg.records.length === edgesBefore,
    'graph-only export carries every edge');
  var refColls = Object.keys(pkg.referenced || {});
  H.assert(refColls.indexOf('capabilities') !== -1 &&
    refColls.indexOf('families') !== -1 &&
    refColls.indexOf('energy_sources') !== -1 &&
    refColls.indexOf('practitioners') !== -1,
    'export carries referenced canonical nodes with it');

  /* Broken import: edge to a ghost node — rejected whole, nothing changes. */
  var brokenBundle = JSON.parse(SCA.transfer.exportAll());
  brokenBundle.collections.graph_edges.push({
    id: 'edge-GHOST', relationship_type: 'DEPENDS_ON',
    source_type: 'CAPABILITY', source_id: 'cap-GHOST2',
    target_type: 'CAPABILITY', target_id: W01.id,
    status: 'PROPOSED', version: 1, history: [] });
  var brokenRes = SCA.transfer.importBundle(JSON.stringify(brokenBundle));
  H.assert(!brokenRes.ok, 'import with an unresolvable node is rejected');
  H.assertEq(SCA.store.dataset().collections.graph_edges.length, edgesBefore,
    'atomicity: a broken import changes nothing');

  /* Invalid vocabulary in an import is rejected whole. */
  var badVocab = JSON.parse(SCA.transfer.exportAll());
  badVocab.collections.graph_edges.push({
    id: 'edge-BADVOCAB', relationship_type: 'CAUSES',
    source_type: 'CAPABILITY', source_id: W01.id,
    target_type: 'CAPABILITY', target_id: W05.id,
    status: 'PROPOSED', version: 1, history: [] });
  var badVocabRes = SCA.transfer.importBundle(JSON.stringify(badVocab));
  H.assert(!badVocabRes.ok, 'import with an unknown relationship type is rejected');

  /* Valid round-trip: wipe (NO re-seed) — the bundle must be
   * standalone-importable, the frozen Stage 2 replaceDataset semantics. */
  SCA.store.wipe();
  var roundRes = SCA.transfer.importBundle(JSON.stringify(pkg));
  H.assert(roundRes.ok, 'graph-only export re-imports standalone: ' +
    (roundRes.errors || '').toString());
  H.assertEq(SCA.store.count('graph_edges'), edgesBefore,
    'round-trip restores every edge');
  H.assert(SCA.store.count('capabilities') > 0 &&
    SCA.store.count('families') > 0 &&
    SCA.store.count('practitioners') > 0,
    'referenced canonical nodes ride along with the graph export');

  /* ================= 12. Teardown ================= */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240,
    'teardown: pristine baseline 240 restored');
  H.assertEq(SCA.store.count('families'), 12, 'teardown: 12 families restored');
  H.assertEq(SCA.store.count('graph_edges'), 0, 'teardown: no graph edges remain');
  H.assertEq(SCA.store.count('workshops'), 0, 'teardown: no workshops remain');
  H.assertEq(SCA.store.count('resources'), 0, 'teardown: no resources remain');
  H.assertEq(SCA.store.count('materials'), 0, 'teardown: no materials remain');
  H.assertEq(SCA.store.count('tools'), 0, 'teardown: no tools remain');
  H.assertEq(SCA.store.count('energy_sources'), 0,
    'teardown: no energy sources remain');
  H.assertEq(SCA.store.count('failure_scenarios'), 0,
    'teardown: no failure scenarios remain');
  H.assertEq(SCA.store.count('practitioners'), 0,
    'teardown: no practitioner fixtures remain');
  H.assertEq(SCA.store.count('audit_log'), 0,
    'teardown: no audit fixtures remain');
  H.assertEq(SCA.store.count('census_observations'), 0,
    'teardown: Stage 1-6 collections pristine (census untouched)');

  console.log('    capability-graph suite done');
};
