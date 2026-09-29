/*
 * Capability Atlas (Stage 2): 240 inventory records, searchable and
 * filterable. Search matches exact/partial code, partial name, family
 * (name and code), evidence level and verification status. Unknown fields
 * display as "Not yet documented". No analytics, rankings or graphs: those
 * belong to later stages.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.capabilities = function (root) {
    var filters = {
      query: '',
      family: '', evidence_level: '', living_status: '',
      action: '', capability_maturity: '', region: ''
    };

    function familyMap() {
      var map = {};
      SCA.store.all('families').forEach(function (f) { map[f.id] = f; });
      return map;
    }

    function applyFilters() {
      var fams = familyMap();
      return SCA.store.all('capabilities').filter(function (c) {
        if (filters.family && c.family_id !== filters.family) { return false; }
        if (filters.evidence_level && c.evidence_level !== filters.evidence_level) { return false; }
        if (filters.living_status && c.living_status !== filters.living_status) { return false; }
        if (filters.action && c.action !== filters.action) { return false; }
        if (filters.capability_maturity && c.capability_maturity !== filters.capability_maturity) { return false; }
        if (filters.region &&
            !(c.region || '').toLowerCase().includes(filters.region.toLowerCase())) { return false; }
        var fam = fams[c.family_id];
        return SCA.models.capability.matchesQuery(c,
          fam ? fam.name : '', fam ? fam.code : '', filters.query);
      });
    }

    function capabilityCard(c) {
      var fam = familyMap()[c.family_id];
      return SCA.ui.el('article', { class: 'card capability-card' },
        SCA.ui.el('div', { class: 'card-top' },
          SCA.ui.el('h3', {},
            SCA.ui.el('a', { class: 'link', href: '#/capabilities/' + c.id }, c.name)),
          SCA.ui.el('code', { class: 'cap-code', text: c.code })),
        SCA.ui.el('p', { class: 'card-meta', text: 'Family: ' + (fam ? fam.code + ' — ' + fam.name : SCA.util.display(null)) }),
        SCA.ui.el('div', { class: 'badge-row' },
          SCA.ui.badge('Evidence: ' + (c.evidence_level ? c.evidence_level + ' — ' +
            SCA.enums.label(SCA.enums.evidence_levels, c.evidence_level) : 'Not yet documented'), 'muted'),
          SCA.ui.badge('Verification: ' + SCA.util.display(c.verification_status), 'muted'),
          SCA.ui.badge('Documentation: ' + SCA.util.display(c.documentation_status), 'accent')),
        SCA.ui.el('p', { class: 'card-meta' },
          SCA.ui.el('a', { class: 'btn btn-ghost btn-small', href: '#/capabilities/' + c.id }, 'View record')));
    }

    function renderResults() {
      results.innerHTML = '';
      var list = applyFilters();
      results.appendChild(SCA.ui.el('p', { class: 'result-count', text:
        list.length + (list.length === 1 ? ' capability' : ' capabilities') + ' found' }));

      if (!list.length) {
        results.appendChild(SCA.ui.emptyState({
          title: 'No capabilities match',
          message: 'No record matches the current search and filters. ' +
            'The inventory contains 240 identified capabilities; unknown ' +
            'fields are shown as "Not yet documented".'
        }));
        return;
      }
      list.forEach(function (c) { results.appendChild(capabilityCard(c)); });
    }

    /* URL param support: #/capabilities?family=<id> */
    var presetFamily = (location.hash.split('?')[1] || '').split('=')
      .filter(Boolean)[1];
    if (presetFamily) { filters.family = presetFamily; }

    var results = SCA.ui.el('div', { class: 'results' });

    var familyOptions = SCA.store.all('families')
      .sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); })
      .map(function (f) { return { value: f.id, label: f.code + ' — ' + f.name }; });

    var controls = [
      { key: 'family', label: 'Family', options: familyOptions },
      { key: 'evidence_level', label: 'Evidence level',
        options: SCA.enums.optionList(SCA.enums.evidence_levels) },
      { key: 'living_status', label: 'Status',
        options: SCA.enums.optionList(SCA.enums.living_status) },
      { key: 'action', label: 'Action',
        options: SCA.enums.optionList(SCA.enums.actions) },
      { key: 'capability_maturity', label: 'Capability maturity',
        options: SCA.enums.optionList(SCA.enums.maturity) }
    ];

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Capability Atlas',
        '240 identified capabilities across 12 families. A record here means the ' +
        'capability has been identified as a research subject — not that it has been ' +
        'verified, was universally practiced, is currently practiced, or should be revived.'),
      SCA.ui.el('p', { class: 'page-subtitle' },
        SCA.ui.el('a', { class: 'link', href: '#/families' }, 'View the 12 capability families')),
      SCA.ui.el('form', { class: 'filter-bar', onsubmit: function (e) { e.preventDefault(); } },
        SCA.ui.el('label', { class: 'filter filter-wide' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Search'),
          (function () {
            var i = SCA.ui.el('input', { type: 'search',
              placeholder: 'Code (W11), name (rain), family (Water) or evidence (E0)',
              'aria-label': 'Search capabilities' });
            i.addEventListener('input', function () {
              filters.query = i.value;
              renderResults();
            });
            return i;
          })()),
        controls.map(function (c) {
          var s = SCA.ui.select(c.key, c.options, filters[c.key]);
          s.setAttribute('aria-label', c.label);
          s.addEventListener('change', function () {
            filters[c.key] = s.value;
            renderResults();
          });
          return SCA.ui.el('label', { class: 'filter' },
            SCA.ui.el('span', { class: 'filter-label', text: c.label }), s);
        }),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Region'),
          (function () {
            var i = SCA.ui.el('input', { type: 'search', placeholder: 'Region name',
              'aria-label': 'Region' });
            i.addEventListener('input', function () {
              filters.region = i.value;
              renderResults();
            });
            return i;
          })())),
      results));

    renderResults();
  };
})(SCA);
