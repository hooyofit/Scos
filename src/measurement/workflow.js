/*
 * Measurement workflow (Stage 12, frozen scope v1.1 + implementation
 * authorization v1.0).
 *
 * ARCHITECTURAL RULES (frozen):
 *  - Exactly TWO Stage 12 domain entities: Measurement and
 *    Indicator. No shadow entities of any kind.
 *  - A measurement is a FACTUAL OBSERVATION within an explicit
 *    observation_scope. "Documented within a defined scope" NEVER
 *    means "the documented quantity represents the total
 *    population" (frozen carry-forward rule).
 *  - basis is EXACTLY the frozen four-value vocabulary
 *    (OBSERVED/ESTIMATED/REPORTED/UNKNOWN). UNKNOWN -> value null
 *    (never zero). Zero requires an explicit factual basis
 *    (OBSERVED or REPORTED). ESTIMATED requires an APPROVED
 *    methodology (census-derived: census_methodologies) or a
 *    documented method (non-census).
 *  - Lifecycle (frozen): DRAFT -> SUBMITTED -> UNDER_REVIEW ->
 *    ACCEPTED, with UNDER_REVIEW -> REJECTED and ACCEPTED ->
 *    SUPERSEDED. DRAFT is editable by its creator only; SUBMITTED
 *    and UNDER_REVIEW are locked; ACCEPTED/REJECTED/SUPERSEDED are
 *    terminal and immutable. No resurrection.
 *  - Reviewer separation (frozen §10): the creator NEVER reviews
 *    or accepts their own measurement — enforced at the SERVICE
 *    LAYER at every role level including national_administrator.
 *    UI hiding is never the rule.
 *  - Corrections NEVER edit accepted records: a correction is a new
 *    measurement (supersedes_id) whose acceptance retires the
 *    original to SUPERSEDED with byte-exact history preservation
 *    (retire-first with rollback, the established pattern).
 *  - Stage authorities are preserved: Stage 3 evidence (no
 *    automatic E-level upgrades), Stage 4 research, Stage 5
 *    competence, Stage 6 census (snapshot identity/date/methodology/
 *    scope/version preserved; a newer census never rewrites an
 *    older measurement), Stage 7 graph (read-only; graph-derived
 *    measurements carry GRAPH_DERIVED provenance; no writes, no
 *    edges, 19-type registry untouched), Stage 8 repair, Stage 9
 *    recovery, Stage 10 intervention (outcome vocabulary untouched),
 *    Stage 11 pilot (no pilot scores).
 *  - No scores, no rankings, no priorities, no policy output.
 *  - Offline-first: DRAFT creation, local persistence and
 *    export/import all work with no network dependency (the storage
 *    abstraction is local; transfer is file-based).
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED',
    'REJECTED', 'SUPERSEDED'];
  var TERMINAL = ['ACCEPTED', 'REJECTED', 'SUPERSEDED'];
  var PUBLIC_STATUSES = ['ACCEPTED', 'SUPERSEDED'];

  /* Frozen transition table (scope v1.1 §8 + authorization §7). */
  var TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['SUPERSEDED'], /* only via correction acceptance */
    REJECTED: [],
    SUPERSEDED: []
  };

  /* Controlled vocabularies (frozen; no free text). */
  var BASES = ['OBSERVED', 'ESTIMATED', 'REPORTED', 'UNKNOWN'];
  var KINDS = ['COUNT', 'RATIO', 'RATE', 'DURATION', 'PERCENTAGE',
    'CATEGORICAL'];
  var DERIVATIONS = ['DIRECT', 'GRAPH_DERIVED'];
  var ROLES = ['NUMERATOR', 'DENOMINATOR'];

  /* kind -> allowed units (frozen unit vocabulary, scope v1.1 §5). */
  var KIND_UNITS = {
    COUNT: ['COUNT', 'PERSONS', 'HOUSEHOLDS', 'COMMUNITIES',
      'ORGANIZATIONS', 'WORKSHOPS', 'PROGRAMS', 'SESSIONS', 'EVENTS',
      'REPAIRS', 'TOOLS', 'PARTS', 'DOCUMENTS'],
    RATIO: ['RATIO'],
    RATE: ['RATIO', 'PERCENT'],
    DURATION: ['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'],
    PERCENTAGE: ['PERCENT'],
    CATEGORICAL: ['CATEGORY']
  };

  /* Canonical provenance source types -> existing collections
   * (frozen scope v1.1 §11). Existing records ONLY: never
   * duplicated, never upgraded. */
  var SOURCE_TYPES = {
    EVIDENCE_SOURCE: 'evidence',
    KNOWLEDGE_ARTIFACT: 'knowledge',
    CLAIM: 'claims',
    FIELD_OBSERVATION: 'observations',
    FIELD_NOTE: 'field_notes',
    RESEARCH_PROJECT: 'research_projects',
    RESEARCH_SESSION: 'research_sessions',
    CENSUS_OBSERVATION: 'census_observations',
    CENSUS_SNAPSHOT: 'census_snapshots',
    REPAIR_RECORD: 'repair_records',
    FAILURE_SCENARIO: 'failure_scenarios',
    RECOVERY_PROFILE: 'recovery_profiles',
    CAPABILITY_INTERVENTION: 'capability_interventions',
    PILOT_PROJECT: 'pilot_projects',
    COMPETENCE_ASSESSMENT: 'competence_assessments',
    CAPABILITY_CERTIFICATION: 'capability_certifications'
  };

  /* Single-id reference fields -> existing collections. */
  var SINGLE_REFS = {
    capability_id: 'capabilities',
    methodology_id: 'census_methodologies',
    research_project_id: 'research_projects',
    census_snapshot_id: 'census_snapshots',
    census_observation_id: 'census_observations',
    intervention_id: 'capability_interventions',
    pilot_project_id: 'pilot_projects',
    indicator_id: 'indicators'
  };

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
      entity: 'measurements',
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }

  var SUBSTANTIVE_KEYS = ['value', 'category_value', 'unit',
    'measurement_kind', 'basis', 'derivation', 'method',
    'capability_id', 'location_ids', 'observation_scope',
    'methodology_id', 'source_refs', 'research_project_id',
    'census_snapshot_id', 'census_observation_id', 'intervention_id',
    'pilot_project_id', 'indicator_id', 'analysis_role', 'observed_at',
    'period_start', 'period_end', 'notes', 'limitations',
    'supersedes_id'];

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

  function basisError(rec) {
    if (BASES.indexOf(rec.basis) === -1) {
      return { basis: 'Unknown basis (frozen vocabulary: ' +
        BASES.join(', ') + ').' };
    }
    if (rec.basis === 'UNKNOWN') {
      if (rec.value !== null && rec.value !== undefined) {
        return { value: 'An UNKNOWN measurement holds NO value ' +
          '(value must be null — unknown is never zero).' };
      }
      return {};
    }
    /* A known basis carries a value. */
    if (rec.measurement_kind === 'CATEGORICAL') {
      if (SCA.util.isBlank(rec.category_value)) {
        return { category_value: 'A categorical measurement requires ' +
          'its named category value.' };
      }
      if (rec.value !== null && rec.value !== undefined) {
        return { value: 'A categorical measurement carries a named ' +
          'value, never a number.' };
      }
    } else if (typeof rec.value !== 'number' ||
      isNaN(rec.value)) {
      return { value: 'A measurement with basis ' + rec.basis +
        ' requires a numeric value.' };
    }
    /* Zero requires an explicit factual basis (never UNKNOWN —
     * already excluded above; ESTIMATED zero is also not a factual
     * zero). */
    if (rec.value === 0 && rec.basis === 'ESTIMATED') {
      return { value: 'A zero requires an explicitly factual basis ' +
        '(OBSERVED or REPORTED); an estimate cannot state zero.' };
    }
    if (rec.value < 0) {
      return { value: 'Measured values are never negative.' };
    }
    /* ESTIMATED requires an approved methodology (census-derived)
     * or a documented method (non-census). */
    if (rec.basis === 'ESTIMATED') {
      if (rec.methodology_id) {
        var meth = SCA.store.get('census_methodologies',
          rec.methodology_id);
        if (!meth) {
          return { methodology_id: 'Unknown methodology record ' +
            rec.methodology_id + ' (methodologies are never ' +
            'silently created).' };
        }
        if (meth.status !== 'APPROVED' && meth.status !== 'ACTIVE') {
          return { methodology_id: 'An estimated value requires an ' +
            'APPROVED census methodology (current: ' + meth.status + ').' };
        }
        if (SCA.util.isBlank(rec.method)) {
          return { method: 'A census-derived estimate must document ' +
            'how the methodology produced this value.' };
        }
      } else if (SCA.util.isBlank(rec.method)) {
        return { method: 'An estimated value requires an approved ' +
          'methodology reference or a documented method.' };
      }
    }
    return {};
  }

  function kindError(rec) {
    if (KINDS.indexOf(rec.measurement_kind) === -1) {
      return { measurement_kind: 'Unknown measurement kind (frozen ' +
        'vocabulary: ' + KINDS.join(', ') + ').' };
    }
    var units = KIND_UNITS[rec.measurement_kind] || [];
    if (units.indexOf(rec.unit) === -1) {
      return { unit: 'Unit "' + rec.unit + '" is not valid for kind ' +
        rec.measurement_kind + ' (allowed: ' + units.join(', ') + ').' };
    }
    return {};
  }

  function derivationError(rec) {
    var d = rec.derivation || 'DIRECT';
    if (DERIVATIONS.indexOf(d) === -1) {
      return { derivation: 'Unknown derivation (DIRECT or ' +
        'GRAPH_DERIVED).' };
    }
    return {};
  }

  function refsError(rec) {
    var errors = {};
    Object.keys(SINGLE_REFS).forEach(function (field) {
      var id = rec[field];
      if (!id) { return; }
      /* The indicator reference is analytical INTENT (scope v1.1
       * §21) and still must resolve — a measurement never silently
       * creates an indicator. */
      var target = SCA.store.get(SINGLE_REFS[field], id);
      if (!target) {
        errors[field] = 'Unknown ' + SINGLE_REFS[field] +
          ' record: ' + id + ' (references are canonical and are ' +
          'never silently created).';
        return;
      }
      /* A census snapshot reference pins an IMMUTABLE Stage 6
       * artifact: only a PUBLISHED snapshot may be referenced (a
       * DRAFT snapshot can still change, and a measurement is
       * never pinned to something mutable). */
      if (field === 'census_snapshot_id' &&
        target.status !== 'PUBLISHED') {
        errors[field] = 'Only a PUBLISHED (immutable) census ' +
          'snapshot may be referenced (found status: ' +
          target.status + ').';
      }
    });
    (rec.location_ids || []).forEach(function (lid) {
      if (!SCA.store.get('locations', lid)) {
        errors.location_ids = 'Missing location: ' + lid;
      }
    });
    (rec.source_refs || []).forEach(function (s, i) {
      if (!s || !s.type || !s.id) {
        errors.source_refs = 'Each source reference needs a type and ' +
          'an id.';
        return;
      }
      var coll = SOURCE_TYPES[s.type];
      if (!coll) {
        errors.source_refs = 'Unknown source type "' + s.type +
          '" (controlled vocabulary only).';
        return;
      }
      if (!SCA.store.get(coll, s.id)) {
        errors.source_refs = 'Source reference does not resolve: ' +
          s.type + ' ' + s.id + ' (existing records only — never ' +
          'silently created, never duplicated).';
      }
    });
    if (rec.analysis_role &&
      ROLES.indexOf(rec.analysis_role) === -1) {
      errors.analysis_role = 'Unknown analysis role (NUMERATOR or ' +
        'DENOMINATOR).';
    }
    return errors;
  }

  function scopeError(rec) {
    if (SCA.util.isBlank(rec.observation_scope)) {
      return { observation_scope: 'Every measurement requires an ' +
        'explicit observation scope — the population, geographic ' +
        'area, sample or boundary actually observed. "Documented ' +
        'within a defined scope" never means "the total population".' };
    }
    return {};
  }

  function observedAtError(rec) {
    if (SCA.util.isBlank(rec.observed_at)) {
      return { observed_at: 'Every measurement requires an ' +
        'observation date or period anchor.' };
    }
    return {};
  }

  function supersessionError(rec) {
    if (!rec.supersedes_id) { return {}; }
    var orig = SCA.store.get('measurements', rec.supersedes_id);
    if (!orig) {
      return { supersedes_id: 'The measurement being corrected does ' +
        'not exist: ' + rec.supersedes_id };
    }
    if (orig.status !== 'ACCEPTED') {
      return { supersedes_id: 'Only an ACCEPTED measurement can be ' +
        'corrected through supersession (current: ' + orig.status +
        ').' };
    }
    return {};
  }

  function validateMeasurement(rec) {
    var errors = {};
    Object.assign(errors, scopeError(rec));
    Object.assign(errors, observedAtError(rec));
    Object.assign(errors, basisError(rec));
    Object.assign(errors, kindError(rec));
    Object.assign(errors, derivationError(rec));
    Object.assign(errors, refsError(rec));
    Object.assign(errors, supersessionError(rec));
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- creation & editing ---------- */

  function createMeasurement(user, data) {
    if (!can(user, 'measurement.create')) {
      return deny('measurement.create');
    }
    data = data || {};
    var rec = Object.assign({
      id: null,
      value: data.value === undefined ? null : data.value,
      category_value: data.category_value || null,
      unit: data.unit || null,
      measurement_kind: data.measurement_kind || null,
      basis: data.basis || null,
      derivation: data.derivation || 'DIRECT',
      method: data.method || '',
      capability_id: data.capability_id || null,
      location_ids: data.location_ids || [],
      observation_scope: data.observation_scope || '',
      methodology_id: data.methodology_id || null,
      source_refs: data.source_refs || [],
      research_project_id: data.research_project_id || null,
      census_snapshot_id: data.census_snapshot_id || null,
      census_observation_id: data.census_observation_id || null,
      intervention_id: data.intervention_id || null,
      pilot_project_id: data.pilot_project_id || null,
      indicator_id: data.indicator_id || null,
      analysis_role: data.analysis_role || null,
      observed_at: data.observed_at || null,
      period_start: data.period_start || null,
      period_end: data.period_end || null,
      status: 'DRAFT',
      supersedes_id: data.supersedes_id || null,
      superseded_by: null,
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      notes: data.notes || '',
      limitations: data.limitations || '',
      created_by: userName(user),
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.measurement.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateMeasurement(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var res = SCA.store.insert('measurements', rec);
    if (res.ok) {
      audited('measurement.created', res.record.id, user,
        { new_value: rec.basis + ' ' + rec.measurement_kind });
    }
    return res;
  }

  /* DRAFT: editable by its authorized CREATOR only (authorization
   * §7; the creator owns the draft at every role level including
   * NATIONAL — no role may edit someone else's draft). */
  function updateMeasurement(user, id, patch) {
    if (!can(user, 'measurement.update')) {
      return deny('measurement.update');
    }
    var r = SCA.store.get('measurements', id);
    if (!r) {
      return { ok: false, errors: { id: 'Measurement not found.' } };
    }
    if (r.status !== 'DRAFT') {
      return { ok: false, errors: {
        status: 'Only a DRAFT measurement is editable (current: ' +
        r.status + '). SUBMITTED and UNDER_REVIEW are locked; ' +
        'ACCEPTED, REJECTED and SUPERSEDED are terminal and ' +
        'immutable. A correction creates a new measurement.'
      } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the draft\'s creator may edit it ' +
        '(creator/authority separation applies at every role level).'
      } };
    }
    patch = patch || {};
    var immutable = ['id', 'created_at', 'created_by', 'status',
      'superseded_by', 'reviewer', 'reviewed_at', 'review_reason',
      'version', 'history'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.measurement.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateMeasurement(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    pushHistory(r, user, 'DRAFT edit', 'EDIT');
    next.version = r.version;
    next.updated_at = now();
    var res = SCA.store.update('measurements', id, next);
    if (res.ok) {
      audited('measurement.edited', id, user, {});
    }
    return res;
  }

  /* ---------- lifecycle ---------- */

  function transition(user, id, to, perm, opts) {
    opts = opts || {};
    if (!can(user, perm)) { return deny(perm); }
    var r = SCA.store.get('measurements', id);
    if (!r) {
      return { ok: false, errors: { id: 'Measurement not found.' } };
    }
    var allowed = TRANSITIONS[r.status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: {
        status: 'Status "' + r.status + '" cannot move to "' + to +
          '". Allowed: ' + (allowed.join(', ') || 'none (terminal).')
      } };
    }
    /* Reviewer separation (frozen §10, service-layer, every role
     * including NATIONAL). */
    if (to !== 'SUBMITTED' && r.created_by === userName(user)) {
      return { ok: false, errors: {
        creator: 'A creator cannot review their own measurement ' +
        '(creator/reviewer separation applies at every role level, ' +
        'including NATIONAL).'
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
    pushHistory(r, user, opts.reason || null, 'TRANSITION');
    r.status = to;
    r.updated_at = now();
    if (opts.reason) { r.review_reason = opts.reason; }
    if (opts.stamp) { opts.stamp(r); }
    var res = SCA.store.update('measurements', id, r);
    if (res.ok) {
      audited(opts.action, id, user, { old_value: from,
        new_value: to, reason: opts.reason || null });
    }
    /* Post-transition side effects (correction retirement) with
     * rollback so no partial state survives. */
    if (res.ok && opts.after) {
      var undo = opts.after(r);
      if (undo) { opts.rollback(r, undo); }
    }
    return res;
  }

  /* DRAFT -> SUBMITTED: the creator submits; the record locks. */
  function submitMeasurement(user, id) {
    if (!can(user, 'measurement.create')) {
      return deny('measurement.create');
    }
    var r = SCA.store.get('measurements', id);
    if (!r) {
      return { ok: false, errors: { id: 'Measurement not found.' } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the measurement\'s creator may submit it.'
      } };
    }
    return transition(user, id, 'SUBMITTED', 'measurement.create', {
      action: 'measurement.submitted'
    });
  }

  /* SUBMITTED -> UNDER_REVIEW: an authorized reviewer (never the
   * creator) begins the review. */
  function startReview(user, id) {
    return transition(user, id, 'UNDER_REVIEW', 'measurement.review', {
      action: 'measurement.review_started'
    });
  }

  /* UNDER_REVIEW -> ACCEPTED: an authorized reviewer (never the
   * creator) accepts. If this measurement is a CORRECTION
   * (supersedes_id), the original ACCEPTED record is retired to
   * SUPERSEDED — retire-first with rollback (established pattern):
   * the original's provenance and byte-exact history are preserved,
   * superseded_by records the successor. */
  function acceptMeasurement(user, id, reason) {
    var res = transition(user, id, 'ACCEPTED', 'measurement.review', {
      action: 'measurement.accepted',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Acceptance requires an explicit documented ' +
        'reason (a measurement is not an accepted fact merely ' +
        'because a number was entered).',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.reviewed_at = now();
      },
      after: function (r) {
        if (!r.supersedes_id) { return null; }
        var orig = SCA.store.get('measurements', r.supersedes_id);
        if (!orig || orig.status !== 'ACCEPTED') { return null; }
        var pre = JSON.parse(JSON.stringify(orig));
        pushHistory(orig, user, 'Superseded by correction ' + r.id,
          'SUPERSESSION');
        orig.status = 'SUPERSEDED';
        orig.superseded_by = r.id;
        orig.updated_at = now();
        var up = SCA.store.update('measurements', orig.id, orig);
        if (!up.ok) {
          return pre; /* rollback signal */
        }
        audited('measurement.superseded', orig.id, user, {
          old_value: 'ACCEPTED', new_value: 'SUPERSEDED',
          reason: 'Correction accepted: ' + r.id });
        return null;
      },
      rollback: function (r, preOriginal) {
        /* If retirement failed, undo the acceptance (no partial
         * state survives). */
        var me = SCA.store.get('measurements', r.id);
        if (me) {
          me.status = 'UNDER_REVIEW';
          me.reviewer = null;
          me.reviewed_at = null;
          if (me.history && me.history.length) {
            me.history.pop();
            me.version = String((parseInt(me.version, 10) || 1) - 1);
          }
          SCA.store.update('measurements', r.id, me);
        }
        if (preOriginal) {
          SCA.store.update('measurements', preOriginal.id, preOriginal);
        }
      }
    });
    return res;
  }

  /* UNDER_REVIEW -> REJECTED: terminal, immutable, reason required. */
  function rejectMeasurement(user, id, reason) {
    return transition(user, id, 'REJECTED', 'measurement.review', {
      action: 'measurement.rejected',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Rejection requires an explicit documented ' +
        'reason (terminal and audited).',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.reviewed_at = now();
      }
    });
  }

  /* Correction entry point (frozen §9): creates a NEW DRAFT
   * measurement that supersedes an ACCEPTED original. The original
   * is retired only when the correction is accepted; it is never
   * silently edited. */
  function createCorrection(user, originalId, data) {
    data = data || {};
    data.supersedes_id = originalId;
    var orig = SCA.store.get('measurements', originalId);
    if (!orig) {
      return { ok: false, errors: {
        id: 'The measurement to correct does not exist.' } };
    }
    return createMeasurement(user, data);
  }

  /* ---------- retrieval (privacy-aware) ---------- */

  function visibleStatuses(user) {
    var isAnon = !(user && user.role);
    return isAnon ? PUBLIC_STATUSES : STATUSES;
  }

  function list(user) {
    var allowed = visibleStatuses(user);
    return SCA.store.all('measurements').filter(function (r) {
      return allowed.indexOf(r.status) !== -1;
    });
  }

  function get(user, id) {
    var r = SCA.store.get('measurements', id);
    if (!r) { return { ok: false, errors: { id: 'Not found.' } }; }
    if (visibleStatuses(user).indexOf(r.status) === -1) {
      return { ok: false, errors: {
        permission: 'This measurement is not public (review ' +
        'workflow in progress).' } };
    }
    return { ok: true, record: r };
  }

  /* Small-count protection (Stage 6 privacy architecture, reused):
   * a small person-related count could identify individuals, so it
   * displays as Restricted to non-privileged viewers. Zero stays
   * zero (explicit factual basis) and UNKNOWN stays Unknown. */
  var PERSON_UNITS = ['PERSONS', 'HOUSEHOLDS', 'COMMUNITIES'];
  function threshold() {
    return (SCA.config.census &&
      SCA.config.census.privacy_threshold) || 3;
  }
  function privilegedViewer(user) {
    return !!(user && user.role &&
      ['regional_administrator', 'national_administrator']
        .indexOf(user.role) !== -1);
  }
  function displayValue(user, rec) {
    if (!rec) { return 'Unknown'; }
    if (rec.basis === 'UNKNOWN' ||
      (rec.value === null || rec.value === undefined)) {
      return 'Unknown';
    }
    if (PERSON_UNITS.indexOf(rec.unit) !== -1 &&
      rec.measurement_kind === 'COUNT' && rec.value > 0 &&
      rec.value < threshold() && !privilegedViewer(user)) {
      return 'Restricted';
    }
    return rec.value;
  }

  /* ---------- integrity (honest-data checker) ---------- */

  function integrity() {
    var issues = [];
    SCA.store.all('measurements').forEach(function (r) {
      if (SCA.util.isBlank(r.observation_scope)) {
        issues.push(r.id + ' has no observation scope');
      }
      if (r.basis === 'UNKNOWN' && r.value !== null &&
        r.value !== undefined) {
        issues.push(r.id + ' is UNKNOWN but carries a value');
      }
      if (r.basis !== 'UNKNOWN' && r.basis !== 'CATEGORICAL' &&
        typeof r.value !== 'number' && r.measurement_kind !==
        'CATEGORICAL') {
        issues.push(r.id + ' has no numeric value');
      }
    });
    return { ok: issues.length === 0, issues: issues };
  }

  /* Exported under SCA.measurement (singular domain namespace —
   * no second measurement system exists). */
  SCA.measurement = {
    createMeasurement: createMeasurement,
    createCorrection: createCorrection,
    updateMeasurement: updateMeasurement,
    submitMeasurement: submitMeasurement,
    startReview: startReview,
    acceptMeasurement: acceptMeasurement,
    rejectMeasurement: rejectMeasurement,
    list: list,
    get: get,
    displayValue: displayValue,
    integrity: integrity,
    STATUSES: STATUSES,
    TERMINAL: TERMINAL,
    PUBLIC_STATUSES: PUBLIC_STATUSES,
    BASES: BASES,
    KINDS: KINDS,
    KIND_UNITS: KIND_UNITS,
    SOURCE_TYPES: SOURCE_TYPES,
    TRANSITIONS: TRANSITIONS
  };
})(SCA);
