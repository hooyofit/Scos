/*
 * Local data store (offline-first).
 * Application code reaches the data ONLY through this API; it never touches
 * the storage adapter directly (Stage 1.1 rule).
 * All collections live in one versioned dataset persisted through
 * SCA._storage. This is a SEAM: the public API below (all/get/count/
 * insert/update/remove/dataset/replaceDataset) is what a future hosted
 * backend adapter will implement instead.
 */
(function (SCA) {
  'use strict';
  var KEY = SCA.config.dataset_key;
  var COLLECTIONS = ['users', 'families', 'capabilities', 'practitioners',
    'evidence', 'locations', 'apprentices', 'knowledge',
    'claims', 'consents', 'audit_log',
    'research_projects', 'research_sessions', 'observations', 'field_notes',
    'participants', 'field_media', 'research_queue',
    'organizations', 'apprenticeships', 'competence_assessments',
    'training_programs', 'capability_certifications',
    'census_methodologies', 'capability_censuses', 'census_observations',
    'census_snapshots', 'geographic_redundancies',
    'graph_edges', 'workshops', 'resources', 'materials', 'tools',
    'energy_sources', 'failure_scenarios',
    'repair_capabilities', 'spare_parts', 'repair_records',
    'recovery_profiles', 'capability_interventions',
    'pilot_projects', 'measurements', 'indicators',
    'marketplace_listings',
    /* Stage 14: National Capability Reserve & Institutional
       Continuity. Exactly three new domain collections (frozen
       scope v1.1): capability_reserves, continuity_plans,
       capability_assets. No shadow collections exist. */
    'capability_reserves', 'continuity_plans', 'capability_assets'];
  var data = null;
  var listeners = [];

  function emptyDataset() {
    var d = { schema_version: SCA.SCHEMA_VERSION, collections: {} };
    COLLECTIONS.forEach(function (c) { d.collections[c] = []; });
    return d;
  }

  function persist() {
    SCA._storage.set(KEY, data);
    emit();
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(data); } catch (e) { /* listener errors must not break the store */ }
    });
  }

  function ready() { if (!data) { init(); } }

  function init() {
    var loaded = SCA._storage.get(KEY, null);
    if (loaded && loaded.collections) {
      var res = SCA.migrations.migrate(loaded);
      data = res.dataset;
      COLLECTIONS.forEach(function (c) {
        if (!data.collections[c]) { data.collections[c] = []; }
      });
    } else {
      data = emptyDataset();
    }

    /* Seed the 12 capability families on first run. Families are real
       project structure, not fabricated data. */
    var seed = (typeof SCA_seed !== 'undefined') ? SCA_seed : null;
    if (seed && seed.families && data.collections.families.length === 0) {
      seed.families.forEach(function (f) {
        data.collections.families.push(Object.assign({
          /* Codes are permanent identifiers (see data/families.js), so ids
             are deterministic: a fresh install generates the SAME ids, and
             exports/packages remain portable across devices (Stage 4). */
          id: 'fam-' + f.code,
          created_at: SCA.util.now(),
          updated_at: SCA.util.now()
        }, f));
      });
      persist();
    }

    /* Seed the 240-capability research inventory (Stage 2 baseline).
       Inventory records only: a record means the capability has been
       identified as a research subject, NOT that it is verified, practiced,
       universal or recommended. Conservative defaults, no evidence.
       Enum note: the Stage 2 spec's "Not yet documented" living_status maps
       to enum S0 (Unknown); its "S0" capability_maturity maps to null,
       which displays as Not yet documented. This keeps the Stage 1 evidence
       enums intact (documented decision, see completion report). */
    if (data.collections.capabilities.length === 0 &&
        typeof SCA_capabilities_seed !== 'undefined') {
      var byCode = {};
      data.collections.families.forEach(function (f) { byCode[f.code] = f.id; });
      var defaults = {
        historical_status: 'Not yet verified',
        living_status: 'S0',
        evidence_level: 'E0',
        verification_status: 'Unverified',
        regions: [], practitioners: [], apprentices: [], knowledge_holders: [],
        materials: [], tools: [], dependencies: [],
        modern_equivalent: null, fallback: null, failure_scenarios: [],
        recovery_time: null, recovery_difficulty: null,
        repair_radius: null, recovery_radius: null,
        economic_role: null, environmental_role: null, knowledge_role: null,
        criticality: null, centrality: null, external_dependency: null,
        knowledge_concentration: null, reproducibility: null,
        fallback_value: null, graph_leverage: null, irreplaceability: null,
        preservation_urgency: null, priority_flags: [], action: null,
        documentation_status: 'Inventory record only',
        transmission_status: 'Not yet documented',
        capability_maturity: null,
        reproduction_pathway: null, stewardship_notes: null,
        safety_notes: null, limitations: null,
        source_ids: [], reviewer: null, reviewed_at: null,
        region: null, version: '1'
      };
      var now = SCA.util.now();
      var inserted = 0;
      SCA_capabilities_seed.capabilities.forEach(function (c) {
        var familyId = byCode[c.family_code];
        if (!familyId) { throw new Error('Inventory family not found: ' + c.family_code); }
        var rec = {
          id: 'cap-' + c.code,
          code: c.code,
          name: c.name,
          family_id: familyId,
          short_description: c.short_description,
          created_at: now,
          updated_at: now
        };
        Object.keys(defaults).forEach(function (k) { rec[k] = defaults[k]; });
        var v = SCA.models.capability.validate(rec);
        if (!v.valid) { throw new Error('Inventory record invalid: ' + c.code); }
        data.collections.capabilities.push(rec);
        inserted++;
      });
      if (inserted !== 240) {
        throw new Error('Inventory seed count is not 240: ' + inserted);
    }
    /* Stage 12: seed the 23 FROZEN indicator DEFINITIONS (the
       authorized Stage 12 vocabulary) when the collection is empty.
       Definitions only — the production baseline contains ZERO
       measurements (authorization §34). */
    if (SCA.indicator && SCA.indicator.seedDefinitions &&
        data.collections.indicators &&
        data.collections.indicators.length === 0) {
      SCA.indicator.seedDefinitions();
      }
      persist();
    }
    return data;
  }

  function all(name) {
    ready();
    if (COLLECTIONS.indexOf(name) === -1) { throw new Error('Unknown collection: ' + name); }
    return (data.collections[name] || []).slice();
  }

  function get(name, id) {
    var found = null;
    all(name).forEach(function (r) { if (r.id === id) { found = r; } });
    return found;
  }

  function count(name) { return all(name).length; }

  function insert(name, record) {
    ready();
    var rec = Object.assign({}, record);
    rec.id = rec.id || SCA.util.uuid();
    rec.created_at = rec.created_at || SCA.util.now();
    /* Preserve provided updated_at (imported records keep their provenance
       timestamps; only genuinely new records get "now"). Stage 4 fix. */
    rec.updated_at = rec.updated_at || SCA.util.now();

    /* Model validation, when a model exists for the collection. */
    var model = SCA.models && SCA.models[name];
    if (model && model.validate) {
      var v = model.validate(rec);
      if (!v.valid) { return { ok: false, errors: v.errors }; }
    }

    /* Referential integrity for capabilities -> families. */
    if (name === 'capabilities' && !get('families', rec.family_id)) {
      return { ok: false, errors: { family_id: 'Referenced family does not exist.' } };
    }

    data.collections[name].push(rec);
    persist();
    return { ok: true, record: rec };
  }

  /* Stage 6: published census snapshots are immutable history. A later
   * census produces a NEW snapshot; history is never rewritten. */
  var IMMUTABLE_PUBLISHED = { census_snapshots: 'PUBLISHED' };

  function update(name, id, patch) {
    ready();
    var rec = get(name, id);
    if (!rec) { return { ok: false, errors: { id: 'Record not found.' } }; }
    if (IMMUTABLE_PUBLISHED[name] && rec.status === IMMUTABLE_PUBLISHED[name]) {
      return { ok: false,
        errors: { status: 'Published snapshots are immutable and cannot be changed. ' +
          'Generate a new snapshot instead.' } };
    }
    var next = Object.assign({}, rec, patch);
    next.id = id;
    next.updated_at = SCA.util.now();
    var model = SCA.models && SCA.models[name];
    if (model && model.validate) {
      var v = model.validate(next);
      if (!v.valid) { return { ok: false, errors: v.errors }; }
    }
    data.collections[name] = data.collections[name].map(function (r) {
      return r.id === id ? next : r;
    });
    persist();
    return { ok: true, record: next };
  }

  function remove(name, id) {
    ready();
    var rec = get(name, id);
    if (rec && IMMUTABLE_PUBLISHED[name] &&
      rec.status === IMMUTABLE_PUBLISHED[name]) {
      return { ok: false,
        errors: { status: 'Published snapshots are immutable and cannot be deleted.' } };
    }
    data.collections[name] = data.collections[name].filter(function (r) { return r.id !== id; });
    persist();
    return { ok: true };
  }

  function dataset() {
    ready();
    return SCA.util.clone(data);
  }

  function replaceDataset(ds) {
    data = ds || emptyDataset();
    COLLECTIONS.forEach(function (c) { if (!data.collections[c]) { data.collections[c] = []; } });
    persist();
  }

  function subscribe(fn) { if (typeof fn === 'function') { listeners.push(fn); } }

  function wipe() { data = emptyDataset(); persist(); }

  SCA.store = {
    COLLECTIONS: COLLECTIONS,
    init: init,
    all: all,
    get: get,
    count: count,
    insert: insert,
    update: update,
    remove: remove,
    dataset: dataset,
    replaceDataset: replaceDataset,
    subscribe: subscribe,
    wipe: wipe
  };
})(SCA);
