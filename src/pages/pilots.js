/*
 * Regional Capability Pilot pages (Stage 11: Regional Capability
 * Pilots, frozen scope v1.1).
 *
 * One workspace: the pilot register (neutral, searchable, never
 * ranked) and the pilot detail (the coordination record with its
 * lifecycle and read-only constituent overview). Every view honors
 * the frozen boundaries:
 *   - a pilot coordinates; it never re-governs. Conclusion never
 *     implies success; no outcome field exists on a pilot at all;
 *   - the read-only overview shows categorical Stage 10 outcome
 *     COUNTS with explicit count bases — never a rate, percentage,
 *     score or ranking. A pilot with no constituent interventions
 *     shows "Not applicable", never UNKNOWN;
 *   - "documented in the current dataset" never means "the only
 *     ones that exist";
 *   - anonymous visitors see only APPROVED / ACTIVE / CONCLUDED
 *     pilots; PROPOSED planning material and CANCELLED records are
 *     staff-only;
 *   - practitioner references follow the existing Stage 5 masking
 *     rules: public views show counts, never private identities;
 *   - the census snapshot reference is always displayed dated and
 *     versioned — a historical "began against" reference, never a
 *     live baseline.
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

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'A coordination layer, not a judgment layer.'),
      SCA.ui.el('p', { class: 'muted' },
        'A pilot organizes existing interventions, organizations, ' +
        'workshops and training programs under one regional effort. ' +
        'It holds no outcome of its own: concluding a pilot records ' +
        'only that the coordination ended, and the outcomes of its ' +
        'constituent interventions stay governed by the intervention ' +
        'system, assessed by reviewers on evidence. Nothing here is ' +
        'scored, ranked or prioritized.'));
  }

  function locationLabels(pilot) {
    /* Derived from / validated against the canonical Stage 1
     * Location records — never a free-floating regional identity. */
    return (pilot.location_ids || []).map(function (id) {
      var loc = SCA.store.get('locations', id);
      if (!loc) { return id; }
      return loc.name || id;
    }).join(', ');
  }

  /* ---------- Pilot register ---------- */

  SCA.pages.pilotsRegister = function (root) {
    var q = { query: '', status: '' };

    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'pilot.read');
      var canCreate = SCA.rbac.can(user, 'pilot.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Regional Capability Pilots'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'Regional efforts that coordinate existing capability- ' +
        'strengthening activities — interventions, organizations, ' +
        'workshops and training programs — under one documented ' +
        'umbrella.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Pilot information requires signing in.'));
        return;
      }

      var filters = {};
      if (q.query) { filters.query = q.query; }
      if (q.status) { filters.status = q.status; }
      var res = SCA.pilots.searchPilots(user, filters);
      var list = res.ok ? res.results : [];

      var counts = {};
      SCA.pilots.STATUSES.forEach(function (st) { counts[st] = 0; });
      list.forEach(function (p) {
        counts[p.status] = (counts[p.status] || 0) + 1;
      });

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Pilots documented'),
          row('Records visible to you in this dataset',
            String(list.length) +
            ' (not a claim about what exists)'),
          Object.keys(counts).map(function (st) {
            return row(st, String(counts[st]));
          })),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Find pilots'),
          muted('Neutral search by name or lifecycle state. The ' +
            'register never ranks or recommends.'),
          SCA.ui.el('input', { type: 'search',
            placeholder: 'Search pilots…',
            value: q.query,
            oninput: function (e) {
              q.query = e.target.value;
              render();
            } }),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) {
                q.status = e.target.value;
                render();
              }
            }, [SCA.ui.el('option', { value: '',
              text: 'All visible lifecycle states' })]
              .concat(SCA.enums.optionList(
                SCA.enums.pilot_statuses).map(function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              })))))));

      if (canCreate) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Propose a pilot'),
          muted('Creates a PROPOSED coordination record. Constituent ' +
            'references (interventions, organizations, workshops, ' +
            'training programs, practitioners) and the regional scope ' +
            'are canonical references validated against the existing ' +
            'collections — never copied or fabricated.'),
          renderCreateForm(user)));
      }

      root.appendChild(SCA.ui.el('h2', {}, 'Pilot register'));
      if (!list.length) {
        root.appendChild(muted('No pilots documented here yet (this ' +
          'is not a claim that none exist or none are needed).'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          list.map(function (p) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/pilot/' + p.id }, p.name),
              ' — ' + SCA.util.display(p.status) +
              (locationLabels(p) ? ' — ' + locationLabels(p) : ''));
          })));
      }
    }

    function renderCreateForm(user) {
      var form = SCA.ui.el('div', {});
      var fields = {
        name: SCA.ui.el('input', { type: 'text',
          placeholder: 'Pilot name (e.g. Northwest regions repair network pilot)' }),
        objective: SCA.ui.el('input', { type: 'text',
          placeholder: 'Objective (what this pilot coordinates toward)' }),
        location_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Location record ids (canonical references, comma separated)' }),
        intervention_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Constituent intervention ids (comma separated, optional)' }),
        organization_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Constituent organization ids (comma separated, optional)' })
      };
      var msg = muted('');
      var btn = SCA.ui.el('button', { text: 'Create PROPOSED pilot' });
      btn.addEventListener('click', function () {
        function ids(v) {
          return v ? v.split(',').map(function (x) {
            return x.trim();
          }).filter(Boolean) : [];
        }
        var res = SCA.pilots.createPilot(user, {
          name: fields.name.value,
          objective: fields.objective.value,
          location_ids: ids(fields.location_ids.value),
          intervention_ids: ids(fields.intervention_ids.value),
          organization_ids: ids(fields.organization_ids.value)
        });
        if (res.ok) {
          msg.textContent = 'Pilot created as PROPOSED. It can be ' +
            'approved by an administrator (never by its creator).';
          Object.keys(fields).forEach(function (k) {
            fields[k].value = '';
          });
        } else {
          msg.textContent = Object.keys(res.errors || {})
            .map(function (k) { return k + ': ' + res.errors[k]; })
            .join(' ');
        }
        render();
      });
      Object.keys(fields).forEach(function (k) {
        form.appendChild(fields[k]);
      });
      form.appendChild(btn);
      form.appendChild(msg);
      return form;
    }

    render();
  };

  /* ---------- Pilot detail ---------- */

  SCA.pages.pilotDetail = function (root, params) {
    var user = SCA.state.get('user');
    root.innerHTML = '';
    var res = SCA.pilots.getPilot(user, params.id);
    if (!res.ok) {
      root.appendChild(SCA.ui.el('h1', {}, 'Pilot'));
      root.appendChild(muted(res.errors.permission ||
        res.errors.id ||
        'Not documented in this dataset (this is not a claim that ' +
        'it does not exist).'));
      return;
    }
    var p = res.record;
    var canApprove = SCA.rbac.can(user, 'pilot.approve');
    var canConclude = SCA.rbac.can(user, 'pilot.conclude');
    var canUpdate = SCA.rbac.can(user, 'pilot.update');

    root.appendChild(SCA.ui.el('h1', {}, p.name || 'Pilot'));
    root.appendChild(statusBadge(p.status));
    root.appendChild(row('Objective', SCA.util.display(p.objective)));

    /* Regional scope (canonical Location references). */
    root.appendChild(SCA.ui.el('h2', {}, 'Regional scope'));
    if ((p.location_ids || []).length) {
      root.appendChild(row('Locations (canonical references)',
        locationLabels(p)));
    } else {
      root.appendChild(muted('No locations referenced yet (unknown, ' +
        'never fabricated).'));
    }
    root.appendChild(muted('Regional scope is expressed only through ' +
      'canonical Location records — there is no separate regional ' +
      'identity, and no coordinates are invented.'));

    /* Census snapshot baseline (dated, immutable, historical). */
    root.appendChild(SCA.ui.el('h2', {}, 'Baseline'));
    if (p.census_snapshot_id) {
      var snap = SCA.store.get('census_snapshots', p.census_snapshot_id);
      if (snap) {
        root.appendChild(row('Census snapshot (immutable, historical)',
          (snap.label || snap.id) +
          (snap.generated_at ? ' — generated ' + snap.generated_at : '') +
          (snap.version ? ' (version ' + snap.version + ')' : '')));
        root.appendChild(muted('This pilot began against this ' +
          'snapshot. It is a dated historical reference: it is not a ' +
          'live baseline and is never recalculated here.'));
      } else {
        root.appendChild(muted('Referenced census snapshot is not in ' +
          'this dataset (the reference is preserved, never silently ' +
          'removed).'));
      }
    } else {
      root.appendChild(muted('No census baseline referenced (unknown, ' +
        'never fabricated).'));
    }

    /* Constituents (by reference only). */
    root.appendChild(SCA.ui.el('h2', {}, 'Constituent activities'));
    Object.keys(SCA.pilots.ACTIVITY_FIELDS)
      .forEach(function (field) {
        var ids = p[field] || [];
        if (!ids.length) { return; }
        root.appendChild(row(field.replace(/_/g, ' '),
          ids.map(function (id) {
            var coll = SCA.pilots.ACTIVITY_FIELDS[field];
            var rec = SCA.store.get(coll, id);
            if (!rec) { return id; }
            return rec.name || rec.title || rec.id || id;
          }).join(', ')));
      });
    if ((p.practitioner_ids || []).length) {
      /* Stage 5 masking: a count, never identities. */
      root.appendChild(row('Practitioners referenced',
        String(p.practitioner_ids.length) +
        ' (identities restricted; masked by the existing privacy rules)'));
    }
    root.appendChild(muted('Constituent membership is many-to-many and ' +
      'transfers no authority: each intervention, organization, ' +
      'workshop or training program keeps its own lifecycle and ' +
      'governance in its owning system.'));

    /* Read-only intervention outcome aggregation. */
    root.appendChild(SCA.ui.el('h2', {},
      'Constituent intervention outcomes (read-only)'));
    var ov = SCA.pilots.overview(p);
    if (ov.ok && ov.not_applicable) {
      root.appendChild(muted(ov.intervention_outcome_summary));
      root.appendChild(muted('There is no intervention population ' +
        'here, so no outcome applies — UNKNOWN would be dishonest ' +
        '(it is an intervention outcome owned by the intervention ' +
        'system).'));
    } else if (ov.ok) {
      root.appendChild(muted('Categorical counts of the current ' +
        'Stage 10 outcome statuses of the constituent interventions ' +
        'documented in the current dataset. Counts only — never a ' +
        'rate, percentage, score or ranking.'));
      Object.keys(ov.intervention_outcomes).forEach(function (oc) {
        root.appendChild(row(oc, String(ov.intervention_outcomes[oc])));
      });
      root.appendChild(muted('Count basis: ' + ov.counts_basis + '.'));
    } else {
      root.appendChild(muted('Overview unavailable.'));
    }

    /* Lifecycle. */
    root.appendChild(SCA.ui.el('h2', {}, 'Lifecycle'));
    root.appendChild(row('Status', SCA.util.display(p.status)));
    root.appendChild(muted('PROPOSED → APPROVED → ACTIVE → CONCLUDED, ' +
      'with CANCELLED reachable from PROPOSED, APPROVED and ACTIVE. ' +
      'CONCLUDED and CANCELLED are terminal and immutable; ' +
      'conclusion records only that the coordination ended — it ' +
      'never implies success.'));
    if (p.reviewer) {
      root.appendChild(row('Approved by', p.reviewer));
    }
    if (p.last_reason) {
      root.appendChild(row('Last recorded reason', p.last_reason));
    }
    root.appendChild(row('Version', p.version || '1'));

    /* History. */
    root.appendChild(SCA.ui.el('h2', {}, 'History'));
    (p.history || []).slice(-10).forEach(function (h) {
      root.appendChild(row((h.changed_at || '') + ' — ' +
        (h.change_type || 'TRANSITION'),
        (h.status || '') + (h.reason ? ' — ' + h.reason : '')));
    });
    if (!(p.history || []).length) {
      root.appendChild(muted('No recorded changes yet.'));
    }

    /* Actions (lifecycle tools for permitted roles). The UI never
     * offers a creator their own approval path (the workflow guard
     * independently refuses a self-approval at every role level,
     * including NATIONAL — hiding the button is not the rule). */
    var isCreator = p.created_by === ((user && user.name) ||
      'anonymous');
    var actions = [];
    if (p.status === 'PROPOSED' && canApprove && !isCreator) {
      actions.push(actionBtn('Approve', function () {
        return SCA.pilots.approvePilot(user, p.id,
          window.prompt('Approval reason (required, audited):') || '');
      }));
    }
    if (p.status === 'APPROVED' && canUpdate) {
      actions.push(actionBtn('Activate', function () {
        return SCA.pilots.activatePilot(user, p.id);
      }));
    }
    if (p.status === 'ACTIVE' && canConclude) {
      actions.push(actionBtn('Conclude', function () {
        return SCA.pilots.concludePilot(user, p.id,
          window.prompt('Conclusion reason (required, audited; it ' +
            'records only that the coordination ended):') || '');
      }));
    }
    if (['PROPOSED', 'APPROVED', 'ACTIVE'].indexOf(p.status) !== -1 &&
      canUpdate) {
      actions.push(actionBtn('Cancel (terminal)', function () {
        return SCA.pilots.cancelPilot(user, p.id,
          window.prompt('Cancellation reason (required, audited, ' +
            'terminal):') || '');
      }));
    }
    if (p.status === 'PROPOSED' && canUpdate) {
      actions.push(actionBtn('Edit (PROPOSED)', function () {
        var objective = window.prompt('New objective (blank keeps ' +
          'the current one):') || '';
        return SCA.pilots.updatePilot(user, p.id,
          objective ? { objective: objective } : {});
      }));
    }
    if (['APPROVED', 'ACTIVE'].indexOf(p.status) !== -1 && canUpdate) {
      actions.push(actionBtn('Amend (audited)', function () {
        var reason = window.prompt('Amendment reason (required, ' +
          'audited):') || '';
        var intervention_ids = window.prompt('New constituent ' +
          'intervention ids (comma separated, blank keeps current):') || '';
        var patch = {};
        if (intervention_ids) {
          patch.intervention_ids = intervention_ids.split(',')
            .map(function (x) { return x.trim(); }).filter(Boolean);
        }
        return SCA.pilots.amendPilot(user, p.id,
          Object.keys(patch).length ? patch : {}, reason);
      }));
    }
    if (actions.length) {
      root.appendChild(SCA.ui.el('h2', {}, 'Actions'));
      var bar = SCA.ui.el('div', { class: 'grid grid-2' });
      actions.forEach(function (a) { bar.appendChild(a); });
      root.appendChild(bar);
    }
    root.appendChild(muted('Privacy: public views show APPROVED, ' +
      'ACTIVE and CONCLUDED information only; proposed planning ' +
      'material is staff-only, and practitioner identities stay ' +
      'masked by the existing rules.'));
  };

  function actionBtn(label, fn) {
    var msg = muted('');
    var btn = SCA.ui.el('button', { text: label });
    btn.addEventListener('click', function () {
      var res = fn();
      if (!res.ok) {
        msg.textContent = Object.keys(res.errors || {})
          .map(function (k) { return k + ': ' + res.errors[k]; })
          .join(' ');
      } else {
        if (SCA.router.render) { SCA.router.render(); }
      }
    });
    var wrap = SCA.ui.el('div', { class: 'card' }, btn, msg);
    return wrap;
  }
})(SCA);
