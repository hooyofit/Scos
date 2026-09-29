/*
 * Graph registry (Stage 7): node types and the relationship validation
 * vocabulary. ONE central registry — the workflow, the UI, the import
 * checker and the tests all consult it; validation rules are never
 * scattered in page code.
 *
 * Canonical identity: an edge references source_type + source_id and
 * target_type + target_id — never names. Node types map to canonical
 * SCOS collections; the graph never duplicates entities into
 * graph-specific copies.
 *
 * Direction matters: every relationship type defines an allowed source
 * node type set and an allowed target node type set. A reversed edge is
 * a DIFFERENT relationship and must be entered explicitly; nothing
 * silently reverses direction.
 *
 * «No relationship documented» never means «no relationship exists.»
 * The registry defines what may be REPRESENTED, not what is true.
 */
(function (SCA) {
  'use strict';

  /* ---------- node types -> canonical collections ---------- */
  var NODE_TYPES = {
    CAPABILITY: { collection: 'capabilities', label: 'Capability' },
    PRACTITIONER: { collection: 'practitioners', label: 'Practitioner' },
    APPRENTICE: { collection: 'apprentices', label: 'Apprentice' },
    ORGANIZATION: { collection: 'organizations', label: 'Organization / Institution' },
    WORKSHOP: { collection: 'workshops', label: 'Workshop' },
    LOCATION: { collection: 'locations', label: 'Location' },
    RESOURCE: { collection: 'resources', label: 'Resource' },
    MATERIAL: { collection: 'materials', label: 'Material' },
    TOOL: { collection: 'tools', label: 'Tool / Equipment' },
    ENERGY_SOURCE: { collection: 'energy_sources', label: 'Energy Source' },
    TRAINING_PROGRAM: { collection: 'training_programs', label: 'Training Program' },
    KNOWLEDGE_ARTIFACT: { collection: 'knowledge', label: 'Knowledge Artifact' },
    EVIDENCE_SOURCE: { collection: 'evidence', label: 'Evidence Source' },
    FAILURE_SCENARIO: { collection: 'failure_scenarios', label: 'Failure Scenario' }
  };

  /* Person node types get person-level privacy filtering in traversal. */
  var PERSON_NODE_TYPES = ['PRACTITIONER', 'APPRENTICE'];

  /* ---------- relationship vocabulary ----------
   * The frozen 20-type vocabulary. Each entry: what it MEANS, which node
   * types may be the source, which may be the target, and the
   * neighborhood category. If a relationship is not semantically
   * appropriate, it is REJECTED — no approximate relationships. */
  var RELATIONSHIPS = {
    DEPENDS_ON: {
      label: 'Depends on',
      meaning: 'Source depends operationally on target.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION',
        'TRAINING_PROGRAM'],
      target_types: ['CAPABILITY', 'RESOURCE', 'MATERIAL', 'TOOL',
        'ENERGY_SOURCE', 'ORGANIZATION', 'LOCATION', 'WORKSHOP'],
      category: 'dependency'
    },
    SUPPORTS: {
      label: 'Supports',
      meaning: 'Target contributes to the successful operation of the ' +
        'source or its system.',
      source_types: ['CAPABILITY', 'PRACTITIONER', 'WORKSHOP',
        'ORGANIZATION', 'TRAINING_PROGRAM'],
      target_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION'],
      category: 'support'
    },
    ENABLES: {
      label: 'Enables',
      meaning: 'Source makes the target capability possible.',
      source_types: ['CAPABILITY', 'RESOURCE', 'TOOL', 'ENERGY_SOURCE',
        'MATERIAL', 'ORGANIZATION'],
      target_types: ['CAPABILITY'],
      category: 'support'
    },
    REQUIRES: {
      meaning: 'Source requires target under defined operating conditions.',
      label: 'Requires',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION',
        'TRAINING_PROGRAM'],
      target_types: ['CAPABILITY', 'RESOURCE', 'MATERIAL', 'TOOL',
        'ENERGY_SOURCE', 'ORGANIZATION', 'PRACTITIONER'],
      category: 'dependency'
    },
    MAINTAINS: {
      label: 'Maintains',
      meaning: 'Source actor/capability maintains the target system.',
      source_types: ['PRACTITIONER', 'WORKSHOP', 'CAPABILITY',
        'ORGANIZATION'],
      target_types: ['CAPABILITY', 'TOOL', 'WORKSHOP', 'ENERGY_SOURCE'],
      category: 'maintenance'
    },
    REPAIRS: {
      label: 'Repairs',
      meaning: 'Source actor/capability repairs the target.',
      source_types: ['PRACTITIONER', 'WORKSHOP', 'CAPABILITY',
        'ORGANIZATION'],
      target_types: ['CAPABILITY', 'TOOL', 'WORKSHOP'],
      category: 'maintenance'
    },
    PRODUCES: {
      label: 'Produces',
      meaning: 'Source produces the target (output, good, or capability).',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION',
        'PRACTITIONER'],
      target_types: ['RESOURCE', 'MATERIAL', 'CAPABILITY'],
      category: 'production'
    },
    TEACHES: {
      label: 'Teaches',
      meaning: 'Source practitioner/program/capability teaches the target ' +
        'capability or apprentice.',
      source_types: ['PRACTITIONER', 'TRAINING_PROGRAM', 'CAPABILITY',
        'ORGANIZATION'],
      target_types: ['CAPABILITY', 'APPRENTICE'],
      category: 'training'
    },
    LOCATED_IN: {
      label: 'Located in',
      meaning: 'Source is located in the target location (locations may ' +
        'nest within locations).',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION',
        'PRACTITIONER', 'LOCATION'],
      target_types: ['LOCATION'],
      category: 'location'
    },
    EVIDENCED_BY: {
      label: 'Evidenced by',
      meaning: 'The relationship/source is evidenced by the target ' +
        'evidence source or knowledge artifact.',
      source_types: ['CAPABILITY', 'PRACTITIONER', 'WORKSHOP',
        'ORGANIZATION'],
      target_types: ['EVIDENCE_SOURCE', 'KNOWLEDGE_ARTIFACT'],
      category: 'evidence'
    },
    DOCUMENTED_IN: {
      label: 'Documented in',
      meaning: 'The relationship/source is documented in the target ' +
        'evidence source or knowledge artifact.',
      source_types: ['CAPABILITY', 'PRACTITIONER', 'WORKSHOP',
        'ORGANIZATION'],
      target_types: ['EVIDENCE_SOURCE', 'KNOWLEDGE_ARTIFACT'],
      category: 'evidence'
    },
    FALLS_BACK_TO: {
      label: 'Falls back to',
      meaning: 'Source has a documented fallback pathway to the target ' +
        '(lower-tech, traditional, or emergency alternative).',
      source_types: ['CAPABILITY', 'WORKSHOP'],
      target_types: ['CAPABILITY'],
      category: 'fallback'
    },
    FAILS_UNDER: {
      label: 'Fails under',
      meaning: 'Source has a documented failure relationship with the ' +
        'target failure scenario.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'TOOL', 'ENERGY_SOURCE'],
      target_types: ['FAILURE_SCENARIO'],
      category: 'failure'
    },
    RECOVERED_BY: {
      label: 'Recovered by',
      meaning: 'A documented recovery pathway for the source exists ' +
        'through the target.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'TOOL'],
      target_types: ['CAPABILITY', 'PRACTITIONER', 'WORKSHOP'],
      category: 'failure'
    },
    MODERNIZED_BY: {
      label: 'Modernized by',
      meaning: 'A documented modernization pathway for the source exists ' +
        'through the target capability or tool.',
      source_types: ['CAPABILITY'],
      target_types: ['CAPABILITY', 'TOOL'],
      category: 'modernization'
    },
    REPRODUCES: {
      label: 'Reproduces',
      meaning: 'The source capability/system/program reproduces the ' +
        'target capability (knowledge transmission, manufacture, or ' +
        'training outcome).',
      source_types: ['CAPABILITY', 'TRAINING_PROGRAM', 'WORKSHOP',
        'ORGANIZATION'],
      target_types: ['CAPABILITY'],
      category: 'reproduction'
    },
    USES_RESOURCE: {
      label: 'Uses resource',
      meaning: 'Source uses the target resource.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION'],
      target_types: ['RESOURCE'],
      category: 'resource'
    },
    USES_ENERGY: {
      label: 'Uses energy',
      meaning: 'Source uses the target energy source.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'ORGANIZATION'],
      target_types: ['ENERGY_SOURCE'],
      category: 'energy'
    },
    REQUIRES_INSTITUTION: {
      label: 'Requires institution',
      meaning: 'Source requires the target institution to operate.',
      source_types: ['CAPABILITY', 'WORKSHOP', 'TRAINING_PROGRAM'],
      target_types: ['ORGANIZATION'],
      category: 'institution'
    }
  };

  /* Relationship types that express "the source NEEDS the target" —
   * used by dependencies()/dependents() and the dependency-chain view. */
  var DEPENDENCY_TYPES = ['DEPENDS_ON', 'REQUIRES', 'USES_RESOURCE',
    'USES_ENERGY', 'REQUIRES_INSTITUTION'];

  /* ---------- validation ---------- */
  function nodeTypeExists(t) {
    return !!NODE_TYPES[t];
  }

  function collectionFor(nodeType) {
    return NODE_TYPES[nodeType] ? NODE_TYPES[nodeType].collection : null;
  }

  /* Validate type + direction against the vocabulary. Rejects rather
   * than approximating. Returns { ok, errors }. */
  function validateRelationship(type, sourceType, targetType) {
    var errors = {};
    var rel = RELATIONSHIPS[type];
    if (!rel) {
      errors.relationship_type = 'Unknown relationship type: "' + type +
        '". Use one of the ' + Object.keys(RELATIONSHIPS).length +
        ' documented types.';
      return { ok: false, errors: errors };
    }
    if (!nodeTypeExists(sourceType)) {
      errors.source_type = 'Unknown node type: "' + sourceType + '".';
    }
    if (!nodeTypeExists(targetType)) {
      errors.target_type = 'Unknown node type: "' + targetType + '".';
    }
    if (errors.source_type || errors.target_type) {
      return { ok: false, errors: errors };
    }
    /* Direction is part of the semantics: source and target type sets
     * are NOT interchangeable. */
    if (rel.source_types.indexOf(sourceType) === -1) {
      errors.source_type = '"' + type + '" does not allow a ' + sourceType +
        ' source. Allowed source types: ' + rel.source_types.join(', ') + '.';
    }
    if (rel.target_types.indexOf(targetType) === -1) {
      errors.target_type = '"' + type + '" does not allow a ' + targetType +
        ' target. Allowed target types: ' + rel.target_types.join(', ') + '.';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /* Self-reference: a node cannot relate to itself. Documented
   * semantics: rejected for every relationship type. (LOCATED_IN may
   * still connect two DIFFERENT locations — nesting is not
   * self-reference.) */
  function isSelfReference(sourceType, sourceId, targetType, targetId) {
    return sourceType === targetType && sourceId === targetId;
  }

  SCA.graphRegistry = {
    NODE_TYPES: NODE_TYPES,
    PERSON_NODE_TYPES: PERSON_NODE_TYPES,
    RELATIONSHIPS: RELATIONSHIPS,
    DEPENDENCY_TYPES: DEPENDENCY_TYPES,
    nodeTypeExists: nodeTypeExists,
    collectionFor: collectionFor,
    validateRelationship: validateRelationship,
    isSelfReference: isSelfReference
  };
})(SCA);
