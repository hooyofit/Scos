/*
 * PilotProject model (Stage 11: Regional Capability Pilots, frozen
 * scope v1.1).
 *
 * A PilotProject is a COORDINATION record: a regional umbrella that
 * organizes existing capability-strengthening activities (Stage 10
 * interventions, Stage 5 organizations / training programs, Stage 8
 * workshops, Stage 5 practitioners) in a defined regional scope.
 *
 * FROZEN Stage 11 scope v1.1 rules made structural here:
 *  - Exactly ONE Stage 11 entity. No Region, PilotOutcome,
 *    PilotParticipant, PilotMetric, PilotScore, PilotPriority,
 *    PilotMeasurement or any other shadow entity exists.
 *  - A pilot COORDINATES; it never re-governs. It holds no outcome
 *    field of any kind: the outcomes of constituent interventions
 *    remain governed by Stage 10, competence by Stage 5, census
 *    methodology by Stage 6. Concluding a pilot is an administrative
 *    lifecycle state only and never implies success.
 *  - Regional scope is expressed ONLY through canonical Stage 1
 *    Location references (location_ids). There is no Region entity
 *    and no free-floating regional identity; displayed regional
 *    labels are derived from / validated against the canonical
 *    Location records. Stage 11 never invents coordinates.
 *  - Constituent references are many-to-many and transfer NO
 *    ownership or lifecycle authority: removing an intervention
 *    from a pilot never modifies the intervention.
 *  - census_snapshot_id optionally references an IMMUTABLE Stage 6
 *    snapshot — a dated historical "began against" reference, never a
 *    live baseline and never recalculated here.
 *  - Lifecycle: PROPOSED -> APPROVED -> ACTIVE -> CONCLUDED, with
 *    CANCELLED reachable from PROPOSED/APPROVED/ACTIVE. CONCLUDED and
 *    CANCELLED are terminal and immutable; there is no RETIRED pilot
 *    state and no resurrection.
 *  - NOT a graph node: a pilot never writes to the Stage 7 graph.
 *  - No scores, no rankings, no rates, no percentages, no
 *    prioritization. Categorical outcome COUNTS exist only in the
 *    read-only overview view with explicit count bases.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'pilot_projects',
    required: ['name', 'status'],
    fields: {
      name: { type: 'string' },
      objective: { type: 'string' },
      status: { type: 'string', enum: 'pilot_statuses' },

      /* Regional scope: canonical Stage 1 Location references ONLY.
       * The workflow validates that these resolve; the displayed
       * regional label is derived from these records (never a
       * free-standing regional identity). */
      location_ids: { type: 'array' },

      /* Constituent activities (by reference only; many-to-many;
       * membership transfers NO authority over the referenced
       * records). Practitioner references follow the existing
       * Stage 5 privacy/masking rules everywhere. */
      intervention_ids: { type: 'array' },
      organization_ids: { type: 'array' },
      workshop_ids: { type: 'array' },
      training_program_ids: { type: 'array' },
      practitioner_ids: { type: 'array' },

      /* Optional historical baseline: an IMMUTABLE Stage 6 census
       * snapshot. "This pilot began against Census Snapshot X" —
       * dated, versioned, never recalculated, never a live baseline,
       * never copied into pilot-owned mutable fields. */
      census_snapshot_id: { type: 'string' },

      /* Lifecycle bookkeeping (the full audit trail lives in
       * audit_log; history snapshots follow the established
       * version/history architecture). */
      reviewer: { type: 'string' },
      review_reason: { type: 'string' },
      approved_at: { type: 'string' },
      activated_at: { type: 'string' },
      concluded_at: { type: 'string' },
      cancelled_at: { type: 'string' },
      last_reason: { type: 'string' },
      created_by: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.pilot_project = m;
  SCA.models.pilot_projects = m;
})(SCA);
