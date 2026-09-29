/*
 * Repair & Spare-Part Network workflow (Stage 8).
 *
 * The central pathway:
 *   Asset -> Failure -> Diagnosis -> Repair Capability -> Practitioner/
 *   Workshop -> Tools + Materials + Spare Parts -> Repair -> Testing ->
 *   Return to Service -> Knowledge -> Training / Reproduction.
 *
 * ARCHITECTURAL RULES (Stage 8 specification, permanent):
 *  - Repair capability is NOT inferred from job titles, workshop
 *    categories or years of experience (Principles 1, 2, 21).
 *  - Diagnosis, repair, fabrication and testing are independent
 *    operations (Principles 3, 4).
 *  - Availability is not compatibility; similarity never creates
 *    compatibility (Principles 5, 6).
 *  - UNKNOWN means "not yet documented", NEVER "does not exist"
 *    (Principle 7). Missing values are never zero, false or
 *    "unavailable".
 *  - No automatic inference: nothing here generates repair or
 *    compatibility relationships; a repair record never upgrades
 *    capability evidence or competence by itself (Principles 8, 9 and
 *    the Stage 3 / Stage 5 authority separation).
 *  - No second relationship engine: workshop/capability/failure
 *    semantics that belong to the graph are entered through the frozen
 *    Stage 7 graph (SCA.graph). Spare-part compatibility is NOT a
 *    graph relationship; it lives on the SparePart record with its own
 *    evidence lifecycle.
 */
(function (SCA) {
  'use strict';

  var CAP_STATUSES = ['PROPOSED', 'DOCUMENTED', 'VERIFIED', 'REJECTED',
    'SUPERSEDED'];
  var CAP_ACTIVE = ['PROPOSED', 'DOCUMENTED', 'VERIFIED'];
  var CAP_EDITABLE = ['PROPOSED', 'DOCUMENTED'];
  var WS_LIFECYCLE = ['UNDOCUMENTED', 'REPORTED', 'DOCUMENTED', 'VERIFIED',
    'INACTIVE', 'CLOSED'];
  var WS_ACTIVE = ['REPORTED', 'DOCUMENTED', 'VERIFIED'];
  var WS_TERMINAL = ['INACTIVE', 'CLOSED'];
  var COMPAT = ['UNKNOWN', 'REPORTED', 'DOCUMENTED', 'TESTED', 'VERIFIED',
    'REJECTED'];
  var COMPAT_ACTIVE = ['UNKNOWN', 'REPORTED', 'DOCUMENTED', 'TESTED',
    'VERIFIED'];
  var RR_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED',
    'REJECTED', 'ARCHIVED'];
  var RR_ACTIVE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED'];
  var RR_EDITABLE = ['DRAFT'];

  /* Asset types the repair network may reference. These are Stage 7
   * graph node types: the repair network shares the canonical entity
   * space — no duplicate asset records, no second identity system. */
  var ASSET_TYPES = ['CAPABILITY', 'TOOL', 'WORKSHOP', 'ENERGY_SOURCE',
    'LOCATION'];

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function now() { return SCA.util.now(); }

  /* ---------- assets (canonical Stage 7 entity space) ---------- */

  function assetCollection(assetType) {
    if (ASSET_TYPES.indexOf(assetType) === -1) { return null; }
    return SCA.graphRegistry.collectionFor(assetType);
  }

  function assetExists(assetType, assetId) {
    var coll = assetCollection(assetType);
    return !!(coll && assetId && SCA.store.get(coll, assetId));
  }

  function assetLabel(assetType, assetId) {
    var coll = assetCollection(assetType);
    var rec = coll ? SCA.store.get(coll, assetId) : null;
    if (!rec) { return null; }
    return rec.name || rec.title || rec.code || assetId;
  }

  function validateAsset(assetType, assetId, field) {
    if (ASSET_TYPES.indexOf(assetType) === -1) {
      return 'Unknown asset type: ' + assetType + '. Use one of: ' +
        ASSET_TYPES.join(', ') + '.';
    }
    if (!assetExists(assetType, assetId)) {
      return 'Referenced ' + assetType + ' record does not exist (' +
        (field || 'asset_id') + ').';
    }
    return null;
  }

  /* ---------- shared reference validation ---------- */

  function refsExist(coll, ids, field) {
    var missing = [];
    (ids || []).forEach(function (rid) {
      if (!SCA.store.get(coll, rid)) { missing.push(rid); }
    });
    return missing.length ?
      { field: field, message: 'Missing ' + coll + ' records: ' +
        missing.join(', ') } : null;
  }

  function hasProvenanceCap(rec) {
    return !!((rec.evidence_source_ids && rec.evidence_source_ids.length) ||
      (rec.knowledge_artifact_ids && rec.knowledge_artifact_ids.length) ||
      (rec.field_observation_ids && rec.field_observation_ids.length));
  }

  function hasProvenanceWs(rec) {
    return !!((rec.source_ids && rec.source_ids.length) ||
      (rec.knowledge_artifact_ids && rec.knowledge_artifact_ids.length) ||
      (rec.field_observation_ids && rec.field_observation_ids.length));
  }

  /* ---------- versioning / history (mirrors Stage 7) ---------- */

  function snapshotOf(rec) {
    var copy = {};
    Object.keys(rec).forEach(function (k) {
      if (k !== 'history') { copy[k] = rec[k]; }
    });
    return copy;
  }

  function pushHistory(rec, user, reason) {
    rec.history = rec.history || [];
    rec.history.push({
      version: rec.version || 1,
      changed_at: now(),
      changed_by: userName(user),
      reason: reason || null,
      status: rec.status || rec.review_status || rec.compatibility_status,
      snapshot: snapshotOf(rec)
    });
    rec.version = String((parseInt(rec.version, 10) || 1) + 1);
    return rec;
  }

  function audited(action, entity, id, user, opts) {
    opts = opts || {};
    return SCA.audit.log(action, Object.assign({
      actor: userName(user),
      entity: entity,
      entity_id: id,
      reason: opts.reason || null
    }, opts));
  }

  /* ---------- privacy ---------- */

  /* Person visibility mirrors the Stage 7 graph rule: practitioner and
   * apprentice identities are resolvable only by users trusted to
   * create or review repair work — never by anonymous users, and never
   * through pathway or radius queries. */
  function personVisible(user) {
    return can(user, 'repair.create') || can(user, 'repair.review') ||
      can(user, 'repair.admin') || can(user, 'workshop.review');
  }

  function staffVisible(user) {
    return personVisible(user) || can(user, 'workshop.create') ||
      can(user, 'sparepart.create');
  }

  function locationVisible(user, locationId) {
    if (!locationId) { return false; }
    var loc = SCA.store.get('locations', locationId);
    if (!loc) { return false; }
    var lvl = loc.privacy_level;
    if (!lvl || lvl === 'PUBLIC') { return true; }
    return personVisible(user);
  }

  /* Public workshop view: a workshop hidden from the public stays
   * visible to staff; private contacts and protected locations are
   * stripped for users without repair person visibility. */
  function publicWorkshop(user, w) {
    if (!w) { return null; }
    if (w.public_visibility === false && !staffVisible(user)) { return null; }
    var view = JSON.parse(JSON.stringify(w));
    if (!personVisible(user)) {
      view.contact_name = null;
      view.contact_details = null;
      if (view.contact_visibility === 'RESTRICTED') {
        view.contact_visibility = 'RESTRICTED';
      }
      if (!locationVisible(user, w.location_id)) {
        view.location_id = null;
        view.location_restricted = true;
      }
    }
    return view;
  }

  function publicCapability(user, c) {
    if (!c) { return null; }
    var view = JSON.parse(JSON.stringify(c));
    if (!personVisible(user)) {
      view.practitioner_ids = [];
      view.practitioners_restricted = true;
    }
    return view;
  }

  /* Repair records are never public: detailed procedures on dangerous
   * equipment are authenticated-only (repair.records.read), and person
   * references inside them need repair person visibility. */
  function publicRepairRecord(user, r) {
    if (!r) { return null; }
    if (!can(user, 'repair.records.read')) { return null; }
    var view = JSON.parse(JSON.stringify(r));
    if (!personVisible(user)) {
      view.technician_ids = [];
      view.apprentice_ids = [];
      view.persons_restricted = true;
    }
    return view;
  }

  function publicSparePart(user, p) {
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  /* ---------- workshops ---------- */

  function validateWorkshopRefs(data, errors) {
    if (data.location_id && !SCA.store.get('locations', data.location_id)) {
      errors.location_id = 'Referenced location does not exist.';
    }
    if (data.organization_id &&
        !SCA.store.get('organizations', data.organization_id)) {
      errors.organization_id = 'Referenced organization does not exist.';
    }
    var e = refsExist('locations', data.region_ids, 'region_ids');
    if (e) { errors[e.field] = e.message; }
    e = refsExist('practitioners', data.practitioner_ids, 'practitioner_ids');
    if (e) { errors[e.field] = e.message; }
    return errors;
  }

  function createWorkshop(user, data) {
    if (!can(user, 'workshop.create')) { return deny('workshop.create'); }
    data = data || {};
    var rec = {
      name: data.name,
      description: data.description || null,
      notes: data.notes || null,
      organization_id: data.organization_id || null,
      location_id: data.location_id || null,
      region_ids: data.region_ids || [],
      services: data.services || [],
      supported_asset_types: data.supported_asset_types || [],
      supported_models: data.supported_models || [],
      repair_capability_ids: [],
      practitioner_ids: data.practitioner_ids || [],
      tool_ids: data.tool_ids || [],
      material_ids: data.material_ids || [],
      diagnostic_capabilities: null,
      repair_capabilities: null,
      fabrication_capabilities: null,
      testing_capabilities: null,
      apprentice_capacity: data.apprentice_capacity || null,
      operating_status: data.operating_status || 'UNKNOWN',
      availability: data.availability || null,
      /* Existence is a REPORT, never an assumption: a new workshop
       * starts REPORTED. VERIFIED requires a reviewer. */
      status: 'REPORTED',
      verification_reason: null,
      documentation_status: null,
      contact_visibility: data.contact_visibility || 'RESTRICTED',
      public_visibility: (data.public_visibility === true),
      contact_name: data.contact_name || null,
      contact_details: data.contact_details || null,
      source_ids: data.source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      field_observation_ids: data.field_observation_ids || [],
      limitations: data.limitations || null,
      safety_notes: data.safety_notes || null,
      reviewer: null,
      reviewed_at: null,
      version: '1',
      history: []
    };
    var v = SCA.models.workshop.validate(rec);
    var errors = v.valid ? {} : v.errors;
    errors = validateWorkshopRefs(data, errors);
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    var res = SCA.store.insert('workshops', rec);
    if (!res.ok) { return res; }
    audited('repair.workshop_created', 'workshops', res.record.id, user,
      { new_value: rec.status });
    return res;
  }

  /* REPORTED -> DOCUMENTED: provenance required. */
  function documentWorkshop(user, id) {
    if (!can(user, 'workshop.update')) { return deny('workshop.update'); }
    var w = SCA.store.get('workshops', id);
    if (!w) { return { ok: false, errors: { id: 'Workshop not found.' } }; }
    if (w.status !== 'REPORTED') {
      return { ok: false, errors: {
        status: 'Only a REPORTED workshop can be marked DOCUMENTED ' +
          '(current: ' + w.status + ').'
      } };
    }
    if (!hasProvenanceWs(w)) {
      return { ok: false, errors: {
        source_ids: 'Documentation requires provenance: attach at least ' +
          'one evidence source, knowledge artifact or field observation.'
      } };
    }
    pushHistory(w, user, 'Workshop marked DOCUMENTED.');
    w.status = 'DOCUMENTED';
    w.updated_at = now();
    var res = SCA.store.update('workshops', id, w);
    if (res.ok) {
      audited('repair.workshop_documented', 'workshops', id, user,
        { old_value: 'REPORTED', new_value: 'DOCUMENTED' });
    }
    return res;
  }

  /* DOCUMENTED -> VERIFIED: reviewer + explicit reason + provenance. */
  function verifyWorkshop(user, id, reason) {
    if (!can(user, 'workshop.review')) { return deny('workshop.review'); }
    var w = SCA.store.get('workshops', id);
    if (!w) { return { ok: false, errors: { id: 'Workshop not found.' } }; }
    if (w.status !== 'DOCUMENTED') {
      return { ok: false, errors: {
        status: 'Only a DOCUMENTED workshop can be verified (current: ' +
          w.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit verification reason is required.'
      } };
    }
    if (!hasProvenanceWs(w)) {
      return { ok: false, errors: {
        source_ids: 'Verification requires provenance.'
      } };
    }
    pushHistory(w, user, reason);
    w.status = 'VERIFIED';
    w.verification_reason = reason;
    w.reviewer = userName(user);
    w.reviewed_at = now();
    w.updated_at = now();
    var res = SCA.store.update('workshops', id, w);
    if (res.ok) {
      audited('repair.workshop_verified', 'workshops', id, user,
        { old_value: 'DOCUMENTED', new_value: 'VERIFIED', reason: reason });
    }
    return res;
  }

  /* Controlled operating-state changes. CLOSED is terminal;
   * INACTIVE/CLOSED are reachable from any active state; an INACTIVE
   * workshop returns as REPORTED (re-report), never directly VERIFIED. */
  var WS_TRANSITIONS = {
    UNDOCUMENTED: ['REPORTED', 'CLOSED'],
    REPORTED: ['DOCUMENTED', 'INACTIVE', 'CLOSED'],
    DOCUMENTED: ['VERIFIED', 'INACTIVE', 'CLOSED'],
    VERIFIED: ['INACTIVE', 'CLOSED'],
    INACTIVE: ['REPORTED', 'CLOSED'],
    CLOSED: []
  };

  function setWorkshopState(user, id, status) {
    if (!can(user, 'workshop.update')) { return deny('workshop.update'); }
    var w = SCA.store.get('workshops', id);
    if (!w) { return { ok: false, errors: { id: 'Workshop not found.' } }; }
    if (WS_LIFECYCLE.indexOf(status) === -1) {
      return { ok: false, errors: { status: 'Unknown workshop state.' } };
    }
    var allowed = WS_TRANSITIONS[w.status] || [];
    if (allowed.indexOf(status) === -1) {
      return { ok: false, errors: {
        status: 'Invalid transition: ' + w.status + ' -> ' + status +
          '. Allowed: ' + (allowed.join(', ') || 'none (terminal state)') +
          '. Use documentWorkshop/verifyWorkshop for review transitions.'
      } };
    }
    pushHistory(w, user, 'Operating state: ' + status + '.');
    w.status = status;
    w.updated_at = now();
    var res = SCA.store.update('workshops', id, w);
    if (res.ok) {
      audited('repair.workshop_state_changed', 'workshops', id, user,
        { new_value: status });
    }
    return res;
  }

  function updateWorkshop(user, id, patch) {
    if (!can(user, 'workshop.update')) { return deny('workshop.update'); }
    var w = SCA.store.get('workshops', id);
    if (!w) { return { ok: false, errors: { id: 'Workshop not found.' } }; }
    if (w.status === 'CLOSED') {
      return { ok: false, errors: {
        status: 'A CLOSED workshop is history: open a successor record ' +
          'instead of editing a closed one.'
      } };
    }
    patch = patch || {};
    var next = Object.assign({}, w, patch);
    /* Status never moves through content edits. */
    next.status = w.status;
    var v = SCA.models.workshop.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var errors = validateWorkshopRefs(next, {});
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    pushHistory(next, user, 'Workshop details updated.');
    next.updated_at = now();
    return SCA.store.update('workshops', id, next);
  }

  /* ---------- repair capabilities ---------- */

  function capabilityKey(c) {
    /* The key covers ALL FOUR operation kinds (Principles 3 and 4):
       diagnosis, repair, fabrication and testing are independent, so
       two capabilities for the same asset are duplicates only when
       every operation flag and operation list match. */
    return [c.workshop_id, c.asset_type, c.asset_id, c.manufacturer || '',
      c.model || '',
      (c.repair_operations || []).slice().sort().join('+'),
      c.diagnostic_capability === true ? 'D' : '-',
      c.fabrication_capability === true ? 'F' : '-',
      c.testing_capability === true ? 'T' : '-'].join('|');
  }

  function createRepairCapability(user, data) {
    if (!can(user, 'repair.create')) { return deny('repair.create'); }
    data = data || {};
    var rec = {
      workshop_id: data.workshop_id || null,
      practitioner_ids: data.practitioner_ids || [],
      asset_type: data.asset_type,
      asset_id: data.asset_id,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      diagnostic_capability: (data.diagnostic_capability === true),
      repair_operations: data.repair_operations || [],
      fabrication_capability: (data.fabrication_capability === true),
      testing_capability: (data.testing_capability === true),
      competence_status: 'UNKNOWN',
      linked_assessment_id: null,
      linked_certification_id: null,
      supported_conditions: data.supported_conditions || null,
      limitations: data.limitations || null,
      safety_notes: data.safety_notes || null,
      hazard_types: data.hazard_types || [],
      region_ids: data.region_ids || [],
      evidence_source_ids: data.evidence_source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      field_observation_ids: data.field_observation_ids || [],
      status: 'PROPOSED',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      supersedes_id: data.supersedes_id || null,
      version: '1',
      history: []
    };
    var errors = {};
    /* A capability is anchored to a workshop, practitioners, or both. */
    if (!rec.workshop_id && !(rec.practitioner_ids || []).length) {
      errors.workshop_id = 'A repair capability needs a workshop or at ' +
        'least one practitioner to anchor it.';
    }
    if (rec.workshop_id && !SCA.store.get('workshops', rec.workshop_id)) {
      errors.workshop_id = 'Referenced workshop does not exist.';
    }
    var e = refsExist('practitioners', rec.practitioner_ids,
      'practitioner_ids');
    if (e) { errors[e.field] = e.message; }
    e = refsExist('locations', rec.region_ids, 'region_ids');
    if (e) { errors[e.field] = e.message; }
    e = refsExist('evidence', rec.evidence_source_ids, 'evidence_source_ids');
    if (e) { errors[e.field] = e.message; }
    var aerr = validateAsset(rec.asset_type, rec.asset_id, 'asset_id');
    if (aerr) { errors.asset_id = aerr; }
    if (!(rec.diagnostic_capability || rec.fabrication_capability ||
        rec.testing_capability ||
        (rec.repair_operations || []).length)) {
      errors.repair_operations = 'At least one operation kind must be ' +
        'documented (diagnostic, repair, fabrication or testing).';
    }
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    /* Duplicate active capability (same workshop + asset + model +
     * operations): corrections go through supersession, not a second
     * record. */
    var key = capabilityKey(rec);
    var dup = SCA.store.all('repair_capabilities').filter(function (c) {
      return CAP_ACTIVE.indexOf(c.status) !== -1 &&
        capabilityKey(c) === key;
    })[0];
    if (dup) {
      return { ok: false, errors: {
        duplicate: 'An equivalent repair capability already exists (' +
          dup.id + '). To correct it, supersede it instead of creating ' +
          'a duplicate.'
      } };
    }
    var res = SCA.store.insert('repair_capabilities', rec);
    if (!res.ok) { return res; }
    if (rec.workshop_id) { mirrorWorkshopCapabilities(rec.workshop_id); }
    audited('repair.capability_created', 'repair_capabilities',
      res.record.id, user, { new_value: 'PROPOSED' });
    return res;
  }

  /* PROPOSED -> DOCUMENTED: provenance attached. */
  function documentRepairCapability(user, id) {
    if (!can(user, 'repair.create') && !can(user, 'repair.update')) {
      return deny('repair.create');
    }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    if (c.status !== 'PROPOSED') {
      return { ok: false, errors: {
        status: 'Only a PROPOSED capability can be marked DOCUMENTED ' +
          '(current: ' + c.status + ').'
      } };
    }
    if (!hasProvenanceCap(c)) {
      return { ok: false, errors: {
        evidence_source_ids: 'DOCUMENTED requires provenance: attach at ' +
          'least one evidence source, knowledge artifact or field ' +
          'observation.'
      } };
    }
    pushHistory(c, user, 'Capability marked DOCUMENTED.');
    c.status = 'DOCUMENTED';
    c.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, c);
    if (res.ok) {
      audited('repair.capability_documented', 'repair_capabilities', id,
        user, { old_value: 'PROPOSED', new_value: 'DOCUMENTED' });
    }
    return res;
  }

  /* DOCUMENTED -> VERIFIED: reviewer + explicit reason + provenance.
   * Never automatic. */
  function verifyRepairCapability(user, id, reason) {
    if (!can(user, 'repair.review')) { return deny('repair.review'); }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    if (c.status !== 'DOCUMENTED') {
      return { ok: false, errors: {
        status: 'Only a DOCUMENTED capability can be verified ' +
          '(current: ' + c.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit verification reason is required.'
      } };
    }
    if (!hasProvenanceCap(c)) {
      return { ok: false, errors: {
        evidence_source_ids: 'Verification requires provenance.'
      } };
    }
    pushHistory(c, user, reason);
    c.status = 'VERIFIED';
    c.reviewer = userName(user);
    c.reviewed_at = now();
    c.review_reason = reason;
    c.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, c);
    if (res.ok) {
      audited('repair.capability_verified', 'repair_capabilities', id,
        user, { old_value: 'DOCUMENTED', new_value: 'VERIFIED',
          reason: reason });
      if (c.workshop_id) { mirrorWorkshopCapabilities(c.workshop_id); }
    }
    return res;
  }

  function rejectRepairCapability(user, id, reason) {
    if (!can(user, 'repair.review')) { return deny('repair.review'); }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    if (CAP_EDITABLE.indexOf(c.status) === -1) {
      return { ok: false, errors: {
        status: 'Only PROPOSED or DOCUMENTED capabilities can be ' +
          'rejected (current: ' + c.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit rejection reason is required.'
      } };
    }
    pushHistory(c, user, reason);
    c.status = 'REJECTED';
    c.reviewer = userName(user);
    c.reviewed_at = now();
    c.review_reason = reason;
    c.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, c);
    if (res.ok) {
      audited('repair.capability_rejected', 'repair_capabilities', id,
        user, { new_value: 'REJECTED', reason: reason });
      if (c.workshop_id) { mirrorWorkshopCapabilities(c.workshop_id); }
    }
    return res;
  }

  /* Corrections NEVER edit a verified capability in place: a
   * replacement is proposed and the old record superseded (provenance
   * preserved on both). */
  function supersedeRepairCapability(user, id, data, reason) {
    if (!can(user, 'repair.create')) { return deny('repair.create'); }
    var old = SCA.store.get('repair_capabilities', id);
    if (!old) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    if (CAP_EDITABLE.indexOf(old.status) === -1 && old.status !== 'VERIFIED') {
      return { ok: false, errors: {
        status: 'Only an active capability can be superseded ' +
          '(current: ' + old.status + ').'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An explicit supersession reason is required.'
      } };
    }
    /* Order matters (correction to the first build): retire the
     * original FIRST, then create the successor. The previous order
     * (create, then retire) made the duplicate guard reject any
     * successor whose signature was identical to the still-active
     * original — making same-signature corrections (typo fixes, added
     * evidence) unreachable. Retiring first means the successor never
     * collides with a live equivalent; if successor creation then
     * fails, the original is restored from its pre-retirement
     * snapshot, so no partial state survives and the persistent
     * invariant holds: at most ONE active capability per signature. */
    var preRetirement = JSON.parse(JSON.stringify(old));
    pushHistory(old, user, reason);
    old.status = 'SUPERSEDED';
    old.reviewer = userName(user);
    old.reviewed_at = now();
    old.review_reason = reason;
    old.updated_at = now();
    var res2 = SCA.store.update('repair_capabilities', id, old);
    if (!res2.ok) { return res2; }
    var merged = Object.assign({}, preRetirement, data || {});
    merged.workshop_id = merged.workshop_id || null;
    delete merged.id;
    merged.status = 'PROPOSED';
    merged.supersedes_id = old.id;
    merged.competence_status = 'UNKNOWN';
    merged.linked_assessment_id = null;
    merged.linked_certification_id = null;
    merged.reviewer = null;
    merged.reviewed_at = null;
    merged.review_reason = null;
    merged.version = 1;
    merged.history = [];
    var res = createRepairCapability(user, merged);
    if (!res.ok) {
      /* Roll back the retirement: the original keeps its exact
       * pre-supersession state (status, version, history). */
      SCA.store.update('repair_capabilities', id, preRetirement);
      audited('repair.capability_supersede_rolled_back',
        'repair_capabilities', id, user, { reason: reason });
      return res;
    }
    audited('repair.capability_superseded', 'repair_capabilities', id,
      user, { old_value: preRetirement.status, new_value: 'SUPERSEDED',
        reason: reason });
    if (old.workshop_id) { mirrorWorkshopCapabilities(old.workshop_id); }
    return { ok: true, record: res.record, superseded: old };
  }

  /* Content edits only on PROPOSED/DOCUMENTED records. */
  function updateRepairCapability(user, id, patch) {
    if (!can(user, 'repair.update')) { return deny('repair.update'); }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    if (CAP_EDITABLE.indexOf(c.status) === -1) {
      return { ok: false, errors: {
        status: 'This capability is ' + c.status + ': verified or retired ' +
          'records are corrected through supersession, not in-place edits.'
      } };
    }
    patch = patch || {};
    var next = Object.assign({}, c, patch);
    next.status = c.status;
    var v = SCA.models.repair_capability.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    pushHistory(next, user, 'Capability details updated.');
    next.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, next);
    if (res.ok && next.workshop_id) {
      mirrorWorkshopCapabilities(next.workshop_id);
    }
    return res;
  }

  /* Competence linking — Stage 5 owns competence authority. A repair
   * capability may LINK an accepted assessment or an issued
   * certification; it can never declare competence itself, and years
   * of experience never substitute. */
  function linkCompetenceAssessment(user, id, assessmentId) {
    if (!can(user, 'repair.update')) { return deny('repair.update'); }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    var a = SCA.store.get('competence_assessments', assessmentId);
    if (!a) {
      return { ok: false, errors: {
        assessment_id: 'Referenced Stage 5 assessment does not exist.'
      } };
    }
    if (a.review_status !== 'ACCEPTED') {
      return { ok: false, errors: {
        assessment_id: 'Only an ACCEPTED Stage 5 assessment may be ' +
          'linked (current: ' + a.review_status + ').'
      } };
    }
    /* The assessment must actually concern a linked practitioner of
     * this capability. */
    var linked = (c.practitioner_ids || []).indexOf(a.practitioner_id) !== -1;
    if (!linked) {
      return { ok: false, errors: {
        practitioner_ids: 'The assessment concerns a practitioner not ' +
          'linked to this repair capability.'
      } };
    }
    pushHistory(c, user, 'Stage 5 assessment linked.');
    c.competence_status = 'ASSESSED';
    c.linked_assessment_id = assessmentId;
    c.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, c);
    if (res.ok) {
      audited('repair.capability_assessment_linked',
        'repair_capabilities', id, user, { new_value: assessmentId });
    }
    return res;
  }

  function linkCompetenceCertification(user, id, certificationId) {
    if (!can(user, 'repair.update')) { return deny('repair.update'); }
    var c = SCA.store.get('repair_capabilities', id);
    if (!c) { return { ok: false, errors: { id: 'Capability not found.' } }; }
    var cert = SCA.store.get('capability_certifications', certificationId);
    if (!cert) {
      return { ok: false, errors: {
        certification_id: 'Referenced Stage 5 certification does not exist.'
      } };
    }
    if (cert.status !== 'ISSUED') {
      return { ok: false, errors: {
        certification_id: 'Only an ISSUED Stage 5 certification may be ' +
          'linked (current: ' + cert.status + ').'
      } };
    }
    var linked = (c.practitioner_ids || []).indexOf(cert.practitioner_id) !== -1;
    if (!linked) {
      return { ok: false, errors: {
        practitioner_ids: 'The certification concerns a practitioner not ' +
          'linked to this repair capability.'
      } };
    }
    pushHistory(c, user, 'Stage 5 certification linked.');
    c.competence_status = 'VERIFIED';
    c.linked_certification_id = certificationId;
    c.updated_at = now();
    var res = SCA.store.update('repair_capabilities', id, c);
    if (res.ok) {
      audited('repair.capability_certification_linked',
        'repair_capabilities', id, user, { new_value: certificationId });
    }
    return res;
  }

  /* Workshop capability mirrors: honest per-kind counts over ACTIVE
   * capability records. These are views, not independently editable
   * claims; null = "not yet documented". */
  function mirrorWorkshopCapabilities(workshopId) {
    var w = SCA.store.get('workshops', workshopId);
    if (!w) { return; }
    var caps = SCA.store.all('repair_capabilities').filter(function (c) {
      return c.workshop_id === workshopId &&
        CAP_ACTIVE.indexOf(c.status) !== -1;
    });
    function countFor(kind) {
      var n = caps.filter(function (c) {
        return kind === 'DIAGNOSTIC' ? c.diagnostic_capability === true :
          kind === 'FABRICATION' ? c.fabrication_capability === true :
          kind === 'TESTING' ? c.testing_capability === true :
          (c.repair_operations || []).length > 0;
      }).length;
      return n ? String(n) : null;
    }
    w.diagnostic_capabilities = countFor('DIAGNOSTIC');
    w.repair_capabilities = countFor('REPAIR');
    w.fabrication_capabilities = countFor('FABRICATION');
    w.testing_capabilities = countFor('TESTING');
    w.repair_capability_ids = caps.map(function (c) { return c.id; });
    w.updated_at = now();
    SCA.store.update('workshops', workshopId, w);
  }

  /* ---------- spare parts ---------- */

  /* Duplicate rule: same manufacturer + manufacturer part number = the
   * same canonical part. Conservative — never silently merges
   * name-similar parts. */
  function findSparePartDuplicate(rec) {
    if (SCA.util.isBlank(rec.manufacturer) ||
        SCA.util.isBlank(rec.manufacturer_part_number)) { return null; }
    return SCA.store.all('spare_parts').filter(function (p) {
      return p.manufacturer === rec.manufacturer &&
        p.manufacturer_part_number === rec.manufacturer_part_number;
    })[0] || null;
  }

  function validateSparePartRefs(data, errors) {
    if (data.asset_type) {
      var aerr = validateAsset(data.asset_type, null, 'asset_type');
      if (aerr && ASSET_TYPES.indexOf(data.asset_type) === -1) {
        errors.asset_type = aerr;
      }
    }
    if (data.asset_type && (data.asset_ids || []).length) {
      (data.asset_ids || []).forEach(function (aid) {
        if (!assetExists(data.asset_type, aid)) {
          errors.asset_ids = 'Referenced ' + data.asset_type +
            ' record does not exist: ' + aid;
        }
      });
    }
    var checks = [
      ['organizations', data.supplier_ids, 'supplier_ids'],
      ['spare_parts', data.alternative_part_ids, 'alternative_part_ids'],
      ['materials', data.substitute_material_ids,
        'substitute_material_ids'],
      ['knowledge', data.drawing_artifact_ids, 'drawing_artifact_ids'],
      ['workshops', data.compatible_workshop_ids,
        'compatible_workshop_ids'],
      ['locations', data.stock_locations, 'stock_locations'],
      ['evidence', data.source_ids, 'source_ids'],
      ['knowledge', data.knowledge_artifact_ids,
        'knowledge_artifact_ids']
    ];
    checks.forEach(function (ch) {
      var e = refsExist(ch[0], ch[1], ch[2]);
      if (e && !errors[e.field]) { errors[e.field] = e.message; }
    });
    return errors;
  }

  function createSparePart(user, data) {
    if (!can(user, 'sparepart.create')) { return deny('sparepart.create'); }
    data = data || {};
    var rec = {
      name: data.name,
      part_number: data.part_number || null,
      manufacturer: data.manufacturer || null,
      manufacturer_part_number: data.manufacturer_part_number || null,
      asset_type: data.asset_type || null,
      asset_ids: data.asset_ids || [],
      models: data.models || [],
      function: data['function'] || null,
      specification: data.specification || null,
      required_quantity: data.required_quantity || null,
      local_stock: data.local_stock || null,
      regional_stock: data.regional_stock || null,
      stock_locations: data.stock_locations || [],
      supplier_ids: data.supplier_ids || [],
      import_sources: data.import_sources || null,
      alternative_part_ids: data.alternative_part_ids || [],
      substitute_material_ids: data.substitute_material_ids || [],
      substitution_notes: data.substitution_notes || null,
      fabrication_possible: data.fabrication_possible || 'UNKNOWN',
      fabrication_specification: data.fabrication_specification || null,
      drawing_artifact_ids: data.drawing_artifact_ids || [],
      tooling_requirements: data.tooling_requirements || null,
      compatible_workshop_ids: data.compatible_workshop_ids || [],
      cost: data.cost || null,
      lead_time: data.lead_time || null,
      /* Availability is not compatibility (Principles 5-7): both
       * default to UNKNOWN, never zero / false / "unavailable". */
      availability_status: data.availability_status || 'UNKNOWN',
      compatibility_status: 'UNKNOWN',
      compatibility_notes: null,
      last_verified: null,
      status: 'DOCUMENTED_EXISTENCE',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      source_ids: data.source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      limitations: data.limitations || null,
      safety_notes: data.safety_notes || null,
      hazard_types: data.hazard_types || [],
      version: '1',
      history: []
    };
    var v = SCA.models.spare_part.validate(rec);
    var errors = v.valid ? {} : v.errors;
    errors = validateSparePartRefs(data, errors);
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    var dup = findSparePartDuplicate(rec);
    if (dup) {
      return { ok: false, errors: {
        duplicate: 'This manufacturer part number already exists (' +
          dup.id + ', "' + dup.name + '"). Same part must not be ' +
          'documented twice.'
      } };
    }
    var res = SCA.store.insert('spare_parts', rec);
    if (!res.ok) { return res; }
    audited('repair.spare_part_created', 'spare_parts', res.record.id,
      user, { new_value: 'UNKNOWN compatibility' });
    return res;
  }

  /* Compatibility lifecycle. Evidence-backed, reviewer-gated, never
   * inferred from similarity. REJECTED documents a KNOWN
   * incompatibility (a finding, not "no data"). */
  var COMPAT_TRANSITIONS = {
    UNKNOWN: ['REPORTED', 'REJECTED'],
    REPORTED: ['DOCUMENTED', 'REJECTED'],
    DOCUMENTED: ['TESTED', 'REJECTED'],
    TESTED: ['VERIFIED', 'REJECTED'],
    VERIFIED: ['REJECTED'],
    REJECTED: []
  };

  function transitionCompatibility(user, id, target, opts) {
    opts = opts || {};
    var p = SCA.store.get('spare_parts', id);
    if (!p) { return { ok: false, errors: { id: 'Spare part not found.' } }; }
    /* Permission first: an unauthorized user is denied even when the
     * transition would also be invalid — review authority is the
     * sharper refusal. */
    if (target === 'VERIFIED' || target === 'REJECTED') {
      if (!can(user, 'sparepart.review')) { return deny('sparepart.review'); }
      if (SCA.util.isBlank(opts.reason)) {
        return { ok: false, errors: {
          reason: 'An explicit reason is required for ' + target + '.'
        } };
      }
    } else if (!can(user, 'sparepart.update') &&
        !can(user, 'sparepart.create')) {
      return deny('sparepart.update');
    }
    var from = p.compatibility_status;
    var allowed = COMPAT_TRANSITIONS[from] || [];
    if (allowed.indexOf(target) === -1) {
      return { ok: false, errors: {
        compatibility_status: 'Invalid transition: ' + from + ' -> ' +
          target + '. Allowed: ' + (allowed.join(', ') || 'none') + '.'
      } };
    }
    if (target === 'DOCUMENTED' &&
        !((p.source_ids || []).length ||
          (p.knowledge_artifact_ids || []).length)) {
      return { ok: false, errors: {
        source_ids: 'DOCUMENTED compatibility requires specification ' +
          'evidence (evidence source or knowledge artifact).'
      } };
    }
    if (target === 'TESTED' && SCA.util.isBlank(opts.notes)) {
      return { ok: false, errors: {
        notes: 'TESTED requires the fitment test result as notes.'
      } };
    }
    pushHistory(p, user, opts.reason || ('Compatibility: ' + target));
    p.compatibility_status = target;
    if (opts.notes) { p.compatibility_notes = opts.notes; }
    if (target === 'VERIFIED' || target === 'REJECTED') {
      p.reviewer = userName(user);
      p.reviewed_at = now();
      p.review_reason = opts.reason;
      p.last_verified = now();
    }
    p.updated_at = now();
    var res = SCA.store.update('spare_parts', id, p);
    if (res.ok) {
      audited('repair.compatibility_' + target.toLowerCase(), 'spare_parts',
        id, user, { old_value: from, new_value: target,
          reason: opts.reason || null });
    }
    return res;
  }

  function updateSparePart(user, id, patch) {
    if (!can(user, 'sparepart.update')) { return deny('sparepart.update'); }
    var p = SCA.store.get('spare_parts', id);
    if (!p) { return { ok: false, errors: { id: 'Spare part not found.' } }; }
    if (p.compatibility_status === 'REJECTED') {
      return { ok: false, errors: {
        status: 'A REJECTED compatibility record is history: open a ' +
          'successor part record instead.'
      } };
    }
    patch = patch || {};
    var next = Object.assign({}, p, patch);
    /* Compatibility never moves through content edits. */
    next.compatibility_status = p.compatibility_status;
    var v = SCA.models.spare_part.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var errors = validateSparePartRefs(next, {});
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    pushHistory(next, user, 'Spare part details updated.');
    next.updated_at = now();
    return SCA.store.update('spare_parts', id, next);
  }

  /* ---------- repair records ---------- */

  function validateRepairRecordRefs(data, errors) {
    var aerr = validateAsset(data.asset_type, data.asset_id, 'asset_id');
    if (aerr) { errors.asset_id = aerr; }
    if (data.location_id && !SCA.store.get('locations', data.location_id)) {
      errors.location_id = 'Referenced location does not exist.';
    }
    if (data.region_id && !SCA.store.get('locations', data.region_id)) {
      errors.region_id = 'Referenced region does not exist.';
    }
    if (data.failure_scenario_id &&
        !SCA.store.get('failure_scenarios', data.failure_scenario_id)) {
      errors.failure_scenario_id =
        'Referenced failure scenario does not exist.';
    }
    if (data.workshop_id &&
        !SCA.store.get('workshops', data.workshop_id)) {
      errors.workshop_id = 'Referenced workshop does not exist.';
    }
    if (data.knowledge_artifact_id &&
        !SCA.store.get('knowledge', data.knowledge_artifact_id)) {
      errors.knowledge_artifact_id =
        'Referenced knowledge artifact does not exist.';
    }
    var checks = [
      ['practitioners', data.technician_ids, 'technician_ids'],
      ['apprentices', data.apprentice_ids, 'apprentice_ids'],
      ['tools', data.tools_used, 'tools_used'],
      ['materials', data.materials_used, 'materials_used'],
      ['spare_parts', data.parts_used, 'parts_used'],
      ['spare_parts', data.substitutes_used, 'substitutes_used'],
      ['evidence', data.source_ids, 'source_ids']
    ];
    checks.forEach(function (ch) {
      var e = refsExist(ch[0], ch[1], ch[2]);
      if (e && !errors[e.field]) { errors[e.field] = e.message; }
    });
    return errors;
  }

  function createRepairRecord(user, data) {
    if (!can(user, 'repair.create')) { return deny('repair.create'); }
    data = data || {};
    var rec = {
      asset_type: data.asset_type,
      asset_id: data.asset_id,
      location_id: data.location_id || null,
      region_id: data.region_id || null,
      date: data.date,
      failure_type: data.failure_type || 'UNKNOWN',
      failure_category_notes: data.failure_category_notes || null,
      failure_scenario_id: data.failure_scenario_id || null,
      symptoms: data.symptoms || null,
      diagnosis: data.diagnosis || null,
      root_cause: data.root_cause || null,
      repair_action: data.repair_action || null,
      technician_ids: data.technician_ids || [],
      workshop_id: data.workshop_id || null,
      tools_used: data.tools_used || [],
      materials_used: data.materials_used || [],
      parts_used: data.parts_used || [],
      substitutes_used: data.substitutes_used || [],
      substitute_notes: data.substitute_notes || null,
      repair_time: data.repair_time || null,
      downtime: data.downtime || null,
      repair_cost: data.repair_cost || null,
      external_dependency: data.external_dependency || null,
      local_substitute: (data.local_substitute === true),
      fabrication_used: (data.fabrication_used === true),
      test_result: data.test_result || null,
      return_to_service: (data.return_to_service === true),
      lesson: data.lesson || null,
      knowledge_artifact_id: data.knowledge_artifact_id || null,
      apprentice_ids: data.apprentice_ids || [],
      apprentice_participation_notes:
        data.apprentice_participation_notes || null,
      safety_notes: data.safety_notes || null,
      hazard_types: data.hazard_types || [],
      ppe_requirements: data.ppe_requirements || null,
      qualification_requirements: data.qualification_requirements || null,
      source_ids: data.source_ids || [],
      review_status: 'DRAFT',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      version: '1',
      history: []
    };
    var v = SCA.models.repair_record.validate(rec);
    var errors = v.valid ? {} : v.errors;
    errors = validateRepairRecordRefs(data, errors);
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    var res = SCA.store.insert('repair_records', rec);
    if (!res.ok) { return res; }
    audited('repair.record_created', 'repair_records', res.record.id, user,
      { new_value: 'DRAFT' });
    return res;
  }

  var RR_TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
    UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['ARCHIVED'],
    REJECTED: ['ARCHIVED'],
    ARCHIVED: []
  };

  function transitionRepairRecord(user, id, target, reason) {
    var r = SCA.store.get('repair_records', id);
    if (!r) { return { ok: false, errors: { id: 'Repair record not found.' } }; }
    /* Permission first (mirrors the compatibility rule): an
     * unauthorized user is refused before transition analysis —
     * reviewer authority is the sharper refusal. Entry staff can
     * submit, never review. */
    if (target === 'SUBMITTED') {
      if (!can(user, 'repair.update') && !can(user, 'repair.create')) {
        return deny('repair.update');
      }
    } else if (target === 'UNDER_REVIEW' || target === 'ACCEPTED' ||
        target === 'REJECTED') {
      if (!can(user, 'repair.review')) { return deny('repair.review'); }
      if ((target === 'ACCEPTED' || target === 'REJECTED') &&
          SCA.util.isBlank(reason)) {
        return { ok: false, errors: {
          reason: 'An explicit ' + target.toLowerCase() + ' reason is ' +
            'required.'
        } };
      }
    } else if (target === 'ARCHIVED') {
      if (!can(user, 'repair.update') && !can(user, 'repair.review')) {
        return deny('repair.update');
      }
    }
    var from = r.review_status;
    var allowed = RR_TRANSITIONS[from] || [];
    if (allowed.indexOf(target) === -1) {
      return { ok: false, errors: {
        review_status: 'Invalid transition: ' + from + ' -> ' + target +
          '. Allowed: ' + (allowed.join(', ') || 'none') + '.'
      } };
    }
    pushHistory(r, user, reason || ('Review: ' + target));
    r.review_status = target;
    if (target === 'ACCEPTED' || target === 'REJECTED') {
      r.reviewer = userName(user);
      r.reviewed_at = now();
      r.review_reason = reason;
    }
    r.updated_at = now();
    var res = SCA.store.update('repair_records', id, r);
    if (res.ok) {
      audited('repair.record_' + target.toLowerCase(), 'repair_records', id,
        user, { old_value: from, new_value: target, reason: reason || null });
    }
    return res;
  }

  /* Content edits only while DRAFT. */
  function updateRepairRecord(user, id, patch) {
    if (!can(user, 'repair.update')) { return deny('repair.update'); }
    var r = SCA.store.get('repair_records', id);
    if (!r) { return { ok: false, errors: { id: 'Repair record not found.' } }; }
    if (RR_EDITABLE.indexOf(r.review_status) === -1) {
      return { ok: false, errors: {
        review_status: 'Only a DRAFT record is editable (current: ' +
          r.review_status + '). Submitted history is corrected through ' +
          'the review workflow, never rewritten.'
      } };
    }
    patch = patch || {};
    var next = Object.assign({}, r, patch);
    next.review_status = r.review_status;
    var v = SCA.models.repair_record.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var errors = validateRepairRecordRefs(next, {});
    if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
    pushHistory(next, user, 'Draft updated.');
    next.updated_at = now();
    return SCA.store.update('repair_records', id, next);
  }

  /* Explicit lesson capture: a reviewer creates a Knowledge Artifact
   * through the Stage 3 workflow and links it here. The repair record
   * itself never upgrades capability evidence automatically. */
  function recordLesson(user, id, artifactData) {
    if (!can(user, 'repair.review')) { return deny('repair.review'); }
    var r = SCA.store.get('repair_records', id);
    if (!r) { return { ok: false, errors: { id: 'Repair record not found.' } }; }
    if (r.review_status !== 'ACCEPTED') {
      return { ok: false, errors: {
        review_status: 'Lessons are captured on ACCEPTED records only ' +
          '(current: ' + r.review_status + ').'
      } };
    }
    artifactData = artifactData || {};
    artifactData.provenance = artifactData.provenance ||
      ('Derived from accepted repair record ' + r.id + ' (Stage 8 ' +
        'failure learning loop).');
    var res = SCA.evidence.createArtifact(user, artifactData);
    if (!res.ok) { return res; }
    pushHistory(r, user, 'Lesson captured as knowledge artifact.');
    r.knowledge_artifact_id = res.record.id;
    r.updated_at = now();
    var res2 = SCA.store.update('repair_records', id, r);
    if (res2.ok) {
      audited('repair.lesson_recorded', 'repair_records', id, user,
        { new_value: res.record.id });
    }
    return { ok: true, record: res2.record, artifact: res.record };
  }

  /* ---------- pathway inspection (deterministic, UNKNOWN-honest) ----------
   *
   * Every step reports DOCUMENTED or UNKNOWN. A missing link is never
   * filled with an assumption, and the whole report is scoped:
   * "documented in the current dataset" never means "the only
   * possibility that exists". */

  function scopedNote() {
    return 'Within the currently documented dataset. Undocumented ' +
      'pathways are not asserted not to exist.';
  }

  function activeCapabilitiesFor(assetType, assetId) {
    return SCA.store.all('repair_capabilities').filter(function (c) {
      return CAP_ACTIVE.indexOf(c.status) !== -1 &&
        c.asset_type === assetType && c.asset_id === assetId;
    });
  }

  function scenariosFor(assetType, assetId) {
    return SCA.store.all('failure_scenarios').filter(function (s) {
      return s.asset_type === assetType &&
        (s.asset_ids || []).indexOf(assetId) !== -1;
    });
  }

  function recordsFor(assetType, assetId) {
    return SCA.store.all('repair_records').filter(function (r) {
      return r.asset_type === assetType && r.asset_id === assetId;
    });
  }

  function partsFor(assetType, assetId) {
    return SCA.store.all('spare_parts').filter(function (p) {
      return p.asset_type === assetType &&
        (p.asset_ids || []).indexOf(assetId) !== -1;
    });
  }

  function step(name, status, detail) {
    return { step: name, status: status, detail: detail || null };
  }

  function repairPathway(user, query) {
    query = query || {};
    var at = query.asset_type;
    var aid = query.asset_id;
    var aerr = validateAsset(at, aid, 'asset_id');
    if (aerr) { return { ok: false, errors: { asset_id: aerr } }; }
    var asset = { type: at, id: aid, label: assetLabel(at, aid) };

    var scenarios = query.failure_scenario_id ?
      [SCA.store.get('failure_scenarios',
        query.failure_scenario_id)].filter(Boolean) :
      scenariosFor(at, aid);
    var caps = activeCapabilitiesFor(at, aid);
    var records = recordsFor(at, aid);
    var accepted = records.filter(function (r) {
      return r.review_status === 'ACCEPTED' || r.review_status === 'ARCHIVED';
    });
    var scenario = scenarios[0] || null;

    var steps = [];

    /* 1. Failure */
    if (scenario) {
      steps.push(step('failure', 'DOCUMENTED', {
        failure_scenario_id: scenario.id,
        name: scenario.name,
        category: scenario.failure_category,
        symptoms: scenario.symptoms || null
      }));
    } else {
      steps.push(step('failure', 'UNKNOWN', null));
    }

    /* 2. Diagnosis */
    var diagSources = [];
    if (scenario && (scenario.diagnostic_methods || []).length) {
      diagSources.push('failure scenario: ' + scenario.name);
    }
    var diagnosed = accepted.filter(function (r) {
      return !SCA.util.isBlank(r.diagnosis);
    });
    if (diagnosed.length) {
      diagSources.push(diagnosed.length + ' accepted repair record(s)');
    }
    var diagCaps = caps.filter(function (c) {
      return c.diagnostic_capability === true;
    });
    steps.push(step('diagnosis', diagSources.length ? 'DOCUMENTED' : 'UNKNOWN',
      diagSources.length ? { sources: diagSources,
        documented_diagnostic_capabilities: diagCaps.length } : null));

    /* 3. Repair capability */
    steps.push(caps.length ?
      step('repair_capability', 'DOCUMENTED',
        caps.map(function (c) {
          return { id: c.id, workshop_id: c.workshop_id,
            operations: c.repair_operations,
            diagnostic: c.diagnostic_capability === true,
            fabrication: c.fabrication_capability === true,
            testing: c.testing_capability === true,
            status: c.status };
        })) :
      step('repair_capability', 'UNKNOWN', null));

    /* 4. Practitioner / workshop */
    var workshops = {};
    var practitioners = {};
    caps.forEach(function (c) {
      if (c.workshop_id) { workshops[c.workshop_id] = true; }
      (c.practitioner_ids || []).forEach(function (pid) {
        practitioners[pid] = true;
      });
    });
    var wsIds = Object.keys(workshops);
    var prIds = Object.keys(practitioners);
    steps.push((wsIds.length || prIds.length) ?
      step('practitioner_workshop', 'DOCUMENTED', {
        workshop_ids: wsIds,
        practitioner_count: prIds.length,
        practitioners_visible: personVisible(user)
      }) :
      step('practitioner_workshop', 'UNKNOWN', null));

    /* 5-7. Tools, materials, parts */
    var tools = {};
    var materials = {};
    caps.forEach(function (c) {
      var w = c.workshop_id && SCA.store.get('workshops', c.workshop_id);
      if (w) {
        (w.tool_ids || []).forEach(function (t) { tools[t] = true; });
        (w.material_ids || []).forEach(function (mt) { materials[mt] = true; });
      }
    });
    if (scenario) {
      (scenario.known_tool_requirements || []).forEach(function (t) {
        tools[t] = true;
      });
      (scenario.known_material_requirements || []).forEach(function (mt) {
        materials[mt] = true;
      });
    }
    var toolIds = Object.keys(tools);
    steps.push(step('required_tools',
      toolIds.length ? 'DOCUMENTED' : 'UNKNOWN',
      toolIds.length ? { tool_ids: toolIds } : null));
    var materialIds = Object.keys(materials);
    steps.push(step('required_materials',
      materialIds.length ? 'DOCUMENTED' : 'UNKNOWN',
      materialIds.length ? { material_ids: materialIds } : null));
    var parts = partsFor(at, aid);
    var partsDoc = parts.filter(function (p) {
      return COMPAT_ACTIVE.indexOf(p.compatibility_status) !== -1 &&
        p.compatibility_status !== 'UNKNOWN';
    });
    steps.push(step('required_parts',
      partsDoc.length ? 'DOCUMENTED' : 'UNKNOWN',
      parts.length ? parts.map(function (p) {
        return { id: p.id, name: p.name,
          compatibility_status: p.compatibility_status,
          availability_status: p.availability_status };
      }) : null));

    /* 8. Substitute / fabrication pathway */
    var subst = parts.filter(function (p) {
      return (p.alternative_part_ids || []).length ||
        (p.substitute_material_ids || []).length ||
        ['DOCUMENTED_POSSIBLE', 'REPORTED_POSSIBLE']
          .indexOf(p.fabrication_possible) !== -1;
    });
    steps.push(step('substitute_fabrication',
      subst.length ? 'DOCUMENTED' : 'UNKNOWN',
      subst.length ? subst.map(function (p) {
        return { id: p.id, name: p.name,
          fabrication_possible: p.fabrication_possible,
          alternatives: (p.alternative_part_ids || []).length,
          substitute_materials: (p.substitute_material_ids || []).length };
      }) : null));

    /* 9. Testing */
    var testingCaps = caps.filter(function (c) {
      return c.testing_capability === true;
    });
    var testedRecords = accepted.filter(function (r) {
      return !SCA.util.isBlank(r.test_result);
    });
    steps.push(step('testing',
      (testingCaps.length || testedRecords.length) ? 'DOCUMENTED' :
        'UNKNOWN',
      {
        documented_testing_capabilities: testingCaps.length,
        accepted_records_with_test_result: testedRecords.length
      }));

    /* 10. Return to service */
    var returned = accepted.filter(function (r) {
      return r.return_to_service === true;
    });
    steps.push(step('return_to_service',
      returned.length ? 'DOCUMENTED' : 'UNKNOWN',
      returned.length ? { records: returned.length } : null));

    /* 11. Knowledge */
    var knowledgeIds = [];
    records.forEach(function (r) {
      if (r.knowledge_artifact_id) { knowledgeIds.push(r.knowledge_artifact_id); }
    });
    if (scenario) {
      (scenario.knowledge_artifact_ids || []).forEach(function (k) {
        knowledgeIds.push(k);
      });
    }
    steps.push(step('knowledge',
      knowledgeIds.length ? 'DOCUMENTED' : 'UNKNOWN',
      knowledgeIds.length ? { knowledge_artifact_ids: knowledgeIds } : null));

    var documented = steps.filter(function (s) {
      return s.status === 'DOCUMENTED';
    }).length;
    return {
      ok: true,
      asset: asset,
      failure_scenario_id: query.failure_scenario_id || null,
      steps: steps,
      documented_steps: documented,
      unknown_steps: steps.length - documented,
      scope_note: scopedNote()
    };
  }

  /* ---------- spare-part pathway (per §17) ---------- */

  function sparePartPathway(user, partId) {
    var p = SCA.store.get('spare_parts', partId);
    if (!p) { return { ok: false, errors: { id: 'Spare part not found.' } }; }
    function item(value, extra) {
      var known = !(value === null || value === undefined || value === '' ||
        (Array.isArray(value) && !value.length));
      return Object.assign({
        status: known ? 'DOCUMENTED' : 'UNKNOWN',
        value: known ? value : null
      }, extra || {});
    }
    var suppliers = (p.supplier_ids || []).filter(function (sid) {
      return !!SCA.store.get('organizations', sid);
    }).map(function (sid) {
      return SCA.store.get('organizations', sid);
    });
    var alts = (p.alternative_part_ids || []).filter(function (aid) {
      return !!SCA.store.get('spare_parts', aid);
    }).map(function (aid) {
      return SCA.store.get('spare_parts', aid);
    });
    var subs = (p.substitute_material_ids || []).filter(function (mid) {
      return !!SCA.store.get('materials', mid);
    }).map(function (mid) {
      return SCA.store.get('materials', mid);
    });
    var fab = fabricationPathway(user, partId);
    return {
      ok: true,
      part_id: partId,
      name: p.name,
      local_stock: item(p.local_stock),
      regional_stock: item(p.regional_stock),
      stock_locations: item(p.stock_locations),
      external_supplier: item(p.import_sources,
        { supplier_organizations: suppliers }),
      alternative_parts: item(p.alternative_part_ids,
        { parts: alts.map(function (a) {
          return { id: a.id, name: a.name,
            compatibility_status: a.compatibility_status };
        }) }),
      substitute_materials: item(p.substitute_material_ids,
        { materials: subs.map(function (s) {
          return { id: s.id, name: s.name,
            availability_status: s.availability_status };
        }) }),
      local_fabrication: fab.ok ? fab : null,
      verification_state: item(p.compatibility_status),
      lead_time: item(p.lead_time),
      last_verified: item(p.last_verified),
      scope_note: scopedNote()
    };
  }

  /* ---------- local fabrication pathway (per §18) ----------
   * Decomposed, evidence-per-step, never one boolean. */

  function fabricationPathway(user, partId) {
    var p = SCA.store.get('spare_parts', partId);
    if (!p) { return { ok: false, errors: { id: 'Spare part not found.' } }; }
    var steps = [];

    /* 1. Fabrication possible? */
    var fp = p.fabrication_possible || 'UNKNOWN';
    steps.push(step('fabrication_possible',
      (fp === 'DOCUMENTED_POSSIBLE' || fp === 'DOCUMENTED_NOT_POSSIBLE') ?
        'DOCUMENTED' : (fp === 'REPORTED_POSSIBLE' ? 'REPORTED' : 'UNKNOWN'),
      { value: fp }));

    /* 2. Specification known? */
    var specKnown = !SCA.util.isBlank(p.fabrication_specification) ||
      (p.drawing_artifact_ids || []).length > 0;
    steps.push(step('specification_known',
      specKnown ? 'DOCUMENTED' : 'UNKNOWN', {
        fabrication_specification: p.fabrication_specification || null,
        drawing_artifact_ids: p.drawing_artifact_ids || []
      }));

    /* 3. Material available? */
    var subMats = (p.substitute_material_ids || []).map(function (mid) {
      return SCA.store.get('materials', mid);
    }).filter(Boolean);
    var avail = subMats.filter(function (mt) {
      return mt.availability_status === 'IN_STOCK' ||
        mt.availability_status === 'LIMITED';
    });
    steps.push(step('material_available',
      subMats.length ? 'DOCUMENTED' : 'UNKNOWN', {
        documented_materials: subMats.map(function (mt) {
          return { id: mt.id, name: mt.name,
            availability_status: mt.availability_status || 'UNKNOWN' };
        }),
        available_count: avail.length
      }));

    /* 4. Tooling available? */
    var toolingKnown = !SCA.util.isBlank(p.tooling_requirements) ||
      ((p.compatible_workshop_ids || []).some(function (wid) {
        var w = SCA.store.get('workshops', wid);
        return !!(w && (w.tool_ids || []).length);
      }));
    steps.push(step('tooling_available',
      toolingKnown ? 'DOCUMENTED' : 'UNKNOWN', {
        tooling_requirements: p.tooling_requirements || null,
        documented_workshop_tooling: (p.compatible_workshop_ids || [])
          .filter(function (wid) {
            var w = SCA.store.get('workshops', wid);
            return !!(w && (w.tool_ids || []).length);
          }).length
      }));

    /* 5. Workshop available? */
    var fabWorkshops = (p.compatible_workshop_ids || []).map(function (wid) {
      return SCA.store.get('workshops', wid);
    }).filter(function (w) {
      return w && WS_ACTIVE.indexOf(w.status) !== -1;
    });
    steps.push(step('workshop_available',
      fabWorkshops.length ? 'DOCUMENTED' : 'UNKNOWN',
      { workshop_ids: fabWorkshops.map(function (w) { return w.id; }) }));

    /* 6. Competent practitioner? (fabrication capability documented at
     * a compatible workshop for this part's asset) */
    var fabCaps = [];
    if (p.asset_type && (p.asset_ids || []).length) {
      (p.asset_ids || []).forEach(function (aid) {
        activeCapabilitiesFor(p.asset_type, aid).forEach(function (c) {
          if (c.fabrication_capability === true &&
            (p.compatible_workshop_ids || []).indexOf(c.workshop_id) !== -1) {
            fabCaps.push(c);
          }
        });
      });
    }
    steps.push(step('competent_practitioner',
      fabCaps.length ? 'DOCUMENTED' : 'UNKNOWN', {
        fabrication_capabilities: fabCaps.map(function (c) {
          return { id: c.id, workshop_id: c.workshop_id,
            status: c.status,
            competence_status: c.competence_status || 'UNKNOWN' };
        })
      }));

    /* 7. Testing capability? */
    var testCaps = fabCaps.filter(function (c) {
      return c.testing_capability === true;
    });
    steps.push(step('testing_capability',
      testCaps.length ? 'DOCUMENTED' : 'UNKNOWN',
      { documented: testCaps.length }));

    var documented = steps.filter(function (s) {
      return s.status === 'DOCUMENTED';
    }).length;
    return {
      ok: true,
      part_id: partId,
      steps: steps,
      documented_steps: documented,
      unknown_steps: steps.length - documented,
      /* Explicitly NOT reduced to "locally manufacturable: true". */
      scope_note: scopedNote()
    };
  }

  /* ---------- repair radius (§19) ----------
   * Descriptive nearest-documented queries. "Nearest" = dataset
   * granularity (region membership), always scope-labeled. */

  function repairRadius(user, query) {
    query = query || {};
    var at = query.asset_type;
    var aid = query.asset_id;
    var aerr = validateAsset(at, aid, 'asset_id');
    if (aerr) { return { ok: false, errors: { asset_id: aerr } }; }
    var regionId = query.region_id || null;
    var note = 'Nearest documented result within the current surveyed ' +
      'dataset. Undocumented capabilities are not asserted not to exist.';

    function inRegion(rec) {
      if (!regionId) { return true; }
      return (rec.region_ids || []).indexOf(regionId) !== -1 ||
        rec.region_id === regionId;
    }

    var caps = activeCapabilitiesFor(at, aid);
    var capWorkshopIds = [];
    caps.forEach(function (c) {
      if (c.workshop_id) { capWorkshopIds.push(c.workshop_id); }
    });
    var workshops = capWorkshopIds.map(function (wid) {
      return SCA.store.get('workshops', wid);
    }).filter(function (w) {
      return w && WS_ACTIVE.indexOf(w.status) !== -1;
    });

    var practitioners = [];
    caps.forEach(function (c) {
      (c.practitioner_ids || []).forEach(function (pid) {
        if (practitioners.indexOf(pid) === -1) { practitioners.push(pid); }
      });
    });

    var parts = partsFor(at, aid);

    var fabCaps = caps.filter(function (c) {
      return c.fabrication_capability === true;
    });

    function result(list, mapper) {
      return {
        status: list.length ? 'DOCUMENTED' : 'UNKNOWN',
        results: list.map(mapper),
        scope_note: note
      };
    }

    var regionFiltered = workshops.filter(inRegion);
    return {
      ok: true,
      asset: { type: at, id: aid, label: assetLabel(at, aid) },
      region_id: regionId,
      nearest_workshop: result(
        regionFiltered.length ? regionFiltered : workshops,
        function (w) {
          return publicWorkshop(user, w);
        }),
      nearest_repair_capability: result(caps.filter(function (c) {
        return !regionId || inRegion(c) ||
          (c.workshop_id && inRegion(
            SCA.store.get('workshops', c.workshop_id) || {}));
      }), function (c) { return publicCapability(user, c); }),
      nearest_technician: personVisible(user) ?
        result(practitioners, function (pid) { return pid; }) :
        { status: 'UNKNOWN',
          results: [],
          scope_note: 'Technician identities are not public.' },
      nearest_spare_part: result(parts, function (p) {
        return publicSparePart(user, p);
      }),
      nearest_fabrication_capability: result(fabCaps,
        function (c) { return publicCapability(user, c); }),
      scope_note: note
    };
  }

  /* ---------- geographic redundancy views (§20) ----------
   * Descriptive counts ONLY: no resilience scores, no rankings, no
   * "best workshop", no "most important region". */

  function geographicOverview(user) {
    var caps = SCA.store.all('repair_capabilities').filter(function (c) {
      return CAP_ACTIVE.indexOf(c.status) !== -1;
    });
    var workshops = SCA.store.all('workshops').filter(function (w) {
      return WS_ACTIVE.indexOf(w.status) !== -1;
    });
    var parts = SCA.store.all('spare_parts').filter(function (p) {
      return COMPAT_ACTIVE.indexOf(p.compatibility_status) !== -1;
    });
    var practitioners = {};
    caps.forEach(function (c) {
      (c.practitioner_ids || []).forEach(function (pid) {
        practitioners[pid] = true;
      });
    });
    var regions = {};
    workshops.forEach(function (w) {
      (w.region_ids || []).forEach(function (rid) { regions[rid] = true; });
    });
    var partsWithSupply = parts.filter(function (p) {
      return !SCA.util.isBlank(p.local_stock) ||
        !SCA.util.isBlank(p.regional_stock) ||
        (p.supplier_ids || []).length ||
        (p.stock_locations || []).length;
    });
    var fabPathways = parts.filter(function (p) {
      return p.fabrication_possible === 'DOCUMENTED_POSSIBLE' ||
        p.fabrication_possible === 'REPORTED_POSSIBLE';
    });
    return {
      ok: true,
      documented_repair_capabilities: caps.length,
      regions_represented: Object.keys(regions).length,
      region_ids: Object.keys(regions),
      documented_workshops: workshops.length,
      documented_practitioners: Object.keys(practitioners).length,
      spare_part_pathways: partsWithSupply.length,
      fabrication_pathways: fabPathways.length,
      unknown_compatibility_parts: SCA.store.all('spare_parts').filter(
        function (p) {
          return p.compatibility_status === 'UNKNOWN';
        }).length,
      scope_note: 'Counts describe the documented dataset only.'
    };
  }

  /* ---------- deterministic search (§35) ----------
   * Filtering and sorting ONLY — no ranking, no "best match". */

  function byName(a, b) {
    var an = (a.name || a.id || '');
    var bn = (b.name || b.id || '');
    return an < bn ? -1 : (an > bn ? 1 : 0);
  }

  function searchWorkshops(user, filters) {
    filters = filters || {};
    return SCA.store.all('workshops').filter(function (w) {
      var v = publicWorkshop(user, w);
      if (!v) { return false; }
      if (filters.status && w.status !== filters.status) { return false; }
      if (filters.region_id &&
        (w.region_ids || []).indexOf(filters.region_id) === -1 &&
        w.location_id !== filters.region_id) { return false; }
      if (filters.operating_status &&
        w.operating_status !== filters.operating_status) { return false; }
      if (filters.service &&
        (w.services || []).indexOf(filters.service) === -1) { return false; }
      if (filters.query) {
        var q = String(filters.query).toLowerCase();
        var hay = ((w.name || '') + ' ' + (w.description || '')).toLowerCase();
        if (hay.indexOf(q) === -1) { return false; }
      }
      return true;
    }).sort(byName).map(function (w) { return publicWorkshop(user, w); });
  }

  function searchRepairCapabilities(user, filters) {
    filters = filters || {};
    return SCA.store.all('repair_capabilities').filter(function (c) {
      if (CAP_ACTIVE.indexOf(c.status) === -1 &&
        !filters.include_retired) { return false; }
      if (filters.asset_type && c.asset_type !== filters.asset_type) {
        return false;
      }
      if (filters.asset_id && c.asset_id !== filters.asset_id) { return false; }
      if (filters.workshop_id && c.workshop_id !== filters.workshop_id) {
        return false;
      }
      if (filters.manufacturer &&
        (c.manufacturer || '') !== filters.manufacturer) { return false; }
      if (filters.model && (c.model || '') !== filters.model) { return false; }
      if (filters.operation) {
        var has = filters.operation === 'DIAGNOSTIC' ?
          c.diagnostic_capability === true :
          filters.operation === 'FABRICATION' ?
          c.fabrication_capability === true :
          filters.operation === 'TESTING' ?
          c.testing_capability === true :
          (c.repair_operations || []).length > 0;
        if (!has) { return false; }
      }
      return true;
    }).sort(byName).map(function (c) { return publicCapability(user, c); });
  }

  function searchSpareParts(user, filters) {
    filters = filters || {};
    return SCA.store.all('spare_parts').filter(function (p) {
      if (p.compatibility_status === 'REJECTED' && !filters.include_rejected) {
        return false;
      }
      if (filters.compatibility_status &&
        p.compatibility_status !== filters.compatibility_status) {
        return false;
      }
      if (filters.availability_status &&
        p.availability_status !== filters.availability_status) {
        return false;
      }
      if (filters.fabrication_possible &&
        p.fabrication_possible !== filters.fabrication_possible) {
        return false;
      }
      if (filters.asset_type && p.asset_type !== filters.asset_type) {
        return false;
      }
      if (filters.query) {
        var q = String(filters.query).toLowerCase();
        var hay = ((p.name || '') + ' ' + (p.part_number || '') + ' ' +
          (p.manufacturer || '') + ' ' +
          (p.manufacturer_part_number || '')).toLowerCase();
        if (hay.indexOf(q) === -1) { return false; }
      }
      return true;
    }).sort(byName).map(function (p) { return publicSparePart(user, p); });
  }

  function searchRepairRecords(user, filters) {
    if (!can(user, 'repair.records.read')) { return []; }
    filters = filters || {};
    return SCA.store.all('repair_records').filter(function (r) {
      if (filters.review_status &&
        r.review_status !== filters.review_status) { return false; }
      if (filters.failure_type && r.failure_type !== filters.failure_type) {
        return false;
      }
      if (filters.asset_type && r.asset_type !== filters.asset_type) {
        return false;
      }
      if (filters.asset_id && r.asset_id !== filters.asset_id) { return false; }
      if (filters.workshop_id && r.workshop_id !== filters.workshop_id) {
        return false;
      }
      return true;
    }).sort(function (a, b) {
      return (a.date < b.date ? -1 : a.date > b.date ? 1 :
        (a.id < b.id ? -1 : 1));
    }).map(function (r) { return publicRepairRecord(user, r); });
  }

  /* ---------- integrity (§30) ----------
   * Structural invariants over ACTIVE production data. Broken
   * references on retired historical records (REJECTED/SUPERSEDED
   * capabilities, CLOSED/INACTIVE workshops, REJECTED/ARCHIVED
   * records, REJECTED parts) are reported as historical_warnings —
   * intentional provenance preservation, not corruption. */

  function integrity() {
    var errors = [];
    var warnings = [];

    function err(kind, id, field, message) {
      errors.push({ kind: kind, id: id, field: field, message: message });
    }
    function warn(kind, id, field, message) {
      warnings.push({ kind: kind, id: id, field: field, message: message });
    }
    function checkRefs(kind, rec, active, spec) {
      Object.keys(spec).forEach(function (field) {
        var coll = spec[field];
        var ids = rec[field];
        if (!Array.isArray(ids)) { ids = ids ? [ids] : []; }
        ids.forEach(function (rid) {
          if (!SCA.store.get(coll, rid)) {
            (active ? err : warn)(kind, rec.id, field,
              'Broken reference to ' + coll + ': ' + rid);
          }
        });
      });
    }
    function checkAsset(kind, rec, active) {
      if (ASSET_TYPES.indexOf(rec.asset_type) === -1 ||
          !assetExists(rec.asset_type, rec.asset_id)) {
        (active ? err : warn)(kind, rec.id, 'asset_id',
          'Broken asset reference: ' + rec.asset_type + ':' + rec.asset_id);
      }
    }

    /* Workshops */
    SCA.store.all('workshops').forEach(function (w) {
      var active = WS_ACTIVE.indexOf(w.status) !== -1 ||
        w.status === 'UNDOCUMENTED';
      checkRefs('workshop', w, active, {
        location_id: 'locations', organization_id: 'organizations',
        repair_capability_ids: 'repair_capabilities',
        practitioner_ids: 'practitioners', tool_ids: 'tools',
        material_ids: 'materials', source_ids: 'evidence',
        knowledge_artifact_ids: 'knowledge',
        field_observation_ids: 'observations'
      });
      checkRefs('workshop', w, active, { region_ids: 'locations' });
      if (w.status === 'VERIFIED' && !hasProvenanceWs(w)) {
        err('workshop', w.id, 'source_ids',
          'VERIFIED workshop without provenance.');
      }
      if (w.status === 'VERIFIED' && SCA.util.isBlank(w.verification_reason)) {
        err('workshop', w.id, 'verification_reason',
          'VERIFIED workshop without an explicit verification reason.');
      }
    });

    /* Repair capabilities */
    SCA.store.all('repair_capabilities').forEach(function (c) {
      var active = CAP_ACTIVE.indexOf(c.status) !== -1;
      checkAsset('repair_capability', c, active);
      if (c.workshop_id && !SCA.store.get('workshops', c.workshop_id)) {
        (active ? err : warn)('repair_capability', c.id, 'workshop_id',
          'Broken workshop reference: ' + c.workshop_id);
      }
      checkRefs('repair_capability', c, active, {
        practitioner_ids: 'practitioners', region_ids: 'locations',
        evidence_source_ids: 'evidence',
        knowledge_artifact_ids: 'knowledge',
        field_observation_ids: 'observations'
      });
      if ((c.status === 'DOCUMENTED' || c.status === 'VERIFIED') &&
          !hasProvenanceCap(c)) {
        err('repair_capability', c.id, 'evidence_source_ids',
          c.status + ' capability without provenance.');
      }
      if (c.status === 'VERIFIED' &&
          (SCA.util.isBlank(c.reviewer) || SCA.util.isBlank(c.review_reason))) {
        err('repair_capability', c.id, 'reviewer',
          'VERIFIED capability without reviewer or explicit reason.');
      }
      /* Unauthorized certification: competence ASSESSED/VERIFIED must
       * be linked to a Stage 5 record, never self-declared. */
      if (c.competence_status === 'ASSESSED' &&
          !(c.linked_assessment_id &&
            SCA.store.get('competence_assessments',
              c.linked_assessment_id))) {
        err('repair_capability', c.id, 'linked_assessment_id',
          'ASSESSED competence without a linked Stage 5 assessment.');
      }
      if (c.competence_status === 'VERIFIED' &&
          !(c.linked_certification_id &&
            SCA.store.get('capability_certifications',
              c.linked_certification_id))) {
        err('repair_capability', c.id, 'linked_certification_id',
          'VERIFIED competence without a linked Stage 5 certification.');
      }
    });

    /* Spare parts */
    var seen = {};
    SCA.store.all('spare_parts').forEach(function (p) {
      var active = COMPAT_ACTIVE.indexOf(p.compatibility_status) !== -1;
      if (p.asset_type && ASSET_TYPES.indexOf(p.asset_type) !== -1) {
        (p.asset_ids || []).forEach(function (aid) {
          if (!assetExists(p.asset_type, aid)) {
            (active ? err : warn)('spare_part', p.id, 'asset_ids',
              'Broken asset reference: ' + p.asset_type + ':' + aid);
          }
        });
      }
      checkRefs('spare_part', p, active, {
        supplier_ids: 'organizations',
        alternative_part_ids: 'spare_parts',
        substitute_material_ids: 'materials',
        drawing_artifact_ids: 'knowledge',
        compatible_workshop_ids: 'workshops',
        stock_locations: 'locations', source_ids: 'evidence',
        knowledge_artifact_ids: 'knowledge'
      });
      /* Duplicate canonical part (same manufacturer + number). */
      var key = (p.manufacturer || '') + '|' +
        (p.manufacturer_part_number || '');
      if (!SCA.util.isBlank(p.manufacturer) &&
          !SCA.util.isBlank(p.manufacturer_part_number)) {
        if (seen[key]) {
          err('spare_part', p.id, 'manufacturer_part_number',
            'Duplicate manufacturer part number (also on ' + seen[key] + ').');
        } else {
          seen[key] = p.id;
        }
      }
      if (p.compatibility_status === 'VERIFIED' &&
          (SCA.util.isBlank(p.reviewer) || SCA.util.isBlank(p.review_reason) ||
           !p.last_verified)) {
        err('spare_part', p.id, 'reviewer',
          'VERIFIED compatibility without reviewer, reason or date.');
      }
    });

    /* Tools / materials / failure scenarios */
    SCA.store.all('tools').forEach(function (t) {
      checkRefs('tool', t, true, { workshop_ids: 'workshops',
        location_ids: 'locations', source_ids: 'evidence' });
    });
    SCA.store.all('materials').forEach(function (mt) {
      checkRefs('material', mt, true, { supplier_ids: 'organizations',
        source_ids: 'evidence' });
    });
    SCA.store.all('failure_scenarios').forEach(function (s) {
      if (s.asset_type && ASSET_TYPES.indexOf(s.asset_type) !== -1) {
        (s.asset_ids || []).forEach(function (aid) {
          if (!assetExists(s.asset_type, aid)) {
            err('failure_scenario', s.id, 'asset_ids',
              'Broken asset reference: ' + s.asset_type + ':' + aid);
          }
        });
      }
      checkRefs('failure_scenario', s, true, { source_ids: 'evidence',
        knowledge_artifact_ids: 'knowledge' });
    });

    /* Repair records */
    SCA.store.all('repair_records').forEach(function (r) {
      var active = RR_ACTIVE.indexOf(r.review_status) !== -1;
      checkAsset('repair_record', r, active);
      checkRefs('repair_record', r, active, {
        location_id: 'locations', region_id: 'locations',
        failure_scenario_id: 'failure_scenarios',
        technician_ids: 'practitioners', workshop_id: 'workshops',
        tools_used: 'tools', materials_used: 'materials',
        parts_used: 'spare_parts', substitutes_used: 'spare_parts',
        apprentice_ids: 'apprentices', knowledge_artifact_id: 'knowledge',
        source_ids: 'evidence'
      });
      if (r.review_status === 'ACCEPTED' &&
          (SCA.util.isBlank(r.reviewer) || SCA.util.isBlank(r.review_reason))) {
        err('repair_record', r.id, 'reviewer',
          'ACCEPTED record without reviewer or explicit reason.');
      }
    });

    return { ok: errors.length === 0, errors: errors,
      historical_warnings: warnings };
  }

  /* ---------- public API ---------- */

  SCA.repair = {
    /* asset helpers */
    ASSET_TYPES: ASSET_TYPES,
    assetCollection: assetCollection,
    assetExists: assetExists,
    assetLabel: assetLabel,
    /* privacy */
    personVisible: personVisible,
    publicWorkshop: publicWorkshop,
    publicCapability: publicCapability,
    publicSparePart: publicSparePart,
    publicRepairRecord: publicRepairRecord,
    /* workshops */
    createWorkshop: createWorkshop,
    documentWorkshop: documentWorkshop,
    verifyWorkshop: verifyWorkshop,
    setWorkshopState: setWorkshopState,
    updateWorkshop: updateWorkshop,
    /* repair capabilities */
    createRepairCapability: createRepairCapability,
    documentRepairCapability: documentRepairCapability,
    verifyRepairCapability: verifyRepairCapability,
    rejectRepairCapability: rejectRepairCapability,
    supersedeRepairCapability: supersedeRepairCapability,
    updateRepairCapability: updateRepairCapability,
    linkCompetenceAssessment: linkCompetenceAssessment,
    linkCompetenceCertification: linkCompetenceCertification,
    /* spare parts */
    createSparePart: createSparePart,
    updateSparePart: updateSparePart,
    transitionCompatibility: transitionCompatibility,
    reportCompatibility: function (user, id, notes) {
      return transitionCompatibility(user, id, 'REPORTED', { notes: notes });
    },
    documentCompatibility: function (user, id, notes) {
      return transitionCompatibility(user, id, 'DOCUMENTED',
        { notes: notes });
    },
    testCompatibility: function (user, id, notes) {
      return transitionCompatibility(user, id, 'TESTED', { notes: notes });
    },
    verifyCompatibility: function (user, id, reason) {
      return transitionCompatibility(user, id, 'VERIFIED',
        { reason: reason });
    },
    rejectCompatibility: function (user, id, reason) {
      return transitionCompatibility(user, id, 'REJECTED',
        { reason: reason });
    },
    /* repair records */
    createRepairRecord: createRepairRecord,
    updateRepairRecord: updateRepairRecord,
    submitRepairRecord: function (user, id) {
      return transitionRepairRecord(user, id, 'SUBMITTED');
    },
    startRepairReview: function (user, id) {
      return transitionRepairRecord(user, id, 'UNDER_REVIEW');
    },
    acceptRepairRecord: function (user, id, reason) {
      return transitionRepairRecord(user, id, 'ACCEPTED', reason);
    },
    rejectRepairRecord: function (user, id, reason) {
      return transitionRepairRecord(user, id, 'REJECTED', reason);
    },
    archiveRepairRecord: function (user, id) {
      return transitionRepairRecord(user, id, 'ARCHIVED');
    },
    recordLesson: recordLesson,
    /* pathways */
    repairPathway: repairPathway,
    sparePartPathway: sparePartPathway,
    fabricationPathway: fabricationPathway,
    repairRadius: repairRadius,
    geographicOverview: geographicOverview,
    /* search */
    searchWorkshops: searchWorkshops,
    searchRepairCapabilities: searchRepairCapabilities,
    searchSpareParts: searchSpareParts,
    searchRepairRecords: searchRepairRecords,
    /* integrity */
    integrity: integrity
  };
})(SCA);
