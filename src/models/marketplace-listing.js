/*
 * MarketplaceListing model (Stage 13: Capability Marketplace,
 * frozen scope v1.0 + implementation authorization v1.0).
 *
 * A MarketplaceListing is a DISCOVERY AND CONNECTION record: the
 * documented possibility that a capability service can be provided
 * (OFFER) or is needed (NEED). It is not a transaction, a booking,
 * a price, a contract, a rating or a guarantee of service quality.
 *
 * FROZEN Stage 13 scope v1.0 rules made structural here:
 *  - Exactly ONE Stage 13 domain entity exists: MarketplaceListing.
 *    No MarketplaceProvider, MarketplaceMatch, MarketplaceAvailability,
 *    MarketplaceRating, MarketplaceReview, MarketplaceRequest,
 *    MarketplaceOffer, MarketplaceScore, MatchScore, ProviderScore,
 *    ListingScore, TrustLevel, VerificationScore, ProviderRanking,
 *    ListingRanking, PopularityCount, ResponseCount or any other
 *    shadow entity or field exists (authorization §28).
 *  - Provider references are POLYMORPHIC over EXISTING frozen
 *    entities only (PRACTITIONER / ORGANIZATION / WORKSHOP /
 *    TRAINING_PROGRAM). Stage 13 never manufactures provider
 *    identity or provider competence (authorization §4).
 *  - capability_ids are canonical Stage 1 references; ZERO links is
 *    honest ("Not yet documented"), never filled with a guess.
 *    repair_capability_id optionally references Stage 8.
 *  - location_ids are canonical Stage 1 references only; no Region
 *    entity, no geographic RBAC, no radius/distance/catchment
 *    calculation (authorization §8).
 *  - Availability is a CONTROLLED five-value vocabulary (default
 *    UNKNOWN = not yet documented); it is declared information,
 *    never a calendar, booking or scheduling system (§7).
 *  - Lifecycle (frozen §9): DRAFT -> SUBMITTED -> PUBLISHED with
 *    PUBLISHED <-> PAUSED, SUBMITTED -> REJECTED and
 *    PUBLISHED/PAUSED -> WITHDRAWN. REJECTED and WITHDRAWN are
 *    terminal and immutable; no resurrection; NO automatic
 *    transitions — provider retirement renders honestly and is
 *    handled by humans through PAUSE/WITHDRAW.
 *  - Privacy is STRUCTURAL: no phone, email, street address,
 *    messaging handle or private contact field exists on a listing
 *    (authorization §14). Connection happens through the
 *    referenced provider's own stage-defined visibility rules.
 *  - NO pricing/payment/compensation fields of any kind; no
 *    score, ranking, rating, trust, popularity or demand fields.
 *  - Matching is a DERIVED READ-ONLY view over PUBLISHED records;
 *    it is never persisted, never scored, never ranked.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'marketplace_listings',
    required: ['status'],
    fields: {
      /* What the listing is. */
      listing_kind: { type: 'string', enum: 'marketplace_listing_kinds' },
      service_kind: { type: 'string', enum: 'marketplace_service_kinds' },
      description: { type: 'string' },
      notes: { type: 'string' },

      /* Who provides / needs it (existing records only). */
      provider_type: { type: 'string', enum: 'marketplace_provider_types' },
      provider_id: { type: 'string' },
      on_behalf_of: { type: 'object' },

      /* What capability services it concerns (Stage 1 / Stage 8). */
      capability_ids: { type: 'array' },
      repair_capability_id: { type: 'string' },

      /* Where (canonical Stage 1 locations only). */
      location_ids: { type: 'array' },
      location_scope: { type: 'string',
        enum: 'marketplace_location_scopes' },

      /* Declared availability (controlled vocabulary; never a
       * calendar or booking system). */
      availability_status: { type: 'string',
        enum: 'marketplace_availability' },
      availability_note: { type: 'string' },

      /* Lifecycle + governance. */
      status: { type: 'string', enum: 'marketplace_statuses' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      /* D2 authorization §6: pause provenance, mirroring the
       * withdrawal pattern — the frozen pause workflow is a
       * creator-only, documented, audited action, and its actor
       * must be verifiable at import (never an arbitrary string). */
      paused_by: { type: 'string' },
      paused_at: { type: 'string' },
      pause_reason: { type: 'string' },
      withdrawn_by: { type: 'string' },
      withdrawn_at: { type: 'string' },
      withdraw_reason: { type: 'string' },

      created_by: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  /* Structural privacy pin (authorization §14): a listing can never
   * CARRY personal contact information — this is validated at every
   * create and update, not merely hidden in the UI. */
  m.CONTACT_FIELDS_PROHIBITED = ['phone', 'email', 'street_address',
    'address', 'contact', 'messaging_handle', 'whatsapp', 'telegram'];

  /* Structural boundary pins (authorization §13, §19, §20, §28):
   * pricing/transaction, score/ranking and Stage 10/11 coupling
   * fields can never exist on a listing. */
  m.FORBIDDEN_FIELDS = ['price', 'currency', 'hourly_rate', 'rate',
    'service_fee', 'fee', 'compensation', 'paid', 'commission',
    'escrow', 'invoice', 'payment', 'transaction_status', 'booking',
    'appointment', 'schedule_slots', 'contract', 'score', 'ranking',
    'rating', 'trust', 'trust_level', 'popularity', 'demand',
    'response_count', 'match_count', 'success', 'region', 'radius',
    'distance', 'catchment', 'intervention_id', 'pilot_project_id'];

  SCA.models = SCA.models || {};
  SCA.models.marketplaceListing = m;
  SCA.models.marketplace_listings = m;
})(SCA);
