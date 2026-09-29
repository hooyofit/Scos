/*
 * RecoveryProfile model (Stage 9: Failure & Recovery System).
 *
 * A RecoveryProfile documents ONE documented recovery target of ONE
 * recovery kind for ONE subject asset, after that asset fails:
 *   subject asset (CAPABILITY / TOOL / WORKSHOP / ENERGY_SOURCE /
 *   LOCATION — exactly the Stage 8 asset types) + recovery kind
 *   (exactly five) + target reference (exactly one) = the duplicate
 *   signature; at most one ACTIVE profile may exist per signature.
 *
 * FROZEN Stage 9 scope v2.1 rules made structural here:
 *  - Exactly one target: multiple targets require multiple profiles.
 *  - Lifecycle PROPOSED -> DOCUMENTED -> VERIFIED, terminals
 *    REJECTED / SUPERSEDED. There is NO RETIRED state: administrative
 *    retirement uses REJECTED with an explicit reason.
 *  - A RecoveryProfile is NOT a graph node; it cites graph edges only
 *    as soft references (missing edge citations never block a valid
 *    record and never create edges).
 *  - No scores of any kind. No second competency, census or
 *    provenance system: evidence references point at the existing
 *    Stage 3 / Stage 4 / Stage 8 records.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'recovery_profiles',
    required: ['name', 'asset_type', 'asset_id', 'recovery_kind',
      'target_type', 'target_id'],
    fields: {
      name: { type: 'string' },

      /* Subject asset: exactly the Stage 8 asset types (Stage 7
       * graph node types; resolved through SCA.repair's public asset
       * helpers so there is no duplicate asset identity system). */
      asset_type: { type: 'string' },
      asset_id: { type: 'string' },
      /* Optional failure context (Stage 8 FailureScenario). */
      failure_scenario_id: { type: 'string' },

      /* Recovery kind: exactly the five frozen values. */
      recovery_kind: { type: 'string', enum: 'recovery_kinds' },
      /* Exactly one target reference (kind-appropriate collection). */
      target_type: { type: 'string' },
      target_id: { type: 'string' },

      /* What the recovery involves and under what conditions. */
      description: { type: 'string' },
      conditions: { type: 'string' },
      required_resources: { type: 'array' },
      limitations: { type: 'string' },
      notes: { type: 'string' },

      /* Operational context: descriptive free text only — never a
       * score, never a rank, never a number the system computes. */
      expected_recovery_time: { type: 'string' },
      recovery_radius: { type: 'string' },
      recovery_cost: { type: 'string' },

      /* Soft graph-edge citations (never required, never resolved
       * hard, never auto-creating edges or profiles). */
      edge_citations: { type: 'array' },

      /* Provenance: references into the EXISTING evidence systems. */
      source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      field_observation_ids: { type: 'array' },

      /* Lifecycle (frozen; no RETIRED state by design). */
      status: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      supersedes_id: { type: 'string' },

      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };
  SCA.models = SCA.models || {};
  SCA.models.recovery_profile = m;
  SCA.models.recovery_profiles = m;
})(SCA);
