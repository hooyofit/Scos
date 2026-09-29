/*
 * Capability Intervention workflow (Stage 10, frozen scope v1.1).
 *
 * ARCHITECTURAL RULES (permanent, frozen Stage 10 scope):
 *  - Exactly ONE new operational entity: CapabilityIntervention.
 *    Stages 1–9 remain authoritative for their domains and are
 *    consumed ONLY through their existing public interfaces and
 *    canonical collections (SCA.store reads): ResearchProject (4),
 *    practitioner/training/certification (5), census (6), graph (7),
 *    repair/failure scenarios (8), recovery profiles (9), evidence
 *    and knowledge (3). No shadow records of any kind.
 *  - A CapabilityIntervention is NOT a graph node and never writes
 *    to the graph: no create/modify/verify/supersede/retire of any
 *    Stage 7 relationship, ever. The 19-type registry is untouched.
 *  - Lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED ->
 *    ACTIVE -> COMPLETED, with SUSPENDED and CANCELLED paths.
 *    UNDER_REVIEW -> DRAFT is a return for correction (reason
 *    required, audited); UNDER_REVIEW -> CANCELLED is a terminal
 *    discard (reason required, audited). COMPLETED and CANCELLED are
 *    terminal and are never substantively edited in place.
 *  - SUBMITTED and UNDER_REVIEW lock substantive creator editing.
 *    APPROVED/ACTIVE/SUSPENDED records change only through an
 *    explicit, attributable, audited AMENDMENT with a mandatory
 *    reason. No silent mutation of historical state.
 *  - NO duplicate-signature guard: multiple interventions for the
 *    same capability/problem/region are legitimate competing
 *    approaches and are recorded independently (frozen rule).
 *  - Outcome status is categorical and reviewer-governed (default
 *    UNKNOWN; COMPLETED + UNKNOWN is valid), never self-declared by
 *    the implementer, never a score. Changing it from UNKNOWN
 *    requires reviewer authority, an explicit reason and outcome
 *    evidence references (existing Stage 3/4 records only).
 *  - Successor-before-launch: approval of an intervention that
 *    depends on human capability requires its critical roles to be
 *    RECORDED with presence-of-value semantics — UNKNOWN is honest
 *    and passes; a blank field fails. Nothing is fabricated.
 *  - No Orphan Project Rule: approval requires documented
 *    requirements OR the explicit, auditable self_contained claim;
 *    an intervention must not appear self-sufficient when its
 *    operation depends on undocumented external capabilities.
 *  - No scores, no rankings, no prioritization, no AI generation.
 *    Neutral ordering only (name/creation), never evaluative.
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
    'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED'];
  var TERMINAL = ['COMPLETED', 'CANCELLED'];
  /* Anonymous users see only the explicitly public states (frozen
   * scope section 35); SUSPENDED and CANCELLED follow explicit
   * access classification, which defaults to staff-only here. */
  var PUBLIC_STATUSES = ['APPROVED', 'ACTIVE', 'COMPLETED'];
  var OUTCOMES = ['UNKNOWN', 'SUCCESSFUL', 'MIXED', 'UNSUCCESSFUL',
    'INSUFFICIENT_EVIDENCE'];
  var ROLE_STATUSES = ['IDENTIFIED', 'UNKNOWN'];

  /* Substantive-edit states. */
  var EDITABLE = ['DRAFT'];
  var AMENDABLE = ['APPROVED', 'ACTIVE', 'SUSPENDED'];

  /* Frozen transition table (Stage 10 scope v1.1 + authorization
   * v1.0 section 6 — the reject path is pinned: return-for-
   * correction goes to DRAFT, a true discard is CANCELLED). */
  var TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['DRAFT', 'APPROVED', 'CANCELLED'],
    APPROVED: ['ACTIVE'],
    ACTIVE: ['SUSPENDED', 'COMPLETED', 'CANCELLED'],
    SUSPENDED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };

  /* Canonical reference fields -> existing collections (frozen scope
   * section 10; authorization section 10 list, complete). These are
   * references into Stage 1–9 records — never shadow records. */
  var REFERENCE_FIELDS = {
    capability_ids: 'capabilities',
    family_ids: 'families',
    research_project_ids: 'research_projects',
    evidence_source_ids: 'evidence',
    knowledge_artifact_ids: 'knowledge',
    field_observation_ids: 'observations',
    failure_scenario_ids: 'failure_scenarios',
    recovery_profile_ids: 'recovery_profiles',
    practitioner_ids: 'practitioners',
    apprentice_ids: 'apprentices',
    training_program_ids: 'training_programs',
    competence_assessment_ids: 'competence_assessments',
    certification_ids: 'capability_certifications',
    organization_ids: 'organizations',
    location_ids: 'locations',
    workshop_ids: 'workshops',
    repair_capability_ids: 'repair_capabilities',
    spare_part_ids: 'spare_parts',
    tool_ids: 'tools',
    material_ids: 'materials',
    resource_ids: 'resources',
    energy_source_ids: 'energy_sources'
  };
  var OUTCOME_REFERENCE_FIELDS = {
    outcome_evidence_source_ids: 'evidence',
    outcome_knowledge_artifact_ids: 'knowledge',
    outcome_field_observation_ids: 'observations'
  };
  var ALL_REFERENCE_FIELDS =
    Object.assign({}, REFERENCE_FIELDS, OUTCOME_REFERENCE_FIELDS);

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
      entity: 'capability_interventions',
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }

  var SUBSTANTIVE_KEYS = ['name', 'description', 'objective',
    'intervention_type', 'problem_description', 'observed_condition',
    'implementation_region', 'intended_beneficiaries', 'activities',
    'required_capabilities', 'required_skills', 'required_equipment',
    'required_materials', 'required_tools', 'required_infrastructure',
    'required_energy', 'required_spare_parts',
    'required_repair_capability', 'required_training',
    'institutional_support', 'external_dependencies', 'dependencies',
    'fallback_arrangement', 'training_requirements', 'estimated_duration',
    'maintenance_requirements', 'reproduction_pathway', 'assumptions',
    'limitations', 'self_contained', 'depends_on_human_capability',
    'critical_roles', 'estimated_implementation_cost',
    'estimated_operating_cost', 'estimated_maintenance_cost',
    'local_labor_requirement', 'imported_inputs', 'local_inputs',
    'revenue_model', 'replacement_cost', 'lifecycle_considerations',
    'resource_consumption', 'energy_requirements', 'waste',
    'emissions_documented', 'water_use', 'material_use',
    'environmental_risks', 'climate_exposure', 'repairability_notes',
    'end_of_life', 'safety_considerations',
    'environmental_considerations', 'capability_ids', 'family_ids',
    'research_project_ids', 'evidence_source_ids',
    'knowledge_artifact_ids', 'field_observation_ids',
    'failure_scenario_ids', 'recovery_profile_ids', 'practitioner_ids',
    'apprentice_ids', 'training_program_ids',
    'competence_assessment_ids', 'certification_ids',
    'organization_ids', 'location_ids', 'workshop_ids',
    'repair_capability_ids', 'spare_part_ids', 'tool_ids',
    'material_ids', 'resource_ids', 'energy_source_ids',
    'responsible_organization_id'];

  function snapshotOf(rec) {
    var snap = {};
    SUBSTANTIVE_KEYS.forEach(function (k) {
      snap[k] = rec[k] === undefined ? null :
        JSON.parse(JSON.stringify(rec[k]));
    });
    snap.status = rec.status;
    snap.outcome_status = rec.outcome_status || 'UNKNOWN';
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
    var orgId = rec.responsible_organization_id;
    if (orgId && !SCA.store.get('organizations', orgId)) {
      errors.responsible_organization_id =
        'Unknown organization: ' + orgId + '.';
    }
    return errors;
  }

  function criticalRolesError(rec, opts) {
    var errors = {};
    var roles = rec.critical_roles;
    if (!Array.isArray(roles) || roles.length === 0) {
      /* The depends-on-human-capability check is an APPROVAL gate
       * (successor-before-launch), never a creation blocker: a
       * planning DRAFT may honestly be incomplete. */
      if (rec.depends_on_human_capability &&
        !(opts && opts.entriesOnly)) {
        errors.critical_roles = 'depends_on_human_capability is set: ' +
          'record the critical roles (operator, maintainer, trainer, ' +
          'successor…). Use status UNKNOWN where a person is not yet ' +
          'identified — never leave the record blank and never invent ' +
          'a person.';
      }
      return errors;
    }
    roles.forEach(function (role, i) {
      var label = 'critical role ' + (i + 1);
      if (!role || SCA.util.isBlank(role.role)) {
        errors.critical_roles = label + ' is missing a role label.';
        return;
      }
      var st = role.status || 'UNKNOWN';
      if (ROLE_STATUSES.indexOf(st) === -1) {
        errors.critical_roles = label + ' has an unknown status "' + st +
          '" (use IDENTIFIED or UNKNOWN).';
      }
      if (st === 'IDENTIFIED') {
        if (!role.practitioner_id) {
          errors.critical_roles = label + ' is IDENTIFIED but names no ' +
            'canonical practitioner (use UNKNOWN instead of inventing).';
        } else if (!SCA.store.get('practitioners', role.practitioner_id)) {
          errors.critical_roles = label + ' references an unknown ' +
            'practitioner: ' + role.practitioner_id + '.';
        }
      }
    });
    return errors;
  }

  function validateIntervention(rec) {
    var errors = {};
    if (SCA.enums.codes(SCA.enums.intervention_types)
      .indexOf(rec.intervention_type) === -1) {
      errors.intervention_type = 'Use one of the controlled ' +
        'intervention type codes.';
    }
    if (STATUSES.indexOf(rec.status) === -1) {
      errors.status = 'Unknown status.';
    }
    if (OUTCOMES.indexOf(rec.outcome_status || 'UNKNOWN') === -1) {
      errors.outcome_status = 'Unknown outcome status.';
    }
    Object.assign(errors, refsError(rec, REFERENCE_FIELDS));
    Object.assign(errors, criticalRolesError(rec,
      { entriesOnly: true }));
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- lifecycle ---------- */

  function createIntervention(user, data) {
    if (!can(user, 'intervention.create')) {
      return deny('intervention.create');
    }
    data = data || {};
    var rec = Object.assign({
      id: null,
      name: data.name,
      description: data.description || '',
      objective: data.objective || '',
      intervention_type: data.intervention_type,
      status: 'DRAFT',
      problem_description: data.problem_description || '',
      observed_condition: data.observed_condition || '',
      implementation_region: data.implementation_region || '',
      intended_beneficiaries: data.intended_beneficiaries || '',
      activities: data.activities || [],
      required_capabilities: data.required_capabilities || [],
      required_skills: data.required_skills || [],
      required_equipment: data.required_equipment || [],
      required_materials: data.required_materials || [],
      required_tools: data.required_tools || [],
      required_infrastructure: data.required_infrastructure || [],
      required_energy: data.required_energy || [],
      required_spare_parts: data.required_spare_parts || [],
      required_repair_capability: data.required_repair_capability || [],
      required_training: data.required_training || [],
      institutional_support: data.institutional_support || [],
      external_dependencies: data.external_dependencies || [],
      dependencies: data.dependencies || [],
      fallback_arrangement: data.fallback_arrangement || '',
      training_requirements: data.training_requirements || '',
      estimated_duration: data.estimated_duration || '',
      maintenance_requirements: data.maintenance_requirements || '',
      reproduction_pathway: data.reproduction_pathway || '',
      assumptions: data.assumptions || [],
      limitations: data.limitations || '',
      self_contained: !!data.self_contained,
      depends_on_human_capability: !!data.depends_on_human_capability,
      critical_roles: data.critical_roles || [],
      estimated_implementation_cost: data.estimated_implementation_cost || '',
      estimated_operating_cost: data.estimated_operating_cost || '',
      estimated_maintenance_cost: data.estimated_maintenance_cost || '',
      local_labor_requirement: data.local_labor_requirement || '',
      imported_inputs: data.imported_inputs || '',
      local_inputs: data.local_inputs || '',
      revenue_model: data.revenue_model || '',
      replacement_cost: data.replacement_cost || '',
      lifecycle_considerations: data.lifecycle_considerations || '',
      resource_consumption: data.resource_consumption || '',
      energy_requirements: data.energy_requirements || '',
      waste: data.waste || '',
      emissions_documented: data.emissions_documented || '',
      water_use: data.water_use || '',
      material_use: data.material_use || '',
      environmental_risks: data.environmental_risks || '',
      climate_exposure: data.climate_exposure || '',
      repairability_notes: data.repairability_notes || '',
      end_of_life: data.end_of_life || '',
      safety_considerations: data.safety_considerations || '',
      environmental_considerations: data.environmental_considerations || '',
      capability_ids: data.capability_ids || [],
      family_ids: data.family_ids || [],
      research_project_ids: data.research_project_ids || [],
      evidence_source_ids: data.evidence_source_ids || [],
      knowledge_artifact_ids: data.knowledge_artifact_ids || [],
      field_observation_ids: data.field_observation_ids || [],
      failure_scenario_ids: data.failure_scenario_ids || [],
      recovery_profile_ids: data.recovery_profile_ids || [],
      practitioner_ids: data.practitioner_ids || [],
      apprentice_ids: data.apprentice_ids || [],
      training_program_ids: data.training_program_ids || [],
      competence_assessment_ids: data.competence_assessment_ids || [],
      certification_ids: data.certification_ids || [],
      organization_ids: data.organization_ids || [],
      location_ids: data.location_ids || [],
      workshop_ids: data.workshop_ids || [],
      repair_capability_ids: data.repair_capability_ids || [],
      spare_part_ids: data.spare_part_ids || [],
      tool_ids: data.tool_ids || [],
      material_ids: data.material_ids || [],
      resource_ids: data.resource_ids || [],
      energy_source_ids: data.energy_source_ids || [],
      responsible_organization_id: data.responsible_organization_id || null,
      outcome_status: 'UNKNOWN',
      outcome_reviewer: null,
      outcome_reviewed_at: null,
      outcome_reason: null,
      outcome_evidence_source_ids: data.outcome_evidence_source_ids || [],
      outcome_knowledge_artifact_ids: data.outcome_knowledge_artifact_ids || [],
      outcome_field_observation_ids: data.outcome_field_observation_ids || [],
      submitted_at: null,
      reviewer: null,
      review_reason: null,
      approved_at: null,
      activated_at: null,
      suspended_at: null,
      completed_at: null,
      cancelled_at: null,
      last_reason: null,
      created_by: userName(user),
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.capability_intervention.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateIntervention(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var res = SCA.store.insert('capability_interventions', rec);
    if (res.ok) {
      audited('intervention.created', res.record.id, user);
    }
    return res;
  }

  /* DRAFT content editing (full substantive editing by the creator
   * side; every edit is history-recorded, never silent). */
  function updateIntervention(user, id, patch) {
    if (!can(user, 'intervention.update')) {
      return deny('intervention.update');
    }
    var r = SCA.store.get('capability_interventions', id);
    if (!r) {
      return { ok: false, errors: { id: 'Intervention not found.' } };
    }
    if (EDITABLE.indexOf(r.status) === -1) {
      return { ok: false, errors: {
        status: 'This intervention is ' + r.status + ': substantive ' +
          'editing is locked at SUBMITTED and above. Use the audited ' +
          'amendment mechanism for APPROVED/ACTIVE/SUSPENDED records.'
      } };
    }
    return applyChange(user, id, patch, 'Content edited.', 'EDIT');
  }

  /* Auditable amendment for APPROVED/ACTIVE/SUSPENDED records (the
   * frozen rule: no silent substantive mutation after approval; a
   * required change is explicit, attributable, history-preserving,
   * reasoned and audited). */
  function amendIntervention(user, id, patch, reason) {
    if (!can(user, 'intervention.update')) {
      return deny('intervention.update');
    }
    var r = SCA.store.get('capability_interventions', id);
    if (!r) {
      return { ok: false, errors: { id: 'Intervention not found.' } };
    }
    if (AMENDABLE.indexOf(r.status) === -1) {
      return { ok: false, errors: {
        status: 'Amendments apply to APPROVED, ACTIVE or SUSPENDED ' +
          'records only (current: ' + r.status + '). Terminal records ' +
          'are historical and are never edited.'
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
    var r = SCA.store.get('capability_interventions', id);
    var immutable = ['id', 'created_at', 'created_by', 'status',
      'submitted_at', 'reviewer', 'review_reason', 'approved_at',
      'activated_at', 'suspended_at', 'completed_at', 'cancelled_at',
      'outcome_status', 'outcome_reviewer', 'outcome_reviewed_at',
      'outcome_reason', 'outcome_evidence_source_ids',
      'outcome_knowledge_artifact_ids',
      'outcome_field_observation_ids', 'version', 'history'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.capability_intervention.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateIntervention(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    pushHistory(r, user, reason, changeType);
    /* pushHistory increments r.version (and appends the history
     * entry through the shared array reference); the saved record
     * must carry the incremented version — never the pre-edit one. */
    next.version = r.version;
    next.updated_at = now();
    next.last_reason = reason;
    var res = SCA.store.update('capability_interventions', id, next);
    if (res.ok) {
      audited(changeType === 'AMENDMENT' ? 'intervention.amended' :
        'intervention.edited', id, user, { reason: reason });
    }
    return res;
  }

  /* Generic transition helper. */
  function transition(user, id, to, perm, opts) {
    opts = opts || {};
    if (!can(user, perm)) { return deny(perm); }
    var r = SCA.store.get('capability_interventions', id);
    if (!r) {
      return { ok: false, errors: { id: 'Intervention not found.' } };
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
    var res = SCA.store.update('capability_interventions', id, r);
    if (res.ok) {
      audited(opts.action, id, user, { old_value: from,
        new_value: to, reason: opts.reason || null });
    }
    return res;
  }

  /* Creator-side transitions (planning side; the review authority is
   * never held by a creator role, so a creator cannot self-approve —
   * the RBAC matrix has no overlap between intervention.create and
   * intervention.review, and the workflow additionally refuses a
   * self-approve by the record's creator as a second guard). */
  function submitIntervention(user, id) {
    return transition(user, id, 'SUBMITTED', 'intervention.create', {
      action: 'intervention.submitted',
      defaultReason: 'Submitted for review.',
      stamp: function (r) { r.submitted_at = now(); },
      gate: function (r) {
        if (SCA.util.isBlank(r.name) || SCA.util.isBlank(r.objective)) {
          return { name: 'Submission requires a name and an objective ' +
            '(a proposal without an objective cannot be reviewed).' };
        }
        return null;
      }
    });
  }

  /* Review-side transitions. */
  function reviewIntervention(user, id) {
    return transition(user, id, 'UNDER_REVIEW', 'intervention.review', {
      action: 'intervention.review_started',
      defaultReason: 'Review started.',
      gate: function (r) {
        if (r.created_by === userName(user)) {
          return { creator: 'A creator cannot move their own ' +
            'intervention into review (review-authority separation).' };
        }
        return null;
      }
    });
  }

  function approveIntervention(user, id, reason) {
    return transition(user, id, 'APPROVED', 'intervention.review', {
      action: 'intervention.approved',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Approval requires an explicit documented reason.',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.review_reason = reason;
        r.approved_at = now();
      },
      gate: function (r) {
        /* Successor-before-launch (presence-of-value: UNKNOWN is
         * honest and passes; blank fails). */
        var roleErr = criticalRolesError(r);
        if (roleErr.critical_roles) {
          return { critical_roles: roleErr.critical_roles };
        }
        /* No Orphan Project Rule: documented requirements OR the
         * explicit, auditable self_contained claim. */
        function hasSome(field) {
          return Array.isArray(r[field]) && r[field].length > 0;
        }
        var hasRequirements =
          ['required_capabilities', 'required_skills',
            'required_equipment', 'required_materials', 'required_tools',
            'required_infrastructure', 'required_energy',
            'required_spare_parts', 'required_repair_capability',
            'required_training', 'institutional_support',
            'external_dependencies', 'dependencies', 'critical_roles',
            'activities'].some(hasSome) ||
          !SCA.util.isBlank(r.fallback_arrangement) ||
          !SCA.util.isBlank(r.training_requirements) ||
          !SCA.util.isBlank(r.maintenance_requirements);
        if (!hasRequirements && !r.self_contained) {
          return { dependencies: 'Approval requires dependency ' +
            'disclosure: document the intervention\'s requirements ' +
            '(people, skills, equipment, materials, energy, spare ' +
            'parts, repair capability, training, institutional ' +
            'support, external dependencies…) or set the explicit, ' +
            'auditable self_contained claim. An intervention must not ' +
            'appear self-sufficient when its operation depends on ' +
            'undocumented external capabilities.' };
        }
        /* A creator can never approve their own intervention (double
         * guard: the RBAC matrix already separates the roles). */
        if (r.created_by === userName(user)) {
          return { creator: 'A creator cannot approve their own ' +
            'intervention.' };
        }
        return null;
      }
    });
  }

  /* UNDER_REVIEW -> DRAFT: return for correction — NOT a rejection;
   * the record returns to an editable planning state. */
  function returnForCorrection(user, id, reason) {
    return transition(user, id, 'DRAFT', 'intervention.review', {
      action: 'intervention.returned',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Returning for correction requires an explicit ' +
        'reason (audited).',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.review_reason = reason;
      }
    });
  }

  /* UNDER_REVIEW -> CANCELLED: intentional discard, terminal. */
  function cancelFromReview(user, id, reason) {
    return transition(user, id, 'CANCELLED', 'intervention.review', {
      action: 'intervention.cancelled',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Cancelling requires an explicit reason (audited).',
      stamp: function (r) {
        r.reviewer = userName(user);
        r.review_reason = reason;
        r.cancelled_at = now();
      }
    });
  }

  /* Execution-side transitions (intervention.update). */
  function activateIntervention(user, id) {
    return transition(user, id, 'ACTIVE', 'intervention.update', {
      action: 'intervention.activated',
      defaultReason: 'Implementation started.',
      stamp: function (r) { r.activated_at = now(); }
    });
  }

  function suspendIntervention(user, id, reason) {
    return transition(user, id, 'SUSPENDED', 'intervention.update', {
      action: 'intervention.suspended',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Suspension requires an explicit reason (audited).',
      stamp: function (r) { r.suspended_at = now(); }
    });
  }

  function resumeIntervention(user, id, reason) {
    return transition(user, id, 'ACTIVE', 'intervention.update', {
      action: 'intervention.resumed',
      reason: reason,
      requireReason: true,
      reasonMessage: 'Resumption requires an explicit reason (audited).',
      stamp: function (r) { r.suspended_at = null; }
    });
  }

  /* COMPLETED is terminal and NEVER implies outcome: completion does
   * not touch outcome_status, so COMPLETED + UNKNOWN is valid. */
  function completeIntervention(user, id) {
    return transition(user, id, 'COMPLETED', 'intervention.update', {
      action: 'intervention.completed',
      defaultReason: 'Implementation activity completed (outcome NOT ' +
        'implied; outcome status remains UNKNOWN until reviewed on ' +
        'evidence).',
      stamp: function (r) { r.completed_at = now(); }
    });
  }

  function cancelIntervention(user, id, reason) {
    return transition(user, id, 'CANCELLED', 'intervention.update', {
      action: 'intervention.cancelled',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Cancellation requires an explicit reason (audited).',
      stamp: function (r) { r.cancelled_at = now(); }
    });
  }

  /* ---------- outcome (reviewer-governed, categorical, never scored) ---------- */

  function setOutcomeStatus(user, id, outcome, reason) {
    if (!can(user, 'intervention.review')) {
      return deny('intervention.review');
    }
    var r = SCA.store.get('capability_interventions', id);
    if (!r) {
      return { ok: false, errors: { id: 'Intervention not found.' } };
    }
    /* Creator separation extends to outcome assessment: the
     * implementer never self-declares an outcome, even when they
     * hold review authority (e.g. the NATIONAL administrator). */
    if (r.created_by === userName(user)) {
      return { ok: false, errors: {
        creator: 'A creator cannot assess the outcome of their own ' +
          'intervention (reviewer separation; an implementer never ' +
          'self-declares an outcome).'
      } };
    }
    if (OUTCOMES.indexOf(outcome) === -1) {
      return { ok: false, errors: {
        outcome_status: 'Use one of: ' + OUTCOMES.join(', ') + '.'
      } };
    }
    if (r.status !== 'COMPLETED') {
      return { ok: false, errors: {
        status: 'Outcome can only be assessed on a COMPLETED ' +
          'intervention (current: ' + r.status + '). An ongoing ' +
          'activity has no honest outcome yet — it stays UNKNOWN.'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An outcome assessment requires an explicit reason.'
      } };
    }
    var from = r.outcome_status || 'UNKNOWN';
    if (outcome === from) {
      return { ok: false, errors: {
        outcome_status: 'The outcome is already ' + outcome + '.'
      } };
    }
    if (outcome !== 'UNKNOWN') {
      /* Frozen rule: changing from UNKNOWN requires outcome evidence
       * references (existing Stage 3/4 records only). */
      var ev = (r.outcome_evidence_source_ids || []).length +
        (r.outcome_knowledge_artifact_ids || []).length +
        (r.outcome_field_observation_ids || []).length;
      if (ev === 0) {
        return { ok: false, errors: {
          outcome_evidence: 'Assessing an outcome requires supporting ' +
          'outcome evidence: attach at least one evidence source, ' +
          'knowledge artifact or field observation (existing Stage ' +
          '3/4 records; Stage 10 never fabricates outcome evidence).'
        } };
      }
    }
    var evErrors = refsError(r, OUTCOME_REFERENCE_FIELDS);
    if (Object.keys(evErrors).length) {
      return { ok: false, errors: evErrors };
    }
    pushHistory(r, user, reason, 'OUTCOME');
    r.outcome_status = outcome;
    r.outcome_reviewer = userName(user);
    r.outcome_reviewed_at = now();
    r.outcome_reason = reason;
    r.updated_at = now();
    r.last_reason = reason;
    var res = SCA.store.update('capability_interventions', id, r);
    if (res.ok) {
      audited('intervention.outcome_set', id, user, { old_value: from,
        new_value: outcome, reason: reason });
    }
    return res;
  }

  /* ---------- retrieval ---------- */

  function visibleStatuses(user) {
    var isAnon = !(user && user.role);
    return isAnon ? PUBLIC_STATUSES : STATUSES;
  }

  function getIntervention(user, id) {
    if (!can(user, 'intervention.read')) { return deny('intervention.read'); }
    var r = SCA.store.get('capability_interventions', id);
    if (!r) {
      return { ok: false, errors: { id: 'Intervention not found.' } };
    }
    if (visibleStatuses(user).indexOf(r.status) === -1) {
      return { ok: false, errors: {
        permission: 'This intervention is not publicly visible ' +
          '(internal planning states are staff-only).'
      } };
    }
    return { ok: true, record: r };
  }

  function searchInterventions(user, filters) {
    if (!can(user, 'intervention.read')) { return deny('intervention.read'); }
    filters = filters || {};
    var visible = visibleStatuses(user);
    var out = SCA.store.all('capability_interventions')
      .filter(function (r) {
        if (visible.indexOf(r.status) === -1) { return false; }
        if (filters.status && r.status !== filters.status) { return false; }
        if (filters.intervention_type &&
          r.intervention_type !== filters.intervention_type) { return false; }
        if (filters.capability_id &&
          (r.capability_ids || []).indexOf(filters.capability_id) === -1) {
          return false;
        }
        if (filters.organization_id &&
          r.responsible_organization_id !== filters.organization_id) {
          return false;
        }
        if (filters.query) {
          var q = String(filters.query).toLowerCase();
          var hay = [r.name, r.description, r.objective,
            r.problem_description, r.implementation_region]
            .join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) { return false; }
        }
        return true;
      });
    /* Neutral deterministic ordering only — never evaluative. */
    out.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || '')) ||
        String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
    return { ok: true, results: out };
  }

  /* Label helper for pages (canonical record lookup only — never a
   * shadow record, and practitioner identities stay masked by the
   * existing Stage 5 privacy rules at the presentation layer). */
  function referenceLabel(collection, id) {
    var rec = SCA.store.get(collection, id);
    if (!rec) { return id; }
    return rec.name || rec.title || rec.code || id;
  }

  /* ---------- integrity (honest flags, never silent deletion) ---------- */

  function interventionIntegrity(user) {
    if (!can(user, 'intervention.read')) {
      return deny('intervention.read');
    }
    var errors = [];
    var warnings = [];
    function err(coll, id, field, message) {
      errors.push(coll + ' ' + id + ' -> ' + field + ': ' + message);
    }
    function warn(coll, id, field, message) {
      warnings.push(coll + ' ' + id + ' -> ' + field + ': ' + message);
    }
    var isTerminal = function (r) {
      return TERMINAL.indexOf(r.status) !== -1;
    };

    var seenAudit = {};
    SCA.store.all('capability_interventions').forEach(function (r) {
      if (!r) { return; }
      if (STATUSES.indexOf(r.status) === -1) {
        err('capability_interventions', r.id, 'status',
          'invalid status ' + r.status);
        return;
      }
      if (SCA.enums.codes(SCA.enums.intervention_types)
        .indexOf(r.intervention_type) === -1) {
        err('capability_interventions', r.id, 'intervention_type',
          'invalid type ' + r.intervention_type);
      }
      var terminal = isTerminal(r);

      /* Canonical references must resolve; terminal history follows
       * the established historical-reference exemption (warning, not
       * error — the reference is preserved, never silently deleted). */
      Object.keys(ALL_REFERENCE_FIELDS).forEach(function (field) {
        var coll = ALL_REFERENCE_FIELDS[field];
        (r[field] || []).forEach(function (rid) {
          if (!SCA.store.get(coll, rid)) {
            (terminal ? warn : err)('capability_interventions', r.id,
              field, 'unresolvable ' + coll + ' ' + rid +
              (terminal ? ' (terminal record: kept by the historical ' +
                'exemption, never deleted)' : ''));
          }
        });
      });
      if (r.responsible_organization_id &&
        !SCA.store.get('organizations', r.responsible_organization_id)) {
        (terminal ? warn : err)('capability_interventions', r.id,
          'responsible_organization_id', 'unresolvable organization ' +
          r.responsible_organization_id);
      }

      /* Critical roles: presence-of-value and honest UNKNOWN. */
      (r.critical_roles || []).forEach(function (role, i) {
        if (!role || SCA.util.isBlank(role.role)) {
          err('capability_interventions', r.id, 'critical_roles',
            'entry ' + (i + 1) + ' has no role label');
        } else if ((role.status || 'UNKNOWN') === 'IDENTIFIED') {
          if (!role.practitioner_id) {
            err('capability_interventions', r.id, 'critical_roles',
              'role "' + role.role + '" is IDENTIFIED without a ' +
              'practitioner reference');
          } else if (!SCA.store.get('practitioners',
            role.practitioner_id)) {
            (terminal ? warn : err)('capability_interventions', r.id,
              'critical_roles', 'role "' + role.role +
              '" references an unknown practitioner');
          }
        }
      });
      if (r.depends_on_human_capability &&
        (r.critical_roles || []).length === 0) {
        err('capability_interventions', r.id, 'critical_roles',
          'depends_on_human_capability is set but no critical roles ' +
          'are recorded');
      }

      /* Outcome governance: reviewer trail + evidence. */
      var outcome = r.outcome_status || 'UNKNOWN';
      if (outcome !== 'UNKNOWN') {
        if (SCA.util.isBlank(r.outcome_reviewer) ||
          SCA.util.isBlank(r.outcome_reason)) {
          err('capability_interventions', r.id, 'outcome_status',
            'outcome ' + outcome + ' is missing its reviewer trail');
        }
        if (r.status !== 'COMPLETED') {
          err('capability_interventions', r.id, 'outcome_status',
            'outcome ' + outcome + ' on a non-COMPLETED record ' +
            '(current: ' + r.status + ')');
        }
      }

      /* Self-contained claim honesty: a claim alongside documented
       * requirements is a documentation smell, flagged honestly. */
      if (r.self_contained) {
        warn('capability_interventions', r.id, 'self_contained',
          'records the explicit self-contained claim (auditable; ' +
          'verify it against the documented requirements)');
      }

      /* Lifecycle bookkeeping honesty. */
      if (r.status !== 'DRAFT' && !r.submitted_at) {
        warn('capability_interventions', r.id, 'submitted_at',
          'status is ' + r.status + ' but no submission is recorded');
      }
      if (r.status === 'APPROVED' && (!r.reviewer || !r.approved_at)) {
        err('capability_interventions', r.id, 'approved_at',
          'APPROVED record is missing its approval trail');
      }
      if (r.status === 'COMPLETED' && !r.completed_at) {
        err('capability_interventions', r.id, 'completed_at',
          'COMPLETED record has no completion timestamp');
      }
      if (r.status === 'CANCELLED' && SCA.util.isBlank(r.last_reason)) {
        err('capability_interventions', r.id, 'last_reason',
          'CANCELLED record has no recorded reason');
      }

      seenAudit[r.id] = true;
    });

    /* Duplicate-signature suppression is FORBIDDEN by the frozen
     * scope: multiple interventions for the same target are
     * legitimate competing approaches. Integrity never merges or
     * flags them. */
    return { ok: true, errors: errors, warnings: warnings,
      note: 'Integrity flags honestly; it never deletes, merges or ' +
        '"fixes" anything. Competing interventions for the same ' +
        'capability/problem are legitimate by the frozen scope and ' +
        'are never reported as duplicates.' };
  }

  /* ---------- public API ---------- */

  SCA.intervention = {
    /* frozen vocabulary (exported for pages, tests and inspection) */
    STATUSES: STATUSES,
    TERMINAL_STATUSES: TERMINAL,
    PUBLIC_STATUSES: PUBLIC_STATUSES,
    OUTCOMES: OUTCOMES,
    ROLE_STATUSES: ROLE_STATUSES,
    TRANSITIONS: TRANSITIONS,
    REFERENCE_FIELDS: REFERENCE_FIELDS,
    OUTCOME_REFERENCE_FIELDS: OUTCOME_REFERENCE_FIELDS,
    /* lifecycle */
    createIntervention: createIntervention,
    updateIntervention: updateIntervention,
    amendIntervention: amendIntervention,
    submitIntervention: submitIntervention,
    reviewIntervention: reviewIntervention,
    approveIntervention: approveIntervention,
    returnForCorrection: returnForCorrection,
    cancelFromReview: cancelFromReview,
    activateIntervention: activateIntervention,
    suspendIntervention: suspendIntervention,
    resumeIntervention: resumeIntervention,
    completeIntervention: completeIntervention,
    cancelIntervention: cancelIntervention,
    /* outcome */
    setOutcomeStatus: setOutcomeStatus,
    /* retrieval */
    getIntervention: getIntervention,
    searchInterventions: searchInterventions,
    referenceLabel: referenceLabel,
    /* integrity */
    integrity: interventionIntegrity
  };
})(SCA);
