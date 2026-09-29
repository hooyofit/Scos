/*
 * Marketplace workflow (Stage 13: Capability Marketplace, frozen
 * scope v1.0 + implementation authorization v1.0).
 *
 * ARCHITECTURAL RULES (frozen):
 *  - Exactly ONE Stage 13 domain entity: MarketplaceListing. No
 *    MarketplaceProvider, MarketplaceMatch, MarketplaceAvailability,
 *    MarketplaceRating, MarketplaceReview, MarketplaceRequest,
 *    MarketplaceOffer, MarketplaceScore, MatchScore, ProviderScore,
 *    ListingScore, TrustLevel, VerificationScore, ProviderRanking,
 *    ListingRanking, PopularityCount, ResponseCount or any renamed
 *    equivalent exists (authorization §28).
 *  - The marketplace is a DISCOVERY AND CONNECTION layer, never a
 *    transaction platform: it records the possibility that a
 *    capability service can be provided or is needed. It does not
 *    broker, price, contract, schedule, transact or deliver.
 *  - Provider references are polymorphic over EXISTING frozen
 *    records (PRACTITIONER / ORGANIZATION / WORKSHOP /
 *    TRAINING_PROGRAM). The listing never manufactures provider
 *    identity or provider competence. At PUBLICATION the provider
 *    must resolve to a publicly visible record under its OWN
 *    stage's rules. After publication, a later-retired provider is
 *    rendered HONESTLY ("Referenced provider no longer available")
 *    and NEVER auto-mutates the lifecycle — a human pauses or
 *    withdraws the listing (authorization §4 / §9).
 *  - Lifecycle (frozen §9): DRAFT -> SUBMITTED -> PUBLISHED with
 *    PUBLISHED <-> PAUSED, SUBMITTED -> REJECTED and
 *    PUBLISHED/PAUSED -> WITHDRAWN. DRAFT is the only fully editable
 *    state (creator only, offline-creatable, never public).
 *    SUBMITTED is locked. REJECTED and WITHDRAWN are terminal and
 *    immutable. NO automatic transitions of any kind. Structural
 *    changes to a published listing require withdraw + successor
 *    listing; availability amendments on a PUBLISHED listing are
 *    explicit, audited amendments.
 *  - Reviewer separation (§10): the creator NEVER publishes or
 *    rejects their own listing — enforced at the SERVICE LAYER at
 *    every role level including national_administrator. UI hiding
 *    is never the rule. The reviewer verifies references and the
 *    absence of unsupported claims; the reviewer never certifies
 *    service quality.
 *  - Matching (§11) is a DERIVED READ-ONLY view pairing PUBLISHED
 *    OFFERs with PUBLISHED NEEDs on shared capability, service kind
 *    or location. Deterministic, reproducible, non-persistent; no
 *    match records, no notifications, no commitments, no scores.
 *  - Presentation ordering (§12) is deterministic (recency, then
 *    stable id) and NEVER implies quality, trust, popularity or
 *    recommendation.
 *  - Privacy (§14) is STRUCTURAL: a listing carries no personal
 *    contact fields (validated, not merely hidden). Connection
 *    happens through the provider's own stage-defined visibility
 *    rules. On-behalf-of creation is explicitly recorded and
 *    audited; community-authored listings are never fabricated.
 *  - Graph (§18): MarketplaceListing is NOT a graph node. No
 *    edges, no traversal changes, no graph writes, no graph-derived
 *    marketplace scoring. The 19 frozen relationship types stay 19.
 *  - Observatory (§19): no marketplace measurements, no indicator
 *    changes, no observatory view changes. Pilots/interventions
 *    (§20): no references, no writes, no lifecycle coupling.
 *  - Offline-first (§22): DRAFT creation, editing and submission
 *    work with no network dependency. The application never claims
 *    PUBLISHED before publication is confirmed.
 */
(function (SCA) {
  'use strict';

  var STATUSES = ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'PAUSED',
    'REJECTED', 'WITHDRAWN'];
  var TERMINAL = ['REJECTED', 'WITHDRAWN'];
  var PUBLIC_STATUSES = ['PUBLISHED'];

  /* Frozen transition table (scope v1.0 §9 + authorization §9). */
  var TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['PUBLISHED', 'REJECTED'],
    PUBLISHED: ['PAUSED', 'WITHDRAWN'],
    PAUSED: ['PUBLISHED', 'WITHDRAWN'],
    REJECTED: [],
    WITHDRAWN: []
  };

  var KINDS = ['OFFER', 'NEED'];

  /* Frozen twelve-value service-kind vocabulary (§6). */
  var SERVICE_KINDS = ['REPAIR', 'MAINTENANCE', 'TRAINING',
    'APPRENTICESHIP_HOSTING', 'TECHNICAL_ASSISTANCE',
    'FABRICATION', 'LOCAL_PRODUCTION', 'AGRICULTURAL_SERVICES',
    'FISHERIES_SERVICES', 'WATER_SERVICES',
    'ENVIRONMENTAL_KNOWLEDGE', 'RESEARCH_FIELD_SERVICES'];

  /* Frozen five-value availability vocabulary (§7), default UNKNOWN. */
  var AVAILABILITY = ['BY_ARRANGEMENT', 'SCHEDULED_WINDOWS', 'SEASONAL',
    'LIMITED', 'UNKNOWN'];

  var SCOPES = ['SPECIFIC', 'ANYWHERE'];

  /* Polymorphic provider types -> EXISTING frozen collections. */
  var PROVIDER_TYPES = ['PRACTITIONER', 'ORGANIZATION', 'WORKSHOP',
    'TRAINING_PROGRAM'];
  var PROVIDER_COLLECTIONS = {
    PRACTITIONER: 'practitioners',
    ORGANIZATION: 'organizations',
    WORKSHOP: 'workshops',
    TRAINING_PROGRAM: 'training_programs'
  };

  /* The fields a listing may never carry (authorization §13, §14,
   * §19, §20, §28). Validated at every create and update — this is
   * a structural boundary, not a UI convention. */
  var FORBIDDEN_FIELDS = ['phone', 'email', 'street_address', 'address',
    'contact', 'messaging_handle', 'whatsapp', 'telegram', 'price',
    'currency', 'hourly_rate', 'rate', 'service_fee', 'fee',
    'compensation', 'paid', 'commission', 'escrow', 'invoice',
    'payment', 'transaction_status', 'booking', 'appointment',
    'contract', 'delivery', 'score', 'ranking', 'rating', 'trust',
    'trust_level', 'popularity', 'demand', 'response_count',
    'match_count', 'success', 'region', 'radius', 'distance',
    'catchment', 'intervention_id', 'pilot_project_id'];

  function can(user, perm) { return SCA.rbac.can(user, perm); }
  function userName(user) { return (user && user.name) || 'anonymous'; }
  function userRole(user) { return (user && user.role) || 'anon'; }
  function deny(perm) {
    return { ok: false, errors: { permission: perm + ' required.' } };
  }
  function now() { return SCA.util.now(); }

  function audited(action, id, user, opts) {
    opts = opts || {};
    return SCA.audit.log(action, {
      actor: userName(user),
      entity: 'marketplace_listings',
      entity_id: id,
      old_value: opts.old_value || null,
      new_value: opts.new_value || null,
      reason: opts.reason || null
    });
  }

  var SUBSTANTIVE_KEYS = ['listing_kind', 'service_kind',
    'description', 'notes', 'provider_type', 'provider_id',
    'on_behalf_of', 'capability_ids', 'repair_capability_id',
    'location_ids', 'location_scope', 'availability_status',
    'availability_note'];

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

  /* ---------- structural field pins ---------- */

  function forbiddenFieldError(data) {
    var errors = {};
    (Object.keys(data || {})).forEach(function (k) {
      if (FORBIDDEN_FIELDS.indexOf(k) !== -1) {
        errors[k] = 'A marketplace listing can never carry the ' +
          'field "' + k + '" (structural privacy/boundary pin, ' +
          'authorization §13/§14/§19/§20/§28).';
      }
    });
    return errors;
  }

  /* ---------- validation ---------- */

  function kindError(rec) {
    if (KINDS.indexOf(rec.listing_kind) === -1) {
      return { listing_kind: 'Unknown listing kind (frozen ' +
        'vocabulary: OFFER or NEED).' };
    }
    return {};
  }

  function serviceKindError(rec) {
    if (SERVICE_KINDS.indexOf(rec.service_kind) === -1) {
      return { service_kind: 'Unknown service kind (frozen ' +
        'twelve-value vocabulary, authorization §6).' };
    }
    return {};
  }

  function providerError(rec) {
    var errors = {};
    if (PROVIDER_TYPES.indexOf(rec.provider_type) === -1) {
      errors.provider_type = 'Unknown provider type (frozen ' +
        'vocabulary: PRACTITIONER, ORGANIZATION, WORKSHOP, ' +
        'TRAINING_PROGRAM).';
      return errors;
    }
    if (SCA.util.isBlank(rec.provider_id)) {
      errors.provider_id = 'A listing requires its provider ' +
        'reference id.';
      return errors;
    }
    /* References are CANONICAL and are never silently created —
     * a draft still cannot point at a provider that does not exist
     * (the same discipline every stage applies to hard refs). */
    var coll = PROVIDER_COLLECTIONS[rec.provider_type];
    if (!SCA.store.get(coll, rec.provider_id)) {
      errors.provider_id = 'Unknown ' + coll + ' record: ' +
        rec.provider_id + ' (the provider must exist; Stage 13 ' +
        'never manufactures provider identity).';
    }
    return errors;
  }

  /* Public visibility of the provider under its OWN stage's rules
   * (frozen at publication — authorization §4). After publication
   * this check is used ONLY for honest rendering; it never
   * auto-mutates the listing. */
  function providerPubliclyVisible(rec) {
    var coll = PROVIDER_COLLECTIONS[rec.provider_type];
    var p = SCA.store.get(coll, rec.provider_id);
    if (!p) {
      return { resolvable: false, visible: false, provider: null };
    }
    if (rec.provider_type === 'PRACTITIONER') {
      /* Stage 5: consent withdrawn restricts the record; a listing
       * may not anchor to it. Anonymous/masking display stays a
       * RENDERING rule of Stage 5 — the record itself remains
       * referencable. */
      return { resolvable: true,
        visible: p.documentation_consent !== false, provider: p };
    }
    if (rec.provider_type === 'ORGANIZATION') {
      return { resolvable: true,
        visible: p.documentation_consent !== false, provider: p };
    }
    if (rec.provider_type === 'WORKSHOP') {
      /* Stage 8 active set (frozen vocabulary: REPORTED, DOCUMENTED,
       * VERIFIED; INACTIVE/CLOSED are not anchorable). */
      var wsActive = ['REPORTED', 'DOCUMENTED', 'VERIFIED'];
      return { resolvable: true,
        visible: wsActive.indexOf(p.status) !== -1, provider: p };
    }
    /* TRAINING_PROGRAM: Stage 5 lifecycle. A paused or retired
     * program is not an anchor for a NEW publication (DRAFT and
     * PAUSED are planning/inactive states; RETIRED is terminal). */
    var tpVisible = ['APPROVED', 'ACTIVE'];
    return { resolvable: true,
      visible: tpVisible.indexOf(p.status) !== -1, provider: p };
  }

  function capabilitiesError(rec) {
    var errors = {};
    (rec.capability_ids || []).forEach(function (id) {
      if (!SCA.store.get('capabilities', id)) {
        errors.capability_ids = 'Unknown capability record: ' + id +
          ' (Stage 1 canonical references only; zero links is ' +
          'honest — a guess is not).';
      }
    });
    return errors;
  }

  function repairRefError(rec) {
    if (!rec.repair_capability_id) { return {}; }
    if (rec.service_kind !== 'REPAIR') {
      return { repair_capability_id: 'A Stage 8 repair-capability ' +
        'reference is only meaningful on a REPAIR listing ' +
        '(authorization §5).' };
    }
    if (!SCA.store.get('repair_capabilities', rec.repair_capability_id)) {
      return { repair_capability_id: 'Unknown repair_capability ' +
        'record: ' + rec.repair_capability_id + ' (Stage 8 ' +
        'canonical references only).' };
    }
    return {};
  }

  function locationError(rec) {
    var errors = {};
    if (SCOPES.indexOf(rec.location_scope) === -1) {
      errors.location_scope = 'Unknown location scope (SPECIFIC or ' +
        'ANYWHERE).';
      return errors;
    }
    (rec.location_ids || []).forEach(function (id) {
      if (!SCA.store.get('locations', id)) {
        errors.location_ids = 'Unknown location record: ' + id +
          ' (Stage 1 canonical references only; a location is ' +
          'never inferred).';
      }
    });
    if (rec.location_scope === 'SPECIFIC' &&
      (rec.location_ids || []).length === 0) {
      errors.location_ids = 'A SPECIFIC listing requires at least ' +
        'one valid location reference.';
    }
    if (rec.location_scope === 'ANYWHERE' &&
      (rec.location_ids || []).length > 0) {
      errors.location_ids = 'An ANYWHERE listing is not ' +
        'location-bound and carries no location references.';
    }
    return errors;
  }

  function availabilityError(rec) {
    if (AVAILABILITY.indexOf(rec.availability_status) === -1) {
      return { availability_status: 'Unknown availability (frozen ' +
        'five-value vocabulary, authorization §7).' };
    }
    return {};
  }

  function onBehalfError(rec, user) {
    /* On-behalf-of (authorization §14): a practitioner listing is
     * created either by the practitioner themselves (user role
     * 'practitioner') or by an authorized creator acting on the
     * practitioner's behalf — the latter is always explicitly
     * recorded and audited. */
    if (rec.provider_type !== 'PRACTITIONER') { return {}; }
    if (userRole(user) === 'practitioner') { return {}; }
    if (!rec.on_behalf_of || SCA.util.isBlank(rec.on_behalf_of.reason)) {
      return { on_behalf_of: 'A listing referencing a practitioner ' +
        'that is created by another actor requires an explicit ' +
        'on-behalf-of reason (recorded and audited).' };
    }
    return {};
  }

  function validateListing(rec, user) {
    var errors = {};
    Object.assign(errors, forbiddenFieldError(rec));
    Object.assign(errors, kindError(rec));
    Object.assign(errors, serviceKindError(rec));
    Object.assign(errors, providerError(rec));
    Object.assign(errors, capabilitiesError(rec));
    Object.assign(errors, repairRefError(rec));
    Object.assign(errors, locationError(rec));
    Object.assign(errors, availabilityError(rec));
    Object.assign(errors, onBehalfError(rec, user));
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- creation & editing ---------- */

  function createListing(user, data) {
    if (!can(user, 'marketplace.create')) {
      return deny('marketplace.create');
    }
    data = data || {};
    /* Structural pins are validated against the INPUT data — the
     * record only ever carries known fields. */
    var inputBad = forbiddenFieldError(data);
    if (Object.keys(inputBad).length) {
      return { ok: false, errors: inputBad };
    }
    var rec = Object.assign({
      id: null,
      listing_kind: data.listing_kind || null,
      service_kind: data.service_kind || null,
      description: data.description || '',
      notes: data.notes || '',
      provider_type: data.provider_type || null,
      provider_id: data.provider_id || null,
      on_behalf_of: (data.on_behalf_of && data.on_behalf_of.reason) ?
        { reason: data.on_behalf_of.reason } : null,
      capability_ids: data.capability_ids || [],
      repair_capability_id: data.repair_capability_id || null,
      location_ids: data.location_ids || [],
      location_scope: data.location_scope || 'SPECIFIC',
      availability_status: data.availability_status || 'UNKNOWN',
      availability_note: data.availability_note || '',
      status: 'DRAFT',
      reviewer: null,
      reviewed_at: null,
      review_reason: null,
      withdrawn_by: null,
      withdrawn_at: null,
      withdraw_reason: null,
      created_by: userName(user),
      created_at: now(),
      updated_at: now(),
      version: '1',
      history: []
    });
    var v = SCA.models.marketplaceListing.validate(rec);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateListing(rec, user);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    var res = SCA.store.insert('marketplace_listings', rec);
    if (res.ok) {
      audited('marketplace.created', res.record.id, user,
        { new_value: rec.listing_kind + ' ' + rec.service_kind });
      if (rec.on_behalf_of) {
        audited('marketplace.created_on_behalf', res.record.id, user,
          { reason: rec.on_behalf_of.reason });
      }
    }
    return res;
  }

  /* DRAFT: editable by its CREATOR only (every role level including
   * NATIONAL — no role may edit someone else's draft). */
  function updateListing(user, id, patch) {
    if (!can(user, 'marketplace.update')) {
      return deny('marketplace.update');
    }
    var r = SCA.store.get('marketplace_listings', id);
    if (!r) {
      return { ok: false, errors: { id: 'Listing not found.' } };
    }
    if (r.status !== 'DRAFT') {
      return { ok: false, errors: {
        status: 'Only a DRAFT listing is editable (current: ' +
        r.status + '). SUBMITTED is locked; REJECTED and WITHDRAWN ' +
        'are terminal and immutable. A structural change to a ' +
        'published listing is made by withdrawing and creating a ' +
        'successor listing.'
      } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the draft\'s creator may edit it.'
      } };
    }
    patch = patch || {};
    var bad = forbiddenFieldError(patch);
    if (Object.keys(bad).length) {
      return { ok: false, errors: bad };
    }
    var immutable = ['id', 'created_at', 'created_by', 'status',
      'reviewer', 'reviewed_at', 'review_reason', 'withdrawn_by',
      'withdrawn_at', 'withdraw_reason', 'version', 'history',
      'on_behalf_of'];
    immutable.forEach(function (k) {
      if (patch[k] !== undefined) { delete patch[k]; }
    });
    var next = Object.assign({}, r, patch);
    var v = SCA.models.marketplaceListing.validate(next);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    v = validateListing(next, user);
    if (!v.valid) { return { ok: false, errors: v.errors }; }
    pushHistory(r, user, 'DRAFT edit', 'EDIT');
    next.version = r.version;
    next.updated_at = now();
    var res = SCA.store.update('marketplace_listings', id, next);
    if (res.ok) {
      audited('marketplace.edited', id, user, {});
    }
    return res;
  }

  /* PUBLISHED: availability is the ONLY amendable field set (scope
   * v1.0 §12 + authorization §16). An explicit, audited amendment. */
  function amendAvailability(user, id, status, note, reason) {
    if (!can(user, 'marketplace.update')) {
      return deny('marketplace.update');
    }
    var r = SCA.store.get('marketplace_listings', id);
    if (!r) {
      return { ok: false, errors: { id: 'Listing not found.' } };
    }
    if (r.status !== 'PUBLISHED') {
      return { ok: false, errors: {
        status: 'Availability may only be amended on a PUBLISHED ' +
        'listing (current: ' + r.status + '). Structural changes ' +
        'require withdraw + successor listing.'
      } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the listing\'s creator may amend its ' +
        'declared availability.'
      } };
    }
    if (SCA.util.isBlank(reason)) {
      return { ok: false, errors: {
        reason: 'An availability amendment requires an explicit ' +
        'documented reason.'
      } };
    }
    if (AVAILABILITY.indexOf(status) === -1) {
      return { ok: false, errors: {
        availability_status: 'Unknown availability (frozen ' +
        'five-value vocabulary).'
      } };
    }
    pushHistory(r, user, reason, 'AMENDMENT');
    r.availability_status = status;
    r.availability_note = note || r.availability_note || '';
    r.updated_at = now();
    var res = SCA.store.update('marketplace_listings', id, r);
    if (res.ok) {
      audited('marketplace.availability_amended', id, user,
        { old_value: null, new_value: status, reason: reason });
    }
    return res;
  }

  /* ---------- lifecycle ---------- */

  function transition(user, id, to, perm, opts) {
    opts = opts || {};
    if (!can(user, perm)) { return deny(perm); }
    var r = SCA.store.get('marketplace_listings', id);
    if (!r) {
      return { ok: false, errors: { id: 'Listing not found.' } };
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
    pushHistory(r, user, opts.reason || null, 'TRANSITION');
    r.status = to;
    r.updated_at = now();
    if (opts.stamp) { opts.stamp(r); }
    var res = SCA.store.update('marketplace_listings', id, r);
    if (res.ok) {
      audited(opts.action, id, user, { old_value: from,
        new_value: to, reason: opts.reason || null });
    }
    return res;
  }

  /* DRAFT -> SUBMITTED: the creator submits; the record locks. */
  function submitListing(user, id) {
    if (!can(user, 'marketplace.create')) {
      return deny('marketplace.create');
    }
    var r = SCA.store.get('marketplace_listings', id);
    if (!r) {
      return { ok: false, errors: { id: 'Listing not found.' } };
    }
    if (r.created_by !== userName(user)) {
      return { ok: false, errors: {
        creator: 'Only the listing\'s creator may submit it.'
      } };
    }
    return transition(user, id, 'SUBMITTED', 'marketplace.create', {
      action: 'marketplace.submitted'
    });
  }

  /* Reviewer separation (§10): the creator never publishes or
   * rejects their own listing — at every role level including
   * NATIONAL. */
  function separationError(r, user) {
    if (r.created_by === userName(user)) {
      return { creator: 'A creator cannot review their own listing ' +
        '(creator/reviewer separation applies at every role level, ' +
        'including NATIONAL).' };
    }
    return null;
  }

  /* D2 authorization §5 — resume defense in depth: a status of
   * PAUSED is not proof of publication. A record may only resume
   * when its own publication provenance is intact AND the reviewer
   * still resolves to a real account with marketplace.review
   * authority on this deployment's local roster (user accounts
   * never travel in bundles — the frozen privacy pin makes the
   * local roster the only honest authority). This blocks a
   * hand-edited or forged store record from reaching PUBLISHED
   * through the resume path. */
  function publicationGateError(r) {
    if (!r.reviewer || !r.reviewed_at) {
      return 'This listing carries no publication provenance ' +
        '(reviewer and review timestamp). A status of PAUSED is ' +
        'not proof of publication — resume is refused (the only ' +
        'legitimate path into PAUSED is PUBLISHED -> PAUSED).';
    }
    if (!r.review_reason ||
      !String(r.review_reason).replace(/^\s+|\s+$/g, '')) {
      return 'The listing has no documented review reason. Resume ' +
        'is refused: status alone is not publication provenance.';
    }
    if (r.created_by === r.reviewer) {
      return 'Creator/reviewer separation is violated in this ' +
        'record\'s provenance (creator "' + r.created_by +
        '" appears as its own reviewer). Resume is refused.';
    }
    var roster = SCA.store.all('users').filter(function (u) {
      return u && u.name === r.reviewer; });
    if (!roster.length) {
      return 'Reviewer "' + r.reviewer + '" does not resolve to an ' +
        'account on this deployment (a reviewer string is not ' +
        'publication authority). Resume is refused.';
    }
    var reviewRoles = (SCA.rbac && SCA.rbac.rolesFor) ?
      SCA.rbac.rolesFor('marketplace.review') : [];
    if (!roster.some(function (u) {
      return reviewRoles.indexOf(u.role) !== -1; })) {
      return 'Reviewer "' + r.reviewer + '" holds no ' +
        'marketplace.review authority. Resume is refused.';
    }
    return null;
  }

  /* SUBMITTED -> PUBLISHED: an authorized reviewer (never the
   * creator) publishes. The provider must resolve to a publicly
   * visible record AT PUBLICATION (authorization §4). After
   * publication, provider retirement renders honestly and never
   * auto-mutates the listing. */
  function publishListing(user, id, reason) {
    return transition(user, id, 'PUBLISHED', 'marketplace.review', {
      action: 'marketplace.published',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Publication requires an explicit documented ' +
        'reason (the reviewer verifies references and the absence ' +
        'of unsupported claims — never service quality).',
      gate: function (r) {
        var sep = separationError(r, user);
        if (sep) { return sep; }
        var pv = providerPubliclyVisible(r);
        if (!pv.resolvable) {
          return { provider_id: 'The provider reference does not ' +
            'resolve: ' + r.provider_type + ' ' + r.provider_id +
            ' (a published listing must resolve to an existing ' +
            'provider).' };
        }
        if (!pv.visible) {
          return { provider_id: 'The provider is not publicly ' +
            'visible under its own stage\'s rules (a published ' +
            'listing must resolve to an appropriate publicly ' +
            'visible provider).' };
        }
        return null;
      },
      stamp: function (r) {
        r.reviewer = userName(user);
        r.reviewed_at = now();
        r.review_reason = reason;
      }
    });
  }

  /* SUBMITTED -> REJECTED: terminal, immutable, reviewer reason. */
  function rejectListing(user, id, reason) {
    return transition(user, id, 'REJECTED', 'marketplace.review', {
      action: 'marketplace.rejected',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Rejection requires an explicit documented ' +
        'reason.',
      gate: function (r) {
        var sep = separationError(r, user);
        if (sep) { return sep; }
        return null;
      },
      stamp: function (r) {
        r.reviewer = userName(user);
        r.reviewed_at = now();
        r.review_reason = reason;
      }
    });
  }

  /* PUBLISHED -> PAUSED: creator-initiated, reversible, audited
   * (§9). PAUSED listings are absent from matching and from public
   * discovery; resuming is the symmetric audited transition. */
  function pauseListing(user, id, reason) {
    return transition(user, id, 'PAUSED', 'marketplace.update', {
      action: 'marketplace.paused',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Pausing requires an explicit documented ' +
        'reason (audited; reversible by the creator).',
      gate: function (r) {
        if (r.created_by !== userName(user)) {
          return { creator: 'Only the listing\'s creator may pause ' +
            'or resume it.' };
        }
        return null;
      },
      /* D2 authorization §6: pause provenance mirrors withdrawal —
       * the actor, timestamp and documented reason travel with the
       * record so an import can verify them against the local
       * roster. */
      stamp: function (r) {
        r.paused_by = userName(user);
        r.paused_at = now();
        r.pause_reason = reason;
      }
    });
  }

  function resumeListing(user, id, reason) {
    return transition(user, id, 'PUBLISHED', 'marketplace.update', {
      action: 'marketplace.resumed',
      requireReason: true,
      reason: reason,
      reasonMessage: 'Resuming requires an explicit documented ' +
        'reason (audited).',
      gate: function (r) {
        if (r.created_by !== userName(user)) {
          return { creator: 'Only the listing\'s creator may pause ' +
            'or resume it.' };
        }
        var pv = providerPubliclyVisible(r);
        if (!pv.resolvable || !pv.visible) {
          return { provider_id: 'The listing cannot return to ' +
            'PUBLISHED while its referenced provider is not ' +
            'publicly visible — render honestly and withdraw ' +
            'instead (no automatic lifecycle mutation).' };
        }
        /* D2 §5 defense in depth: provenance, not status. */
        var provErr = publicationGateError(r);
        if (provErr) { return { provenance: provErr }; }
        return null;
      }
    });
  }

  /* PUBLISHED/PAUSED -> WITHDRAWN: terminal, immutable, reason +
   * actor + timestamp + audit (§9). */
  function withdrawListing(user, id, reason) {
    return transition(user, id, 'WITHDRAWN',
      'marketplace.withdraw', {
        action: 'marketplace.withdrawn',
        requireReason: true,
        reason: reason,
        reasonMessage: 'Withdrawal requires an explicit documented ' +
          'reason (terminal and immutable).',
        gate: function (r) {
          if (r.created_by !== userName(user)) {
            return { creator: 'Only the listing\'s creator may ' +
              'withdraw it.' };
          }
          return null;
        },
        stamp: function (r) {
          r.withdraw_reason = reason;
          r.withdrawn_by = userName(user);
          r.withdrawn_at = now();
        }
      });
  }

  /* ---------- honest provider rendering (§4) ---------- */

  /* NEVER a lifecycle mutation: this describes the CURRENT
   * resolvability of the referenced provider so pages can render
   * "Referenced provider no longer available" honestly. */
  function providerStatus(rec) {
    var coll = PROVIDER_COLLECTIONS[rec.provider_type];
    var p = SCA.store.get(coll, rec.provider_id);
    if (!p) {
      return { available: false,
        message: 'Referenced provider no longer available.' };
    }
    if (rec.provider_type === 'WORKSHOP') {
      var wsActive = ['REPORTED', 'DOCUMENTED', 'VERIFIED'];
      if (wsActive.indexOf(p.status) === -1) {
        return { available: false,
          message: 'Referenced provider no longer available ' +
          '(workshop status: ' + p.status + ').' };
      }
    }
    if (rec.provider_type === 'TRAINING_PROGRAM' &&
      ['APPROVED', 'ACTIVE'].indexOf(p.status) === -1) {
      return { available: false,
        message: 'Referenced provider no longer available ' +
        '(training program status: ' + p.status + ').' };
    }
    if ((rec.provider_type === 'PRACTITIONER' ||
      rec.provider_type === 'ORGANIZATION') &&
      p.documentation_consent === false) {
      return { available: false,
        message: 'Referenced provider no longer available ' +
        '(documentation consent withdrawn).' };
    }
    return { available: true, message: null, provider: p };
  }

  /* ---------- read paths ---------- */

  /* Anonymous visitors see PUBLISHED listings only (§9). Signed-in
   * roles see workflow material per the marketplace.read matrix. */
  function list(user, opts) {
    opts = opts || {};
    var all = SCA.store.all('marketplace_listings');
    var role = userRole(user);
    if (role === 'anon') {
      all = all.filter(function (r) {
        return PUBLIC_STATUSES.indexOf(r.status) !== -1;
      });
    }
    if (opts.kind) {
      all = all.filter(function (r) {
        return r.listing_kind === opts.kind;
      });
    }
    if (opts.service_kind) {
      all = all.filter(function (r) {
        return r.service_kind === opts.service_kind;
      });
    }
    if (opts.status) {
      all = all.filter(function (r) {
        return r.status === opts.status;
      });
    }
    /* Deterministic ordering (§12): recency, then stable id —
     * never quality, trust, popularity or recommendation. */
    return all.slice().sort(function (a, b) {
      if (a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? 1 : -1;
      }
      return a.id < b.id ? -1 : 1;
    });
  }

  function get(user, id) {
    if (!can(user, 'marketplace.read')) {
      return { ok: false, errors: { permission:
        'marketplace.read required.' } };
    }
    var r = SCA.store.get('marketplace_listings', id);
    if (!r) {
      return { ok: false, errors: { id: 'Listing not found.' } };
    }
    var role = userRole(user);
    if (role === 'anon' && PUBLIC_STATUSES.indexOf(r.status) === -1) {
      return { ok: false, errors: { id: 'Listing not found.' } };
    }
    return { ok: true, record: r };
  }

  /* ---------- derived matching (§11) ---------- */

  /* A DERIVED READ-ONLY view: published OFFERs paired with
   * published NEEDs sharing at least one capability, the same
   * service kind, or at least one location reference. Deterministic,
   * reproducible, non-persistent. Creates no records, no scores,
   * no commitments. The basis for every pair is displayed.
   * Listings whose referenced provider is currently unavailable
   * are excluded from matching (honest presentation — a connection
   * whose provider is gone is not offered); this is a VIEW rule
   * and never a lifecycle mutation. */
  function matches(user) {
    if (!can(user, 'marketplace.read')) {
      return { ok: false, errors: { permission:
        'marketplace.read required.' } };
    }
    var live = SCA.store.all('marketplace_listings').filter(
      function (r) {
        if (r.status !== 'PUBLISHED') { return false; }
        return providerStatus(r).available;
      });
    var offers = live.filter(function (r) {
      return r.listing_kind === 'OFFER';
    });
    var needs = live.filter(function (r) {
      return r.listing_kind === 'NEED';
    });
    var pairs = [];
    offers.forEach(function (o) {
      needs.forEach(function (n) {
        var basis = [];
        var sharedCap = (o.capability_ids || []).filter(function (c) {
          return (n.capability_ids || []).indexOf(c) !== -1;
        });
        if (sharedCap.length) {
          basis.push('shared capability: ' + sharedCap.join(', '));
        }
        if (o.service_kind === n.service_kind) {
          basis.push('service kind: ' + o.service_kind);
        }
        var sharedLoc = (o.location_ids || []).filter(function (l) {
          return (n.location_ids || []).indexOf(l) !== -1;
        });
        if (sharedLoc.length) {
          basis.push('shared location: ' + sharedLoc.join(', '));
        }
        if (!basis.length) { return; }
        pairs.push({ offer_id: o.id, need_id: n.id, basis: basis });
      });
    });
    /* Deterministic ordering (§12): most recent offer first, then
     * stable ids. Never a ranking of any kind. */
    pairs.sort(function (a, b) {
      var oa = SCA.store.get('marketplace_listings', a.offer_id);
      var ob = SCA.store.get('marketplace_listings', b.offer_id);
      if (oa && ob && oa.created_at !== ob.created_at) {
        return oa.created_at < ob.created_at ? 1 : -1;
      }
      if (a.offer_id !== b.offer_id) {
        return a.offer_id < b.offer_id ? -1 : 1;
      }
      return a.need_id < b.need_id ? -1 : 1;
    });
    return { ok: true, pairs: pairs };
  }

  /* Neutral overview: counts with explicit record bases — a count
   * of documented listings, never a claim about what exists. */
  function overview(user) {
    var all = list(user);
    var counts = { by_kind: {}, by_service_kind: {}, by_status: {},
      total: all.length };
    KINDS.forEach(function (k) { counts.by_kind[k] = 0; });
    SERVICE_KINDS.forEach(function (k) {
      counts.by_service_kind[k] = 0; });
    STATUSES.forEach(function (k) { counts.by_status[k] = 0; });
    all.forEach(function (r) {
      counts.by_kind[r.listing_kind] =
        (counts.by_kind[r.listing_kind] || 0) + 1;
      counts.by_service_kind[r.service_kind] =
        (counts.by_service_kind[r.service_kind] || 0) + 1;
      counts.by_status[r.status] =
        (counts.by_status[r.status] || 0) + 1;
    });
    return { ok: true, counts: counts,
      basis: 'Counts of marketplace listing records visible to you ' +
      'in this dataset — not a claim about what services exist.' };
  }

  SCA.marketplace = {
    createListing: createListing,
    updateListing: updateListing,
    amendAvailability: amendAvailability,
    submitListing: submitListing,
    publishListing: publishListing,
    rejectListing: rejectListing,
    pauseListing: pauseListing,
    resumeListing: resumeListing,
    withdrawListing: withdrawListing,
    providerStatus: providerStatus,
    list: list,
    get: get,
    matches: matches,
    overview: overview,
    providerPubliclyVisible: providerPubliclyVisible,
    STATUSES: STATUSES,
    TERMINAL: TERMINAL,
    PUBLIC_STATUSES: PUBLIC_STATUSES,
    TRANSITIONS: TRANSITIONS,
    KINDS: KINDS,
    SERVICE_KINDS: SERVICE_KINDS,
    AVAILABILITY: AVAILABILITY,
    SCOPES: SCOPES,
    PROVIDER_TYPES: PROVIDER_TYPES,
    PROVIDER_COLLECTIONS: PROVIDER_COLLECTIONS,
    FORBIDDEN_FIELDS: FORBIDDEN_FIELDS
  };
})(SCA);
