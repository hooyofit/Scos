/*
 * CapabilityReserve model (Stage 14: National Capability Reserve
 * & Institutional Continuity, frozen scope v1.1 + Gate C
 * implementation authorization).
 *
 * A CapabilityReserve represents a DELIBERATELY MAINTAINED reserve
 * structure for one or more capabilities: the documented people,
 * knowledge, technical resources, materials, institutions and
 * fallback pathways that let a capability survive disruption and
 * pass to the next generation. It is the reserve STRUCTURE, not a
 * physical inventory, and never a claim that the capability IS
 * resilient.
 *
 * FROZEN Stage 14 v1.1 rules made structural here:
 *  - Exactly THREE Stage 14 domain entities exist
 *    (CapabilityReserve, ContinuityPlan, CapabilityAsset). No
 *    ReserveAsset, ReserveGap, ContinuityResult,
 *    ContinuityAssessment, ContinuityScore, ReserveScore,
 *    ResilienceScore, BatteryState, SpineNode, FailureTestResult,
 *    OnePersonResult, ThreeGenerationResult, SuccessorRecord or
 *    any other shadow entity or field exists (authorization §3).
 *  - Lifecycle (frozen §6): DRAFT -> SUBMITTED -> VERIFIED ->
 *    ACTIVE <-> SUSPENDED, plus SUBMITTED -> REJECTED and
 *    ACTIVE/SUSPENDED -> RETIRED. REJECTED and RETIRED are
 *    terminal and immutable; no resurrection; NO automatic
 *    transition, activation or retirement of any kind.
 *  - VERIFIED means the reserve definition passed review. ACTIVE
 *    means it additionally has a documented custodian and is
 *    formally maintained (frozen §1 decision 3). There is no
 *    "reserve.activate" permission.
 *  - reserve_types is an ARRAY over the frozen eight-value
 *    vocabulary; a reserve may contain multiple types (§3).
 *  - Custodian chain: owner + custodian + optional successor and
 *    secondary custodian. A populated successor field never IMPLIES
 *    that a successor exists in practice — the reference must
 *    resolve to an authoritative existing record (§8), and the
 *    distinction is enforced, not decorative.
 *  - All references are CANONICAL and HARD: capabilities,
 *    locations, organizations, recovery profiles, training
 *    programs, workshops, practitioners and evidence must exist.
 *    Stage 14 never manufactures the referenced records.
 *  - Privacy is STRUCTURAL: no phone, email, street address,
 *    messaging handle or private contact field exists on a reserve.
 *    Person references are Stage 5 practitioner references under
 *    Stage 5 visibility rules (authorization §28).
 *  - NO scoring, ranking, popularity, risk, probability,
 *    resilience, percentage or quality fields of any kind
 *    (authorization §37). Known gaps are documented conditions
 *    from the frozen thirteen-value vocabulary — never a score.
 *  - No automatic coupling: nothing here mutates interventions,
 *    pilots, marketplace listings, census records, recovery
 *    profiles or any other stage's lifecycle (authorization §23).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capability_reserves',
    required: ['status'],
    fields: {
      /* What the reserve is. */
      name: { type: 'string' },
      description: { type: 'string' },
      continuity_scope: { type: 'string' },
      activation_conditions: { type: 'string' },
      stewardship_notes: { type: 'string' },
      safety_notes: { type: 'string' },

      /* Reserve types (frozen eight-value vocabulary, ARRAY — a
       * reserve may contain multiple categories). */
      reserve_types: { type: 'array' },

      /* What capabilities the reserve protects (canonical Stage 1). */
      capability_ids: { type: 'array' },
      fallback_capability_ids: { type: 'array' },
      location_ids: { type: 'array' },

      /* Stewardship (existing authoritative organizations only). */
      owner_organization_id: { type: 'string' },
      custodian_organization_id: { type: 'string' },
      successor_custodian_organization_id: { type: 'string' },
      secondary_custodian_organization_id: { type: 'string' },

      /* Consumed authorities (hard references). */
      recovery_profile_ids: { type: 'array' },
      training_program_ids: { type: 'array' },
      workshop_ids: { type: 'array' },
      documentation_refs: { type: 'array' },
      evidence_refs: { type: 'array' },
      practitioner_refs: { type: 'array' },

      /* Documented conditions (frozen thirteen-value vocabulary).
       * A gap is a documented condition, never a score. */
      known_gaps: { type: 'array' },

      /* Lifecycle + governance. */
      status: { type: 'string', enum: 'reserve_statuses' },
      review_status: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      rejection_reason: { type: 'string' },
      rejected_by: { type: 'string' },
      rejected_at: { type: 'string' },
      retired_by: { type: 'string' },
      retired_at: { type: 'string' },
      retirement_reason: { type: 'string' },

      created_by: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  /* Structural privacy pin (authorization §28): a reserve can never
   * CARRY personal contact information — validated at every create
   * and update, not merely hidden in the UI. */
  m.CONTACT_FIELDS_PROHIBITED = ['phone', 'email', 'street_address',
    'address', 'contact', 'messaging_handle', 'whatsapp', 'telegram'];

  /* Structural boundary pins (authorization §3/§20/§26/§30/§37):
   * scores, rankings, probabilities, percentages and cross-stage
   * lifecycle coupling fields can never exist on a reserve. */
  m.FORBIDDEN_FIELDS = ['score', 'ranking', 'rating', 'resilience',
    'resilience_score', 'reserve_score', 'continuity_score',
    'risk', 'risk_score', 'probability', 'failure_probability',
    'percentage', 'battery', 'battery_percentage', 'maturity',
    'quality', 'strength', 'popularity', 'demand', 'inventory_count',
    'intervention_id', 'pilot_project_id', 'listing_id',
    'measurement_id', 'indicator_id', 'auto_created',
    'auto_generated'];

  SCA.models = SCA.models || {};
  SCA.models.capabilityReserve = m;
  SCA.models.capability_reserves = m;
})(SCA);
