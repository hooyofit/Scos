/*
 * Reserve pages (Stage 14: National Capability Reserve &
 * Institutional Continuity, frozen scope v1.1 + Gate C
 * implementation authorization).
 *
 * Two pages: the reserves register (#/reserves — neutral,
 * searchable, never ranked; deterministic ordering only) and the
 * reserve detail (#/reserves/:id — the reserve's own definition,
 * its assets, its continuity plans, its stewardship and its
 * lifecycle actions). Continuity plans have NO separate route
 * (frozen decision 5): they render inside reserve detail and
 * capability detail.
 *
 * Every view honors the frozen boundaries:
 *  - a reserve or plan NEVER implies the capability is resilient;
 *  - no battery percentage, no score, no ranking, no strongest/
 *    weakest reserve language — the National Capability Battery
 *    and the Capability Spine are presentational derived views
 *    only;
 *  - the One-Person Test renders with census semantics ("one
 *    practitioner is currently documented within the available
 *    evidence/census scope", never "only one person exists");
 *  - the creator is never OFFERED a review action on their own
 *    reserve or plan (creator/reviewer separation incl.
 *    NATIONAL; the workflow guard is the rule, the UI is only a
 *    courtesy);
 *  - a suspended reserve is displayed honestly next to its
 *    plans; the plan lifecycle is never auto-mutated;
 *  - custodian fields reference authoritative organizations and a
 *    populated successor field never implies a successor exists.
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
  function enumLabel(listName, code) {
    var list = SCA.enums[listName] || [];
    var found = list.filter(function (e) { return e.code === code; })[0];
    return found ? found.label : SCA.util.display(code);
  }
  function unknown(v, note) {
    if (v === null || v === undefined || v === '' ||
      (Array.isArray(v) && !v.length)) {
      return note || 'Not yet documented';
    }
    return null;
  }
  function reasonPrompt(action, cb) {
    return function () {
      var reason = window.prompt('Documented reason for ' + action +
        ' (required, audited):');
      if (reason === null) { return; }
      cb(reason);
    };
  }
  function showResult(res) {
    if (!res.ok) {
      var msgs = Object.keys(res.errors || {}).map(function (k) {
        return res.errors[k];
      }).join(' ');
      window.alert(msgs || 'Action refused.');
      return;
    }
    window.location.hash = window.location.hash;
    renderAll();
  }
  var RENDER = null;
  function renderAll() { if (RENDER) { RENDER(); } }

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'The National Capability Reserve documents what essential ' +
        'capabilities must survive, what people and knowledge ' +
        'reproduce them, and what sustains them.'),
      SCA.ui.el('p', { class: 'muted' },
        'The system does not declare resilience. It documents the ' +
        'conditions required for resilience. No scores, rankings ' +
        'or predictions exist here.'));
  }

  /* ---------- derived views: battery + spine (presentational) -- */

  function batteryCard() {
    var b = SCA.reserve.batteryView();
    var kids = [
      SCA.ui.el('h2', {}, 'National Capability Battery'),
      row('Reserves formally maintained (ACTIVE)',
        String(b.active_reserve_count) +
        ' (documented components only)'),
      muted('A presentational view of DOCUMENTED components ' +
        'belonging to ACTIVE reserves. No battery percentage, no ' +
        'score and no readiness judgement is calculated — a count ' +
        'is a documented-component tally with an explicit basis.')
    ];
    var catLines = Object.keys(b.components).map(function (c) {
      return row(enumLabel('asset_categories', c),
        String(b.components[c]) + ' documented');
    });
    kids.push.apply(kids, catLines);
    return SCA.ui.el('div', { class: 'card' }, kids);
  }

  function spineCard() {
    var sp = SCA.reserve.spineView();
    return SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Capability Spine'),
      SCA.ui.el('p', {}, sp.segments.join(' → ')),
      muted('Conceptual navigation across existing systems only. ' +
        'Not a taxonomy — the twelve frozen capability families ' +
        'remain authoritative.'));
  }

  /* ---------- reserves register ---------- */

  SCA.pages.reserves = function (root) {
    var q = { query: '', status: '' };

    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'reserve.read');
      var canCreate = SCA.rbac.can(user, 'reserve.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {},
        'National Capability Reserve'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'What must survive: the people, knowledge, tools, ' +
        'materials, institutions and fallback pathways that keep ' +
        'essential capabilities available across disruption and ' +
        'generations.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Reserve information requires ' +
          'signing in.'));
        return;
      }

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        batteryCard(), spineCard()));

      var res = SCA.reserve.list(user);
      var records = res.records || [];

      if (canCreate) {
        var name = '';
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Draft a new reserve'),
          muted('Drafts work offline. A reserve enters review only ' +
            'when its creator submits it; review and activation ' +
            'are human, audited actions.'),
          SCA.ui.el('input', { type: 'text',
            placeholder: 'Reserve name (required)',
            oninput: function (e) { name = e.target.value; } }),
          SCA.ui.el('button', { class: 'btn', onclick: function () {
            var out = SCA.reserve.createReserve(user, { name: name });
            showResult(out);
          } }, 'Create DRAFT reserve')));
      }

      root.appendChild(SCA.ui.el('h2', {}, 'Reserves register'));
      root.appendChild(SCA.ui.el('input', { type: 'search',
        placeholder: 'Search reserves…', value: q.query,
        oninput: function (e) {
          q.query = e.target.value;
          render();
        } }));
      root.appendChild(SCA.ui.el('select', {
        onchange: function (e) { q.status = e.target.value; render(); }
      }, [SCA.ui.el('option', { value: '', text: 'All statuses' })]
        .concat(SCA.reserve.STATUSES.map(function (s) {
          return SCA.ui.el('option', { value: s,
            text: enumLabel('reserve_statuses', s) });
        }))));

      var shown = records.filter(function (r) {
        if (q.status && r.status !== q.status) { return false; }
        if (q.query) {
          var hay = (r.name || '') + ' ' + (r.id || '');
          if (hay.toLowerCase().indexOf(
            q.query.toLowerCase()) === -1) { return false; }
        }
        return true;
      }).sort(function (a, b) {
        return String(a.id).localeCompare(String(b.id));
      });

      muted('Ordering is alphabetical by id and never implies ' +
        'quality or priority. ' + shown.length + ' of ' +
        records.length + ' reserve records shown (documented ' +
        'records, never a claim about what exists).');

      shown.forEach(function (r) {
        var cust = r.custodian_organization_id ?
          (SCA.store.get('organizations',
            r.custodian_organization_id) || {}).name : null;
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h3', {},
            SCA.ui.el('a', { href: '#/reserves/' + r.id,
              text: r.name || r.id })),
          statusBadge(r.status),
          row('Reserve types', unknown(r.reserve_types) ||
            r.reserve_types.map(function (t) {
              return enumLabel('reserve_types', t); }).join(', ')),
          row('Capabilities', unknown(r.capability_ids,
            'No capability reference documented') ||
            r.capability_ids.join(', ')),
          row('Custodian', cust ||
            'Not yet documented (required before ACTIVE)'),
          row('Continuity-plan statuses',
            unknown(r.continuity_plan_statuses) ||
            r.continuity_plan_statuses.join(', ')),
          row('Known gaps', unknown(r.known_gaps) ||
            r.known_gaps.join(', ')),
          row('Last review', r.reviewed_at || 'Not yet reviewed')));
      });
    }
    RENDER = render;
    render();
  };

  /* ---------- reserve detail ---------- */

  SCA.pages.reserveDetail = function (root, params) {
    function render() {
      var user = SCA.state.get('user');
      root.innerHTML = '';
      var rec = SCA.reserve.get(params.id);
      if (!rec) {
        root.appendChild(SCA.ui.el('h1', {}, 'Reserve'));
        root.appendChild(muted('Unknown reserve: ' + params.id));
        return;
      }
      var isCreator = user && user.name === rec.created_by;

      root.appendChild(SCA.ui.el('h1', {}, rec.name || rec.id));
      root.appendChild(statusBadge(rec.status));
      root.appendChild(muted('A reserve documents stewardship ' +
        'structure. It NEVER implies the capability is resilient.'));

      /* Definition. */
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Definition'),
        row('Name', rec.name),
        row('Description', unknown(rec.description)),
        row('Continuity scope', unknown(rec.continuity_scope)),
        row('Activation conditions', unknown(rec.activation_conditions)),
        row('Reserve types', unknown(rec.reserve_types) ||
          rec.reserve_types.map(function (t) {
            return enumLabel('reserve_types', t); }).join(', ')),
        row('Capabilities', unknown(rec.capability_ids) ||
          rec.capability_ids.join(', ')),
        row('Locations', unknown(rec.location_ids) ||
          rec.location_ids.join(', ')),
        row('Known gaps', unknown(rec.known_gaps) ||
          rec.known_gaps.join(', ')),
        row('Stewardship notes', unknown(rec.stewardship_notes)),
        row('Safety notes', unknown(rec.safety_notes))));

      /* Stewardship (frozen custodian rules). */
      var custOrg = rec.custodian_organization_id ?
        SCA.store.get('organizations',
          rec.custodian_organization_id) : null;
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Stewardship'),
        row('Owner organization', rec.owner_organization_id ?
          ((SCA.store.get('organizations',
            rec.owner_organization_id) || {}).name ||
            rec.owner_organization_id) : 'Not yet documented'),
        row('Custodian organization', custOrg ?
          custOrg.name : 'Not yet documented'),
        muted('VERIFIED means the reserve definition passed ' +
          'review. ACTIVE means it additionally has a documented ' +
          'custodian and is formally maintained (frozen decision ' +
          '3).'),
        row('Successor custodian',
          rec.successor_custodian_organization_id ?
          ((SCA.store.get('organizations',
            rec.successor_custodian_organization_id) || {}).name ||
            rec.successor_custodian_organization_id) :
          'Not yet documented'),
        row('Secondary custodian',
          rec.secondary_custodian_organization_id ?
          ((SCA.store.get('organizations',
            rec.secondary_custodian_organization_id) || {}).name ||
            rec.secondary_custodian_organization_id) :
          'Not yet documented'),
        muted('A populated successor or secondary field is a ' +
          'documented reference — it never implies the successor ' +
          'role is staffed or that continuity is guaranteed.')));

      /* Assets by frozen category. */
      var assets = SCA.reserve.assetsOf(rec.id);
      var assetCard = SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Reserve assets'),
        muted('Each asset references an authoritative existing ' +
          'record; Stage 14 duplicates nothing. BIOLOGICAL assets ' +
          'may be documentation-only ("Not yet documented") where ' +
          'no authoritative biological record exists.'));
      SCA.reserve.ASSET_CATEGORIES.forEach(function (cat) {
        var list = assets.filter(function (a) {
          return a.asset_category === cat; });
        if (!list.length) { return; }
        assetCard.appendChild(row(enumLabel('asset_categories', cat),
          list.map(function (a) {
            var ref = a.reference_id ? (a.reference_type + ': ' +
              a.reference_id) : 'Not yet documented';
            return ref;
          }).join(' · ')));
      });
      if (!assets.length) {
        assetCard.appendChild(muted('No reserve assets documented ' +
          'yet. Assets may be composed while the reserve is DRAFT.'));
      } else if (isCreator && rec.status === 'DRAFT' &&
        SCA.rbac.can(user, 'reserve.update')) {
        assetCard.appendChild(SCA.ui.el('input', {
          type: 'text',
          id: 'asset-category-' + rec.id,
          placeholder: 'Asset category (e.g. HUMAN, TOOL)' }));
        assetCard.appendChild(SCA.ui.el('input', {
          type: 'text',
          id: 'asset-reference-type-' + rec.id,
          placeholder: 'Reference type (e.g. practitioners)' }));
        assetCard.appendChild(SCA.ui.el('input', {
          type: 'text',
          id: 'asset-reference-id-' + rec.id,
          placeholder: 'Reference id' }));
        assetCard.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var cat = document.getElementById(
              'asset-category-' + rec.id).value.trim();
            var rt = document.getElementById(
              'asset-reference-type-' + rec.id).value.trim();
            var ri = document.getElementById(
              'asset-reference-id-' + rec.id).value.trim();
            showResult(SCA.reserve.createAsset(user, {
              reserve_id: rec.id, asset_category: cat,
              reference_type: rt || null, reference_id: ri || null }));
          } }, 'Add asset'));
      }
      root.appendChild(assetCard);

      /* Continuity plans (no separate route — frozen decision 5). */
      var plans = SCA.reserve.plansForReserve(rec.id);
      var planCard = SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Continuity plans'),
        muted('A plan documents what must be preserved and ' +
          'reproduced for a capability to continue. Its lifecycle ' +
          'is INDEPENDENT of this reserve.'));
      plans.forEach(function (p) {
        planCard.appendChild(SCA.ui.el('p', {},
          statusBadge(p.status),
          SCA.ui.el('span', { text: '  ' + p.id + ' — ' +
            (p.known_gaps || []).join(', ') })));
      });
      if (!plans.length) {
        planCard.appendChild(muted('No continuity plans reference ' +
          'this reserve yet.'));
      }
      if (rec.status === 'SUSPENDED') {
        planCard.appendChild(SCA.ui.el('p', { class: 'notice' },
          'This reserve is currently SUSPENDED. Plans keep their ' +
          'own lifecycle states; nothing is auto-mutated here.'));
      }
      root.appendChild(planCard);

      /* Lifecycle actions (UI is a courtesy; the workflow guard is
       * the rule; the creator is never offered review actions). */
      var actions = SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Lifecycle'),
        row('Created by', rec.created_by || 'Not yet documented'),
        row('Reviewed by', rec.reviewer || 'Not yet reviewed'),
        row('Reviewed at', rec.reviewed_at || '—'));
      function act(label, fn) {
        actions.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: fn }, label));
      }
      if (rec.status === 'DRAFT') {
        if (isCreator && SCA.rbac.can(user, 'reserve.update')) {
          act('Submit for review', function () {
            showResult(SCA.reserve.submitReserve(user, rec.id));
          });
        }
      } else if (rec.status === 'SUBMITTED') {
        if (SCA.rbac.can(user, 'reserve.review') && !isCreator) {
          act('Verify (approve definition)',
            reasonPrompt('verification', function (reason) {
              showResult(SCA.reserve.verifyReserve(user, rec.id,
                reason));
            }));
          act('Reject (terminal)',
            reasonPrompt('rejection', function (reason) {
              showResult(SCA.reserve.rejectReserve(user, rec.id,
                reason));
            }));
        } else {
          actions.appendChild(muted('Awaiting review by an ' +
            'authorized reviewer (never the creator).'));
        }
      } else if (rec.status === 'VERIFIED') {
        if (SCA.rbac.can(user, 'reserve.review') && !isCreator) {
          act('Activate (documented custodian required)',
            reasonPrompt('activation', function (reason) {
              showResult(SCA.reserve.activateReserve(user, rec.id,
                reason));
            }));
        }
        actions.appendChild(muted('Activation requires a documented ' +
          'custodian; there is no automatic activation.'));
      } else if (rec.status === 'ACTIVE') {
        if (isCreator && SCA.rbac.can(user, 'reserve.update')) {
          act('Suspend maintenance',
            reasonPrompt('suspension', function (reason) {
              showResult(SCA.reserve.suspendReserve(user, rec.id,
                reason));
            }));
        }
      } else if (rec.status === 'SUSPENDED') {
        if (SCA.rbac.can(user, 'reserve.review') && !isCreator) {
          act('Resume maintenance',
            reasonPrompt('resumption', function (reason) {
              showResult(SCA.reserve.resumeReserve(user, rec.id,
                reason));
            }));
        }
      }
      if ((rec.status === 'ACTIVE' || rec.status === 'SUSPENDED') &&
        SCA.rbac.can(user, 'reserve.retire')) {
        act('Retire (terminal)',
          reasonPrompt('retirement', function (reason) {
            showResult(SCA.reserve.retireReserve(user, rec.id,
              reason));
          }));
      }
      if (SCA.reserve.TERMINAL.indexOf(rec.status) !== -1) {
        actions.appendChild(muted('This record is terminal and ' +
          'immutable. Terminal history is preserved; no ' +
          'resurrection exists.'));
      }
      root.appendChild(actions);
    }
    RENDER = render;
    render();
  };
})(SCA);
