/*
 * Regional Capability Pilot workflow (Stage 11, frozen scope v1.1).
 *
 * ARCHITECTURAL RULES (permanent, frozen Stage 11 scope v1.1 +
 * implementation authorization v1.0):
 *  - Exactly ONE new operational entity: PilotProject. Stages 1–10
 *    remain authoritative for their domains and are consumed ONLY
 *    through their existing public interfaces and canonical
 *    collections. No shadow records of any kind.
 *  - A pilot COORDINATES; it never re-governs. It holds no outcome
 *    field: intervention outcomes stay governed by Stage 10,
 *    competence by Stage 5, census methodology by Stage 6, graph
 *    relationships by Stage 7, repair by Stage 8, recovery by
 *    Stage 9. Conclusion is an administrative lifecycle state only.
 *  - Lifecycle: PROPOSED -> APPROVED -> ACTIVE -> CONCLUDED, with
 *    CANCELLED reachable from PROPOSED, APPROVED and ACTIVE.
 *    CONCLUDED and CANCELLED are terminal and immutable (no
 *    resurrection, no RETIRED state). PROPOSED is fully editable;
 *    APPROVED and ACTIVE change only through explicit, attributable,
 *    audited AMENDMENTS with a mandatory reason. No silent mutation
 *    of historical state.
 *  - Approval gate: existing administrative authority with
 *    creator/approver separation — the creator NEVER approves their
 *    own pilot, at ANY role level including NATIONAL. project_manager
 *    may create and update but never approve.
 *  - Activation gate: at least one VALID constituent activity — an
 *    intervention, organization, workshop or training program
 *    (standalone pilots are legitimate). Practitioners and locations
 *    alone do not make a pilot ACTIVE, and an empty pilot cannot be
 *    activated. All referenced records must resolve.
 *  - Regional scope: canonical Stage 1 Location references only. No
 *    Region entity, no free-floating regional identity, no invented
 *    coordinates. Displayed labels derive from the canonical records.
 *  - NO geographic RBAC: the existing flat permission family is used
 *    as-is. The application never claims that a role can approve a
 *    pilot "because it is in their region" — no region-matching
 *    engine exists and none is implied.
 *  - census_snapshot_id references an IMMUTABLE Stage 6 snapshot: a
 *    dated "began against" reference. Never recalculated, never
 *    regenerated, never presented as a current measurement.
 *  - Many-to-many intervention membership transfers NO authority:
 *    adding/removing an intervention on a pilot never modifies the
 *    intervention record itself.
 *  - NOT a graph node: no graph writes, ever.
 *  - No scores, no rates, no rankings, no prioritization. The
 *    read-only overview shows categorical outcome COUNTS with
 *    explicit count bases only; a pilot with no constituent
 *    interventions shows "Not applicable", never UNKNOWN.
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['PROPOSED', 'APPROVED', 'ACTIVE', 'CONCLUDED',
    'CANCELLED'];
  var TERMINAL = ['CONCLUDED', 'CANCELLED'];
  /* Anonymous users see only the explicitly public coordination
   * states; PROPOSED planning material and CANCELLED records are
   * staff-only (no outcome information exists on a pilot at all). */
  var PUBLIC_STATUSES = ['APPROVED', 'ACTIVE', 'CONCLUDED'];

  /* Frozen transition table (scope v1.1 pins 7/8 + authorization
   * section 5). Cancellation is reachable from PROPOSED, APPROVED
   * and ACTIVE; the terminal states have no outgoing transitions. */
  var TRANSITIONS = {
    PROPOSED: ['APPROVED', 'CANCELLED'],
    APPROVED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['CONCLUDED', 'CANCELLED'],
    CONCLUDED: [],
    CANCELLED: []
  };

  /* Constituent activity fields (frozen scope v1.1 pin 2): the
   * activation gate counts these four. Practitioners are references
   * (privacy-masked participants), not activities. */
  var ACTIVITY_FIELDS = {
    intervention_ids: 'capability_interventions',
    organization_ids: 'organizations',
    workshop_ids: 'workshops',
    training_program_ids: 'training_programs'
  };

  /* Canonical reference fields -> existing collections. These are
   * references into Stage 1–10 records — never shadow records. */
  var REFERENCE_FIELDS = Object.assign({
    practitioner_ids: 'practitioners',
    location_ids: 'locations'
  }, ACTIVITY_FIELDS);

  /* Categorical Stage 10 outcome codes (read from the interventions'
   * own outcome_status field — Stage 10 remains the owner). */
  var OUTCOME_CODES = ['SUCCESSFUL', 'MIXED', 'UNSUCCESSFUL',
    'INSUFFICIENT_EVIDENCE', 'UNKNOWN'];
  var NOT_APPLICABLE = 'Intervention outcome: Not applicable / no ' +
    'constituent interventions';

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function now() { return SCA.util.now(); }

  function audited(action, id, user, opts) {
    opts = opts || {};
    return SCA.audit.log(action, {
      actor: userName(user),
      entity: 'pilot_projects',
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }

  var SUBSTANTIVE_KEYS = ['name', 'objective', 'location_ids',
    'intervention_ids', 'organization_ids', 'workshop_ids',
    'training_program_ids', 'practitioner_ids', 'census_snapshot_id'];

  function snapshotOf(rec) {
    var snap = {};
    SUBSTANTIVE_KEYS.forEach(function (k) {
      snap[k] = rec[k] === undefined ? null :
        JSON.parse(JSON.stringify(rec[k]));
    });
    snap.status = rec.status;
    return snap;
  }

  function pushHistory(rec, user, reason, changeType) {
    rec.history = rec.history || [];
    rec.history.push({
      version: rec.version || 1,
      changed_at: now(),
      changed_by: userName(user),
      change_type: changeType || 'TRANSITION',
      reason: reason || null,
      status: rec.status,
      snapshot: snapshotOf(rec)
    });
    rec.version = String((parseInt(rec.version, 10) || 1) + 1);
  }

  /* ---------- validation ---------- */

  function refsError(rec, fields) {
    var errors = {};
    Object.keys(fields).forEach(function (field) {
      var coll = fields[field];
      var ids = rec[field];
      if (!Array.isArray(ids)) { return; }
      var missing = ids.filter(function (rid) {
        return !SCA.store.get(coll, rid);
      });
      if (missing.length) {
        errors[field] = 'Missing ' + coll + ' records: ' +
          missing.join(', ') + ' (references are canonical and are ' +
          'never silently created).';
      }
    });
    return errors;
  }

  function censusSnapshotError(rec) {
    if (!rec.census_snapshot_id) { return {}; }
    var snap = SCA.store.get('census_snapshots', rec.census_snapshot_id);
    if (!snap) {
      return { census_snapshot_id: 'Unknown census snapshot: ' +
        rec.census_snapshot_id + ' (a snapshot reference is never ' +
        'silently created).' };
    }
    return {};
  }

  function validatePilot(rec) {
    var errors = {};
    if (STATUSES.indexOf(rec.status) === -1) {
      errors.status = 'Unknown status.';
    }
    Object.assign(errors, refsError(rec, REFERENCE_FIELDS));
    Object.assign(errors, censusSnapshotError(rec));
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- creation & editing ---------- */

  function createPilot(user, data) {
    if (!can(user, 'pilot.create')) { return deny('pilot.create'); }
    data = data || {};
    if (SCA.util.isBlank(data.name)) {
      return { ok: false, errors: {
        name: 'A pilot requires a name.'
      } };
    }
    var rec = Object.assign({
      id: null,
      name: data.name,
      objective: data.objective || '',
      status: 'PROPOSED',
      location_ids: data.location_ids || [],
      intervention_ids: data.intervention_ids || [],
      organization_ids: data.organization_ids || [],
      workshop_ids: data.workshop_ids || [],
      training_program_ids: data.training_program_ids || [],
      practitioner_ids: data.practitioner_ids || [],
      census_snapshot_id: data.census_snapshot_id || null,
      reviewer: null,
      review_reason: null,
      approved_at: null,
      activated_at: null,
      concluded_at: null,
      cancelled_at: null,
      last_reason: null,
      created_by: userName(user),
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.pilot_project.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validatePilot(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var res = SCA.store.insert('pilot_projects', rec);
    if (res.ok) {
      audited('pilot.created', res.record.id, user,
        { new_value: rec.name });
    }
    return res;
  }

  /* PROPOSED: fully editable subject to normal permissions (every
   * change history-recorded; no silent mutation). */
  function updatePilot(user, id, patch) {
    if (!can(user, 'pilot.update')) { return deny('pilot.update'); }
    patch = patch || {};
    var r = SCA.store.get('pilot_projects', id);
    if (!r) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    if (r.status !== 'PROPOSED') {
      return { ok: false, errors: {
        status: 'Only PROPOSED pilots are freely editable (current: ' +
          r.status + '). APPROVED and ACTIVE pilots change only ' +
          'through explicit audited amendments; terminal records ' +
          'are immutable.'
      } };
    }
    return applyChange(user, id, patch, 'PROPOSED edit', 'EDIT');
  }

  /* APPROVED / ACTIVE: explicit, audited amendment with a mandatory
   * reason. Terminal states refuse everything. */
  function amendPilot(user, id, patch, reason) {
    if (!can(user, 'pilot.update')) { return deny('pilot.update'); }
    patch = patch || {};
    var r = SCA.store.get('pilot_projects', id);
    if (!r) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    if (['APPROVED', 'ACTIVE'].indexOf(r.status) === -1) {
      return { ok: false, errors: {
        status: 'Amendments apply to APPROVED or ACTIVE pilots only ' +
          '(current: ' + r.status + '). Terminal records are ' +
          'immutable historical records and are never edited.'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An amendment requires an explicit reason.'
      } };
    }
    return applyChange(user, id, patch, reason, 'AMENDMENT');
  }

  /* Shared in-place change path (history snapshot + audit). */
  function applyChange(user, id, patch, reason, changeType) {
    patch = patch || {};
    var r = SCA.store.get('pilot_projects', id);
    var immutable = ['id', 'created_at', 'created_by', 'status',
      'reviewer', 'review_reason', 'approved_at', 'activated_at',
      'concluded_at', 'cancelled_at', 'version', 'history'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.pilot_project.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validatePilot(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    pushHistory(r, user, reason, changeType);
    next.version = r.version;
    next.updated_at = now();
    next.last_reason = reason;
    var res = SCA.store.update('pilot_projects', id, next);
    if (res.ok) {
      audited(changeType === 'AMENDMENT' ? 'pilot.amended' :
        'pilot.edited', id, user, { reason: reason });
    }
    return res;
  }

  /* Generic transition helper. */
  function transition(user, id, to, perm, opts) {
    opts = opts || {};
    if (!can(user, perm)) { return deny(perm); }
    var r = SCA.store.get('pilot_projects', id);
    if (!r) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    var allowed = TRANSITIONS[r.status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: {
        status: 'Status "' + r.status + '" cannot move to "' + to +
          '". Allowed: ' + (allowed.join(', ') || 'none (terminal).')
      } };
    }
    if (opts.requireReason && SCA.util.isBlank(opts.reason)) {
      return { ok: false, errors: {
        reason: opts.reasonMessage || 'An explicit reason is required.'
      } };
    }
    if (opts.gate) {
      var gate = opts.gate(r);
      if (gate) { return { ok: false, errors: gate }; }
    }
    var from = r.status;
    pushHistory(r, user, opts.reason || opts.defaultReason || null,
      'TRANSITION');
    r.status = to;
    r.updated_at = now();
    if (opts.reason || opts.defaultReason) {
      r.last_reason = opts.reason || opts.defaultReason;
    }
    if (opts.stamp) { opts.stamp(r); }
    var res = SCA.store.update('pilot_projects', id, r);
    if (res.ok) {
      audited(opts.action, id, user, { old_value: from,
        new_value: to, reason: opts.reason || null });
    }
    return res;
  }

  /* ---------- lifecycle ---------- */

  /* PROPOSED -> APPROVED. Zero constituents are permitted (plan-first)
   * but the creator/approver separation is absolute: no role level,
   * including NATIONAL, may approve its own pilot. The RBAC matrix
   * gives approval authority to regional_administrator and
   * national_administrator only, and the
   * workflow additionally refuses a self-approval by the record's
   * creator as a second guard. */
  function approvePilot(user, id, reason) {
    return transition(user, id, 'APPROVED', 'pilot.approve', {
      action: 'pilot.approved',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Approval requires an explicit documented reason.',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.review_reason = reason;
        r.approved_at = now();
      },
      gate: function (r) {
        if (SCA.util.isBlank(r.name) ||
          SCA.util.isBlank(r.objective)) {
          return { name: 'Approval requires a name and an objective ' +
            '(a plan without an objective cannot be reviewed).' };
        }
        if (r.created_by === userName(user)) {
          return { creator: 'A creator cannot approve their own pilot ' +
            '(creator/approver separation applies at every role ' +
            'level, including NATIONAL).' };
        }
        return null;
      }
    });
  }

  /* APPROVED -> ACTIVE. The activation gate (frozen scope v1.1 pin 2):
   * at least one VALID constituent ACTIVITY — an intervention, an
   * organization, a workshop or a training program. Standalone pilots
   * (no interventions) are legitimate. Practitioners and locations
   * are references, not activities: a pilot with only people/places
   * is still an empty plan. No additional invented requirements. */
  function activatePilot(user, id) {
    return transition(user, id, 'ACTIVE', 'pilot.update', {
      action: 'pilot.activated',
      defaultReason: 'Execution started (constituent activities ' +
        'coordinated under this pilot).',
      stamp: function (r) { r.activated_at = now(); },
      gate: function (r) {
        /* Only references that RESOLVE count (authorization section
         * 7: all referenced records must satisfy their applicable
         * visibility/access rules — a dangling id is not an
         * activity). */
        var activities = 0;
        Object.keys(ACTIVITY_FIELDS).forEach(function (field) {
          (r[field] || []).forEach(function (rid) {
            if (SCA.store.get(ACTIVITY_FIELDS[field], rid)) {
              activities += 1;
            }
          });
        });
        if (activities === 0) {
          return { constituents: 'Activation requires at least one ' +
            'valid constituent activity — an intervention, an ' +
            'organization, a workshop or a training program that ' +
            'actually resolves (standalone pilots are legitimate; ' +
            'an empty or dangling plan is not an execution). ' +
            'Practitioner and location references alone do not ' +
            'activate a pilot.' };
        }
        return null;
      }
    });
  }

  /* ACTIVE -> CONCLUDED. Administrative terminal state: conclusion
   * NEVER implies success. A pilot holds no outcome field of any
   * kind; the outcomes of constituent interventions remain governed
   * by Stage 10. */
  function concludePilot(user, id, reason) {
    return transition(user, id, 'CONCLUDED', 'pilot.conclude', {
      action: 'pilot.concluded',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Conclusion requires an explicit documented ' +
        'reason (audited; it records only that the coordination ' +
        'activity ended — never a result).',
      stamp: function (r) { r.concluded_at = now(); }
    });
  }

  /* Cancellation: explicit, reason-required, audited, terminal.
   * Reachable from PROPOSED, APPROVED and ACTIVE only; CONCLUDED and
   * CANCELLED pilots are never resurrected. */
  function cancelPilot(user, id, reason) {
    return transition(user, id, 'CANCELLED', 'pilot.update', {
      action: 'pilot.cancelled',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Cancellation requires an explicit reason ' +
        '(audited, terminal — a cancelled pilot is never resurrected).',
      stamp: function (r) { r.cancelled_at = now(); }
    });
  }

  /* ---------- retrieval ---------- */

  function visibleStatuses(user) {
    var isAnon = !(user && user.role);
    return isAnon ? PUBLIC_STATUSES : STATUSES;
  }

  function getPilot(user, id) {
    if (!can(user, 'pilot.read')) { return deny('pilot.read'); }
    var r = SCA.store.get('pilot_projects', id);
    if (!r) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    if (visibleStatuses(user).indexOf(r.status) === -1) {
      return { ok: false, errors: {
        permission: 'This pilot is not publicly visible (internal ' +
        'planning states are staff-only).'
      } };
    }
    return { ok: true, record: r };
  }

  function searchPilots(user, filters) {
    if (!can(user, 'pilot.read')) { return deny('pilot.read'); }
    filters = filters || {};
    var visible = visibleStatuses(user);
    var out = SCA.store.all('pilot_projects')
      .filter(function (r) {
        if (visible.indexOf(r.status) === -1) { return false; }
        if (filters.status && r.status !== filters.status) {
          return false;
        }
        if (filters.intervention_id &&
          (r.intervention_ids || []).indexOf(filters.intervention_id)
            === -1) {
          return false;
        }
        if (filters.location_id &&
          (r.location_ids || []).indexOf(filters.location_id) === -1) {
          return false;
        }
        if (filters.query) {
          var q = String(filters.query).toLowerCase();
          var hay = [r.name, r.objective].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) { return false; }
        }
        return true;
      });
    /* Neutral deterministic ordering only — never evaluative. */
    out.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || '')) ||
        String(a.created_at || '')
          .localeCompare(String(b.created_at || ''));
    });
    return { ok: true, results: out };
  }

  /* ---------- read-only outcome aggregation ---------- */

  /* SCA.pilots.overview(pilot) (authorization section 16): a
   * READ-ONLY aggregation. If constituent interventions exist, it
   * reports categorical COUNTS of their CURRENT Stage 10 outcome
   * statuses with explicit count bases — never rates, percentages,
   * scores, rankings or weighted averages. If NO interventions are
   * constituents, it reports not_applicable: "UNKNOWN" belongs to
   * Stage 10 intervention outcomes and there is no intervention
   * population here to evaluate. The overview never mutates any
   * source record. */
  function overview(pilot) {
    if (!pilot || !pilot.id) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    var rec = SCA.store.get('pilot_projects', pilot.id);
    if (!rec) {
      return { ok: false, errors: { id: 'Pilot not found.' } };
    }
    var interventions = (rec.intervention_ids || [])
      .map(function (id) { return SCA.store.get(
        'capability_interventions', id); })
      .filter(Boolean);

    var result = {
      ok: true,
      pilot_id: rec.id,
      status: rec.status,
      counts_basis: 'documented in the current dataset',
      constituent_counts: {
        interventions: (rec.intervention_ids || []).length,
        organizations: (rec.organization_ids || []).length,
        workshops: (rec.workshop_ids || []).length,
        training_programs: (rec.training_program_ids || []).length,
        practitioners: (rec.practitioner_ids || []).length
      }
    };

    if (!interventions.length) {
      result.intervention_outcomes = null;
      result.not_applicable = true;
      result.intervention_outcome_summary = NOT_APPLICABLE;
      return result;
    }

    /* Only interventions that are actually visible as concluded
     * activities can carry an assessed outcome; Stage 10 semantics
     * are read, never re-derived here. */
    var counts = {};
    OUTCOME_CODES.forEach(function (c) { counts[c] = 0; });
    interventions.forEach(function (iv) {
      var oc = iv.outcome_status || 'UNKNOWN';
      if (counts[oc] === undefined) { counts[oc] = 0; }
      counts[oc] += 1;
    });
    result.intervention_outcomes = counts;
    result.not_applicable = false;
    result.intervention_outcome_summary =
      'Categorical counts of the current Stage 10 outcome statuses ' +
      'of the constituent interventions documented in the current ' +
      'dataset (' + interventions.length + ' of ' +
      (rec.intervention_ids || []).length +
      ' referenced records resolve). Never a rate, score or ranking.';
    return result;
  }

  /* ---------- integrity (honest flags, never silent deletion) ---------- */

  function pilotIntegrity(user) {
    if (!can(user, 'pilot.read')) { return deny('pilot.read'); }
    var errors = [];
    var warnings = [];
    function err(id, field, message) {
      errors.push('pilot_projects ' + id + ' -> ' + field + ': ' + message);
    }
    function warn(id, field, message) {
      warnings.push('pilot_projects ' + id + ' -> ' + field + ': ' + message);
    }

    SCA.store.all('pilot_projects').forEach(function (r) {
      if (!r) { return; }
      if (STATUSES.indexOf(r.status) === -1) {
        err(r.id, 'status', 'invalid status ' + r.status);
        return;
      }
      var terminal = TERMINAL.indexOf(r.status) !== -1;

      /* Canonical references must resolve; terminal history follows
       * the established historical-reference exemption (warning, not
       * error — the reference is preserved, never silently deleted). */
      Object.keys(REFERENCE_FIELDS).forEach(function (field) {
        var coll = REFERENCE_FIELDS[field];
        (r[field] || []).forEach(function (rid) {
          if (!SCA.store.get(coll, rid)) {
            (terminal ? warn : err)(r.id, field, 'unresolvable ' +
              coll + ' ' + rid + (terminal ? ' (terminal record: ' +
                'kept by the historical exemption, never deleted)' : ''));
          }
        });
      });
      if (r.census_snapshot_id &&
        !SCA.store.get('census_snapshots', r.census_snapshot_id)) {
        (terminal ? warn : err)(r.id, 'census_snapshot_id',
          'unresolvable census snapshot ' + r.census_snapshot_id);
      }

      /* Lifecycle bookkeeping honesty. */
      if (r.status !== 'PROPOSED' && !r.approved_at) {
        err(r.id, 'approved_at', 'status is ' + r.status +
          ' but no approval is recorded');
      }
      if (r.status === 'APPROVED' && (!r.reviewer || !r.approved_at)) {
        err(r.id, 'approved_at', 'APPROVED record is missing its ' +
          'approval trail');
      }
      if (r.status === 'ACTIVE' && !r.activated_at) {
        err(r.id, 'activated_at', 'ACTIVE record has no activation ' +
          'timestamp');
      }
      if (r.status === 'CONCLUDED' && !r.concluded_at) {
        err(r.id, 'concluded_at', 'CONCLUDED record has no conclusion ' +
          'timestamp');
      }
      if (r.status === 'CANCELLED' &&
        (SCA.util.isBlank(r.last_reason) || !r.cancelled_at)) {
        err(r.id, 'cancelled_at', 'CANCELLED record has no recorded ' +
          'reason/timestamp');
      }

      /* Active pilots must hold their activation gate honestly: a
       * referenced constituent that no longer resolves is flagged,
       * never silently dropped. */
      if (r.status === 'ACTIVE') {
        var live = 0;
        Object.keys(ACTIVITY_FIELDS).forEach(function (field) {
          (r[field] || []).forEach(function (rid) {
            if (SCA.store.get(ACTIVITY_FIELDS[field], rid)) { live += 1; }
          });
        });
        if (live === 0) {
          err(r.id, 'constituents', 'ACTIVE pilot has no resolvable ' +
            'constituent activity (flagged honestly; never ' +
            'auto-concluded)');
        }
      }

      /* A pilot NEVER carries outcome fields of its own. */
      ['outcome_status', 'score', 'success_rate', 'rating',
        'priority'].forEach(function (bad) {
          if (r[bad] !== undefined) {
            err(r.id, bad, 'a pilot must never carry the field "' +
              bad + '" (a pilot coordinates; it never re-governs)');
          }
        });
    });

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /* ---------- public API ---------- */

  SCA.pilots = {
    /* frozen vocabulary (exported for pages, tests and inspection) */
    STATUSES: STATUSES,
    TERMINAL_STATUSES: TERMINAL,
    PUBLIC_STATUSES: PUBLIC_STATUSES,
    TRANSITIONS: TRANSITIONS,
    ACTIVITY_FIELDS: ACTIVITY_FIELDS,
    REFERENCE_FIELDS: REFERENCE_FIELDS,
    OUTCOME_CODES: OUTCOME_CODES,
    NOT_APPLICABLE: NOT_APPLICABLE,
    /* lifecycle */
    createPilot: createPilot,
    updatePilot: updatePilot,
    amendPilot: amendPilot,
    approvePilot: approvePilot,
    activatePilot: activatePilot,
    concludePilot: concludePilot,
    cancelPilot: cancelPilot,
    /* retrieval */
    getPilot: getPilot,
    searchPilots: searchPilots,
    /* read-only aggregation */
    overview: overview,
    /* integrity */
    integrity: pilotIntegrity
  };
})(SCA);
