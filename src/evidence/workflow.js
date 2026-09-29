/*
 * Evidence workflow service (Stage 3).
 *
 * Core principle: A CLAIM CAN BE PRESERVED WITHOUT BEING DECLARED TRUE.
 * This service is the ONLY sanctioned path for evidence-level changes on
 * capabilities and verification decisions on evidence objects. Ordinary
 * edits never touch evidence_level; requestUpgrade enforces the rules:
 *
 *   - only users holding the evidence.verify permission may upgrade,
 *   - an upgrade advances at most ONE level per review action (no E0 -> E5),
 *   - a reason and at least one supporting source are required,
 *   - old/new level, reason, sources, reviewer and timestamp are audited,
 *   - the capability record's version increments (versioned change, not a
 *     silent rewrite).
 *
 * Evidence level criteria (E0-E5) are documented in ADR-0004; the criteria
 * live with reviewers, the enforcement lives here.
 */
(function (SCA) {
  'use strict';

  function userName(user) {
    if (!user) { return null; }
    return user.name || user.public_name || user.role || 'unknown';
  }

  /* ---- Controlled evidence-level upgrade (transition protection) ---- */
  function requestUpgrade(user, capabilityId, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'evidence.verify')) {
      return { ok: false, errors: { permission:
        'You do not have verification authority (evidence.verify).' } };
    }
    var cap = SCA.store.get('capabilities', capabilityId);
    if (!cap) { return { ok: false, errors: { id: 'Capability not found.' } }; }

    var from = cap.evidence_level || 'E0';
    var to = opts.to;
    if (!to || !SCA.enums.has(SCA.enums.evidence_levels, to)) {
      return { ok: false, errors: { to: 'Invalid evidence level: ' + to } };
    }
    if (to === from) {
      return { ok: false, errors: { to: 'Record is already ' + from + '.' } };
    }
    var step = parseInt(to.slice(1), 10) - parseInt(from.slice(1), 10);
    if (step > 1) {
      return { ok: false, errors: { to:
        'Evidence levels advance one step per review action. ' +
        from + ' -> ' + to + ' is not allowed in a single decision; ' +
        'document and review each intermediate level.' } };
    }
    if (step < 1) {
      return { ok: false, errors: { to:
        'This function only upgrades. Downgrades and corrections are ' +
        'recorded as review decisions, not upgrades.' } };
    }
    if (!opts.reason || String(opts.reason).trim() === '') {
      return { ok: false, errors: { reason:
        'A review reason is required for every evidence-level change.' } };
    }
    if (!Array.isArray(opts.source_ids) || opts.source_ids.length === 0) {
      return { ok: false, errors: { source_ids:
        'An upgrade must cite at least one supporting EvidenceSource. ' +
        'No source, no upgrade.' } };
    }
    var missing = opts.source_ids.filter(function (sid) {
      return !SCA.store.get('evidence', sid);
    });
    if (missing.length) {
      return { ok: false, errors: { source_ids:
        'Cited sources do not exist in the Atlas: ' + missing.join(', ') } };
    }

    var newVersion = String((parseInt(cap.version, 10) || 1) + 1);
    var res = SCA.store.update('capabilities', capabilityId, {
      evidence_level: to,
      version: newVersion,
      reviewer: userName(user),
      reviewed_at: SCA.util.now()
    });
    if (!res.ok) { return res; }

    SCA.audit.log('evidence.level_changed', {
      actor: userName(user),
      entity: 'capabilities',
      entity_id: capabilityId,
      entity_code: cap.code,
      old_value: from,
      new_value: to,
      reason: opts.reason,
      version: newVersion
    });
    return { ok: true, record: res.record, from: from, to: to };
  }

  /* ---- Review: verification status on sources, artifacts, claims ---- */
  function review(user, collection, id, opts) {
    opts = opts || {};
    if (!SCA.rbac.can(user, 'evidence.review')) {
      return { ok: false, errors: { permission:
        'You do not have review authority (evidence.review).' } };
    }
    var rec = SCA.store.get(collection, id);
    if (!rec) { return { ok: false, errors: { id: 'Record not found.' } }; }
    if (!opts.verification_status ||
        !SCA.enums.has(SCA.enums.verification_states, opts.verification_status)) {
      return { ok: false, errors: { verification_status:
        'Invalid verification status.' } };
    }

    var patch = {
      reviewer: userName(user),
      review_notes: opts.review_notes || rec.review_notes || null
    };
    /* Sources carry their review decision in review_status; claims and
       knowledge artifacts in verification_status. Both use the same
       controlled verification_states scale. */
    if (collection === 'evidence') {
      patch.review_status = opts.verification_status;
    } else {
      patch.verification_status = opts.verification_status;
    }
    /* Rejected/Disputed: preserve the original content, record the reason. */
    if (opts.verification_status === 'REJECTED' ||
        opts.verification_status === 'DISPUTED') {
      if (!opts.reason || String(opts.reason).trim() === '') {
        return { ok: false, errors: { reason:
          'Disputed and Rejected decisions require a documented reason. ' +
          'The historical record is preserved, so the reason must be too.' } };
      }
      patch.rejection_reason = opts.reason;
      /* claim_text/title are never modified: history is preserved. */
    }
    if (opts.verification_status === 'SUPERSEDED') {
      if (!opts.superseded_by) {
        return { ok: false, errors: { superseded_by:
          'Superseded requires a reference to the replacing record.' } };
      }
      patch.superseded_by = opts.superseded_by;
    }
    var newVersion = String((parseInt(rec.version, 10) || 1) + 1);
    patch.version = newVersion;

    var res = SCA.store.update(collection, id, patch);
    if (!res.ok) { return res; }

    SCA.audit.log('review.' + opts.verification_status.toLowerCase(), {
      actor: userName(user),
      entity: collection,
      entity_id: id,
      entity_code: rec.code || rec.title || null,
      old_value: rec.verification_status || null,
      new_value: opts.verification_status,
      reason: opts.reason || null,
      version: newVersion
    });
    return { ok: true, record: res.record };
  }

  /* ---- Creation with provenance and audit ---- */
  function createSource(user, record) {
    if (!SCA.rbac.can(user, 'evidence.create')) {
      return { ok: false, errors: { permission: 'evidence.create required.' } };
    }
    var rec = Object.assign({}, record);
    rec.entered_by = rec.entered_by || userName(user);
    rec.review_status = rec.review_status || 'UNREVIEWED';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Entered by ' + (rec.entered_by || 'unknown') + ' via the Stage 3 evidence workflow.');
    var res = SCA.store.insert('evidence', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('source.created', {
      actor: rec.entered_by, entity: 'evidence', entity_id: res.record.id,
      entity_code: res.record.title, new_value: rec.review_status,
      version: rec.version });
    return res;
  }

  function createArtifact(user, record) {
    if (!SCA.rbac.can(user, 'knowledge.create')) {
      return { ok: false, errors: { permission: 'knowledge.create required.' } };
    }
    var rec = Object.assign({}, record);
    rec.entered_by = rec.entered_by || userName(user);
    rec.verification_status = rec.verification_status || 'UNREVIEWED';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Entered by ' + (rec.entered_by || 'unknown') + ' via the Stage 3 evidence workflow.');

    /* Medical safety: artifacts linked to S-family capabilities must carry
       explicit safety notes; no clinical validation is ever implied. */
    var capIds = rec.capability_ids ||
      (rec.capability_id ? [rec.capability_id] : []);
    var medical = capIds.some(function (cid) {
      var c = SCA.store.get('capabilities', cid);
      if (!c) { return false; }
      var f = SCA.store.get('families', c.family_id);
      return !!(f && f.code === 'S');
    });
    if (medical && (SCA.util.isBlank(rec.safety_notes))) {
      return { ok: false, errors: { safety_notes:
        'Artifacts documenting Medicine & Human Survival (family S) require ' +
        'safety notes stating that this is preserved knowledge, not validated ' +
        'medical advice. Preserve the knowledge. Validate the treatment. ' +
        'Protect the patient.' } };
    }

    var res = SCA.store.insert('knowledge', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('artifact.created', {
      actor: rec.entered_by, entity: 'knowledge', entity_id: res.record.id,
      entity_code: res.record.title, new_value: rec.verification_status,
      version: rec.version });
    return res;
  }

  function createClaim(user, record) {
    if (!SCA.rbac.can(user, 'evidence.create')) {
      return { ok: false, errors: { permission: 'evidence.create required.' } };
    }
    var rec = Object.assign({}, record);
    if (!SCA.store.get('capabilities', rec.capability_id)) {
      return { ok: false, errors: { capability_id:
        'Claims must attach to an existing capability.' } };
    }
    /* Medical safety: health/safety claims require explicit safety notes;
       they are preserved claims, never clinical validation. */
    if ((rec.claim_type === 'HEALTH_RELATED' || rec.claim_type === 'SAFETY_RELATED') &&
        SCA.util.isBlank(rec.safety_notes)) {
      return { ok: false, errors: { safety_notes:
        'Health-related and safety-related claims require safety notes ' +
        'stating that the claim is preserved, not validated medical advice.' } };
    }
    rec.entered_by = rec.entered_by || userName(user);
    rec.verification_status = rec.verification_status || 'UNREVIEWED';
    rec.version = rec.version || '1';
    rec.provenance = rec.provenance ||
      ('Entered by ' + (rec.entered_by || 'unknown') + ' via the Stage 3 evidence workflow.');
    var res = SCA.store.insert('claims', rec);
    if (!res.ok) { return res; }
    SCA.audit.log('claim.created', {
      actor: rec.entered_by, entity: 'claims', entity_id: res.record.id,
      entity_code: rec.claim_type, new_value: rec.verification_status,
      version: rec.version });
    return res;
  }

  /* ---- Independence: sources sharing an independence group are one
     stream for review purposes. Traceability, not automated scoring. ---- */
  function independenceGroups() {
    var groups = {};
    SCA.store.all('evidence').forEach(function (s) {
      if (s.independence_group) {
        groups[s.independence_group] = groups[s.independence_group] || [];
        groups[s.independence_group].push(s);
      }
    });
    return groups;
  }

  /* Distinct independent streams among a set of source ids: sources with
     the same independence_group count once. Copies are not independence. */
  function countIndependentStreams(sourceIds) {
    var seenGroups = {};
    var seenSingles = {};
    var streams = 0;
    (sourceIds || []).forEach(function (sid) {
      var s = SCA.store.get('evidence', sid);
      if (!s) { return; }
      if (s.independence_group) {
        if (!seenGroups[s.independence_group]) { streams++; seenGroups[s.independence_group] = true; }
      } else {
        if (!seenSingles[s.id]) { streams++; seenSingles[s.id] = true; }
      }
    });
    return streams;
  }

  SCA.evidence = {
    requestUpgrade: requestUpgrade,
    review: review,
    createSource: createSource,
    createArtifact: createArtifact,
    createClaim: createClaim,
    independenceGroups: independenceGroups,
    countIndependentStreams: countIndependentStreams
  };
})(SCA);
