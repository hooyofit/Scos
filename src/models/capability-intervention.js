/*
 * CapabilityIntervention model (Stage 10: Capability Intervention
 * Foundation).
 *
 * A CapabilityIntervention is a human-created PLANNING record: a
 * proposed, documented capability-strengthening action — what is
 * being proposed or undertaken to strengthen a capability, reduce a
 * documented vulnerability, improve recovery capacity, preserve
 * knowledge, develop people, or establish a missing capability
 * pathway.
 *
 * FROZEN Stage 10 scope v1.1 rules made structural here:
 *  - Exactly ONE Stage 10 entity. No InterventionMeasurement,
 *    InterventionOutcome, InterventionPlan, InterventionProject or
 *    InterventionEvaluation exists: outcome status is a field, and
 *    outcome evidence flows through the EXISTING Stage 3/4 records.
 *  - The record REFERENCES canonical Stage 1–9 entities through
 *    grouped id arrays; it never copies or shadows them (except the
 *    project's own audited history snapshots, which the existing
 *    version/history architecture requires).
 *  - Lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED ->
 *    ACTIVE -> COMPLETED, with SUSPENDED / CANCELLED paths.
 *    COMPLETED means the ACTIVITY ended — it never implies success:
 *    outcome status is a separate reviewer-governed field whose honest
 *    default is UNKNOWN, so COMPLETED + UNKNOWN is valid.
 *  - NO duplicate-signature guard: multiple interventions for the
 *    same capability / problem / region are legitimate competing
 *    approaches and are recorded independently.
 *  - NOT a graph node: the record may reference Stage 7 edges'
 *    endpoints but never creates, modifies, verifies, supersedes or
 *    retires a graph relationship.
 *  - No scores of any kind: economic and environmental fields are
 *    factual planning context, never rankings, ratings or
 *    prioritization.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capability_interventions',
    required: ['name', 'intervention_type', 'status'],
    fields: {
      name: { type: 'string' },
      description: { type: 'string' },
      objective: { type: 'string' },

      /* Classification (controlled vocabulary, no evaluative
       * meaning). */
      intervention_type: { type: 'string', enum: 'intervention_types' },
      status: { type: 'string', enum: 'intervention_statuses' },

      /* Structured problem statement (frozen scope section 12).
       * Canonical information stays in its authoritative entity:
       * where a Stage 8 FailureScenario exists, failure_scenario_ids
       * reference it; free-form problem text is only for problems
       * not yet represented as a canonical scenario. */
      problem_description: { type: 'string' },
      observed_condition: { type: 'string' },
      implementation_region: { type: 'string' },
      intended_beneficiaries: { type: 'string' },

      /* Intervention design (frozen scope section 13). */
      activities: { type: 'array' },
      required_capabilities: { type: 'array' },
      required_skills: { type: 'array' },
      required_equipment: { type: 'array' },
      required_materials: { type: 'array' },
      required_tools: { type: 'array' },
      required_infrastructure: { type: 'array' },
      required_energy: { type: 'array' },
      required_spare_parts: { type: 'array' },
      required_repair_capability: { type: 'array' },
      required_training: { type: 'array' },
      institutional_support: { type: 'array' },
      external_dependencies: { type: 'array' },
      dependencies: { type: 'array' },
      fallback_arrangement: { type: 'string' },
      training_requirements: { type: 'string' },
      estimated_duration: { type: 'string' },
      maintenance_requirements: { type: 'string' },
      reproduction_pathway: { type: 'string' },
      assumptions: { type: 'array' },
      limitations: { type: 'string' },

      /* No Orphan Project Rule (frozen scope section 27): an
       * intervention must not appear self-sufficient when its
       * operation depends on undocumented external capabilities.
       * self_contained is a deliberate, auditable CLAIM (never a
       * default) that no external dependencies exist; the approval
       * gate requires documented requirements OR this explicit
       * claim. */
      self_contained: { type: 'boolean' },

      /* Successor-before-launch (frozen scope section 28):
       * [{ role, practitioner_id, status }] where status is
       * IDENTIFIED (canonical Stage 5 practitioner reference) or
       * UNKNOWN (honest "not yet identified" — presence-of-value,
       * never fabricated). */
      depends_on_human_capability: { type: 'boolean' },
      critical_roles: { type: 'array' },

      /* Economic context (frozen scope section 29): factual planning
       * data, descriptive free text — never a ranking, ROI score or
       * automatic "best" determination. */
      estimated_implementation_cost: { type: 'string' },
      estimated_operating_cost: { type: 'string' },
      estimated_maintenance_cost: { type: 'string' },
      local_labor_requirement: { type: 'string' },
      imported_inputs: { type: 'string' },
      local_inputs: { type: 'string' },
      revenue_model: { type: 'string' },
      replacement_cost: { type: 'string' },
      lifecycle_considerations: { type: 'string' },

      /* Environmental context (frozen scope section 30): documented
       * facts only; traditional/modern status is never a substitute
       * for environmental evidence. */
      resource_consumption: { type: 'string' },
      energy_requirements: { type: 'string' },
      waste: { type: 'string' },
      emissions_documented: { type: 'string' },
      water_use: { type: 'string' },
      material_use: { type: 'string' },
      environmental_risks: { type: 'string' },
      climate_exposure: { type: 'string' },
      repairability_notes: { type: 'string' },
      end_of_life: { type: 'string' },

      /* Safety (frozen scope section 31): safety-sensitive
       * interventions require explicit safety documentation; the
       * medical safety rule (preserve the knowledge, validate the
       * treatment, protect the patient) stays with Stage 3. */
      safety_considerations: { type: 'string' },
      environmental_considerations: { type: 'string' },

      /* Canonical references to existing Stage 1–9 entities
       * (grouped id arrays; the workflow holds the frozen
       * field -> collection map). Never shadow records. */
      capability_ids: { type: 'array' },
      family_ids: { type: 'array' },
      research_project_ids: { type: 'array' },
      evidence_source_ids: { type: 'array' },
      knowledge_artifact_ids: { type: 'array' },
      field_observation_ids: { type: 'array' },
      failure_scenario_ids: { type: 'array' },
      recovery_profile_ids: { type: 'array' },
      practitioner_ids: { type: 'array' },
      apprentice_ids: { type: 'array' },
      training_program_ids: { type: 'array' },
      competence_assessment_ids: { type: 'array' },
      certification_ids: { type: 'array' },
      organization_ids: { type: 'array' },
      location_ids: { type: 'array' },
      workshop_ids: { type: 'array' },
      repair_capability_ids: { type: 'array' },
      spare_part_ids: { type: 'array' },
      tool_ids: { type: 'array' },
      material_ids: { type: 'array' },
      resource_ids: { type: 'array' },
      energy_source_ids: { type: 'array' },

      /* Responsible organization (canonical Stage 5 entity). */
      responsible_organization_id: { type: 'string' },

      /* Outcome (frozen scope section 21): categorical,
       * reviewer-governed, default UNKNOWN, never a score. Changing
       * it from UNKNOWN requires reviewer authority, an explicit
       * reason and outcome evidence references. COMPLETED never
       * changes outcome automatically. */
      outcome_status: { type: 'string', enum: 'intervention_outcomes' },
      outcome_reviewer: { type: 'string' },
      outcome_reviewed_at: { type: 'string' },
      outcome_reason: { type: 'string' },
      outcome_evidence_source_ids: { type: 'array' },
      outcome_knowledge_artifact_ids: { type: 'array' },
      outcome_field_observation_ids: { type: 'array' },

      /* Lifecycle bookkeeping (the audit trail is in audit_log; this
       * records the visible latest transition state). */
      submitted_at: { type: 'string' },
      reviewer: { type: 'string' },
      review_reason: { type: 'string' },
      approved_at: { type: 'string' },
      activated_at: { type: 'string' },
      suspended_at: { type: 'string' },
      completed_at: { type: 'string' },
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
  SCA.models.capability_intervention = m;
  SCA.models.capability_interventions = m;
})(SCA);
