/*
 * Scenario analysis engine (Stage 15: Capability Scenario
 * Analysis Foundation, frozen scope v1.1 §1–§32 + amendments
 * A1–A9, Gate C implementation authorization).
 *
 * ARCHITECTURE — a pure read/derived layer. ZERO persistent
 * domain entities, ZERO new collections, ZERO new permissions,
 * ZERO new graph relationship types, ZERO writes. Every analyze()
 * call is a transient composition over the frozen Stage 1–14
 * authorities; nothing is ever stored.
 *
 * Authorities consumed (never modified):
 *  - Stage 7 graph: SCA.graph edges/nodes (19 frozen types);
 *  - Stage 8: SCA.repair FailureScenario + repair capability
 *    search;
 *  - Stage 9: SCA.recovery failureImpact / activeProfilesFor /
 *    fallbackReadiness views;
 *  - Stage 5: SCA.training reproductionProfile (count-only for
 *    anonymous users by its own frozen rules);
 *  - Stage 10/11: SCA.intervention / SCA.pilots search
 *    (public-status-filtered by their own rules);
 *  - Stage 12: read-only display of defined indicators via the
 *    frozen Observatory — the engine never creates or computes
 *    indicator values;
 *  - Stage 13: SCA.marketplace list (PUBLISHED only by its own
 *    rules);
 *  - Stage 14: SCA.reserve list / plans / onePersonTest /
 *    threeGenerationTest / continuityForCapability derived views.
 *
 * Frozen pins honored here:
 *  - A2 evidence vocabulary DOCUMENTED / DERIVED / UNKNOWN /
 *    NOT_APPLICABLE; DERIVED = Stage 9 GRAPH_DERIVED semantics;
 *    absence of documentation is never proof of absence.
 *  - A3 traversal uses ONLY edges with status DOCUMENTED or
 *    VERIFIED (frozen Stage 9 precedent). PROPOSED edges may
 *    appear as explicitly unverified context; REJECTED and
 *    SUPERSEDED are excluded entirely.
 *  - A4 per-type interpretation map (all 19 types, no
 *    interpretation outside this map).
 *  - A6 depth default 2, maximum 5, node cap 500, cycle-safe,
 *    deterministic ordering.
 *  - A7 anonymous outputs are count-only with census
 *    carry-forward wording; person nodes never render by name.
 *  - §8/§9 no probability, no score, no ranking, no prediction.
 *  - §24 no scenario.* permission exists; underlying reads apply
 *    their own authority.
 */
(function (SCA) {
  'use strict';

  /* ---------- frozen vocabulary (exported for tests/pages) ---------- */

  var DEFAULT_DEPTH = 2;
  var MAX_DEPTH = 5;
  var NODE_CAP = 500;
  var MAX_COMPARE = 6;

  /* A2: evidence bases. DERIVED mirrors the frozen Stage 9
   * GRAPH_DERIVED semantics: mechanically derived from documented
   * records, every derivation traceable to its source edge. */
  var EVIDENCE_BASES = ['DOCUMENTED', 'DERIVED', 'UNKNOWN',
    'NOT_APPLICABLE'];

  /* A4: per-type interpretation map. Exactly the 19 frozen
   * relationship types; any other type is an error, never an
   * improvised interpretation. */
  var CASCADE_REVERSE = ['DEPENDS_ON', 'REQUIRES', 'USES_RESOURCE',
    'USES_ENERGY', 'REQUIRES_INSTITUTION'];
  var CASCADE_FORWARD = ['SUPPORTS', 'ENABLES', 'MAINTAINS',
    'PRODUCES'];
  var RECOVERY_DISPLAY = ['FALLS_BACK_TO', 'RECOVERED_BY',
    'MODERNIZED_BY', 'REPAIRS', 'FAILS_UNDER'];
  var REPRODUCTION_DISPLAY = ['TEACHES', 'REPRODUCES'];
  var EXCLUDED_TYPES = ['LOCATED_IN', 'EVIDENCED_BY', 'DOCUMENTED_IN'];

  var DIRECTION_MAP = {};
  CASCADE_REVERSE.forEach(function (t) {
    DIRECTION_MAP[t] = { section: 'CASCADE', direction: 'REVERSE' };
  });
  CASCADE_FORWARD.forEach(function (t) {
    DIRECTION_MAP[t] = { section: 'CASCADE', direction: 'FORWARD' };
  });
  RECOVERY_DISPLAY.forEach(function (t) {
    DIRECTION_MAP[t] = { section: 'RECOVERY', direction: 'FORWARD' };
  });
  REPRODUCTION_DISPLAY.forEach(function (t) {
    DIRECTION_MAP[t] = { section: 'REPRODUCTION', direction: 'FORWARD' };
  });
  EXCLUDED_TYPES.forEach(function (t) {
    DIRECTION_MAP[t] = { section: 'NONE', direction: null };
  });

  /* A3: the only edge statuses traversal reads. */
  var TRAVERSABLE_STATUSES = ['DOCUMENTED', 'VERIFIED'];

  var SCENARIO_KINDS = ['DISRUPTION', 'FAILURE_SCENARIO'];

  /* Registered routes used for source traceability links (§21).
   * Types without a registered detail route render label-only. */
  var LINK_ROUTES = {
    CAPABILITY: '#/capabilities/',
    PRACTITIONER: '#/practitioner/',
    APPRENTICE: '#/apprentice/',
    WORKSHOP: '#/workshop/',
    TRAINING_PROGRAM: '#/training/',
    KNOWLEDGE_ARTIFACT: '#/knowledge/',
    EVIDENCE_SOURCE: '#/evidence/',
    FAILURE_SCENARIO: null,
    ORGANIZATION: null,
    LOCATION: null,
    RESOURCE: null,
    MATERIAL: null,
    TOOL: null,
    ENERGY_SOURCE: null
  };

  /* ---------- helpers ---------- */

  function key(n) { return n.type + '|' + n.id; }

  function label(node) {
    var rec = SCA.graph.nodeRecord(node) || {};
    return rec.name || rec.public_name || rec.title ||
      rec.display_name || (node.type + ' ' + node.id);
  }

  function linkFor(node) {
    var base = LINK_ROUTES[node.type];
    return base ? (base + node.id) : null;
  }

  function nodeRef(node) {
    return {
      node_type: node.type,
      node_id: node.id,
      node_label: label(node),
      link: linkFor(node)
    };
  }

  function edgesForUser(user, types, direction, node) {
    /* Reads through the frozen Stage 7 API: node visibility,
     * privacy and the A3 status filter all apply. */
    var opts = { statuses: TRAVERSABLE_STATUSES.slice(),
      relationship_types: types.slice() };
    var steps = (direction === 'REVERSE') ?
      SCA.graph.incoming(user, node, opts) :
      SCA.graph.outgoing(user, node, opts);
    return (steps || []).filter(function (s) {
      var st = s.edge ? s.edge.status : null;
      return st === 'DOCUMENTED' || st === 'VERIFIED';
    });
  }

  function capabilitiesOf(nodes) {
    return nodes.filter(function (n) { return n.type === 'CAPABILITY'; });
  }

  function emptySection() {
    return { documented_count: 0, derived_count: 0,
      unknown_count: 0, note: null };
  }

  function unknownNote(text) {
    return { basis: 'UNKNOWN', text: text };
  }

  /* ---------- validation ---------- */

  function disruptionCodes() {
    return (SCA.enums.disruption_scenarios || []).map(function (s) {
      return s.code;
    });
  }

  function disruptionLabel(code) {
    var hit = (SCA.enums.disruption_scenarios || []).filter(function (s) {
      return s.code === code;
    })[0];
    return hit ? hit.label : code;
  }

  function validateRequest(user, request) {
    request = request || {};
    var errors = {};

    if (SCENARIO_KINDS.indexOf(request.scenario_kind) === -1) {
      errors.scenario_kind = 'scenario_kind must be one of: ' +
        SCENARIO_KINDS.join(', ') + '.';
      return { ok: false, errors: errors };
    }

    if (request.scenario_kind === 'DISRUPTION') {
      if (disruptionCodes().indexOf(request.disruption_code) === -1) {
        errors.disruption_code = 'Unknown disruption scenario ' +
          'code. The frozen Stage 14 vocabulary is: ' +
          disruptionCodes().join(', ') + '.';
      }
    } else {
      var fs = request.failure_scenario_id ?
        SCA.store.get('failure_scenarios',
          request.failure_scenario_id) : null;
      if (!fs) {
        errors.failure_scenario_id = 'Unknown Stage 8 ' +
          'FailureScenario: ' + (request.failure_scenario_id ||
            '(missing)') + '.';
      }
    }

    /* Subject: any canonical node type, resolved through the
     * frozen graph API (existence + visibility enforced there —
     * person nodes are refused for anonymous users). */
    var subject = { type: request.subject_type,
      id: request.subject_id };
    var resolved = SCA.graph.node(user, subject.type, subject.id);
    if (!resolved.ok) {
      errors.subject = 'Subject must be a visible canonical ' +
        'record: ' + JSON.stringify(resolved.errors || {}) + '.';
    }

    var depth = request.depth;
    if (depth !== undefined && depth !== null) {
      depth = Math.floor(Number(depth));
      if (isNaN(depth) || depth < 1 || depth > MAX_DEPTH) {
        errors.depth = 'depth must be between 1 and ' + MAX_DEPTH +
          ' (default ' + DEFAULT_DEPTH + ').';
      }
    }

    var locations = request.location_ids;
    if (locations !== undefined && locations !== null) {
      if (Object.prototype.toString.call(locations) !== '[object Array]') {
        errors.location_ids = 'location_ids must be an array of ' +
          'canonical location ids.';
      } else {
        var bad = locations.filter(function (l) {
          return !SCA.store.get('locations', l);
        });
        if (bad.length) {
          errors.location_ids = 'Unknown location reference(s): ' +
            bad.join(', ') + '.';
        }
      }
    }

    if (request.mode !== undefined && request.mode !== null &&
      request.mode !== 'STRUCTURE') {
      errors.mode = "The only supported analysis mode is 'STRUCTURE'.";
    }

    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    return { ok: true, subject: { type: resolved.record ?
      request.subject_type : request.subject_type,
      id: request.subject_id, record: resolved.record },
      depth: (depth === undefined || depth === null) ?
        DEFAULT_DEPTH : depth,
      location_ids: locations || null };
  }

  /* ---------- cascade traversal (the ONLY new derivation) ---------- */

  function cascade(user, subject, depth, locationIds) {
    /* Breadth-first, cycle-safe (visited set), depth-bounded,
     * node-capped, deterministic (neighbors sorted by label then
     * id). Direction per the frozen A4 map: reverse cascade types
     * follow incoming edges (dependents of the failed node),
     * forward cascade types follow outgoing edges
     * (beneficiaries of the failed node). */
    var visited = {};
    var visitedList = [];
    var queue = [{ node: subject, depth: 0, path: [],
      basis: 'DOCUMENTED' }];
    visited[key(subject)] = true;
    var capped = false;

    while (queue.length) {
      var current = queue.shift();
      if (current.depth >= depth) { continue; }

      var neighbors = [];
      CASCADE_REVERSE.forEach(function (t) {
        edgesForUser(user, [t], 'REVERSE', current.node)
          .forEach(function (s) { neighbors.push({ n: s.source,
            via: t, edge: s.edge }); });
      });
      CASCADE_FORWARD.forEach(function (t) {
        edgesForUser(user, [t], 'FORWARD', current.node)
          .forEach(function (s) { neighbors.push({ n: s.target,
            via: t, edge: s.edge }); });
      });

      neighbors.sort(function (a, b) {
        return String(label(a.n)).localeCompare(String(label(b.n))) ||
          String(a.n.id).localeCompare(String(b.n.id)) ||
          a.via.localeCompare(b.via);
      });

      neighbors.forEach(function (nb) {
        if (visited[key(nb.n)]) { return; }
        if (visitedList.length >= NODE_CAP) { capped = true; return; }
        visited[key(nb.n)] = true;
        /* A2 basis: a depth-1 connection is a documented
         * dependency edge (DOCUMENTED); a deeper connection is
         * mechanically derived through documented edges
         * (DERIVED, Stage 9 GRAPH_DERIVED semantics). */
        var basis = current.depth === 0 ? 'DOCUMENTED' : 'DERIVED';
        var step = {
          node_type: nb.n.type,
          node_id: nb.n.id,
          node_label: label(nb.n),
          link: linkFor(nb.n),
          depth: current.depth + 1,
          basis: basis,
          via_relationship: nb.via,
          via_edge_status: nb.edge ? nb.edge.status : null,
          via_edge_id: nb.edge ? nb.edge.id : null,
          path: current.path.concat([{
            node_type: current.node.type,
            node_id: current.node.id,
            node_label: label(current.node),
            via: nb.via,
            edge_status: nb.edge ? nb.edge.status : null
          }])
        };
        var entry = { node: nb.n, depth: step.depth,
          path: step.path, basis: basis };
        visitedList.push(step);
        queue.push(entry);
      });
    }

    visitedList.sort(function (a, b) {
      return a.depth - b.depth ||
        String(a.node_label).localeCompare(String(b.node_label)) ||
        String(a.node_id).localeCompare(String(b.node_id));
    });

    return { steps: visitedList, capped: capped,
      cap: NODE_CAP, location_scope: locationIds };
  }

  /* ---------- directly connected records ---------- */

  function directConnections(user, subject) {
    var out = [];
    Object.keys(DIRECTION_MAP).forEach(function (t) {
      var m = DIRECTION_MAP[t];
      if (m.section === 'NONE') { return; }
      /* Direct connections display BOTH directions of the edge:
       * the direction map governs CASCADE traversal, but an edge
       * pointing INTO the subject (e.g. TEACHES from a
       * practitioner, per Stage 5 privacy rules) is still a
       * documented direct connection. */
      ['REVERSE', 'FORWARD'].forEach(function (dir) {
        var steps = edgesForUser(user, [t], dir, subject);
        steps.forEach(function (s) {
          var other = (dir === 'REVERSE') ? s.source : s.target;
          out.push({
            relationship_type: t,
            section: m.section,
            subject_side: (dir === 'REVERSE') ? 'TARGET' : 'SOURCE',
            edge_status: s.edge ? s.edge.status : null,
            edge_id: s.edge ? s.edge.id : null,
            other: nodeRef(other)
          });
        });
      });
    });
    out.sort(function (a, b) {
      return a.relationship_type.localeCompare(b.relationship_type) ||
        String(a.other.node_label)
          .localeCompare(String(b.other.node_label));
    });
    return out;
  }

  /* ---------- unverified (PROPOSED) context, A3 ---------- */

  function unverifiedContext(user, subject) {
    /* PROPOSED edges touching the subject: displayed as
     * explicitly UNVERIFIED context only, never as documented
     * dependency, never traversed. */
    var out = [];
    SCA.graph.edges(user, { statuses: ['PROPOSED'] }).forEach(function (e) {
      var touches = (e.source_id === subject.id &&
        e.source_type === subject.type) ||
        (e.target_id === subject.id && e.target_type === subject.type);
      if (touches) {
        out.push({ relationship_type: e.relationship_type,
          edge_status: e.status,
          direction: (e.source_id === subject.id &&
            e.source_type === subject.type) ? 'OUTGOING' : 'INCOMING' });
      }
    });
    return out;
  }

  /* ---------- per-capability coverage sections ---------- */

  function reserveCoverage(user, capId) {
    /* Frozen Stage 14 read APIs apply their own privacy and
     * permission rules. */
    var out = { reserves: [], plans: [],
      continuity: null, basis: 'UNKNOWN',
      note: 'No documented reserve or continuity pathway found ' +
        'for this capability.' };
    var res = SCA.reserve.list(user, {});
    if (res.ok) {
      (res.records || res.results || []).forEach(function (r) {
        if ((r.capability_ids || []).indexOf(capId) !== -1) {
          out.reserves.push({ id: r.id, name: r.name,
            status: r.status, link: '#/reserves/' + r.id });
        }
      });
    }
    try {
      out.plans = (SCA.reserve.plansForCapability(capId) || [])
        .map(function (p) {
          return { id: p.id, status: p.status,
            known_gaps: p.known_gaps || [] };
        });
    } catch (e) { out.plans = []; }
    out.basis = (out.reserves.length || out.plans.length) ?
      'DOCUMENTED' : 'UNKNOWN';
    return out;
  }

  function recoveryFor(user, node) {
    /* Stage 9 profiles + Stage 9 fallback edges + Stage 8
     * repair capability search. All through frozen read APIs. */
    var profiles = [];
    try {
      profiles = SCA.recovery.activeProfilesFor(user, node.type,
        node.id) || [];
    } catch (e) { profiles = []; }
    var repairCaps = [];
    try {
      var repair = SCA.repair.searchRepairCapabilities(user,
        { asset_type: node.type, asset_id: node.id });
      if (repair && repair.ok) {
        repairCaps = (repair.results || []).map(function (c) {
          return { id: c.id, name: c.name, status: c.status,
            link: '#/repair-capability/' + c.id };
        });
      }
    } catch (e) { repairCaps = []; }
    var fallback = edgesForUser(user, ['FALLS_BACK_TO'], 'FORWARD',
      node).map(function (s) {
      return { relationship_status: s.edge.status,
        other: nodeRef(s.target) };
    });
    return {
      basis: (profiles.length || repairCaps.length ||
        fallback.length) ? 'DOCUMENTED' : 'UNKNOWN',
      recovery_profiles: profiles.map(function (p) {
        return { id: p.id, name: p.name, status: p.status,
          recovery_kind: p.recovery_kind,
          link: '#/recovery-profile/' + p.id };
      }),
      repair_capabilities: repairCaps,
      fallback_edges: fallback,
      unknown_note: (profiles.length || repairCaps.length ||
        fallback.length) ? null : 'No documented recovery ' +
        'pathway, repair capability or fallback found for this ' +
        'node (Unknown — never a finding that none exists).'
    };
  }

  function reproductionFor(capId) {
    /* Frozen Stage 14/5 derived views: counts only, census
     * carry-forward wording, never names. */
    var one = SCA.reserve.onePersonTest(capId);
    var three = SCA.reserve.threeGenerationTest(capId);
    var profile;
    try { profile = SCA.training.reproductionProfile(capId); }
    catch (e) { profile = null; }
    return {
      basis: 'DERIVED',
      one_person_test: one,
      three_generation_test: three,
      practitioner_count: profile ? profile.practitioner_count :
        one.documented_count,
      trainer_count: profile ? profile.trainer_count : undefined,
      apprentice_count: profile ? profile.apprentice_count :
        undefined,
      note: 'Human reproduction capacity is reported as counts ' +
        'documented within the available evidence/census scope. ' +
        'Person-level information is governed by Stage 5 and is ' +
        'never revealed by scenario analysis.'
    };
  }

  function contextFor(user, capId) {
    /* Stages 10/11/13 read-only context. Their own search APIs
     * apply public-status filtering and permissions. */
    var interventions = [];
    var pilots = [];
    var listings = [];
    try {
      var ir = SCA.intervention.searchInterventions(user,
        { capability_id: capId });
      if (ir.ok) {
        interventions = (ir.results || ir.records || []).map(function (r) {
          return { id: r.id, name: r.name, status: r.status,
            link: '#/intervention/' + r.id };
        });
      }
    } catch (e) { interventions = []; }
    try {
      var pr = SCA.pilots.searchPilots(user, { capability_id: capId });
      if (pr.ok) {
        pilots = (pr.results || pr.records || []).map(function (r) {
          return { id: r.id, name: r.name, status: r.status,
            link: '#/pilot/' + r.id };
        });
      }
    } catch (e) { pilots = []; }
    try {
      var ml = SCA.marketplace.list(user, {});
      var all = (ml && (ml.records || ml.results || ml.listings)) || [];
      all.forEach(function (l) {
        if ((l.capability_ids || []).indexOf(capId) !== -1 &&
          l.status === 'PUBLISHED') {
          listings.push({ id: l.id, title: l.title, status: l.status,
            link: '#/marketplace/' + l.id });
        }
      });
    } catch (e) { listings = []; }
    return {
      basis: (interventions.length || pilots.length ||
        listings.length) ? 'DOCUMENTED' : 'UNKNOWN',
      interventions: interventions,
      pilots: pilots,
      marketplace_listings: listings,
      note: 'Contextual information only. Scenario analysis ' +
        'never creates, recommends, modifies or triggers an ' +
        'intervention, pilot, listing or transaction.'
    };
  }

  function locationSummary(node, locationIds) {
    var rec = SCA.graph.nodeRecord(node) || {};
    var locs = rec.location_ids || [];
    var inScope = null;
    if (locationIds) {
      inScope = locs.filter(function (l) {
        return locationIds.indexOf(l) !== -1;
      });
    }
    return {
      documented_location_count: locs.length,
      within_requested_scope: inScope === null ? null :
        inScope.length,
      scope_note: locationIds ? 'Documented locations are ' +
        'reported against the requested scope. Dependencies are ' +
        'documented relationships: they are not cut at location ' +
        'boundaries.' : null
    };
  }

  /* ---------- chains (§12, §13) ---------- */

  function recoveryChain(user, node) {
    /* Descriptive recovery chain with missing links shown
     * explicitly — never a recovery probability. */
    var chain = [];
    var fs = SCA.store.all('failure_scenarios').filter(function (s) {
      return s.asset_type === node.type &&
        (s.asset_ids || []).indexOf(node.id) !== -1;
    });
    chain.push({ link: 'FAILURE_SCENARIOS',
      basis: fs.length ? 'DOCUMENTED' : 'UNKNOWN',
      count: fs.length,
      note: fs.length ? null : 'No Stage 8 failure scenario ' +
        'documented for this node (Unknown — never a finding ' +
        'that it cannot fail).' });
    var rec = recoveryFor(user, node);
    chain.push({ link: 'RECOVERY_PROFILES',
      basis: rec.recovery_profiles.length ? 'DOCUMENTED' : 'UNKNOWN',
      count: rec.recovery_profiles.length,
      note: rec.recovery_profiles.length ? null :
        'No Stage 9 recovery profile documented for this node.' });
    chain.push({ link: 'REPAIR_CAPABILITY',
      basis: rec.repair_capabilities.length ? 'DOCUMENTED' :
        'UNKNOWN',
      count: rec.repair_capabilities.length,
      note: rec.repair_capabilities.length ? null :
        'No documented local repair capability found for this ' +
        'node (documented-absence wording, not proof of ' +
        'absence).' });
    chain.push({ link: 'FALLBACK',
      basis: rec.fallback_edges.length ? 'DOCUMENTED' : 'UNKNOWN',
      count: rec.fallback_edges.length,
      note: rec.fallback_edges.length ? null :
        'No documented fallback pathway found for this node.' });
    if (node.type === 'CAPABILITY') {
      var rep = reproductionFor(node.id);
      chain.push({ link: 'PRACTITIONERS',
        basis: rep.one_person_test.status ===
          'NOT_YET_DOCUMENTED' ? 'UNKNOWN' : 'DOCUMENTED',
        count: rep.one_person_test.documented_count,
        note: rep.one_person_test.wording });
      chain.push({ link: 'TRAINING_REPRODUCTION',
        basis: 'DERIVED',
        count: rep.three_generation_test.state ===
          'REPRODUCTION_DOCUMENTED' ? 1 : 0,
        note: 'Three-Generation Test state: ' +
          rep.three_generation_test.state + ' (descriptive ' +
          'state from Stage 5 data, never a score).' });
    }
    return chain;
  }

  function continuityChain(user, capId) {
    /* Descriptive continuity chain; absence reported as "no
     * documented pathway found", never recorded as a gap. */
    var cov = reserveCoverage(user, capId);
    var chain = [];
    chain.push({ link: 'CAPABILITY', basis: 'DOCUMENTED',
      id: capId });
    chain.push({ link: 'RESERVE',
      basis: cov.reserves.length ? 'DOCUMENTED' : 'UNKNOWN',
      count: cov.reserves.length,
      note: cov.reserves.length ? null :
        'No documented capability reserve found for this ' +
        'capability.' });
    var custodian = null;
    cov.reserves.forEach(function (r) {
      if (!custodian && r.status === 'ACTIVE') {
        var rec = SCA.store.get('capability_reserves', r.id);
        custodian = rec ? rec.custodian_organization_id : null;
      }
    });
    chain.push({ link: 'CUSTODIAN',
      basis: custodian ? 'DOCUMENTED' : 'UNKNOWN',
      note: custodian ? null : 'No documented ACTIVE reserve ' +
        'custodian found for this capability.' });
    chain.push({ link: 'CONTINUITY_PLAN',
      basis: cov.plans.length ? 'DOCUMENTED' : 'UNKNOWN',
      count: cov.plans.length,
      note: cov.plans.length ? null :
        'No documented continuity pathway found.' });
    var plan = SCA.reserve.plansForCapability(capId)
      .filter(function (p) { return p.status === 'ACTIVE'; })[0];
    chain.push({ link: 'FALLBACK',
      basis: (plan && (plan.fallback_capability_ids || []).length) ?
        'DOCUMENTED' : 'UNKNOWN',
      count: plan ? (plan.fallback_capability_ids || []).length : 0,
      note: (plan && (plan.fallback_capability_ids || []).length) ?
        null : 'No documented fallback capability found in an ' +
        'active continuity plan.' });
    var rep = reproductionFor(capId);
    chain.push({ link: 'TRAINING_REPRODUCTION',
      basis: 'DERIVED',
      note: 'Three-Generation Test state: ' +
        rep.three_generation_test.state + '.' });
    return chain;
  }

  /* ---------- the scenario analysis (§10 A–K) ---------- */

  function analyze(user, request) {
    var v = validateRequest(user, request);
    if (!v.ok) { return v; }

    var subject = { type: request.subject_type,
      id: request.subject_id };
    var depth = v.depth;
    var locationIds = v.location_ids;

    /* A. Trigger. */
    var trigger = {
      scenario_kind: request.scenario_kind,
      disruption_code: request.scenario_kind === 'DISRUPTION' ?
        request.disruption_code : null,
      disruption_label: request.scenario_kind === 'DISRUPTION' ?
        disruptionLabel(request.disruption_code) : null,
      failure_scenario: null,
      subject: nodeRef(subject),
      analysis_mode: 'STRUCTURE',
      requested_depth: depth,
      location_scope: locationIds,
      transient: true
    };

    if (request.scenario_kind === 'FAILURE_SCENARIO') {
      var fs = SCA.store.get('failure_scenarios',
        request.failure_scenario_id);
      trigger.failure_scenario = { id: fs.id, name: fs.name,
        failure_category: fs.failure_category, status: fs.status,
        asset_type: fs.asset_type, asset_ids: fs.asset_ids || [] };
      /* S15-1 (correction v1.0): the frozen NOT_APPLICABLE basis
       * is emitted when the Stage 8 scenario's asset_type cannot
       * apply to the selected subject type; UNKNOWN when the
       * scenario type applies but the Atlas lacks documentation
       * for this subject; DOCUMENTED when the scenario lists the
       * subject. Absence of documentation is never proof of
       * absence, and no applicability vocabulary is added. */
      var fsApplicable = fs.asset_type === subject.type;
      trigger.scenario_documented_for_subject =
        (fsApplicable &&
          (fs.asset_ids || []).indexOf(subject.id) !== -1) ?
          'DOCUMENTED' :
          (fsApplicable ? 'UNKNOWN' : 'NOT_APPLICABLE');
    }

    /* B. Directly affected records (all documented connections
     * of the subject, labeled by their frozen section). */
    var direct = directConnections(user, subject);

    /* C. Dependency cascade (bounded, cycle-safe, deterministic).
     * Depth is a traversal property, never a risk score. */
    var cas = cascade(user, subject, depth, locationIds);
    var cascadeSteps = cas.steps;

    /* Subject + affected capabilities drive the capability-level
     * sections (D–J). */
    var capNodes = [subject].concat(
      cascadeSteps.filter(function (s) {
        return s.node_type === 'CAPABILITY';
      }).map(function (s) {
        return { type: 'CAPABILITY', id: s.node_id };
      }));
    var seen = {};
    var capabilitySections = [];
    capNodes.forEach(function (n) {
      if (seen[key(n)]) { return; }
      seen[key(n)] = true;
      var section = {
        capability: nodeRef(n),
        depth: (n.type === subject.type && n.id === subject.id) ?
          0 : 1,
        locations: locationSummary(n, locationIds),
        /* D. Recovery pathways (Stage 9 + Stage 8). */
        recovery: recoveryFor(user, n),
        /* E. Fallback pathways (Stage 7 FALLS_BACK_TO + Stage 14
         * plan fallbacks). */
        fallback: null,
        /* F. Reserve / continuity coverage (Stage 14). */
        reserve_coverage: reserveCoverage(user, n.id),
        /* G. Human reproduction capacity (Stage 5/14, count-only).
         */
        reproduction: reproductionFor(n.id),
        /* H. Repair capacity (Stage 8 search API). */
        repair_capacity: null,
        /* I. Intervention / pilot / marketplace context (10/11/13,
         * read-only). */
        context: contextFor(user, n.id),
        /* J. Known gaps (documented conditions only). */
        known_gaps: [],
        recovery_chain: recoveryChain(user, n),
        continuity_chain: continuityChain(user, n.id)
      };
      var rec = section.recovery;
      section.fallback = {
        basis: rec.fallback_edges.length ? 'DOCUMENTED' : 'UNKNOWN',
        graph_fallbacks: rec.fallback_edges,
        plan_fallbacks: (SCA.reserve.plansForCapability(n.id) || [])
          .map(function (p) {
            return { plan_id: p.id, plan_status: p.status,
              fallback_capability_ids: p.fallback_capability_ids ||
                [] };
          }).filter(function (p) {
            return p.fallback_capability_ids.length > 0;
          }),
        note: rec.fallback_edges.length ? null :
          'No documented fallback pathway found for this ' +
          'capability (Unknown — never proof that none exists).'
      };
      section.repair_capacity = {
        basis: rec.repair_capabilities.length ? 'DOCUMENTED' :
          'UNKNOWN',
        capabilities: rec.repair_capabilities,
        note: rec.repair_capabilities.length ? null :
          'No documented local repair capability found for this ' +
          'capability (documented-absence wording, not proof of ' +
          'absence).'
      };
      section.known_gaps = (SCA.reserve.plansForCapability(n.id) || [])
        .reduce(function (acc, p) {
          (p.known_gaps || []).forEach(function (g) {
            acc.push({ plan_id: p.id, plan_status: p.status,
              gap_code: (g && g.code) ? g.code : g,
              source: 'Stage 14 ContinuityPlan (documented ' +
                'observed condition, not a problem score)' });
          });
          return acc;
        }, []);
      if (section.reproduction.one_person_test.status ===
        'SINGLE_DOCUMENTED') {
        section.known_gaps.push({
          plan_id: null, plan_status: null,
          gap_code: 'SINGLE_KNOWLEDGE_HOLDER',
          source: 'Stage 14 One-Person Test (factual dependency ' +
            'observation from Stage 5 data)'
        });
      }
      capabilitySections.push(section);
    });

    /* K. Unknowns: what prevents a stronger conclusion. */
    var unknowns = [];
    var docCount = 0, derivedCount = 0;
    cascadeSteps.forEach(function (s) {
      if (s.basis === 'DOCUMENTED') { docCount++; }
      else { derivedCount++; }
    });
    if (!cascadeSteps.length) {
      unknowns.push({ text: 'No documented dependency cascade ' +
        'found within depth ' + depth + ' (Unknown — never a ' +
        'finding that the subject is unaffected).',
        basis: 'UNKNOWN' });
    }
    capabilitySections.forEach(function (cs) {
      if (cs.reserve_coverage.basis === 'UNKNOWN') {
        unknowns.push({ text: 'No documented reserve or ' +
          'continuity pathway found for capability "' +
          cs.capability.node_label + '".', basis: 'UNKNOWN' });
      }
    });
    if (cas.capped) {
      unknowns.push({ text: 'Traversal reached the bounded ' +
        'result cap (' + NODE_CAP + ' nodes); deeper structure ' +
        'exists but is not displayed (bounded result, not a ' +
        'completeness claim).', basis: 'DERIVED' });
    }

    return {
      ok: true,
      transient: true,
      persisted: false,
      trigger: trigger,
      /* A. */
      /* B. */
      directly_affected: direct,
      /* C. */
      dependency_cascade: cascadeSteps,
      cascade_documented_count: docCount,
      cascade_derived_count: derivedCount,
      traversal_capped: cas.capped,
      node_cap: NODE_CAP,
      /* Unverified context (A3): never documented dependency. */
      unverified_context: unverifiedContext(user, subject),
      /* D–J per capability (subject at depth 0). */
      capability_sections: capabilitySections,
      /* K. */
      unknowns: unknowns,
      evidence_bases: EVIDENCE_BASES.slice(),
      note: 'The Atlas does not predict outcomes. This analysis ' +
        'documents dependencies, pathways and gaps supported by ' +
        'authoritative records. DOCUMENTED means an authoritative ' +
        'record or reviewed relationship exists; DERIVED means ' +
        'mechanically derived from documented records (Stage 9 ' +
        'GRAPH_DERIVED semantics); UNKNOWN means the information ' +
        'is not yet documented — never proof of absence.'
    };
  }

  /* ---------- comparison (§20) ---------- */

  function compare(user, request) {
    /* Limited factual structural comparison of several scenarios
     * applied to the SAME subject. No best/worst, no ranking:
     * each column is an independent factual summary. */
    request = request || {};
    var errors = {};
    var scenarios = request.scenarios;
    /* S15-2 (correction v1.0): the malformed-input guard is
     * fixed — the previous "!Object.prototype.toString.call(
     * scenarios) === '[object Array]'" never fired because of
     * operator precedence. Validation now returns BEFORE any
     * iteration, so malformed string/object/null/undefined
     * input receives the established honest error and never a
     * TypeError. */
    if (Object.prototype.toString.call(scenarios) !==
      '[object Array]' || !scenarios ||
      scenarios.length < 2 || scenarios.length > MAX_COMPARE) {
      errors.scenarios = 'A comparison needs between 2 and ' +
        MAX_COMPARE + ' scenario requests.';
    }
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }
    var subjectSeen = null;
    var depth;
    scenarios.forEach(function (s, i) {
      if (!s || typeof s !== 'object') {
        errors.scenarios = 'Each scenario request must be an ' +
          'object.';
        return;
      }
      var subj = s.subject_type + '|' + s.subject_id;
      if (subjectSeen === null) { subjectSeen = subj; }
      else if (subjectSeen !== subj) {
        errors.scenarios = 'All compared scenarios must target ' +
          'the SAME subject.';
      }
      if (s.depth !== undefined && s.depth !== null &&
        depth === undefined) { depth = s.depth; }
    });
    if (Object.keys(errors).length) {
      return { ok: false, errors: errors };
    }

    var columns = [];
    scenarios.forEach(function (s) {
      var req = {
        scenario_kind: s.scenario_kind,
        disruption_code: s.disruption_code,
        failure_scenario_id: s.failure_scenario_id,
        subject_type: s.subject_type,
        subject_id: s.subject_id,
        depth: s.depth,
        location_ids: s.location_ids,
        mode: 'STRUCTURE'
      };
      var res = analyze(user, req);
      if (!res.ok) {
        columns.push({ ok: false, errors: res.errors });
        return;
      }
      columns.push({
        ok: true,
        scenario_kind: res.trigger.scenario_kind,
        disruption_code: res.trigger.disruption_code,
        disruption_label: res.trigger.disruption_label,
        failure_scenario_id: res.trigger.failure_scenario ?
          res.trigger.failure_scenario.id : null,
        direct_documented_count: res.directly_affected.length,
        cascade_documented_count: res.cascade_documented_count,
        cascade_derived_count: res.cascade_derived_count,
        affected_capability_count:
          res.capability_sections.length - 1,
        capabilities_with_recovery_pathway:
          countBasis(res.capability_sections,
            function (cs) { return cs.recovery.basis; }),
        capabilities_with_fallback: countBasis(res.capability_sections,
          function (cs) { return cs.fallback.basis; }),
        capabilities_with_reserve_coverage: countBasis(
          res.capability_sections,
          function (cs) { return cs.reserve_coverage.basis; }),
        capabilities_with_repair_capacity: countBasis(
          res.capability_sections,
          function (cs) { return cs.repair_capacity.basis; }),
        unknown_count: res.unknowns.length,
        subject: res.trigger.subject
      });
    });

    return {
      ok: columns.every(function (c) { return c.ok; }),
      transient: true,
      persisted: false,
      columns: columns,
      note: 'Factual structural differences only. This ' +
        'comparison declares no winner, assigns no ordering ' +
        'and computes no score. Each column stands alone as ' +
        'documented fact.'
    };
  }

  function countBasis(sections, fn) {
    return sections.filter(function (cs) {
      return fn(cs) === 'DOCUMENTED';
    }).length;
  }

  /* ---------- integrity ---------- */

  function integrity() {
    /* Read-only self-description for the permanent Build/Runtime
     * Integrity suite: exactly the frozen vocabulary is exposed,
     * nothing else. */
    return {
      scenario_kinds: SCENARIO_KINDS.slice(),
      disruption_codes: disruptionCodes(),
      evidence_bases: EVIDENCE_BASES.slice(),
      direction_map_types: Object.keys(DIRECTION_MAP).length,
      direction_map: DIRECTION_MAP,
      default_depth: DEFAULT_DEPTH,
      max_depth: MAX_DEPTH,
      node_cap: NODE_CAP,
      max_compare: MAX_COMPARE
    };
  }

  /* No lifecycle, no create/update/delete, no persistence: this
   * namespace only exposes read-only analysis. */
  SCA.scenario = {
    /* frozen vocabulary (for pages, tests, inspection) */
    EVIDENCE_BASES: EVIDENCE_BASES,
    CASCADE_REVERSE: CASCADE_REVERSE.slice(),
    CASCADE_FORWARD: CASCADE_FORWARD.slice(),
    RECOVERY_DISPLAY: RECOVERY_DISPLAY.slice(),
    REPRODUCTION_DISPLAY: REPRODUCTION_DISPLAY.slice(),
    EXCLUDED_TYPES: EXCLUDED_TYPES.slice(),
    DIRECTION_MAP: DIRECTION_MAP,
    TRAVERSABLE_STATUSES: TRAVERSABLE_STATUSES.slice(),
    DEFAULT_DEPTH: DEFAULT_DEPTH,
    MAX_DEPTH: MAX_DEPTH,
    NODE_CAP: NODE_CAP,
    MAX_COMPARE: MAX_COMPARE,
    /* analysis (read-only, transient) */
    analyze: analyze,
    compare: compare,
    /* integrity */
    integrity: integrity
  };
})(SCA);
