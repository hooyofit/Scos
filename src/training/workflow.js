/*
 * Stage 5 workflow service: practitioner, competence, apprenticeship,
 * training and certification. Exposed as SCA.training.
 *
 * Core principle:
 * «A capability survives when knowledge can reproduce itself across
 *   people and generations.»
 *
 * The pathway represented (never fabricated):
 *   Practitioner → Evidence → Assessment → Competence → Trainer
 *     → Apprentice → Practice → Assessment → Competent Practitioner
 *     → New Trainer → Next Apprentice
 *
 * Hard rules enforced here:
 *  - Nobody becomes "Verified" automatically by being listed.
 *  - Competence levels are never assigned automatically; they change only
 *    through a reviewed assessment, applied intentionally, with audit.
 *  - Verification pathways stay DISTINCT — never collapsed into one
 *    "trusted" score.
 *  - No self-assessment, no self-certification.
 *  - Attendance is not certification; certification requires an ACCEPTED
 *    assessment.
 *  - can_teach is recorded, but is never alone proof of trainer competence.
 *  - S-family (S01-S20): listing ≠ endorsement, competence ≠ clinical
 *    safety, certification ≠ medical authorization. safety_notes required.
 *  - Everything works offline through SCA.store. No network, no cloud.
 */
(function (SCA) {
  'use strict';

  function userName(user) { return (user && user.name) || 'system'; }
  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function denied(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function E(list, code) { return SCA.enums.label(list, code); }
  function isFamilyS(capabilityId) {
    var c = SCA.store.get('capabilities', capabilityId);
    return !!(c && c.code && c.code.indexOf('S') === 0 &&
      c.family_id && SCA.store.get('families', c.family_id) &&
      SCA.store.get('families', c.family_id).code === 'S');
  }
  function bump(rec) {
    rec.version = String((parseInt(rec.version || '1', 10) || 1) + 1);
    return rec;
  }

  /* Controlled practitioner status transitions. These describe
     documentation/participation, NOT rankings. */
  var PRACTITIONER_TRANSITIONS = {
    CANDIDATE: ['DOCUMENTED', 'INACTIVE', 'WITHDRAWN', 'RETIRED', 'DECEASED'],
    DOCUMENTED: ['COMMUNITY_CONFIRMED', 'DEMONSTRATED', 'INACTIVE',
      'WITHDRAWN', 'RETIRED', 'DECEASED'],
    COMMUNITY_CONFIRMED: ['DEMONSTRATED', 'DOCUMENTED', 'INACTIVE',
      'WITHDRAWN', 'RETIRED', 'DECEASED'],
    DEMONSTRATED: ['ASSESSED', 'COMMUNITY_CONFIRMED', 'INACTIVE',
      'WITHDRAWN', 'RETIRED', 'DECEASED'],
    ASSESSED: ['VERIFIED', 'DEMONSTRATED', 'INACTIVE', 'WITHDRAWN',
      'RETIRED', 'DECEASED'],
    VERIFIED: ['INACTIVE', 'WITHDRAWN', 'RETIRED', 'DECEASED'],
    INACTIVE: ['CANDIDATE', 'DOCUMENTED', 'RETIRED', 'DECEASED'],
    RETIRED: ['DECEASED'],
    DECEASED: [],
    WITHDRAWN: ['CANDIDATE', 'DOCUMENTED']
  };

  /* ------------------------------------------------------------------ *
   * Practitioners
   * ------------------------------------------------------------------ */

  function createPractitioner(user, rec) {
    if (!can(user, 'practitioner.create')) { return denied('practitioner.create'); }
    rec = Object.assign({}, rec);
    /* Anonymous practitioners never expose identifying data publicly. */
    if (rec.anonymous_option) {
      rec.name = null;
      rec.public_name = 'Anonymous practitioner ' +
        (rec.practitioner_code || String(SCA.util.uuid()).slice(0, 8));
    }
    if (!rec.public_name) { return { ok: false, errors: { public_name: 'A public name (or anonymous mode) is required.' } }; }
    rec.verification_status = rec.verification_status || 'CANDIDATE';
    rec.competence_level = 'L0';           /* Unknown: never assigned. */
    rec.competence_status = rec.competence_status || 'NOT_ASSESSED';
    rec.knowledge_holder_type = rec.knowledge_holder_type || 'INDIVIDUAL';
    rec.contact_visibility = rec.contact_visibility || 'RESEARCH_TEAM';
    rec.verification_pathways = rec.verification_pathways || [];
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Recorded by ' + userName(user) + ' through the Atlas (Stage 5).');
    var res = SCA.store.insert('practitioners', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('practitioner.create', {
      actor: userName(user), entity: 'practitioners', entity_id: res.record.id,
      entity_code: res.record.practitioner_code || res.record.public_name,
      new_value: res.record.verification_status });
    return { ok: true, record: res.record };
  }

  function setPractitionerStatus(user, id, to, opts) {
    opts = opts || {};
    var rec = SCA.store.get('practitioners', id);
    if (!rec) { return { ok: false, errors: { id: 'Practitioner not found.' } }; }
    if (!E(SCA.enums.practitioner_statuses, to)) {
      return { ok: false, errors: { status: 'Unknown practitioner status: ' + to } };
    }
    var allowed = PRACTITIONER_TRANSITIONS[rec.verification_status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: {
        status: 'Status transition ' + rec.verification_status + ' -> ' + to +
          ' is not allowed.' } };
    }
    /* VERIFIED is a verification decision: separate authority + reason. */
    if (to === 'VERIFIED' && !can(user, 'practitioner.verify')) {
      return denied('practitioner.verify');
    }
    if (to === 'VERIFIED' && !opts.reason) {
      return { ok: false, errors: { reason: 'Verification requires a documented reason.' } };
    }
    if (!can(user, 'practitioner.edit') && !can(user, 'practitioner.verify')) {
      return denied('practitioner.edit');
    }
    var old = rec.verification_status;
    rec.verification_status = to;
    bump(rec);
    var res = SCA.store.update('practitioners', id, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('practitioner.status', {
      actor: userName(user), entity: 'practitioners', entity_id: id,
      entity_code: rec.practitioner_code || rec.public_name,
      old_value: old, new_value: to, reason: opts.reason || null });
    return { ok: true, record: res.record };
  }

  /* Verification pathways stay distinct — recorded, never collapsed. */
  function recordVerificationPathway(user, id, pathway, opts) {
    opts = opts || {};
    var rec = SCA.store.get('practitioners', id);
    if (!rec) { return { ok: false, errors: { id: 'Practitioner not found.' } }; }
    if (!can(user, 'practitioner.edit')) { return denied('practitioner.edit'); }
    if (!E(SCA.enums.verification_pathways, pathway)) {
      return { ok: false, errors: { pathway: 'Unknown verification pathway: ' + pathway } };
    }
    /* Assessor/institution verification are stronger claims than
       self-reporting; they need their supporting reference. */
    if ((pathway === 'ASSESSOR_VERIFIED' || pathway === 'INSTITUTION_VERIFIED') &&
      !can(user, 'practitioner.verify')) {
      return denied('practitioner.verify');
    }
    rec.verification_pathways = (rec.verification_pathways || []).concat([{
      pathway: pathway, recorded_by: userName(user),
      recorded_at: SCA.util.now(), evidence_ids: opts.evidence_ids || [],
      notes: opts.notes || null }]);
    bump(rec);
    var res = SCA.store.update('practitioners', id, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('practitioner.verification_pathway', {
      actor: userName(user), entity: 'practitioners', entity_id: id,
      entity_code: rec.practitioner_code || rec.public_name,
      new_value: pathway });
    return { ok: true, record: res.record };
  }

  /* §26: a research participant may BECOME a practitioner — but only via
     this explicit, audited action. Never automatic. */
  function promoteFromParticipant(user, participantId, extra) {
    if (!can(user, 'practitioner.create')) { return denied('practitioner.create'); }
    var p = SCA.store.get('participants', participantId);
    if (!p) { return { ok: false, errors: { participant_id: 'Research participant not found.' } }; }
    var rec = Object.assign({
      public_name: p.public_name,
      anonymous_option: p.anonymous,
      community: p.community,
      consent_id: p.consent_id,
      provenance: 'Promoted from research participant ' + p.id +
        ' (session ' + p.session_id + ') by ' + userName(user) +
        '. Consent: ' + (p.consent_id || 'see participant record') + '.'
    }, extra || {});
    var res = createPractitioner(user, rec);
    if (res.ok) {
      SCA.audit.log('practitioner.promoted_from_participant', {
        actor: userName(user), entity: 'practitioners', entity_id: res.record.id,
        entity_code: res.record.public_name,
        reason: 'Intentional promotion from research participant ' + participantId });
    }
    return res;
  }

  /* ------------------------------------------------------------------ *
   * Competence assessment
   * ------------------------------------------------------------------ */

  function createAssessment(user, rec) {
    if (!can(user, 'assessment.create')) { return denied('assessment.create'); }
    rec = Object.assign({}, rec);
    var practitioner = rec.practitioner_id ? SCA.store.get('practitioners', rec.practitioner_id) : null;
    var apprentice = rec.apprentice_id ? SCA.store.get('apprentices', rec.apprentice_id) : null;
    if (!practitioner && !apprentice) {
      return { ok: false, errors: { practitioner_id: 'Assessment requires an existing practitioner or apprentice.' } };
    }
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id: 'Assessment requires an existing capability.' } };
    }
    /* No self-assessment: the EFFECTIVE assessor is compared against the
       person being assessed (explicit assessor_id included). */
    rec.assessor_id = rec.assessor_id || userName(user);
    var assessedTarget = practitioner ? (practitioner.user_id || practitioner.public_name)
      : (apprentice.user_id || apprentice.public_name);
    if (assessedTarget === rec.assessor_id || assessedTarget === userName(user) ||
      (practitioner && practitioner.name === rec.assessor_id)) {
      return { ok: false, errors: { assessor_id: 'A person cannot assess themselves.' } };
    }
    /* S-family: assessment must document safety, not clinical claims. */
    if (isFamilyS(rec.capability_id) && !rec.safety_notes) {
      return { ok: false, errors: { safety_notes: 'Family-S capability assessments require safety notes (documenting practice is not medical advice).' } };
    }
    rec.review_status = 'PENDING';
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Assessed by ' + rec.assessor_id + ' through the Atlas (Stage 5).');
    var res = SCA.store.insert('competence_assessments', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('assessment.create', {
      actor: userName(user), entity: 'competence_assessments',
      entity_id: res.record.id, new_value: rec.result });
    return { ok: true, record: res.record };
  }

  function reviewAssessment(user, id, opts) {
    opts = opts || {};
    if (!can(user, 'assessment.review')) { return denied('assessment.review'); }
    var rec = SCA.store.get('competence_assessments', id);
    if (!rec) { return { ok: false, errors: { id: 'Assessment not found.' } }; }
    var decision = opts.decision;
    if (['ACCEPTED', 'REJECTED', 'SUPERSEDED'].indexOf(decision) === -1) {
      return { ok: false, errors: { decision: 'decision must be ACCEPTED, REJECTED or SUPERSEDED.' } };
    }
    if (decision === 'REJECTED' && !opts.reason) {
      return { ok: false, errors: { reason: 'Rejecting an assessment requires a documented reason.' } };
    }
    var old = rec.review_status;
    rec.review_status = decision;
    rec.reviewer = userName(user);
    rec.reviewed_at = SCA.util.now();
    if (opts.reason) { rec.notes = (rec.notes ? rec.notes + ' | ' : '') + 'Review: ' + opts.reason; }
    bump(rec);
    var res = SCA.store.update('competence_assessments', id, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('assessment.review', {
      actor: userName(user), entity: 'competence_assessments', entity_id: id,
      old_value: old, new_value: decision, reason: opts.reason || null });
    /* Intentional application: the accepted assessment may update the
       practitioner's demonstrated competence — explicit, audited, never
       automatic. */
    if (decision === 'ACCEPTED' && opts.apply !== false &&
      (rec.practitioner_id || rec.apprentice_id) && rec.competence_level) {
      var applied = applyAssessment(user, id);
      if (!applied.ok) { return applied; }
    }
    return { ok: true, record: res.record };
  }

  function applyAssessment(user, id) {
    var rec = SCA.store.get('competence_assessments', id);
    if (!rec) { return { ok: false, errors: { id: 'Assessment not found.' } }; }
    if (rec.review_status !== 'ACCEPTED') {
      return { ok: false, errors: { review_status: 'Only ACCEPTED assessments can be applied to a practitioner\'s competence.' } };
    }
    var p = rec.practitioner_id ? SCA.store.get('practitioners', rec.practitioner_id) : null;
    var a = rec.apprentice_id ? SCA.store.get('apprentices', rec.apprentice_id) : null;
    if (!p && !a) { return { ok: false, errors: { practitioner_id: 'Target person not found.' } }; }
    if (p) {
      var oldLevel = p.competence_level, oldStatus = p.competence_status;
      p.competence_level = rec.competence_level || p.competence_level;
      p.competence_status = rec.result || p.competence_status;
      p.assessment_history = (p.assessment_history || []).concat([{
        assessment_id: id, result: rec.result, level: rec.competence_level,
        applied_by: userName(user), applied_at: SCA.util.now() }]);
      if (rec.verification_status_hint !== false) {
        /* An accepted assessment supports "Assessed" documentation status,
           but never "Verified" — verification is a separate authority. */
        if (p.verification_status === 'DEMONSTRATED' || p.verification_status === 'COMMUNITY_CONFIRMED') {
          p.verification_status = 'ASSESSED';
        }
      }
      bump(p);
      var res = SCA.store.update('practitioners', p.id, p);
      if (!res.ok) { return res; }
      SCA.audit.log('assessment.applied', {
        actor: userName(user), entity: 'practitioners', entity_id: p.id,
        entity_code: p.practitioner_code || p.public_name,
        old_value: oldLevel + '/' + oldStatus,
        new_value: p.competence_level + '/' + p.competence_status,
        reason: 'Assessment ' + id });
    }
    if (a) {
      var oldL = a.current_level;
      a.current_level = rec.competence_level || a.current_level;
      a.assessments = (a.assessments || []).concat([{
        assessment_id: id, result: rec.result, level: rec.competence_level }]);
      a.assessment_status = rec.result;
      bump(a);
      var resA = SCA.store.update('apprentices', a.id, a);
      if (!resA.ok) { return resA; }
      SCA.audit.log('assessment.applied', {
        actor: userName(user), entity: 'apprentices', entity_id: a.id,
        old_value: oldL, new_value: a.current_level, reason: 'Assessment ' + id });
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ *
   * Trainer development
   * ------------------------------------------------------------------ */

  /* §10-11: can_teach is recorded but never alone proof of trainer
     competence. Trainer readiness is a documented, audited decision. */
  function designateTrainer(user, practitionerId, opts) {
    opts = opts || {};
    if (!can(user, 'assessment.review') && !can(user, 'practitioner.verify')) {
      return denied('assessment.review');
    }
    var p = SCA.store.get('practitioners', practitionerId);
    if (!p) { return { ok: false, errors: { id: 'Practitioner not found.' } }; }
    if (!E(SCA.enums.trainer_readiness, opts.readiness)) {
      return { ok: false, errors: { readiness: 'readiness must be a trainer_readiness value.' } };
    }
    /* Trainer designation should be grounded in a TRAINER_ASSESSMENT when
       claiming READY or ACTIVE_TRAINER. */
    if ((opts.readiness === 'READY' || opts.readiness === 'ACTIVE_TRAINER')) {
      var hasTrainerAssessment = opts.assessment_id ||
        (p.trainer_assessment_id &&
          (SCA.store.get('competence_assessments', p.trainer_assessment_id) || {}).review_status === 'ACCEPTED');
      if (!hasTrainerAssessment) {
        return { ok: false, errors: { assessment_id: 'Trainer designation requires an accepted trainer assessment.' } };
      }
    }
    var old = p.trainer_readiness || null;
    p.trainer_readiness = opts.readiness;
    p.can_teach = opts.readiness === 'READY' || opts.readiness === 'ACTIVE_TRAINER'
      ? true : (p.can_teach === undefined ? false : p.can_teach);
    if (opts.assessment_id) { p.trainer_assessment_id = opts.assessment_id; }
    if (opts.apprentice_capacity !== undefined) { p.apprentice_capacity = opts.apprentice_capacity; }
    bump(p);
    var res = SCA.store.update('practitioners', practitionerId, p);
    if (!res.ok) { return res; }
    SCA.audit.log('trainer.designated', {
      actor: userName(user), entity: 'practitioners', entity_id: practitionerId,
      entity_code: p.practitioner_code || p.public_name,
      old_value: old, new_value: opts.readiness, reason: opts.reason || null });
    return { ok: true, record: res.record };
  }

  /* §20: succession planning — sensitive, never public without consent. */
  function designateSuccessor(user, practitionerId, opts) {
    opts = opts || {};
    if (!can(user, 'practitioner.edit')) { return denied('practitioner.edit'); }
    var p = SCA.store.get('practitioners', practitionerId);
    if (!p) { return { ok: false, errors: { id: 'Practitioner not found.' } }; }
    if (!opts.successor_apprentice_id && !opts.successor_practitioner_id) {
      return { ok: false, errors: { successor: 'A successor (apprentice or practitioner) is required.' } };
    }
    p.successor = {
      successor_apprentice_id: opts.successor_apprentice_id || null,
      successor_practitioner_id: opts.successor_practitioner_id || null,
      candidate_type: opts.candidate_type || null,
      knowledge_archive_status: opts.knowledge_archive_status || null,
      documentation_status: opts.documentation_status || null,
      notes: opts.notes || null,
      designated_by: userName(user), designated_at: SCA.util.now(),
      /* Succession is private by default: only surfaced with explicit
         authorization. */
      public_disclosure: opts.public_disclosure === true
    };
    bump(p);
    var res = SCA.store.update('practitioners', practitionerId, p);
    if (!res.ok) { return res; }
    SCA.audit.log('successor.designated', {
      actor: userName(user), entity: 'practitioners', entity_id: practitionerId,
      entity_code: p.practitioner_code || p.public_name,
      new_value: opts.successor_apprentice_id || opts.successor_practitioner_id });
    return { ok: true, record: res.record };
  }

  /* ------------------------------------------------------------------ *
   * Apprentices
   * ------------------------------------------------------------------ */

  function createApprentice(user, rec) {
    if (!can(user, 'apprentice.create')) { return denied('apprentice.create'); }
    rec = Object.assign({}, rec);
    if (rec.anonymous_option) {
      rec.name = null;
      rec.public_name = 'Anonymous apprentice ' +
        (rec.apprentice_code || String(SCA.util.uuid()).slice(0, 8));
    }
    if (!rec.public_name) { return { ok: false, errors: { public_name: 'A public name (or anonymous mode) is required.' } }; }
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id: 'Apprentice requires an existing capability.' } };
    }
    rec.current_level = rec.current_level || 'L0';
    rec.certification_status = rec.certification_status || null;
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Registered by ' + userName(user) + ' through the Atlas (Stage 5).');
    var res = SCA.store.insert('apprentices', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('apprentice.create', {
      actor: userName(user), entity: 'apprentices', entity_id: res.record.id,
      entity_code: res.record.apprentice_code || res.record.public_name });
    return { ok: true, record: res.record };
  }

  /* ------------------------------------------------------------------ *
   * Apprenticeships
   * ------------------------------------------------------------------ */

  function createApprenticeship(user, rec) {
    if (!can(user, 'apprenticeship.manage')) { return denied('apprenticeship.manage'); }
    rec = Object.assign({}, rec);
    if (!SCA.store.get('apprentices', rec.apprentice_id)) {
      return { ok: false, errors: { apprentice_id: 'Apprenticeship requires an existing apprentice.' } };
    }
    var mentor = SCA.store.get('practitioners', rec.mentor_id);
    if (!mentor) {
      return { ok: false, errors: { mentor_id: 'Apprenticeship requires an existing mentor (practitioner).' } };
    }
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id: 'Apprenticeship requires an existing capability.' } };
    }
    if (rec.program_id && !SCA.store.get('training_programs', rec.program_id)) {
      return { ok: false, errors: { program_id: 'Training program not found.' } };
    }
    /* Milestones: copied from the program's OWN list, or entered directly.
       No universal checklist. */
    if (!rec.milestones || rec.milestones.length === 0) {
      var program = rec.program_id ? SCA.store.get('training_programs', rec.program_id) : null;
      if (program && program.suggested_milestones) {
        rec.milestones = program.suggested_milestones.map(function (t) {
          return { id: SCA.util.uuid(), title: t, status: 'PENDING' };
        });
      } else {
        rec.milestones = [];
      }
    }
    rec.status = rec.status || 'PLANNED';
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Registered by ' + userName(user) + ' through the Atlas (Stage 5).');
    var res = SCA.store.insert('apprenticeships', rec);
    if (!res.ok) { return res; }
    /* Mentor relationship recorded on the apprentice too. */
    var ap = SCA.store.get('apprentices', rec.apprentice_id);
    ap.mentor_ids = (ap.mentor_ids || []);
    if (ap.mentor_ids.indexOf(rec.mentor_id) === -1) { ap.mentor_ids.push(rec.mentor_id); }
    SCA.store.update('apprentices', ap.id, ap);
    SCA.audit.log('apprenticeship.create', {
      actor: userName(user), entity: 'apprenticeships', entity_id: res.record.id,
      new_value: rec.status });
    return { ok: true, record: res.record };
  }

  var APPRENTICESHIP_TRANSITIONS = {
    PLANNED: ['ACTIVE', 'WITHDRAWN', 'DISCONTINUED'],
    ACTIVE: ['PAUSED', 'COMPLETED', 'WITHDRAWN', 'DISCONTINUED'],
    PAUSED: ['ACTIVE', 'WITHDRAWN', 'DISCONTINUED'],
    COMPLETED: [],
    WITHDRAWN: ['ACTIVE'],
    DISCONTINUED: ['ACTIVE']
  };

  function updateApprenticeshipStatus(user, id, to, opts) {
    opts = opts || {};
    if (!can(user, 'apprenticeship.manage')) { return denied('apprenticeship.manage'); }
    var rec = SCA.store.get('apprenticeships', id);
    if (!rec) { return { ok: false, errors: { id: 'Apprenticeship not found.' } }; }
    if (!E(SCA.enums.apprenticeship_statuses, to)) {
      return { ok: false, errors: { status: 'Unknown apprenticeship status: ' + to } };
    }
    var allowed = APPRENTICESHIP_TRANSITIONS[rec.status] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: { status: 'Apprenticeship transition ' + rec.status + ' -> ' + to + ' is not allowed.' } };
    }
    /* Interruption reasons are recorded, not judged: discontinuation is
       not automatically failure. */
    if ((to === 'WITHDRAWN' || to === 'DISCONTINUED') && !opts.reason) {
      return { ok: false, errors: { reason: 'Interruption requires a documented reason (recorded, not judged).' } };
    }
    if (to === 'COMPLETED') {
      if (!opts.completion_status || !E(SCA.enums.completion_statuses, opts.completion_status)) {
        return { ok: false, errors: { completion_status: 'Completion requires a completion status.' } };
      }
      rec.completion_status = opts.completion_status;
      rec.actual_end_date = opts.actual_end_date || SCA.util.now().slice(0, 10);
    }
    var old = rec.status;
    rec.status = to;
    if (opts.reason) { rec.interruption_reason = opts.reason; }
    bump(rec);
    var res = SCA.store.update('apprenticeships', id, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('apprenticeship.status', {
      actor: userName(user), entity: 'apprenticeships', entity_id: id,
      old_value: old, new_value: to, reason: opts.reason || null });
    return { ok: true, record: res.record };
  }

  function completeMilestone(user, apprenticeshipId, milestoneId, opts) {
    opts = opts || {};
    if (!can(user, 'apprenticeship.manage')) { return denied('apprenticeship.manage'); }
    var rec = SCA.store.get('apprenticeships', apprenticeshipId);
    if (!rec) { return { ok: false, errors: { id: 'Apprenticeship not found.' } }; }
    var ms = (rec.milestones || []).filter(function (m) { return m.id === milestoneId; })[0];
    if (!ms) { return { ok: false, errors: { milestone_id: 'Milestone not found on this apprenticeship.' } }; }
    if (!E(SCA.enums.milestone_statuses, opts.status || 'COMPLETED')) {
      return { ok: false, errors: { status: 'Unknown milestone status.' } };
    }
    var old = ms.status;
    ms.status = opts.status || 'COMPLETED';
    ms.completed_date = ms.status === 'COMPLETED' ? SCA.util.now().slice(0, 10) : null;
    if (opts.evidence_ids) { ms.evidence_ids = opts.evidence_ids; }
    bump(rec);
    var res = SCA.store.update('apprenticeships', apprenticeshipId, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('apprenticeship.milestone', {
      actor: userName(user), entity: 'apprenticeships', entity_id: apprenticeshipId,
      old_value: old, new_value: ms.status, reason: ms.title });
    return { ok: true, record: res.record };
  }

  /* ------------------------------------------------------------------ *
   * Training programs
   * ------------------------------------------------------------------ */

  function createTrainingProgram(user, rec) {
    if (!can(user, 'training.create')) { return denied('training.create'); }
    rec = Object.assign({}, rec);
    if (rec.capability_ids && rec.capability_ids.some(function (id) {
      return !SCA.store.get('capabilities', id); })) {
      return { ok: false, errors: { capability_ids: 'Training program references unknown capabilities.' } };
    }
    rec.status = rec.status || 'DRAFT';
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Designed by ' + userName(user) + ' through the Atlas (Stage 5).');
    var res = SCA.store.insert('training_programs', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('training_program.create', {
      actor: userName(user), entity: 'training_programs', entity_id: res.record.id,
      entity_code: res.record.program_code || res.record.title });
    return { ok: true, record: res.record };
  }

  var PROGRAM_TRANSITIONS = {
    DRAFT: ['APPROVED', 'RETIRED'],
    APPROVED: ['ACTIVE', 'RETIRED'],
    ACTIVE: ['PAUSED', 'RETIRED'],
    PAUSED: ['ACTIVE', 'RETIRED'],
    RETIRED: []
  };

  function setTrainingProgramStatus(user, id, to, opts) {
    opts = opts || {};
    var rec = SCA.store.get('training_programs', id);
    if (!rec) { return { ok: false, errors: { id: 'Training program not found.' } }; }
    if (PROGRAM_TRANSITIONS[rec.status].indexOf(to) === -1) {
      return { ok: false, errors: { status: 'Training program transition ' + rec.status + ' -> ' + to + ' is not allowed.' } };
    }
    if (to === 'APPROVED') {
      if (!can(user, 'training.approve')) { return denied('training.approve'); }
      if (!opts.reason) { return { ok: false, errors: { reason: 'Program approval requires a documented reason.' } }; }
      rec.approved_by = userName(user);
      rec.approved_at = SCA.util.now();
    } else if (!can(user, 'training.edit')) {
      return denied('training.edit');
    }
    var old = rec.status;
    rec.status = to;
    bump(rec);
    var res = SCA.store.update('training_programs', id, rec);
    if (!res.ok) { return res; }
    SCA.audit.log('training_program.status', {
      actor: userName(user), entity: 'training_programs', entity_id: id,
      entity_code: rec.program_code || rec.title,
      old_value: old, new_value: to, reason: opts.reason || null });
    return { ok: true, record: res.record };
  }

  /* ------------------------------------------------------------------ *
   * Certification
   * ------------------------------------------------------------------ */

  /* Certification is competence-based: an ACCEPTED assessment is always
     required. Attendance is not certification. No self-certification. */
  function issueCertification(user, rec) {
    if (!can(user, 'certification.issue')) { return denied('certification.issue'); }
    rec = Object.assign({}, rec);
    var practitioner = rec.practitioner_id ? SCA.store.get('practitioners', rec.practitioner_id) : null;
    var apprentice = rec.apprentice_id ? SCA.store.get('apprentices', rec.apprentice_id) : null;
    if (!practitioner && !apprentice) {
      return { ok: false, errors: { practitioner_id: 'Certification requires an existing practitioner or apprentice.' } };
    }
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id: 'Certification requires an existing capability.' } };
    }
    var assessment = rec.assessment_id ? SCA.store.get('competence_assessments', rec.assessment_id) : null;
    if (!assessment) {
      return { ok: false, errors: { assessment_id: 'Certification requires a competence assessment.' } };
    }
    if (assessment.review_status !== 'ACCEPTED') {
      return { ok: false, errors: { assessment_id: 'Only an ACCEPTED assessment can ground a certification (attendance is not certification).' } };
    }
    /* No self-certification — for practitioners AND apprentices. The
       EFFECTIVE issuer is compared against the person being certified. */
    var issuedBy = rec.issued_by || userName(user);
    var target = practitioner ? (practitioner.user_id || practitioner.public_name)
      : (apprentice.user_id || apprentice.public_name);
    if (target === issuedBy || target === userName(user) ||
      (practitioner && practitioner.name === issuedBy)) {
      return { ok: false, errors: { issued_by: 'A person cannot certify themselves.' } };
    }
    if (!E(SCA.enums.competence_levels, rec.certification_level)) {
      return { ok: false, errors: { certification_level: 'certification_level must be an L0-L5 competence level.' } };
    }
    /* Medical capabilities: certification documents demonstrated practice;
       it is NEVER medical authorization. */
    if (isFamilyS(rec.capability_id) && !rec.safety_notes) {
      return { ok: false, errors: { safety_notes: 'Family-S certification requires safety notes: certification is not medical authorization.' } };
    }
    rec.issued_by = rec.issued_by || userName(user);
    rec.issued_date = rec.issued_date || SCA.util.now().slice(0, 10);
    rec.status = rec.status || 'ISSUED';
    rec.version = '1';
    rec.provenance = rec.provenance ||
      ('Certified by ' + rec.issued_by + ' through the Atlas (Stage 5), based on assessment ' + rec.assessment_id + '.');
    var res = SCA.store.insert('capability_certifications', rec);
    if (!res.ok) { return res; }
    /* Record on the person. */
    if (practitioner) {
      practitioner.certification_status = 'ISSUED';
      practitioner.assessment_history = practitioner.assessment_history || [];
      SCA.store.update('practitioners', practitioner.id, practitioner);
    }
    if (apprentice) {
      apprentice.certification_status = 'ISSUED';
      SCA.store.update('apprentices', apprentice.id, apprentice);
    }
    SCA.audit.log('certification.issued', {
      actor: userName(user), entity: 'capability_certifications',
      entity_id: res.record.id, entity_code: rec.certification_code || null,
      new_value: rec.certification_level + ' for capability ' + rec.capability_id });
    return { ok: true, record: res.record };
  }

  function suspendCertification(user, id, reason) {
    return changeCertificationStatus(user, id, 'SUSPENDED', reason);
  }
  function revokeCertification(user, id, reason) {
    return changeCertificationStatus(user, id, 'REVOKED', reason);
  }
  function changeCertificationStatus(user, id, to, reason) {
    if (!can(user, 'certification.revoke')) { return denied('certification.revoke'); }
    var rec = SCA.store.get('capability_certifications', id);
    if (!rec) { return { ok: false, errors: { id: 'Certification not found.' } }; }
    if (rec.status !== 'ISSUED' && rec.status !== 'PENDING' && rec.status !== 'SUSPENDED') {
      return { ok: false, errors: { status: 'Only Issued/Pending/Suspended certifications can change to ' + to + '.' } };
    }
    if (!reason) { return { ok: false, errors: { reason: 'Certification ' + to.toLowerCase() + ' requires a documented reason.' } }; }
    var old = rec.status;
    rec.status = to;
    if (to === 'SUSPENDED') { rec.suspension_reason = reason; }
    if (to === 'REVOKED') { rec.revocation_reason = reason; }
    bump(rec);
    var res = SCA.store.update('capability_certifications', id, rec);
    if (!res.ok) { return res; }
    var person = rec.practitioner_id ? SCA.store.get('practitioners', rec.practitioner_id) : null;
    /* The practitioner's certification status follows changes made to
       their certifications (Issued -> Suspended -> Revoked), while the
       certification records themselves always keep their history. */
    if (person && ['ISSUED', 'SUSPENDED', 'PENDING']
      .indexOf(person.certification_status) !== -1) {
      person.certification_status = to;
      SCA.store.update('practitioners', person.id, person);
    }
    SCA.audit.log('certification.' + to.toLowerCase(), {
      actor: userName(user), entity: 'capability_certifications', entity_id: id,
      old_value: old, new_value: to, reason: reason });
    return { ok: true, record: res.record };
  }

  /* ------------------------------------------------------------------ *
   * Apprentice Passport (offline, exportable, privacy-aware)
   * ------------------------------------------------------------------ */

  function getPassport(user, apprenticeId) {
    var a = SCA.store.get('apprentices', apprenticeId);
    if (!a) { return { ok: false, errors: { id: 'Apprentice not found.' } }; }
    var authorized = can(user, 'apprentice.read') || can(user, 'reproduction.read');
    if (!authorized) { return denied('apprentice.read'); }
    var apprenticeships = SCA.store.all('apprenticeships').filter(function (s) {
      return s.apprentice_id === apprenticeId; });
    var assessments = SCA.store.all('competence_assessments').filter(function (m) {
      return m.apprentice_id === apprenticeId; });
    var certifications = SCA.store.all('capability_certifications').filter(function (c) {
      return c.apprentice_id === apprenticeId; });
    var mentors = (a.mentor_ids || []).map(function (id) {
      var p = SCA.store.get('practitioners', id);
      return p ? { id: p.id, public_name: p.public_name,
        competence_level: p.competence_level || 'L0',
        trainer_readiness: p.trainer_readiness || null } : null;
    }).filter(Boolean);
    return { ok: true, passport: {
      kind: 'apprentice_passport',
      schema_version: SCA.SCHEMA_VERSION,
      /* Anonymous apprentices show masked names only. */
      apprentice: {
        id: a.id,
        /* public_name is masked at creation for anonymous apprentices. */
        public_name: a.public_name,
        anonymous: a.anonymous_option === true,
        capability_id: a.capability_id,
        current_level: a.current_level || 'L0',
        target_level: a.target_level || null,
        training_start: a.training_start || null,
        practical_hours: a.practical_hours || 0,
        demonstrations_completed: a.demonstrations_completed || 0,
        employment: a.employment || null,
        trainer_ready: a.trainer_ready === true,
        portfolio: a.portfolio || [],
        region: a.region || null
      },
      mentors: mentors,
      apprenticeships: apprenticeships.map(function (s) {
        return { id: s.id, capability_id: s.capability_id, status: s.status,
          start_date: s.start_date || null, mentor_id: s.mentor_id,
          practical_hours: s.practical_hours || 0,
          milestones: s.milestones || [],
          completion_status: s.completion_status || null,
          successor_pathway: s.successor_pathway === true };
      }),
      assessments: assessments.map(function (m) {
        return { id: m.id, capability_id: m.capability_id,
          assessment_type: m.assessment_type, result: m.result,
          competence_level: m.competence_level || null,
          review_status: m.review_status,
          assessment_date: m.assessment_date || null };
      }),
      certifications: certifications.map(function (c) {
        return { id: c.id, capability_id: c.capability_id,
          certification_level: c.certification_level, status: c.status,
          issued_by: c.issued_by, issued_date: c.issued_date,
          scope: c.scope || null, limitations: c.limitations || null };
      }),
      generated_at: SCA.util.now()
    } };
  }

  function exportPassport(user, apprenticeId) {
    var res = getPassport(user, apprenticeId);
    if (!res.ok) { return res; }
    return { ok: true, json: JSON.stringify(res.passport, null, 2) };
  }

  /* ------------------------------------------------------------------ *
   * Capability reproduction profile — measurements, never judgments
   * ------------------------------------------------------------------ */

  /* Raw facts needed later for continuity analysis. No national score, no
     ranking. If a value cannot be calculated reliably it is null
     (displayed as Unknown), never zero. */
  function reproductionProfile(capabilityId) {
    var practitioners = SCA.store.all('practitioners').filter(function (p) {
      return (p.capability_ids || []).indexOf(capabilityId) !== -1 ||
        (p.capabilities || []).indexOf(capabilityId) !== -1; });
    var apprenticeships = SCA.store.all('apprenticeships').filter(function (s) {
      return s.capability_id === capabilityId; });
    var apprentices = SCA.store.all('apprentices').filter(function (a) {
      return a.capability_id === capabilityId; });
    var assessments = SCA.store.all('competence_assessments').filter(function (m) {
      return m.capability_id === capabilityId; });
    var certifications = SCA.store.all('capability_certifications').filter(function (c) {
      return c.capability_id === capabilityId; });
    var orgIds = {};
    practitioners.forEach(function (p) {
      if (p.organization_id) { orgIds[p.organization_id] = true; } });
    apprenticeships.forEach(function (s) {
      if (s.organization_id) { orgIds[s.organization_id] = true; } });
    SCA.store.all('training_programs').forEach(function (t) {
      if ((t.capability_ids || []).indexOf(capabilityId) !== -1 && t.organization_id) {
        orgIds[t.organization_id] = true; } });
    var regions = {};
    practitioners.forEach(function (p) {
      if (p.region) { regions[p.region] = true; }
      (p.region_ids || []).forEach(function (r) { regions[r] = true; }); });
    var verified = practitioners.filter(function (p) {
      return p.verification_status === 'VERIFIED'; });
    var trainers = practitioners.filter(function (p) {
      return p.trainer_readiness === 'READY' || p.trainer_readiness === 'ACTIVE_TRAINER'; });
    var verifiedDates = verified.map(function (p) {
      return (SCA.audit.forEntity('practitioners', p.id)
        .filter(function (e) { return e.action === 'practitioner.status' && e.new_value === 'VERIFIED'; })[0] || {}).timestamp;
    }).filter(Boolean).sort();
    return {
      capability_id: capabilityId,
      practitioner_count: practitioners.length,
      verified_practitioner_count: verified.length,
      trainer_count: trainers.length,
      active_apprentice_count: apprenticeships.filter(function (s) {
        return s.status === 'ACTIVE'; }).length,
      completed_apprenticeship_count: apprenticeships.filter(function (s) {
        return s.status === 'COMPLETED'; }).length,
      apprentice_count: apprentices.length,
      assessment_count: assessments.length,
      certification_count: certifications.length,
      geographic_coverage: Object.keys(regions),
      organizations_with_capability: Object.keys(orgIds),
      /* Unknown, not zero, when nothing is documented. */
      documentation_status: practitioners.length === 0
        ? 'NOT_YET_DOCUMENTED' : 'PARTIALLY_DOCUMENTED',
      last_verified: verifiedDates.length ? verifiedDates[verifiedDates.length - 1] : null
    };
  }

  /* ------------------------------------------------------------------ *
   * Privacy-aware public view
   * ------------------------------------------------------------------ */

  /* The public Atlas shows only what consent allows: no anonymous
     identities, no private contact, no succession data. */
  function publicPractitioners() {
    return SCA.store.all('practitioners').filter(function (p) {
      return p.contact_visibility === 'PUBLIC' &&
        p.documentation_consent === true &&
        p.anonymous_option !== true;
    }).map(function (p) {
      return { id: p.id, public_name: p.public_name,
        capability_ids: p.capability_ids || p.capabilities || [],
        region: p.region || null,
        competence_level: p.competence_level || 'L0',
        verification_status: p.verification_status,
        can_teach: p.can_teach === true,
        availability: p.availability || null };
    });
  }

  function profileFor(user, practitionerId) {
    var p = SCA.store.get('practitioners', practitionerId);
    if (!p) { return null; }
    var isSelf = user && (user.name === p.user_id || user.name === p.name);
    var authorized = can(user, 'practitioner.edit') || can(user, 'practitioner.verify');
    var showPrivate = isSelf || authorized;
    var profile = {
      id: p.id, public_name: p.public_name,
      anonymous: p.anonymous_option === true,
      capability_ids: p.capability_ids || p.capabilities || [],
      region: p.region || null, community: p.community || null,
      experience_years: p.experience_years || null,
      competence_level: p.competence_level || 'L0',
      competence_status: p.competence_status || 'NOT_ASSESSED',
      verification_status: p.verification_status,
      verification_pathways: (p.verification_pathways || []).map(function (v) {
        return v.pathway; }),
      can_teach: p.can_teach === true,
      trainer_readiness: p.trainer_readiness || null,
      apprentice_capacity: p.apprentice_capacity || null,
      availability: p.availability || null,
      languages: p.languages || [],
      knowledge_holder_type: p.knowledge_holder_type || 'INDIVIDUAL',
      organization_id: p.organization_id || null
    };
    if (showPrivate) {
      profile.name = p.name || null;
      profile.contact_visibility = p.contact_visibility;
      /* Succession is sensitive: shown only to verification authority
         (or if disclosure was explicitly authorized), never to every
         documenting role. */
      if (p.successor && (p.successor.public_disclosure ||
        can(user, 'practitioner.verify'))) {
        profile.successor = p.successor;
      }
    }
    return profile;
  }

  SCA.training = {
    createPractitioner: createPractitioner,
    setPractitionerStatus: setPractitionerStatus,
    recordVerificationPathway: recordVerificationPathway,
    promoteFromParticipant: promoteFromParticipant,
    createAssessment: createAssessment,
    reviewAssessment: reviewAssessment,
    applyAssessment: applyAssessment,
    designateTrainer: designateTrainer,
    designateSuccessor: designateSuccessor,
    createApprentice: createApprentice,
    createApprenticeship: createApprenticeship,
    updateApprenticeshipStatus: updateApprenticeshipStatus,
    completeMilestone: completeMilestone,
    createTrainingProgram: createTrainingProgram,
    setTrainingProgramStatus: setTrainingProgramStatus,
    issueCertification: issueCertification,
    suspendCertification: suspendCertification,
    revokeCertification: revokeCertification,
    getPassport: getPassport,
    exportPassport: exportPassport,
    reproductionProfile: reproductionProfile,
    publicPractitioners: publicPractitioners,
    profileFor: profileFor
  };
})(SCA);
