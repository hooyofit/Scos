/*
 * Measurement model (Stage 12: Capability Observatory & Measurement
 * Foundation, frozen scope v1.1 + implementation authorization v1.0).
 *
 * A Measurement is a FACTUAL RECORDED OBSERVATION of a measurable
 * variable at a defined point or period, within an explicit
 * observation scope. It is an INPUT to analysis — it is never itself
 * an indicator result, and a computed indicator value is never
 * written back into it.
 *
 * FROZEN Stage 12 scope v1.1 rules made structural here:
 *  - Exactly TWO Stage 12 domain entities exist: Measurement and
 *    Indicator. No IndicatorValue, MeasurementResult,
 *    MeasurementSnapshot, MeasurementMethodology, ObservatoryMetric,
 *    CapabilityScore, RegionalScore, PilotScore, BalanceSheet,
 *    ResilienceScore, IndependenceScore, ReadinessScore,
 *    CapabilityRanking or any other shadow entity exists.
 *  - basis uses EXACTLY the frozen four-value data-origin vocabulary
 *    (OBSERVED / ESTIMATED / REPORTED / UNKNOWN). There is no second
 *    basis vocabulary. UNKNOWN means value === null — never zero.
 *    Zero requires an explicit factual basis (OBSERVED/REPORTED).
 *    An ESTIMATED value requires an approved methodology
 *    (census-derived: an APPROVED census_methodologies record) or a
 *    documented method (non-census), enforced by the workflow.
 *  - measurement_kind and unit are CONTROLLED vocabularies — never
 *    free text (authorization §4).
 *  - observation_scope is MANDATORY: "documented within a defined
 *    scope" never means "the documented quantity represents the
 *    total population" (frozen carry-forward rule).
 *  - Lifecycle (frozen): DRAFT -> SUBMITTED -> UNDER_REVIEW ->
 *    ACCEPTED, with UNDER_REVIEW -> REJECTED and ACCEPTED ->
 *    SUPERSEDED. DRAFT is the only editable state; every other
 *    state is locked or terminal-immutable. An accepted measurement
 *    is NEVER silently edited: a correction creates a successor
 *    (supersedes_id) and retires the original; provenance and audit
 *    history remain intact.
 *  - Methodology authority: Stage 6 census_methodologies is reused
 *    where a methodology reference applies (frozen scope v1.1 §3);
 *    no measurement methodology entity exists and Stage 6 is never
 *    modified. Non-census measurements document their method in the
 *    method/provenance fields.
 *  - Source references point at EXISTING authoritative records
 *    (frozen scope v1.1 §11) through a controlled source-type
 *    vocabulary. Sources are never duplicated, and a measurement
 *    never upgrades evidence (Stage 3 remains authoritative).
 *  - derivation DISTINGUISHES directly documented values from
 *    GRAPH_DERIVED values (frozen scope v1.1 §15). A measurement
 *    never writes to the Stage 7 graph.
 *  - NOT a score, ranking or priority of any kind.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'measurements',
    required: ['status'],
    fields: {
      /* What was measured. */
      value: { type: 'number' },
      category_value: { type: 'string' },
      unit: { type: 'string', enum: 'measurement_units' },
      measurement_kind: { type: 'string', enum: 'measurement_kinds' },
      basis: { type: 'string', enum: 'measurement_bases' },
      derivation: { type: 'string', enum: 'measurement_derivations' },
      method: { type: 'string' },

      /* Where / what the observation applies to. */
      capability_id: { type: 'string' },
      location_ids: { type: 'array' },
      observation_scope: { type: 'string' },

      /* Provenance references (existing records only; never
       * duplicated, never upgraded). */
      methodology_id: { type: 'string' },
      source_refs: { type: 'array' },
      research_project_id: { type: 'string' },
      census_snapshot_id: { type: 'string' },
      census_observation_id: { type: 'string' },
      intervention_id: { type: 'string' },
      pilot_project_id: { type: 'string' },

      /* Declared analytical intent (frozen scope v1.1 §21): the
       * measurement is an INPUT to the referenced indicator
       * definition; it is never a stored result. analysis_role is
       * the declared numerator/denominator intent for ratio
       * indicators. */
      indicator_id: { type: 'string' },
      analysis_role: { type: 'string', enum: 'measurement_analysis_roles' },

      /* When. observed_at is mandatory; period_start/period_end are
       * optional ISO dates bounding a period observation. */
      observed_at: { type: 'string' },
      period_start: { type: 'string' },
      period_end: { type: 'string' },

      /* Lifecycle + governance. */
      status: { type: 'string', enum: 'measurement_statuses' },
      supersedes_id: { type: 'string' },
      superseded_by: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      notes: { type: 'string' },
      limitations: { type: 'string' },

      created_by: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.measurement = m;
  SCA.models.measurements = m;
})(SCA);
