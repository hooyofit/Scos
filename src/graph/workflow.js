/*
 * Graph workflow (Stage 7): the Somali Capability Graph substrate.
 *
 * CENTRAL PRINCIPLE: «No relationship documented» never means
 * «no relationship exists.» The graph is an evidence-backed
 * representation of what has been documented — NO_EDGE means "not
 * currently represented", never "proven independent".
 *
 * The graph DESCRIBES relationships. It never becomes an alternate
 * authority system: no capability evidence_level, living_status,
 * maturity, competence level or certification is ever changed by a
 * graph edge. Stage 3 owns evidence, Stage 5 owns competence.
 *
 * No automatic inference: every substantive relationship originates
 * from explicit researcher entry, imported reviewed data, or another
 * explicitly authorized workflow. Nothing is created from text, and
 * "usually required" is never silently turned into DEPENDS_ON.
 *
 * Cycles are legitimate: they are detected, displayed and preserved —
 * never crashed on, never traversed infinitely, and never automatically
 * classified as good or bad.
 */
(function (SCA) {
  'use strict';

  var R = null; /* set on first use: SCA.graphRegistry */
  var STATUSES = ['PROPOSED', 'DOCUMENTED', 'VERIFIED', 'REJECTED',
    'SUPERSEDED'];
  var EDITABLE = ['PROPOSED', 'DOCUMENTED'];
  /* Content fields a researcher may update on a live edge. Status and
   * identity are never edited here — status moves through the lifecycle
   * functions, identity through supersession. */
  var CONTENT_FIELDS = ['evidence_status', 'confidence', 'confidence_basis',
    'scope', 'scope_description', 'conditions', 'limitations', 'region_ids'];

  /* Provenance fields -> canonical collections. A relationship without
   * provenance may exist as PROPOSED, but must not become VERIFIED. */
  var PROVENANCE_FIELDS = {
    source_ids: 'evidence',
    knowledge_artifact_ids: 'knowledge',
    field_observation_ids: 'observations',
    research_project_ids: 'research_projects',
    census_observation_ids: 'census_observations'
  };

  function registry() {
    if (!R) { R = SCA.graphRegistry; }
    return R;
  }

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }

  /* ---------- nodes ---------- */
  function normalizeNode(node) {
    if (!node || typeof node !== 'object') {
      return { ok: false, errors: { node: 'A node is { type, id }.' } };
    }
    if (!registry().nodeTypeExists(node.type)) {
      return { ok: false, errors: { node: 'Unknown node type: ' + node.type } };
    }
    if (!node.id || typeof node.id !== 'string') {
      return { ok: false, errors: { node: 'A node needs a canonical id.' } };
    }
    return { ok: true, type: node.type, id: node.id };
  }

  function nodeKey(node) { return node.type + ':' + node.id; }

  /* Fetch the canonical record behind a node. */
  function nodeRecord(node) {
    var n = normalizeNode(node);
    if (!n.ok) { return null; }
    return SCA.store.get(registry().collectionFor(n.type), n.id) || null;
  }

  /* ---------- privacy ---------- */
  /* Person nodes (practitioners, apprentices) are only visible to
   * users trusted to create or review graph work. Public users never
   * receive restricted personal information through the graph. */
  function personVisible(user) {
    return can(user, 'graph.create') || can(user, 'graph.review') ||
      can(user, 'graph.admin');
  }

  /* Locations with a non-public privacy level stay protected. */
  function locationVisible(user, record) {
    if (!record) { return false; }
    var lvl = record.privacy_level;
    if (!lvl || lvl === 'PUBLIC') { return true; }
    return personVisible(user);
  }

  function nodeVisible(user, type, record) {
    if (!record) { return false; }
    if (registry().PERSON_NODE_TYPES.indexOf(type) !== -1) {
      return personVisible(user);
    }
    if (type === 'LOCATION') { return locationVisible(user, record); }
    return true;
  }

  /* Which statuses a user may see. Unreviewed PROPOSED relationships
   * are working data: public users see DOCUMENTED and VERIFIED only.
   * REJECTED/SUPERSEDED edges are history — visible on explicit request
   * to reviewers and above. */
  function visibleStatuses(user, statuses) {
    if (Object.prototype.toString.call(statuses) === '[object Array]' &&
        statuses.length) {
      var allowed = statuses.filter(function (st) {
        return (st === 'REJECTED' || st === 'SUPERSEDED') ?
          can(user, 'graph.review') : STATUSES.indexOf(st) !== -1;
      });
      return allowed;
    }
    return personVisible(user) ? ['PROPOSED', 'DOCUMENTED', 'VERIFIED'] :
      ['DOCUMENTED', 'VERIFIED'];
  }

  function edgeVisible(user, edge) {
    if (!edge) { return false; }
    var src = nodeRecord({ type: edge.source_type, id: edge.source_id });
    var tgt = nodeRecord({ type: edge.target_type, id: edge.target_id });
    return nodeVisible(user, edge.source_type, src) &&
      nodeVisible(user, edge.target_type, tgt);
  }

  /* All edges this user may see, privacy + status filtered. */
  function edges(user, opts) {
    opts = opts || {};
    var st = visibleStatuses(user, opts.statuses);
    var types = opts.relationship_types;
    var regions = opts.regions;
    return SCA.store.all('graph_edges').filter(function (e) {
      if (st.indexOf(e.status) === -1) { return false; }
      if (types && types.length &&
          types.indexOf(e.relationship_type) === -1) { return false; }
      if (regions && regions.length) {
        var hit = (e.region_ids || []).some(function (r) {
          return regions.indexOf(r) !== -1;
        });
        if (!hit && e.scope !== 'GENERAL' && e.scope !== 'NATIONAL') {
          return false; /* scoped elsewhere: excluded from this view */
        }
      }
      return edgeVisible(user, e);
    });
  }

  /* Privacy-checked single node fetch for the UI. */
  function node(user, type, id) {
    var n = normalizeNode({ type: type, id: id });
    if (!n.ok) { return n; }
    var rec = nodeRecord(n);
    if (!rec) {
      return { ok: false, errors: { node: 'No canonical record: ' + nodeKey(n) } };
    }
    if (!nodeVisible(user, type, rec)) {
      return { ok: false, errors: { permission: 'This node is not visible to you.' } };
    }
    return { ok: true, record: rec, type: type };
  }

  /* ---------- validation ---------- */
  function validateProvenance(rec, errors) {
    Object.keys(PROVENANCE_FIELDS).forEach(function (field) {
      var ids = rec[field] || [];
      ids.forEach(function (id) {
        if (!SCA.store.get(PROVENANCE_FIELDS[field], id)) {
          (errors[field] = errors[field] || []).push(
            'Unknown ' + field + ' reference: ' + id);
        }
      });
    });
  }

  function hasProvenance(rec) {
    return Object.keys(PROVENANCE_FIELDS).some(function (field) {
      return (rec[field] || []).length > 0;
    });
  }

  function validateRegions(rec, errors) {
    (rec.region_ids || []).forEach(function (id) {
      if (!SCA.store.get('locations', id)) {
        (errors.region_ids = errors.region_ids || []).push(
          'Unknown location reference: ' + id);
      }
    });
  }

  function validateEdgeRecord(rec) {
    var errors = {};
    var rel = registry().validateRelationship(rec.relationship_type,
      rec.source_type, rec.target_type);
    if (!rel.ok) {
      Object.keys(rel.errors).forEach(function (k) { errors[k] = rel.errors[k]; });
    }
    if (registry().isSelfReference(rec.source_type, rec.source_id,
      rec.target_type, rec.target_id)) {
      errors.target_id = 'A node cannot have a relationship to itself.';
    }
    var src = nodeRecord({ type: rec.source_type, id: rec.source_id });
    var tgt = nodeRecord({ type: rec.target_type, id: rec.target_id });
    if (!src) {
      errors.source_id = 'No canonical source record: ' + rec.source_type +
        ' ' + rec.source_id;
    }
    if (!tgt) {
      errors.target_id = 'No canonical target record: ' + rec.target_type +
        ' ' + rec.target_id;
    }
    validateProvenance(rec, errors);
    validateRegions(rec, errors);
    var scope = rec.scope || 'GENERAL';
    if (scope !== 'GENERAL' && !(rec.scope_description || '').trim()) {
      errors.scope_description = 'A scoped relationship must describe its ' +
        'scope. A regional observation must never silently become a ' +
        'universal claim.';
    }
    var conf = rec.confidence || 'UNASSESSED';
    if (conf !== 'UNASSESSED' && !(rec.confidence_basis || '').trim()) {
      errors.confidence_basis = 'A confidence above Not-assessed requires ' +
        'a documented basis. Confidence is a documentation-quality ' +
        'statement, not a certainty score.';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /* Duplicate canonical relationship: same source, target, type and
   * scope. REJECTED and SUPERSEDED edges do not block re-proposal —
   * they are recorded history, not vetoes. */
  function findDuplicate(rec) {
    var key = [rec.relationship_type, rec.source_type, rec.source_id,
      rec.target_type, rec.target_id, rec.scope || 'GENERAL'].join('|');
    return SCA.store.all('graph_edges').filter(function (e) {
      return e.status !== 'REJECTED' && e.status !== 'SUPERSEDED' &&
        [e.relationship_type, e.source_type, e.source_id, e.target_type,
        e.target_id, e.scope || 'GENERAL'].join('|') === key;
    })[0] || null;
  }

  /* ---------- versioning ---------- */
  function snapshotOf(edge) {
    var copy = {};
    Object.keys(edge).forEach(function (k) {
      if (k !== 'history') { copy[k] = edge[k]; }
    });
    return copy;
  }

  function pushHistory(edge, user, reason) {
    edge.history = edge.history || [];
    edge.history.push({
      version: edge.version || 1,
      changed_at: SCA.util.now(),
      changed_by: userName(user),
      reason: reason || null,
      status: edge.status,
      snapshot: snapshotOf(edge)
    });
    edge.version = (edge.version || 1) + 1;
    return edge;
  }

  /* ---------- lifecycle ---------- */
  function createRelationship(user, data) {
    if (!can(user, 'graph.create')) { return deny('graph.create'); }
    var rec = {
      relationship_type: data.relationship_type,
      source_type: data.source_type,
      source_id: data.source_id,
      target_type: data.target_type,
      target_id: data.target_id,
      evidence_status: data.evidence_status || null,
      source_ids: data.source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      field_observation_ids: data.field_observation_ids || [],
      research_project_ids: data.research_project_ids || [],
      census_observation_ids: data.census_observation_ids || [],
      region_ids: data.region_ids || [],
      confidence: data.confidence || 'UNASSESSED',
      confidence_basis: data.confidence_basis || '',
      scope: data.scope || 'GENERAL',
      scope_description: data.scope_description || '',
      conditions: data.conditions || '',
      limitations: data.limitations || '',
      created_by: userName(user),
      version: 1,
      history: [],
      provenance: data.provenance ||
        ('Relationship recorded by ' + userName(user) +
        ' through the Atlas graph (Stage 7).')
    };
    var v = validateEdgeRecord(rec);
    if (!v.ok) { return { ok: false, errors: v.errors }; }
    var dup = findDuplicate(rec);
    if (dup) {
      return { ok: false, errors: { duplicate:
        'This relationship already exists (edge ' + dup.id + ', status ' +
        dup.status + '). Attach additional provenance to the existing ' +
        'edge instead of duplicating it.' } };
    }
    rec.status = 'PROPOSED';
    var res = SCA.store.insert('graph_edges', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('graph.created', {
      actor: userName(user), entity: 'graph_edges', entity_id: res.record.id,
      new_value: rec.relationship_type + ' ' + rec.source_type + ':' +
      rec.source_id + ' -> ' + rec.target_type + ':' + rec.target_id
    });
    return { ok: true, record: res.record };
  }

  function getEdge(id) {
    return SCA.store.get('graph_edges', id) || null;
  }

  /* PROPOSED -> DOCUMENTED. Requires provenance: an undocumented
   * assumption must never silently become a documented fact. */
  function markDocumented(user, id, opts) {
    opts = opts || {};
    if (!can(user, 'graph.update')) { return deny('graph.update'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (edge.status !== 'PROPOSED') {
      return { ok: false, errors: { status: 'Only a PROPOSED relationship ' +
        'can be marked DOCUMENTED (current: ' + edge.status + ').' } };
    }
    if (!(opts.reason || '').trim()) {
      return { ok: false, errors: { reason: 'A reason is required.' } };
    }
    if (!hasProvenance(edge)) {
      return { ok: false, errors: { provenance: 'Documenting a relationship ' +
        'requires provenance. Attach evidence, a knowledge artifact, a ' +
        'field observation, a research project or a census observation ' +
        'first.' } };
    }
    pushHistory(edge, user, opts.reason);
    var res = SCA.store.update('graph_edges', id, { status: 'DOCUMENTED',
      history: edge.history, version: edge.version });
    if (!res.ok) { return res; }
    SCA.audit.log('graph.documented', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      old_value: 'PROPOSED', new_value: 'DOCUMENTED', reason: opts.reason,
      version: String(res.record.version) });
    return { ok: true, record: res.record };
  }

  /* DOCUMENTED -> VERIFIED. Reviewer-controlled; no self-verification
   * shortcut, no automatic verification, no AI verification. */
  function verify(user, id, opts) {
    opts = opts || {};
    if (!can(user, 'graph.review')) { return deny('graph.review'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (edge.status !== 'DOCUMENTED') {
      return { ok: false, errors: { status: 'Only a DOCUMENTED relationship ' +
        'can be verified (current: ' + edge.status + '). The chain is ' +
        'PROPOSED -> DOCUMENTED -> VERIFIED.' } };
    }
    if (!(opts.reason || '').trim()) {
      return { ok: false, errors: { reason: 'A verification reason is required.' } };
    }
    if (!hasProvenance(edge)) {
      return { ok: false, errors: { provenance: 'Verification requires provenance.' } };
    }
    pushHistory(edge, user, opts.reason);
    var res = SCA.store.update('graph_edges', id, {
      status: 'VERIFIED', reviewer: userName(user),
      reviewed_at: SCA.util.now(), review_reason: opts.reason,
      history: edge.history, version: edge.version });
    if (!res.ok) { return res; }
    SCA.audit.log('graph.verified', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      old_value: 'DOCUMENTED', new_value: 'VERIFIED', reason: opts.reason,
      version: String(res.record.version) });
    return { ok: true, record: res.record };
  }

  function reject(user, id, opts) {
    opts = opts || {};
    if (!can(user, 'graph.review')) { return deny('graph.review'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (EDITABLE.indexOf(edge.status) === -1) {
      return { ok: false, errors: { status: 'A ' + edge.status +
        ' relationship cannot be rejected.' } };
    }
    if (!(opts.reason || '').trim()) {
      return { ok: false, errors: { reason: 'A rejection reason is required.' } };
    }
    pushHistory(edge, user, opts.reason);
    var res = SCA.store.update('graph_edges', id, {
      status: 'REJECTED', reviewer: userName(user),
      reviewed_at: SCA.util.now(), review_reason: opts.reason,
      history: edge.history, version: edge.version });
    if (!res.ok) { return res; }
    SCA.audit.log('graph.rejected', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      old_value: edge.history[edge.history.length - 1].status,
      new_value: 'REJECTED', reason: opts.reason, version: String(res.record.version) });
    return { ok: true, record: res.record };
  }

  /* Content updates on live edges. VERIFIED relationships are never
   * edited in place: they are superseded, so the verified state is
   * preserved in history. */
  function updateRelationship(user, id, changes, reason) {
    if (!can(user, 'graph.update')) { return deny('graph.update'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (EDITABLE.indexOf(edge.status) === -1) {
      return { ok: false, errors: { status: 'A ' + edge.status +
        ' relationship is immutable. Supersede it (DOCUMENTED/VERIFIED) ' +
        'or propose a new one.' } };
    }
    if (!(reason || '').trim()) {
      return { ok: false, errors: { reason: 'A change reason is required.' } };
    }
    var next = snapshotOf(edge);
    var touched = false;
    CONTENT_FIELDS.forEach(function (f) {
      if (changes && Object.prototype.hasOwnProperty.call(changes, f)) {
        next[f] = changes[f];
        touched = true;
      }
    });
    if (!touched) {
      return { ok: false, errors: { changes: 'No updatable field supplied ' +
        '(allowed: ' + CONTENT_FIELDS.join(', ') + ').' } };
    }
    var v = validateEdgeRecord(next);
    if (!v.ok) { return { ok: false, errors: v.errors }; }
    var dup = findDuplicate(next);
    if (dup && dup.id !== id) {
      return { ok: false, errors: { duplicate:
        'This change would duplicate edge ' + dup.id + '.' } };
    }
    pushHistory(edge, user, reason);
    var patch = { history: edge.history, version: edge.version };
    CONTENT_FIELDS.forEach(function (f) { patch[f] = next[f]; });
    var res = SCA.store.update('graph_edges', id, patch);
    if (!res.ok) { return res; }
    SCA.audit.log('graph.updated', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      reason: reason, version: String(res.record.version),
      new_value: 'content updated' });
    return { ok: true, record: res.record };
  }

  /* Attach provenance (merges, never replaces). */
  function addProvenance(user, id, refs, reason) {
    if (!can(user, 'graph.update')) { return deny('graph.update'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (EDITABLE.indexOf(edge.status) === -1) {
      return { ok: false, errors: { status: 'A ' + edge.status +
        ' relationship cannot be edited in place.' } };
    }
    if (!(reason || '').trim()) {
      return { ok: false, errors: { reason: 'A reason is required.' } };
    }
    refs = refs || {};
    var merged = {};
    var any = false;
    var refErrors = {};
    Object.keys(PROVENANCE_FIELDS).forEach(function (f) {
      var existing = edge[f] || [];
      var incoming = (refs[f] || []).filter(function (id2) {
        return existing.indexOf(id2) === -1;
      });
      incoming.forEach(function (id2) {
        if (!SCA.store.get(PROVENANCE_FIELDS[f], id2)) {
          (refErrors[f] = refErrors[f] || []).push(
            'Unknown ' + f + ' reference: ' + id2);
        }
      });
      if (incoming.length) { any = true; }
      merged[f] = existing.concat(incoming);
    });
    if (Object.keys(refErrors).length) {
      return { ok: false, errors: refErrors };
    }
    if (!any) { return { ok: false, errors: { provenance:
      'No new provenance references supplied (or they already exist).' } }; }
    pushHistory(edge, user, reason);
    var patch = { history: edge.history, version: edge.version };
    Object.keys(merged).forEach(function (f) { patch[f] = merged[f]; });
    var res = SCA.store.update('graph_edges', id, patch);
    if (!res.ok) { return res; }
    SCA.audit.log('graph.provenance_added', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      reason: reason, version: String(res.record.version),
      new_value: 'provenance attached' });
    return { ok: true, record: res.record };
  }

  /* Supersession: the replacement starts as PROPOSED and must earn its
   * own status through the lifecycle — verification is per-edge and
   * never inherited. The superseded edge is preserved forever. */
  function supersede(user, oldId, changes, reason) {
    if (!can(user, 'graph.update')) { return deny('graph.update'); }
    var old = getEdge(oldId);
    if (!old) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (['DOCUMENTED', 'VERIFIED'].indexOf(old.status) === -1) {
      return { ok: false, errors: { status: 'Only DOCUMENTED or VERIFIED ' +
        'relationships are superseded (current: ' + old.status +
        '). PROPOSED edges are simply edited.' } };
    }
    if (!(reason || '').trim()) {
      return { ok: false, errors: { reason: 'A supersession reason is required.' } };
    }
    changes = changes || {};
    var data = {
      relationship_type: changes.relationship_type || old.relationship_type,
      source_type: old.source_type, source_id: old.source_id,
      target_type: old.target_type, target_id: old.target_id,
      evidence_status: changes.evidence_status || old.evidence_status,
      source_ids: old.source_ids, knowledge_artifact_ids: old.knowledge_artifact_ids,
      field_observation_ids: old.field_observation_ids,
      research_project_ids: old.research_project_ids,
      census_observation_ids: old.census_observation_ids,
      region_ids: changes.region_ids || old.region_ids,
      confidence: changes.confidence || old.confidence,
      confidence_basis: changes.confidence_basis || old.confidence_basis,
      scope: changes.scope || old.scope,
      scope_description: changes.scope_description || old.scope_description,
      conditions: changes.conditions || old.conditions,
      limitations: changes.limitations || old.limitations
    };
    /* The replacement must differ from what it replaces. */
    var v = validateEdgeRecord(data);
    if (!v.ok) { return { ok: false, errors: v.errors }; }
    var dup = findDuplicate(data);
    if (dup && dup.id !== oldId) {
      return { ok: false, errors: { duplicate:
        'The replacement would duplicate edge ' + dup.id + '.' } };
    }
    pushHistory(old, user, reason);
    var resOld = SCA.store.update('graph_edges', oldId, {
      status: 'SUPERSEDED', superseded_by_id: null,
      history: old.history, version: old.version });
    if (!resOld.ok) { return resOld; }
    /* Create the replacement edge (bypasses the duplicate scan through
     * the same create path — the old edge is now SUPERSEDED). */
    var resNew = createRelationship(user, data);
    if (!resNew.ok) {
      /* Roll the old edge back to its former state — nothing partial. */
      SCA.store.update('graph_edges', oldId, {
        status: old.history[old.history.length - 1].status,
        superseded_by_id: null, history: old.history,
        version: old.version });
      return resNew;
    }
    SCA.store.update('graph_edges', oldId, {
      superseded_by_id: resNew.record.id });
    SCA.store.update('graph_edges', resNew.record.id, {
      supersedes_id: oldId });
    resNew.record = getEdge(resNew.record.id); /* re-fetch: the audit
      and the caller must see the linked replacement, not the stale
      pre-link record */
    SCA.audit.log('graph.superseded', {
      actor: userName(user), entity: 'graph_edges', entity_id: oldId,
      old_value: old.status, new_value: 'SUPERSEDED', reason: reason,
      version: String(resOld.record.version), new_id: resNew.record.id });
    return { ok: true, record: getEdge(oldId), replacement: resNew.record };
  }

  /* Administrative retirement of an orphaned/broken edge. History is
   * preserved: retirement is a RECORDED rejection, never a silent
   * deletion. */
  function retire(user, id, reason) {
    if (!can(user, 'graph.admin')) { return deny('graph.admin'); }
    var edge = getEdge(id);
    if (!edge) { return { ok: false, errors: { id: 'Unknown edge.' } }; }
    if (['REJECTED', 'SUPERSEDED'].indexOf(edge.status) !== -1) {
      return { ok: false, errors: { status: 'A ' + edge.status +
        ' edge is already retired.' } };
    }
    if (!(reason || '').trim()) {
      return { ok: false, errors: { reason: 'A retirement reason is required.' } };
    }
    pushHistory(edge, user, reason);
    var res = SCA.store.update('graph_edges', id, {
      status: 'REJECTED', reviewer: userName(user),
      reviewed_at: SCA.util.now(),
      review_reason: 'Retired by administrator: ' + reason,
      history: edge.history, version: edge.version });
    if (!res.ok) { return res; }
    SCA.audit.log('graph.retired', {
      actor: userName(user), entity: 'graph_edges', entity_id: id,
      old_value: edge.history[edge.history.length - 1].status,
      new_value: 'REJECTED', reason: reason, version: String(res.record.version) });
    return { ok: true, record: res.record };
  }

  /* ---------- traversal ---------- */
  function matchType(opts, edge) {
    var t = opts.relationship_types;
    return !t || !t.length || t.indexOf(edge.relationship_type) !== -1;
  }

  function matchNodeType(opts, type) {
    var t = opts.node_types;
    return !t || !t.length || t.indexOf(type) !== -1;
  }

  function baseOpts(opts) {
    opts = opts || {};
    if (opts.depth === undefined || opts.depth === null) { opts.depth = 1; }
    if (opts.depth > 25) { opts.depth = 25; } /* absolute runaway cap */
    return opts;
  }

  function outgoing(user, node, opts) {
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    opts = baseOpts(opts);
    return edges(user, opts).filter(function (e) {
      return e.source_type === n.type && e.source_id === n.id;
    }).map(function (e) {
      return { edge: e, target: { type: e.target_type, id: e.target_id } };
    }).filter(function (x) {
      return matchNodeType(opts, x.target.type);
    });
  }

  function incoming(user, node, opts) {
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    opts = baseOpts(opts);
    return edges(user, opts).filter(function (e) {
      return e.target_type === n.type && e.target_id === n.id;
    }).map(function (e) {
      return { edge: e, source: { type: e.source_type, id: e.source_id } };
    }).filter(function (x) {
      return matchNodeType(opts, x.source.type);
    });
  }

  function neighbors(user, node, opts) {
    opts = baseOpts(opts);
    var out = outgoing(user, node, opts);
    var inc = incoming(user, node, opts);
    return out.map(function (x) {
      return { edge: x.edge, direction: 'outgoing',
        other: x.target, role: 'source' };
    }).concat(inc.map(function (x) {
      return { edge: x.edge, direction: 'incoming',
        other: x.source, role: 'target' };
    }));
  }

  /* What this node NEEDS: DEPENDS_ON, REQUIRES, USES_RESOURCE,
   * USES_ENERGY, REQUIRES_INSTITUTION. Inspection only — no risk
   * labels, no criticality. */
  /* Dependency-type filtering always applies; a caller-provided type
   * filter INTERSECTS with it (never overrides it). */
  function dependencyTypes(opts) {
    var deps = registry().DEPENDENCY_TYPES;
    var given = opts.relationship_types;
    if (!given || !given.length) { return deps; }
    return deps.filter(function (t) { return given.indexOf(t) !== -1; });
  }

  function dependencies(user, node, opts) {
    opts = baseOpts(opts);
    opts.relationship_types = dependencyTypes(opts);
    return outgoing(user, node, opts);
  }

  function dependents(user, node, opts) {
    opts = baseOpts(opts);
    opts.relationship_types = dependencyTypes(opts);
    return incoming(user, node, opts);
  }

  function relationship(user, type, sourceNode, targetNode) {
    var s = normalizeNode(sourceNode); var t = normalizeNode(targetNode);
    if (!s.ok) { return s; } if (!t.ok) { return t; }
    return edges(user, { statuses: STATUSES }).filter(function (e) {
      return e.relationship_type === type &&
        e.source_type === s.type && e.source_id === s.id &&
        e.target_type === t.type && e.target_id === t.id;
    });
  }

  /* Breadth-first path between two nodes. Deterministic (stable edge
   * order), cycle-safe (visited set), depth-capped. Returns the edge
   * sequence; direction matters — a path follows edge direction. */
  function path(user, fromNode, toNode, opts) {
    opts = opts || {};
    opts.depth = opts.depth || 10; /* default BEFORE baseOpts, which
      would otherwise floor an absent depth to a single hop */
    opts = baseOpts(opts);
    var from = normalizeNode(fromNode); var to = normalizeNode(toNode);
    if (!from.ok) { return from; } if (!to.ok) { return to; }
    var queue = [{ node: from, trail: [], depth: 0 }];
    var seen = {};
    seen[nodeKey(from)] = true;
    while (queue.length) {
      var cur = queue.shift();
      if (cur.depth >= opts.depth) { continue; }
      var outs = outgoing(user, cur.node, opts);
      for (var i = 0; i < outs.length; i++) {
        var step = outs[i];
        var key = nodeKey(step.target);
        if (key === nodeKey(to)) {
          return { found: true, distance: cur.depth + 1,
            edges: cur.trail.concat([step.edge]),
            nodes: [from].concat(cur.trail.map(function (t) {
              return t.target; }).concat([step.target])) };
        }
        if (!seen[key]) {
          seen[key] = true;
          queue.push({ node: step.target,
            trail: cur.trail.concat([step.edge]), depth: cur.depth + 1 });
        }
      }
    }
    return { found: false, distance: null, edges: [], nodes: [] };
  }

  /* Depth-limited neighborhood subgraph. Cycle-safe: each node enters
   * the frontier once. */
  function subgraph(user, node, depth, opts) {
    opts = baseOpts(opts);
    opts.depth = depth;
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    var nodes = [{ node: { type: n.type, id: n.id }, depth: 0 }];
    var edgesSeen = [];
    var seen = {}; seen[nodeKey(n)] = true;
    var frontier = [{ type: n.type, id: n.id }];
    for (var d = 0; d < depth; d++) {
      var next = [];
      frontier.forEach(function (fn) {
        neighbors(user, fn, opts).forEach(function (nb) {
          var key = nodeKey(nb.other);
          if (!seen[key]) {
            seen[key] = true;
            nodes.push({ node: nb.other, depth: d + 1 });
            next.push(nb.other);
          }
          if (!edgesSeen.some(function (e) { return e.id === nb.edge.id; })) {
            edgesSeen.push(nb.edge);
          }
        });
      });
      frontier = next;
      if (!frontier.length) { break; }
    }
    return { ok: true, nodes: nodes, edges: edgesSeen,
      unknown_note: 'No relationship documented does not mean no ' +
      'relationship exists.' };
  }

  /* Cycle detection around a node: DFS within the reachable subgraph.
   * Cycles are legitimate; they are reported, never judged and never
   * destroyed. */
  function cycles(user, node, opts) {
    opts = baseOpts(opts);
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    var found = [];
    var stack = [];
    var onStack = {};
    var seenDone = {};

    function dfs(cur) {
      var key = nodeKey(cur);
      onStack[key] = true;
      stack.push(cur);
      outgoing(user, cur, opts).forEach(function (step) {
        var tkey = nodeKey(step.target);
        if (onStack[tkey]) {
          /* cycle: slice the stack from the first occurrence */
          var start = stack.map(nodeKey).indexOf(tkey);
          var cycNodes = stack.slice(start);
          var cycEdges = [step.edge];
          for (var i = start; i < stack.length - 1; i++) {
            var mid = outgoing(user, stack[i], opts).filter(function (x) {
              return nodeKey(x.target) === nodeKey(stack[i + 1]);
            })[0];
            if (mid) { cycEdges.unshift(mid.edge); }
          }
          var sig = cycNodes.map(nodeKey).join('>') + '>' + tkey;
          if (!found.some(function (c) { return c.signature === sig; })) {
            found.push({ signature: sig, nodes: cycNodes,
              edges: cycEdges });
          }
        } else if (!seenDone[tkey]) {
          dfs(step.target);
        }
      });
      stack.pop();
      onStack[key] = false;
      seenDone[key] = true;
    }

    dfs({ type: n.type, id: n.id });
    return { ok: true, cycles: found };
  }

  /* Dependency-chain tree: an inspection representation. Depth-capped,
   * cycle-safe (a node appears once per branch path). NO labels:
   * nothing in the chain is called critical, vulnerable or high-risk —
   * Stage 7 shows relationships only. */
  function chain(user, node, opts) {
    opts = baseOpts(opts);
    opts.depth = opts.depth || 8;
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    var capped = Math.min(opts.depth, 25);

    function build(cur, depth, inPath) {
      var children = [];
      if (depth >= capped) {
        return { node: cur, depth_reached: true, dependencies: children };
      }
      dependencies(user, cur, opts).forEach(function (step) {
        var key = nodeKey(step.target);
        if (inPath.indexOf(key) !== -1) {
          children.push({ node: step.target, edge: step.edge,
            cycle: true, dependencies: [] });
          return; /* cycle membership preserved, never expanded */
        }
        var sub = build(step.target, depth + 1, inPath.concat([key]));
        sub.edge = step.edge;
        children.push(sub);
      });
      return { node: cur, dependencies: children };
    }

    return { ok: true, root: build({ type: n.type, id: n.id }, 0,
      [nodeKey(n)]), depth_cap: capped,
      note: 'Inspection view. No chain is labeled high-risk, critical ' +
      'or vulnerable: Stage 7 documents relationships only.' };
  }

  /* Neighborhood: every relationship group around a node, with the
   * standing unknown note. */
  function neighborhood(user, node, opts) {
    opts = baseOpts(opts);
    var n = normalizeNode(node);
    if (!n.ok) { return n; }
    var groups = {};
    var deps = registry().DEPENDENCY_TYPES;
    outgoing(user, n, opts).forEach(function (step) {
      var cat = (registry().RELATIONSHIPS[step.edge.relationship_type] ||
        {}).category || 'other';
      if (deps.indexOf(step.edge.relationship_type) !== -1) {
        groups.dependencies = groups.dependencies || [];
        groups.dependencies.push(step);
        return;
      }
      groups[cat] = groups[cat] || [];
      groups[cat].push(step);
    });
    /* Incoming edges: relationships directed AT this node — who
     * teaches it, repairs it, supports it. Dependency-type incoming
     * edges are reported separately as 'dependents'. An incoming edge
     * keeps its direction: it is never silently flipped. */
    incoming(user, n, opts).forEach(function (step) {
      var t = step.edge.relationship_type;
      if (deps.indexOf(t) !== -1) { return; }
      var cat = (registry().RELATIONSHIPS[t] || {}).category || 'other';
      groups[cat] = groups[cat] || [];
      groups[cat].push({ edge: step.edge, source: step.source,
        direction: 'incoming' });
    });
    groups.dependents = dependents(user, n, opts);
    return { ok: true, node: { type: n.type, id: n.id }, groups: groups,
      unknown_note: 'No relationship documented does not mean no ' +
      'relationship exists. Everything not represented here is ' +
      'Unknown, not independent.' };
  }

  /* ---------- integrity ---------- */
  /* Graph integrity report. Detects orphans, broken provenance,
   * duplicates and invalid states. An orphan edge must never silently
   * remain in production data — detect it, report it, retire it
   * through the audited path. */
  function integrity() {
    var issues = [];
    var all = SCA.store.all('graph_edges');
    var byId = {};
    all.forEach(function (e) { byId[e.id] = e; });
    var seenKeys = {};
    all.forEach(function (e) {
      var rel = registry().RELATIONSHIPS[e.relationship_type];
      if (!rel) {
        issues.push({ kind: 'UNKNOWN_RELATIONSHIP_TYPE', edge_id: e.id,
          detail: e.relationship_type });
      }
      if (!registry().nodeTypeExists(e.source_type)) {
        issues.push({ kind: 'INVALID_NODE_TYPE', edge_id: e.id,
          detail: 'source ' + e.source_type });
      }
      if (!registry().nodeTypeExists(e.target_type)) {
        issues.push({ kind: 'INVALID_NODE_TYPE', edge_id: e.id,
          detail: 'target ' + e.target_type });
      }
      if (!SCA.store.get(registry().collectionFor(e.source_type) || '',
        e.source_id)) {
        issues.push({ kind: 'ORPHAN_SOURCE', edge_id: e.id,
          detail: e.source_type + ':' + e.source_id });
      }
      if (!SCA.store.get(registry().collectionFor(e.target_type) || '',
        e.target_id)) {
        issues.push({ kind: 'ORPHAN_TARGET', edge_id: e.id,
          detail: e.target_type + ':' + e.target_id });
      }
      if (registry().isSelfReference(e.source_type, e.source_id,
        e.target_type, e.target_id)) {
        issues.push({ kind: 'SELF_REFERENCE', edge_id: e.id, detail: '' });
      }
      if (STATUSES.indexOf(e.status) === -1) {
        issues.push({ kind: 'INVALID_STATUS', edge_id: e.id,
          detail: String(e.status) });
      }
      Object.keys(PROVENANCE_FIELDS).forEach(function (f) {
        (e[f] || []).forEach(function (id) {
          if (!SCA.store.get(PROVENANCE_FIELDS[f], id)) {
            issues.push({ kind: 'BROKEN_PROVENANCE', edge_id: e.id,
              detail: f + ':' + id });
          }
        });
      });
      (e.region_ids || []).forEach(function (id) {
        if (!SCA.store.get('locations', id)) {
          issues.push({ kind: 'BROKEN_REGION', edge_id: e.id,
            detail: 'locations:' + id });
        }
      });
      if (e.supersedes_id && !byId[e.supersedes_id]) {
        issues.push({ kind: 'BROKEN_SUPERSEDES', edge_id: e.id,
          detail: 'supersedes ' + e.supersedes_id });
      }
      if (e.superseded_by_id && !byId[e.superseded_by_id]) {
        issues.push({ kind: 'BROKEN_SUPERSEDES', edge_id: e.id,
          detail: 'superseded by ' + e.superseded_by_id });
      }
      var key = [e.relationship_type, e.source_type, e.source_id,
        e.target_type, e.target_id, e.scope || 'GENERAL'].join('|');
      if (e.status !== 'REJECTED' && e.status !== 'SUPERSEDED') {
        if (seenKeys[key]) {
          issues.push({ kind: 'DUPLICATE_CANONICAL', edge_id: e.id,
            detail: 'duplicates edge ' + seenKeys[key] });
        } else { seenKeys[key] = e.id; }
      }
      /* Lifecycle validity: a REVIEWED state (VERIFIED/REJECTED) must
       * carry a reviewer and reason; DOCUMENTED must carry provenance. */
      if ((e.status === 'VERIFIED' || e.status === 'REJECTED') &&
        !(e.reviewer && e.review_reason)) {
        issues.push({ kind: 'INVALID_LIFECYCLE', edge_id: e.id,
          detail: e.status + ' without reviewer/reason' });
      }
      if (e.status === 'DOCUMENTED' && !hasProvenance(e)) {
        issues.push({ kind: 'INVALID_LIFECYCLE', edge_id: e.id,
          detail: 'DOCUMENTED without provenance' });
      }
    });
    return { ok: issues.length === 0, issues: issues,
      checked: all.length };
  }

  /* ---------- public API ---------- */
  SCA.graph = {
    PROVENANCE_FIELDS: PROVENANCE_FIELDS,
    STATUSES: STATUSES,
    createRelationship: createRelationship,
    markDocumented: markDocumented,
    verify: verify,
    reject: reject,
    updateRelationship: updateRelationship,
    addProvenance: addProvenance,
    supersede: supersede,
    retire: retire,
    edges: edges,
    node: node,
    nodeRecord: nodeRecord,
    outgoing: outgoing,
    incoming: incoming,
    neighbors: neighbors,
    dependencies: dependencies,
    dependents: dependents,
    relationship: relationship,
    path: path,
    subgraph: subgraph,
    cycles: cycles,
    chain: chain,
    neighborhood: neighborhood,
    integrity: integrity,
    hasProvenance: hasProvenance
  };
})(SCA);
