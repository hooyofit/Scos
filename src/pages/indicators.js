/*
 * Indicator pages (Stage 12: Capability Observatory & Measurement
 * Foundation, frozen scope v1.1).
 *
 * The indicator register groups the frozen definition vocabulary by
 * category (never ranked); the indicator detail shows the full
 * DEFINITION, its version history, and the DYNAMICALLY computed
 * current value — computed read-only from accepted measurements,
 * version-pinned, never persisted.
 *
 * Every view honors the frozen boundaries:
 *  - an indicator is a definition and calculation specification,
 *    not a stored result. No IndicatorValue entity exists;
 *  - a computed value is a view result with its scope, basis and
 *    limitations exposed — never a score or ranking;
 *  - "not yet measured" is shown honestly — never zero, never LOW;
 *  - an approved definition is immutable: a formula change creates
 *    a NEW VERSION (the previous version is preserved and remains
 *    the pin for historical computation);
 *  - the creator of a definition is never offered an approval
 *    action on their own record (creator/reviewer separation, incl.
 *    NATIONAL — the workflow guard is the rule).
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
  function statusBadge(status) {
    return SCA.ui.el('span', {
      class: 'badge badge-' + String(status || 'UNKNOWN').toLowerCase()
    }, SCA.util.display(status));
  }

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'Definitions, not verdicts.'),
      SCA.ui.el('p', { class: 'muted' },
        'An indicator is a reproducible, versioned analytical ' +
        'specification. Its value is computed dynamically from ' +
        'accepted measurements — read-only, deterministic and ' +
        'version-pinned. Indicators are never ranking mechanisms, ' +
        'and no composite capability score exists.'));
  }

  /* ---------- Indicator register ---------- */

  SCA.pages.indicatorsRegister = function (root) {
    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'indicator.read');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Indicators'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'Formal, versioned measurement definitions — how accepted ' +
        'measurements are interpreted, computed and limited.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Indicator definitions require ' +
          'signing in.'));
        return;
      }

      var list = SCA.indicator.list(user);
      SCA.enums.indicator_categories.forEach(function (cat) {
        var defs = list.filter(function (i) {
          return i.category === cat.code;
        });
        if (!defs.length) { return; }
        root.appendChild(SCA.ui.el('h2', {}, cat.label));
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          defs.map(function (i) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/indicator/' + i.id }, i.name),
              ' (' + i.code + ' v' + i.indicator_version + ') — ' +
              SCA.util.display(i.status));
          })));
      });

      if (SCA.rbac.can(user, 'indicator.create')) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Define a new indicator'),
          muted('Creates a DRAFT definition. Approval requires a ' +
            'reviewer other than you; an approved formula is ' +
            'immutable and changes only through a new version.'),
          renderCreateForm(user)));
      }
    }

    function renderCreateForm(user) {
      var f = {
        code: SCA.ui.el('input', { type: 'text',
          placeholder: 'Stable code (e.g. WORKSHOP_REPAIR_CAPACITY)' }),
        name: SCA.ui.el('input', { type: 'text',
          placeholder: 'Name' }),
        category: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.indicator_categories)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        frequency: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.indicator_frequencies)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        method: SCA.ui.el('select', {},
          ['LATEST', 'SUM', 'MEAN', 'RATIO'].map(function (mo) {
            return SCA.ui.el('option', { value: mo, text: mo });
          })),
        definition: SCA.ui.el('input', { type: 'text',
          placeholder: 'Formal definition (required)' }),
        required_measurements: SCA.ui.el('input', { type: 'text',
          placeholder: 'Required measurement inputs (required)' }),
        interpretation_notes: SCA.ui.el('input', { type: 'text',
          placeholder: 'Interpretation notes — what this does NOT mean' }),
        limitations: SCA.ui.el('input', { type: 'text',
          placeholder: 'Limitations' })
      };
      var feedback = SCA.ui.el('p', { class: 'muted' });

      function submit() {
        var res = SCA.indicator.createIndicator(user, {
          code: f.code.value,
          name: f.name.value,
          category: f.category.value,
          frequency: f.frequency.value,
          calc_spec: { method: f.method.value },
          definition: f.definition.value,
          required_measurements: f.required_measurements.value,
          interpretation_notes: f.interpretation_notes.value,
          limitations: f.limitations.value
        });
        if (res.ok) {
          SCA.router.navigate('#/indicator/' + res.record.id);
          return;
        }
        feedback.textContent = 'Not created: ' +
          Object.keys(res.errors || {}).map(function (k) {
            return res.errors[k];
          }).join('; ');
      }

      return SCA.ui.el('div', {}, [
        f.code, f.name, f.category, f.frequency, f.method, f.definition,
        f.required_measurements, f.interpretation_notes, f.limitations,
        SCA.ui.el('p', {},
          SCA.ui.el('button', { class: 'btn', onclick: submit },
            'Create draft definition')),
        feedback
      ]);
    }

    render();
  };

  /* ---------- Indicator detail ---------- */

  SCA.pages.indicatorDetail = function (root, params) {
    function render() {
      var user = SCA.state.get('user');
      root.innerHTML = '';
      var res = SCA.indicator.get(user, params.id);
      if (!res.ok) {
        root.appendChild(SCA.ui.el('h1', {}, 'Indicator'));
        root.appendChild(muted(res.errors &&
          (res.errors.id || res.errors.permission) || 'Not found.'));
        return;
      }
      var d = res.record;
      var computed = SCA.indicator.compute(d.code);

      root.appendChild(SCA.ui.el('h1', {}, d.name));
      root.appendChild(statusBadge(d.status));
      root.appendChild(muted(d.code + ' — version ' +
        d.indicator_version + ' of the definition (approved ' +
        'definitions are immutable; formula changes create a new ' +
        'version).'));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Current computed value (view, not data)'),
        row('Value', computed.known ?
          String(computed.value) +
          (computed.unit ? ' ' + computed.unit : '') :
          SCA.observatory.NOT_MEASURED),
        computed.known ?
          row('Count basis', computed.bases_note) :
          row('Why', computed.reason ||
            'No accepted measurements in scope.'),
        row('Accepted measurement inputs',
          String(computed.input_count)),
        (computed.scopes || []).length ?
          row('Observation scopes of inputs',
            computed.scopes.join('; ')) : null,
        muted('Computed dynamically, read-only, pinned to this ' +
          'version. Nothing is persisted; the value is never a ' +
          'score.')));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'The definition'),
        row('Category', SCA.util.display(d.category)),
        row('Frequency', SCA.util.display(d.frequency)),
        row('Calculation method',
          SCA.util.display(d.calculation_method)),
        row('Formal definition', SCA.util.display(d.definition)),
        row('Required measurement inputs',
          SCA.util.display(d.required_measurements)),
        row('Scope', SCA.util.display(d.scope)),
        row('Interpretation notes',
          SCA.util.display(d.interpretation_notes)),
        row('Limitations', SCA.util.display(d.limitations)),
        row('Provenance', SCA.util.display(d.provenance))));

      var versions = SCA.store.all('indicators').filter(function (i) {
        return i.code === d.code;
      });
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Version history'),
        versions.map(function (v) {
          return row('v' + v.indicator_version,
            SCA.util.display(v.status) +
            (v.superseded_by ? ' (superseded)' : '') +
            (v.id === d.id ? ' — this version' : ''));
        }),
        muted('Historical computation pins the definition version ' +
          'applicable to the queried period — no silent formula ' +
          'replacement.')));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Governance'),
        row('Created by', SCA.util.display(d.created_by)),
        d.reviewer ? row('Reviewed by', d.reviewer) : null,
        d.reviewed_at ? row('Reviewed at', d.reviewed_at) : null,
        renderActions(user, d)));
    }

    function renderActions(user, d) {
      var wrap = SCA.ui.el('div', {});
      var isCreator = d.created_by ===
        ((user && user.name) || 'anonymous');
      var msg = SCA.ui.el('p', { class: 'muted' });

      if (d.status === 'DRAFT' && isCreator) {
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.indicator.submitIndicator(user, d.id);
            if (!res.ok) {
              msg.textContent = 'Refused: ' + Object.keys(res.errors)
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            }
            render();
          } }, 'Submit definition for review'));
      }
      if (d.status === 'PENDING_REVIEW' &&
        SCA.rbac.can(user, 'indicator.review') && !isCreator) {
        var reason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Documented review reason (required)' });
        wrap.appendChild(reason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.indicator.approveIndicator(user, d.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Approval refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Approve'));
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.indicator.rejectIndicator(user, d.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Rejection refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Reject'));
      }
      if (isCreator) {
        wrap.appendChild(muted('As the creator you cannot approve ' +
          'this definition — creator/reviewer separation applies at ' +
          'every role level, including national administrator.'));
      }
      if (d.status === 'APPROVED' &&
        SCA.rbac.can(user, 'indicator.update')) {
        wrap.appendChild(muted('This definition is immutable. To ' +
          'change the formula, create a new version from the ' +
          'register (the current version is preserved and becomes ' +
          'the pin for historical computation).'));
      }
      wrap.appendChild(msg);
      return wrap;
    }

    render();
  };
})(SCA);
