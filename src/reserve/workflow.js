/*
 * Stage 14 workflow: National Capability Reserve & Institutional
 * Continuity (frozen scope v1.1 + Gate C implementation
 * authorization).
 *
 * OWNERSHIP (authorization §2/§22): Stage 14 owns EXACTLY the
 * reserve/continuity/asset records and their presentation. It
 * CONSUMES the frozen authorities: capabilities (1/2), evidence and
 * knowledge (3), practitioners/apprentices/training (5), census
 * (6), the 19-type graph (7), repair/workshops/tools/materials/
 * spare parts (8), recovery profiles (9), interventions (10),
 * pilots (11), measurements/indicators (12) and marketplace
 * listings (13). It duplicates none of them and mutates none of
 * their lifecycles (authorization §23: NO automatic coupling).
 *
 * LIFECYCLE (frozen §6/§9/§10):
 *   Reserve:  DRAFT -> SUBMITTED -> VERIFIED -> ACTIVE <-> SUSPENDED
 *             plus SUBMITTED -> REJECTED, ACTIVE/SUSPENDED -> RETIRED.
 *             REJECTED/RETIRED terminal, immutable, no resurrection.
 *             VERIFIED = definition passed review.
 *             ACTIVE   = definition passed review AND a documented
 *                        custodian resolves (frozen decision 3).
 *             There is no reserve.activate/suspend/resume permission:
 *             transitions run under the five frozen permissions with
 *             service-layer authority checks (never UI-only).
 *   Plan:     DRAFT -> SUBMITTED -> REVIEWED -> ACTIVE
 *             plus SUBMITTED -> REJECTED, ACTIVE -> RETIRED.
 *             No SUSPENDED state; lifecycles are INDEPENDENT
 *             (frozen §11) — a suspended reserve never mutates a
 *             plan; the UI displays the reserve's state honestly.
 *
 * PROVENANCE (authorization §24, permanent): every non-DRAFT state
 * carries legitimate provenance — actors resolve against the local
 * roster, permissions are checked, creator/reviewer separation holds
 * at every role level INCLUDING NATIONAL, and reason/timestamp
 * fields are validated. A string is never authority.
 *
 * DERIVED VIEWS (frozen §14-§21): the One-Person Test, the
 * Three-Generation Test, the National Capability Battery and the
 * Capability Spine are DERIVED READ-ONLY views. Nothing is persisted,
 * scored, ranked or predicted. "One practitioner is currently
 * documented within the available evidence/census scope" — never
 * "only one practitioner exists" (Stage 6 census semantics).
 */
(function (SCA) {
  'use strict';

  /* ---------- frozen vocabularies ---------- */

  var STATUSES = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'ACTIVE',
    'SUSPENDED', 'REJECTED', 'RETIRED'];
  var TERMINAL = ['REJECTED', 'RETIRED'];
  var TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['VERIFIED', 'REJECTED'],
    VERIFIED: ['ACTIVE'],
    ACTIVE: ['SUSPENDED', 'RETIRED'],
    SUSPENDED: ['ACTIVE', 'RETIRED'],
    REJECTED: [],
    RETIRED: []
  };
  var PLAN_STATUSES = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'ACTIVE',
    'REJECTED', 'RETIRED'];
  var PLAN_TERMINAL = ['REJECTED', 'RETIRED'];
  var PLAN_TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['REVIEWED', 'REJECTED'],
    REVIEWED: ['ACTIVE'],
    ACTIVE: ['RETIRED'],
    REJECTED: [],
    RETIRED: []
  };
  var RESERVE_TYPES = ['HUMAN_RESERVE', 'KNOWLEDGE_RESERVE',
    'TECHNICAL_RESERVE', 'MATERIAL_RESERVE', 'BIOLOGICAL_RESERVE',
    'INSTITUTIONAL_RESERVE', 'GEOGRAPHIC_RESERVE',
    'FALLBACK_RESERVE'];
  var SCENARIOS = ['IMPORTS_UNAVAILABLE_6_MONTHS',
    'ELECTRICITY_UNAVAILABLE_72_HOURS', 'INTERNET_UNAVAILABLE_30_DAYS',
    'FUEL_UNAVAILABLE', 'EXTERNAL_TECHNICIANS_UNAVAILABLE',
    'CRITICAL_KNOWLEDGE_HOLDER_UNAVAILABLE'];
  var GAPS = ['NO_TRAINER', 'NO_APPRENTICE', 'SINGLE_KNOWLEDGE_HOLDER',
    'NO_DOCUMENTATION', 'NO_LOCAL_REPAIR', 'NO_SPARE_PART',
    'NO_FALLBACK', 'SINGLE_LOCATION',
    'EXTERNAL_TECHNICIAN_DEPENDENCY',
    'EXTERNAL_MATERIAL_DEPENDENCY', 'ENERGY_DEPENDENCY',
    'INSTITUTIONAL_GAP', 'UNKNOWN'];
  var ASSET_CATEGORIES = ['HUMAN', 'KNOWLEDGE', 'TOOL', 'EQUIPMENT',
    'MATERIAL', 'SPARE_PART', 'DOCUMENTATION', 'TRAINING', 'WORKSHOP',
    'INSTITUTION', 'BIOLOGICAL', 'ENERGY', 'FALLBACK_CAPABILITY'];
  var THREE_GEN = ['NOT_DOCUMENTED', 'PRACTITIONER_ONLY',
    'TRAINER_PRESENT', 'APPRENTICE_PRESENT', 'COMPETENT_SUCCESSOR',
    'TRAINER_SUCCESSOR', 'REPRODUCTION_DOCUMENTED'];

  /* ---------- shared machinery ---------- */

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function userRole(user) { return (user && user.role) || 'anon'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function now() { return SCA.util.now(); }
  function isBlank(v) {
    return v === undefined || v === null ||
      !String(v).replace(/^\s+|\s+$/g, '').length;
  }
  function audited(action, entity, id, user, opts) {
    opts = opts || {};
    return SCA.audit.log(action, {
      actor: userName(user),
      entity: entity,
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }
  function get(collection, id) { return SCA.store.get(collection, id); }
  function exists(collection, id) {
    return !!get(collection, id);
  }

  /* ---------- structural pins ---------- */

  function forbiddenFieldError(model, data) {
    var errors = {};
    (Object.keys(data || {})).forEach(function (k) {
      if (model.FORBIDDEN_FIELDS.indexOf(k) !== -1) {
        errors[k] = 'A Stage 14 record can never carry the field "' +
          k + '" (structural boundary pin, authorization §3/§37).';
      }
      if (model.CONTACT_FIELDS_PROHIBITED.indexOf(k) !== -1) {
        errors[k] = 'A Stage 14 record can never carry the contact ' +
          'field "' + k + '" (structural privacy pin, §28).';
      }
    });
    return errors;
  }

  /* ---------- validation: reserves ---------- */

  function vocabError(list, values, field, label) {
    var errors = {};
    (values || []).forEach(function (v) {
      if (list.indexOf(v) === -1) {
        errors[field] = 'Unknown ' + label + ' value: ' + v +
          ' (frozen vocabulary).';
      }
    });
    return errors;
  }
  function refsResolve(errors, ids, collection, label) {
    (ids || []).forEach(function (id) {
      if (!exists(collection, id)) {
        errors[label] = 'Unknown ' + collection + ' record: ' + id +
          ' (Stage 14 references are canonical and never create the ' +
          'referenced record).';
      }
    });
  }
  function orgRefError(errors, id, field, label) {
    if (id === undefined || id === null || id === '') { return; }
    if (!exists('organizations', id)) {
      errors[field] = 'Unknown organization record: ' + id +
        ' (a ' + label + ' must resolve to an authoritative existing ' +
        'organization; a populated field never implies the role is ' +
        'staffed).';
    }
  }
  function reserveErrors(data) {
    var errors = {};
    if (isBlank(data.name)) {
      errors.name = 'A reserve requires a name.';
    }
    Object.assign(errors, vocabError(RESERVE_TYPES, data.reserve_types,
      'reserve_types', 'reserve type'));
    Object.assign(errors, vocabError(GAPS, data.known_gaps,
      'known_gaps', 'known-gap'));
    refsResolve(errors, data.capability_ids, 'capabilities',
      'capability_ids');
    refsResolve(errors, data.fallback_capability_ids, 'capabilities',
      'fallback_capability_ids');
    refsResolve(errors, data.location_ids, 'locations',
      'location_ids');
    refsResolve(errors, data.recovery_profile_ids, 'recovery_profiles',
      'recovery_profile_ids');
    refsResolve(errors, data.training_program_ids, 'training_programs',
      'training_program_ids');
    refsResolve(errors, data.workshop_ids, 'workshops',
      'workshop_ids');
    refsResolve(errors, data.practitioner_refs, 'practitioners',
      'practitioner_refs');
    /* documentation_refs / evidence_refs are free-form citation
     * strings by project convention (Stage 9/13 pattern); hard id
     * references above are the canonical ones. */
    orgRefError(errors, data.owner_organization_id,
      'owner_organization_id', 'reserve owner');
    orgRefError(errors, data.custodian_organization_id,
      'custodian_organization_id', 'reserve custodian');
    orgRefError(errors, data.successor_custodian_organization_id,
      'successor_custodian_organization_id', 'successor custodian');
    orgRefError(errors, data.secondary_custodian_organization_id,
      'secondary_custodian_organization_id', 'secondary custodian');
    return errors;
  }

  function transitionError(from, to, statuses, transitions, label) {
    if (statuses.indexOf(to) === -1) {
      return 'Unknown ' + label + ' status: ' + to;
    }
    if ((transitions[from] || []).indexOf(to) === -1) {
      return 'Invalid transition ' + from + ' -> ' + to + ' (frozen ' +
        label + ' lifecycle).';
    }
    return null;
  }

  /* The custodian rule (frozen §1 decision 3 / authorization §8):
   * ACTIVE means a documented custodian RESOLVES to an
   * authoritative existing organization. VERIFIED deliberately does
   * NOT require it. */
  function custodianError(rec) {
    if (isBlank(rec.custodian_organization_id)) {
      return 'A reserve cannot become ACTIVE without an identified ' +
        'custodian (frozen decision 3: VERIFIED = definition passed ' +
        'review; ACTIVE = documented steward + formally maintained).';
    }
    if (!exists('organizations', rec.custodian_organization_id)) {
      return 'The custodian reference does not resolve to an ' +
        'authoritative existing organization: ' +
        rec.custodian_organization_id;
    }
    return null;
  }

  /* Reviewer separation at EVERY role level including NATIONAL
   * (authorization §7): the creator is never their own reviewer.
   * Defense in depth: role alone is not authority either. */
  function separationError(user, rec, label) {
    if (userName(user) === rec.created_by) {
      return 'The creator of a ' + label + ' cannot review it ' +
        '(creator/reviewer separation holds at every role level ' +
        'including NATIONAL).';
    }
    return null;
  }

  function transitionReserve(user, id, to, perm, opts) {
    opts = opts || {};
    var rec = get('capability_reserves', id);
    if (!rec) {
      return { ok: false, errors: { id: 'Unknown reserve: ' + id } };
    }
    if (!can(user, perm)) { return deny(perm); }
    var tErr = transitionError(rec.status, to, STATUSES, TRANSITIONS,
      'reserve');
    if (tErr) { return { ok: false, errors: { status: tErr } }; }
    if (opts.creatorOnly && userName(user) !== rec.created_by) {
      return { ok: false, errors: { permission: 'Only the reserve ' +
        'creator may perform this transition (creator-only frozen ' +
        'workflow).' } };
    }
    if (opts.separation) {
      var sErr = separationError(user, rec, 'reserve');
      if (sErr) { return { ok: false, errors: { reviewer: sErr } }; }
    }
    if (opts.reasonRequired && isBlank(opts.reason)) {
      return { ok: false, errors: { reason: 'A documented reason is ' +
        'required for ' + rec.status + ' -> ' + to + '.' } };
    }
    if (to === 'ACTIVE') {
      var cErr = custodianError(rec);
      if (cErr) { return { ok: false, errors: { custodian: cErr } }; }
    }
    var oldStatus = rec.status;
    /* Only FROZEN field-model stamps are written (authorization
     * §4/§9): review, rejection and retirement provenance.
     * Submission, activation and suspension provenance lives in
     * the audit log and the record history — never in fields the
     * frozen model does not define. */
    rec.status = to;
    if (to === 'VERIFIED' || to === 'REJECTED') {
      rec.review_status = to;
      rec.reviewer = userName(user);
      rec.reviewed_at = now();
      rec.review_reason = opts.reason || null;
    }
    if (to === 'REJECTED') {
      rec.rejection_reason = opts.reason || null;
      rec.rejected_by = userName(user);
      rec.rejected_at = now();
    }
    if (to === 'RETIRED') {
      rec.retirement_reason = opts.reason || null;
      rec.retired_by = userName(user);
      rec.retired_at = now();
    }
    pushHistory(rec, user, opts.reason, 'TRANSITION');
    audited('reserve.' + to.toLowerCase(), 'capability_reserves', id,
      user, { old_value: oldStatus, new_value: to,
        reason: opts.reason || null });
    SCA.store.update('capability_reserves', id, { history: rec.history });
    return { ok: true, record: rec };
  }

  var SUBSTANTIVE = ['name', 'description', 'continuity_scope',
    'activation_conditions', 'stewardship_notes', 'safety_notes',
    'reserve_types', 'capability_ids', 'fallback_capability_ids',
    'location_ids', 'owner_organization_id',
    'custodian_organization_id',
    'successor_custodian_organization_id',
    'secondary_custodian_organization_id', 'recovery_profile_ids',
    'training_program_ids', 'workshop_ids', 'documentation_refs',
    'evidence_refs', 'practitioner_refs', 'known_gaps'];
  function pushHistory(rec, user, reason, changeType) {
    rec.history = rec.history || [];
    var snap = { status: rec.status };
    SUBSTANTIVE.forEach(function (k) {
      snap[k] = rec[k] === undefined ? null :
        JSON.parse(JSON.stringify(rec[k]));
    });
    rec.history.push({
      version: rec.version || 1,
      changed_at: now(),
      changed_by: userName(user),
      change_type: changeType || 'TRANSITION',
      reason: reason || null,
      status: rec.status,
      snapshot: snap
    });
    rec.version = String((parseInt(rec.version, 10) || 1) + 1);
  }

  /* ---------- reserve workflow ---------- */

  function createReserve(user, data) {
    if (!can(user, 'reserve.create')) { return deny('reserve.create'); }
    data = data || {};
    var errors = forbiddenFieldError(SCA.models.capabilityReserve, data);
    Object.assign(errors, reserveErrors(data));
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    var id = 'res-' + (data.id ||
      String(SCA.store.count('capability_reserves') + 1) + '-' +
      now().replace(/[^0-9]/g, '').slice(-8));
    var rec = {
      id: id, status: 'DRAFT',
      name: data.name, description: data.description || null,
      continuity_scope: data.continuity_scope || null,
      activation_conditions: data.activation_conditions || null,
      reserve_types: data.reserve_types || [],
      capability_ids: data.capability_ids || [],
      fallback_capability_ids: data.fallback_capability_ids || [],
      location_ids: data.location_ids || [],
      owner_organization_id: data.owner_organization_id || null,
      custodian_organization_id: data.custodian_organization_id ||
        null,
      successor_custodian_organization_id:
        data.successor_custodian_organization_id || null,
      secondary_custodian_organization_id:
        data.secondary_custodian_organization_id || null,
      recovery_profile_ids: data.recovery_profile_ids || [],
      training_program_ids: data.training_program_ids || [],
      workshop_ids: data.workshop_ids || [],
      documentation_refs: data.documentation_refs || [],
      evidence_refs: data.evidence_refs || [],
      practitioner_refs: data.practitioner_refs || [],
      known_gaps: data.known_gaps || [],
      stewardship_notes: data.stewardship_notes || null,
      safety_notes: data.safety_notes || null,
      review_status: null,
      created_by: userName(user),
      created_at: now(), updated_at: now(), version: '1',
      history: []
    };
    /* Model validation runs on the CONSTRUCTED record (status is
     * provided by the workflow, never by the caller). */
    var v = SCA.models.capabilityReserve.validate(rec);
    if (Object.keys(v.errors || {}).length) {
      return { ok: false, errors: v.errors };
    }
    SCA.store.insert('capability_reserves', rec);
    audited('reserve.created', 'capability_reserves', id, user,
      { new_value: 'DRAFT' });
    return { ok: true, record: rec };
  }

  function updateReserve(user, id, data) {
    var rec = get('capability_reserves', id);
    if (!rec) {
      return { ok: false, errors: { id: 'Unknown reserve: ' + id } };
    }
    if (!can(user, 'reserve.update')) { return deny('reserve.update'); }
    if (userName(user) !== rec.created_by) {
      return { ok: false, errors: { permission: 'Only the reserve ' +
        'creator may edit a draft reserve.' } };
    }
    if (rec.status !== 'DRAFT') {
      return { ok: false, errors: { status: 'Only a DRAFT reserve ' +
        'is editable (SUBMITTED is locked pending review).' } };
    }
    var merged = JSON.parse(JSON.stringify(rec));
    Object.keys(data || {}).forEach(function (k) {
      if (SUBSTANTIVE.indexOf(k) !== -1) { merged[k] = data[k]; }
    });
    var errors = forbiddenFieldError(SCA.models.capabilityReserve,
      data);
    Object.assign(errors, reserveErrors(merged));
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    SUBSTANTIVE.forEach(function (k) { rec[k] = merged[k]; });
    rec.updated_at = now();
    pushHistory(rec, user, data && data.edit_reason, 'AMENDMENT');
    SCA.store.update('capability_reserves', id, rec);
    audited('reserve.amended', 'capability_reserves', id, user,
      { reason: (data && data.edit_reason) || null });
    return { ok: true, record: rec };
  }

  /* ---------- validation: plans ---------- */

  function personRefError(errors, refs) {
    (refs || []).forEach(function (p) {
      if (!p || typeof p !== 'object') {
        errors.essential_people = 'essential_people entries must be ' +
          'structured references (frozen §5): a Stage 5 Practitioner, ' +
          'a Stage 5 Apprentice, or a documented institutional role.';
        return;
      }
      if (p.type === 'PRACTITIONER') {
        if (!exists('practitioners', p.reference_id)) {
          errors.essential_people = 'Unknown practitioner record: ' +
            p.reference_id + ' (Stage 5 remains authoritative; Stage ' +
            '14 never creates person records).';
        }
      } else if (p.type === 'APPRENTICE') {
        if (!exists('apprentices', p.reference_id)) {
          errors.essential_people = 'Unknown apprentice record: ' +
            p.reference_id + ' (Stage 5 remains authoritative).';
        }
      } else if (p.type === 'INSTITUTIONAL_ROLE') {
        if (isBlank(p.role)) {
          errors.essential_people = 'An institutional role reference ' +
            'requires a documented role.';
        }
        if (p.organization_id &&
          !exists('organizations', p.organization_id)) {
          errors.essential_people = 'Unknown organization record: ' +
            p.organization_id;
        }
      } else {
        errors.essential_people = 'Unknown essential-person type: ' +
          p.type + ' (frozen §5: PRACTITIONER, APPRENTICE, ' +
          'INSTITUTIONAL_ROLE).';
      }
    });
  }

  function planErrors(data) {
    var errors = {};
    if (isBlank(data.capability_id)) {
      errors.capability_id = 'A continuity plan requires its ' +
        'capability reference.';
    } else if (!exists('capabilities', data.capability_id)) {
      errors.capability_id = 'Unknown capability record: ' +
        data.capability_id + ' (Stage 1/2 remain authoritative).';
    }
    if (data.reserve_id !== undefined && data.reserve_id !== null &&
      data.reserve_id !== '' &&
      !exists('capability_reserves', data.reserve_id)) {
      errors.reserve_id = 'Unknown reserve record: ' + data.reserve_id +
        ' (reserve_id is optional, but a populated value must ' +
        'resolve).';
    }
    Object.assign(errors, vocabError(SCENARIOS, data.disruption_scenarios,
      'disruption_scenarios', 'disruption-scenario'));
    Object.assign(errors, vocabError(GAPS, data.known_gaps,
      'known_gaps', 'known-gap'));
    refsResolve(errors, data.fallback_capability_ids, 'capabilities',
      'fallback_capability_ids');
    refsResolve(errors, data.recovery_profile_ids, 'recovery_profiles',
      'recovery_profile_ids');
    refsResolve(errors, data.training_program_ids, 'training_programs',
      'training_program_ids');
    personRefError(errors, data.essential_people);
    return errors;
  }

  var PLAN_SUBSTANTIVE = ['capability_id', 'reserve_id',
    'disruption_scenarios', 'essential_people',
    'knowledge_dependencies', 'material_dependencies',
    'tool_dependencies', 'energy_dependencies',
    'spare_part_dependencies', 'institutional_dependencies',
    'fallback_capability_ids', 'recovery_profile_ids',
    'training_program_ids', 'documentation_refs',
    'geographic_redundancy_refs', 'restoration_sequence',
    'known_gaps', 'owner'];

  function pushPlanHistory(rec, user, reason, changeType) {
    rec.history = rec.history || [];
    var snap = { status: rec.status };
    PLAN_SUBSTANTIVE.forEach(function (k) {
      snap[k] = rec[k] === undefined ? null :
        JSON.parse(JSON.stringify(rec[k]));
    });
    rec.history.push({
      version: rec.version || 1,
      changed_at: now(),
      changed_by: userName(user),
      change_type: changeType || 'TRANSITION',
      reason: reason || null,
      status: rec.status,
      snapshot: snap
    });
    rec.version = String((parseInt(rec.version, 10) || 1) + 1);
  }

  function transitionPlan(user, id, to, perm, opts) {
    opts = opts || {};
    var rec = get('continuity_plans', id);
    if (!rec) {
      return { ok: false, errors: { id: 'Unknown plan: ' + id } };
    }
    if (!can(user, perm)) { return deny(perm); }
    var tErr = transitionError(rec.status, to, PLAN_STATUSES,
      PLAN_TRANSITIONS, 'continuity-plan');
    if (tErr) { return { ok: false, errors: { status: tErr } }; }
    if (opts.creatorOnly && userName(user) !== rec.created_by) {
      return { ok: false, errors: { permission: 'Only the plan ' +
        'creator may perform this transition.' } };
    }
    if (opts.separation) {
      var sErr = separationError(user, rec, 'continuity plan');
      if (sErr) { return { ok: false, errors: { reviewer: sErr } }; }
    }
    if (opts.reasonRequired && isBlank(opts.reason)) {
      return { ok: false, errors: { reason: 'A documented reason is ' +
        'required for ' + rec.status + ' -> ' + to + '.' } };
    }
    var oldStatus = rec.status;
    rec.status = to;
    if (to === 'REVIEWED' || to === 'REJECTED') {
      rec.reviewer = userName(user);
      rec.reviewed_at = now();
      rec.review_reason = opts.reason || null;
    }
    if (to === 'REJECTED') {
      rec.rejection_reason = opts.reason || null;
      rec.rejected_by = userName(user);
      rec.rejected_at = now();
    }
    if (to === 'RETIRED') {
      rec.retirement_reason = opts.reason || null;
      rec.retired_by = userName(user);
      rec.retired_at = now();
    }
    pushPlanHistory(rec, user, opts.reason, 'TRANSITION');
    audited('plan.' + to.toLowerCase(), 'continuity_plans', id, user,
      { old_value: oldStatus, new_value: to,
        reason: opts.reason || null });
    SCA.store.update('continuity_plans', id, rec);
    return { ok: true, record: rec };
  }

  function createPlan(user, data) {
    if (!can(user, 'reserve.create')) { return deny('reserve.create'); }
    data = data || {};
    var errors = forbiddenFieldError(SCA.models.continuityPlan, data);
    Object.assign(errors, planErrors(data));
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    var id = 'cp-' + (data.id ||
      String(SCA.store.count('continuity_plans') + 1) + '-' +
      now().replace(/[^0-9]/g, '').slice(-8));
    var rec = {
      id: id, status: 'DRAFT',
      capability_id: data.capability_id,
      reserve_id: data.reserve_id || null,
      disruption_scenarios: data.disruption_scenarios || [],
      essential_people: data.essential_people || [],
      knowledge_dependencies: data.knowledge_dependencies || [],
      material_dependencies: data.material_dependencies || [],
      tool_dependencies: data.tool_dependencies || [],
      energy_dependencies: data.energy_dependencies || [],
      spare_part_dependencies: data.spare_part_dependencies || [],
      institutional_dependencies: data.institutional_dependencies ||
        [],
      fallback_capability_ids: data.fallback_capability_ids || [],
      recovery_profile_ids: data.recovery_profile_ids || [],
      training_program_ids: data.training_program_ids || [],
      documentation_refs: data.documentation_refs || [],
      geographic_redundancy_refs: data.geographic_redundancy_refs ||
        [],
      restoration_sequence: data.restoration_sequence || [],
      known_gaps: data.known_gaps || [],
      owner: data.owner || userName(user),
      created_by: userName(user),
      created_at: now(), updated_at: now(), version: '1',
      history: []
    };
    /* Model validation runs on the CONSTRUCTED record. */
    var pv = SCA.models.continuityPlan.validate(rec);
    if (Object.keys(pv.errors || {}).length) {
      return { ok: false, errors: pv.errors };
    }
    SCA.store.insert('continuity_plans', rec);
    audited('plan.created', 'continuity_plans', id, user,
      { new_value: 'DRAFT' });
    return { ok: true, record: rec };
  }

  function updatePlan(user, id, data) {
    var rec = get('continuity_plans', id);
    if (!rec) {
      return { ok: false, errors: { id: 'Unknown plan: ' + id } };
    }
    if (!can(user, 'reserve.update')) { return deny('reserve.update'); }
    if (userName(user) !== rec.created_by) {
      return { ok: false, errors: { permission: 'Only the plan ' +
        'creator may edit a draft plan.' } };
    }
    if (rec.status !== 'DRAFT') {
      return { ok: false, errors: { status: 'Only a DRAFT plan is ' +
        'editable (SUBMITTED is locked pending review).' } };
    }
    var merged = JSON.parse(JSON.stringify(rec));
    Object.keys(data || {}).forEach(function (k) {
      if (PLAN_SUBSTANTIVE.indexOf(k) !== -1) { merged[k] = data[k]; }
    });
    var errors = forbiddenFieldError(SCA.models.continuityPlan, data);
    Object.assign(errors, planErrors(merged));
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    PLAN_SUBSTANTIVE.forEach(function (k) { rec[k] = merged[k]; });
    rec.updated_at = now();
    pushPlanHistory(rec, user, data && data.edit_reason, 'AMENDMENT');
    SCA.store.update('continuity_plans', id, rec);
    audited('plan.amended', 'continuity_plans', id, user,
      { reason: (data && data.edit_reason) || null });
    return { ok: true, record: rec };
  }

  /* ---------- assets ---------- */

  /* Assets are composed while the reserve is in its editable DRAFT
   * phase (SUBMITTED is locked pending review — assets are part of
   * the reserve definition, exactly as listing fields are part of a
   * Stage 13 listing). No asset lifecycle exists: an asset is a
   * documented reference, and nothing is ever hard-deleted. */
  function createAsset(user, data) {
    data = data || {};
    if (!can(user, 'reserve.update')) { return deny('reserve.update'); }
    var reserve = get('capability_reserves', data.reserve_id);
    if (!reserve) {
      return { ok: false, errors: { reserve_id: 'Unknown reserve: ' +
        data.reserve_id + ' (an asset never manufactures its ' +
        'reserve).' } };
    }
    if (userName(user) !== reserve.created_by) {
      return { ok: false, errors: { permission: 'Only the reserve ' +
        'creator may compose its assets.' } };
    }
    if (reserve.status !== 'DRAFT') {
      return { ok: false, errors: { status: 'Assets may be composed ' +
        'only while the reserve is DRAFT (SUBMITTED is locked ' +
        'pending review).' } };
    }
    var errors = forbiddenFieldError(SCA.models.capabilityAsset, data);
    if (ASSET_CATEGORIES.indexOf(data.asset_category) === -1) {
      errors.asset_category = 'Unknown asset category: ' +
        data.asset_category + ' (frozen thirteen-value vocabulary).';
    }
    var sources = SCA.models.capabilityAsset.SOURCES[
      data.asset_category] || [];
    var docOnly = SCA.models.capabilityAsset.DOCUMENTATION_ONLY
      .indexOf(data.asset_category) !== -1;
    if (isBlank(data.reference_type) && isBlank(data.reference_id)) {
      /* Frozen §13 biological documentation-only rule: BIOLOGICAL
       * may be recorded without a reference. Every OTHER category
       * requires an authoritative reference. */
      if (!docOnly) {
        errors.reference_type = 'A ' + data.asset_category +
          ' asset requires an authoritative reference (only ' +
          'BIOLOGICAL may be documentation-only where no ' +
          'authoritative biological record exists).';
      }
    } else {
      if (sources.indexOf(data.reference_type) === -1) {
        errors.reference_type = 'A ' + data.asset_category +
          ' asset must reference one of its authoritative sources: ' +
          (sources.join(', ') || 'none (documentation-only)') + '.';
      } else if (!exists(data.reference_type, data.reference_id)) {
        errors.reference_id = 'Unknown ' + data.reference_type +
          ' record: ' + data.reference_id +
          ' (Stage 14 never duplicates or creates the referenced ' +
          'record).';
      }
    }
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    var id = 'ca-' + (data.id ||
      String(SCA.store.count('capability_assets') + 1) + '-' +
      now().replace(/[^0-9]/g, '').slice(-8));
    var rec = {
      id: id,
      reserve_id: data.reserve_id,
      asset_category: data.asset_category,
      reference_type: data.reference_type || null,
      reference_id: data.reference_id || null,
      notes: data.notes || null,
      documentation_only: docOnly && isBlank(data.reference_id),
      created_by: userName(user),
      created_at: now(), updated_at: now(),
      history: []
    };
    SCA.store.insert('capability_assets', rec);
    audited('asset.created', 'capability_assets', id, user,
      { new_value: data.asset_category });
    return { ok: true, record: rec };
  }

  function updateAsset(user, id, data) {
    var rec = get('capability_assets', id);
    if (!rec) {
      return { ok: false, errors: { id: 'Unknown asset: ' + id } };
    }
    var reserve = get('capability_reserves', rec.reserve_id);
    if (!can(user, 'reserve.update')) { return deny('reserve.update'); }
    if (!reserve || userName(user) !== reserve.created_by) {
      return { ok: false, errors: { permission: 'Only the reserve ' +
        'creator may amend its assets.' } };
    }
    if (reserve.status !== 'DRAFT') {
      return { ok: false, errors: { status: 'Assets may be amended ' +
        'only while the reserve is DRAFT.' } };
    }
    var errors = forbiddenFieldError(SCA.models.capabilityAsset, data);
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    ['reference_type', 'reference_id', 'notes'].forEach(function (k) {
      if (data[k] !== undefined) { rec[k] = data[k]; }
    });
    rec.updated_at = now();
    SCA.store.update('capability_assets', id, rec);
    audited('asset.amended', 'capability_assets', id, user);
    return { ok: true, record: rec };
  }

  function assetsOf(reserveId) {
    return SCA.store.all('capability_assets').filter(function (a) {
      return a.reserve_id === reserveId; });
  }

  /* ---------- derived views (never persisted) ---------- */

  /* One-Person Test (frozen §14): a DERIVED read-only observation
   * with Stage 6 census semantics — "documented within the
   * available evidence/census scope", NEVER "only one exists". */
  function onePersonTest(capabilityId) {
    var profile = SCA.training.reproductionProfile(capabilityId);
    var count = profile.practitioner_count;
    var status = count === 0 ? 'NOT_YET_DOCUMENTED' :
      (count === 1 ? 'SINGLE_DOCUMENTED' : 'MULTIPLE_DOCUMENTED');
    var wording;
    if (count === 0) {
      wording = 'No practitioner is currently documented for this ' +
        'capability within the available evidence/census scope ' +
        '(Not yet documented — never a finding that none exist).';
    } else if (count === 1) {
      wording = 'One practitioner is currently documented within ' +
        'the available evidence/census scope. This is a factual ' +
        'dependency observation, NOT a claim that only one person ' +
        'exists.';
    } else {
      wording = count + ' practitioners are currently documented ' +
        'within the available evidence/census scope.';
    }
    return {
      derived: true, persisted: false,
      capability_id: capabilityId,
      status: status,
      documented_count: count,
      basis: 'Stage 5 practitioner records for this capability ' +
        '(documented within the available evidence/census scope)',
      wording: wording
    };
  }

  /* Three-Generation Test (frozen §15): DERIVED from Stage 5
   * reproduction data only. Deterministic strongest-first
   * precedence; no result is ever stored, edited or scored. */
  function threeGenerationTest(capabilityId) {
    var profile = SCA.training.reproductionProfile(capabilityId);
    var has = function (n) { return (profile[n] || 0) > 0; };
    var state;
    if (has('practitioner_count') && has('trainer_count') &&
      has('apprentice_count') && has('completed_apprenticeship_count') &&
      has('certification_count')) {
      state = 'REPRODUCTION_DOCUMENTED';
    } else if (has('completed_apprenticeship_count') &&
      has('certification_count') && has('trainer_count')) {
      state = 'TRAINER_SUCCESSOR';
    } else if (has('completed_apprenticeship_count') &&
      has('certification_count')) {
      state = 'COMPETENT_SUCCESSOR';
    } else if (has('trainer_count')) {
      state = 'TRAINER_PRESENT';
    } else if (has('apprentice_count') ||
      has('active_apprentice_count')) {
      state = 'APPRENTICE_PRESENT';
    } else if (has('practitioner_count')) {
      state = 'PRACTITIONER_ONLY';
    } else {
      state = 'NOT_DOCUMENTED';
    }
    return {
      derived: true, persisted: false,
      capability_id: capabilityId,
      state: state,
      basis: {
        practitioners: profile.practitioner_count,
        verified_practitioners: profile.verified_practitioner_count,
        trainers: profile.trainer_count,
        apprentices: profile.apprentice_count,
        active_apprenticeships: profile.active_apprentice_count,
        completed_apprenticeships:
          profile.completed_apprenticeship_count,
        certifications: profile.certification_count
      },
      basis_note: 'Derived read-only from Stage 5 reproduction ' +
        'records (authoritative); nothing is stored or duplicated.'
    };
  }

  /* National Capability Battery (frozen §18): a PRESENTATIONAL
   * derived view. No entity, no percentage, no score, no ranking —
   * documented components with explicit count bases only. */
  function batteryView() {
    var active = SCA.store.all('capability_reserves').filter(
      function (r) { return r.status === 'ACTIVE'; });
    var assets = SCA.store.all('capability_assets');
    var activeIds = {};
    active.forEach(function (r) { activeIds[r.id] = true; });
    var counts = {};
    ASSET_CATEGORIES.forEach(function (c) { counts[c] = 0; });
    assets.forEach(function (a) {
      if (activeIds[a.reserve_id]) { counts[a.asset_category] += 1; }
    });
    return {
      derived: true, persisted: false,
      presentation_only: true,
      active_reserve_count: active.length,
      components: counts,
      basis_note: 'Documented assets belonging to ACTIVE reserves ' +
        'only. A count is a documented-component tally with an ' +
        'explicit basis — it is NEVER a battery percentage, score ' +
        'or readiness judgement.',
      reserves_by_type: RESERVE_TYPES.map(function (t) {
        return { type: t, count: active.filter(function (r) {
          return (r.reserve_types || []).indexOf(t) !== -1; }).length };
      })
    };
  }

  /* Capability Spine (frozen §19): navigation/presentation ONLY.
   * The ten conceptual segments navigate EXISTING systems; no
   * taxonomy, entity, relationship or score is created, and the
   * frozen twelve capability families remain authoritative. */
  function spineView() {
    return {
      derived: true, presentation_only: true,
      segments: ['Knowledge', 'People', 'Energy', 'Water', 'Food',
        'Health', 'Materials/Repair', 'Mobility/Trade',
        'Governance', 'Reproduction'],
      note: 'Conceptual navigation across existing systems only. ' +
        'Not a taxonomy; the twelve frozen capability families ' +
        'remain authoritative.',
      routes: { knowledge: '#/knowledge', people: '#/people',
        energy: '#/capabilities', water: '#/capabilities',
        food: '#/capabilities', health: '#/capabilities',
        repair: '#/repair', trade: '#/marketplace',
        governance: '#/about', reproduction: '#/training' }
    };
  }

  /* ---------- read views ---------- */

  function plansForCapability(capabilityId) {
    return SCA.store.all('continuity_plans').filter(function (p) {
      return p.capability_id === capabilityId; });
  }
  function plansForReserve(reserveId) {
    return SCA.store.all('continuity_plans').filter(function (p) {
      return p.reserve_id === reserveId; });
  }
  function reservesForCapability(capabilityId) {
    return SCA.store.all('capability_reserves').filter(function (r) {
      return (r.capability_ids || []).indexOf(capabilityId) !== -1; });
  }

  /* The read-only continuity section for capability detail
   * (authorization §32): consumes every authority, owns none. */
  function continuityForCapability(capabilityId) {
    var profile = SCA.training.reproductionProfile(capabilityId);
    var recovery = SCA.store.all('recovery_profiles').filter(
      function (p) {
        return (p.capability_ids || []).indexOf(capabilityId) !== -1 ||
          p.capability_id === capabilityId; });
    var plans = plansForCapability(capabilityId);
    var reserves = reservesForCapability(capabilityId);
    var gaps = {};
    plans.concat(reserves).forEach(function (r) {
      (r.known_gaps || []).forEach(function (g) { gaps[g] = true; }); });
    return {
      derived: true, persisted: false,
      capability_id: capabilityId,
      people: {
        practitioners: profile.practitioner_count,
        verified_practitioners: profile.verified_practitioner_count,
        trainers: profile.trainer_count,
        apprentices: profile.apprentice_count,
        basis: 'Stage 5 reproduction records (documented within ' +
          'the available evidence/census scope)'
      },
      one_person_test: onePersonTest(capabilityId),
      three_generation_test: threeGenerationTest(capabilityId),
      recovery_profiles: recovery.map(function (p) {
        return { id: p.id, kind: p.profile_kind || p.kind }; }),
      repair: {
        repair_capabilities: SCA.store.all('repair_capabilities')
          .filter(function (c) {
            return (c.capability_ids || []).indexOf(capabilityId) !==
              -1 || c.capability_id === capabilityId; }).length,
        workshops: SCA.store.all('workshops').filter(function (w) {
          return (w.capability_ids || []).indexOf(capabilityId) !==
            -1; }).length,
        basis: 'Stage 8 records referencing this capability'
      },
      fallbacks: plans.concat(reserves).reduce(function (acc, r) {
        (r.fallback_capability_ids || []).forEach(function (f) {
          if (acc.indexOf(f) === -1) { acc.push(f); } });
        return acc; }, []),
      continuity_plans: plans.map(function (p) {
        return { id: p.id, status: p.status,
          reserve_id: p.reserve_id || null }; }),
      reserves: reserves.map(function (r) {
        return { id: r.id, status: r.status, name: r.name }; }),
      known_gaps: Object.keys(gaps),
      note: 'Read-only continuity summary. The existence of a plan ' +
        'or reserve NEVER implies the capability is resilient.'
    };
  }

  function list(user, opts) {
    if (!can(user, 'reserve.read')) { return deny('reserve.read'); }
    opts = opts || {};
    var all = SCA.store.all('capability_reserves');
    if (opts.status) {
      all = all.filter(function (r) { return r.status === opts.status; });
    }
    var planByCap = {};
    SCA.store.all('continuity_plans').forEach(function (p) {
      planByCap[p.capability_id] = planByCap[p.capability_id] || [];
      planByCap[p.capability_id].push(p.status);
    });
    return {
      ok: true,
      derived: true,
      records: all.map(function (r) {
        var planStatuses = [];
        (r.capability_ids || []).forEach(function (c) {
          (planByCap[c] || []).forEach(function (s) {
            planStatuses.push(s); }); });
        plansForReserve(r.id).forEach(function (p) {
          planStatuses.push(p.status); });
        return {
          id: r.id, name: r.name,
          reserve_types: r.reserve_types || [],
          status: r.status,
          capability_ids: r.capability_ids || [],
          location_ids: r.location_ids || [],
          custodian_organization_id: r.custodian_organization_id ||
            null,
          known_gaps: r.known_gaps || [],
          reviewed_at: r.reviewed_at || null,
          continuity_plan_statuses: planStatuses
        };
      })
    };
  }

  /* ---------- API ---------- */

  SCA.reserve = {
    /* Lifecycle: reserve. */
    createReserve: createReserve,
    updateReserve: updateReserve,
    submitReserve: function (user, id) {
      return transitionReserve(user, id, 'SUBMITTED',
        'reserve.update', { creatorOnly: true });
    },
    verifyReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'VERIFIED', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    rejectReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'REJECTED', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    /* VERIFIED -> ACTIVE: review authority + documented custodian
     * (frozen decision 3). No reserve.activate permission exists. */
    activateReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'ACTIVE', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    suspendReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'SUSPENDED',
        'reserve.update', { creatorOnly: true,
          reasonRequired: true, reason: reason });
    },
    /* SUSPENDED -> ACTIVE: the record reached ACTIVE through review
     * + custodian once; resuming re-applies the SAME standard
     * (review authority + custodian resolution). */
    resumeReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'ACTIVE', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    retireReserve: function (user, id, reason) {
      return transitionReserve(user, id, 'RETIRED', 'reserve.retire',
        { reasonRequired: true, reason: reason });
    },

    /* Lifecycle: plan. */
    createPlan: createPlan,
    updatePlan: updatePlan,
    submitPlan: function (user, id) {
      return transitionPlan(user, id, 'SUBMITTED', 'reserve.update',
        { creatorOnly: true });
    },
    reviewPlan: function (user, id, reason) {
      return transitionPlan(user, id, 'REVIEWED', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    rejectPlan: function (user, id, reason) {
      return transitionPlan(user, id, 'REJECTED', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    activatePlan: function (user, id, reason) {
      return transitionPlan(user, id, 'ACTIVE', 'reserve.review',
        { separation: true, reasonRequired: true, reason: reason });
    },
    retirePlan: function (user, id, reason) {
      return transitionPlan(user, id, 'RETIRED', 'reserve.retire',
        { reasonRequired: true, reason: reason });
    },

    /* Assets. */
    createAsset: createAsset,
    updateAsset: updateAsset,
    assetsOf: assetsOf,

    /* Derived read-only views (never persisted). */
    onePersonTest: onePersonTest,
    threeGenerationTest: threeGenerationTest,
    batteryView: batteryView,
    spineView: spineView,
    continuityForCapability: continuityForCapability,
    plansForCapability: plansForCapability,
    plansForReserve: plansForReserve,
    reservesForCapability: reservesForCapability,

    /* Read views. */
    list: list,
    get: function (id) { return get('capability_reserves', id); },
    getPlan: function (id) { return get('continuity_plans', id); },

    /* Frozen vocabularies (for UI + tests). */
    STATUSES: STATUSES,
    TERMINAL: TERMINAL,
    TRANSITIONS: TRANSITIONS,
    PLAN_STATUSES: PLAN_STATUSES,
    PLAN_TERMINAL: PLAN_TERMINAL,
    PLAN_TRANSITIONS: PLAN_TRANSITIONS,
    RESERVE_TYPES: RESERVE_TYPES,
    SCENARIOS: SCENARIOS,
    GAPS: GAPS,
    ASSET_CATEGORIES: ASSET_CATEGORIES,
    THREE_GENERATION_STATES: THREE_GEN
  };
})(SCA);
