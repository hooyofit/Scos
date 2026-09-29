/*
 * Field research workflow (Stage 4).
 *
 * MOST IMPORTANT PRINCIPLE: a field observation is never turned directly
 * into a verified fact. The chain is always:
 *
 *   Observation -> Field Record -> (submit -> review) -> Evidence -> Review
 *   -> Verification (Stage 3 controlled workflow stays authoritative).
 *
 * "A practitioner told us X" (interview/participant statement),
 * "We observed X" (observation), "A published source documents X" (source)
 * and "X has been technically validated" (verification) stay separate:
 * different record types, different lifecycles, different permissions.
 * Nothing here can assign E3/E4/E5: field captures are capped at E2
 * (community/oral), and capability evidence levels change only through
 * SCA.evidence.requestUpgrade (Stage 3).
 */
(function (SCA) {
  'use strict';

  function userName(user) {
    if (!user) { return null; }
    return user.name || user.public_name || user.role || 'unknown';
  }

  function projectOf(id) { return SCA.store.get('research_projects', id); }

  function projectAllowsCollection(project) {
    return !!project && (project.status === 'APPROVED' ||
      project.status === 'ACTIVE' || project.status === 'PAUSED');
  }

  function guardProject(session) {
    var project = projectOf(session.project_id);
    if (!project) { return 'Research session must belong to an existing project.'; }
    if (!projectAllowsCollection(project)) {
      return 'Field collection is not allowed against a project with status "' +
        project.status + '". Only APPROVED, ACTIVE or PAUSED projects accept ' +
        'field collection. (Testing against unapproved projects is not ' +
        'configured in this build.)';
    }
    return null;
  }

  function medicalCheck(capabilityId, opts) {
    var cap = SCA.store.get('capabilities', capabilityId);
    if (!cap) { return null; }
    var fam = SCA.store.get('families', cap.family_id);
    if (fam && fam.code === 'S' && SCA.util.isBlank(opts.safety_notes)) {
      return 'Field records about Medicine, Hygiene & Human Survival (family S) ' +
        'require safety notes. Preserve the knowledge. Validate the treatment. ' +
        'Protect the patient. This documentation is not medical advice.';
    }
    return null;
  }

  /* ---------- ResearchProject ---------- */
  function createProject(user, record) {
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    var rec = Object.assign({}, record);
    rec.status = rec.status || 'DRAFT';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Created by ' + (userName(user) || 'unknown') + ' via the Stage 4 field research workflow.');
    var res = SCA.store.insert('research_projects', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('project.created', {
      actor: userName(user), entity: 'research_projects',
      entity_id: res.record.id, entity_code: res.record.project_code,
      new_value: rec.status, version: rec.version });
    return res;
  }

  var PROJECT_TRANSITIONS = {
    DRAFT: ['APPROVED', 'ARCHIVED'],
    APPROVED: ['ACTIVE', 'ARCHIVED'],
    ACTIVE: ['PAUSED', 'COMPLETED'],
    PAUSED: ['ACTIVE', 'COMPLETED'],
    COMPLETED: ['ARCHIVED'],
    ARCHIVED: []
  };

  function setProjectStatus(user, id, to, reason) {
    if (!SCA.rbac.can(user, 'research.approve')) {
      return { ok: false, errors: { permission: 'research.approve required.' } };
    }
    var p = projectOf(id);
    if (!p) { return { ok: false, errors: { id: 'Project not found.' } }; }
    var allowed = PROJECT_TRANSITIONS[p.status || 'DRAFT'] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: { status:
        'Project status "' + (p.status || 'DRAFT') + '" cannot move to "' + to +
        '". Allowed: ' + (allowed.join(', ') || 'none (archived).') } };
    }
    if (to === 'APPROVED' && (!reason || String(reason).trim() === '')) {
      return { ok: false, errors: { reason:
        'Approving a research project requires a documented reason (protocol/ethics sign-off).' } };
    }
    var newVersion = String((parseInt(p.version, 10) || 1) + 1);
    var res = SCA.store.update('research_projects', id, {
      status: to, version: newVersion
    });
    if (!res.ok) { return res; }
    SCA.audit.log('project.status_changed', {
      actor: userName(user), entity: 'research_projects', entity_id: id,
      entity_code: p.project_code, old_value: p.status, new_value: to,
      reason: reason || null, version: newVersion });
    return res;
  }

  /* ---------- ResearchSession ---------- */
  function createSession(user, record) {
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    var rec = Object.assign({}, record);
    var guard = guardProject(rec);
    if (guard) { return { ok: false, errors: { project_id: guard } }; }

    /* Location privacy: coordinates are never required. If the researcher
       declares UNDISCLOSED, coordinates are stripped, not guessed. Absent
       coordinates stay explicitly null (never undefined, never inferred). */
    rec.latitude = (rec.latitude === undefined) ? null : rec.latitude;
    rec.longitude = (rec.longitude === undefined) ? null : rec.longitude;
    rec.location_precision = rec.location_precision || 'LOCALITY_ONLY';
    if (rec.location_precision === 'UNDISCLOSED') {
      rec.latitude = null;
      rec.longitude = null;
      rec.locality = null;
      rec.district = null;
      rec.region = null;
      rec.general_location_description =
        rec.general_location_description || 'Undisclosed by researcher';
    }
    rec.status = rec.status || 'DRAFT';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Recorded by ' + (userName(user) || 'unknown') + ' (offline-capable workflow).');
    var res = SCA.store.insert('research_sessions', rec);
    if (!res.ok) { return res; }
    SCA.queue.enqueue('research_sessions', res.record.id, 'create',
      { dependency_ids: [rec.project_id] });
    SCA.audit.log('session.created', {
      actor: userName(user), entity: 'research_sessions',
      entity_id: res.record.id, version: rec.version });
    return res;
  }

  /* ---------- ResearchParticipant + consent ---------- */
  function recordParticipant(user, record) {
    if (!SCA.rbac.can(user, 'participant.manage')) {
      return { ok: false, errors: { permission: 'participant.manage required.' } };
    }
    var rec = Object.assign({}, record);
    if (SCA.util.isBlank(rec.participant_code)) {
      return { ok: false, errors: { participant_code:
        'Participants need a stable internal participant_code (anonymous or not).' } };
    }
    /* Anonymous participants: public_name must not identify the person. */
    if (rec.anonymous === true && !SCA.util.isBlank(rec.public_name) &&
        rec.public_name.indexOf(rec.participant_code) === -1 &&
        rec.public_name.length > 0 && !/^(Anonymous|Anon)/i.test(rec.public_name)) {
      rec.public_name = 'Anonymous participant ' + rec.participant_code;
    }
    rec.version = rec.version || '1';
    rec.access_level = rec.access_level || 'RESEARCH_TEAM';
    rec.provenance = rec.provenance ||
      ('Recorded by ' + (userName(user) || 'unknown') + ' via field workflow.');
    var res = SCA.store.insert('participants', rec);
    if (!res.ok) { return res; }
    SCA.queue.enqueue('participants', res.record.id, 'create');
    SCA.audit.log('participant.created', {
      actor: userName(user), entity: 'participants',
      entity_id: res.record.id, entity_code: res.record.participant_code,
      new_value: rec.anonymous ? 'anonymous' : 'named' });
    return res;
  }

  function recordConsent(user, record) {
    if (!SCA.rbac.can(user, 'consent.manage')) {
      return { ok: false, errors: { permission: 'consent.manage required.' } };
    }
    var rec = Object.assign({}, record);
    rec.consent_state = rec.consent_state || 'GRANTED';
    rec.version = rec.version || '1';
    rec.recorded_by = rec.recorded_by || userName(user);
    rec.provenance = rec.provenance ||
      ('Consent recorded by ' + (rec.recorded_by || 'unknown') + ' in the field.');
    var res = SCA.store.insert('consents', rec);
    if (!res.ok) { return res; }
    SCA.queue.enqueue('consents', res.record.id, 'create');
    SCA.audit.log('consent.recorded', {
      actor: userName(user), entity: 'consents', entity_id: res.record.id,
      new_value: rec.consent_state,
      reason: 'scope: ' + (rec.purpose || 'unspecified') });
    return res;
  }

  function withdrawConsent(user, consentId, reason) {
    if (!SCA.rbac.can(user, 'consent.manage')) {
      return { ok: false, errors: { permission: 'consent.manage required.' } };
    }
    var c = SCA.store.get('consents', consentId);
    if (!c) { return { ok: false, errors: { id: 'Consent record not found.' } }; }
    if (!reason || String(reason).trim() === '') {
      return { ok: false, errors: { reason: 'Withdrawal must be documented.' } };
    }
    var newVersion = String((parseInt(c.version, 10) || 1) + 1);
    var res = SCA.store.update('consents', consentId, {
      consent_state: 'WITHDRAWN',
      withdrawal_date: SCA.util.now(),
      withdrawal_reason: reason,
      version: newVersion
    });
    if (!res.ok) { return res; }
    /* Restrict affected media/participants WITHOUT deleting provenance:
       downgrade access; keep records and audit history intact. */
    var restricted = 0;
    SCA.store.all('field_media').forEach(function (m) {
      if (m.consent_id === consentId &&
          (m.access_level === 'PUBLIC' || m.access_level === 'RESEARCH_TEAM')) {
        SCA.store.update('field_media', m.id, { access_level: 'RESTRICTED' });
        restricted++;
      }
    });
    SCA.audit.log('consent.withdrawn', {
      actor: userName(user), entity: 'consents', entity_id: consentId,
      old_value: c.consent_state, new_value: 'WITHDRAWN',
      reason: reason + (restricted ? ' (restricted ' + restricted +
        ' media record(s))' : ''), version: newVersion });
    return { ok: true, record: res.record, restricted: restricted };
  }

  /* ---------- Field records: observation, note, capture, media ---------- */
  function fieldCreate(collection, user, record, auditAction) {
    var rec = Object.assign({}, record);
    rec.status = rec.status || 'DRAFT';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Recorded by ' + (userName(user) || 'unknown') + ' in the field (offline-capable).');
    var res = SCA.store.insert(collection, rec);
    if (!res.ok) { return res; }
    var deps = [];
    if (rec.session_id) { deps.push(rec.session_id); }
    SCA.queue.enqueue(collection, res.record.id, 'create', { dependency_ids: deps });
    SCA.audit.log(auditAction, {
      actor: userName(user), entity: collection, entity_id: res.record.id,
      new_value: rec.status, version: rec.version });
    return res;
  }

  function createObservation(user, record) {
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    var rec = Object.assign({}, record);
    var session = SCA.store.get('research_sessions', rec.session_id);
    if (!session) { return { ok: false, errors: { session_id:
      'Observations must belong to an existing research session.' } }; }
    var guard = guardProject(session);
    if (guard) { return { ok: false, errors: { session_id: guard } }; }
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id:
        'Observations must reference an existing inventory capability.' } };
    }
    var med = medicalCheck(rec.capability_id, rec);
    if (med) { return { ok: false, errors: { safety_notes: med } }; }
    rec.observer_name = rec.observer_name || userName(user);
    rec.access_level = rec.access_level || 'RESEARCH_TEAM';
    return fieldCreate('observations', user, rec, 'observation.created');
  }

  function createFieldNote(user, record) {
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    var rec = Object.assign({}, record);
    var session = SCA.store.get('research_sessions', rec.session_id);
    if (!session) { return { ok: false, errors: { session_id:
      'Field notes must belong to an existing research session.' } }; }
    rec.author = rec.author || userName(user);
    rec.access_level = rec.access_level || 'RESEARCH_TEAM';
    return fieldCreate('field_notes', user, rec, 'note.created');
  }

  /*
   * Interview / knowledge capture. Extends the Stage 3 KnowledgeArtifact:
   * the artifact IS the capture. Original wording (transcription) and
   * translation are separate fields — translation never overwrites the
   * original. Field captures cannot claim evidence levels above E2.
   */
  function createKnowledgeCapture(user, record) {
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    var rec = Object.assign({}, record);
    var session = SCA.store.get('research_sessions', rec.session_id);
    if (!session) { return { ok: false, errors: { session_id:
      'Knowledge capture must belong to an existing research session.' } };
    }
    var capIds = rec.capability_ids || (rec.capability_id ? [rec.capability_id] : []);
    var med = medicalCheck(capIds[0], rec);
    if (med) { return { ok: false, errors: { safety_notes: med } }; }
    var lv = rec.evidence_level;
    if (lv && ['E3', 'E4', 'E5'].indexOf(lv) !== -1) {
      return { ok: false, errors: { evidence_level:
        'Field collection cannot directly produce ' + lv + ' evidence. Field ' +
        'captures are capped at E2 (community/oral). Higher classifications ' +
        'come from the Stage 3 review and controlled upgrade workflow.' } };
    }
    if (rec.translated_text && !rec.transcription && !rec.original_wording) {
      return { ok: false, errors: { transcription:
        'Translation without preserved original wording is not acceptable: ' +
        'the original language record must be kept, translation is separate.' } };
    }
    rec.capture_type = rec.capture_type || 'interview';
    rec.artifact_type = rec.artifact_type || 'interview';
    rec.interviewer = rec.interviewer || userName(user);
    /* Knowledge artifacts are archive objects: they use the Stage 1 archive
       access levels; RESEARCH maps to "research team" visibility. */
    rec.access_level = rec.access_level || 'RESEARCH';
    rec.status = 'DRAFT';
    rec.origin_record = { collection: 'research_sessions', id: rec.session_id };
    var res = SCA.evidence.createArtifact(user, rec);
    if (!res.ok) { return res; }
    /* Field artifacts also get a queue entry: they live on this device. */
    SCA.queue.enqueue('knowledge', res.record.id, 'create',
      { dependency_ids: [rec.session_id] });
    return res;
  }

  function createMedia(user, record) {
    if (!SCA.rbac.can(user, 'media.manage')) {
      return { ok: false, errors: { permission: 'media.manage required.' } };
    }
    var rec = Object.assign({}, record);
    if (!rec.filename) {
      return { ok: false, errors: { filename: 'Media metadata requires a filename.' } };
    }
    /* A media file existing is never an assumption that it is shareable:
       default access is RESEARCH_TEAM, and explicit consent is expected. */
    rec.access_level = rec.access_level || 'RESEARCH_TEAM';
    rec.uploaded_status = rec.uploaded_status || 'local_reference_only';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Captured/recorded by ' + (userName(user) || 'unknown') + ' in the field.');
    var res = SCA.store.insert('field_media', rec);
    if (!res.ok) { return res; }
    SCA.queue.enqueue('field_media', res.record.id, 'create',
      { dependency_ids: rec.session_id ? [rec.session_id] : [] });
    SCA.audit.log('media.created', {
      actor: userName(user), entity: 'field_media', entity_id: res.record.id,
      new_value: rec.access_level, version: rec.version });
    return res;
  }

  /* ---------- Lifecycle: submit -> review ---------- */
  var RECORD_TRANSITIONS = {
    DRAFT: ['SUBMITTED', 'ARCHIVED'],
    SUBMITTED: ['UNDER_REVIEW', 'ARCHIVED'],
    UNDER_REVIEW: ['NEEDS_CLARIFICATION', 'ACCEPTED_AS_EVIDENCE', 'REJECTED'],
    NEEDS_CLARIFICATION: ['SUBMITTED', 'ARCHIVED'],
    ACCEPTED_AS_EVIDENCE: ['ARCHIVED'],
    REJECTED: ['ARCHIVED'],
    ARCHIVED: []
  };

  function submit(user, collection, id) {
    if (!SCA.rbac.can(user, 'research.submit')) {
      return { ok: false, errors: { permission: 'research.submit required.' } };
    }
    var rec = SCA.store.get(collection, id);
    if (!rec) { return { ok: false, errors: { id: 'Record not found.' } }; }
    var allowed = RECORD_TRANSITIONS[rec.status || 'DRAFT'] || [];
    if (allowed.indexOf('SUBMITTED') === -1) {
      return { ok: false, errors: { status:
        'A record with status "' + rec.status + '" cannot be submitted.' } };
    }
    var newVersion = String((parseInt(rec.version, 10) || 1) + 1);
    var res = SCA.store.update(collection, id, {
      status: 'SUBMITTED', submitted_by: userName(user), version: newVersion });
    if (!res.ok) { return res; }
    SCA.queue.setStatus(collection, id, 'READY_FOR_EXPORT');
    SCA.audit.log('record.submitted', {
      actor: userName(user), entity: collection, entity_id: id,
      old_value: rec.status, new_value: 'SUBMITTED', version: newVersion });
    return res;
  }

  function reviewFieldRecord(user, collection, id, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'research.review')) {
      return { ok: false, errors: { permission: 'research.review required.' } };
    }
    var rec = SCA.store.get(collection, id);
    if (!rec) { return { ok: false, errors: { id: 'Record not found.' } }; }
    var to = opts.status;
    var allowed = RECORD_TRANSITIONS[rec.status || 'DRAFT'] || [];
    if (allowed.indexOf(to) === -1) {
      return { ok: false, errors: { status:
        'Lifecycle move "' + (rec.status || 'DRAFT') + '" -> "' + to +
        '" is not allowed. Allowed: ' + (allowed.join(', ') || 'none.') } };
    }
    if (to === 'REJECTED' && (!opts.reason || String(opts.reason).trim() === '')) {
      return { ok: false, errors: { reason:
        'Rejection requires a documented reason. Rejected never means erased: ' +
        'the record and the reason are both preserved.' } };
    }
    var patch = { status: to, reviewed_by: userName(user),
      review_notes: opts.notes || rec.review_notes || null, version:
      String((parseInt(rec.version, 10) || 1) + 1) };
    if (to === 'REJECTED') { patch.rejection_reason = opts.reason; }
    if (to === 'NEEDS_CLARIFICATION' && opts.notes) { patch.clarification_request = opts.notes; }
    var res = SCA.store.update(collection, id, patch);
    if (!res.ok) { return res; }
    SCA.audit.log('record.' + to.toLowerCase(), {
      actor: userName(user), entity: collection, entity_id: id,
      old_value: rec.status, new_value: to, reason: opts.reason || opts.notes || null,
      version: patch.version });
    return res;
  }

  /*
   * Evidence submission (Stage 3 archive), review-gated.
   * Creates a KnowledgeArtifact from the field record — WITHOUT touching
   * any capability evidence level — and records the link both ways
   * (origin_record on the artifact, origin_evidence_ids on the field
   * record). A CLAIM is only created when the reviewer explicitly writes
   * the claim text: the application never generates claims from
   * observations (observation != claim).
   */
  function acceptAsEvidence(user, collection, id, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'research.review')) {
      return { ok: false, errors: { permission: 'research.review required.' } };
    }
    var rec = SCA.store.get(collection, id);
    if (!rec) { return { ok: false, errors: { id: 'Record not found.' } }; }
    if ((rec.status || 'DRAFT') !== 'UNDER_REVIEW') {
      return { ok: false, errors: { status:
        'Only records Under Review can be accepted as evidence. Submit first, ' +
        'then review. Current status: ' + (rec.status || 'DRAFT') } };
    }

    var capId = collection === 'observations' ? rec.capability_id :
      (rec.capability_ids ? rec.capability_ids[0] :
        (rec.capability_id || (rec.related_capabilities || [])[0] || null));
    if (!capId) { return { ok: false, errors: { capability_id:
      'The field record must reference a capability to produce archive evidence.' } }; }
    var med = medicalCheck(capId, rec);
    if (med) { return { ok: false, errors: { safety_notes: med } }; }

    var srcRes = SCA.evidence.createSource(user, {
      title: 'Field record: ' + collection.slice(0, -1) + ' ' + rec.id +
        ' (session ' + rec.session_id + ')',
      source_type: collection === 'observations' ? 'FIELD_REPORT' : 'INTERVIEW',
      description: (rec.observation_text || rec.text || rec.transcription || '').slice(0, 500),
      geographic_scope: rec.region || null,
      provenance: 'Generated from reviewed field record ' + collection + '/' + rec.id +
        ' via the Stage 4 evidence submission step. Human review: ' + userName(user) + '.'
    });
    if (!srcRes.ok) { return srcRes; }

    var artifactRes = SCA.evidence.createArtifact(user, {
      title: 'Field evidence: ' + collection.slice(0, -1) + ' ' + rec.id,
      artifact_type: collection === 'observations' ? 'field_observation' : 'field_capture',
      capability_ids: [capId],
      source_ids: [srcRes.record.id],
      description: rec.observation_text || rec.text || rec.summary || null,
      context: rec.context || null,
      procedure_summary: rec.procedure_summary || null,
      environmental_conditions: rec.environmental_conditions || null,
      limitations: rec.limitations || null,
      safety_notes: rec.safety_notes || null,
      evidence_level: 'E2',
      access_level: 'RESEARCH',
      origin_record: { collection: collection, id: rec.id },
      provenance: 'Accepted from field record ' + collection + '/' + rec.id +
        ' by reviewer ' + userName(user) + '. Original wording preserved on the field record.'
    });
    if (!artifactRes.ok) { return artifactRes; }

    /* Claim: only when the reviewer EXPLICITLY writes it. */
    var claimRes = null;
    if (opts.claim_text && String(opts.claim_text).trim() !== '') {
      claimRes = SCA.evidence.createClaim(user, {
        capability_id: capId,
        claim_text: opts.claim_text,
        claim_type: opts.claim_type || 'CURRENT_PRACTICE',
        claimant: rec.participant_id || rec.observer_name || userName(user),
        source_ids: [srcRes.record.id],
        artifact_ids: [artifactRes.record.id],
        region: rec.region || null,
        evidence_level: 'E2',
        safety_notes: rec.safety_notes || undefined,
        provenance: 'Claim formulated by reviewer ' + userName(user) +
          ' from reviewed field record ' + collection + '/' + rec.id +
          '. The claim is the reviewer\'s proposition, not the observation itself.'
      });
      if (!claimRes.ok) { return claimRes; }
    }

    var newVersion = String((parseInt(rec.version, 10) || 1) + 1);
    var evidenceIds = [artifactRes.record.id].concat(
      claimRes && claimRes.record ? [claimRes.record.id] : []);
    var patch = {
      status: 'ACCEPTED_AS_EVIDENCE',
      reviewed_by: userName(user),
      evidence_refs: (rec.evidence_refs || []).concat([srcRes.record.id]),
      origin_evidence_ids: (rec.origin_evidence_ids || []).concat(evidenceIds),
      version: newVersion
    };
    var res = SCA.store.update(collection, id, patch);
    if (!res.ok) { return res; }
    SCA.audit.log('record.accepted_as_evidence', {
      actor: userName(user), entity: collection, entity_id: id,
      old_value: rec.status, new_value: 'ACCEPTED_AS_EVIDENCE',
      reason: 'evidence: ' + evidenceIds.join(', '), version: newVersion });
    return { ok: true, record: res.record,
      source: srcRes.record, artifact: artifactRes.record,
      claim: claimRes ? claimRes.record : null };
  }

  /* ---------- Conflicts ---------- */
  function flagConflict(user, refs, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'research.create')) {
      return { ok: false, errors: { permission: 'research.create required.' } };
    }
    if (!Array.isArray(refs) || refs.length < 2) {
      return { ok: false, errors: { refs:
        'A conflict needs at least two records.' } };
    }
    var results = refs.map(function (ref) {
      var rec = SCA.store.get(ref.collection, ref.id);
      if (!rec) { return null; }
      var others = refs.filter(function (r) {
        return !(r.collection === ref.collection && r.id === ref.id); })
        .map(function (r) { return r.collection + '/' + r.id; });
      var newVersion = String((parseInt(rec.version, 10) || 1) + 1);
      return SCA.store.update(ref.collection, ref.id, {
        conflict_status: true,
        conflict_refs: (rec.conflict_refs || []).concat(others),
        conflict_notes: opts.notes || rec.conflict_notes || null,
        resolution_status: 'UNREVIEWED',
        version: newVersion });
    });
    if (results.some(function (r) { return !r; })) {
      return { ok: false, errors: { refs: 'One or more conflict records not found.' } };
    }
    SCA.audit.log('conflict.flagged', {
      actor: userName(user),
      entity: refs[0].collection, entity_id: refs[0].id,
      new_value: 'conflict between ' + refs.map(function (r) {
        return r.collection + '/' + r.id; }).join(', '),
      reason: opts.notes || null });
    return { ok: true, flagged: refs.length };
  }

  function resolveConflict(user, refs, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'research.review')) {
      return { ok: false, errors: { permission: 'research.review required.' } };
    }
    if (!SCA.enums.has(SCA.enums.conflict_resolution, opts.resolution)) {
      return { ok: false, errors: { resolution: 'Invalid resolution status.' } };
    }
    if (!opts.notes || String(opts.notes).trim() === '') {
      return { ok: false, errors: { notes:
        'Conflict resolution requires reviewer notes. No automatic deletion, ' +
        'no automatic choice: the reasoning is part of the record.' } };
    }
    refs.forEach(function (ref) {
      var rec = SCA.store.get(ref.collection, ref.id);
      if (!rec) { return; }
      var newVersion = String((parseInt(rec.version, 10) || 1) + 1);
      SCA.store.update(ref.collection, ref.id, {
        resolution_status: opts.resolution,
        resolution_notes: opts.notes,
        version: newVersion });
    });
    SCA.audit.log('conflict.resolved', {
      actor: userName(user), entity: refs[0].collection, entity_id: refs[0].id,
      new_value: opts.resolution, reason: opts.notes });
    return { ok: true };
  }

  /* ---------- Research package (offline assignment) ---------- */
  var PACKAGE_COLLECTIONS = ['research_projects', 'research_sessions',
    'observations', 'field_notes', 'participants', 'field_media',
    'consents', 'knowledge', 'claims', 'evidence', 'research_queue'];

  function exportPackage(projectId) {
    var project = projectOf(projectId);
    if (!project) { throw new Error('Project not found: ' + projectId); }
    var pkg = {
      app: 'somali-capability-atlas',
      kind: 'research_package',
      schema_version: SCA.SCHEMA_VERSION,
      exported_at: SCA.util.now(),
      project_id: projectId,
      collections: {},
      offline_metadata: {
        note: 'Research package: project, sessions, participants, consent, ' +
          'records, media metadata and queue state for offline work. ' +
          'Confidential material is included only if the export was ' +
          'explicitly authorized (see access levels on each record).'
      }
    };
    var sessionIds = SCA.store.all('research_sessions').filter(function (s) {
      return s.project_id === projectId; }).map(function (s) { return s.id; });
    pkg.collections.research_projects = [project];
    pkg.collections.research_sessions =
      SCA.store.all('research_sessions').filter(function (s) {
        return s.project_id === projectId; });
    pkg.collections.observations = SCA.store.all('observations').filter(function (o) {
      return sessionIds.indexOf(o.session_id) !== -1; });
    pkg.collections.field_notes = SCA.store.all('field_notes').filter(function (n) {
      return sessionIds.indexOf(n.session_id) !== -1; });
    var participantIds = [];
    pkg.collections.observations.forEach(function (o) {
      (o.participant_refs || []).forEach(function (p) { participantIds.push(p); }); });
    pkg.collections.research_sessions.forEach(function (s) {
      (s.participant_ids || []).forEach(function (p) { participantIds.push(p); }); });
    pkg.collections.participants = SCA.store.all('participants').filter(function (p) {
      return participantIds.indexOf(p.id) !== -1; });
    pkg.collections.consents = SCA.store.all('consents').filter(function (c) {
      var used = pkg.collections.participants.some(function (p) { return p.consent_id === c.id; }) ||
        SCA.store.all('field_media').some(function (m) { return m.consent_id === c.id; });
      return used; });
    pkg.collections.field_media = SCA.store.all('field_media').filter(function (m) {
      return sessionIds.indexOf(m.session_id) !== -1; });
    pkg.collections.knowledge = SCA.store.all('knowledge').filter(function (k) {
      return k.session_id && sessionIds.indexOf(k.session_id) !== -1; });
    pkg.collections.claims = SCA.store.all('claims').filter(function (c) {
      return (c.artifact_ids || []).some(function (aid) {
        return pkg.collections.knowledge.some(function (k) { return k.id === aid; }); }); });
    pkg.collections.evidence = SCA.store.all('evidence').filter(function (s) {
      return pkg.collections.knowledge.some(function (k) {
        return (k.source_ids || []).indexOf(s.id) !== -1; }); });
    pkg.collections.research_queue = SCA.store.all('research_queue');
    /* Capability/family references needed to work offline. */
    var capIds = {};
    (project.capability_ids || []).forEach(function (id) { capIds[id] = true; });
    pkg.collections.observations.forEach(function (o) { capIds[o.capability_id] = true; });
    pkg.collections.knowledge.forEach(function (k) {
      (k.capability_ids || (k.capability_id ? [k.capability_id] : []))
        .forEach(function (id) { capIds[id] = true; }); });
    pkg.collections.claims.forEach(function (c) { capIds[c.capability_id] = true; });
    pkg.capability_references = SCA.store.all('capabilities').filter(function (c) {
      return capIds[c.id]; });
    var famIds = {};
    pkg.capability_references.forEach(function (c) { famIds[c.family_id] = true; });
    (project.family_ids || []).forEach(function (id) { famIds[id] = true; });
    pkg.family_references = SCA.store.all('families').filter(function (f) {
      return famIds[f.id]; });
    return JSON.stringify(pkg, null, 2);
  }

  /*
   * Import a research package: atomic MERGE (upsert), unlike the full
   * bundle import which replaces datasets. Validate everything first:
   * structure, references against (existing store + package). Then apply.
   * On id collision with divergent content: keep BOTH — the existing record
   * stays, the incoming copy is parked in the queue as CONFLICT for human
   * review. Nothing is silently overwritten or deleted.
   */
  function importPackage(text) {
    var pkg;
    try { pkg = JSON.parse(text); } catch (e) {
      return { ok: false, errors: ['Package is not valid JSON.'] };
    }
    if (!pkg || pkg.kind !== 'research_package' || !pkg.collections) {
      return { ok: false, errors: ['Not a research package export.'] };
    }
    if (pkg.app && pkg.app !== 'somali-capability-atlas') {
      return { ok: false, errors: ['Package from a different application.'] };
    }

    /* Build the merged candidate for reference validation. */
    var candidate = {};
    PACKAGE_COLLECTIONS.concat(['capabilities', 'families']).forEach(function (c) {
      candidate[c] = (SCA.store.all(c) || []).slice();
    });
    var structureErrors = [];
    Object.keys(pkg.collections).forEach(function (c) {
      if (PACKAGE_COLLECTIONS.indexOf(c) === -1) {
        structureErrors.push('Collection "' + c + '" is not part of a research package.');
        return;
      }
      if (!Array.isArray(pkg.collections[c])) {
        structureErrors.push('Collection "' + c + '" is not an array.');
        return;
      }
      candidate[c] = candidate[c].concat(pkg.collections[c]);
    });
    if (structureErrors.length) {
      return { ok: false, errors: structureErrors };
    }

    /* Relationship validation on the merged candidate. */
    var refErrors = [];
    function resolves(coll, id) {
      return candidate[coll].some(function (r) { return r && r.id === id; }) ||
        SCA.store.get(coll, id);
    }
    var checks = [
      ['research_sessions', 'project_id', 'research_projects'],
      ['observations', 'session_id', 'research_sessions'],
      ['observations', 'capability_id', 'capabilities'],
      ['field_notes', 'session_id', 'research_sessions'],
      ['field_media', 'session_id', 'research_sessions'],
      ['field_media', 'consent_id', 'consents'],
      ['participants', 'consent_id', 'consents'],
      ['knowledge', 'session_id', 'research_sessions'],
      ['claims', 'capability_id', 'capabilities']
    ];
    checks.forEach(function (ck) {
      (pkg.collections[ck[0]] || []).forEach(function (r) {
        var val = r ? r[ck[1]] : null;
        if (val && !resolves(ck[2], val)) {
          refErrors.push((r.code || r.title || r.id) + ' -> ' + ck[2] + ' ' + val);
        }
      });
    });
    if (refErrors.length) {
      return { ok: false, errors: [
        'Package import rejected: ' + refErrors.length +
        ' reference(s) do not resolve (neither in the package nor in this ' +
        'Atlas). Broken references never create a partial import. Affected: ' +
        refErrors.slice(0, 10).join('; ') + (refErrors.length > 10 ? ' …' : '')
      ] };
    }

    /* Atomic apply: upserts + conflict parking. */
    var result = { ok: true, inserted: 0, updated: 0, identical: 0, conflicts: [] };
    Object.keys(pkg.collections).forEach(function (coll) {
      (pkg.collections[coll] || []).forEach(function (incoming) {
        if (!incoming || !incoming.id) { return; }
        var existing = SCA.store.get(coll, incoming.id);
        if (!existing) {
          SCA.store.insert(coll, incoming);
          result.inserted++;
          SCA.queue.setStatus(coll, incoming.id, 'IMPORTED');
        } else {
          var same = JSON.stringify(existing) === JSON.stringify(incoming);
          if (same) {
            result.identical++;
            SCA.queue.setStatus(coll, incoming.id, 'SYNCHRONIZED');
          } else {
            /* Preserve BOTH: keep existing, park incoming, flag conflict. */
            result.conflicts.push({ collection: coll, id: incoming.id });
            var q = SCA.queue.enqueue(coll, incoming.id, 'incoming_conflict',
              { device_note: 'Divergent copy received via package import; ' +
                'existing record preserved, human review required.' });
            if (q.ok) {
              SCA.store.update('research_queue', q.record.id, {
                sync_status: 'CONFLICT',
                incoming_record: incoming });
            }
          }
        }
      });
    });
    SCA.audit.log('package.imported', {
      actor: 'package-import', entity: 'research_projects',
      entity_id: pkg.project_id,
      new_value: 'inserted ' + result.inserted + ', identical ' +
        result.identical + ', conflicts ' + result.conflicts.length });
    return result;
  }

  /* ---------- Public visibility guard (privacy) ---------- */
  /* Field research is not public by default: only records explicitly
     marked PUBLIC may be shown to anonymous visitors. */
  function publicRecords(collection) {
    return SCA.store.all(collection).filter(function (r) {
      return r.access_level === 'PUBLIC';
    });
  }

  SCA.research = {
    createProject: createProject,
    setProjectStatus: setProjectStatus,
    createSession: createSession,
    recordParticipant: recordParticipant,
    recordConsent: recordConsent,
    withdrawConsent: withdrawConsent,
    createObservation: createObservation,
    createFieldNote: createFieldNote,
    createKnowledgeCapture: createKnowledgeCapture,
    createMedia: createMedia,
    submit: submit,
    reviewFieldRecord: reviewFieldRecord,
    acceptAsEvidence: acceptAsEvidence,
    flagConflict: flagConflict,
    resolveConflict: resolveConflict,
    exportPackage: exportPackage,
    importPackage: importPackage,
    publicRecords: publicRecords,
    RECORD_TRANSITIONS: RECORD_TRANSITIONS,
    PROJECT_TRANSITIONS: PROJECT_TRANSITIONS
  };
})(SCA);
