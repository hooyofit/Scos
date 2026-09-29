/*
 * Graph edge (Stage 7): one documented relationship between two canonical
 * SCOS records. This is the substrate of the Somali Capability Graph.
 *
 * Canonical identity: source_type + source_id -> target_type + target_id.
 * Never names. IDs stay stable.
 *
 * STATUS is the lifecycle, one field, one source of truth:
 *   PROPOSED -> DOCUMENTED -> VERIFIED, with REJECTED and SUPERSEDED
 *   as recorded outcomes. UNKNOWN is not a stored edge status: the
 *   absence of an edge means «not currently represented», NEVER
 *   «proven independent».
 *
 * CONFIDENCE is categorical (a documentation-quality self-assessment),
 * never an invented numerical certainty. A confidence above UNASSESSED
 * requires a documented confidence_basis.
 *
 * The edge never mutates the records it connects: it may not upgrade
 * capability evidence levels, living status, maturity, practitioner
 * competence or any Stage 3/5 authority.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'graph_edges',
    required: ['relationship_type', 'source_type', 'source_id',
      'target_type', 'target_id'],
    fields: {
      relationship_type: { type: 'string' },
      source_type: { type: 'string' },
      source_id: { type: 'string' },
      target_type: { type: 'string' },
      target_id: { type: 'string' },
      status: { type: 'string', enum: 'graph_edge_statuses' },
      evidence_status: { type: 'string', enum: 'evidence_levels' },
      /* Provenance: every substantive relationship traces to an origin.
       * Validated against real records; broken provenance is an
       * integrity violation. */
      source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      field_observation_ids: { type: 'array' },
      research_project_ids: { type: 'array' },
      census_observation_ids: { type: 'array' },
      region_ids: { type: 'array' },
      confidence: { type: 'string', enum: 'graph_confidence' },
      confidence_basis: { type: 'string' },
      /* Scope: a regional observation must never become a universal
       * national claim. */
      scope: { type: 'string', enum: 'graph_scopes' },
      scope_description: { type: 'string' },
      conditions: { type: 'string' },
      limitations: { type: 'string' },
      created_by: { type: 'string' },
      reviewer: { type: 'string' },
      reviewed_at: { type: 'string' },
      review_reason: { type: 'string' },
      supersedes_id: { type: 'string' },
      superseded_by_id: { type: 'string' },
      version: { type: 'number' },
      /* Append-only version history: { version, changed_at, changed_by,
       * reason, snapshot } — the previous state of the relationship is
       * preserved on every change. */
      history: { type: 'array' },
      provenance: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  SCA.models = SCA.models || {};
  SCA.models.graph_edge = m;
  SCA.models.graph_edges = m;
})(SCA);
