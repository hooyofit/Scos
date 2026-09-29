/*
 * ContinuityPlan model (Stage 14: National Capability Reserve
 * & Institutional Continuity, frozen scope v1.1 + Gate C
 * implementation authorization).
 *
 * A ContinuityPlan documents WHAT MUST BE PRESERVED, AVAILABLE AND
 * REPRODUCIBLE for a capability to continue or return across
 * disruption and generations. It is NOT an emergency response plan
 * and it never implies that the capability IS currently resilient —
 * it is a documented continuity design.
 *
 * Distinction (frozen §1/§27): a Stage 9 RecoveryProfile answers
 * "how can this capability recover after failure?"; a
 * ContinuityPlan answers "what must be preserved and reproduced so
 * the capability remains available across disruption and
 * generations?". Both are referenced, neither duplicated.
 *
 * FROZEN Stage 14 v1.1 rules made structural here:
 *  - Lifecycle (frozen §10): DRAFT -> SUBMITTED -> REVIEWED ->
 *    ACTIVE, plus SUBMITTED -> REJECTED and ACTIVE -> RETIRED.
 *    No SUSPENDED state. REJECTED and RETIRED are terminal and
 *    immutable; no resurrection; no automatic transitions.
 *  - reserve_id is OPTIONAL (frozen §1 decision 4): a plan may
 *    exist for a capability before a formal reserve exists.
 *  - The plan lifecycle is INDEPENDENT of the reserve lifecycle
 *    (frozen §11): a suspended reserve never auto-mutates a plan;
 *    the UI displays the referenced reserve's state honestly.
 *  - disruption_scenarios come from the frozen six-value Six-Month
 *    Failure Test vocabulary (§12). They document what should be
 *    examined — they never predict outcomes and never calculate
 *    probability. Stage 8 FailureScenario stays authoritative for
 *    equipment/system failure modes (§13).
 *  - essential_people are STRUCTURED references only (frozen §5):
 *    Stage 5 practitioners, Stage 5 apprentices where appropriate,
 *    or documented institutional roles. Never a free-text person
 *    inventory; no new person entity; Stage 5 privacy rules apply.
 *  - known_gaps come from the frozen thirteen-value vocabulary
 *    (§17): documented conditions, never a score.
 *  - NO scoring, ranking, resilience, risk or probability fields
 *    (authorization §37).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'continuity_plans',
    required: ['status'],
    fields: {
      /* What the plan protects. capability_id is REQUIRED (a plan
       * always answers for one capability); reserve_id is OPTIONAL. */
      capability_id: { type: 'string' },
      reserve_id: { type: 'string' },

      /* Six-Month Failure Test scenarios (frozen six-value
       * vocabulary; dependency-availability scenarios only). */
      disruption_scenarios: { type: 'array' },

      /* Documented dependencies (structured; hard references are
       * enforced at the workflow/import layer). */
      essential_people: { type: 'array' },
      knowledge_dependencies: { type: 'array' },
      material_dependencies: { type: 'array' },
      tool_dependencies: { type: 'array' },
      energy_dependencies: { type: 'array' },
      spare_part_dependencies: { type: 'array' },
      institutional_dependencies: { type: 'array' },
      fallback_capability_ids: { type: 'array' },
      recovery_profile_ids: { type: 'array' },
      training_program_ids: { type: 'array' },
      documentation_refs: { type: 'array' },
      geographic_redundancy_refs: { type: 'array' },

      /* Documented restoration pathway (descriptive order; never
       * an automatic sequence executor). */
      restoration_sequence: { type: 'array' },

      /* Documented conditions (frozen thirteen-value vocabulary). */
      known_gaps: { type: 'array' },

      /* Lifecycle + governance. */
      status: { type: 'string', enum: 'continuity_plan_statuses' },
      owner: { type: 'string' },
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

  /* Structural privacy pin (authorization §28): a plan can never
   * CARRY personal contact information. essential_people is a
   * structured-reference field; free-text person inventories are
   * rejected at the workflow layer. */
  m.CONTACT_FIELDS_PROHIBITED = ['phone', 'email', 'street_address',
    'address', 'contact', 'messaging_handle', 'whatsapp', 'telegram'];

  /* Structural boundary pins (authorization §3/§26/§30/§37). */
  m.FORBIDDEN_FIELDS = ['score', 'ranking', 'rating', 'resilience',
    'resilience_score', 'continuity_score', 'plan_score',
    'risk', 'risk_score', 'probability', 'failure_probability',
    'percentage', 'battery', 'battery_percentage', 'outcome',
    'predicted_outcome', 'failure_result', 'intervention_id',
    'pilot_project_id', 'listing_id', 'measurement_id',
    'indicator_id', 'auto_created', 'auto_generated'];

  SCA.models = SCA.models || {};
  SCA.models.continuityPlan = m;
  SCA.models.continuity_plans = m;
})(SCA);
