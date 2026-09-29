/*
 * Failure & Recovery pages (Stage 9).
 *
 * One primary area: what is documented about failure impact, fallback
 * readiness and recovery options. Every view shows exactly what has
 * been documented, with scope labels:
 *   - "documented in the current dataset" never means "the only ones
 *     that exist";
 *   - unknown areas are displayed as Unknown, never as zero, false or
 *     "none";
 *   - no scores, no rankings, no readiness traffic lights;
 *   - anonymous visitors see reviewed (DOCUMENTED/VERIFIED) records
 *     only; recovery profiles never contain personal data (targets
 *     are never practitioners), but person-related information in the
 *     composed views follows the existing Stage 8 masking rules.
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

  function unknownNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'Not documented does not mean nonexistent.'),
      SCA.ui.el('p', { class: 'muted' },
        'The Recovery layer describes what research has documented ' +
        'about failure impact, fallbacks and recovery options. ' +
        'Everything not represented here is Unknown — not absent.'));
  }

  function searchBox(id, placeholder, handler) {
    return SCA.ui.el('input', {
      id: id, type: 'search', placeholder: placeholder,
      oninput: handler });
  }

  /* ---------- Failure & Recovery overview ---------- */

  SCA.pages.recoverySystem = function (root) {
    var user = SCA.state.get('user');
    var q = { query: '', kind: '' };

    function render() {
      var user2 = SCA.state.get('user');
      var canRead = SCA.rbac.can(user2, 'recovery.read');
      var canCreate = SCA.rbac.can(user2, 'recovery.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Failure & Recovery'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'What has been documented about what happens when an ' +
        'important capability, tool, workshop, energy source or place ' +
        'fails — and what documented paths exist to recover: fallback ' +
        'capabilities, the Stage 8 repair network, substitutions, ' +
        'local fabrication and external support.'));
      root.appendChild(unknownNotice());

      if (!canRead) {
        root.appendChild(SCA.ui.el('p', { class: 'muted' },
          'Recovery information requires signing in.'));
        return;
      }

      /* Documented recovery profiles (descriptive listing, no scores). */
      var filters = {};
      if (q.query) { filters.query = q.query; }
      if (q.kind) { filters.recovery_kind = q.kind; }
      var res = SCA.recovery.searchRecoveryProfiles(user2, filters);
      var profiles = res.ok ? res.results : [];

      var counts = {};
      SCA.recovery.KINDS.forEach(function (k) { counts[k] = 0; });
      profiles.forEach(function (p) {
        counts[p.recovery_kind] = (counts[p.recovery_kind] || 0) + 1;
      });

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Recovery profiles documented'),
          row('Active profiles in this dataset',
            String(profiles.length) + ' (not a claim about what exists)'),
          Object.keys(counts).map(function (k) {
            return row(k, String(counts[k]));
          })),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Find recovery options'),
          SCA.ui.el('p', { class: 'muted' },
            'Search documented recovery profiles by name or kind.'),
          searchBox('recovery-query', 'Search recovery profiles…',
            function (e) {
              q.query = e.target.value;
              render();
            }),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) { q.kind = e.target.value; render(); }
            }, [SCA.ui.el('option', { value: '',
              text: 'All recovery kinds' })]
              .concat(SCA.enums.optionList(
                SCA.enums.recovery_kinds).map(function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              })))))));

      /* Impact / readiness tools. */
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCUIImpactSection(user2)));

      /* Create form for permitted roles. */
      if (canCreate) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Document a recovery profile'),
          muted('One profile documents exactly one recovery target of ' +
            'one kind for one subject asset. Multiple targets require ' +
            'multiple profiles.'),
          renderCreateForm(user2, render)));
      }

      /* Profile list. */
      root.appendChild(SCA.ui.el('h2', {},
        'Documented recovery profiles'));
      if (!profiles.length) {
        root.appendChild(muted('No recovery profiles documented yet ' +
          '(this is not a claim that none exist).'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          profiles.map(function (p) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/recovery-profile/' + p.id },
                p.name),
              ' — ' + p.recovery_kind + ' — ' +
                SCA.util.display(p.status));
          })));
      }
    }

    function SCUIImpactSection(user2) {
      var wrap = SCA.ui.el('div', {});
      wrap.appendChild(SCA.ui.el('h2', {},
        'Impact & readiness (read-time composition)'));
      wrap.appendChild(muted('Choose a capability to see its documented ' +
        'failure impact (from the Stage 7 dependency structure) and ' +
        'fallback readiness (from Stages 2–8 records).'));
      var sel = SCA.ui.el('select', {},
        [SCA.ui.el('option', { value: '',
          text: 'Select a capability…' })]
        .concat(SCA.store.all('capabilities').slice(0, 240)
          .map(function (c) {
            return SCA.ui.el('option', {
              value: c.id, text: c.code + ' — ' + c.name });
          })));
      var out = SCA.ui.el('div', {});
      sel.addEventListener('change', function () {
        out.innerHTML = '';
        if (!sel.value) { return; }
        var impact = SCA.recovery.failureImpact(user2,
          { asset_type: 'CAPABILITY', asset_id: sel.value });
        var ready = SCA.recovery.fallbackReadiness(user2, sel.value);
        if (impact.ok) {
          out.appendChild(SCA.ui.el('h3', {},
            'Impact if this capability fails'));
          out.appendChild(row('Directly documented failure scenarios',
            String(impact.direct_scenario_count)));
          out.appendChild(row('Affected (derived, not asserted certain)',
            String(impact.affected_count) + ' documented dependents ' +
            'within depth ' + impact.traversal_depth));
          out.appendChild(muted(impact.note));
          (impact.affected || []).slice(0, 25).forEach(function (a) {
            out.appendChild(row('· ' + a.node_label,
              a.basis + ' (depth ' + a.depth + (a.via_edge ?
                ', via ' + a.via_edge : '') + ')'));
          });
        }
        if (ready.ok) {
          out.appendChild(SCA.ui.el('h3', {}, 'As a fallback capability'));
          out.appendChild(row('Living status',
            SCA.util.display(ready.capability.living_status)));
          out.appendChild(row('Documented fallback-of edges',
            String(ready.fallback_of_edges.length)));
          out.appendChild(row('Documented fallback-of profiles',
            String(ready.fallback_of_profiles.length)));
          var r = ready.reproduction;
          out.appendChild(row('Documented practitioners',
            r ? String(r.practitioner_count) : 'Unknown'));
          out.appendChild(row('Documented apprenticeships',
            r ? String(r.apprenticeship_count) : 'Unknown'));
          out.appendChild(row('Repair coverage',
            ready.repair_coverage.documented ?
              ready.repair_coverage.count + ' documented' :
              'Unknown (not "none")'));
        }
      });
      wrap.appendChild(sel);
      wrap.appendChild(out);
      return wrap;
    }

    function renderCreateForm(user2, rerender) {
      var form = SCA.ui.el('div', {});
      var capList = SCA.store.all('capabilities');

      var fields = {
        name: SCA.ui.el('input', { type: 'text',
          placeholder: 'Profile name (e.g. Water pumping: donkey fallback)' }),
        asset_type: SCA.ui.el('select', {},
          SCA.repair.ASSET_TYPES.map(function (t) {
            return SCA.ui.el('option', { value: t, text: t });
          })),
        asset_id: SCA.ui.el('input', { type: 'text',
          placeholder: 'Subject asset record id' }),
        recovery_kind: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.recovery_kinds).map(function (o) {
            return SCA.ui.el('option', { value: o.value, text: o.label });
          })),
        target_type: SCA.ui.el('select', {},
          Object.keys(SCA.recovery.TARGET_COLLECTIONS).map(function (t) {
            return SCA.ui.el('option', { value: t, text: t });
          })),
        target_id: SCA.ui.el('input', { type: 'text',
          placeholder: 'Target record id' }),
        description: SCA.ui.el('input', { type: 'text',
          placeholder: 'What this recovery involves' }),
        source_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Evidence source ids (comma separated)' })
      };
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { text: 'Create PROPOSED profile' });
      btn.addEventListener('click', function () {
        var data = {
          name: fields.name.value,
          asset_type: fields.asset_type.value,
          asset_id: fields.asset_id.value.trim(),
          recovery_kind: fields.recovery_kind.value,
          target_type: fields.target_type.value,
          target_id: fields.target_id.value.trim(),
          description: fields.description.value,
          source_ids: fields.source_ids.value ?
            fields.source_ids.value.split(',').map(function (s) {
              return s.trim();
            }).filter(Boolean) : []
        };
        var res = SCA.recovery.createRecoveryProfile(user2, data);
        if (res.ok) {
          msg.textContent = 'Profile created (PROPOSED). It can be ' +
            'marked DOCUMENTED once provenance is attached.';
          Object.keys(fields).forEach(function (k) {
            if (fields[k].value !== undefined) { fields[k].value = ''; }
          });
        } else {
          msg.textContent = Object.keys(res.errors || {}).map(function (k) {
            return k + ': ' + res.errors[k];
          }).join(' ');
        }
        rerender();
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

  /* ---------- RecoveryProfile detail ---------- */

  SCA.pages.recoveryProfileDetail = function (root, params) {
    var user = SCA.state.get('user');
    var res = SCA.recovery.getRecoveryProfile(user, params.id);
    root.innerHTML = '';
    if (!res.ok) {
      root.appendChild(SCA.ui.el('h1', {}, 'Recovery profile'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        res.errors.permission ||
          'Not documented in this dataset (this is not a claim that ' +
          'it does not exist).'));
      return;
    }
    var p = res.record;
    root.appendChild(SCA.ui.el('h1', {}, p.name || 'Recovery profile'));
    root.appendChild(statusBadge(p.status));
    root.appendChild(row('Recovery kind', p.recovery_kind));
    root.appendChild(row('Subject', p.asset_type + ' — ' +
      (SCA.repair.assetLabel(p.asset_type, p.asset_id) || p.asset_id)));
    root.appendChild(row('Target', p.target_type + ' — ' +
      (SCA.recovery.targetLabel(p) || p.target_id)));
    if (p.failure_scenario_id) {
      root.appendChild(row('Failure scenario', p.failure_scenario_id));
    }
    if (p.description) { root.appendChild(row('Description', p.description)); }
    if (p.conditions) { root.appendChild(row('Conditions', p.conditions)); }
    if (p.expected_recovery_time) {
      root.appendChild(row('Expected recovery time',
        p.expected_recovery_time));
    }
    if (p.limitations) { root.appendChild(row('Limitations', p.limitations)); }
    (['source_ids', 'knowledge_artifact_ids',
      'field_observation_ids', 'edge_citations']).forEach(function (f) {
      if (p[f] && p[f].length) {
        root.appendChild(row(f.replace(/_/g, ' '),
          p[f].length + ' referenced (provenance)'));
      }
    });
    if (p.reviewer) {
      root.appendChild(row('Reviewed by', p.reviewer));
      root.appendChild(row('Review reason', p.review_reason || ''));
    }
    if (p.supersedes_id) {
      root.appendChild(SCA.ui.el('p', {},
        'Supersedes ' + SCA.ui.el('a',
          { href: '#/recovery-profile/' + p.supersedes_id },
          'a retired profile') + '.'));
    }
    root.appendChild(muted('Version ' + (p.version || '1') +
      '. Verified or retired profiles are corrected through ' +
      'supersession, never in-place edits.'));
  };
})(SCA);
