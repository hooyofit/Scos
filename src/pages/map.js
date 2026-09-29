/* Map page (Stage 6): map-ready data layer, offline, no external map
 * provider. A textual/geographic hierarchy view that works with zero
 * network access; precise practitioner locations are never exposed. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};
  SCA.pages.map = function (root) {
    var user = SCA.state.get('user');
    var d = SCA.census.mapData(user);

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Atlas Map',
        'Geographic coverage of documented capability data. Offline, ' +
        'provider-independent: this is the data layer, not a rented map.'),
      SCA.ui.el('div', { class: 'notice' },
        SCA.ui.el('p', { text: 'Locations without data show as Not ' +
          'Surveyed - that is information about the Atlas, never a ' +
          'finding that capabilities are absent. Precise practitioner ' +
          'locations are never shown publicly without consent.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Documented coverage' }),
        SCA.ui.el('p', { class: 'detail-row' },
          SCA.ui.el('span', { class: 'detail-label', text: 'Capabilities' }),
          SCA.ui.el('span', { text: String(d.capability_count) })),
        SCA.ui.el('p', { class: 'detail-row' },
          SCA.ui.el('span', { class: 'detail-label',
            text: 'Public practitioners (consented)' }),
          SCA.ui.el('span', { text: SCA.util.display(d.public_practitioner_count) })),
        SCA.ui.el('p', { class: 'detail-row' },
          SCA.ui.el('span', { class: 'detail-label', text: 'Organizations' }),
          SCA.ui.el('span', { text: String(d.organization_count) }))),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Locations' }),
        d.locations.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, d.locations.map(function (l) {
              return SCA.ui.el('li', {},
                SCA.ui.el('span', { text: l.name }),
                SCA.ui.badge(' ' + SCA.util.display(l.type), 'muted'),
                SCA.ui.badge(' ' + (l.survey === 'SURVEYED'
                  ? 'Surveyed (' + l.documented_observations + ' observations)'
                  : 'Not Surveyed'), l.survey === 'SURVEYED' ? 'accent' : 'muted'),
                l.coordinates
                  ? SCA.ui.badge(' coordinates documented', 'muted')
                  : null);
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'No locations have been entered into the Atlas yet. ' +
                'The Atlas does not ship real Somali geographic data: ' +
                'locations are entered deliberately by researchers.' })),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/census' },
          'Open the Capability Census'))));
  };
})(SCA);
