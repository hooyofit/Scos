/*
 * Census workflow (Stage 6): Capability Census & Regional Capability
 * Mapping Foundation.
 *
 * CENTRAL PRINCIPLE: «Unknown is information.»
 *   - unknown counts stay null (Unknown / not established), never 0
 *   - a region without data is "Not Surveyed", never "no capability"
 *   - "one documented practitioner" never becomes "only one exists"
 *
 * The census is a measurement exercise. It NEVER claims national truth,
 * never ranks regions or capabilities, never computes risk or
 * reproduction scores, and never touches evidence levels (Stage 3
 * remains the authority for E-levels) or competence (Stage 5 for L).
 */
(function (SCA) {
  'use strict';
  var COUNT_FIELDS = SCA.models.census_observations.countFields;

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function deny(perm) { return { ok: false, errors: { permission:
    perm + ' required.' } }; }

  function acceptedFor(censusId) {
    return SCA.store.all('census_observations').filter(function (o) {
      return o.census_id === censusId && o.review_status === 'ACCEPTED';
    });
  }

  function scopeCapabilities(census) {
    var caps = SCA.store.all('capabilities');
    if (census.capability_ids && census.capability_ids.length) {
      return caps.filter(function (c) {
        return census.capability_ids.indexOf(c.id) !== -1; });
    }
    if (census.family_ids && census.family_ids.length) {
      return caps.filter(function (c) {
        return census.family_ids.indexOf(c.family_id) !== -1; });
    }
    return caps; /* all capabilities in scope */
  }

  function scopeLocations(census) {
    if (!census.location_ids || !census.location_ids.length) { return null; }
    return census.location_ids.slice();
  }

  function inCapabilityScope(census, capabilityId) {
    var c = SCA.store.get('capabilities', capabilityId);
    if (!c) { return false; }
    if (census.capability_ids && census.capability_ids.length) {
      return census.capability_ids.indexOf(capabilityId) !== -1;
    }
    if (census.family_ids && census.family_ids.length) {
      return census.family_ids.indexOf(c.family_id) !== -1;
    }
    return true;
  }

  function inLocationScope(census, locationId) {
    var locs = scopeLocations(census);
    if (!locs) { return true; } /* scope: all locations */
    return locs.indexOf(locationId) !== -1;
  }

  /* ---------- count semantics ---------- */
  function validateCount(census, field, entry) {
    if (entry === undefined || entry === null) { return null; }
    if (typeof entry !== 'object' || Array.isArray(entry)) {
      return field + ' must be { value, basis }.';
    }
    var basis = entry.basis || 'UNKNOWN';
    if (SCA.enums.optionList(SCA.enums.count_bases).every(function (o) {
      return o.value !== basis; })) {
      return field + '.basis must be OBSERVED, ESTIMATED or UNKNOWN.';
    }
    if (basis === 'UNKNOWN') {
      if (entry.value !== null && entry.value !== undefined) {
        return field + ': Unknown counts must keep value null ' +
          '(never a silent zero).';
      }
      return null;
    }
    if (typeof entry.value !== 'number' || entry.value < 0) {
      return field + ': ' + basis + ' counts require a numeric value >= 0.';
    }
    if (basis === 'ESTIMATED') {
      var meth = census.methodology_id ?
        SCA.store.get('census_methodologies', census.methodology_id) : null;
      if (!meth || meth.status !== 'APPROVED') {
        return field + ': estimates require an approved census methodology.';
      }
      if (!meth.estimation_method) {
        return field + ': estimates require a methodology that documents ' +
          'its estimation method.';
      }
    }
    return null;
  }

  function displayCount(entry) {
    if (!entry) { return 'Unknown'; }
    if (entry.basis === 'UNKNOWN' || entry.value === null ||
      entry.value === undefined) { return 'Unknown'; }
    return String(entry.value) + (entry.basis === 'ESTIMATED' ? ' (estimated)' : '');
  }

  /* ---------- methodology ---------- */
  function createMethodology(user, rec) {
    if (!can(user, 'census.create')) { return deny('census.create'); }
    var r = Object.assign({}, rec);
    r.status = 'DRAFT';
    r.version = r.version || '1';
    r.provenance = r.provenance ||
      ('Entered by ' + userName(user) + ' (Stage 6 census methodology).');
    var res = SCA.store.insert('census_methodologies', r);
    if (!res.ok) { return res; }
    SCA.audit.log('census.methodology_created', { actor: userName(user),
      entity: 'census_methodologies', entity_id: res.record.id,
      entity_code: res.record.title, new_value: r.status, version: r.version });
    return res;
  }

  function approveMethodology(user, id, reason) {
    /* The methodology is the scientific instrument of the census:
       approval rests with the national administrator. */
    if (!can(user, 'census.approve') ||
      (user && user.role) !== 'national_administrator') {
      return deny('census.approve (national administrator)');
    }
    if (!reason) {
      return { ok: false, errors: { reason:
        'Methodology approval requires a documented reason.' } };
    }
    var m = SCA.store.get('census_methodologies', id);
    if (!m) { return { ok: false, errors: { id: 'Methodology not found.' } }; }
    if (m.status === 'RETIRED') {
      return { ok: false, errors: { status:
        'Retired methodology cannot be approved.' } };
    }
    var res = SCA.store.update('census_methodologies', id, {
      status: 'APPROVED', approved_by: userName(user),
      approval_reason: reason, approved_at: SCA.util.now() });
    if (!res.ok) { return res; }
    SCA.audit.log('census.methodology_approved', { actor: userName(user),
      entity: 'census_methodologies', entity_id: id, entity_code: m.title,
      old_value: m.status, new_value: 'APPROVED', reason: reason });
    return res;
  }

  /* ---------- census lifecycle ---------- */
  var CENSUS_TRANSITIONS = {
    DRAFT: ['APPROVED', 'ARCHIVED'],
    APPROVED: ['ACTIVE', 'ARCHIVED'],
    ACTIVE: ['PAUSED', 'COMPLETED', 'ARCHIVED'],
    PAUSED: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
    COMPLETED: ['ARCHIVED'],
    ARCHIVED: []
  };

  function createCensus(user, rec) {
    if (!can(user, 'census.create')) { return deny('census.create'); }
    var r = Object.assign({}, rec);
    r.status = 'DRAFT';
    r.version = r.version || '1';
    r.owner = r.owner || userName(user);
    var errs = {};
    (r.capability_ids || []).forEach(function (cid) {
      if (!SCA.store.get('capabilities', cid)) {
        errs.capability_ids = 'Census scope references unknown capabilities.'; }
    });
    (r.family_ids || []).forEach(function (fid) {
      if (!SCA.store.get('families', fid)) {
        errs.family_ids = 'Census scope references unknown families.'; }
    });
    (r.location_ids || []).forEach(function (lid) {
      if (!SCA.store.get('locations', lid)) {
        errs.location_ids = 'Census scope references unknown locations.'; }
    });
    if (r.methodology_id &&
      !SCA.store.get('census_methodologies', r.methodology_id)) {
      errs.methodology_id = 'Referenced methodology does not exist.';
    }
    if (Object.keys(errs).length) { return { ok: false, errors: errs }; }
    r.provenance = r.provenance ||
      ('Created by ' + userName(user) + ' (Stage 6 capability census).');
    var res = SCA.store.insert('capability_censuses', r);
    if (!res.ok) { return res; }
    SCA.audit.log('census.created', { actor: userName(user),
      entity: 'capability_censuses', entity_id: res.record.id,
      entity_code: res.record.title, new_value: r.status, version: r.version });
    return res;
  }

  function setCensusStatus(user, id, to, opts) {
    opts = opts || {};
    var c = SCA.store.get('capability_censuses', id);
    if (!c) { return { ok: false, errors: { id: 'Census not found.' } }; }
    var allowed = CENSUS_TRANSITIONS[c.status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: { status:
        'Census cannot move from ' + c.status + ' to ' + to + '.' } };
    }
    var patch = { status: to };
    if (to === 'APPROVED') {
      if (!can(user, 'census.approve')) { return deny('census.approve'); }
      /* National scope requires national authority. */
      if (c.scope_level === 'NATIONAL' &&
        (user && user.role) !== 'national_administrator') {
        return deny('census.approve (national administrator)');
      }
      if (!opts.reason) {
        return { ok: false, errors: { reason:
          'Census approval requires a documented reason.' } };
      }
      var meth = c.methodology_id ?
        SCA.store.get('census_methodologies', c.methodology_id) : null;
      if (!meth || meth.status !== 'APPROVED') {
        return { ok: false, errors: { methodology_id:
          'A census can only be approved with an approved methodology.' } };
      }
      patch.approved_by = userName(user);
      patch.approval_reason = opts.reason;
      patch.methodology_version = meth.version;
    } else if (to === 'ACTIVE') {
      if (!can(user, 'census.edit')) { return deny('census.edit'); }
      patch.start_date = c.start_date || SCA.util.now().slice(0, 10);
    } else if (to === 'COMPLETED') {
      if (!can(user, 'census.edit')) { return deny('census.edit'); }
      patch.end_date = opts.end_date || SCA.util.now().slice(0, 10);
    } else {
      if (!can(user, 'census.edit')) { return deny('census.edit'); }
    }
    var res = SCA.store.update('capability_censuses', id, patch);
    if (!res.ok) { return res; }
    SCA.audit.log('census.status', { actor: userName(user),
      entity: 'capability_censuses', entity_id: id, entity_code: c.title,
      old_value: c.status, new_value: to, reason: opts.reason || null });
    return res;
  }

  /* ---------- observations ---------- */
  function createObservation(user, rec) {
    if (!can(user, 'census.create')) { return deny('census.create'); }
    var r = Object.assign({}, rec);
    var c = SCA.store.get('capability_censuses', r.census_id);
    if (!c) { return { ok: false, errors: { census_id:
      'Observation requires an existing census.' } }; }
    if (c.status !== 'ACTIVE') {
      return { ok: false, errors: { census_id:
        'Observations can only be entered while the census is Active.' } };
    }
    if (!SCA.store.get('capabilities', r.capability_id)) {
      return { ok: false, errors: { capability_id:
        'Observation requires an existing capability.' } };
    }
    if (!inCapabilityScope(c, r.capability_id)) {
      return { ok: false, errors: { capability_id:
        'Capability is outside the census scope.' } };
    }
    if (!SCA.store.get('locations', r.location_id)) {
      return { ok: false, errors: { location_id:
        'Observation requires an existing location.' } };
    }
    if (!inLocationScope(c, r.location_id)) {
      return { ok: false, errors: { location_id:
        'Location is outside the census scope.' } };
    }
    var errs = {};
    (r.source_ids || []).forEach(function (sid) {
      if (!SCA.store.get('evidence', sid)) {
        errs.source_ids = 'Unknown evidence source referenced.'; }
    });
    (r.research_session_ids || []).forEach(function (sid) {
      if (!SCA.store.get('research_sessions', sid)) {
        errs.research_session_ids = 'Unknown research session referenced.'; }
    });
    (r.observation_ids || []).forEach(function (oid) {
      if (!SCA.store.get('observations', oid)) {
        errs.observation_ids = 'Unknown field observation referenced.'; }
    });
    (r.practitioner_ids || []).forEach(function (pid) {
      if (!SCA.store.get('practitioners', pid)) {
        errs.practitioner_ids = 'Unknown practitioner referenced.'; }
    });
    (r.organization_ids || []).forEach(function (oid) {
      if (!SCA.store.get('organizations', oid)) {
        errs.organization_ids = 'Unknown organization referenced.'; }
    });
    COUNT_FIELDS.forEach(function (f) {
      var err = validateCount(c, f, r[f]);
      if (err) { errs[f] = err; }
    });
    if (Object.keys(errs).length) { return { ok: false, errors: errs }; }

    COUNT_FIELDS.forEach(function (f) {
      if (r[f] === undefined) {
        r[f] = { value: null, basis: 'UNKNOWN' };
      } else if (r[f].value === undefined) {
        r[f].value = null;
      }
    });
    r.presence = r.presence || 'UNKNOWN';
    r.survey_status = r.survey_status || 'SURVEYED';
    r.review_status = 'PENDING';
    r.version = '1';
    r.provenance = r.provenance ||
      ('Measured in census "' + c.title + '" by ' + userName(user) +
        '. Counts document what the survey found, never that more ' +
        'practitioners do not exist.');
    var res = SCA.store.insert('census_observations', r);
    if (!res.ok) { return res; }
    SCA.audit.log('census.observation_created', { actor: userName(user),
      entity: 'census_observations', entity_id: res.record.id,
      entity_code: c.title + ' / ' + r.capability_id + ' / ' + r.location_id,
      new_value: r.survey_status, version: r.version });
    return res;
  }

  function reviewObservation(user, id, opts) {
    opts = opts || {};
    if (!can(user, 'census.review')) { return deny('census.review'); }
    var o = SCA.store.get('census_observations', id);
    if (!o) { return { ok: false, errors: { id: 'Observation not found.' } }; }
    if (o.review_status !== 'PENDING') {
      return { ok: false, errors: { review_status:
        'Only Pending observations can be reviewed. Superseded or already ' +
        'reviewed observations are history.' } };
    }
    var decision = (opts.decision === 'ACCEPTED' || opts.decision === 'REJECTED') ?
      opts.decision : null;
    if (!decision) {
      return { ok: false, errors: { decision:
        'Review decision must be ACCEPTED or REJECTED.' } };
    }
    if (decision === 'REJECTED' && !opts.reason) {
      return { ok: false, errors: { reason:
        'Rejecting an observation requires a documented reason.' } };
    }
    var res = SCA.store.update('census_observations', id, {
      review_status: decision, reviewer: userName(user),
      review_date: SCA.util.now(), review_reason: opts.reason || null });
    if (!res.ok) { return res; }
    SCA.audit.log('census.observation_reviewed', { actor: userName(user),
      entity: 'census_observations', entity_id: id,
      old_value: 'PENDING', new_value: decision, reason: opts.reason || null });
    return res;
  }

  /* Corrections never overwrite history: a new version supersedes the
     old record, which is preserved with review_status SUPERSEDED. */
  function correctObservation(user, id, changes, reason) {
    if (!can(user, 'census.edit')) { return deny('census.edit'); }
    if (!reason) {
      return { ok: false, errors: { reason:
        'Correcting an observation requires a documented reason.' } };
    }
    var old = SCA.store.get('census_observations', id);
    if (!old) { return { ok: false, errors: { id: 'Observation not found.' } }; }
    if (old.superseded_by_id) {
      return { ok: false, errors: { id:
        'This observation was already superseded. Correct the current one.' } };
    }
    var census = SCA.store.get('capability_censuses', old.census_id);
    if (!census || census.status !== 'ACTIVE') {
      return { ok: false, errors: { census_id:
        'Corrections are only possible while the census is Active.' } };
    }
    var next = Object.assign({}, old, changes);
    delete next.id; delete next.created_at; delete next.updated_at;
    delete next.review_status; delete next.reviewer;
    delete next.review_date; delete next.review_reason;
    delete next.supersedes_id; delete next.superseded_by_id;
    next.version = String(Number(old.version || '1') + 1);
    next.review_status = 'PENDING';
    next.supersedes_id = old.id;
    var errs = {};
    COUNT_FIELDS.forEach(function (f) {
      var err = validateCount(census, f, next[f]);
      if (err) { errs[f] = err; }
    });
    if (Object.keys(errs).length) { return { ok: false, errors: errs }; }
    next.provenance = (old.provenance || '') +
      ' Corrected (v' + next.version + ') by ' + userName(user) + ': ' + reason;
    var res = SCA.store.insert('census_observations', next);
    if (!res.ok) { return res; }
    var oldRes = SCA.store.update('census_observations', old.id, {
      review_status: 'SUPERSEDED', superseded_by_id: res.record.id });
    if (!oldRes.ok) { return oldRes; }
    SCA.audit.log('census.observation_correction', { actor: userName(user),
      entity: 'census_observations', entity_id: res.record.id,
      entity_code: 'v' + next.version + ' supersedes ' + old.id,
      old_value: 'v' + old.version, new_value: 'v' + next.version,
      reason: reason, version: next.version });
    SCA.audit.log('census.observation_superseded', { actor: userName(user),
      entity: 'census_observations', entity_id: old.id,
      new_value: 'SUPERSEDED', reason: reason });
    return res;
  }

  /* ---------- privacy ---------- */
  function privilegedViewer(user) {
    return !!(user && (can(user, 'census.review') || can(user, 'census.approve') ||
      can(user, 'census.aggregate') || can(user, 'census.snapshot')));
  }

  function threshold() {
    return (SCA.config.census && SCA.config.census.privacy_threshold) || 3;
  }

  /* Public aggregate protection: small counts could identify
     individuals in small communities, so they display as Restricted. */
  function protectCount(user, entry) {
    if (!entry || entry.basis === 'UNKNOWN' || entry.value === null) {
      return 'Unknown';
    }
    if (!privilegedViewer(user) && entry.value < threshold()) {
      return 'Restricted';
    }
    if (entry.basis === 'ESTIMATED') {
      return entry.value + ' (estimated)';
    }
    return entry.value;
  }

  /* ---------- measurement views ---------- */
  function coverageMeasurements(censusId) {
    var c = SCA.store.get('capability_censuses', censusId);
    if (!c) { return { ok: false, errors: { id: 'Census not found.' } }; }
    var scopeCaps = scopeCapabilities(c);
    var accepted = acceptedFor(censusId);
    var surveyedCaps = {};
    var withPractitioners = {};
    var withTrainers = {};
    accepted.forEach(function (o) {
      surveyedCaps[o.capability_id] = true;
      if (o.practitioner_count && o.practitioner_count.basis !== 'UNKNOWN' &&
        o.practitioner_count.value > 0) {
        withPractitioners[o.capability_id] = true; }
      if (o.trainer_count && o.trainer_count.basis !== 'UNKNOWN' &&
        o.trainer_count.value > 0) { withTrainers[o.capability_id] = true; }
    });
    var locScope = scopeLocations(c);
    var surveyedLocs = {};
    accepted.forEach(function (o) { surveyedLocs[o.location_id] = true; });
    return {
      ok: true,
      /* "X of Y" pairs - measurements, never scores, never percentages
         presented as truth about the whole country. */
      capabilities_in_scope: scopeCaps.length,
      capabilities_surveyed: Object.keys(surveyedCaps).length,
      capabilities_with_documented_practitioners:
        Object.keys(withPractitioners).length,
      capabilities_with_documented_trainers: Object.keys(withTrainers).length,
      locations_in_scope: locScope ? locScope.length
        : SCA.store.count('locations'),
      locations_surveyed: Object.keys(surveyedLocs).length,
      registry_practitioners_documented: SCA.store.all('practitioners')
        .filter(function (p) { return !p.merged_into_id; }).length
    };
  }

  function matrix(censusId, user) {
    var c = SCA.store.get('capability_censuses', censusId);
    if (!c) { return { ok: false, errors: { id: 'Census not found.' } }; }
    var accepted = acceptedFor(censusId);
    return {
      ok: true,
      census: c,
      rows: accepted.map(function (o) {
        var cap = SCA.store.get('capabilities', o.capability_id);
        var loc = SCA.store.get('locations', o.location_id);
        return {
          id: o.id,
          capability_code: cap ? cap.code : o.capability_id,
          capability_name: cap ? cap.name : o.capability_id,
          location_name: loc ? (loc.name || loc.region || o.location_id)
            : o.location_id,
          survey_status: o.survey_status,
          presence: o.presence,
          practitioners: protectCount(user, o.practitioner_count),
          trainers: protectCount(user, o.trainer_count),
          apprentices: protectCount(user, o.active_apprentice_count),
          evidence_status: o.evidence_status || 'E0'
        };
      })
    };
  }

  /* Data gaps tell researchers what to investigate next. This is a
     work list, never a risk ranking. */
  function gaps(censusId) {
    var c = SCA.store.get('capability_censuses', censusId);
    if (!c) { return { ok: false, errors: { id: 'Census not found.' } }; }
    var scopeCaps = scopeCapabilities(c);
    var accepted = acceptedFor(censusId);
    var cells = {};
    accepted.forEach(function (o) {
      cells[o.capability_id + '|' + o.location_id] = o; });
    var locScope = scopeLocations(c) ||
      SCA.store.all('locations').map(function (l) { return l.id; });
    var out = [];
    scopeCaps.forEach(function (cap) {
      locScope.forEach(function (lid) {
        if (!cells[cap.id + '|' + lid]) {
          out.push({ type: 'NOT_SURVEYED', capability_id: cap.id,
            location_id: lid,
            message: cap.code + ' at this location: Not surveyed ' +
              '(no data is not absence).' });
        }
      });
    });
    scopeCaps.forEach(function (cap) {
      var capObs = accepted.filter(function (o) {
        return o.capability_id === cap.id; });
      var pr = capObs.some(function (o) {
        return o.practitioner_count && o.practitioner_count.basis !== 'UNKNOWN' &&
          o.practitioner_count.value > 0; });
      var tr = capObs.some(function (o) {
        return o.trainer_count && o.trainer_count.basis !== 'UNKNOWN' &&
          o.trainer_count.value > 0; });
      if (!capObs.length) {
        out.push({ type: 'CAPABILITY_NOT_SURVEYED', capability_id: cap.id,
          message: cap.code + ': no census observation exists yet.' });
      }
      if (capObs.length && !pr) {
        out.push({ type: 'PRACTITIONER_UNKNOWN', capability_id: cap.id,
          message: cap.code + ': practitioner presence not established.' });
      }
      if (capObs.length && !tr) {
        out.push({ type: 'TRAINER_UNKNOWN', capability_id: cap.id,
          message: cap.code + ': trainer presence not established.' });
      }
    });
    SCA.store.all('census_observations').forEach(function (o) {
      if (o.census_id === censusId && o.review_status === 'PENDING') {
        out.push({ type: 'VERIFICATION_PENDING', capability_id: o.capability_id,
          observation_id: o.id,
          message: 'Observation pending review (not yet census data).' });
      }
    });
    out.sort(function (a, b) {
      return String(a.capability_id).localeCompare(String(b.capability_id)) ||
        a.type.localeCompare(b.type); });
    return { ok: true, gaps: out, note:
      'A work list for researchers, not a risk ranking.' };
  }

  /* ---------- snapshots ---------- */
  function sumKnown(observations, field) {
    var sum = 0; var unknown = false;
    observations.forEach(function (o) {
      var e = o[field];
      if (!e || e.basis === 'UNKNOWN' || e.value === null) { unknown = true; }
      else { sum += e.value; }
    });
    return { sum: sum, unknown: unknown };
  }

  function generateSnapshot(user, censusId, label) {
    if (!can(user, 'census.snapshot')) { return deny('census.snapshot'); }
    var c = SCA.store.get('capability_censuses', censusId);
    if (!c) { return { ok: false, errors: { id: 'Census not found.' } }; }
    var accepted = acceptedFor(censusId);
    var scopeCaps = scopeCapabilities(c);
    var surveyedCaps = {};
    var surveyedLocs = {};
    var unknownFields = [];
    accepted.forEach(function (o) {
      surveyedCaps[o.capability_id] = true;
      surveyedLocs[o.location_id] = true; });

    function sumField(field, name) {
      var r = sumKnown(accepted, field);
      if (r.unknown) {
        unknownFields.push(name + ' (at least ' + r.sum +
          '; some surveyed cells are Unknown, never counted as zero)'); }
      return r.sum;
    }

    var knowledgeCount = SCA.store.all('knowledge').filter(function (k) {
      var ids = k.capability_ids && k.capability_ids.length ?
        k.capability_ids : (k.capability_id ? [k.capability_id] : []);
      var capIds = scopeCaps.map(function (x) { return x.id; });
      return ids.some(function (id) { return capIds.indexOf(id) !== -1; });
    }).length;

    var rec = {
      census_id: censusId,
      label: label || ('Census snapshot ' + SCA.util.now()),
      generated_at: SCA.util.now(),
      methodology_version: c.methodology_version || null,
      capabilities_in_scope: scopeCaps.length,
      capabilities_surveyed: Object.keys(surveyedCaps).length,
      capabilities_not_surveyed: scopeCaps.length -
        Object.keys(surveyedCaps).length,
      locations_in_scope: scopeLocations(c) ? scopeLocations(c).length
        : SCA.store.count('locations'),
      locations_surveyed: Object.keys(surveyedLocs).length,
      practitioners_documented: sumField('practitioner_count',
        'practitioners_documented'),
      trainers_documented: sumField('trainer_count', 'trainers_documented'),
      apprentices_documented: sumField('active_apprentice_count',
        'apprentices_documented'),
      workshops_documented: sumField('workshop_count', 'workshops_documented'),
      institutions_documented: sumField('institution_count',
        'institutions_documented'),
      practitioners_referenced: (function () {
        var ids = {};
        accepted.forEach(function (o) {
          (o.practitioner_ids || []).forEach(function (pid) {
            ids[pid] = true; }); });
        return Object.keys(ids).length; })(),
      evidence_sources: (function () {
        var ids = {};
        accepted.forEach(function (o) {
          (o.source_ids || []).forEach(function (sid) { ids[sid] = true; }); });
        return Object.keys(ids).length; })(),
      knowledge_artifacts: knowledgeCount,
      unknown_fields: unknownFields,
      status: 'DRAFT',
      version: '1',
      provenance: 'Generated from accepted observations of census "' + c.title +
        '" by ' + userName(user) + '. Unknown cells are preserved as Unknown.'
    };
    var res = SCA.store.insert('census_snapshots', rec);
    if (!res.ok) { return res; }

    /* Raw geographic redundancy measurements per capability in scope -
       measurements only, never a resilience score. */
    var locScope = scopeLocations(c);
    scopeCaps.forEach(function (cap) {
      var capObs = accepted.filter(function (o) {
        return o.capability_id === cap.id; });
      var locs = {}; var verified = {}; var trainers = {};
      var apps = {}; var orgs = {};
      capObs.forEach(function (o) {
        locs[o.location_id] = true;
        if (o.survey_status === 'VERIFIED') { verified[o.location_id] = true; }
        if (o.trainer_count && o.trainer_count.basis !== 'UNKNOWN' &&
          o.trainer_count.value > 0) { trainers[o.location_id] = true; }
        if (o.active_apprentice_count &&
          o.active_apprentice_count.basis !== 'UNKNOWN' &&
          o.active_apprentice_count.value > 0) { apps[o.location_id] = true; }
        (o.organization_ids || []).forEach(function (oid) {
          orgs[o.location_id] = true; });
      });
      SCA.store.insert('geographic_redundancies', {
        capability_id: cap.id,
        snapshot_id: res.record.id,
        surveyed_location_count: Object.keys(locs).length,
        documented_location_count: Object.keys(locs).length,
        verified_location_count: Object.keys(verified).length,
        trainer_location_count: Object.keys(trainers).length,
        apprentice_location_count: Object.keys(apps).length,
        organization_location_count: Object.keys(orgs).length,
        methodology_version: c.methodology_version || null,
        provenance: 'Raw geographic redundancy measurement for snapshot ' +
          res.record.id + '. Not a resilience score.'
      });
    });

    SCA.audit.log('census.snapshot_generated', { actor: userName(user),
      entity: 'census_snapshots', entity_id: res.record.id,
      entity_code: c.title, new_value: 'DRAFT', version: '1' });
    return res;
  }

  function publishSnapshot(user, id) {
    if (!can(user, 'census.snapshot')) { return deny('census.snapshot'); }
    var s = SCA.store.get('census_snapshots', id);
    if (!s) { return { ok: false, errors: { id: 'Snapshot not found.' } }; }
    if (s.status !== 'DRAFT') {
      return { ok: false, errors: { status:
        'Only Draft snapshots can be published; published snapshots are ' +
        'immutable history.' } };
    }
    var res = SCA.store.update('census_snapshots', id, {
      status: 'PUBLISHED', published_at: SCA.util.now(),
      published_by: userName(user) });
    if (!res.ok) { return res; }
    SCA.audit.log('census.snapshot_published', { actor: userName(user),
      entity: 'census_snapshots', entity_id: id,
      old_value: 'DRAFT', new_value: 'PUBLISHED' });
    return res;
  }

  function deleteDraftSnapshot(user, id) {
    if (!can(user, 'census.snapshot')) { return deny('census.snapshot'); }
    var s = SCA.store.get('census_snapshots', id);
    if (!s) { return { ok: false, errors: { id: 'Snapshot not found.' } }; }
    if (s.status !== 'DRAFT') {
      return { ok: false, errors: { status:
        'Published snapshots are immutable history and cannot be deleted.' } };
    }
    SCA.store.all('geographic_redundancies').forEach(function (g) {
      if (g.snapshot_id === id) { SCA.store.remove('geographic_redundancies', g.id); }
    });
    SCA.store.remove('census_snapshots', id);
    SCA.audit.log('census.snapshot_discarded', { actor: userName(user),
      entity: 'census_snapshots', entity_id: id,
      new_value: 'DELETED (was DRAFT)' });
    return { ok: true };
  }

  /* ---------- deduplication (never silent merges) ---------- */
  function flagPossibleDuplicate(user, idA, idB, reason) {
    if (!can(user, 'census.merge')) { return deny('census.merge'); }
    if (!reason) {
      return { ok: false, errors: { reason:
        'Flagging requires a documented reason.' } };
    }
    var a = SCA.store.get('practitioners', idA);
    var b = SCA.store.get('practitioners', idB);
    if (!a || !b) {
      return { ok: false, errors: { id: 'Both practitioners must exist.' } };
    }
    if (a.id === b.id) {
      return { ok: false, errors: { id:
        'A record cannot be a duplicate of itself.' } };
    }
    function flag(rec, other) {
      var flags = (rec.duplicate_flags || []).concat([{
        other_id: other.id, status: 'POSSIBLE', reason: reason,
        flagged_by: userName(user), date: SCA.util.now() }]);
      return SCA.store.update('practitioners', rec.id, { duplicate_flags: flags });
    }
    var ra = flag(a, b); var rb = flag(b, a);
    if (!ra.ok) { return ra; }
    if (!rb.ok) { return rb; }
    SCA.audit.log('census.duplicate_flagged', { actor: userName(user),
      entity: 'practitioners', entity_id: a.id,
      new_value: 'POSSIBLE duplicate of ' + b.id, reason: reason });
    return { ok: true };
  }

  /* Merge/reconciliation by authorized reviewer. Never automatic, never
     name-based-only: requires an explicit documented decision. */
  function mergePractitioners(user, keepId, mergeId, reason) {
    if (!can(user, 'census.merge')) { return deny('census.merge'); }
    if (!reason) {
      return { ok: false, errors: { reason:
        'Merging requires a documented reason.' } };
    }
    var keep = SCA.store.get('practitioners', keepId);
    var merge = SCA.store.get('practitioners', mergeId);
    if (!keep || !merge) {
      return { ok: false, errors: { id: 'Both practitioners must exist.' } };
    }
    if (keep.id === merge.id) {
      return { ok: false, errors: { id: 'A record cannot merge into itself.' } };
    }
    if (merge.merged_into_id) {
      return { ok: false, errors: { id:
        'This record is already merged into ' + merge.merged_into_id + '.' } };
    }
    /* Reassign every reference to the kept stable ID - this is what
       prevents double counting. */
    SCA.store.all('competence_assessments').forEach(function (x) {
      if (x.practitioner_id === mergeId) {
        SCA.store.update('competence_assessments', x.id, { practitioner_id: keepId }); }
    });
    SCA.store.all('capability_certifications').forEach(function (x) {
      if (x.practitioner_id === mergeId) {
        SCA.store.update('capability_certifications', x.id,
          { practitioner_id: keepId }); }
    });
    SCA.store.all('apprenticeships').forEach(function (x) {
      if (x.mentor_id === mergeId) {
        SCA.store.update('apprenticeships', x.id, { mentor_id: keepId }); }
    });
    SCA.store.all('apprentices').forEach(function (x) {
      if ((x.mentor_ids || []).indexOf(mergeId) !== -1) {
        SCA.store.update('apprentices', x.id, { mentor_ids:
          (x.mentor_ids || []).map(function (m) {
            return m === mergeId ? keepId : m; }) }); }
      if (x.mentor_id === mergeId) {
        SCA.store.update('apprentices', x.id, { mentor_id: keepId }); }
    });
    var capIds = (keep.capability_ids || []).concat(merge.capability_ids || [])
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    var res = SCA.store.update('practitioners', keepId, {
      capability_ids: capIds,
      provenance: (keep.provenance || '') + ' Merged record ' + mergeId +
        ' (' + merge.public_name + ') into this record by ' + userName(user) +
        ': ' + reason });
    if (!res.ok) { return res; }
    var mres = SCA.store.update('practitioners', mergeId, {
      merged_into_id: keepId,
      provenance: (merge.provenance || '') + ' Merged into ' + keepId +
        ' by ' + userName(user) + ': ' + reason +
        '. Preserved for history; excluded from counts.' });
    if (!mres.ok) { return mres; }
    SCA.audit.log('census.practitioner_merged', { actor: userName(user),
      entity: 'practitioners', entity_id: keepId,
      old_value: mergeId + ' (' + merge.public_name + ')',
      new_value: keepId, reason: reason });
    return { ok: true, kept: keepId, merged: mergeId };
  }

  /* ---------- regional profile (only real data) ---------- */
  function regionalProfile(user, locationId) {
    var loc = SCA.store.get('locations', locationId);
    if (!loc) { return { ok: false, errors: { id: 'Location not found.' } }; }
    var accepted = SCA.store.all('census_observations').filter(function (o) {
      return o.location_id === locationId && o.review_status === 'ACCEPTED'; });
    var capIds = {};
    accepted.forEach(function (o) { capIds[o.capability_id] = true; });
    var practitioners = SCA.store.all('practitioners').filter(function (p) {
      return !p.merged_into_id &&
        (p.region_ids || []).indexOf(locationId) !== -1; });
    var orgs = SCA.store.all('organizations').filter(function (o) {
      return (o.region_ids || []).indexOf(locationId) !== -1; });
    var mentoredShips = SCA.store.all('apprenticeships').filter(function (s) {
      return practitioners.some(function (p) { return p.id === s.mentor_id; }); });
    var knowledgeHere = SCA.store.all('knowledge').filter(function (k) {
      var ids = k.capability_ids && k.capability_ids.length ?
        k.capability_ids : (k.capability_id ? [k.capability_id] : []);
      return ids.some(function (id) { return capIds[id]; }); });
    return {
      ok: true,
      location: loc,
      capabilities_documented: Object.keys(capIds).length,
      observations: accepted.length,
      survey_status: accepted.length ?
        (accepted.every(function (o) { return o.survey_status === 'VERIFIED'; })
          ? 'VERIFIED' : 'SURVEYED') : 'NOT_SURVEYED',
      practitioners: privilegedViewer(user) ?
        practitioners.map(function (p) {
          return { public_name: p.public_name,
            anonymous: !!p.anonymous_option }; }) : null,
      practitioner_count: practitioners.length >= threshold() ||
        privilegedViewer(user) ? practitioners.length : 'Restricted',
      organizations: orgs.map(function (o) { return o.name; }),
      active_apprenticeships: mentoredShips.filter(function (s) {
        return s.status === 'ACTIVE'; }).length,
      completed_apprenticeships: mentoredShips.filter(function (s) {
        return s.status === 'COMPLETED'; }).length,
      knowledge_artifacts: knowledgeHere.length,
      note: 'Only documented Atlas data. Everything not entered ' +
        'remains Unknown, not zero.'
    };
  }

  /* ---------- map-ready data layer (no external provider) ---------- */
  function mapData(user) {
    var locs = SCA.store.all('locations');
    var acceptedByLoc = {};
    SCA.store.all('census_observations').forEach(function (o) {
      if (o.review_status !== 'ACCEPTED') { return; }
      acceptedByLoc[o.location_id] = (acceptedByLoc[o.location_id] || 0) + 1; });
    return {
      ok: true,
      /* Offline, provider-independent: coordinates are optional and
         precise practitioner locations are never exposed. */
      locations: locs.map(function (l) {
        return {
          id: l.id, name: l.name || l.region || l.id,
          type: l.location_type || null, parent_id: l.parent_id || null,
          coordinates: (typeof l.latitude === 'number' &&
            typeof l.longitude === 'number') ?
            [l.longitude, l.latitude] : null,
          documented_observations: acceptedByLoc[l.id] || 0,
          survey: acceptedByLoc[l.id] ? 'SURVEYED' : 'NOT_SURVEYED'
        };
      }),
      capability_count: SCA.store.count('capabilities'),
      public_practitioner_count: (function () {
        var n = SCA.store.all('practitioners').filter(function (p) {
          return !p.merged_into_id && !p.anonymous_option &&
            p.contact_visibility === 'PUBLIC'; }).length;
        return n >= threshold() ? n : (n ? 'Restricted' : 0); })(),
      organization_count: SCA.store.count('organizations')
    };
  }

  /* ---------- national overview (honest about what is missing) ---------- */
  function nationalOverview(user) {
    var caps = SCA.store.all('capabilities');
    var documentedCaps = {};
    ['claims', 'knowledge'].forEach(function (coll) {
      SCA.store.all(coll).forEach(function (x) {
        var ids = x.capability_ids && x.capability_ids.length ?
          x.capability_ids : (x.capability_id ? [x.capability_id] : []);
        ids.forEach(function (id) { documentedCaps[id] = true; }); });
    });
    SCA.store.all('practitioners').forEach(function (p) {
      if (p.merged_into_id) { return; }
      (p.capability_ids || p.capabilities || []).forEach(function (id) {
        documentedCaps[id] = true; }); });
    var eLevels = {};
    caps.forEach(function (c) {
      eLevels[c.evidence_level] = (eLevels[c.evidence_level] || 0) + 1; });
    var surveyedLocs = {};
    SCA.store.all('census_observations').forEach(function (o) {
      if (o.review_status === 'ACCEPTED') { surveyedLocs[o.location_id] = true; } });
    return {
      ok: true,
      disclaimer: 'National data is incomplete. This view represents only ' +
        'documented Atlas data and must not be interpreted as a complete ' +
        'national census.',
      total_capabilities: caps.length,
      documented_capabilities: Object.keys(documentedCaps).length,
      documented_practitioners: SCA.store.all('practitioners').filter(
        function (p) { return !p.merged_into_id; }).length,
      locations_in_atlas: SCA.store.count('locations'),
      locations_with_census_data: Object.keys(surveyedLocs).length,
      evidence_distribution: eLevels,
      no_rankings_note: 'The Atlas does not rank regions or capabilities.'
    };
  }

  SCA.census = {
    createCensus: createCensus,
    setCensusStatus: setCensusStatus,
    createMethodology: createMethodology,
    approveMethodology: approveMethodology,
    createObservation: createObservation,
    reviewObservation: reviewObservation,
    correctObservation: correctObservation,
    coverageMeasurements: coverageMeasurements,
    matrix: matrix,
    gaps: gaps,
    generateSnapshot: generateSnapshot,
    publishSnapshot: publishSnapshot,
    deleteDraftSnapshot: deleteDraftSnapshot,
    flagPossibleDuplicate: flagPossibleDuplicate,
    mergePractitioners: mergePractitioners,
    regionalProfile: regionalProfile,
    mapData: mapData,
    nationalOverview: nationalOverview,
    scopeCapabilities: scopeCapabilities,
    acceptedFor: acceptedFor,
    displayCount: displayCount,
    protectCount: protectCount
  };
})(SCA);
