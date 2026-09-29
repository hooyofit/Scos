/*
 * Failure & Recovery System workflow (Stage 9, frozen scope v2.1).
 *
 * ARCHITECTURAL RULES (permanent, frozen Stage 9 scope):
 *  - Exactly ONE new operational entity: RecoveryProfile. Subject
 *    asset types are exactly the Stage 8 five; each profile has
 *    exactly ONE recovery target; recovery kinds are exactly five;
 *    multiple targets require multiple profiles.
 *  - Duplicate signature: subject asset + recovery kind + target
 *    reference. At most one ACTIVE profile per signature.
 *  - Lifecycle: PROPOSED -> DOCUMENTED -> VERIFIED; correction/
 *    terminal states REJECTED and SUPERSEDED. NO RETIRED state:
 *    administrative retirement uses REJECTED with an explicit
 *    reason. Supersession follows the Stage 8.1 proven pattern
 *    (retire-first, validate, commit, byte-exact rollback).
 *  - A RecoveryProfile is NOT a graph node. Nothing here creates
 *    graph edges, and no graph edge creates a RecoveryProfile.
 *    Edge citations are SOFT references: unresolvable citations are
 *    flagged honestly, never block a valid record, never create the
 *    missing edge. Traversal goes through the frozen Stage 7 APIs
 *    (SCA.graph) — there is no second graph engine here.
 *  - Stage 8 remains authoritative for FailureScenario, RepairCapability,
 *    RepairRecord, SparePart, Tool, Material, Workshop, repair
 *    pathways and repair searches. Stage 9 consumes them ONLY
 *    through their existing public interfaces (SCA.repair).
 *  - No resilience, risk, criticality, vulnerability or readiness
 *    scores of any kind. No inference: absence of documentation is
 *    UNKNOWN, never "no impact" or "no coverage".
 *  - No second competency, census, provenance or lost-skill system:
 *    evidence references point at existing Stage 3 / Stage 4 / Stage
 *    5 / Stage 8 records.
 *  - Person privacy: targets are never practitioners (Stage 9 v1);
 *    views reuse the existing Stage 8 person-visibility rules for
 *    anything practitioner-related (counts only for the public).
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['PROPOSED', 'DOCUMENTED', 'VERIFIED', 'REJECTED',
    'SUPERSEDED'];
  var ACTIVE = ['PROPOSED', 'DOCUMENTED', 'VERIFIED'];
  var EDITABLE = ['PROPOSED', 'DOCUMENTED'];
  var KINDS = ['FALLBACK_CAPABILITY', 'REPAIR_NETWORK', 'SUBSTITUTION',
    'FABRICATION', 'EXTERNAL_SUPPORT'];

  /* Subject asset types are EXACTLY the Stage 8 asset set. The set is
   * consumed from SCA.repair's public API (frozen Stage 9 pin: the
   * subject asset space is shared with Stage 8 — no duplicate asset
   * identity system). */
  function assetTypes() { return SCA.repair.ASSET_TYPES; }

  /* Kind -> allowed target types (implementation of the frozen v2.1
   * pin, reported for inspection):
   *   FALLBACK_CAPABILITY -> a capability from the Stage 2 inventory
   *   REPAIR_NETWORK      -> a Stage 8 repair capability
   *   FABRICATION         -> a fabrication-capable Stage 8 repair
   *                          capability, or a Stage 8 workshop
   *   SUBSTITUTION        -> a Stage 8 spare part, material or tool,
   *                          or a capability
   *   EXTERNAL_SUPPORT    -> a Stage 5 organization */
  var TARGET_TYPES = {
    FALLBACK_CAPABILITY: ['CAPABILITY'],
    REPAIR_NETWORK: ['REPAIR_CAPABILITY'],
    FABRICATION: ['REPAIR_CAPABILITY', 'WORKSHOP'],
    SUBSTITUTION: ['SPARE_PART', 'MATERIAL', 'TOOL', 'CAPABILITY'],
    EXTERNAL_SUPPORT: ['ORGANIZATION']
  };
  /* Target type -> canonical collection. These are existing records
   * of existing stages; a RecoveryProfile never creates them. */
  var TARGET_COLLECTIONS = {
    CAPABILITY: 'capabilities',
    REPAIR_CAPABILITY: 'repair_capabilities',
    WORKSHOP: 'workshops',
    SPARE_PART: 'spare_parts',
    MATERIAL: 'materials',
    TOOL: 'tools',
    ORGANIZATION: 'organizations'
  };
  var ALL_TARGET_TYPES = Object.keys(TARGET_COLLECTIONS);

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function now() { return SCA.util.now(); }

  function audited(action, entity, id, user, opts) {
    opts = opts || {};
    return SCA.audit.log(action, Object.assign({
      actor: userName(user),
      entity: entity,
      entity_id: id,
      reason: opts.reason || null
    }, opts));
  }

  function snapshotOf(rec) {
    var keep = ['name', 'asset_type', 'asset_id', 'failure_scenario_id',
      'recovery_kind', 'target_type', 'target_id', 'description',
      'conditions', 'required_resources', 'limitations', 'notes',
      'expected_recovery_time', 'recovery_radius', 'recovery_cost',
      'edge_citations', 'source_ids', 'knowledge_artifact_ids',
      'field_observation_ids', 'status'];
    var snap = {};
    keep.forEach(function (k) { snap[k] = rec[k] || null; });
    return snap;
  }

  function pushHistory(rec, user, reason) {
    rec.history = rec.history || [];
    rec.history.push({
      version: rec.version || 1,
      changed_at: now(),
      changed_by: userName(user),
      reason: reason || null,
      status: rec.status,
      snapshot: snapshotOf(rec)
    });
    rec.version = String((parseInt(rec.version, 10) || 1) + 1);
  }

  function refsExist(coll, ids, field) {
    var missing = [];
    (ids || []).forEach(function (rid) {
      if (!SCA.store.get(coll, rid)) { missing.push(rid); }
    });
    return missing.length ?
      { field: field, message: 'Missing ' + coll + ' records: ' +
        missing.join(', ') } : null;
  }

  function hasProvenance(rec) {
    return !!((rec.source_ids && rec.source_ids.length) ||
      (rec.knowledge_artifact_ids && rec.knowledge_artifact_ids.length) ||
      (rec.field_observation_ids && rec.field_observation_ids.length));
  }

  /* The duplicate signature (frozen): subject asset + recovery kind +
   * target reference. Target reference is target type + target id. */
  function signature(rec) {
    return [rec.asset_type, rec.asset_id, rec.recovery_kind,
      rec.target_type, rec.target_id].join('|');
  }

  /* ---------- subject & target resolution ---------- */

  function subjectError(rec) {
    if (assetTypes().indexOf(rec.asset_type) === -1) {
      return 'Subject asset type must be one of: ' +
        assetTypes().join(', ') + '.';
    }
    var coll = SCA.repair.assetCollection(rec.asset_type);
    if (!coll || !SCA.store.get(coll, rec.asset_id)) {
      return 'Unknown ' + rec.asset_type + ': ' + rec.asset_id + '.';
    }
    return null;
  }

  function targetError(rec) {
    var allowed = TARGET_TYPES[rec.recovery_kind];
    if (!allowed) { return 'Unknown recovery kind.'; }
    if (allowed.indexOf(rec.target_type) === -1) {
      return 'A ' + rec.recovery_kind + ' profile must target one of: ' +
        allowed.join(', ') + ' (given: ' + rec.target_type + ').';
    }
    var coll = TARGET_COLLECTIONS[rec.target_type];
    var t = SCA.store.get(coll, rec.target_id);
    if (!t) { return 'Unknown ' + coll + ' record: ' + rec.target_id + '.'; }
    /* FABRICATION targets a repair capability only when that
     * capability is documented as FABRICATION-capable (Principle:
     * possession of one operation never implies another). */
    if (rec.recovery_kind === 'FABRICATION' &&
        rec.target_type === 'REPAIR_CAPABILITY') {
      var ops = t.repair_operations || [];
      if (ops.indexOf('FABRICATION') === -1) {
        return 'A FABRICATION profile must target a repair capability ' +
          'whose documented operations include FABRICATION.';
      }
    }
    return null;
  }

  /* ---------- validation ---------- */

  function validateRecoveryProfile(rec) {
    var errors = {};
    if (SCA.enums.codes(SCA.enums.recovery_kinds)
      .indexOf(rec.recovery_kind) === -1) {
      errors.recovery_kind = 'Use one of: ' + KINDS.join(', ') + '.';
    }
    if (ALL_TARGET_TYPES.indexOf(rec.target_type) === -1) {
      errors.target_type = 'Use one of: ' + ALL_TARGET_TYPES.join(', ') + '.';
    }
    if (STATUSES.indexOf(rec.status) === -1) {
      errors.status = 'Unknown status.';
    }
    var serr = subjectError(rec);
    if (serr) { errors.asset_id = serr; }
    var terr = rec.recovery_kind && rec.target_type ?
      targetError(rec) : null;
    if (terr) { errors.target_id = terr; }
    if (rec.failure_scenario_id &&
      !SCA.store.get('failure_scenarios', rec.failure_scenario_id)) {
      errors.failure_scenario_id = 'Unknown failure scenario.';
    }
    ['source_ids:evidence', 'knowledge_artifact_ids:knowledge',
      'field_observation_ids:observations'].forEach(function (pair) {
      var parts = pair.split(':');
      var err = refsExist(parts[1], rec[parts[0]], parts[0]);
      if (err) { errors[err.field] = err.message; }
    });
    /* Edge citations are SOFT by frozen rule: an unknown edge id is
     * not an error — it is kept and flagged honestly by the integrity
     * check, and it never blocks a valid profile. */
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- lifecycle ---------- */

  function createRecoveryProfile(user, data) {
    if (!can(user, 'recovery.create')) { return deny('recovery.create'); }
    data = data || {};
    var rec = Object.assign({
      id: null,
      name: data.name,
      asset_type: data.asset_type,
      asset_id: data.asset_id,
      failure_scenario_id: data.failure_scenario_id || null,
      recovery_kind: data.recovery_kind,
      target_type: data.target_type,
      target_id: data.target_id,
      description: data.description || '',
      conditions: data.conditions || '',
      required_resources: data.required_resources || [],
      limitations: data.limitations || '',
      notes: data.notes || '',
      expected_recovery_time: data.expected_recovery_time || '',
      recovery_radius: data.recovery_radius || '',
      recovery_cost: data.recovery_cost || '',
      edge_citations: data.edge_citations || [],
      source_ids: data.source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      field_observation_ids: data.field_observation_ids || [],
      status: 'PROPOSED',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      supersedes_id: data.supersedes_id || null,
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.recovery_profile.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateRecoveryProfile(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    /* Duplicate-signature guard (frozen): at most one ACTIVE profile
     * per subject + kind + target signature. */
    var sig = signature(rec);
    var dup = SCA.store.all('recovery_profiles').filter(function (r) {
      return ACTIVE.indexOf(r.status) !== -1 && signature(r) === sig;
    });
    if (dup.length) {
      return { ok: false, errors: {
        duplicate: 'An active RecoveryProfile already exists for this ' +
          'subject + recovery kind + target (id ' + dup[0].id + '). ' +
          'Correct it through supersession instead.'
      } };
    }
    var res = SCA.store.insert('recovery_profiles', rec);
    if (res.ok) {
      audited('recovery.profile_created', 'recovery_profiles',
        res.record.id, user, { reason: sig });
    }
    return res;
  }

  function updateRecoveryProfile(user, id, patch) {
    if (!can(user, 'recovery.update')) { return deny('recovery.update'); }
    var r = SCA.store.get('recovery_profiles', id);
    if (!r) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    if (EDITABLE.indexOf(r.status) === -1) {
      return { ok: false, errors: {
        status: 'This profile is ' + r.status + ': verified or retired ' +
          'records are corrected through supersession, not in-place edits.'
      } };
    }
    patch = patch || {};
    var immutable = ['id', 'created_at', 'status', 'reviewer',
      'reviewed_at', 'review_reason', 'supersedes_id', 'history',
      'version'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.recovery_profile.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateRecoveryProfile(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    /* Signature change would need the duplicate guard. */
    var dup = SCA.store.all('recovery_profiles').filter(function (o) {
      return o.id !== id && ACTIVE.indexOf(o.status) !== -1 &&
        signature(o) === signature(next);
    });
    if (dup.length) {
      return { ok: false, errors: {
        duplicate: 'An active RecoveryProfile already exists for this ' +
          'subject + recovery kind + target (id ' + dup[0].id + ').'
      } };
    }
    pushHistory(r, user, 'Content edited.');
    next.updated_at = now();
    var res = SCA.store.update('recovery_profiles', id, next);
    if (res.ok) {
      audited('recovery.profile_updated', 'recovery_profiles', id, user);
    }
    return res;
  }

  function documentRecoveryProfile(user, id) {
    if (!can(user, 'recovery.create') && !can(user, 'recovery.update')) {
      return deny('recovery.create');
    }
    var r = SCA.store.get('recovery_profiles', id);
    if (!r) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    if (r.status !== 'PROPOSED') {
      return { ok: false, errors: {
        status: 'Only a PROPOSED profile can be marked DOCUMENTED ' +
          '(current: ' + r.status + ').'
      } };
    }
    if (!hasProvenance(r)) {
      return { ok: false, errors: {
        source_ids: 'DOCUMENTED requires provenance: attach at least ' +
          'one evidence source, knowledge artifact or field observation.'
      } };
    }
    pushHistory(r, user, 'Profile marked DOCUMENTED.');
    r.status = 'DOCUMENTED';
    r.updated_at = now();
    var res = SCA.store.update('recovery_profiles', id, r);
    if (res.ok) {
      audited('recovery.profile_documented', 'recovery_profiles', id,
        user, { old_value: 'PROPOSED', new_value: 'DOCUMENTED' });
    }
    return res;
  }

  function verifyRecoveryProfile(user, id, reason) {
    if (!can(user, 'recovery.review')) { return deny('recovery.review'); }
    var r = SCA.store.get('recovery_profiles', id);
    if (!r) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    if (r.status !== 'DOCUMENTED') {
      return { ok: false, errors: {
        status: 'Only a DOCUMENTED profile can be verified (current: ' +
          r.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit verification reason is required.'
      } };
    }
    pushHistory(r, user, 'Profile verified.');
    r.status = 'VERIFIED';
    r.reviewer = userName(user);
    r.reviewed_at = now();
    r.review_reason = reason;
    r.updated_at = now();
    var res = SCA.store.update('recovery_profiles', id, r);
    if (res.ok) {
      audited('recovery.profile_verified', 'recovery_profiles', id,
        user, { old_value: 'DOCUMENTED', new_value: 'VERIFIED',
          reason: reason });
    }
    return res;
  }

  /* Rejection doubles as audited administrative retirement (frozen
   * rule: there is NO RETIRED state). An explicit reason is always
   * required, so a retirement is never silent. */
  function rejectRecoveryProfile(user, id, reason) {
    if (!can(user, 'recovery.review')) { return deny('recovery.review'); }
    var r = SCA.store.get('recovery_profiles', id);
    if (!r) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    if (r.status === 'REJECTED' || r.status === 'SUPERSEDED') {
      return { ok: false, errors: {
        status: 'This profile is already retired (' + r.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit rejection / retirement reason is required.'
      } };
    }
    pushHistory(r, user, reason);
    r.status = 'REJECTED';
    r.reviewer = userName(user);
    r.reviewed_at = now();
    r.review_reason = reason;
    r.updated_at = now();
    var res = SCA.store.update('recovery_profiles', id, r);
    if (res.ok) {
      audited('recovery.profile_rejected', 'recovery_profiles', id,
        user, { old_value: 'PROPOSED', new_value: 'REJECTED',
          reason: reason });
    }
    return res;
  }

  /* Supersession: the proven Stage 8.1 pattern — retire first, then
   * create and validate the successor, commit only on success, and
   * restore the original byte-exactly on failure. No orphan or
   * duplicate active record can survive. */
  function supersedeRecoveryProfile(user, id, data, reason) {
    if (!can(user, 'recovery.create')) { return deny('recovery.create'); }
    var old = SCA.store.get('recovery_profiles', id);
    if (!old) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    if (ACTIVE.indexOf(old.status) === -1) {
      return { ok: false, errors: {
        status: 'Only an active profile can be superseded (current: ' +
          old.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit supersession reason is required.'
      } };
    }
    var preRetirement = JSON.parse(JSON.stringify(old));
    pushHistory(old, user, reason);
    old.status = 'SUPERSEDED';
    old.reviewer = userName(user);
    old.reviewed_at = now();
    old.review_reason = reason;
    old.updated_at = now();
    var res2 = SCA.store.update('recovery_profiles', id, old);
    if (!res2.ok) { return res2; }
    var merged = Object.assign({}, preRetirement, data || {});
    delete merged.id;
    merged.status = 'PROPOSED';
    merged.supersedes_id = old.id;
    merged.reviewer = null;
    merged.reviewed_at = null;
    merged.review_reason = null;
    merged.version = '1';
    merged.history = [];
    var res = createRecoveryProfile(user, merged);
    if (!res.ok) {
      /* Byte-exact rollback: the original keeps its exact
       * pre-supersession state (status, version, history). */
      SCA.store.update('recovery_profiles', id, preRetirement);
      audited('recovery.profile_supersede_rolled_back',
        'recovery_profiles', id, user, { reason: reason });
      return res;
    }
    audited('recovery.profile_superseded', 'recovery_profiles', id,
      user, { old_value: preRetirement.status, new_value: 'SUPERSEDED',
        reason: reason });
    return { ok: true, record: res.record, superseded: old };
  }

  /* ---------- retrieval ---------- */

  function getRecoveryProfile(user, id) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    var r = SCA.store.get('recovery_profiles', id);
    if (!r) { return { ok: false, errors: { id: 'Profile not found.' } }; }
    /* Anonymous users see only reviewed records (DOCUMENTED/VERIFIED),
     * matching the Stage 7/8 public-status conventions; signed-in
     * staff see the working set. */
    var isAnon = !(user && user.role);
    if (isAnon && r.status !== 'DOCUMENTED' && r.status !== 'VERIFIED') {
      return { ok: false, errors: { permission: 'recovery.read required.' } };
    }
    return { ok: true, record: r };
  }

  function searchRecoveryProfiles(user, filters) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    filters = filters || {};
    var isAnon = !(user && user.role);
    var visible = isAnon ? ['DOCUMENTED', 'VERIFIED'] : STATUSES;
    var out = SCA.store.all('recovery_profiles').filter(function (r) {
      if (visible.indexOf(r.status) === -1) { return false; }
      if (filters.asset_type && r.asset_type !== filters.asset_type) { return false; }
      if (filters.asset_id && r.asset_id !== filters.asset_id) { return false; }
      if (filters.recovery_kind &&
        r.recovery_kind !== filters.recovery_kind) { return false; }
      if (filters.status && r.status !== filters.status) { return false; }
      if (filters.query) {
        var q = String(filters.query).toLowerCase();
        var hay = [r.name, r.description, r.notes].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) { return false; }
      }
      return true;
    });
    /* Descriptive listing, never scored: name order only. */
    out.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return { ok: true, results: out };
  }

  /* ---------- derived views (read-time compositions) ---------- */

  /* Which kinds of targets does an active profile for this subject
   * have? Returns descriptive counts, never scores, never "none
   * exist" claims. */
  function activeProfilesFor(user, assetType, assetId) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    var isAnon = !(user && user.role);
    var visible = isAnon ? ['DOCUMENTED', 'VERIFIED'] : ACTIVE;
    return SCA.store.all('recovery_profiles').filter(function (r) {
      return r.asset_type === assetType && r.asset_id === assetId &&
        visible.indexOf(r.status) !== -1;
    });
  }

  function nodeLabel(nodeType, nodeId) {
    var coll = (nodeType === 'PERSON') ? 'practitioners' :
      SCA.graphRegistry.collectionFor(nodeType);
    var rec = coll ? SCA.store.get(coll, nodeId) : null;
    return (rec && (rec.name || rec.title || rec.code)) || nodeId;
  }

  function targetLabel(rec) {
    var coll = TARGET_COLLECTIONS[rec.target_type];
    var t = coll ? SCA.store.get(coll, rec.target_id) : null;
    return (t && (t.name || t.title || t.code)) || rec.target_id;
  }

  /* failureImpact: what is documented about the impact of one asset
   * failing. Traverses the FROZEN Stage 7 dependency structure
   * (SCA.graph.dependents) — there is no second graph engine here.
   * Every affected node carries a BASIS:
   *   DIRECT_DOCUMENTED — a single-hop reviewed (DOCUMENTED/VERIFIED)
   *     dependency edge explicitly documents the dependency;
   *   GRAPH_DERIVED     — derived through the graph (multi-hop, or a
   *     PROPOSED not-yet-reviewed edge): structural, NEVER asserted
   *     as a certain consequence;
   *   UNKNOWN           — no dependency documentation at all (the
   *     honest default, never "no impact").
   * Coverage fields per affected node (fallback / repair / profiles)
   * are documented-or-unknown, never scored, never inferred as
   * "protected" or "unprotected". */
  function failureImpact(user, subject, opts) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    opts = opts || {};
    var maxDepth = Math.min(Math.max(opts.depth || 3, 1), 10);

    var subjectErr = (function () {
      if (assetTypes().indexOf(subject.asset_type) === -1) {
        return 'Subject asset type must be one of: ' +
          assetTypes().join(', ') + '.';
      }
      var coll = SCA.repair.assetCollection(subject.asset_type);
      return (coll && SCA.store.get(coll, subject.asset_id)) ? null :
        ('Unknown ' + subject.asset_type + ': ' + subject.asset_id + '.');
    })();
    if (subjectErr) {
      return { ok: false, errors: { asset_id: subjectErr } };
    }

    var subjectLabel = SCA.repair.assetLabel(subject.asset_type,
      subject.asset_id);

    /* Stage 8 failure scenarios explicitly documented for this asset. */
    var scenarios = SCA.store.all('failure_scenarios').filter(function (s) {
      return s.asset_type === subject.asset_type &&
        (s.asset_ids || []).indexOf(subject.asset_id) !== -1;
    });

    /* Breadth-first traversal of reverse dependency edges through the
     * frozen Stage 7 API. Cycle-safe by the visited set; depth-capped. */
    var affected = {};
    var frontier = [{ type: subject.asset_type, id: subject.asset_id }];
    var depth = 0;
    var seen = {};
    seen[subject.asset_type + '|' + subject.asset_id] = true;
    while (frontier.length && depth < maxDepth) {
      var next = [];
      frontier.forEach(function (node) {
        var steps = [];
        try {
          steps = SCA.graph.dependents(user, node, {});
        } catch (e) { steps = []; }
        steps.forEach(function (step) {
          /* dependents() steps carry the dependent node in .source
           * (the edge points source -> target, and we traversed the
           * incoming edges of the failed node). */
          var t = step.source;
          if (!t || seen[t.type + '|' + t.id]) { return; }
          seen[t.type + '|' + t.id] = true;
          var edge = step.edge || {};
          var basis = (depth === 0 &&
            (edge.status === 'DOCUMENTED' || edge.status === 'VERIFIED')) ?
            'DIRECT_DOCUMENTED' : 'GRAPH_DERIVED';
          var entry = affected[t.type + '|' + t.id] = {
            node_type: t.type,
            node_id: t.id,
            node_label: nodeLabel(t.type, t.id),
            depth: depth + 1,
            basis: basis,
            via_edge: edge.relationship_type || null,
            via_edge_status: edge.status || null,
            fallback_documented: false,
            fallback_unknown: true,
            repair_documented: false,
            repair_unknown: true,
            recovery_profiles: [],
            recovery_profile_count: 0
          };
          next.push(t);
        });
      });
      frontier = next;
      depth++;
    }

    /* Coverage per affected node: what is DOCUMENTED (never inferred). */
    Object.keys(affected).forEach(function (k) {
      var entry = affected[k];
      var node = { type: entry.node_type, id: entry.node_id };

      /* Fallback documentation: an explicit FALLS_BACK_TO edge from
       * the affected node (frozen Stage 7 vocabulary). */
      var fb = [];
      try {
        fb = SCA.graph.outgoing(user, node,
          { relationship_types: ['FALLS_BACK_TO'] });
      } catch (e) { fb = []; }
      if (fb.length) {
        entry.fallback_documented = true;
        entry.fallback_unknown = false;
        entry.fallback_targets = fb.map(function (step) {
          return { node_type: step.target.type,
            node_id: step.target.id,
            node_label: nodeLabel(step.target.type, step.target.id),
            edge_status: step.edge ? step.edge.status : null };
        });
      }

      /* Repair documentation: Stage 8 repair capabilities for the
       * affected asset, through the EXISTING public search API. */
      var repairRes = SCA.repair.searchRepairCapabilities(user, {
        asset_type: entry.node_type, asset_id: entry.node_id
      });
      if (repairRes.ok && repairRes.results.length) {
        entry.repair_documented = true;
        entry.repair_unknown = false;
        entry.repair_capability_count = repairRes.results.length;
      }

      /* Stage 9 recovery profiles for the affected node as subject. */
      var profiles = activeProfilesFor(user, entry.node_type, entry.node_id);
      entry.recovery_profiles = profiles.map(function (p) {
        return { id: p.id, name: p.name, status: p.status,
          recovery_kind: p.recovery_kind,
          target_label: targetLabel(p) };
      });
      entry.recovery_profile_count = profiles.length;
    });

    var affectedList = Object.keys(affected).map(function (k) {
      return affected[k];
    }).sort(function (a, b) {
      return a.depth - b.depth ||
        String(a.node_label).localeCompare(String(b.node_label));
    });

    return {
      ok: true,
      subject: { asset_type: subject.asset_type,
        asset_id: subject.asset_id, label: subjectLabel },
      failure_scenarios: scenarios.map(function (s) {
        return { id: s.id, name: s.name,
          failure_category: s.failure_category, status: s.status };
      }),
      direct_scenario_count: scenarios.length,
      affected: affectedList,
      affected_count: affectedList.length,
      traversal_depth: maxDepth,
      note: 'Affected nodes are derived from the dependency structure ' +
        '(Stage 7) and are NOT asserted as certain consequences. ' +
        'DIRECT_DOCUMENTED means an explicit reviewed dependency edge; ' +
        'GRAPH_DERIVED means structural derivation only; a node with ' +
        'no documentation at all is Unknown, never "unaffected".'
    };
  }

  /* fallbackReadiness: for one capability that other things may fall
   * back TO, what is documented about it — living status, evidence,
   * reproduction (Stage 5), practitioners (masked per the existing
   * rules), repair and fallback coverage. Descriptive only; no score;
   * every missing field is Unknown, never zero/false/none. */
  function fallbackReadiness(user, capabilityId) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    var cap = SCA.store.get('capabilities', capabilityId);
    if (!cap) {
      return { ok: false, errors: {
        capability_id: 'Unknown capability: ' + capabilityId + '.'
      } };
    }

    /* Who depends on this capability as a documented fallback? Two
     * sources, both existing and both soft-composed here: Stage 7
     * FALLS_BACK_TO edges targeting it, and Stage 9
     * FALLBACK_CAPABILITY recovery profiles targeting it. */
    var fallbackOf = [];
    try {
      fallbackOf = SCA.graph.incoming(user,
        { type: 'CAPABILITY', id: capabilityId },
        { relationship_types: ['FALLS_BACK_TO'] });
    } catch (e) { fallbackOf = []; }
    var isAnon = !(user && user.role);
    var visible = isAnon ? ['DOCUMENTED', 'VERIFIED'] : ACTIVE;
    var profileFallbackOf = SCA.store.all('recovery_profiles')
      .filter(function (p) {
        return p.recovery_kind === 'FALLBACK_CAPABILITY' &&
          p.target_type === 'CAPABILITY' &&
          p.target_id === capabilityId &&
          visible.indexOf(p.status) !== -1;
      });

    /* Stage 5 reproduction information, through the existing public
     * API. Practitioner identities follow the existing masking rules:
     * the public sees counts only, never names. */
    /* The Stage 5 public reproduction API is already a masked,
     * count-only summary — practitioner NAMES never enter this view
     * for any role, which is stricter than the Stage 8 masking rule
     * and satisfies it by construction. */
    var repro = SCA.training.reproductionProfile(capabilityId);
    var reproSummary;
    if (repro) {
      reproSummary = {
        practitioner_count: repro.practitioner_count || 0,
        verified_practitioner_count:
          repro.verified_practitioner_count || 0,
        trainer_count: repro.trainer_count || 0,
        apprentice_count: repro.apprentice_count || 0,
        active_apprentice_count: repro.active_apprentice_count || 0,
        assessment_count: repro.assessment_count || 0,
        certification_count: repro.certification_count || 0,
        documentation_status: repro.documentation_status || null,
        last_verified: repro.last_verified || null
      };
    } else {
      reproSummary = null;
    }

    /* Repair coverage of the capability itself (Stage 8, existing
     * public API). */
    var repairRes = SCA.repair.searchRepairCapabilities(user, {
      asset_type: 'CAPABILITY', asset_id: capabilityId
    });

    return {
      ok: true,
      capability: {
        id: cap.id, code: cap.code, name: cap.name,
        family_id: cap.family_id,
        living_status: cap.living_status || 'UNKNOWN',
        evidence_level: cap.evidence_level || null
      },
      fallback_of_edges: fallbackOf.map(function (step) {
        return { source_type: 'CAPABILITY',
          source_id: step.edge ? step.edge.source_id : null,
          node_label: step.edge ?
            nodeLabel(step.edge.source_type, step.edge.source_id) : null,
          edge_status: step.edge ? step.edge.status : null };
      }),
      fallback_of_profiles: profileFallbackOf.map(function (p) {
        return { id: p.id, name: p.name, status: p.status,
          subject_label: SCA.repair.assetLabel(p.asset_type, p.asset_id) };
      }),
      reproduction: reproSummary,
      repair_coverage: (repairRes.ok && repairRes.results.length) ?
        { documented: true,
          count: repairRes.results.length } :
        { documented: false, unknown: true },
      note: 'Readiness here is DESCRIPTIVE: what is documented about ' +
        'this fallback capability and its reproduction. Nothing is ' +
        'scored; undocumented areas are Unknown, never "none" or ' +
        '"ready"/"not ready".'
    };
  }

  /* recoveryOverview: one composed view for a subject asset — failure
   * context, impact summary, recovery options grouped by kind, repair
   * coverage, and honest unknowns. Read-time composition; nothing is
   * persisted and no hidden duplicate graph exists. */
  function recoveryOverview(user, subject) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    var subjectErr = (function () {
      if (assetTypes().indexOf(subject.asset_type) === -1) {
        return 'Subject asset type must be one of: ' +
          assetTypes().join(', ') + '.';
      }
      var coll = SCA.repair.assetCollection(subject.asset_type);
      return (coll && SCA.store.get(coll, subject.asset_id)) ? null :
        ('Unknown ' + subject.asset_type + ': ' + subject.asset_id + '.');
    })();
    if (subjectErr) {
      return { ok: false, errors: { asset_id: subjectErr } };
    }

    var profiles = activeProfilesFor(user, subject.asset_type,
      subject.asset_id);
    var byKind = {};
    KINDS.forEach(function (k) { byKind[k] = []; });
    profiles.forEach(function (p) {
      byKind[p.recovery_kind].push({
        id: p.id, name: p.name, status: p.status,
        target_type: p.target_type,
        target_label: targetLabel(p),
        failure_scenario_id: p.failure_scenario_id || null
      });
    });

    var impact = failureImpact(user, { asset_type: subject.asset_type,
      asset_id: subject.asset_id });

    var scenarios = impact.ok ? impact.failure_scenarios : [];
    var repairRes = SCA.repair.searchRepairCapabilities(user, {
      asset_type: subject.asset_type, asset_id: subject.asset_id
    });

    return {
      ok: true,
      subject: { asset_type: subject.asset_type,
        asset_id: subject.asset_id,
        label: SCA.repair.assetLabel(subject.asset_type,
          subject.asset_id) },
      failure_scenarios: scenarios,
      impact: impact.ok ? {
        affected_count: impact.affected_count,
        direct_documented_count: impact.affected.filter(function (a) {
          return a.basis === 'DIRECT_DOCUMENTED';
        }).length,
        graph_derived_count: impact.affected.filter(function (a) {
          return a.basis === 'GRAPH_DERIVED';
        }).length
      } : null,
      recovery_options: byKind,
      recovery_option_total: profiles.length,
      repair_coverage: (repairRes.ok && repairRes.results.length) ?
        { documented: true, count: repairRes.results.length } :
        { documented: false, unknown: true },
      unknowns: [
        'Impact for assets with no dependency documentation is ' +
          'Unknown, never "unaffected".',
        'Recovery options not yet documented are Unknown, never ' +
          '"none exist".',
        'Repair coverage not yet documented is Unknown, never "none".'
      ]
    };
  }

  /* ---------- integrity (honest flags, never silent deletion) ---------- */

  function recoveryIntegrity(user) {
    if (!can(user, 'recovery.read')) { return deny('recovery.read'); }
    var errors = [];
    var warnings = [];
    function err(coll, id, field, message) {
      errors.push(coll + ' ' + id + ' -> ' + field + ': ' + message);
    }
    function warn(coll, id, field, message) {
      warnings.push(coll + ' ' + id + ' -> ' + field + ': ' + message);
    }

    var sigSeen = {};
    var profiles = SCA.store.all('recovery_profiles');
    profiles.forEach(function (r) {
      if (!r) { return; }
      if (STATUSES.indexOf(r.status) === -1) {
        err('recovery_profiles', r.id, 'status',
          'invalid status ' + r.status);
      }
      if (KINDS.indexOf(r.recovery_kind) === -1) {
        err('recovery_profiles', r.id, 'recovery_kind',
          'invalid recovery kind ' + r.recovery_kind);
        return;
      }
      if (assetTypes().indexOf(r.asset_type) === -1) {
        err('recovery_profiles', r.id, 'asset_type',
          'unknown subject asset type ' + r.asset_type);
      } else {
        var coll = SCA.repair.assetCollection(r.asset_type);
        if (!SCA.store.get(coll, r.asset_id)) {
          err('recovery_profiles', r.id, 'asset_id',
            'unresolvable subject ' + coll + ' ' + r.asset_id);
        }
      }
      if (ALL_TARGET_TYPES.indexOf(r.target_type) === -1) {
        err('recovery_profiles', r.id, 'target_type',
          'unknown target type ' + r.target_type);
      } else {
        var tcoll = TARGET_COLLECTIONS[r.target_type];
        if (!SCA.store.get(tcoll, r.target_id)) {
          err('recovery_profiles', r.id, 'target_id',
            'unresolvable target ' + tcoll + ' ' + r.target_id);
        } else if (TARGET_TYPES[r.recovery_kind]
          .indexOf(r.target_type) === -1) {
          err('recovery_profiles', r.id, 'target_type',
            r.recovery_kind + ' may not target ' + r.target_type);
        }
      }
      if (r.failure_scenario_id &&
        !SCA.store.get('failure_scenarios', r.failure_scenario_id)) {
        err('recovery_profiles', r.id, 'failure_scenario_id',
          'unresolvable failure scenario');
      }
      ['source_ids:evidence', 'knowledge_artifact_ids:knowledge',
        'field_observation_ids:observations'].forEach(function (pair) {
        var parts = pair.split(':');
        (r[parts[0]] || []).forEach(function (rid) {
          if (!SCA.store.get(parts[1], rid)) {
            err('recovery_profiles', r.id, parts[0],
              'unresolvable ' + parts[1] + ' ' + rid);
          }
        });
      });
      /* Edge citations are SOFT: flag honestly, never error. */
      (r.edge_citations || []).forEach(function (eid) {
        if (!SCA.store.get('graph_edges', eid)) {
          warn('recovery_profiles', r.id, 'edge_citations',
            'soft citation of missing graph edge ' + eid +
            ' (kept, never blocking, never auto-created)');
        }
      });
      if (r.supersedes_id &&
        !SCA.store.get('recovery_profiles', r.supersedes_id)) {
        warn('recovery_profiles', r.id, 'supersedes_id',
          'references a missing profile (orphan supersession)');
      }
      if (r.status === 'VERIFIED' &&
        (SCA.util.isBlank(r.reviewer) ||
          SCA.util.isBlank(r.review_reason))) {
        err('recovery_profiles', r.id, 'reviewer',
          'VERIFIED profile without reviewer or explicit reason.');
      }
      if (ACTIVE.indexOf(r.status) !== -1) {
        var sig = signature(r);
        if (sigSeen[sig]) {
          err('recovery_profiles', r.id, 'duplicate',
            'duplicate active signature ' + sig +
            ' (also held by ' + sigSeen[sig] + ')');
        } else {
          sigSeen[sig] = r.id;
        }
      }
    });

    return { ok: errors.length === 0, errors: errors,
      warnings: warnings };
  }

  /* ---------- public API ---------- */

  SCA.recovery = {
    /* frozen vocabulary (exported for pages, tests and inspection) */
    STATUSES: STATUSES,
    ACTIVE_STATUSES: ACTIVE,
    KINDS: KINDS,
    TARGET_TYPES: TARGET_TYPES,
    TARGET_COLLECTIONS: TARGET_COLLECTIONS,
    signature: signature,
    /* lifecycle */
    createRecoveryProfile: createRecoveryProfile,
    updateRecoveryProfile: updateRecoveryProfile,
    documentRecoveryProfile: documentRecoveryProfile,
    verifyRecoveryProfile: verifyRecoveryProfile,
    rejectRecoveryProfile: rejectRecoveryProfile,
    supersedeRecoveryProfile: supersedeRecoveryProfile,
    /* retrieval */
    getRecoveryProfile: getRecoveryProfile,
    searchRecoveryProfiles: searchRecoveryProfiles,
    activeProfilesFor: activeProfilesFor,
    /* frozen Stage 9 views (read-time compositions) */
    failureImpact: failureImpact,
    fallbackReadiness: fallbackReadiness,
    recoveryOverview: recoveryOverview,
    /* integrity */
    integrity: recoveryIntegrity,
    targetLabel: targetLabel
  };
})(SCA);
