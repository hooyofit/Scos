/*
 * Capability Observatory (Stage 12, frozen scope v1.1 + authorization
 * §24–§26): a READ-ONLY composition layer.
 *
 * The Observatory is a set of VIEWS over existing authorized data
 * (Stages 1–11) plus Stage 12 measurements and indicator
 * computations. NO Observatory entity exists. NOTHING here mutates
 * any record, and NOTHING here produces a score, verdict or
 * ranking. Where data is absent, views show "not yet measured" —
 * never zero, never LOW, never a negative conclusion (authorization
 * §5/§23).
 *
 * Governing principle (authorization §2):
 * "Measure first. Interpret second. Decide through human and
 * institutional judgment."
 */
(function (SCA) {
  'use strict';

  var NOT_MEASURED = 'Not yet measured in the documented data';

  function count(coll) {
    return SCA.store.count ? SCA.store.count(coll) :
      SCA.store.all(coll).length;
  }

  /* Honest status of one indicator for one user: computed
   * dynamically, never persisted, always carrying its definition's
   * interpretation notes and limitations. */
  function indicatorView(user, code) {
    var res = SCA.indicator.compute(code, {});
    return {
      code: code,
      name: res.indicator_name || code,
      version: res.version,
      known: res.known,
      value: res.known ? res.value : null,
      display: res.known ?
        (res.value + (res.unit === 'PERCENT' ? '%' : '')) :
        NOT_MEASURED,
      unit: res.unit,
      input_count: res.input_count,
      bases: res.bases,
      bases_note: res.bases_note || null,
      scopes: res.scopes,
      reason: res.reason,
      interpretation_notes: res.interpretation_notes,
      limitations: res.limitations
    };
  }

  function categorySection(category, codes) {
    return {
      category: category,
      indicators: codes.map(indicatorView.bind(null, null))
    };
  }

  /* §24 view 1 — Capability Condition: what is known about the
   * documented measurement layer itself. */
  function capabilityCondition() {
    var all = SCA.store.all('measurements');
    var byStatus = {};
    SCA.measurement.STATUSES.forEach(function (s) {
      byStatus[s] = 0;
    });
    var byBasis = {};
    all.forEach(function (m) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      byBasis[m.basis] = (byBasis[m.basis] || 0) + 1;
    });
    return {
      title: 'Capability Condition',
      note: 'Describes the documented measurement layer of this ' +
        'dataset. It is a condition of KNOWLEDGE, never a judgment ' +
        'of capability: a capability without measurements is ' +
        'unmeasured, not weak.',
      measurements_total: all.length,
      measurements_by_status: byStatus,
      measurements_by_basis: byBasis,
      accepted: byStatus.ACCEPTED || 0,
      not_measured_note: NOT_MEASURED
    };
  }

  /* §24 views 2–5 — the four frozen indicator families, each an
   * honest computed view (definitions are authoritative; values are
   * dynamic and version-pinned). */
  var SECTIONS = [
    { key: 'human_capability', title: 'Human Capability',
      category: 'HUMAN_CAPABILITY',
      codes: ['PRACTITIONER_DENSITY', 'APPRENTICE_RATIO',
        'TRAINER_AVAILABILITY', 'COMPETENCE_REPRODUCTION_RATE'] },
    { key: 'knowledge', title: 'Knowledge', category: 'KNOWLEDGE',
      codes: ['DOCUMENTATION_COVERAGE', 'KNOWLEDGE_CONCENTRATION',
        'TRANSMISSION_STATUS', 'INSTITUTIONAL_CONTINUITY'] },
    { key: 'repair', title: 'Repair', category: 'REPAIR',
      codes: ['LOCAL_REPAIR_RATIO', 'REPAIR_TIME', 'REPAIR_RADIUS',
        'SPARE_PART_AVAILABILITY'] },
    { key: 'resilience', title: 'Resilience', category: 'RESILIENCE',
      codes: ['RECOVERY_TIME', 'RECOVERY_DIFFICULTY',
        'EXTERNAL_RESCUE_DEPENDENCY', 'GEOGRAPHIC_REDUNDANCY'] }
  ];

  /* §24 view 6 — Geographic Coverage: documented coverage of the
   * Atlas itself (Stage 6 remains the census authority). */
  function geographicCoverage() {
    var censuses = count('capability_censuses');
    var snapshots = count('census_snapshots');
    var locations = count('locations');
    var documented = SCA.store.all('census_observations')
      .filter(function (o) {
        return o.review_status === 'ACCEPTED';
      }).length;
    return {
      title: 'Geographic Coverage',
      note: 'Coverage of DOCUMENTATION, never of capability: a ' +
        'location without census data is not surveyed, not ' +
        'incapable. NO DATA is never LOW (frozen carry-forward ' +
        'rule).',
      locations_in_atlas: locations,
      censuses: censuses,
      census_snapshots: snapshots,
      accepted_census_observations: documented,
      survey_status_note: 'Survey status describes knowledge ' +
        'coverage, never capability absence.'
    };
  }

  /* §24 view 7 — Capability Trends: accepted measurements grouped
   * into comparable series. Non-comparable observations are NEVER
   * presented as a continuous trend (authorization §26). */
  function capabilityTrends() {
    var accepted = SCA.store.all('measurements').filter(function (m) {
      return m.status === 'ACCEPTED';
    });
    var series = {};
    accepted.forEach(function (m) {
      var key = (m.indicator_id || 'unspecified') + '|' +
        (m.capability_id || 'any') + '|' + m.measurement_kind + '|' +
        m.unit + '|' + (m.observation_scope || '');
      series[key] = series[key] || {
        indicator_id: m.indicator_id,
        capability_id: m.capability_id,
        measurement_kind: m.measurement_kind,
        unit: m.unit,
        scope: m.observation_scope,
        points: []
      };
      series[key].points.push({
        observed_at: m.observed_at,
        value: m.value,
        basis: m.basis
      });
    });
    var out = [];
    Object.keys(series).forEach(function (k) {
      var s = series[k];
      s.points.sort(function (a, b) {
        return String(a.observed_at).localeCompare(
          String(b.observed_at));
      });
      s.comparable = s.points.every(function (p) {
        return p.basis === s.points[0].basis;
      });
      if (!s.comparable) {
        s.limitation = 'Mixed count bases — this series is NOT ' +
          'presented as a continuous comparable trend without an ' +
          'explicit limitation.';
      }
      out.push(s);
    });
    return {
      title: 'Capability Trends',
      note: 'Trends exist only where accepted measurements are ' +
        'sufficiently comparable (definition, unit, scope, ' +
        'methodology, period, basis). Mixed-basis series carry an ' +
        'explicit limitation and are never silently merged.',
      series: out,
      none_note: accepted.length ? null :
        'No accepted measurements exist yet — trends begin with ' +
        'the first accepted observation.'
    };
  }

  /* §24 view 8 — Evidence Quality: the documented evidence base
   * (Stage 3 remains the evidence authority; a measurement NEVER
   * upgrades evidence — authorization §12). */
  function evidenceQuality() {
    var dist = {};
    SCA.enums.evidence_levels.forEach(function (e) {
      dist[e.code] = 0;
    });
    SCA.store.all('capabilities').forEach(function (c) {
      var lvl = c.evidence_level || 'E0';
      dist[lvl] = (dist[lvl] || 0) + 1;
    });
    var withSources = SCA.store.all('measurements').filter(
      function (m) {
        return m.status === 'ACCEPTED' &&
          (m.source_refs || []).length > 0;
      }).length;
    var accepted = SCA.store.all('measurements').filter(function (m) {
      return m.status === 'ACCEPTED';
    }).length;
    return {
      title: 'Evidence Quality',
      note: 'A distribution of DOCUMENTED evidence levels. Evidence ' +
        'levels are governed by Stage 3; a measurement references ' +
        'evidence but never upgrades it (no automatic ' +
        'Measurement -> E-level transition exists).',
      evidence_distribution: dist,
      accepted_measurements: accepted,
      accepted_with_source_references: withSources,
      no_score_note: 'This is a factual distribution, not a quality ' +
        'score.'
    };
  }

  /* §24 view 9 / §25 — the Capability Balance Sheet: a DESCRIPTIVE
   * inventory of what is documented. It is a view, not an
   * accounting system; it must never produce an overall score or
   * verdict. */
  function balanceSheet() {
    function live(coll) {
      return SCA.store.all(coll).filter(function (r) {
        return !r.merged_into_id;
      }).length;
    }
    return {
      title: 'Capability Balance Sheet',
      note: 'A descriptive inventory of DOCUMENTED records. It is ' +
        'not an accounting system, produces no totals, no verdict ' +
        'and no score. Every count is bounded by its documented ' +
        'scope ("documented in this dataset", never "all that ' +
        'exist").',
      assets: {
        capabilities_documented: count('capabilities'),
        practitioners_documented: live('practitioners'),
        apprentices_documented: live('apprentices'),
        organizations_documented: count('organizations'),
        workshops_documented: count('workshops'),
        training_programs: count('training_programs'),
        knowledge_artifacts: count('knowledge'),
        evidence_sources: count('evidence')
      },
      dependencies: {
        graph_edges_documented: count('graph_edges'),
        note: 'Dependency structure is governed by Stage 7; the ' +
          'Observatory only reads it.'
      },
      recovery: {
        recovery_profiles: count('recovery_profiles'),
        failure_scenarios: count('failure_scenarios'),
        repair_records: count('repair_records'),
        note: 'Stage 8 and Stage 9 remain the authorities for ' +
          'repair and recovery semantics.'
      },
      reproduction: {
        apprenticeships: count('apprenticeships'),
        competence_assessments: count('competence_assessments'),
        capability_certifications: count('capability_certifications'),
        note: 'Stage 5 remains the reproduction authority.'
      },
      activities: {
        interventions: count('capability_interventions'),
        pilots: count('pilot_projects'),
        note: 'Stages 10 and 11 remain the intervention and pilot ' +
          'authorities; outcome semantics are theirs alone.'
      },
      measurements: {
        accepted_measurements: SCA.store.all('measurements')
          .filter(function (m) {
            return m.status === 'ACCEPTED';
          }).length,
        indicator_definitions: count('indicators')
      },
      verdict: 'None — interpretation and decisions stay with ' +
        'human and institutional judgment.'
    };
  }

  /* The composed Observatory (all nine required views). Read-only
   * by construction: nothing is written, computed values are never
   * persisted, and every section carries its honest-data note. */
  function compose(user) {
    var sections = SECTIONS.map(function (sec) {
      return {
        key: sec.key,
        title: sec.title,
        note: 'Values are computed dynamically from ACCEPTED ' +
          'measurements only, pinned to the approved indicator ' +
          'definition version. Unmeasured indicators show "' +
          NOT_MEASURED + '" — never zero, never a judgment.',
        indicators: sec.codes.map(function (code) {
          return indicatorView(user, code);
        })
      };
    });
    return {
      ok: true,
      title: 'Capability Observatory',
      principle: 'Measure first. Interpret second. Decide through ' +
        'human and institutional judgment.',
      disclaimer: 'Everything here reflects only documented Atlas ' +
        'data. The Observatory describes what is KNOWN and MEASURED; ' +
        'it never ranks, scores or decides.',
      capability_condition: capabilityCondition(),
      sections: sections,
      geographic_coverage: geographicCoverage(),
      capability_trends: capabilityTrends(),
      evidence_quality: evidenceQuality(),
      balance_sheet: balanceSheet()
    };
  }

  SCA.observatory = {
    compose: compose,
    capabilityCondition: capabilityCondition,
    geographicCoverage: geographicCoverage,
    capabilityTrends: capabilityTrends,
    evidenceQuality: evidenceQuality,
    balanceSheet: balanceSheet,
    indicatorView: indicatorView,
    NOT_MEASURED: NOT_MEASURED
  };
})(SCA);
