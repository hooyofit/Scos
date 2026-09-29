/*
 * Scenario analysis page (Stage 15: Capability Scenario
 * Analysis Foundation, frozen scope v1.1 §25/A5).
 *
 * ONE route only: #/scenarios. The scenario request is encoded
 * in the query string and the result is rendered transiently —
 * there is NO #/scenarios/:id route because there is no
 * persistent Scenario record, by frozen decision. A deep link
 * reproduces the request; it never points at a stored result.
 *
 * Every view honors the frozen boundaries:
 *  - the Atlas does not predict outcomes; it documents
 *    dependencies and pathways;
 *  - evidence bases DOCUMENTED / DERIVED / UNKNOWN /
 *    NOT_APPLICABLE are displayed for every derived statement;
 *  - depth is a traversal property, never a risk score;
 *  - anonymous users see counts only (census carry-forward
 *    wording), never practitioner names;
 *  - no best/worst scenario language, no comparison ranking;
 *  - PROPOSED edges appear only as explicitly UNVERIFIED
 *    context, never as documented dependency;
 *  - every section links back to the authoritative source
 *    records (§21 traceability).
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function muted(text) {
    return SCA.ui.el('p', { class: 'muted', text: text });
  }

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: value }));
  }

  function badgeFor(basis) {
    var tone = basis === 'DOCUMENTED' ? 'success' :
      (basis === 'DERIVED' ? 'info' : 'muted');
    return SCA.ui.el('span', {
      class: 'badge badge-' + tone, text: basis || 'UNKNOWN' });
  }

  function parseQuery() {
    var qs = (location.hash.split('?')[1] || '');
    var out = {};
    qs.split('&').forEach(function (pair) {
      if (!pair) { return; }
      var kv = pair.split('=');
      out[decodeURIComponent(kv[0])] =
        decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function encodeQuery(req) {
    var parts = [];
    Object.keys(req).forEach(function (k) {
      if (req[k] !== undefined && req[k] !== null && req[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' +
          encodeURIComponent(req[k]));
      }
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  /* Subject picker over canonical node types with readable
   * labels; person node types are excluded for EVERYONE at the
   * UI level (privacy is enforced by the frozen graph rules
   * anyway; the UI is only a courtesy). */
  var SUBJECT_TYPES = ['CAPABILITY', 'RESOURCE', 'MATERIAL',
    'TOOL', 'ENERGY_SOURCE', 'WORKSHOP', 'ORGANIZATION',
    'TRAINING_PROGRAM', 'KNOWLEDGE_ARTIFACT', 'EVIDENCE_SOURCE',
    'FAILURE_SCENARIO'];

  function subjectOptions(type) {
    var collection = SCA.graphRegistry.collectionFor(type);
    var records = collection ?
      SCA.store.all(collection) : [];
    return records.sort(function (a, b) {
      return String(a.name || a.title || a.public_name || a.id)
        .localeCompare(String(b.name || b.title ||
          b.public_name || b.id));
    }).map(function (r) {
      return { id: r.id,
        label: r.name || r.title || r.public_name || r.id };
    });
  }

  function chainList(chain) {
    return SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h4', {}, 'Chain'),
      chain.map(function (step) {
        return SCA.ui.el('p', {},
          badgeFor(step.basis),
          ' ' + SCA.util.display(step.link) +
          (step.count !== undefined && step.count !== null ?
            ': ' + step.count + ' documented' : ''),
          step.note ?
            SCA.ui.el('span', { class: 'muted',
              text: ' — ' + step.note }) : null);
      }));
  }

  function capabilitySection(cs) {
    var card = SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h3', {},
        cs.capability.link ?
          SCA.ui.el('a', { href: cs.capability.link,
            text: cs.capability.node_label }) :
          cs.capability.node_label),
      muted('Depth ' + cs.depth + ' in this traversal (a ' +
        'traversal property, not a risk score).'),

      /* D. Recovery pathways. */
      SCA.ui.el('h4', {}, 'Recovery pathways'),
      cs.recovery.recovery_profiles.length ?
        cs.recovery.recovery_profiles.map(function (p) {
          return SCA.ui.el('p', {},
            SCA.ui.el('a', { href: p.link, text: p.name }),
            ' (' + p.status + ', ' + p.recovery_kind + ')');
        }) :
        muted('No documented recovery profile found.'),
      cs.recovery.repair_capabilities.length ?
        cs.recovery.repair_capabilities.map(function (c) {
          return SCA.ui.el('p', {},
            SCA.ui.el('a', { href: c.link, text: c.name }),
            ' (' + c.status + ')');
        }) :
        muted('No documented local repair capability found.'),

      /* E. Fallback pathways. */
      SCA.ui.el('h4', {}, 'Fallback pathways'),
      cs.fallback.basis === 'DOCUMENTED' ?
        (cs.fallback.graph_fallbacks || []).map(function (f) {
          return row('Falls back to',
            f.other.node_label + ' (' +
            f.relationship_status + ')');
        }) :
        muted('No documented fallback pathway found (Unknown — ' +
          'never proof that none exists).'),

      /* F. Reserve / continuity coverage. */
      SCA.ui.el('h4', {}, 'Reserve & continuity coverage'),
      cs.reserve_coverage.reserves.length ?
        cs.reserve_coverage.reserves.map(function (r) {
          return SCA.ui.el('p', {},
            SCA.ui.el('a', { href: r.link, text: r.name }),
            ' (' + r.status + ')');
        }) : muted('No documented reserve found.'),
      cs.reserve_coverage.plans.length ?
        muted(cs.reserve_coverage.plans.length +
          ' continuity plan(s) documented (see the reserve ' +
          'detail and capability detail pages).') :
        muted('No documented continuity pathway found.'),

      /* G. Human reproduction capacity (counts only). */
      SCA.ui.el('h4', {}, 'Human reproduction capacity'),
      muted(cs.reproduction.one_person_test.wording),
      muted('Three-Generation Test state: ' +
        cs.reproduction.three_generation_test.state +
        ' (descriptive state from Stage 5 data, never a score).'),

      /* H. Repair capacity. */
      SCA.ui.el('h4', {}, 'Repair capacity'),
      cs.repair_capacity.capabilities.length ?
        cs.repair_capacity.capabilities.map(function (c) {
          return SCA.ui.el('p', {},
            SCA.ui.el('a', { href: c.link, text: c.name }));
        }) :
        muted(cs.repair_capacity.note),

      /* I. Context. */
      SCA.ui.el('h4', {}, 'Intervention / pilot / marketplace context'),
      muted(cs.context.interventions.length +
        ' intervention(s), ' + cs.context.pilots.length +
        ' pilot(s), ' + cs.context.marketplace_listings.length +
        ' published listing(s) documented. Contextual only — ' +
        'scenario analysis never creates, recommends or ' +
        'modifies them.'),

      /* J. Known gaps. */
      SCA.ui.el('h4', {}, 'Known gaps'),
      cs.known_gaps.length ?
        cs.known_gaps.map(function (g) {
          return SCA.ui.el('p', {},
            SCA.ui.el('span', { class: 'badge', text: g.gap_code }),
            ' — ' + g.source);
        }) :
        muted('No documented known-gap condition (a documented ' +
          'condition, not a score).'),

      chainList(cs.recovery_chain),
      chainList(cs.continuity_chain));
    return card;
  }

  SCA.pages.scenarios = function (root) {
    var q = parseQuery();

    function renderResult(res) {
      root.appendChild(SCA.ui.el('h2', {},
        'Scenario result (transient — never stored)'));
      root.appendChild(muted(res.note));

      /* A. Trigger. */
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h3', {}, 'Trigger'),
        row('Scenario kind', res.trigger.scenario_kind),
        row('Scenario',
          res.trigger.disruption_label ||
          (res.trigger.failure_scenario &&
            res.trigger.failure_scenario.name) || ''),
        row('Subject', res.trigger.subject.node_label +
          ' (' + res.trigger.subject.node_type + ')'),
        row('Traversal depth requested',
          String(res.trigger.requested_depth) +
          ' (depth is a traversal property, not a risk score)'),
        res.trigger.scenario_documented_for_subject ?
          row('Stage 8 scenario coverage',
            res.trigger.scenario_documented_for_subject) : null));

      /* Unverified context. */
      if (res.unverified_context.length) {
        root.appendChild(SCA.ui.el('div', { class: 'notice' },
          SCA.ui.el('p', {},
            'Unverified context (PROPOSED edges — NOT documented ' +
            'dependencies):'),
          res.unverified_context.map(function (u) {
            return SCA.ui.el('p', { class: 'muted',
              text: u.relationship_type + ' (' + u.direction +
                ', ' + u.edge_status + ')' });
          })));
      }

      /* B. Directly affected. */
      root.appendChild(SCA.ui.el('h3', {}, 'Directly affected records'));
      if (res.directly_affected.length) {
        res.directly_affected.forEach(function (d) {
          root.appendChild(SCA.ui.el('p', {},
            badgeFor('DOCUMENTED'),
            ' ' + d.relationship_type,
            ' — ' + (d.other.link ?
              SCA.ui.el('a', { href: d.other.link,
                text: d.other.node_label }) :
              d.other.node_label),
            SCA.ui.el('span', { class: 'muted',
              text: ' (section: ' + d.section + ', edge ' +
                d.edge_status + ')' })));
        });
      } else {
        muted('No documented direct connections for this ' +
          'subject (Unknown — never a finding of isolation).');
      }

      /* C. Dependency cascade. */
      root.appendChild(SCA.ui.el('h3', {}, 'Dependency cascade'));
      muted(res.cascade_documented_count + ' documented (depth 1) ' +
        'and ' + res.cascade_derived_count +
        ' derived (deeper) connections found within depth ' +
        res.trigger.requested_depth + '.');
      if (res.traversal_capped) {
        root.appendChild(SCA.ui.el('div', { class: 'notice' },
          SCA.ui.el('p', {},
            'Traversal reached the bounded result cap (' +
            res.node_cap + ' nodes). Bounded result, not a ' +
            'completeness claim.')));
      }
      res.dependency_cascade.forEach(function (s) {
        root.appendChild(SCA.ui.el('p', {},
          badgeFor(s.basis),
          ' Depth ' + s.depth + ': ' + (s.link ?
            SCA.ui.el('a', { href: s.link,
              text: s.node_label }) : s.node_label),
          SCA.ui.el('span', { class: 'muted',
            text: ' via ' + s.via_relationship +
              ' (edge ' + s.via_edge_status + ')' })));
      });
      if (!res.dependency_cascade.length) {
        muted('No documented dependency cascade found (Unknown — ' +
          'never a finding that the subject is unaffected).');
      }

      /* D–J per capability. */
      root.appendChild(SCA.ui.el('h3', {}, 'Capability sections'));
      res.capability_sections.forEach(function (cs) {
        root.appendChild(capabilitySection(cs));
      });

      /* K. Unknowns. */
      root.appendChild(SCA.ui.el('h3', {}, 'Unknowns'));
      res.unknowns.forEach(function (u) {
        root.appendChild(SCA.ui.el('p', {},
          badgeFor(u.basis), ' ' + u.text));
      });
      if (!res.unknowns.length) {
        muted('No unknowns recorded for this analysis.');
      }
    }

    function renderComparison(res) {
      root.appendChild(SCA.ui.el('h2', {},
        'Scenario comparison (factual structural differences)'));
      root.appendChild(muted(res.note));
      var cols = res.columns || [];
      cols.forEach(function (c) {
        if (!c.ok) {
          root.appendChild(SCA.ui.el('div', { class: 'notice' },
            SCA.ui.el('p', { text: 'One scenario request was ' +
              'invalid: ' + JSON.stringify(c.errors || {}) })));
          return;
        }
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {},
            c.disruption_label || c.failure_scenario_id ||
            c.scenario_kind),
          row('Direct documented connections',
            String(c.direct_documented_count)),
          row('Cascade documented / derived',
            c.cascade_documented_count + ' / ' +
            c.cascade_derived_count),
          row('Affected capabilities',
            String(c.affected_capability_count)),
          row('Capabilities with documented recovery pathway',
            String(c.capabilities_with_recovery_pathway)),
          row('Capabilities with documented fallback',
            String(c.capabilities_with_fallback)),
          row('Capabilities with reserve coverage',
            String(c.capabilities_with_reserve_coverage)),
          row('Capabilities with repair capacity',
            String(c.capabilities_with_repair_capacity)),
          row('Unknowns recorded', String(c.unknown_count))));
      });
    }

    function render() {
      var user = SCA.state.get('user');
      root.innerHTML = '';
      root.appendChild(SCA.ui.pageHeader('Capability scenario analysis',
        'What is documented about capabilities under a defined ' +
        'disruption. The Atlas does not predict outcomes; it ' +
        'documents dependencies and pathways.'));

      var sel = {
        scenario_kind: q.scenario_kind || 'DISRUPTION',
        disruption_code: q.disruption_code || '',
        failure_scenario_id: q.failure_scenario_id || '',
        subject_type: q.subject_type || 'CAPABILITY',
        subject_id: q.subject_id || '',
        depth: q.depth || String(SCA.scenario.DEFAULT_DEPTH),
        mode: 'STRUCTURE'
      };

      var kindSel, disruptionSel, fsSel, typeSel, idSel, depthSel;

      kindSel = SCA.ui.el('select', {
        onchange: function (e) {
          sel.scenario_kind = e.target.value;
          disruptionSel.style.display =
            (sel.scenario_kind === 'DISRUPTION') ? '' : 'none';
          fsSel.style.display =
            (sel.scenario_kind === 'FAILURE_SCENARIO') ? '' : 'none';
        }
      }, ['DISRUPTION', 'FAILURE_SCENARIO'].map(function (k) {
        return SCA.ui.el('option', { value: k, text: k });
      }));
      kindSel.value = sel.scenario_kind;

      disruptionSel = SCA.ui.el('select', {
        onchange: function (e) { sel.disruption_code = e.target.value; }
      }, [SCA.ui.el('option', { value: '',
        text: 'Select a disruption scenario…' })]
        .concat((SCA.enums.disruption_scenarios || [])
          .map(function (s) {
            return SCA.ui.el('option', { value: s.code,
              text: s.label });
          })));
      disruptionSel.value = sel.disruption_code;

      fsSel = SCA.ui.el('select', {
        onchange: function (e) {
          sel.failure_scenario_id = e.target.value;
        }
      }, [SCA.ui.el('option', { value: '',
        text: 'Select a Stage 8 failure scenario…' })]
        .concat(SCA.store.all('failure_scenarios')
          .sort(function (a, b) {
            return String(a.name || a.id)
              .localeCompare(String(b.name || b.id));
          }).map(function (f) {
            return SCA.ui.el('option', { value: f.id,
              text: f.name || f.id });
          })));
      fsSel.value = sel.failure_scenario_id;

      typeSel = SCA.ui.el('select', {
        onchange: function (e) {
          sel.subject_type = e.target.value;
          sel.subject_id = '';
          render();
        }
      }, SUBJECT_TYPES.map(function (t) {
        return SCA.ui.el('option', { value: t, text: t });
      }));
      typeSel.value = sel.subject_type;

      idSel = SCA.ui.el('select', {
        onchange: function (e) { sel.subject_id = e.target.value; }
      }, [SCA.ui.el('option', { value: '',
        text: 'Select a subject…' })]
        .concat(subjectOptions(sel.subject_type).map(function (o) {
          return SCA.ui.el('option', { value: o.id,
            text: o.label });
        })));
      idSel.value = sel.subject_id;

      depthSel = SCA.ui.el('select', {
        onchange: function (e) { sel.depth = e.target.value; }
      }, [1, 2, 3, 4, 5].map(function (d) {
        return SCA.ui.el('option', { value: String(d),
          text: 'Depth ' + d });
      }));
      depthSel.value = String(sel.depth);

      disruptionSel.style.display =
        (sel.scenario_kind === 'DISRUPTION') ? '' : 'none';
      fsSel.style.display =
        (sel.scenario_kind === 'FAILURE_SCENARIO') ? '' : 'none';

      var errBox = null;
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Scenario request (transient)'),
        muted('A scenario request is never stored. The query ' +
          'string encodes the request so it can be shared; the ' +
          'result is recomputed from the local dataset every ' +
          'time.'),
        row('Scenario kind', ''),
        kindSel,
        disruptionSel,
        fsSel,
        row('Subject type', ''),
        typeSel,
        idSel,
        row('Traversal depth', ''),
        depthSel,
        SCA.ui.el('div', {},
          SCA.ui.el('button', { class: 'btn', onclick: function () {
            var req = {
              scenario_kind: sel.scenario_kind,
              subject_type: sel.subject_type,
              subject_id: sel.subject_id,
              depth: sel.depth,
              mode: 'STRUCTURE'
            };
            if (sel.scenario_kind === 'DISRUPTION') {
              req.disruption_code = sel.disruption_code;
            } else {
              req.failure_scenario_id = sel.failure_scenario_id;
            }
            var res = SCA.scenario.analyze(user, req);
            if (!res.ok) {
              errBox = SCA.ui.el('div', { class: 'notice' },
                SCA.ui.errorList(res.errors));
              root.appendChild(errBox);
              return;
            }
            location.hash = '#/scenarios' + encodeQuery(req);
          } }, 'Run analysis'),
          ' ',
          SCA.ui.el('button', { class: 'btn', onclick: function () {
            var reqs = [];
            var scenarios = (SCA.enums.disruption_scenarios || []);
            if (sel.subject_id && scenarios.length >= 2) {
              reqs = [
                { scenario_kind: 'DISRUPTION',
                  disruption_code: scenarios[0].code },
                { scenario_kind: 'DISRUPTION',
                  disruption_code: scenarios[1].code }
              ].map(function (base) {
                return {
                  scenario_kind: 'DISRUPTION',
                  disruption_code: base.disruption_code,
                  subject_type: sel.subject_type,
                  subject_id: sel.subject_id,
                  depth: sel.depth
                };
              });
            }
            var res = SCA.scenario.compare(user,
              { scenarios: reqs });
            root.innerHTML = '';
            if (!res.ok && !res.columns) {
              root.appendChild(SCA.ui.el('div', { class: 'notice' },
                SCA.ui.errorList(res.errors)));
              return;
            }
            renderComparison(res);
          } }, 'Compare two scenarios'))));

      /* Auto-run from a shared query string. */
      if (q.subject_id &&
        (q.disruption_code || q.failure_scenario_id)) {
        var req = {
          scenario_kind: q.scenario_kind || 'DISRUPTION',
          disruption_code: q.disruption_code,
          failure_scenario_id: q.failure_scenario_id,
          subject_type: q.subject_type,
          subject_id: q.subject_id,
          depth: q.depth || String(SCA.scenario.DEFAULT_DEPTH),
          mode: 'STRUCTURE'
        };
        var res = SCA.scenario.analyze(user, req);
        if (!res.ok) {
          root.appendChild(SCA.ui.el('div', { class: 'notice' },
            SCA.ui.errorList(res.errors)));
          return;
        }
        renderResult(res);
      }
    }

    render();
  };
})(SCA);
