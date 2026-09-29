/*
 * Capability model. Field set per the project specification, designed for
 * future research. The 240 records arrive in Stage 2; structure and
 * validation exist from Day 1. Unknown fields stay null and display as
 * "Not yet documented". Nothing is invented.
 *
 * Notes:
 * - "family" in the specification is stored relationally as family_id.
 * - List-type fields (regions, practitioners, source_ids, ...) hold
 *   references; their contents link to other entities in later stages.
 * - Types for recovery_time, recovery_difficulty, repair_radius and
 *   recovery_radius are provisional strings; refined in Stages 8-9.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capabilities',
    required: ['code', 'name', 'family_id'],
    fields: {
      id: { type: 'string' },
      code: { type: 'string' },
      name: { type: 'string' },
      family_id: { type: 'string' },
      short_description: { type: 'string' },
      description: { type: 'string' },
      historical_status: { type: 'string' },
      living_status: { type: 'string', enum: 'living_status' },
      evidence_level: { type: 'string', enum: 'evidence_levels' },
      verification_status: { type: 'string' },
      regions: { type: 'array' },
      practitioners: { type: 'array' },
      apprentices: { type: 'array' },
      knowledge_holders: { type: 'array' },
      materials: { type: 'array' },
      tools: { type: 'array' },
      dependencies: { type: 'array' },
      modern_equivalent: { type: 'array' },
      fallback: { type: 'array' },
      failure_scenarios: { type: 'array' },
      recovery_time: { type: 'string' },
      recovery_difficulty: { type: 'string' },
      repair_radius: { type: 'string' },
      recovery_radius: { type: 'string' },
      economic_role: { type: 'string' },
      environmental_role: { type: 'string' },
      knowledge_role: { type: 'string' },
      criticality: { type: 'string' },
      centrality: { type: 'string' },
      reproducibility: { type: 'string' },
      fallback_value: { type: 'string' },
      graph_leverage: { type: 'string' },
      irreplaceability: { type: 'string' },
      preservation_urgency: { type: 'string' },
      external_dependency: { type: 'string' },
      knowledge_concentration: { type: 'string' },
      action: { type: 'string', enum: 'actions' },
      priority_flags: { type: 'array' },
      documentation_status: { type: 'string' },
      transmission_status: { type: 'string' },
      capability_maturity: { type: 'string', enum: 'maturity' },
      reproduction_pathway: { type: 'string' },
      stewardship_notes: { type: 'string' },
      safety_notes: { type: 'string' },
      limitations: { type: 'string' },
      source_ids: { type: 'array' },
      reviewer: { type: 'string' },
      version: { type: 'string' },
      region: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      reviewed_at: { type: 'string' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  /* Pure search matching (Stage 2). A query matches on: exact or partial
     code, partial name, family name, family code, evidence level code, or
     verification status. Case-insensitive. Used by the atlas page and by
     the inventory tests, so search behavior is testable without a DOM. */
  m.matchesQuery = function (record, familyName, familyCode, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) { return true; }
    var hay = [record.code, record.name, familyName, familyCode,
      record.evidence_level, record.verification_status]
      .map(function (x) { return String(x || '').toLowerCase(); });
    return hay.some(function (h) { return h.indexOf(q) !== -1; });
  };

  SCA.models = SCA.models || {};
  SCA.models.capability = m;
  SCA.models.capabilities = m;
})(SCA);
