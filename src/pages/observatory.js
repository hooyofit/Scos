/*
 * Capability Observatory page (Stage 12: Capability Observatory &
 * Measurement Foundation, frozen scope v1.1).
 *
 * The Observatory is a READ-ONLY composition layer: the nine
 * required views over documented data (authorization §24). No
 * Observatory entity exists, nothing mutates, nothing scores and
 * nothing ranks. Where data is absent, the page says so honestly —
 * "not yet measured", never zero, never LOW, never a negative
 * conclusion.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: value }));
  }
  function muted(text) {
    return SCA.ui.el('p', { class: 'muted', text: text });
  }

  function indicatorCard(ind) {
    return SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h3', {}, ind.name +
        (ind.version ? ' (v' + ind.version + ')' : '')),
      row('Value', ind.display),
      ind.known ? row('Basis', ind.bases_note) : null,
      row('Accepted inputs', String(ind.input_count)),
      ind.reason ? muted(ind.reason) : null,
      ind.limitations ? muted('Limitation: ' + ind.limitations) :
        null);
  }

  SCA.pages.observatory = function (root) {
    function render() {
      var user = SCA.state.get('user');
      var obs = SCA.observatory.compose(user);

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Capability Observatory'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'What is known, what was measured, where, when, how, from ' +
        'what scope and under which methodology.'));
      root.appendChild(SCA.ui.el('div', { class: 'notice' },
        SCA.ui.el('p', {}, obs.principle),
        SCA.ui.el('p', { class: 'muted' }, obs.disclaimer)));

      /* View 1: Capability Condition. */
      var cc = obs.capability_condition;
      root.appendChild(SCA.ui.el('h2', {}, cc.title));
      root.appendChild(muted(cc.note));
      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          row('Accepted measurements',
            String(cc.accepted)),
          Object.keys(cc.measurements_by_status).map(function (st) {
            return row(st,
              String(cc.measurements_by_status[st]));
          })),
        SCA.ui.el('div', { class: 'card' },
          Object.keys(cc.measurements_by_basis).map(function (b) {
            return row(b,
              String(cc.measurements_by_basis[b]));
          }),
          muted('Counts of DOCUMENTED records, never of what exists ' +
            '— the condition of knowledge, not a judgment of ' +
            'capability.'))));

      /* Views 2–5: the four indicator families. */
      obs.sections.forEach(function (sec) {
        root.appendChild(SCA.ui.el('h2', {}, sec.title));
        root.appendChild(muted(sec.note));
        root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
          sec.indicators.map(indicatorCard)));
      });

      /* View 6: Geographic Coverage. */
      var gc = obs.geographic_coverage;
      root.appendChild(SCA.ui.el('h2', {}, gc.title));
      root.appendChild(muted(gc.note));
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        row('Locations in the Atlas',
          String(gc.locations_in_atlas)),
        row('Capability censuses', String(gc.censuses)),
        row('Immutable census snapshots',
          String(gc.census_snapshots)),
        row('Accepted census observations',
          String(gc.accepted_census_observations)),
        muted(gc.survey_status_note)));

      /* View 7: Capability Trends. */
      var tr = obs.capability_trends;
      root.appendChild(SCA.ui.el('h2', {}, tr.title));
      root.appendChild(muted(tr.note));
      if (!tr.series.length) {
        root.appendChild(muted(tr.none_note ||
          'No comparable measurement series documented yet.'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          tr.series.map(function (s) {
            return SCA.ui.el('li', {},
              (s.capability_id ?
                'Capability ' + s.capability_id : 'General') +
              ' — ' + s.measurement_kind + ' in ' + s.unit +
              ' — ' + s.points.length +
              ' accepted point(s), scope: ' + (s.scope || '—') +
              (s.comparable ? '' : ' — ' + s.limitation));
          })));
      }

      /* View 8: Evidence Quality. */
      var eq = obs.evidence_quality;
      root.appendChild(SCA.ui.el('h2', {}, eq.title));
      root.appendChild(muted(eq.note));
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        Object.keys(eq.evidence_distribution).map(function (lvl) {
          return row(lvl, String(eq.evidence_distribution[lvl]));
        }),
        row('Accepted measurements with source references',
          String(eq.accepted_with_source_references) + ' of ' +
          String(eq.accepted_measurements)),
        muted(eq.no_score_note)));

      /* View 9: Capability Balance Sheet. */
      var bs = obs.balance_sheet;
      root.appendChild(SCA.ui.el('h2', {}, bs.title));
      root.appendChild(muted(bs.note));
      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {}, 'Documented capability assets'),
          Object.keys(bs.assets).map(function (k) {
            return row(k.replace(/_/g, ' '),
              String(bs.assets[k]));
          })),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {}, 'Documented dependencies & recovery'),
          row('Graph edges (Stage 7 authority)',
            String(bs.dependencies.graph_edges_documented)),
          row('Recovery profiles (Stage 9 authority)',
            String(bs.recovery.recovery_profiles)),
          row('Failure scenarios (Stage 8 authority)',
            String(bs.recovery.failure_scenarios)),
          row('Repair records (Stage 8 authority)',
            String(bs.recovery.repair_records)),
          muted(bs.recovery.note)),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {}, 'Documented reproduction'),
          row('Apprenticeships (Stage 5 authority)',
            String(bs.reproduction.apprenticeships)),
          row('Competence assessments (Stage 5 authority)',
            String(bs.reproduction.competence_assessments)),
          row('Capability certifications (Stage 5 authority)',
            String(bs.reproduction.capability_certifications)),
          muted(bs.reproduction.note)),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {}, 'Documented activities & measurements'),
          row('Interventions (Stage 10 authority)',
            String(bs.activities.interventions)),
          row('Pilots (Stage 11 authority)',
            String(bs.activities.pilots)),
          row('Accepted measurements',
            String(bs.measurements.accepted_measurements)),
          row('Indicator definitions',
            String(bs.measurements.indicator_definitions)),
          muted(bs.verdict))));
    }

    render();
  };
})(SCA);
