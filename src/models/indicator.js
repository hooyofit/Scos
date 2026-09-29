/*
 * Indicator model (Stage 12: Capability Observatory & Measurement
 * Foundation, frozen scope v1.1 + implementation authorization v1.0).
 *
 * An Indicator is a DEFINITION: a reproducible, versioned analytical
 * specification describing how one or more accepted Measurements are
 * interpreted. It is NOT a stored result record. Indicator values
 * are computed DYNAMICALLY (read-only, deterministic, version-pinned)
 * from accepted measurements; computed values are never persisted
 * as domain entities (frozen scope v1.1 §20).
 *
 * FROZEN rules made structural here:
 *  - One entity. No IndicatorValue or equivalent shadow entity
 *    exists anywhere.
 *  - Versioning (frozen scope v1.1 §19): a definition is IMMUTABLE
 *    once APPROVED. A formula change creates a NEW VERSION — a new
 *    record with an incremented version number, never a mutation of
 *    the approved record. Older versions remain preserved for
 *    historical, version-pinned interpretation.
 *  - Lifecycle: DRAFT -> PENDING_REVIEW -> APPROVED, with
 *    PENDING_REVIEW -> REJECTED and APPROVED -> SUPERSEDED (retired
 *    only by the approval of a newer version of the same code —
 *    retire-first with rollback, the established pattern). Only one
 *    APPROVED version per indicator code is active at a time.
 *  - A definition carries: formal definition, calculation method,
 *    required measurement inputs, scope, frequency, interpretation
 *    notes and limitations — so a computed value can always expose
 *    what it means and what it does NOT mean.
 *  - An indicator is a definition, never a ranking mechanism; no
 *    composite capability score exists (frozen scope v1.1 §23).
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'indicators',
    required: ['code', 'name', 'status'],
    fields: {
      /* Identity + meaning. */
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      definition: { type: 'string' },
      calculation_method: { type: 'string' },
      required_measurements: { type: 'string' },
      category: { type: 'string', enum: 'indicator_categories' },
      scope: { type: 'string' },
      frequency: { type: 'string', enum: 'indicator_frequencies' },
      interpretation_notes: { type: 'string' },
      limitations: { type: 'string' },

      /* Machine-readable computation spec (used by the dynamic,
       * read-only compute engine; version-pinned):
       *   method: 'LATEST' | 'SUM' | 'MEAN' | 'RATIO'
       *   For RATIO: numerator/denominator inputs are accepted
       *   measurements linked to this indicator with the declared
       *   analysis_role. */
      calc_spec: { type: 'object' },

      /* Versioning (a new version is a NEW record; the approved
       * record is never mutated). */
      indicator_version: { type: 'number' },
      supersedes_version_id: { type: 'string' },
      superseded_by: { type: 'string' },

      /* Lifecycle + governance. */
      status: { type: 'string', enum: 'indicator_statuses' },
      provenance: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },

      created_by: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.indicator = m;
  SCA.models.indicators = m;
})(SCA);
