/*
 * Indicator workflow + dynamic computation engine (Stage 12, frozen
 * scope v1.1 + implementation authorization v1.0).
 *
 * ARCHITECTURAL RULES (frozen):
 *  - An Indicator is a DEFINITION (a reproducible analytical
 *    specification). It is NOT a stored result. NO IndicatorValue
 *    entity exists.
 *  - Values are computed DYNAMICALLY from ACCEPTED measurements
 *    (scope v1.1 §20): read-only, deterministic, version-pinned,
 *    reproducible. Computed values NEVER write back into any
 *    record — Measurement, Indicator, Capability, Census,
 *    Intervention, Pilot or Graph.
 *  - Versioning (§19): a definition is IMMUTABLE once APPROVED. A
 *    formula change creates a NEW VERSION (a new record with the
 *    same code and an incremented indicator_version). Older
 *    versions remain preserved; historical computation is pinned
 *    to the definition version applicable to the queried period.
 *    Approving a newer version retires the previous one
 *    (retire-first with rollback, the established pattern).
 *  - Reviewer separation (§21/§22): the creator of an indicator
 *    definition/version NEVER approves it — enforced at the service
 *    layer at every role level including national_administrator.
 *  - "indicator.update" means creating a new version, NEVER the
 *    mutation of an approved formula (authorization §28).
 *  - Only measurements with status ACCEPTED enter computation
 *    (DRAFT/SUBMITTED/UNDER_REVIEW never; REJECTED/SUPERSEDED
 *    never — frozen §8).
 *  - Computation is UNKNOWN-aware: no accepted measurements in
 *    scope -> UNKNOWN with an honest explanation — NEVER zero and
 *    never a fabricated value. Ratio computation requires BOTH a
 *    numerator and a denominator.
 *  - Every computed value carries its definition identity,
 *    version, unit, the count basis, the scopes/bases of its
 *    inputs, and the definition's interpretation notes and
 *    limitations — a number is never presented without its
 *    methodological context.
 *  - No composite score, no ranking, no league table, no priority.
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED',
    'SUPERSEDED'];
  var TERMINAL = ['APPROVED', 'REJECTED', 'SUPERSEDED'];
  var PUBLIC_STATUSES = ['APPROVED', 'SUPERSEDED'];

  /* Frozen transition table. APPROVED -> SUPERSEDED happens ONLY
   * when a newer version of the same code is approved (retire-first
   * with rollback). */
  var TRANSITIONS = {
    DRAFT: ['PENDING_REVIEW'],
    PENDING_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['SUPERSEDED'],
    REJECTED: [],
    SUPERSEDED: []
  };

  var CATEGORIES = ['HUMAN_CAPABILITY', 'KNOWLEDGE', 'REPAIR',
    'RESILIENCE', 'REPRODUCTION', 'SYSTEMS'];
  var FREQUENCIES = ['PER_CENSUS', 'PER_PROJECT', 'ANNUAL',
    'CONTINUOUS', 'AD_HOC'];
  var METHODS = ['LATEST', 'SUM', 'MEAN', 'RATIO'];
  var ROLES = ['NUMERATOR', 'DENOMINATOR'];

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
      entity: 'indicators',
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }

  /* ---------- validation ---------- */

  function validateIndicator(rec) {
    var errors = {};
    if (SCA.util.isBlank(rec.code)) {
      errors.code = 'An indicator requires a stable code.';
    }
    if (SCA.util.isBlank(rec.name)) {
      errors.name = 'An indicator requires a name.';
    }
    if (STATUSES.indexOf(rec.status) === -1) {
      errors.status = 'Unknown status.';
    }
    if (CATEGORIES.indexOf(rec.category) === -1) {
      errors.category = 'Unknown category (frozen vocabulary: ' +
        CATEGORIES.join(', ') + ').';
    }
    if (FREQUENCIES.indexOf(rec.frequency) === -1) {
      errors.frequency = 'Unknown frequency (frozen vocabulary: ' +
        FREQUENCIES.join(', ') + ').';
    }
    if (SCA.util.isBlank(rec.definition)) {
      errors.definition = 'An indicator requires a formal definition.';
    }
    if (SCA.util.isBlank(rec.required_measurements)) {
      errors.required_measurements = 'An indicator must define its ' +
        'required measurement inputs.';
    }
    var spec = rec.calc_spec || {};
    if (METHODS.indexOf(spec.method) === -1) {
      errors.calc_spec = 'A calculation method is required (frozen ' +
        'vocabulary: ' + METHODS.join(', ') + ').';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- creation & versioning ---------- */

  function nextVersionOf(code) {
    var versions = SCA.store.all('indicators').filter(function (i) {
      return i.code === code;
    });
    var max = 0;
    versions.forEach(function (i) {
      max = Math.max(max, i.indicator_version || 1);
    });
    return max + 1;
  }

  function approvedVersion(code) {
    var approved = SCA.store.all('indicators').filter(function (i) {
      return i.code === code && i.status === 'APPROVED';
    });
    return approved.length ? approved[0] : null;
  }

  /* Create a NEW definition (v1 of a code) — DRAFT until reviewed. */
  function createIndicator(user, data) {
    if (!can(user, 'indicator.create')) { return deny('indicator.create'); }
    data = data || {};
    if (SCA.util.isBlank(data.code)) {
      return { ok: false, errors: { code: 'A code is required.' } };
    }
    if (SCA.store.all('indicators').some(function (i) {
      return i.code === data.code && i.indicator_version === 1;
    })) {
      return { ok: false, errors: {
        code: 'An indicator with code ' + data.code +
        ' already exists. A formula change creates a NEW VERSION ' +
        '(createIndicatorVersion), never a duplicate v1.' } };
    }
    return insertVersion(user, data, 1, null);
  }

  /* Create the NEXT version of an existing code (frozen §19: a
   * formula change is a new immutable version; the approved
   * previous version is never mutated). */
  function createIndicatorVersion(user, code, data) {
    if (!can(user, 'indicator.update')) { return deny('indicator.update'); }
    var existing = SCA.store.all('indicators').filter(function (i) {
      return i.code === code;
    });
    if (!existing.length) {
      return { ok: false, errors: {
        code: 'No indicator with code ' + code + ' exists (create ' +
        'the definition first).' } };
    }
    var prev = approvedVersion(code);
    var version = nextVersionOf(code);
    data = Object.assign({}, data, { code: code });
    return insertVersion(user, data, version,
      prev ? prev.id : null);
  }

  function insertVersion(user, data, version, supersedesVersionId) {
    var rec = Object.assign({
      id: null,
      code: data.code,
      name: data.name || '',
      description: data.description || '',
      definition: data.definition || '',
      calculation_method: data.calculation_method ||
        (data.calc_spec && data.calc_spec.method) || '',
      required_measurements: data.required_measurements || '',
      category: data.category || null,
      scope: data.scope || '',
      frequency: data.frequency || null,
      interpretation_notes: data.interpretation_notes || '',
      limitations: data.limitations || '',
      calc_spec: data.calc_spec || null,
      indicator_version: version,
      supersedes_version_id: supersedesVersionId,
      superseded_by: null,
      status: 'DRAFT',
      provenance: data.provenance || '',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      created_by: userName(user),
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.indicator.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateIndicator(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var res = SCA.store.insert('indicators', rec);
    if (res.ok) {
      audited('indicator.version_created', res.record.id, user, {
        new_value: rec.code + ' v' + version });
    }
    return res;
  }

  /* DRAFT definition: editable by its creator only (an approved
   * definition is immutable — §19). */
  function updateIndicator(user, id, patch) {
    if (!can(user, 'indicator.update')) { return deny('indicator.update'); }
    var r = SCA.store.get('indicators', id);
    if (!r) {
      return { ok: false, errors: { id: 'Indicator not found.' } };
    }
    if (r.status !== 'DRAFT') {
      return { ok: false, errors: {
        status: 'Only a DRAFT definition is editable (current: ' +
        r.status + '). An APPROVED definition is immutable — a ' +
        'formula change creates a NEW VERSION.' } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the definition\'s creator may edit the draft.' } };
    }
    patch = patch || {};
    var immutable = ['id', 'code', 'created_at', 'created_by', 'status',
      'indicator_version', 'supersedes_version_id', 'superseded_by',
      'reviewer', 'reviewed_at', 'review_reason', 'version', 'history'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.indicator.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateIndicator(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    next.updated_at = now();
    var res = SCA.store.update('indicators', id, next);
    if (res.ok) {
      audited('indicator.edited', id, user, {});
    }
    return res;
  }

  /* ---------- review ---------- */

  function submitIndicator(user, id) {
    if (!can(user, 'indicator.create') &&
      !can(user, 'indicator.update')) {
      return deny('indicator.update');
    }
    var r = SCA.store.get('indicators', id);
    if (!r) {
      return { ok: false, errors: { id: 'Indicator not found.' } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the definition\'s creator may submit it.' } };
    }
    if (r.status !== 'DRAFT') {
      return { ok: false, errors: {
        status: 'Only a DRAFT definition can be submitted (current: ' +
        r.status + ').' } };
    }
    return doTransition(user, id, 'PENDING_REVIEW',
      'indicator.update', { action: 'indicator.submitted' });
  }

  function approveIndicator(user, id, reason) {
    var res = doTransition(user, id, 'APPROVED', 'indicator.review', {
      action: 'indicator.approved',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Approval of an indicator definition requires ' +
        'an explicit documented reason.',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.reviewed_at = now();
      },
      after: function (r) {
        /* Retire-first: approving this version supersedes the
         * previously APPROVED version of the same code (it remains
         * preserved for historical, version-pinned computation). */
        var others = SCA.store.all('indicators').filter(function (i) {
          return i.code === r.code && i.status === 'APPROVED' &&
            i.id !== r.id;
        });
        var rolled = [];
        others.forEach(function (prev) {
          var pre = JSON.parse(JSON.stringify(prev));
          prev.status = 'SUPERSEDED';
          prev.superseded_by = r.id;
          prev.updated_at = now();
          if (SCA.store.update('indicators', prev.id, prev).ok) {
            audited('indicator.superseded', prev.id, user, {
              old_value: 'APPROVED', new_value: 'SUPERSEDED',
              reason: 'New approved version: ' + r.code + ' v' +
                r.indicator_version });
          } else {
            rolled.push(pre);
          }
        });
        return rolled.length ? rolled : null;
      },
      rollback: function (r, pres) {
        /* If retirement failed, undo the approval (no partial
         * state survives). */
        var me = SCA.store.get('indicators', r.id);
        if (me) {
          me.status = 'PENDING_REVIEW';
          me.reviewer = null;
          me.reviewed_at = null;
          SCA.store.update('indicators', r.id, me);
        }
        (pres || []).forEach(function (pre) {
          SCA.store.update('indicators', pre.id, pre);
        });
      }
    });
    return res;
  }

  function rejectIndicator(user, id, reason) {
    return doTransition(user, id, 'REJECTED', 'indicator.review', {
      action: 'indicator.rejected',
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

  function doTransition(user, id, to, perm, opts) {
    opts = opts || {};
    if (!can(user, perm)) { return deny(perm); }
    var r = SCA.store.get('indicators', id);
    if (!r) {
      return { ok: false, errors: { id: 'Indicator not found.' } };
    }
    var allowed = TRANSITIONS[r.status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: {
        status: 'Status "' + r.status + '" cannot move to "' + to +
          '". Allowed: ' + (allowed.join(', ') || 'none (terminal).')
      } };
    }
    /* Reviewer separation (frozen §21/§22, service-layer, every
     * role including NATIONAL). */
    if (to !== 'PENDING_REVIEW' &&
      r.created_by === userName(user)) {
      return { ok: false, errors: {
        creator: 'A creator cannot review or approve their own ' +
        'indicator definition (creator/reviewer separation applies ' +
        'at every role level, including NATIONAL).' } };
    }
    if (opts.requireReason && SCA.util.isBlank(opts.reason)) {
      return { ok: false, errors: {
        reason: opts.reasonMessage } };
    }
    var from = r.status;
    r.status = to;
    r.updated_at = now();
    if (opts.reason) { r.review_reason = opts.reason; }
    if (opts.stamp) { opts.stamp(r); }
    var res = SCA.store.update('indicators', id, r);
    if (res.ok) {
      audited(opts.action, id, user, { old_value: from,
        new_value: to, reason: opts.reason || null });
    }
    if (res.ok && opts.after) {
      var undo = opts.after(r);
      if (undo) { opts.rollback(r, undo); }
    }
    return res;
  }

  /* ---------- dynamic computation (read-only views) ---------- */

  /* Accepted measurements ONLY (frozen §8). REJECTED and
   * SUPERSEDED never enter computation; drafts never enter. */
  function acceptedInputs(indicatorRecords, opts) {
    opts = opts || {};
    var codes = {};
    indicatorRecords.forEach(function (i) { codes[i.code] = true; });
    var ids = {};
    indicatorRecords.forEach(function (i) { ids[i.id] = true; });
    return SCA.store.all('measurements').filter(function (m) {
      if (m.status !== 'ACCEPTED') { return false; }
      if (!m.indicator_id || !ids[m.indicator_id]) { return false; }
      if (opts.period) {
        if (opts.period.from && m.observed_at &&
          m.observed_at < opts.period.from) { return false; }
        if (opts.period.to && m.observed_at &&
          m.observed_at > opts.period.to) { return false; }
      }
      if (opts.capability_id && m.capability_id !== opts.capability_id) {
        return false;
      }
      if (opts.location_ids && opts.location_ids.length) {
        var overlap = (m.location_ids || []).some(function (lid) {
          return opts.location_ids.indexOf(lid) !== -1;
        });
        if (!overlap) { return false; }
      }
      return true;
    });
  }

  /* Version resolution (frozen §19 + authorization §18): the
   * default is the currently APPROVED version; a historical query
   * pins the version EXPLICITLY. Computing never mutates anything. */
  function resolveVersion(codeOrId, version) {
    var rec = null;
    if (version !== undefined && version !== null) {
      rec = SCA.store.all('indicators').filter(function (i) {
        return (i.code === codeOrId || i.id === codeOrId) &&
          i.indicator_version === version;
      })[0] || null;
    } else {
      rec = approvedVersion(codeOrId) ||
        (SCA.store.get('indicators', codeOrId) || null);
      if (rec && rec.status !== 'APPROVED') {
        rec = SCA.store.all('indicators').filter(function (i) {
          return i.code === rec.code && i.status === 'APPROVED';
        })[0] || rec;
      }
    }
    return rec;
  }

  function numInputs(records) {
    return records.filter(function (m) {
      return typeof m.value === 'number';
    });
  }

  function aggregate(method, records) {
    var nums = numInputs(records);
    if (!nums.length) {
      return { value: null, count: 0 };
    }
    if (method === 'SUM') {
      var sum = 0;
      nums.forEach(function (m) { sum += m.value; });
      return { value: sum, count: nums.length };
    }
    if (method === 'MEAN') {
      var total = 0;
      nums.forEach(function (m) { total += m.value; });
      return { value: total / nums.length, count: nums.length };
    }
    /* LATEST */
    var sorted = nums.slice().sort(function (a, b) {
      return String(b.observed_at).localeCompare(
        String(a.observed_at));
    });
    return { value: sorted[0].value, count: nums.length };
  }

  /* The honest computation result. Value is null with an explicit
   * reason when the inputs do not exist — never zero, never
   * fabricated. Every result exposes its definition version, unit,
   * count basis, scopes and limitations. Read-only by construction:
   * nothing is persisted, and the caller's store is never touched. */
  function compute(codeOrId, opts) {
    opts = opts || {};
    var version = opts.version !== undefined ? opts.version : null;
    var def = resolveVersion(codeOrId, version);
    if (!def) {
      return { ok: false, errors: {
        code: 'No indicator definition found for "' + codeOrId +
          '".' } };
    }
    var spec = def.calc_spec || { method: 'LATEST' };
    var sameCode = SCA.store.all('indicators').filter(function (i) {
      return i.code === def.code;
    });
    var inputs = acceptedInputs(sameCode, opts);

    var result = {
      ok: true,
      /* A computed indicator value is a VIEW: it is never persisted
       * and never a score. */
      indicator: def.code,
      indicator_name: def.name,
      version: def.indicator_version,
      definition_id: def.id,
      method: spec.method,
      category: def.category,
      known: false,
      value: null,
      unit: null,
      input_count: inputs.length,
      bases: {},
      scopes: [],
      bases_note: '',
      interpretation_notes: def.interpretation_notes,
      limitations: def.limitations,
      reason: null
    };

    function basesOf(records) {
      var bases = {};
      records.forEach(function (m) {
        bases[m.basis] = (bases[m.basis] || 0) + 1;
      });
      return bases;
    }
    function scopesOf(records) {
      var seen = {};
      records.forEach(function (m) {
        seen[m.observation_scope] = true;
      });
      return Object.keys(seen);
    }

    if (spec.method === 'RATIO') {
      var num = inputs.filter(function (m) {
        return m.analysis_role === 'NUMERATOR';
      });
      var den = inputs.filter(function (m) {
        return m.analysis_role === 'DENOMINATOR';
      });
      result.bases = Object.assign(basesOf(num), basesOf(den));
      result.scopes = scopesOf(num.concat(den));
      var numAgg = aggregate('SUM', num);
      var denAgg = aggregate('SUM', den);
      if (!numAgg.count || !denAgg.count) {
        result.reason = numAgg.count ?
          'No accepted DENOMINATOR measurements exist for this ' +
          'indicator in the queried scope — the ratio is UNKNOWN ' +
          '(never zero).' :
          'No accepted NUMERATOR measurements exist for this ' +
          'indicator in the queried scope — the ratio is UNKNOWN ' +
          '(never zero).';
        return result;
      }
      if (denAgg.value === 0) {
        result.reason = 'The accepted denominator is zero — the ' +
          'ratio is undefined rather than fabricated.';
        return result;
      }
      result.known = true;
      result.value = numAgg.value / denAgg.value;
      result.unit = 'RATIO';
      result.bases_note = 'Ratio of accepted measurements: ' +
        numAgg.value + ' / ' + denAgg.value + ' (' +
        numAgg.count + ' numerator, ' + denAgg.count +
        ' denominator measurements).';
      return result;
    }

    /* LATEST / SUM / MEAN over the unit-homogeneous inputs. Mixed
     * units are never silently combined. */
    var units = {};
    inputs.forEach(function (m) { units[m.unit] = true; });
    var unitKeys = Object.keys(units);
    if (unitKeys.length > 1) {
      result.reason = 'Accepted measurements with mixed units (' +
        unitKeys.join(', ') + ') are never silently combined — ' +
        'the value is UNKNOWN until methodologically resolved.';
      result.bases = basesOf(inputs);
      result.scopes = scopesOf(inputs);
      return result;
    }
    result.bases = basesOf(inputs);
    result.scopes = scopesOf(inputs);
    var agg = aggregate(spec.method, inputs);
    if (!agg.count) {
      result.reason = 'No accepted measurements exist for this ' +
        'indicator in the queried scope and period — the value is ' +
        'UNKNOWN (never zero: absence of data is not a zero ' +
        'measurement).';
      return result;
    }
    result.known = true;
    result.value = agg.value;
    result.unit = unitKeys[0];
    result.bases_note = 'Based on ' + agg.count + ' accepted ' +
      'measurement(s) (' + spec.method + '), each within its own ' +
      'documented observation scope.';
    return result;
  }

  /* ---------- seed (authorized vocabulary only) ---------- */

  /* Seeds the 23 FROZEN indicator definitions when the collection
   * is empty (production baseline: zero measurements, definitions
   * only — authorization §34). Two distinct seed identities keep
   * creator/reviewer separation honest even at seed time. */
  function seedDefinitions() {
    if (SCA.store.count('indicators') > 0) { return false; }
    var seed = (typeof SCA_indicators_seed !== 'undefined') ?
      SCA_indicators_seed : null;
    if (!seed || !seed.indicators) {
      throw new Error('Indicator seed vocabulary missing.');
    }
    var author = { name: seed.seeded_by };
    var reviewer = { name: seed.reviewed_by };
    seed.indicators.forEach(function (d) {
      /* Deterministic seed id (the Stage 4 fam-/cap-<code>
       * convention): a wipe->init->importBundle round-trip is
       * idempotent for the definition vocabulary, and a full-bundle
       * restore maps onto the same records instead of spawning
       * duplicates. */
      var rec = Object.assign({
        id: 'ind-' + d.code + '-v1',
        calculation_method: d.method,
        calc_spec: d.spec,
        indicator_version: 1,
        supersedes_version_id: null,
        superseded_by: null,
        status: 'APPROVED',
        provenance: 'FROZEN Stage 12 scope v1.1 §18 authorized ' +
          'vocabulary — seeded as an APPROVED definition. This is ' +
          'a DEFINITION, not a measurement value; the production ' +
          'baseline contains zero measurements.',
        reviewer: seed.reviewed_by,
        reviewed_at: now(),
        review_reason: 'Authorized Stage 12 seed vocabulary.',
        created_by: seed.seeded_by,
        created_at: now(),
        updated_at: now(),
        version: '1',
        history: []
      }, d, { method: undefined, spec: undefined });
      delete rec.method;
      delete rec.spec;
      var v = SCA.models.indicator.validate(rec);
      if (!v.valid) {
        throw new Error('Seed indicator invalid: ' + d.code + ' — ' +
          JSON.stringify(v.errors));
      }
      var res = SCA.store.insert('indicators', rec);
      if (!res.ok) {
        throw new Error('Seed indicator insert failed: ' + d.code);
      }
      SCA.audit.log('indicator.version_created', {
        actor: seed.seeded_by, entity: 'indicators',
        entity_id: res.record.id,
        new_value: d.code + ' v1 (authorized seed)' });
      SCA.audit.log('indicator.approved', {
        actor: seed.reviewed_by, entity: 'indicators',
        entity_id: res.record.id,
        new_value: 'APPROVED',
        reason: 'Authorized Stage 12 seed vocabulary.' });
    });
    return true;
  }

  /* ---------- retrieval ---------- */

  function list(user) {
    var isAnon = !(user && user.role);
    var allowed = isAnon ? PUBLIC_STATUSES : STATUSES;
    return SCA.store.all('indicators').filter(function (i) {
      return allowed.indexOf(i.status) !== -1;
    });
  }

  function get(user, id) {
    var r = SCA.store.get('indicators', id);
    if (!r) { return { ok: false, errors: { id: 'Not found.' } }; }
    var isAnon = !(user && user.role);
    if (isAnon && PUBLIC_STATUSES.indexOf(r.status) === -1) {
      return { ok: false, errors: {
        permission: 'This indicator definition is not public.' } };
    }
    return { ok: true, record: r };
  }

  SCA.indicator = {
    createIndicator: createIndicator,
    createIndicatorVersion: createIndicatorVersion,
    updateIndicator: updateIndicator,
    submitIndicator: submitIndicator,
    approveIndicator: approveIndicator,
    rejectIndicator: rejectIndicator,
    compute: compute,
    seedDefinitions: seedDefinitions,
    list: list,
    get: get,
    approvedVersion: approvedVersion,
    STATUSES: STATUSES,
    TERMINAL: TERMINAL,
    PUBLIC_STATUSES: PUBLIC_STATUSES,
    TRANSITIONS: TRANSITIONS,
    CATEGORIES: CATEGORIES,
    FREQUENCIES: FREQUENCIES,
    METHODS: METHODS
  };
})(SCA);
