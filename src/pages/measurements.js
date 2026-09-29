/*
 * Measurement pages (Stage 12: Capability Observatory & Measurement
 * Foundation, frozen scope v1.1).
 *
 * One workspace: the measurement register (neutral, searchable,
 * never ranked) and the measurement detail (the factual observation
 * with its scope, provenance, lifecycle and review actions).
 *
 * Every view honors the frozen boundaries:
 *  - a measurement records WHAT WAS MEASURED and WHERE ITS EVIDENCE
 *    CAME FROM, within an explicit observation scope. "Documented
 *    within a defined scope" never means "the total population";
 *  - unknown is never zero, not surveyed is never zero, and a
 *    missing value is never a negative conclusion;
 *  - small person-related counts display as Restricted to
 *    non-privileged viewers (Stage 6 privacy architecture);
 *  - anonymous visitors see only ACCEPTED and SUPERSEDED
 *    measurements — review workflow material is staff-only;
 *  - the creator of a measurement is never offered a review action
 *    on their own record (creator/reviewer separation, incl.
 *    NATIONAL — the workflow guard is the rule; the UI is only a
 *    courtesy);
 *  - a correction creates a NEW measurement; accepted records are
 *    never edited.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: value }));
  }
  function statusBadge(status) {
    return SCA.ui.el('span', {
      class: 'badge badge-' + String(status || 'UNKNOWN').toLowerCase()
    }, SCA.util.display(status));
  }
  function muted(text) {
    return SCA.ui.el('p', { class: 'muted', text: text });
  }
  function basisLabel(code) {
    var found = SCA.enums.measurement_bases.filter(function (b) {
      return b.code === code;
    })[0];
    return found ? found.label : SCA.util.display(code);
  }

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'Measure first. Interpret second. Decide through human and ' +
        'institutional judgment.'),
      SCA.ui.el('p', { class: 'muted' },
        'A measurement is a factual recorded observation within an ' +
        'explicit observation scope — the population, area or sample ' +
        'actually observed. "3 practitioners documented within the ' +
        'surveyed district" is never read as "only 3 practitioners ' +
        'exist". Unknown is never zero. Acceptance is a review ' +
        'decision made by someone other than the creator.'));
  }

  function valueText(user, m) {
    if (m.measurement_kind === 'CATEGORICAL') {
      return SCA.util.display(m.category_value);
    }
    return String(SCA.measurement.displayValue(user, m)) +
      (m.value !== null && m.value !== undefined &&
        typeof m.value === 'number' ? ' ' + m.unit : '');
  }

  /* ---------- Measurement register ---------- */

  SCA.pages.measurementsRegister = function (root) {
    var q = { query: '', basis: '' };

    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'measurement.read');
      var canCreate = SCA.rbac.can(user, 'measurement.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Measurements'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'Factual recorded observations — what is known, what was ' +
        'measured, where, when, how, from what scope and under which ' +
        'methodology.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Measurement information requires ' +
          'signing in.'));
        return;
      }

      var list = SCA.measurement.list(user).filter(function (m) {
        if (q.query) {
          var hay = (m.observation_scope || '') + ' ' +
            (m.method || '') + ' ' + (m.capability_id || '');
          if (hay.toLowerCase().indexOf(
            q.query.toLowerCase()) === -1) { return false; }
        }
        if (q.basis && m.basis !== q.basis) { return false; }
        return true;
      });

      var counts = {};
      SCA.measurement.STATUSES.forEach(function (st) {
        counts[st] = 0;
      });
      SCA.measurement.list(user).forEach(function (m) {
        counts[m.status] = (counts[m.status] || 0) + 1;
      });

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Measurements documented'),
          row('Records visible to you in this dataset',
            String(list.length) +
            ' (not a claim about what exists)'),
          Object.keys(counts).map(function (st) {
            return row(st, String(counts[st]));
          })),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Find measurements'),
          muted('Neutral search by scope, method or capability. The ' +
            'register never ranks, scores or recommends.'),
          SCA.ui.el('input', { type: 'search',
            placeholder: 'Search measurements…',
            value: q.query,
            oninput: function (e) {
              q.query = e.target.value;
              render();
            } }),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) {
                q.basis = e.target.value;
                render();
              }
            }, [SCA.ui.el('option', { value: '',
              text: 'All data-origin bases' })]
              .concat(SCA.enums.optionList(
                SCA.enums.measurement_bases).map(function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              })))))));

      if (canCreate) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Record a measurement (draft)'),
          muted('Creates a DRAFT in your local dataset — fully ' +
            'offline-capable. Nothing is accepted until a reviewer ' +
            'other than you accepts it.'),
          renderCreateForm(user)));
      }

      root.appendChild(SCA.ui.el('h2', {}, 'Measurement register'));
      if (!list.length) {
        root.appendChild(muted('No measurements documented here yet ' +
          '(this is not a claim that nothing has been measured or ' +
          'that nothing exists).'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          list.map(function (m) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/measurement/' + m.id },
                valueText(user, m)),
              ' — ' + basisLabel(m.basis) + ' — ' +
              SCA.util.display(m.status) + ' — ' +
              SCA.util.display(m.observation_scope));
          })));
      }
    }

    function renderCreateForm(user) {
      var f = {
        capability_id: SCA.ui.el('input', { type: 'text',
          placeholder: 'Capability id (optional, canonical)' }),
        measurement_kind: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.measurement_kinds)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        unit: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.measurement_units)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        basis: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.measurement_bases)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        value: SCA.ui.el('input', { type: 'number',
          placeholder: 'Measured value (empty for categorical/unknown)' }),
        category_value: SCA.ui.el('input', { type: 'text',
          placeholder: 'Named category (categorical kind only)' }),
        observation_scope: SCA.ui.el('input', { type: 'text',
          placeholder: 'Observation scope (required) — e.g. ' +
            'practitioners documented in X district survey' }),
        observed_at: SCA.ui.el('input', { type: 'date' }),
        method: SCA.ui.el('input', { type: 'text',
          placeholder: 'How the value was obtained (required for estimates)' }),
        limitations: SCA.ui.el('input', { type: 'text',
          placeholder: 'Known limitations of this observation' })
      };
      var feedback = SCA.ui.el('p', { class: 'muted' });

      function submit() {
        var data = {
          capability_id: f.capability_id.value || null,
          measurement_kind: f.measurement_kind.value,
          unit: f.unit.value,
          basis: f.basis.value,
          value: f.value.value === '' ? null : Number(f.value.value),
          category_value: f.category_value.value || null,
          observation_scope: f.observation_scope.value,
          observed_at: f.observed_at.value || null,
          method: f.method.value,
          limitations: f.limitations.value
        };
        var res = SCA.measurement.createMeasurement(user, data);
        feedback.textContent = '';
        if (res.ok) {
          SCA.router.navigate('#/measurement/' + res.record.id);
          return;
        }
        feedback.textContent = 'Draft not created: ' +
          Object.keys(res.errors || {}).map(function (k) {
            return k + ' — ' + res.errors[k];
          }).join('; ');
      }

      return SCA.ui.el('div', {}, [
        f.capability_id, f.measurement_kind, f.unit, f.basis,
        f.value, f.category_value, f.observation_scope, f.observed_at,
        f.method, f.limitations,
        SCA.ui.el('p', {},
          SCA.ui.el('button', { class: 'btn', onclick: submit },
            'Create draft')),
        feedback
      ]);
    }

    render();
  };

  /* ---------- Measurement detail ---------- */

  SCA.pages.measurementDetail = function (root, params) {
    function render() {
      var user = SCA.state.get('user');
      root.innerHTML = '';
      var res = SCA.measurement.get(user, params.id);
      if (!res.ok) {
        root.appendChild(SCA.ui.el('h1', {}, 'Measurement'));
        root.appendChild(muted(res.errors &&
          (res.errors.id || res.errors.permission) ||
          'Not found.'));
        return;
      }
      var m = res.record;
      var cap = m.capability_id ?
        SCA.store.get('capabilities', m.capability_id) : null;
      var ind = m.indicator_id ?
        SCA.store.get('indicators', m.indicator_id) : null;

      root.appendChild(SCA.ui.el('h1', {}, 'Measurement'));
      root.appendChild(statusBadge(m.status));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'The observation'),
        row('Measured value', valueText(user, m)),
        row('Data-origin basis', basisLabel(m.basis) +
          (m.basis === 'ESTIMATED' ? ' (estimate)' : '')),
        row('Measurement kind',
          SCA.util.display(m.measurement_kind)),
        row('Unit', SCA.util.display(m.unit)),
        row('Derivation', m.derivation === 'GRAPH_DERIVED' ?
          'Derived from the capability graph (read-only)' :
          'Directly documented'),
        row('Observed at', SCA.util.display(m.observed_at)),
        m.period_start || m.period_end ? row('Period',
          SCA.util.display(m.period_start) + ' to ' +
          SCA.util.display(m.period_end)) : null,
        row('Method / how obtained', SCA.util.display(m.method)),
        row('Known limitations', SCA.util.display(m.limitations))));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Observation scope'),
        SCA.ui.el('p', {}, SCA.util.display(m.observation_scope)),
        muted('This value describes the population, area or sample ' +
          'actually observed — never "everything that exists".'),
        cap ? row('Capability', cap.name + ' (' + cap.id + ')') : null,
        (m.location_ids || []).length ? row('Locations',
          m.location_ids.map(function (id) {
            var loc = SCA.store.get('locations', id);
            return loc ? loc.name : id;
          }).join(', ')) : null));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Provenance'),
        row('Sources referenced',
          (m.source_refs || []).length ?
          m.source_refs.map(function (sr) {
            return sr.type + ' ' + sr.id;
          }).join('; ') : 'None referenced'),
        m.methodology_id ? row('Census methodology',
          m.methodology_id) : null,
        m.census_snapshot_id ? row('Census snapshot (immutable)',
          m.census_snapshot_id) : null,
        m.census_observation_id ? row('Census observation',
          m.census_observation_id) : null,
        m.research_project_id ? row('Research project',
          m.research_project_id) : null,
        m.intervention_id ? row('Intervention', m.intervention_id) :
          null,
        m.pilot_project_id ? row('Pilot project',
          m.pilot_project_id) : null,
        ind ? row('Analytical intent (input to indicator)',
          ind.code + ' v' + ind.indicator_version +
          (m.analysis_role ? ' — ' + m.analysis_role : '')) : null,
        muted('A measurement references evidence; it never ' +
          'automatically upgrades a capability\'s evidence level.')));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Lifecycle & governance'),
        row('Created by', SCA.util.display(m.created_by)),
        row('Created at', SCA.util.display(m.created_at)),
        m.reviewer ? row('Reviewed by', m.reviewer) : null,
        m.reviewed_at ? row('Reviewed at', m.reviewed_at) : null,
        m.review_reason ? row('Review reason', m.review_reason) : null,
        m.supersedes_id ? row('Corrects',
          SCA.ui.el('a', { href: '#/measurement/' + m.supersedes_id },
            m.supersedes_id)) : null,
        m.superseded_by ? row('Superseded by',
          SCA.ui.el('a', { href: '#/measurement/' + m.superseded_by },
            m.superseded_by)) : null,
        renderActions(user, m)));
    }

    function renderActions(user, m) {
      var wrap = SCA.ui.el('div', {});
      var isCreator = m.created_by ===
        ((user && user.name) || 'anonymous');
      var msg = SCA.ui.el('p', { class: 'muted' });

      function run(fn) {
        return function () {
          var res = fn();
          msg.textContent = res.ok ? '' :
            'Action refused: ' + Object.keys(res.errors || {})
              .map(function (k) { return res.errors[k]; })
              .join(' ');
          render();
        };
      }

      if (m.status === 'DRAFT' && isCreator &&
        SCA.rbac.can(user, 'measurement.update')) {
        wrap.appendChild(muted('This draft is editable by you and ' +
          'locked after submission.'));
      }
      if (m.status === 'DRAFT' && isCreator) {
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: run(function () {
            return SCA.measurement.submitMeasurement(user, m.id);
          }) }, 'Submit for review'));
      }
      if (m.status === 'SUBMITTED' &&
        SCA.rbac.can(user, 'measurement.review') && !isCreator) {
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: run(function () {
            return SCA.measurement.startReview(user, m.id);
          }) }, 'Begin review'));
      }
      if (m.status === 'UNDER_REVIEW' &&
        SCA.rbac.can(user, 'measurement.review') && !isCreator) {
        var reason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Documented review reason (required)' });
        wrap.appendChild(reason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.measurement.acceptMeasurement(user, m.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Acceptance refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Accept'));
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.measurement.rejectMeasurement(user, m.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Rejection refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Reject'));
      }
      if (isCreator) {
        wrap.appendChild(muted('As the creator you cannot review ' +
          'this measurement — creator/reviewer separation applies ' +
          'at every role level, including national administrator.'));
      }
      if (m.status === 'ACCEPTED' &&
        SCA.rbac.can(user, 'measurement.create')) {
        wrap.appendChild(SCA.ui.el('p', {},
          SCA.ui.el('a', {
            href: '#/measurements' }, 'Record a correction'),
          ' — a correction creates a NEW measurement; accepted ' +
          'records are never edited.'));
      }
      wrap.appendChild(msg);
      return wrap;
    }

    render();
  };
})(SCA);
