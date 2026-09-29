/*
 * Import / export (Day-1 first-class feature).
 * Exports are plain, versioned JSON so the project's knowledge can never
 * be trapped inside one platform. Users collection is excluded (privacy).
 *
 * Stage 2.1 import integrity rules:
 *  - A capabilities-only export carries the referenced capability families
 *    with it ("referenced"), so it can be imported standalone.
 *  - Imports are ATOMIC: all validation (structure, schema version,
 *    migration, referential integrity) happens BEFORE the single dataset
 *    replacement. Failure means no dataset changes at all.
 *  - An import that would leave capabilities whose family references do
 *    not resolve (e.g. an old-style capabilities file without referenced
 *    families, imported into an empty store) is rejected with a clear
 *    dependency error instead of creating a partially valid dataset.
 *
 * Stage 3 extends the same principle to the evidence archive:
 *  - claims reference capabilities and sources; knowledge artifacts
 *    reference capabilities and sources. Any single-collection export of
 *    claims, knowledge, or capabilities carries its referenced records
 *    transitively (claims -> capabilities -> families).
 *  - The atomic import check verifies every one of those relationships
 *    against the candidate (merged) dataset.
 */
(function (SCA) {
  'use strict';
  var EXPORTABLE = (SCA.config.export && SCA.config.export.collections) || [];

  /* Relationship map used BOTH for carrying referenced records in
     single-collection exports and for atomic import checks.
     field -> target collection. Acyclic, so transitive closure is finite. */
  var REFERENCES = {
    capabilities: { family_id: 'families' },
    claims: { capability_id: 'capabilities', source_ids: 'evidence' },
    knowledge: { capability_ids: 'capabilities', capability_id: 'capabilities',
      source_ids: 'evidence', session_id: 'research_sessions',
      participant_id: 'participants' },
    evidence: {},
    consents: {},
    audit_log: {},
    research_projects: { capability_ids: 'capabilities', family_ids: 'families' },
    research_sessions: { project_id: 'research_projects' },
    observations: { session_id: 'research_sessions',
      capability_id: 'capabilities' },
    field_notes: { session_id: 'research_sessions' },
    participants: { consent_id: 'consents' },
    field_media: { session_id: 'research_sessions', consent_id: 'consents' },
    research_queue: {},
    organizations: {},
    practitioners: { capability_ids: 'capabilities', capabilities: 'capabilities',
      region_ids: 'locations', organization_id: 'organizations',
      consent_id: 'consents', evidence_ids: 'evidence',
      trainer_assessment_id: 'competence_assessments' },
    apprentices: { capability_id: 'capabilities', capability_ids: 'capabilities',
      mentor_ids: 'practitioners', mentor_id: 'practitioners',
      organization_id: 'organizations', consent_id: 'consents',
      evidence_ids: 'evidence' },
    apprenticeships: { apprentice_id: 'apprentices', mentor_id: 'practitioners',
      capability_id: 'capabilities', program_id: 'training_programs',
      organization_id: 'organizations' },
    competence_assessments: { practitioner_id: 'practitioners',
      apprentice_id: 'apprentices', capability_id: 'capabilities',
      assessor_practitioner_id: 'practitioners', evidence_ids: 'evidence',
      observation_ids: 'observations', session_id: 'research_sessions' },
    training_programs: { capability_ids: 'capabilities',
      organization_id: 'organizations' },
    capability_certifications: { practitioner_id: 'practitioners',
      apprentice_id: 'apprentices', capability_id: 'capabilities',
      assessment_id: 'competence_assessments', evidence_ids: 'evidence',
      organization_id: 'organizations' },
    families: {}, locations: {},
    /* Stage 6 census. Scope references are kept flat on the census so
       the atomic import checker can verify every one of them. */
    census_methodologies: {},
    capability_censuses: { methodology_id: 'census_methodologies',
      location_ids: 'locations', capability_ids: 'capabilities',
      family_ids: 'families', research_project_ids: 'research_projects' },
    census_observations: { census_id: 'capability_censuses',
      capability_id: 'capabilities', location_id: 'locations',
      source_ids: 'evidence', research_session_ids: 'research_sessions',
      observation_ids: 'observations', practitioner_ids: 'practitioners',
      organization_ids: 'organizations' },
    census_snapshots: { census_id: 'capability_censuses' },
    geographic_redundancies: { capability_id: 'capabilities',
      snapshot_id: 'census_snapshots' },
    /* Stage 7: capability graph. Provenance and region references are
       static; SOURCE and TARGET nodes are dynamic (resolved by node
       type through SCA.graphRegistry — see the graph_edges special
       cases below). */
    graph_edges: { source_ids: 'evidence', knowledge_artifact_ids: 'knowledge',
      field_observation_ids: 'observations',
      research_project_ids: 'research_projects',
      census_observation_ids: 'census_observations',
      region_ids: 'locations' },
    /* Stage 8: repair & spare-part network. Workshops, capabilities,
       parts and records reference each other, but repair_capability_ids
       on a workshop is a DERIVED mirror (recomputed by the repair
       workflow) and is deliberately NOT a validated import reference:
       repair_capabilities.workshop_id is the authoritative direction.
       The workshops spec is an intentional Stage 8 EXTENSION of the
       empty Stage 7 placeholder: Stage 7 had zero workshop records,
       so nothing was ever validated differently; active workshops
       must now resolve their references at import, while INACTIVE/
       CLOSED workshops receive the retired-history exemption. */
    workshops: { organization_id: 'organizations', location_id: 'locations',
      practitioner_ids: 'practitioners', tool_ids: 'tools',
      material_ids: 'materials', source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge',
      field_observation_ids: 'observations' },
    repair_capabilities: { workshop_id: 'workshops',
      practitioner_ids: 'practitioners', region_ids: 'locations',
      evidence_source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge',
      field_observation_ids: 'observations',
      linked_assessment_id: 'competence_assessments',
      linked_certification_id: 'capability_certifications' },
    spare_parts: { supplier_ids: 'organizations',
      alternative_part_ids: 'spare_parts',
      substitute_material_ids: 'materials',
      drawing_artifact_ids: 'knowledge',
      compatible_workshop_ids: 'workshops',
      stock_locations: 'locations', source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge' },
    repair_records: { location_id: 'locations', region_id: 'locations',
      failure_scenario_id: 'failure_scenarios',
      technician_ids: 'practitioners', workshop_id: 'workshops',
      tools_used: 'tools', materials_used: 'materials',
      parts_used: 'spare_parts', substitutes_used: 'spare_parts',
      apprentice_ids: 'apprentices', knowledge_artifact_id: 'knowledge',
      source_ids: 'evidence' },
    resources: {}, materials: { supplier_ids: 'organizations',
      source_ids: 'evidence' },
    tools: { workshop_ids: 'workshops', location_ids: 'locations',
      source_ids: 'evidence' },
    energy_sources: {},
    failure_scenarios: { source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge' },

    /* Stage 9: recovery profiles. failure scenario and provenance
       references are HARD requirements for active records; the
       subject asset and recovery TARGET resolve dynamically (below);
       edge_citations are deliberately NOT here: they are SOFT
       references by the frozen Stage 9 scope — missing edges must
       never block an otherwise valid import, and are never created. */
    recovery_profiles: { failure_scenario_id: 'failure_scenarios',
      source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge',
      field_observation_ids: 'observations' },

    /* Stage 10: capability interventions. Every canonical reference
       field is a HARD requirement for active records: an intervention
       never creates the referenced record, so a missing reference
       blocks the import (atomic rejection). COMPLETED/CANCELLED
       history follows the frozen terminal-history exemption below.
       critical_roles practitioner references resolve DYNAMICALLY
       (see INTERVENTION_ROLES_DYN) because they are structured role
       entries, not flat id arrays. */
    capability_interventions: {
      responsible_organization_id: 'organizations',
      capability_ids: 'capabilities',
      family_ids: 'families',
      research_project_ids: 'research_projects',
      evidence_source_ids: 'evidence',
      knowledge_artifact_ids: 'knowledge',
      field_observation_ids: 'observations',
      failure_scenario_ids: 'failure_scenarios',
      recovery_profile_ids: 'recovery_profiles',
      practitioner_ids: 'practitioners',
      apprentice_ids: 'apprentices',
      training_program_ids: 'training_programs',
      competence_assessment_ids: 'competence_assessments',
      certification_ids: 'capability_certifications',
      organization_ids: 'organizations',
      location_ids: 'locations',
      workshop_ids: 'workshops',
      repair_capability_ids: 'repair_capabilities',
      spare_part_ids: 'spare_parts',
      tool_ids: 'tools',
      material_ids: 'materials',
      resource_ids: 'resources',
      energy_source_ids: 'energy_sources',
      outcome_evidence_source_ids: 'evidence',
      outcome_knowledge_artifact_ids: 'knowledge',
      outcome_field_observation_ids: 'observations' },

    /* Stage 11: pilot projects. Every canonical reference field is a
       HARD requirement for active records (PROPOSED/APPROVED/ACTIVE):
       a pilot never creates the referenced record, so a missing
       reference blocks the import (atomic rejection). CONCLUDED/
       CANCELLED history follows the frozen terminal-history exemption
       below. The census snapshot reference is a single id (not an
       array), so it resolves through the dedicated pilot validation
       block (PILOT_SNAPSHOT below). */
    pilot_projects: {
      intervention_ids: 'capability_interventions',
      organization_ids: 'organizations',
      workshop_ids: 'workshops',
      training_program_ids: 'training_programs',
      practitioner_ids: 'practitioners',
      location_ids: 'locations' },

    /* Stage 12: measurements. Canonical reference fields are HARD
       requirements for non-terminal records; a measurement never
       creates the referenced record. REJECTED/SUPERSEDED history
       follows the frozen terminal-history exemption below. The
       structured source_refs entries resolve DYNAMICALLY by type
       (MEASUREMENT_SOURCES_DYN below), exactly like graph edge
       endpoints. */
    measurements: {
      capability_id: 'capabilities',
      location_ids: 'locations',
      methodology_id: 'census_methodologies',
      research_project_id: 'research_projects',
      census_snapshot_id: 'census_snapshots',
      census_observation_id: 'census_observations',
      intervention_id: 'capability_interventions',
      pilot_project_id: 'pilot_projects',
      indicator_id: 'indicators' },

    /* Stage 12: indicator definitions. Self-contained except for
       their own version lineage (validated in the dedicated import
       block below — a superseded predecessor may legitimately be
       absent from a standalone import of only the current version).
       calc_spec is a plain object, not a reference. */
    indicators: {},

    /* Stage 13: marketplace listings. Canonical reference fields are
       HARD requirements for non-terminal records (a listing never
       creates the referenced record). REJECTED/WITHDRAWN history
       follows the frozen terminal-history exemption below. The
       POLYMORPHIC provider reference resolves DYNAMICALLY by
       provider_type (dedicated import block below), exactly like
       Stage 8 asset references and Stage 9 recovery targets. */
    marketplace_listings: {
      capability_ids: 'capabilities',
      location_ids: 'locations',
      repair_capability_id: 'repair_capabilities' },

    /* Stage 14: reserves, plans, assets. Canonical reference
       fields are HARD requirements for non-terminal records —
       Stage 14 never creates the referenced record (frozen scope
       v1.1 §25 + authorization §26). REJECTED/RETIRED history
       follows the frozen terminal-history exemption below. The
       POLYMORPHIC asset reference resolves DYNAMICALLY in the
       dedicated Stage 14 import block, exactly like Stage 13
       providers. */
    capability_reserves: {
      capability_ids: 'capabilities',
      fallback_capability_ids: 'capabilities',
      location_ids: 'locations',
      owner_organization_id: 'organizations',
      custodian_organization_id: 'organizations',
      successor_custodian_organization_id: 'organizations',
      secondary_custodian_organization_id: 'organizations',
      recovery_profile_ids: 'recovery_profiles',
      training_program_ids: 'training_programs',
      workshop_ids: 'workshops',
      practitioner_refs: 'practitioners' },
    continuity_plans: {
      capability_id: 'capabilities',
      reserve_id: 'capability_reserves',
      fallback_capability_ids: 'capabilities',
      recovery_profile_ids: 'recovery_profiles',
      training_program_ids: 'training_programs' },
    capability_assets: {
      reserve_id: 'capability_reserves' }
  };

  /* Stage 8 asset references resolve DYNAMICALLY by asset type (a
     Stage 7 graph node type), exactly like graph edge endpoints: the
     static REFERENCES map cannot express them. */
  var ASSET_DYN = {
    repair_capabilities: [['asset_type', 'asset_id']],
    repair_records: [['asset_type', 'asset_id']],
    spare_parts: [['asset_type', 'asset_ids']],
    failure_scenarios: [['asset_type', 'asset_ids']],

    /* Stage 9: the RecoveryProfile SUBJECT resolves dynamically as a
       Stage 7 node type, exactly like Stage 8 repair assets. */
    recovery_profiles: [['asset_type', 'asset_id']]
  };

  /* Stage 9: the RecoveryProfile TARGET does NOT resolve through the
     graph registry — targets include non-node collections (Stage 8
     repair capabilities and spare parts, Stage 5 organizations). It
     resolves through its own frozen kind-independent type->collection
     map; which target types are VALID for which recovery kind is
     enforced by the workflow at creation time and by the import
     validation block. */
  var RECOVERY_TARGET_DYN = {
    recovery_profiles: { type_field: 'target_type',
      id_field: 'target_id',
      collections: { CAPABILITY: 'capabilities',
        REPAIR_CAPABILITY: 'repair_capabilities',
        WORKSHOP: 'workshops', SPARE_PART: 'spare_parts',
        MATERIAL: 'materials', TOOL: 'tools',
        ORGANIZATION: 'organizations' } }
  };

  /* Stage 10: intervention critical roles reference canonical
     Stage 5 practitioners through structured entries (not flat id
     arrays), so they resolve dynamically both at carry time (a
     standalone intervention export includes the referenced
     practitioner records) and at import validation. */
  var INTERVENTION_ROLES_DYN = {
    capability_interventions: { list_field: 'critical_roles',
      id_field: 'practitioner_id',
      collection: 'practitioners' }
  };

  /* Stage 12: measurement source references are structured entries
     ({type, id}) over a controlled source-type vocabulary of
     EXISTING collections (frozen scope v1.1 §11). They resolve
     dynamically both at carry time (a standalone measurement
     export includes the referenced source records) and at import
     validation. */
  var MEASUREMENT_SOURCES_DYN = {
    measurements: { list_field: 'source_refs',
      type_field: 'type',
      id_field: 'id',
      collections: {
        EVIDENCE_SOURCE: 'evidence',
        KNOWLEDGE_ARTIFACT: 'knowledge',
        CLAIM: 'claims',
        FIELD_OBSERVATION: 'observations',
        FIELD_NOTE: 'field_notes',
        RESEARCH_PROJECT: 'research_projects',
        RESEARCH_SESSION: 'research_sessions',
        CENSUS_OBSERVATION: 'census_observations',
        CENSUS_SNAPSHOT: 'census_snapshots',
        REPAIR_RECORD: 'repair_records',
        FAILURE_SCENARIO: 'failure_scenarios',
        RECOVERY_PROFILE: 'recovery_profiles',
        CAPABILITY_INTERVENTION: 'capability_interventions',
        PILOT_PROJECT: 'pilot_projects',
        COMPETENCE_ASSESSMENT: 'competence_assessments',
        CAPABILITY_CERTIFICATION: 'capability_certifications' } }
  };

  /* Stage 8 retired history: the same frozen Stage 7 exemption. A
     REJECTED/SUPERSEDED capability, REJECTED part, REJECTED/ARCHIVED
     record or CLOSED workshop keeps its broken references by design
     (audited retirement, never silent deletion). Active records are
     held to the full standard. */
  var REPAIR_RETIRED = {
    repair_capabilities: { field: 'status', values: ['REJECTED',
      'SUPERSEDED'] },
    /* Stage 9: same frozen exemption — a REJECTED/SUPERSEDED recovery
       profile keeps its broken references by design (audited
       retirement, never silent deletion). Active profiles are held to
       the full standard. There is no other retired state. */
    recovery_profiles: { field: 'status', values: ['REJECTED',
      'SUPERSEDED'] },
    /* Stage 10: same frozen exemption — a COMPLETED or CANCELLED
       intervention is a terminal historical record: it may keep
       references that no longer resolve (preserved history, never
       silent deletion). Active planning records (DRAFT … ACTIVE) are
       held to the full standard. */
    capability_interventions: { field: 'status', values: ['COMPLETED',
      'CANCELLED'] },
    /* Stage 11: same frozen exemption — a CONCLUDED or CANCELLED
       pilot is a terminal historical record: it may keep references
       that no longer resolve (preserved history, never silent
       deletion). Active pilots (PROPOSED/APPROVED/ACTIVE) are held
       to the full standard. */
    pilot_projects: { field: 'status', values: ['CONCLUDED',
      'CANCELLED'] },
    /* Stage 12: a REJECTED or SUPERSEDED measurement is a terminal
       historical record: it may keep references that no longer
       resolve (preserved history, never silent deletion). Active
       workflow records (DRAFT/SUBMITTED/UNDER_REVIEW) and ACCEPTED
       records are held to the full standard. */
    measurements: { field: 'status', values: ['REJECTED',
      'SUPERSEDED'] },
    /* Stage 12: a REJECTED or SUPERSEDED indicator definition is
       terminal historical history (the superseded version is
       preserved for version-pinned historical computation). */
    indicators: { field: 'status', values: ['REJECTED',
      'SUPERSEDED'] },
    /* Stage 13: a REJECTED or WITHDRAWN marketplace listing is a
       terminal historical record: it may keep references that no
       longer resolve (preserved history, never silent deletion).
       Active listings (DRAFT/SUBMITTED/PUBLISHED/PAUSED) are held to
       the full standard. */
    marketplace_listings: { field: 'status', values: ['REJECTED',
      'WITHDRAWN'] },
    /* Stage 14: a REJECTED or RETIRED reserve or plan is a
       terminal historical record: it may keep references that no
       longer resolve (preserved history, never silent deletion).
       Active records are held to the full standard. */
    capability_reserves: { field: 'status', values: ['REJECTED',
      'RETIRED'] },
    continuity_plans: { field: 'status', values: ['REJECTED',
      'RETIRED'] },
    spare_parts: { field: 'compatibility_status', values: ['REJECTED'] },
    repair_records: { field: 'review_status', values: ['REJECTED',
      'ARCHIVED'] },
    workshops: { field: 'status', values: ['INACTIVE', 'CLOSED'] }
  };
  function repairRetired(coll, r) {
    var spec = REPAIR_RETIRED[coll];
    return !!(spec && r &&
      spec.values.indexOf(r[spec.field]) !== -1);
  }

  /* Collect the records a set of exported records depends on, following
     REFERENCES transitively (bounded, acyclic by construction). */
  function referencedRecords(collection, records) {
    var carry = {};
    function addFrom(coll, recs) {
      if (!carry[coll]) { carry[coll] = {}; }
      /* Stage 8: repair assets resolve dynamically by type; a
         repair-only export carries the canonical asset records so it
         is standalone-importable. */
      if (ASSET_DYN[coll] && SCA.graphRegistry) {
        recs.forEach(function (r) {
          if (!r) { return; }
          ASSET_DYN[coll].forEach(function (pair) {
            var ids = r[pair[1]];
            ids = Array.isArray(ids) ? ids : (ids ? [ids] : []);
            ids.forEach(function (aid) {
              var ncoll = SCA.graphRegistry.collectionFor(r[pair[0]]);
              if (!ncoll || !aid || (carry[ncoll] && carry[ncoll][aid])) {
                return;
              }
              var found = SCA.store.get(ncoll, aid);
              if (found) {
                if (!carry[ncoll]) { carry[ncoll] = {}; }
                carry[ncoll][aid] = found;
                addFrom(ncoll, [found]);
              }
            });
          });
        });
      }
      /* Stage 9: recovery profile TARGETS carry the canonical target
         record (capability, repair capability, workshop, spare part,
         material, tool or organization) so a recovery-only export is
         standalone-importable. */
      if (RECOVERY_TARGET_DYN[coll]) {
        var rspec = RECOVERY_TARGET_DYN[coll];
        recs.forEach(function (r) {
          if (!r) { return; }
          var tcoll = rspec.collections[r[rspec.type_field]];
          var tid = r[rspec.id_field];
          if (!tcoll || !tid || (carry[tcoll] && carry[tcoll][tid])) {
            return;
          }
          var found = SCA.store.get(tcoll, tid);
          if (found) {
            if (!carry[tcoll]) { carry[tcoll] = {}; }
            carry[tcoll][tid] = found;
            addFrom(tcoll, [found]);
          }
        });
      }
      /* Stage 10: intervention critical roles carry the canonical
         Stage 5 practitioner records so an intervention-only export
         is standalone-importable. */
      if (INTERVENTION_ROLES_DYN[coll]) {
        var ispec = INTERVENTION_ROLES_DYN[coll];
        recs.forEach(function (r) {
          if (!r || !Array.isArray(r[ispec.list_field])) { return; }
          r[ispec.list_field].forEach(function (role) {
            var pid = role && role[ispec.id_field];
            if (!pid || (carry[ispec.collection] &&
              carry[ispec.collection][pid])) { return; }
            var found = SCA.store.get(ispec.collection, pid);
            if (found) {
              if (!carry[ispec.collection]) {
                carry[ispec.collection] = {};
              }
              carry[ispec.collection][pid] = found;
              addFrom(ispec.collection, [found]);
            }
          });
        });
      }
      /* Stage 12: measurements carry their referenced source records
         (existing authoritative records only — frozen scope v1.1
         §11) so a standalone measurement export is importable. */
      if (MEASUREMENT_SOURCES_DYN[coll]) {
        var mspec = MEASUREMENT_SOURCES_DYN[coll];
        recs.forEach(function (r) {
          if (!r || !Array.isArray(r[mspec.list_field])) { return; }
          r[mspec.list_field].forEach(function (sr) {
            if (!sr || !sr[mspec.type_field] || !sr[mspec.id_field]) {
              return;
            }
            var scoll = mspec.collections[sr[mspec.type_field]];
            if (!scoll) { return; }
            var sid = sr[mspec.id_field];
            if (carry[scoll] && carry[scoll][sid]) { return; }
            var found = SCA.store.get(scoll, sid);
            if (found) {
              if (!carry[scoll]) { carry[scoll] = {}; }
              carry[scoll][sid] = found;
              addFrom(scoll, [found]);
            }
          });
        });
      }
      /* Stage 7: graph edges carry their canonical source/target node
         records so a graph-only export is standalone-importable. */
      if (coll === 'graph_edges' && SCA.graphRegistry) {
        recs.forEach(function (r) {
          if (!r) { return; }
          ['source', 'target'].forEach(function (end) {
            var ncoll = SCA.graphRegistry.collectionFor(r[end + '_type']);
            var nid = r[end + '_id'];
            if (!ncoll || !nid || (carry[ncoll] && carry[ncoll][nid])) { return; }
            var found = SCA.store.get(ncoll, nid);
            if (found) {
              if (!carry[ncoll]) { carry[ncoll] = {}; }
              carry[ncoll][nid] = found;
              addFrom(ncoll, [found]);
            }
          });
        });
      }
      var spec = REFERENCES[coll] || {};
      Object.keys(spec).forEach(function (field) {
        var target = spec[field];
        recs.forEach(function (r) {
          var val = r ? r[field] : null;
          var ids = Array.isArray(val) ? val : (val ? [val] : []);
          ids.forEach(function (id) {
            if (!carry[target]) { carry[target] = {}; }
            if (!id || carry[target][id]) { return; }
            var found = SCA.store.get(target, id);
            if (found) {
              carry[target][id] = found;
              addFrom(target, [found]);
            }
          });
        });
      });
    }
    addFrom(collection, records);
    return carry;
  }

  function exportCollection(name) {
    if (EXPORTABLE.indexOf(name) === -1) {
      throw new Error('Collection "' + name + '" is not exportable.');
    }
    var pkg = {
      app: 'somali-capability-atlas',
      kind: 'collection',
      collection: name,
      schema_version: SCA.SCHEMA_VERSION,
      exported_at: SCA.util.now(),
      records: SCA.store.all(name)
    };
    /* Carry referenced records (Stage 2.1: capabilities -> families;
       Stage 3: claims/knowledge -> capabilities -> families, -> sources)
       so a single-collection file is independently importable. */
    if (REFERENCES[name] && Object.keys(REFERENCES[name]).length) {
      var carry = referencedRecords(name, pkg.records);
      pkg.referenced = {};
      Object.keys(carry).forEach(function (coll) {
        pkg.referenced[coll] = Object.keys(carry[coll]).map(function (id) {
          return carry[coll][id];
        });
      });
    }
    return JSON.stringify(pkg, null, 2);
  }

  function exportAll() {
    var collections = {};
    EXPORTABLE.forEach(function (c) { collections[c] = SCA.store.all(c); });
    return JSON.stringify({
      app: 'somali-capability-atlas',
      kind: 'bundle',
      build_step: SCA.BUILD_STEP,
      schema_version: SCA.SCHEMA_VERSION,
      exported_at: SCA.util.now(),
      collections: collections
    }, null, 2);
  }

  /* Accepts a full bundle or a single-collection export; returns a bundle. */
  function parse(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) {
      throw new Error('File is not valid JSON.');
    }
    if (!obj || typeof obj !== 'object') { throw new Error('Not a JSON object.'); }
    if (obj.kind === 'bundle' && obj.collections) { return obj; }
    if (obj.kind === 'collection' && obj.collection) {
      var b = { kind: 'bundle', schema_version: obj.schema_version || 1, collections: {} };
      b.collections[obj.collection] = obj.records || [];
      /* New-format collection exports may carry referenced records. */
      if (obj.referenced && typeof obj.referenced === 'object') {
        Object.keys(obj.referenced).forEach(function (coll) {
          if (Array.isArray(obj.referenced[coll])) {
            b.collections[coll] = (b.collections[coll] || [])
              .concat(obj.referenced[coll]);
          }
        });
      }
      return b;
    }
    throw new Error('Unrecognized export format.');
  }

  function validateBundle(bundle) {
    var errors = [];
    if (!bundle || typeof bundle !== 'object') { errors.push('Not an object.'); return { ok: false, errors: errors }; }
    if (bundle.app && bundle.app !== 'somali-capability-atlas') {
      errors.push('This file was exported by a different application: ' + bundle.app);
    }
    if (!bundle.collections || typeof bundle.collections !== 'object') {
      errors.push('Missing "collections" object.');
    } else {
      Object.keys(bundle.collections).forEach(function (c) {
        if (EXPORTABLE.indexOf(c) === -1) {
          errors.push('Collection "' + c + '" is not importable in this build.');
        } else if (!Array.isArray(bundle.collections[c])) {
          errors.push('Collection "' + c + '" is not an array.');
        }
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /*
   * Import a bundle. The imported collections REPLACE the current ones;
   * the users collection (accounts) is always preserved. Bundles from older
   * schema versions are migrated automatically.
   */
  function importBundle(text) {
    var bundle;
    try {
      bundle = parse(text);
    } catch (e) {
      return { ok: false, errors: [e.message] };
    }
    var v = validateBundle(bundle);
    if (!v.ok) { return { ok: false, errors: v.errors }; }

    var fromVersion = bundle.schema_version || 1;
    if (fromVersion > SCA.SCHEMA_VERSION) {
      return { ok: false, errors: ['Bundle schema version ' + fromVersion +
        ' is newer than this build supports (' + SCA.SCHEMA_VERSION + ').'] };
    }

    var ds = { schema_version: fromVersion, collections: bundle.collections };
    var res = SCA.migrations.migrate(ds, SCA.SCHEMA_VERSION);
    ds = res.dataset;

    /* Preserve everything not covered by the export (users, and any
       collection absent from a partial bundle). */
    var current = SCA.store.dataset();
    SCA.store.COLLECTIONS.forEach(function (c) {
      if (!ds.collections[c]) { ds.collections[c] = current.collections[c] || []; }
    });

    /* Referential integrity (Stage 2.1 + Stage 3): every declared
       relationship must resolve in the candidate (merged) dataset.
       Checked BEFORE any mutation, so a failed import changes nothing
       (atomic import). */
    var refErrors = [];
    /* Stage 11 helper: does an id resolve in the candidate (merged)
     * dataset or the current data? */
    function byIdIn(dsx, coll, id) {
      var found = (dsx.collections[coll] || []).some(function (t) {
        return !!(t && t.id === id);
      });
      if (found) { return true; }
      var cur = current.collections[coll] || [];
      for (var i = 0; i < cur.length; i++) {
        if (cur[i] && cur[i].id === id) { return true; }
      }
      return false;
    }
    Object.keys(REFERENCES).forEach(function (coll) {
      var spec = REFERENCES[coll];
      var recs = ds.collections[coll];
      if (!recs || !Object.keys(spec).length) { return; }
      Object.keys(spec).forEach(function (field) {
        var target = spec[field];
        var targets = ds.collections[target] || [];
        var byId = {};
        targets.forEach(function (t) { if (t && t.id) { byId[t.id] = true; } });
        recs.forEach(function (r) {
          if (!r) { return; }
          /* Same retired-history exemption as the graph_edges block
           * below: a REJECTED/SUPERSEDED graph edge keeps its broken
           * provenance/region references by design (audited
           * retirement, never silent deletion). Active records are
           * held to the full standard. */
          if (coll === 'graph_edges' &&
            (r.status === 'REJECTED' || r.status === 'SUPERSEDED')) {
            return;
          }
          /* Stage 8: same exemption for retired repair history. */
          if (repairRetired(coll, r)) { return; }
          var val = r[field];
          var ids = Array.isArray(val) ? val : (val ? [val] : []);
          ids.forEach(function (id) {
            if (id && !byId[id]) {
              refErrors.push((r.code || r.title || r.id) + ' -> ' + target + ' ' + id);
            }
          });
        });
      });
    });
    /* Stage 7: graph edge source/target nodes resolve DYNAMICALLY by
       node type — the static REFERENCES map cannot express them. The
       import also validates the relationship vocabulary, node types and
       lifecycle statuses BEFORE any mutation: a graph import carrying
       an unknown relationship type or status is rejected whole. */
    if (ds.collections.graph_edges && SCA.graphRegistry) {
      var EDGE_STATUSES = ['PROPOSED', 'DOCUMENTED', 'VERIFIED',
        'REJECTED', 'SUPERSEDED'];
      /* Retired edges (REJECTED / SUPERSEDED) are PRESERVED HISTORY:
       * the retirement itself is the audit record, they are excluded
       * from every traversal, and an integrity-retired orphan keeps
       * its broken references by design. Exempting them here is what
       * keeps a real research dataset (which has retired some corrupt
       * edge through the audited path) exportable and importable.
       * Everything still resolves post-import; the integrity check
       * re-flags retired corruption honestly. ACTIVE edges are held
       * to the full standard. */
      var RETIRED = ['REJECTED', 'SUPERSEDED'];
      ds.collections.graph_edges.forEach(function (r) {
        if (!r) { return; }
        if (EDGE_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('graph edge ' + (r.id) + ' -> invalid status ' +
            r.status);
        }
        if (RETIRED.indexOf(r.status) !== -1) { return; }
        if (!SCA.graphRegistry.RELATIONSHIPS[r.relationship_type]) {
          refErrors.push('graph edge ' + (r.id) + ' -> unknown ' +
            'relationship type ' + r.relationship_type);
        }
        ['source', 'target'].forEach(function (end) {
          var ncoll = SCA.graphRegistry.collectionFor(r[end + '_type']);
          if (!ncoll) {
            refErrors.push('graph edge ' + (r.id) + ' -> unknown node type ' +
              r[end + '_type']);
            return;
          }
          var ids = {};
          (ds.collections[ncoll] || []).forEach(function (t) {
            if (t && t.id) { ids[t.id] = true; }
          });
          if (!ids[r[end + '_id']]) {
            refErrors.push('graph edge ' + (r.id) + ' -> ' + ncoll + ' ' +
              r[end + '_id']);
          }
        });
      });
    }
    /* Stage 8: repair asset references resolve dynamically through the
       Stage 7 node registry. Active records must resolve; retired
       history (REJECTED/SUPERSEDED capabilities, REJECTED parts,
       REJECTED/ARCHIVED records, CLOSED workshops) follows the same
       frozen Stage 7 exemption: preserved broken references, flagged
       honestly by the integrity checker, never silently deleted. */
    var REPAIR_ASSET_TYPES = ['CAPABILITY', 'TOOL', 'WORKSHOP',
      'ENERGY_SOURCE', 'LOCATION'];
    Object.keys(ASSET_DYN).forEach(function (coll) {
      var recs = ds.collections[coll];
      if (!recs || !SCA.graphRegistry) { return; }
      recs.forEach(function (r) {
        if (!r) { return; }
        var retired = repairRetired(coll, r);
        ASSET_DYN[coll].forEach(function (pair) {
          var typeField = pair[0];
          var idsField = pair[1];
          if (!r[typeField]) { return; }
          var ncoll = SCA.graphRegistry.collectionFor(r[typeField]);
          if (!ncoll || REPAIR_ASSET_TYPES.indexOf(r[typeField]) === -1) {
            refErrors.push((coll + ' ' + (r.id)) + ' -> unknown asset type ' +
              r[typeField]);
            return;
          }
          if (retired) { return; }
          var ids = r[idsField];
          ids = Array.isArray(ids) ? ids : (ids ? [ids] : []);
          var byId = {};
          (ds.collections[ncoll] || []).forEach(function (t) {
            if (t && t.id) { byId[t.id] = true; }
          });
          ids.forEach(function (aid) {
            if (aid && !byId[aid]) {
              refErrors.push(coll + ' ' + (r.id || r.name) + ' -> ' +
                ncoll + ' ' + aid);
            }
          });
        });
      });
    });
    /* Stage 9: recovery profile validation BEFORE any mutation. The
       subject asset resolves through the Stage 7 node registry
       (ASSET_DYN above already covers asset_type/asset_id); the
       recovery TARGET resolves through its own frozen type->collection
       map because targets include non-node collections. Active
       records must resolve (hard requirement); REJECTED/SUPERSEDED
       history follows the frozen retired-history exemption. Graph-edge
       citations are SOFT by the frozen scope: they are never validated
       here and never block an otherwise valid import. Nothing missing
       is ever silently created. */
    if (ds.collections.recovery_profiles) {
      var RP_STATUSES = ['PROPOSED', 'DOCUMENTED', 'VERIFIED',
        'REJECTED', 'SUPERSEDED'];
      var RP_KINDS = ['FALLBACK_CAPABILITY', 'REPAIR_NETWORK',
        'SUBSTITUTION', 'FABRICATION', 'EXTERNAL_SUPPORT'];
      var RP_TARGET_TYPES = {
        FALLBACK_CAPABILITY: ['CAPABILITY'],
        REPAIR_NETWORK: ['REPAIR_CAPABILITY'],
        FABRICATION: ['REPAIR_CAPABILITY', 'WORKSHOP'],
        SUBSTITUTION: ['SPARE_PART', 'MATERIAL', 'TOOL', 'CAPABILITY'],
        EXTERNAL_SUPPORT: ['ORGANIZATION']
      };
      var RP_COLLECTIONS = {
        CAPABILITY: 'capabilities',
        REPAIR_CAPABILITY: 'repair_capabilities',
        WORKSHOP: 'workshops',
        SPARE_PART: 'spare_parts',
        MATERIAL: 'materials',
        TOOL: 'tools',
        ORGANIZATION: 'organizations'
      };
      ds.collections.recovery_profiles.forEach(function (r) {
        if (!r) { return; }
        if (RP_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('recovery_profiles ' + r.id + ' -> invalid status ' +
            r.status);
        }
        if (RP_KINDS.indexOf(r.recovery_kind) === -1) {
          refErrors.push('recovery_profiles ' + r.id + ' -> unknown recovery kind ' +
            r.recovery_kind);
          return;
        }
        if (RP_TARGET_TYPES[r.recovery_kind].indexOf(r.target_type) === -1) {
          refErrors.push('recovery_profiles ' + r.id + ' -> ' + r.recovery_kind +
            ' may not target type ' + r.target_type);
          return;
        }
        if (repairRetired('recovery_profiles', r)) { return; }
        var tcoll = RP_COLLECTIONS[r.target_type];
        var tids = {};
        (ds.collections[tcoll] || []).forEach(function (t) {
          if (t && t.id) { tids[t.id] = true; }
        });
        if (r.target_id && !tids[r.target_id]) {
          refErrors.push('recovery_profiles ' + r.id + ' -> ' + tcoll + ' ' +
            r.target_id + ' (recovery target does not resolve; missing ' +
            'targets are never silently created)');
        }
      });
    }
    /* Stage 10: capability intervention validation BEFORE any
       mutation. Active planning records must resolve their critical
       role practitioner references; COMPLETED/CANCELLED history
       follows the frozen terminal-history exemption. Structural
       rules (valid status/type/outcome, reviewer trail on any
       assessed outcome) hold for EVERY record including terminal
       history. Nothing missing is ever silently created. */
    if (ds.collections.capability_interventions) {
      var IV_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
        'APPROVED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED'];
      var IV_OUTCOMES = ['UNKNOWN', 'SUCCESSFUL', 'MIXED',
        'UNSUCCESSFUL', 'INSUFFICIENT_EVIDENCE'];
      var IV_TYPES = SCA.enums.codes(SCA.enums.intervention_types);
      ds.collections.capability_interventions
        .forEach(function (r) {
          if (!r) { return; }
          if (IV_STATUSES.indexOf(r.status) === -1) {
            refErrors.push('capability_interventions ' + r.id +
              ' -> invalid status ' + r.status);
          }
          if (IV_TYPES.indexOf(r.intervention_type) === -1) {
            refErrors.push('capability_interventions ' + r.id +
              ' -> unknown intervention type ' + r.intervention_type);
          }
          if (IV_OUTCOMES.indexOf(r.outcome_status || 'UNKNOWN') === -1) {
            refErrors.push('capability_interventions ' + r.id +
              ' -> invalid outcome status ' + r.outcome_status);
          }
          if ((r.outcome_status || 'UNKNOWN') !== 'UNKNOWN') {
            if (!r.outcome_reviewer || !r.outcome_reason) {
              refErrors.push('capability_interventions ' + r.id +
                ' -> outcome ' + r.outcome_status +
                ' is missing its reviewer trail');
            }
            if (r.status !== 'COMPLETED') {
              refErrors.push('capability_interventions ' + r.id +
                ' -> outcome ' + r.outcome_status +
                ' on a non-COMPLETED record (current: ' + r.status + ')');
            }
          }
          if (repairRetired('capability_interventions', r)) { return; }
          var pids = {};
          (ds.collections.practitioners || []).forEach(function (t) {
            if (t && t.id) { pids[t.id] = true; }
          });
          (r.critical_roles || []).forEach(function (role, i) {
            if (!role) { return; }
            if ((role.status || 'UNKNOWN') === 'IDENTIFIED') {
              if (!role.practitioner_id) {
                refErrors.push('capability_interventions ' + r.id +
                  ' -> critical role ' + (i + 1) +
                  ' is IDENTIFIED without a practitioner reference');
              } else if (!pids[role.practitioner_id] &&
                !SCA.store.get('practitioners', role.practitioner_id)) {
                refErrors.push('capability_interventions ' + r.id +
                  ' -> practitioners ' + role.practitioner_id +
                  ' (critical role does not resolve; missing ' +
                  'practitioners are never silently created)');
              }
            }
          });
        });
    }
    /* Stage 12: measurement source references resolve DYNAMICALLY
       through the controlled source-type vocabulary (existing
       collections ONLY — a measurement never creates, duplicates or
       upgrades a source). Active workflow records and ACCEPTED
       measurements must resolve their sources; REJECTED/SUPERSEDED
       history follows the frozen terminal-history exemption. */
    Object.keys(MEASUREMENT_SOURCES_DYN).forEach(function (coll) {
      var mspec = MEASUREMENT_SOURCES_DYN[coll];
      var recs = ds.collections[coll];
      if (!recs) { return; }
      recs.forEach(function (r) {
        if (!r || !Array.isArray(r[mspec.list_field])) { return; }
        var retired = repairRetired(coll, r);
        if (retired) { return; }
        r[mspec.list_field].forEach(function (sr) {
          if (!sr || !sr[mspec.type_field] || !sr[mspec.id_field]) {
            refErrors.push(coll + ' ' + r.id + ' -> malformed source ' +
              'reference');
            return;
          }
          var scoll = mspec.collections[sr[mspec.type_field]];
          if (!scoll) {
            refErrors.push(coll + ' ' + r.id + ' -> unknown source type ' +
              sr[mspec.type_field] + ' (controlled vocabulary only)');
            return;
          }
          if (!byIdIn(ds, scoll, sr[mspec.id_field])) {
            refErrors.push(coll + ' ' + r.id + ' -> ' + scoll + ' ' +
              sr[mspec.id_field] + ' (a source reference does not ' +
              'resolve; sources are never silently created)');
          }
        });
      });
    });
    /* Stage 11: pilot project validation BEFORE any mutation.
       Structural rules (valid status, census snapshot resolution,
       activation-gate consistency, creator/approver separation on
       approved records, and the absolute no-outcome-fields rule)
       hold for EVERY record including terminal history. Active
       records must resolve their references (the generic block
       above); CONCLUDED/CANCELLED history follows the frozen
       terminal-history exemption. Nothing missing is ever silently
       created, and no imported record may carry pilot outcome
       fields — a pilot coordinates; it never re-governs. */
    if (ds.collections.pilot_projects) {
      var PL_STATUSES = ['PROPOSED', 'APPROVED', 'ACTIVE', 'CONCLUDED',
        'CANCELLED'];
      var PL_TERMINAL = ['CONCLUDED', 'CANCELLED'];
      var snapIds = {};
      (ds.collections.census_snapshots || []).forEach(function (t) {
        if (t && t.id) { snapIds[t.id] = true; }
      });
      ds.collections.pilot_projects.forEach(function (r) {
        if (!r) { return; }
        if (PL_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('pilot_projects ' + r.id +
            ' -> invalid status ' + r.status);
        }
        if (PL_TERMINAL.indexOf(r.status) === -1) {
          if (r.census_snapshot_id && !snapIds[r.census_snapshot_id] &&
            !SCA.store.get('census_snapshots', r.census_snapshot_id)) {
            refErrors.push('pilot_projects ' + r.id +
              ' -> census_snapshots ' + r.census_snapshot_id +
              ' (a snapshot reference does not resolve; snapshots ' +
              'are never silently created)');
          }
          if (r.status === 'ACTIVE') {
            var live = 0;
            (r.intervention_ids || []).forEach(function (id) {
              if (byIdIn(ds, 'capability_interventions', id)) { live += 1; }
            });
            (r.organization_ids || []).forEach(function (id) {
              if (byIdIn(ds, 'organizations', id)) { live += 1; }
            });
            (r.workshop_ids || []).forEach(function (id) {
              if (byIdIn(ds, 'workshops', id)) { live += 1; }
            });
            (r.training_program_ids || []).forEach(function (id) {
              if (byIdIn(ds, 'training_programs', id)) { live += 1; }
            });
            if (live === 0) {
              refErrors.push('pilot_projects ' + r.id +
                ' -> ACTIVE pilot has no resolvable constituent ' +
                'activity (the activation gate cannot be satisfied ' +
                'by import)');
            }
          }
          if (r.status !== 'PROPOSED' &&
            r.created_by === r.reviewer) {
            refErrors.push('pilot_projects ' + r.id +
              ' -> creator/approver separation violated (creator "' +
              r.created_by + '" approved their own pilot)');
          }
        }
        /* A pilot NEVER carries outcome fields — not in active
         * records, not in terminal history. */
        ['outcome_status', 'score', 'success_rate', 'rating',
          'priority'].forEach(function (bad) {
            if (r[bad] !== undefined) {
              refErrors.push('pilot_projects ' + r.id + ' -> field "' +
                bad + '" is forbidden on a pilot (a pilot ' +
                'coordinates; it never re-governs)');
            }
          });
      });
    }
    /* Stage 12: measurement + indicator validation BEFORE any
       mutation (authorization §30: atomic, authority-honest).
       Structural rules hold for EVERY record including terminal
       history. An import must NEVER manufacture an ACCEPTED
       measurement or an APPROVED indicator without the appropriate
       authority: acceptance requires a distinct reviewer and a
       review timestamp, exactly as the live workflow enforces. */
    if (ds.collections.measurements) {
      var MS_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
        'ACCEPTED', 'REJECTED', 'SUPERSEDED'];
      var MS_BASES = ['OBSERVED', 'ESTIMATED', 'REPORTED', 'UNKNOWN'];
      var MS_KINDS = ['COUNT', 'RATIO', 'RATE', 'DURATION',
        'PERCENTAGE', 'CATEGORICAL'];
      ds.collections.measurements.forEach(function (r) {
        if (!r) { return; }
        if (MS_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('measurements ' + r.id + ' -> invalid ' +
            'status ' + r.status);
        }
        /* observation scope and basis semantics hold for EVERY
         * imported record (they are what the record IS). */
        if (!r.observation_scope ||
          String(r.observation_scope).trim() === '') {
          refErrors.push('measurements ' + r.id + ' -> missing ' +
            'observation scope (a measurement without a scope is ' +
            'not a valid import)');
        }
        if (MS_BASES.indexOf(r.basis) === -1) {
          refErrors.push('measurements ' + r.id + ' -> invalid ' +
            'basis ' + r.basis + ' (frozen vocabulary: OBSERVED, ' +
            'ESTIMATED, REPORTED, UNKNOWN)');
        }
        if (MS_KINDS.indexOf(r.measurement_kind) === -1) {
          refErrors.push('measurements ' + r.id + ' -> invalid ' +
            'measurement kind ' + r.measurement_kind);
        }
        if (r.basis === 'UNKNOWN' &&
          r.value !== null && r.value !== undefined) {
          refErrors.push('measurements ' + r.id + ' -> UNKNOWN ' +
            'measurement carries a value (unknown is never zero)');
        }
        if (r.basis !== 'UNKNOWN' &&
          r.measurement_kind !== 'CATEGORICAL' &&
          typeof r.value !== 'number') {
          refErrors.push('measurements ' + r.id + ' -> a ' +
            r.basis + ' measurement requires a numeric value');
        }
        /* Manufacturing authority: only a distinct reviewer may
         * accept. Submissions in workflow are imported into the
         * workflow (still reviewable) — but an ACCEPTED record
         * without separation is rejected atomically. */
        if (r.status === 'ACCEPTED') {
          if (!r.reviewer || !r.reviewed_at) {
            refErrors.push('measurements ' + r.id + ' -> an ' +
              'ACCEPTED import requires a reviewer and review ' +
              'timestamp (an import never manufactures acceptance)');
          }
          if (r.created_by === r.reviewer) {
            refErrors.push('measurements ' + r.id + ' -> creator/' +
              'reviewer separation violated (creator "' +
              r.created_by + '" accepted their own measurement)');
          }
        }
        if (r.status === 'SUPERSEDED' && !r.superseded_by) {
          refErrors.push('measurements ' + r.id + ' -> a SUPERSEDED ' +
            'measurement must record its successor ' +
            '(superseded_by) — provenance is never broken silently');
        }
        /* A measurement never carries evidence or outcome
         * authority fields (Stage 3/10/11 remain the owners). */
        ['evidence_level', 'outcome_status', 'priority', 'score',
          'ranking'].forEach(function (bad) {
            if (r[bad] !== undefined) {
              refErrors.push('measurements ' + r.id + ' -> field "' +
                bad + '" is forbidden on a measurement (evidence, ' +
                'outcome and policy authority stays with its ' +
                'governing stage)');
            }
          });
      });
    }
    if (ds.collections.indicators) {
      var IN_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED',
        'REJECTED', 'SUPERSEDED'];
      ds.collections.indicators.forEach(function (r) {
        if (!r) { return; }
        if (IN_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('indicators ' + r.id + ' -> invalid ' +
            'status ' + r.status);
        }
        if (!r.code || !r.name || !r.definition) {
          refErrors.push('indicators ' + r.id + ' -> a definition ' +
            'requires a code, name and formal definition');
        }
        if (!r.indicator_version ||
          typeof r.indicator_version !== 'number') {
          refErrors.push('indicators ' + r.id + ' -> a definition ' +
            'requires a numeric version');
        }
        /* Manufacturing authority: only a distinct reviewer may
         * approve a definition. */
        if (r.status === 'APPROVED') {
          if (!r.reviewer || !r.reviewed_at) {
            refErrors.push('indicators ' + r.id + ' -> an APPROVED ' +
              'import requires a reviewer and review timestamp ' +
              '(an import never manufactures approval)');
          }
          if (r.created_by === r.reviewer) {
            refErrors.push('indicators ' + r.id + ' -> creator/' +
              'reviewer separation violated (creator "' +
              r.created_by + '" approved their own definition)');
          }
        }
        /* No indicator carries a result value — an indicator is a
         * DEFINITION (authorization §16/§20). */
        ['value', 'result', 'score', 'ranking'].forEach(function (bad) {
          if (r[bad] !== undefined) {
            refErrors.push('indicators ' + r.id + ' -> field "' +
              bad + '" is forbidden on an indicator definition ' +
              '(values are computed dynamically, never stored)');
          }
        });
      });
      /* One APPROVED version per code at a time — including across
         the bundle/store boundary: importing an APPROVED version
         while a DIFFERENT approved version already exists (and is
         not superseded within this import) would create two live
         formulas for one code. */
      var approvedByCode = {};
      ds.collections.indicators.forEach(function (r) {
        if (!r || r.status !== 'APPROVED') { return; }
        if (approvedByCode[r.code]) {
          refErrors.push('indicators ' + r.id + ' -> two APPROVED ' +
            'versions of code ' + r.code + ' cannot coexist (the ' +
            'previous version must be SUPERSEDED)');
        }
        approvedByCode[r.code] = true;
      });
      var bundleById = {};
      ds.collections.indicators.forEach(function (r) {
        if (r && r.id) { bundleById[r.id] = r; }
      });
      ds.collections.indicators.forEach(function (r) {
        if (!r || r.status !== 'APPROVED') { return; }
        var inStore = SCA.store.all('indicators').filter(
          function (i) {
            return i.code === r.code && i.status === 'APPROVED' &&
              i.id !== r.id;
          }).filter(function (i) {
            /* A store record that this same import carries as
             * SUPERSEDED is being retired by the import itself —
             * that is exactly the honest supersession path, not a
             * duplicate. (Without this, a full-bundle restore
             * against a freshly seeded store would be rejected
             * for the very lineage it carries.) */
            var carried = bundleById[i.id];
            return !(carried && carried.status === 'SUPERSEDED');
          });
        if (inStore.length) {
          refErrors.push('indicators ' + r.id + ' -> the store ' +
            'already holds an APPROVED version of ' + r.code + ' (' +
            inStore[0].id + '); supersede it within the same ' +
            'import (the previous version becomes SUPERSEDED)');
        }
      });
      /* Correction chains stay consistent: an ACCEPTED correction
         requires its original to arrive (or already exist) as
         SUPERSEDED. */
      ds.collections.measurements.forEach(function (r) {
        if (!r || r.status !== 'ACCEPTED' || !r.supersedes_id) {
          return;
        }
        var orig = null;
        (ds.collections.measurements || []).forEach(function (o) {
          if (o && o.id === r.supersedes_id) { orig = o; }
        });
        if (!orig) {
          orig = SCA.store.get('measurements', r.supersedes_id);
        }
        if (!orig) {
          refErrors.push('measurements ' + r.id + ' -> supersedes ' +
            r.supersedes_id + ' but the original record is neither ' +
            'in this import nor in the current data');
        } else if (orig.status !== 'SUPERSEDED') {
          refErrors.push('measurements ' + r.id + ' -> the ' +
            'superseded original ' + orig.id + ' arrives as ' +
            orig.status + ' instead of SUPERSEDED (provenance is ' +
            'never rewritten silently)');
        }
      });
    }
    /* Stage 13: marketplace listing validation BEFORE any mutation
       (authorization §17: atomic, authority-honest). Structural
       rules hold for EVERY record including terminal history. An
       import must NEVER manufacture a PUBLISHED listing without the
       appropriate authority: publication requires a distinct
       reviewer and a review timestamp, exactly as the live workflow
       enforces; withdrawal requires reason/actor/timestamp.
       D1 targeted correction (authorization §3-§6): a terminal
       listing is immutable with respect to lifecycle status (no
       resurrection through import), and a PUBLISHED import must
       carry genuine publication authority — a documented review
       reason and a reviewer who resolves to a real account with
       marketplace.review authority on the importing deployment's
       own roster (user accounts never travel in a bundle; a
       reviewer string is not publication authority). */
    if (ds.collections.marketplace_listings) {
      var MP_STATUSES = ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'PAUSED',
        'REJECTED', 'WITHDRAWN'];
      var MP_KINDS = ['OFFER', 'NEED'];
      var MP_SERVICE = ['REPAIR', 'MAINTENANCE', 'TRAINING',
        'APPRENTICESHIP_HOSTING', 'TECHNICAL_ASSISTANCE',
        'FABRICATION', 'LOCAL_PRODUCTION', 'AGRICULTURAL_SERVICES',
        'FISHERIES_SERVICES', 'WATER_SERVICES',
        'ENVIRONMENTAL_KNOWLEDGE', 'RESEARCH_FIELD_SERVICES'];
      var MP_AVAIL = ['BY_ARRANGEMENT', 'SCHEDULED_WINDOWS', 'SEASONAL',
        'LIMITED', 'UNKNOWN'];
      var MP_PROVIDERS = { PRACTITIONER: 'practitioners',
        ORGANIZATION: 'organizations', WORKSHOP: 'workshops',
        TRAINING_PROGRAM: 'training_programs' };
      ds.collections.marketplace_listings.forEach(function (r) {
        if (!r) { return; }
        if (MP_STATUSES.indexOf(r.status) === -1) {
          refErrors.push('marketplace_listings ' + r.id + ' -> ' +
            'invalid status ' + r.status);
        }
        if (MP_KINDS.indexOf(r.listing_kind) === -1) {
          refErrors.push('marketplace_listings ' + r.id + ' -> ' +
            'invalid listing kind ' + r.listing_kind);
        }
        if (MP_SERVICE.indexOf(r.service_kind) === -1) {
          refErrors.push('marketplace_listings ' + r.id + ' -> ' +
            'invalid service kind ' + r.service_kind +
            ' (frozen twelve-value vocabulary)');
        }
        if (MP_AVAIL.indexOf(r.availability_status) === -1) {
          refErrors.push('marketplace_listings ' + r.id + ' -> ' +
            'invalid availability ' + r.availability_status);
        }
        /* Polymorphic provider: must resolve in the import or the
         * current data. Terminal history keeps broken references by
         * the frozen exemption; active records are held to the full
         * standard (a listing never manufactures provider identity). */
        var pcoll = MP_PROVIDERS[r.provider_type];
        if (!pcoll) {
          refErrors.push('marketplace_listings ' + r.id + ' -> ' +
            'invalid provider type ' + r.provider_type);
        } else {
          var pres = (ds.collections[pcoll] || []).filter(
            function (t) { return t && t.id === r.provider_id; });
          if (!pres.length &&
            !SCA.store.get(pcoll, r.provider_id) &&
            r.status !== 'REJECTED' && r.status !== 'WITHDRAWN') {
            refErrors.push('marketplace_listings ' + r.id + ' -> ' +
              'provider reference does not resolve: ' +
              r.provider_type + ' ' + r.provider_id);
          }
        }
        /* Structural pins hold for EVERY imported record (they are
         * what the record IS): no contact fields, no pricing, no
         * scores/rankings, no Stage 10/11 coupling. */
        ['phone', 'email', 'street_address', 'address', 'contact',
          'messaging_handle', 'whatsapp', 'telegram', 'price',
          'currency', 'hourly_rate', 'rate', 'service_fee', 'fee',
          'compensation', 'paid', 'commission', 'escrow', 'invoice',
          'payment', 'transaction_status', 'booking', 'appointment',
          'contract', 'delivery', 'score', 'ranking', 'rating',
          'trust', 'trust_level', 'popularity', 'demand',
          'response_count', 'match_count', 'success', 'region',
          'radius', 'distance', 'catchment', 'intervention_id',
          'pilot_project_id'].forEach(function (bad) {
            if (r[bad] !== undefined) {
              refErrors.push('marketplace_listings ' + r.id +
                ' -> field "' + bad + '" is forbidden on a ' +
                'marketplace listing (structural privacy/boundary ' +
                'pin, authorization §13/§14/§19/§20/§28)');
            }
          });
        /* Geography rules (authorization §8). */
        if (r.location_scope === 'SPECIFIC' &&
          (!Array.isArray(r.location_ids) ||
            !r.location_ids.length)) {
          refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
            'SPECIFIC listing requires at least one location ' +
            'reference');
        }
        if (r.location_scope === 'ANYWHERE' &&
          Array.isArray(r.location_ids) && r.location_ids.length) {
          refErrors.push('marketplace_listings ' + r.id + ' -> an ' +
            'ANYWHERE listing is not location-bound');
        }
        /* D1-A terminal immutability (authorization §3/§6): a
         * terminal listing (REJECTED/WITHDRAWN) may be re-imported
         * UNCHANGED, but a bundle may never move it back into the
         * lifecycle. No resurrection, no reopening. */
        var localTerm = null;
        (current.collections.marketplace_listings || []).forEach(
          function (t) {
            if (t && t.id === r.id &&
              (t.status === 'REJECTED' || t.status === 'WITHDRAWN')) {
              localTerm = t;
            }
          });
        if (localTerm && r.status !== localTerm.status) {
          refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
            'terminal ' + localTerm.status + ' listing cannot be ' +
            'resurrected as ' + r.status + ' through import ' +
            '(terminal history is immutable)');
        }
        /* ---------- publication provenance foundation ----------
         * Manufacturing authority: only a distinct reviewer with
         * real authority may publish. Workflow material (DRAFT /
         * SUBMITTED) imports into the workflow and stays
         * reviewable; a record claiming a post-review state
         * without provenance is rejected atomically. D1-B
         * established this for PUBLISHED; D2 authorization §3/§4
         * extends the SAME foundation to PAUSED and WITHDRAWN
         * because both are definitionally post-publication states
         * (the only legitimate paths are PUBLISHED -> PAUSED and
         * PUBLISHED/PAUSED -> WITHDRAWN). No import exception
         * exists; PUBLISHED validation is not weakened. */
        var POST_REVIEW = ['PUBLISHED', 'PAUSED', 'WITHDRAWN'];
        function reviewerAuthorityError(label) {
          if (!r.reviewer || !r.reviewed_at) {
            return 'a ' + label + ' import requires a reviewer and ' +
              'review timestamp (an import never manufactures ' +
              'publication)';
          }
          if (r.created_by === r.reviewer) {
            return 'creator/reviewer separation violated (creator "' +
              r.created_by + '" appears as their own reviewer)';
          }
          /* D1-B review provenance: publication is documented with
           * an explicit review reason, exactly as the live workflow
           * requires at publish time. */
          if (!r.review_reason ||
            !String(r.review_reason).replace(/^\s+|\s+$/g, '')) {
            return 'a ' + label + ' import requires a documented ' +
              'review reason';
          }
          /* D1-B reviewer authority: a reviewer string is not proof
           * of publication authority. User accounts never travel
           * in a bundle (frozen privacy pin: the users collection
           * is excluded from every export), so the only honest
           * authority is the importing deployment's own preserved
           * roster. The reviewer must resolve to a real account
           * there, and that account must hold marketplace.review
           * authority (reviewer / regional_administrator /
           * national_administrator per the live permission
           * matrix). */
          var roster = (current.collections.users || []).filter(
            function (u) { return u && u.name === r.reviewer; });
          if (!roster.length) {
            return label + ' reviewer "' + r.reviewer + '" does not ' +
              'resolve to an account on this deployment (a ' +
              'reviewer string is not publication authority)';
          }
          var reviewRoles = (SCA.rbac && SCA.rbac.rolesFor) ?
            SCA.rbac.rolesFor('marketplace.review') : [];
          if (!roster.some(function (u) {
            return reviewRoles.indexOf(u.role) !== -1; })) {
            return label + ' reviewer "' + r.reviewer + '" holds no ' +
              'marketplace.review authority';
          }
          return null;
        }
        if (POST_REVIEW.indexOf(r.status) !== -1) {
          var pubErr = reviewerAuthorityError(r.status);
          if (pubErr) {
            refErrors.push('marketplace_listings ' + r.id + ' -> ' +
              pubErr);
          }
        }
        /* D2.4: the only legitimate lifecycle path into PAUSED is
         * PUBLISHED -> PAUSED. A local record sitting in DRAFT or
         * SUBMITTED may never be moved into PAUSED by an import
         * (a manufactured lifecycle history); a fresh PAUSED
         * record must carry the provenance foundation above. */
        if (r.status === 'PAUSED' && !localTerm) {
          var localFrom = null;
          (current.collections.marketplace_listings || []).forEach(
            function (t) {
              if (t && t.id === r.id) { localFrom = t.status; }
            });
          if (localFrom && localFrom !== 'PUBLISHED' &&
            localFrom !== 'PAUSED') {
            refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
              localFrom + ' listing cannot be moved to PAUSED ' +
              'through import (the only legitimate path into ' +
              'PAUSED is PUBLISHED -> PAUSED)');
          }
        }
        /* D2 §6 pause provenance: the frozen pause workflow is a
         * creator-only, documented, audited action — an imported
         * PAUSED record must carry the same provenance, and the
         * actor must resolve to a real local-roster account with
         * marketplace.update authority (an actor string is never
         * authority). */
        if (r.status === 'PAUSED') {
          if (!r.paused_by || !r.paused_at || !r.pause_reason ||
            !String(r.pause_reason).replace(/^\s+|\s+$/g, '')) {
            refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
              'PAUSED import requires a pause actor, timestamp and ' +
              'documented reason (the frozen pause workflow always ' +
              'records them)');
          } else {
            if (r.paused_by !== r.created_by) {
              refErrors.push('marketplace_listings ' + r.id +
                ' -> only the listing\'s creator may pause it ' +
                '(frozen pause workflow): pause actor "' +
                r.paused_by + '" is not the creator');
            }
            var pauseRoster = (current.collections.users ||
              []).filter(function (u) {
                return u && u.name === r.paused_by; });
            if (!pauseRoster.length) {
              refErrors.push('marketplace_listings ' + r.id +
                ' -> pause actor "' + r.paused_by + '" does not ' +
                'resolve to an account on this deployment (an ' +
                'actor string is not pause authority)');
            } else {
              var pauseRoles = (SCA.rbac && SCA.rbac.rolesFor) ?
                SCA.rbac.rolesFor('marketplace.update') : [];
              if (!pauseRoster.some(function (u) {
                return pauseRoles.indexOf(u.role) !== -1; })) {
                refErrors.push('marketplace_listings ' + r.id +
                  ' -> pause actor "' + r.paused_by + '" holds no ' +
                  'marketplace.update authority');
              }
            }
          }
        }
        if (r.status === 'WITHDRAWN' &&
          (!r.withdraw_reason || !r.withdrawn_by || !r.withdrawn_at)) {
          refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
            'WITHDRAWN listing requires a withdrawal reason, actor ' +
            'and timestamp');
        }
        /* D2 §7 withdrawal provenance: withdrawal is a creator-only
         * frozen action — the actor must resolve to a real local-
         * roster account with marketplace.withdraw authority (an
         * arbitrary actor string is never withdrawal authority). */
        if (r.status === 'WITHDRAWN' && r.withdrawn_by) {
          if (r.withdrawn_by !== r.created_by) {
            refErrors.push('marketplace_listings ' + r.id +
              ' -> only the listing\'s creator may withdraw it ' +
              '(frozen withdrawal workflow): withdrawal actor "' +
              r.withdrawn_by + '" is not the creator');
          }
          var wdRoster = (current.collections.users || []).filter(
            function (u) {
              return u && u.name === r.withdrawn_by; });
          if (!wdRoster.length) {
            refErrors.push('marketplace_listings ' + r.id +
              ' -> withdrawal actor "' + r.withdrawn_by + '" does ' +
              'not resolve to an account on this deployment (an ' +
              'actor string is not withdrawal authority)');
          } else {
            var wdRoles = (SCA.rbac && SCA.rbac.rolesFor) ?
              SCA.rbac.rolesFor('marketplace.withdraw') : [];
            if (!wdRoster.some(function (u) {
              return wdRoles.indexOf(u.role) !== -1; })) {
              refErrors.push('marketplace_listings ' + r.id +
                ' -> withdrawal actor "' + r.withdrawn_by +
                '" holds no marketplace.withdraw authority');
            }
          }
        }
        if (r.status === 'REJECTED' && !r.review_reason) {
          refErrors.push('marketplace_listings ' + r.id + ' -> a ' +
            'REJECTED listing requires a reviewer reason');
        }
      });
    }

    /* ================= Stage 14: reserves / plans / assets
     * (frozen scope v1.1 + Gate C authorization §24-§27).
     * The Stage 13 D1/D2 provenance lessons apply FROM DAY ONE:
     * every non-DRAFT imported state requires legitimate
     * provenance; actors resolve against the importing
     * deployment's LOCAL roster (users never travel in a
     * bundle); permissions are checked; creator/reviewer
     * separation is enforced; terminal records cannot resurrect;
     * an arbitrary string is never authority. ================= */
    var RES_STATUSES14 = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'ACTIVE',
      'SUSPENDED', 'REJECTED', 'RETIRED'];
    var RES_TYPES14 = ['HUMAN_RESERVE', 'KNOWLEDGE_RESERVE',
      'TECHNICAL_RESERVE', 'MATERIAL_RESERVE', 'BIOLOGICAL_RESERVE',
      'INSTITUTIONAL_RESERVE', 'GEOGRAPHIC_RESERVE',
      'FALLBACK_RESERVE'];
    var PLAN_STATUSES14 = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'ACTIVE',
      'REJECTED', 'RETIRED'];
    var SCENARIOS14 = ['IMPORTS_UNAVAILABLE_6_MONTHS',
      'ELECTRICITY_UNAVAILABLE_72_HOURS',
      'INTERNET_UNAVAILABLE_30_DAYS', 'FUEL_UNAVAILABLE',
      'EXTERNAL_TECHNICIANS_UNAVAILABLE',
      'CRITICAL_KNOWLEDGE_HOLDER_UNAVAILABLE'];
    var GAPS14 = ['NO_TRAINER', 'NO_APPRENTICE',
      'SINGLE_KNOWLEDGE_HOLDER', 'NO_DOCUMENTATION',
      'NO_LOCAL_REPAIR', 'NO_SPARE_PART', 'NO_FALLBACK',
      'SINGLE_LOCATION', 'EXTERNAL_TECHNICIAN_DEPENDENCY',
      'EXTERNAL_MATERIAL_DEPENDENCY', 'ENERGY_DEPENDENCY',
      'INSTITUTIONAL_GAP', 'UNKNOWN'];
    var ASSET_CATS14 = ['HUMAN', 'KNOWLEDGE', 'TOOL', 'EQUIPMENT',
      'MATERIAL', 'SPARE_PART', 'DOCUMENTATION', 'TRAINING',
      'WORKSHOP', 'INSTITUTION', 'BIOLOGICAL', 'ENERGY',
      'FALLBACK_CAPABILITY'];
    var ASSET_SOURCES14 = {
      HUMAN: ['practitioners', 'apprentices'],
      KNOWLEDGE: ['knowledge', 'evidence_sources'],
      TOOL: ['tools'],
      EQUIPMENT: ['tools', 'materials', 'spare_parts'],
      MATERIAL: ['materials'],
      SPARE_PART: ['spare_parts'],
      DOCUMENTATION: ['knowledge', 'evidence_sources'],
      TRAINING: ['training_programs'],
      WORKSHOP: ['workshops'],
      INSTITUTION: ['organizations'],
      BIOLOGICAL: [],
      ENERGY: ['energy_sources'],
      FALLBACK_CAPABILITY: ['capabilities']
    };
    var FORBIDDEN14 = ['phone', 'email', 'street_address', 'address',
      'contact', 'messaging_handle', 'whatsapp', 'telegram',
      'score', 'ranking', 'rating', 'resilience',
      'resilience_score', 'reserve_score', 'continuity_score',
      'plan_score', 'risk', 'risk_score', 'probability',
      'failure_probability', 'percentage', 'battery',
      'battery_percentage', 'maturity', 'quality', 'popularity',
      'demand', 'intervention_id', 'pilot_project_id', 'listing_id',
      'measurement_id', 'indicator_id', 'auto_created',
      'auto_generated'];

    function vocabErr14(coll, id, field, list, value, label) {
      if (list.indexOf(value) === -1) {
        refErrors.push(coll + ' ' + id + ' -> invalid ' + field +
          ' ' + value + ' (frozen ' + label + ' vocabulary)');
      }
    }
    function forbiddenErr14(coll, r) {
      FORBIDDEN14.forEach(function (bad) {
        if (r[bad] !== undefined) {
          refErrors.push(coll + ' ' + r.id + ' -> field "' + bad +
            '" is forbidden on a Stage 14 record (structural ' +
            'privacy/boundary pin, authorization §3/§28/§37)');
        }
      });
    }
    /* Actor resolution against the LOCAL roster (Stage 13 D1-B
     * lesson, permanent authorization §24): a name string is
     * never authority. */
    function rosterRoles14(name, perm) {
      var roster = (current.collections.users || []).filter(
        function (u) { return u && u.name === name; });
      if (!roster.length) { return null; }
      var roles = (SCA.rbac && SCA.rbac.rolesFor) ?
        SCA.rbac.rolesFor(perm) : [];
      if (!roster.some(function (u) {
        return roles.indexOf(u.role) !== -1; })) { return false; }
      return true;
    }
    /* Review provenance for a post-review Stage 14 state: a
     * distinct reviewer with real local reserve.review authority,
     * a documented reason and a timestamp (authorization §24). */
    function reviewProvenance14(coll, r, label) {
      if (!r.reviewer || !r.reviewed_at) {
        refErrors.push(coll + ' ' + r.id + ' -> a ' + label +
          ' import requires a reviewer and review timestamp (an ' +
          'import never manufactures review)');
        return;
      }
      if (!r.review_reason ||
        !String(r.review_reason).replace(/^\s+|\s+$/g, '')) {
        refErrors.push(coll + ' ' + r.id + ' -> a ' + label +
          ' import requires a documented review reason');
        return;
      }
      if (r.created_by === r.reviewer) {
        refErrors.push(coll + ' ' + r.id + ' -> creator/reviewer ' +
          'separation violated (creator "' + r.created_by +
          '" appears as their own reviewer)');
        return;
      }
      var rr = rosterRoles14(r.reviewer, 'reserve.review');
      if (rr === null) {
        refErrors.push(coll + ' ' + r.id + ' -> reviewer "' +
          r.reviewer + '" does not resolve to an account on this ' +
          'deployment (a reviewer string is not review authority)');
      } else if (rr === false) {
        refErrors.push(coll + ' ' + r.id + ' -> reviewer "' +
          r.reviewer + '" holds no reserve.review authority');
      }
    }
    /* Custodian requirement for ACTIVE and for every state only
     * reachable through ACTIVE (SUSPENDED): the frozen decision 3
     * foundation (authorization §8). */
    function custodianResolves14(coll, r) {
      if (!r.custodian_organization_id) {
        refErrors.push(coll + ' ' + r.id + ' -> an ACTIVE reserve ' +
          'requires a documented custodian (frozen decision 3: ' +
          'VERIFIED = definition passed review; ACTIVE = ' +
          'documented steward)');
        return;
      }
      var local = SCA.store.get('organizations',
        r.custodian_organization_id);
      var inBundle = (ds.collections.organizations || []).some(
        function (o) { return o && o.id === r.custodian_organization_id; });
      if (!local && !inBundle) {
        refErrors.push(coll + ' ' + r.id + ' -> custodian ' +
          'reference does not resolve: ' +
          r.custodian_organization_id);
      }
    }
    function terminalGuard14(coll, r) {
      var localTerm = null;
      (current.collections[coll] || []).forEach(function (t) {
        if (t && t.id === r.id &&
          (t.status === 'REJECTED' || t.status === 'RETIRED')) {
          localTerm = t;
        }
      });
      if (localTerm && r.status !== localTerm.status) {
        refErrors.push(coll + ' ' + r.id + ' -> a terminal ' +
          localTerm.status + ' record cannot be resurrected as ' +
          r.status + ' through import (terminal history is ' +
          'immutable)');
      }
      return localTerm;
    }
    /* Only-legitimate-path guard (Stage 13 D2.4 lesson): an import
     * may not MANUFACTURE lifecycle history. The legitimate paths
     * into VERIFIED/ACTIVE/SUSPENDED run through SUBMITTED /
     * VERIFIED / ACTIVE respectively; a local record sitting in
     * DRAFT/SUBMITTED may never be jumped ahead. */
    function pathGuard14(coll, r, localStatus) {
      var LEGAL_FROM = {
        VERIFIED: ['SUBMITTED', 'VERIFIED'],
        ACTIVE: ['VERIFIED', 'ACTIVE', 'SUSPENDED'],
        SUSPENDED: ['ACTIVE', 'SUSPENDED']
      };
      var legal = LEGAL_FROM[r.status] || [r.status];
      if (localStatus && legal.indexOf(localStatus) === -1) {
        refErrors.push(coll + ' ' + r.id + ' -> a ' + localStatus +
          ' record cannot be moved to ' + r.status + ' through ' +
          'import (the only legitimate path into ' + r.status +
          ' is ' + legal.join(' -> ') + ')');
      }
    }

    if (ds.collections.capability_reserves) {
      ds.collections.capability_reserves.forEach(function (r) {
        if (!r) { return; }
        vocabErr14('capability_reserves', r.id, 'status',
          RES_STATUSES14, r.status, 'reserve lifecycle');
        forbiddenErr14('capability_reserves', r);
        (r.reserve_types || []).forEach(function (t) {
          vocabErr14('capability_reserves', r.id, 'reserve type',
            RES_TYPES14, t, 'eight-value reserve-type');
        });
        (r.known_gaps || []).forEach(function (g) {
          vocabErr14('capability_reserves', r.id, 'known gap',
            GAPS14, g, 'thirteen-value known-gap');
        });
        var localTerm = terminalGuard14('capability_reserves', r);
        if (localTerm) { return; }
        var localStatus = null;
        (current.collections.capability_reserves || []).forEach(
          function (t) {
            if (t && t.id === r.id) { localStatus = t.status; }
          });
        pathGuard14('capability_reserves', r, localStatus);
        /* Review provenance (authorization §24): VERIFIED and
         * REJECTED are reviewer acts. */
        if (r.status === 'VERIFIED') {
          reviewProvenance14('capability_reserves', r, 'VERIFIED');
        }
        if (r.status === 'REJECTED') {
          if (!r.rejection_reason || !r.rejected_by || !r.rejected_at) {
            refErrors.push('capability_reserves ' + r.id + ' -> a ' +
              'REJECTED reserve requires a rejection reason, ' +
              'actor and timestamp');
          } else {
            reviewProvenance14('capability_reserves', r, 'REJECTED');
            if (r.rejected_by !== r.reviewer) {
              refErrors.push('capability_reserves ' + r.id +
                ' -> the rejecting actor must be the reviewing ' +
                'actor (frozen rejection workflow)');
            }
          }
        }
        /* ACTIVE / SUSPENDED: the reviewer foundation plus the
         * documented custodian (frozen decision 3). The only
         * legitimate path into SUSPENDED is ACTIVE -> SUSPENDED,
         * which by definition passed the ACTIVE gate. */
        if (r.status === 'ACTIVE' || r.status === 'SUSPENDED') {
          reviewProvenance14('capability_reserves', r, r.status);
          custodianResolves14('capability_reserves', r);
        }
        if (r.status === 'RETIRED') {
          if (!r.retirement_reason || !r.retired_by || !r.retired_at) {
            refErrors.push('capability_reserves ' + r.id + ' -> a ' +
              'RETIRED reserve requires a retirement reason, ' +
              'actor and timestamp');
          } else {
            var tR = rosterRoles14(r.retired_by, 'reserve.retire');
            if (tR === null) {
              refErrors.push('capability_reserves ' + r.id +
                ' -> retirement actor "' + r.retired_by + '" does ' +
                'not resolve to an account on this deployment (an ' +
                'actor string is not retirement authority)');
            } else if (tR === false) {
              refErrors.push('capability_reserves ' + r.id +
                ' -> retirement actor "' + r.retired_by + '" ' +
                'holds no reserve.retire authority');
            }
          }
        }
      });
    }

    if (ds.collections.continuity_plans) {
      ds.collections.continuity_plans.forEach(function (r) {
        if (!r) { return; }
        vocabErr14('continuity_plans', r.id, 'status',
          PLAN_STATUSES14, r.status, 'continuity-plan lifecycle');
        forbiddenErr14('continuity_plans', r);
        (r.disruption_scenarios || []).forEach(function (sc) {
          vocabErr14('continuity_plans', r.id, 'disruption scenario',
            SCENARIOS14, sc, 'six-value disruption-scenario');
        });
        (r.known_gaps || []).forEach(function (g) {
          vocabErr14('continuity_plans', r.id, 'known gap',
            GAPS14, g, 'thirteen-value known-gap');
        });
        /* essential_people: structured references only (frozen
         * §5) — never a free-text person inventory. */
        (r.essential_people || []).forEach(function (p) {
          if (!p || typeof p !== 'object' ||
            (p.type !== 'PRACTITIONER' && p.type !== 'APPRENTICE' &&
              p.type !== 'INSTITUTIONAL_ROLE')) {
            refErrors.push('continuity_plans ' + r.id + ' -> ' +
              'essential_people must be structured references ' +
              '(PRACTITIONER / APPRENTICE / INSTITUTIONAL_ROLE; ' +
              'never free-text person inventories)');
          }
        });
        var localTerm = terminalGuard14('continuity_plans', r);
        if (localTerm) { return; }
        var localStatus = null;
        (current.collections.continuity_plans || []).forEach(
          function (t) {
            if (t && t.id === r.id) { localStatus = t.status; }
          });
        /* Plan path guard: REVIEWED only from SUBMITTED/REVIEWED;
         * ACTIVE only from REVIEWED/ACTIVE. */
        var PLAN_LEGAL = { REVIEWED: ['SUBMITTED', 'REVIEWED'],
          ACTIVE: ['REVIEWED', 'ACTIVE'] };
        if (localStatus && PLAN_LEGAL[r.status] &&
          PLAN_LEGAL[r.status].indexOf(localStatus) === -1) {
          refErrors.push('continuity_plans ' + r.id + ' -> a ' +
            localStatus + ' plan cannot be moved to ' + r.status +
            ' through import (manufactured lifecycle history)');
        }
        if (r.status === 'REVIEWED' || r.status === 'ACTIVE') {
          reviewProvenance14('continuity_plans', r, r.status);
        }
        if (r.status === 'REJECTED') {
          if (!r.rejection_reason || !r.rejected_by || !r.rejected_at) {
            refErrors.push('continuity_plans ' + r.id + ' -> a ' +
              'REJECTED plan requires a rejection reason, actor ' +
              'and timestamp');
          } else {
            reviewProvenance14('continuity_plans', r, 'REJECTED');
            if (r.rejected_by !== r.reviewer) {
              refErrors.push('continuity_plans ' + r.id + ' -> the ' +
                'rejecting actor must be the reviewing actor ' +
                '(frozen rejection workflow)');
            }
          }
        }
        if (r.status === 'RETIRED') {
          if (!r.retirement_reason || !r.retired_by || !r.retired_at) {
            refErrors.push('continuity_plans ' + r.id + ' -> a ' +
              'RETIRED plan requires a retirement reason, actor ' +
              'and timestamp');
          } else {
            var ptR = rosterRoles14(r.retired_by, 'reserve.retire');
            if (ptR === null) {
              refErrors.push('continuity_plans ' + r.id + ' -> ' +
                'retirement actor "' + r.retired_by + '" does not ' +
                'resolve to an account on this deployment');
            } else if (ptR === false) {
              refErrors.push('continuity_plans ' + r.id + ' -> ' +
                'retirement actor "' + r.retired_by + '" holds no ' +
                'reserve.retire authority');
            }
          }
        }
      });
    }

    if (ds.collections.capability_assets) {
      ds.collections.capability_assets.forEach(function (a) {
        if (!a) { return; }
        vocabErr14('capability_assets', a.id, 'asset category',
          ASSET_CATS14, a.asset_category,
          'thirteen-value asset-category');
        forbiddenErr14('capability_assets', a);
        var sources = ASSET_SOURCES14[a.asset_category] || [];
        var docOnly = a.asset_category === 'BIOLOGICAL';
        if (!a.reference_type && !a.reference_id) {
          /* Frozen §13 biological documentation-only rule; every
           * other category requires an authoritative reference. */
          if (!docOnly) {
            refErrors.push('capability_assets ' + a.id + ' -> a ' +
              a.asset_category + ' asset requires an ' +
              'authoritative reference (only BIOLOGICAL may be ' +
              'documentation-only where no authoritative ' +
              'biological record exists)');
          }
        } else {
          if (sources.indexOf(a.reference_type) === -1) {
            refErrors.push('capability_assets ' + a.id + ' -> a ' +
              a.asset_category + ' asset must reference one of ' +
              'its authoritative sources: ' +
              (sources.join(', ') || 'none'));
          } else {
            var aLocal = SCA.store.get(a.reference_type,
              a.reference_id);
            var aInBundle = (ds.collections[a.reference_type] || [])
              .some(function (t) {
                return t && t.id === a.reference_id; });
            if (!aLocal && !aInBundle) {
              refErrors.push('capability_assets ' + a.id + ' -> ' +
                'reference does not resolve: ' + a.reference_type +
                ' ' + a.reference_id + ' (Stage 14 never ' +
                'duplicates or creates the referenced record)');
            }
          }
        }
      });
    }
    if (refErrors.length) {
      return { ok: false, errors: [
        'Import rejected: ' + refErrors.length + ' relationship(s) do not resolve ' +
        'in the candidate dataset (neither in this file nor in the current data). ' +
        'Broken references never create a partially valid dataset. Affected: ' +
        refErrors.slice(0, 10).join('; ') + (refErrors.length > 10 ? ' …' : '')
      ] };
    }

    SCA.store.replaceDataset(ds);

    var counts = {};
    Object.keys(ds.collections).forEach(function (c) { counts[c] = ds.collections[c].length; });
    return { ok: true, appliedMigrations: res.applied, counts: counts };
  }

  SCA.transfer = {
    EXPORTABLE: EXPORTABLE,
    REFERENCES: REFERENCES,
    exportCollection: exportCollection,
    exportAll: exportAll,
    parse: parse,
    validateBundle: validateBundle,
    importBundle: importBundle
  };
})(SCA);
