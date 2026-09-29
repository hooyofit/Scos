/*
 * Marketplace pages (Stage 13: Capability Marketplace, frozen
 * scope v1.0 + implementation authorization v1.0).
 *
 * Two pages: the marketplace register (neutral, searchable,
 * never ranked — deterministic ordering only) and the listing
 * detail (the listing's own assertion, its references, its
 * declared availability, its lifecycle and its review actions).
 *
 * Every view honors the frozen boundaries:
 *  - the marketplace is a DISCOVERY AND CONNECTION layer: it
 *    records that a service can be provided or is needed. It never
 *    brokers, prices, contracts, schedules or transacts;
 *  - a listing references EXISTING authoritative records — the
 *    page links out and renders the provider's own stage-defined
 *    public information (practitioners render through their Stage 5
 *    masking profile; no contact field ever appears on a listing);
 *  - if a referenced provider is no longer available, the listing
 *    renders the honest notice "Referenced provider no longer
 *    available" — the lifecycle is NEVER auto-mutated; a human
 *    pauses or withdraws it;
 *  - matching is a derived read-only view with its basis
 *    displayed; it creates no records and no scores;
 *  - ordering is deterministic (recency, then stable id) and
 *    never implies quality, trust, popularity or recommendation;
 *  - publication requires an independent reviewer — the creator is
 *    never offered a review action on their own listing
 *    (creator/reviewer separation incl. NATIONAL; the workflow
 *    guard is the rule, the UI is only a courtesy).
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

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'A directory of capability services, not a marketplace ' +
        'transaction platform.'),
      SCA.ui.el('p', { class: 'muted' },
        'A listing is a documented, reviewed assertion that a ' +
        'capability service can be provided (OFFER) or is needed ' +
        '(NEED) — repair, training, fabrication, local production ' +
        'and more. Publication means the listing passed the ' +
        'marketplace publication gate; it never means the atlas ' +
        'guarantees the service. Connection happens through the ' +
        'referenced provider\'s own public profile. Nothing here ' +
        'ranks, scores or recommends.'));
  }

  /* ---------- provider rendering (privacy: structural) ---------- */

  function providerCard(user, l) {
    var ps = SCA.marketplace.providerStatus(l);
    var wrap = SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Provider'),
      row('Provider type', enumLabel('marketplace_provider_types',
        l.provider_type)));

    if (!ps.available) {
      wrap.appendChild(muted(ps.message));
      wrap.appendChild(muted('The listing is NOT auto-mutated: a ' +
        'human pauses or withdraws it according to the frozen ' +
        'lifecycle rules.'));
    } else if (l.provider_type === 'PRACTITIONER') {
      var profile = SCA.training.profileFor(user, l.provider_id);
      if (profile) {
        wrap.appendChild(row('Public name', profile.anonymous ?
          'Anonymous practitioner (masked)' : profile.public_name));
        wrap.appendChild(muted('Rendered under the Stage 5 ' +
          'practitioner privacy rules. A listing carries no ' +
          'contact details of any kind.'));
      } else {
        wrap.appendChild(muted('Practitioner profile not available.'));
      }
    } else {
      var coll = SCA.marketplace.PROVIDER_COLLECTIONS[l.provider_type];
      var p = SCA.store.get(coll, l.provider_id);
      if (p) {
        wrap.appendChild(row('Name', p.name || p.public_name || p.id));
        if (p.status) {
          wrap.appendChild(row('Provider status', SCA.util.display(
            p.status) + ' (authoritative in its own stage)'));
        }
      } else {
        wrap.appendChild(muted('Provider record not available.'));
      }
    }
    wrap.appendChild(muted('Verification and competence belong to ' +
      'the referenced record\'s own stage — a listing never ' +
      'manufactures provider identity or provider quality.'));
    return wrap;
  }

  /* ---------- Marketplace register ---------- */

  SCA.pages.marketplaceRegister = function (root) {
    var q = { query: '', kind: '', service_kind: '' };

    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'marketplace.read');
      var canCreate = SCA.rbac.can(user, 'marketplace.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Capability Marketplace'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'Connect people who need capabilities with people and ' +
        'organizations capable of providing, teaching, repairing, ' +
        'producing or reproducing them.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Marketplace information requires ' +
          'signing in.'));
        return;
      }

      var list = SCA.marketplace.list(user).filter(function (l) {
        if (q.kind && l.listing_kind !== q.kind) { return false; }
        if (q.service_kind && l.service_kind !== q.service_kind) {
          return false;
        }
        if (q.query) {
          var hay = (l.description || '') + ' ' + (l.notes || '') +
            ' ' + (l.service_kind || '');
          if (hay.toLowerCase().indexOf(
            q.query.toLowerCase()) === -1) { return false; }
        }
        return true;
      });

      var ov = SCA.marketplace.overview(user);

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Listings documented'),
          row('Records visible to you in this dataset',
            String(list.length) + ' (not a claim about what exists)'),
          row('OFFERs', String(ov.counts.by_kind.OFFER)),
          row('NEEDs', String(ov.counts.by_kind.NEED))),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Find listings'),
          muted('Neutral search by description, notes or service ' +
            'kind. The register never ranks, scores or recommends.'),
          SCA.ui.el('input', { type: 'search',
            placeholder: 'Search listings…',
            value: q.query,
            oninput: function (e) {
              q.query = e.target.value;
              render();
            } }),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) {
                q.kind = e.target.value;
                render();
              }
            }, [SCA.ui.el('option', { value: '',
              text: 'All listing kinds' }),
              SCA.ui.el('option', { value: 'OFFER',
                text: 'OFFERs' }),
              SCA.ui.el('option', { value: 'NEED',
                text: 'NEEDs' })])),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) {
                q.service_kind = e.target.value;
                render();
              }
            }, [SCA.ui.el('option', { value: '',
              text: 'All service kinds' })]
              .concat(SCA.enums.optionList(
                SCA.enums.marketplace_service_kinds).map(
                function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              })))))));

      /* Derived matching view (read-only; basis displayed; never a
       * ranking of any kind). */
      var m = SCA.marketplace.matches(user);
      if (m.ok && m.pairs.length) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Matches (derived view)'),
          muted('Published OFFERs paired with published NEEDs that ' +
            'share a capability, a service kind or a location. ' +
            'Read-only: no match records, no commitments, no scores.'),
          SCA.ui.el('ul', { class: 'plain-list' },
            m.pairs.map(function (pair) {
              return SCA.ui.el('li', {},
                SCA.ui.el('a', { href: '#/marketplace/' +
                  pair.offer_id }, pair.offer_id),
                ' — ',
                SCA.ui.el('a', { href: '#/marketplace/' +
                  pair.need_id }, pair.need_id),
                ' — basis: ' + pair.basis.join('; '));
            }))));
      }

      if (canCreate) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Record a listing (draft)'),
          muted('Creates a DRAFT in your local dataset — fully ' +
            'offline-capable. Nothing is published until a reviewer ' +
            'other than you publishes it.'),
          renderCreateForm(user)));
      }

      root.appendChild(SCA.ui.el('h2', {}, 'Listing register'));
      if (!list.length) {
        root.appendChild(muted('No marketplace listings documented ' +
          'here yet (this is not a claim that no services exist).'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          list.map(function (l) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/marketplace/' + l.id },
                l.listing_kind + ' — ' + enumLabel(
                  'marketplace_service_kinds', l.service_kind)),
              ' — ' + SCA.util.display(l.status) +
              (l.description ? ' — ' + l.description : ''));
          })));
      }
    }

    function renderCreateForm(user) {
      var f = {
        listing_kind: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.marketplace_listing_kinds)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        service_kind: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.marketplace_service_kinds)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        provider_type: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.marketplace_provider_types)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        provider_id: SCA.ui.el('input', { type: 'text',
          placeholder: 'Provider record id (must exist; canonical)' }),
        on_behalf_reason: SCA.ui.el('input', { type: 'text',
          placeholder: 'On-behalf-of reason (required when listing ' +
            'another actor\'s practitioner record)' }),
        capability_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Capability ids, comma-separated (optional; ' +
            'zero links is honest)' }),
        repair_capability_id: SCA.ui.el('input', { type: 'text',
          placeholder: 'Repair capability id (REPAIR listings only, ' +
            'optional)' }),
        location_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Location ids, comma-separated (SPECIFIC ' +
            'scope requires at least one)' }),
        location_scope: SCA.ui.el('select', {},
          SCA.enums.optionList(
            SCA.enums.marketplace_location_scopes).map(function (o) {
            return SCA.ui.el('option', { value: o.value,
              text: o.label });
          })),
        availability_status: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.marketplace_availability)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        description: SCA.ui.el('input', { type: 'text',
          placeholder: 'What exactly is offered or needed' })
      };
      var feedback = SCA.ui.el('p', { class: 'muted' });

      function submit() {
        var data = {
          listing_kind: f.listing_kind.value,
          service_kind: f.service_kind.value,
          provider_type: f.provider_type.value,
          provider_id: f.provider_id.value || null,
          on_behalf_of: f.on_behalf_reason.value ?
            { reason: f.on_behalf_reason.value } : null,
          capability_ids: (f.capability_ids.value || '').split(',')
            .map(function (s) { return s.trim(); })
            .filter(Boolean),
          repair_capability_id:
            f.repair_capability_id.value || null,
          location_ids: (f.location_ids.value || '').split(',')
            .map(function (s) { return s.trim(); })
            .filter(Boolean),
          location_scope: f.location_scope.value,
          availability_status: f.availability_status.value,
          description: f.description.value
        };
        var res = SCA.marketplace.createListing(user, data);
        feedback.textContent = '';
        if (res.ok) {
          SCA.router.navigate('#/marketplace/' + res.record.id);
          return;
        }
        feedback.textContent = 'Draft not created: ' +
          Object.keys(res.errors || {}).map(function (k) {
            return k + ' — ' + res.errors[k];
          }).join('; ');
      }

      return SCA.ui.el('div', {}, [
        f.listing_kind, f.service_kind, f.provider_type,
        f.provider_id, f.on_behalf_reason, f.capability_ids,
        f.repair_capability_id, f.location_ids, f.location_scope,
        f.availability_status, f.description,
        SCA.ui.el('p', {},
          SCA.ui.el('button', { class: 'btn', onclick: submit },
            'Create draft')),
        feedback
      ]);
    }

    render();
  };

  /* ---------- Listing detail ---------- */

  SCA.pages.marketplaceDetail = function (root, params) {
    function render() {
      var user = SCA.state.get('user');
      root.innerHTML = '';
      var res = SCA.marketplace.get(user, params.id);
      if (!res.ok) {
        root.appendChild(SCA.ui.el('h1', {}, 'Marketplace listing'));
        root.appendChild(muted(res.errors &&
          (res.errors.id || res.errors.permission) ||
          'Not found.'));
        return;
      }
      var l = res.record;

      root.appendChild(SCA.ui.el('h1', {}, 'Marketplace listing'));
      root.appendChild(statusBadge(l.status));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        l.listing_kind + ' — ' + enumLabel('marketplace_service_kinds',
          l.service_kind)));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'The listing'),
        row('What', SCA.util.display(l.description)),
        row('Listing kind', enumLabel('marketplace_listing_kinds',
          l.listing_kind)),
        row('Service kind', enumLabel('marketplace_service_kinds',
          l.service_kind)),
        row('Capability links', (l.capability_ids || []).length ?
          l.capability_ids.map(function (id) {
            var c = SCA.store.get('capabilities', id);
            return c ? (c.name + ' (' + id + ')') : id;
          }).join('; ') : 'None linked — "Not yet documented"'),
        l.repair_capability_id ? row('Repair capability',
          l.repair_capability_id) : null,
        row('Locations', (l.location_ids || []).length ?
          l.location_ids.map(function (id) {
            var loc = SCA.store.get('locations', id);
            return loc ? loc.name : id;
          }).join(', ') : 'Not location-bound'),
        row('Location scope', enumLabel('marketplace_location_scopes',
          l.location_scope)),
        row('Declared availability', enumLabel('marketplace_availability',
          l.availability_status)),
        l.availability_note ? row('Availability note',
          SCA.util.display(l.availability_note)) : null,
        l.on_behalf_of ? row('Recorded on behalf of the provider',
          'Yes — reason documented and audited') : null,
        muted('A listing carries no contact details of any kind; ' +
          'connection happens through the provider\'s own public ' +
          'profile under its stage\'s visibility rules.')));

      root.appendChild(providerCard(user, l));

      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Lifecycle & governance'),
        row('Created by', SCA.util.display(l.created_by)),
        row('Created at', SCA.util.display(l.created_at)),
        l.reviewer ? row('Reviewed by', l.reviewer) : null,
        l.reviewed_at ? row('Reviewed at', l.reviewed_at) : null,
        l.review_reason ? row('Review reason', l.review_reason) : null,
        l.withdrawn_by ? row('Withdrawn by', l.withdrawn_by) : null,
        l.withdrawn_at ? row('Withdrawn at', l.withdrawn_at) : null,
        l.withdraw_reason ? row('Withdrawal reason',
          l.withdraw_reason) : null,
        muted('Publication means the listing passed the marketplace ' +
          'publication gate — it never certifies service quality.'),
        renderActions(user, l)));
    }

    function renderActions(user, l) {
      var wrap = SCA.ui.el('div', {});
      var isCreator = l.created_by ===
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

      if (l.status === 'DRAFT' && isCreator &&
        SCA.rbac.can(user, 'marketplace.update')) {
        wrap.appendChild(muted('This draft is editable by you and ' +
          'locked after submission.'));
      }
      if (l.status === 'DRAFT' && isCreator) {
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: run(function () {
            return SCA.marketplace.submitListing(user, l.id);
          }) }, 'Submit for review'));
      }
      if (l.status === 'SUBMITTED' &&
        SCA.rbac.can(user, 'marketplace.review') && !isCreator) {
        var reason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Documented review reason (required)' });
        wrap.appendChild(reason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.publishListing(user, l.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Publication refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Publish'));
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.rejectListing(user, l.id,
              reason.value);
            msg.textContent = res.ok ? '' :
              'Rejection refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Reject'));
      }
      if (l.status === 'PUBLISHED' && isCreator &&
        SCA.rbac.can(user, 'marketplace.update')) {
        var avail = SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.marketplace_availability)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            }));
        var aReason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Amendment reason (required, audited)' });
        wrap.appendChild(muted('Declared availability is the only ' +
          'amendable field; structural changes require withdrawal ' +
          'and a successor listing.'));
        wrap.appendChild(avail);
        wrap.appendChild(aReason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.amendAvailability(user, l.id,
              avail.value, null, aReason.value);
            msg.textContent = res.ok ? '' :
              'Amendment refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Amend availability'));
        var pReason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Pause reason (required, audited)' });
        wrap.appendChild(pReason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.pauseListing(user, l.id,
              pReason.value);
            msg.textContent = res.ok ? '' :
              'Pause refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Pause'));
      }
      if (l.status === 'PAUSED' && isCreator) {
        var rReason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Resume reason (required, audited)' });
        wrap.appendChild(rReason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.resumeListing(user, l.id,
              rReason.value);
            msg.textContent = res.ok ? '' :
              'Resume refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Resume'));
      }
      if ((l.status === 'PUBLISHED' || l.status === 'PAUSED') &&
        isCreator) {
        var wReason = SCA.ui.el('input', { type: 'text',
          placeholder: 'Withdrawal reason (required, terminal)' });
        wrap.appendChild(wReason);
        wrap.appendChild(SCA.ui.el('button', { class: 'btn',
          onclick: function () {
            var res = SCA.marketplace.withdrawListing(user, l.id,
              wReason.value);
            msg.textContent = res.ok ? '' :
              'Withdrawal refused: ' + Object.keys(res.errors || {})
                .map(function (k) { return res.errors[k]; })
                .join(' ');
            render();
          } }, 'Withdraw (terminal)'));
      }
      if (isCreator) {
        wrap.appendChild(muted('As the creator you cannot review ' +
          'this listing — creator/reviewer separation applies at ' +
          'every role level, including national administrator.'));
      }
      wrap.appendChild(msg);
      return wrap;
    }

    render();
  };
})(SCA);
