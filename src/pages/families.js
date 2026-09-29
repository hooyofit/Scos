/* Families page: the 12 capability families. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.families = function (root) {
    var families = SCA.store.all('families')
      .sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); });

    var capsByFamily = {};
    SCA.store.all('capabilities').forEach(function (c) {
      capsByFamily[c.family_id] = (capsByFamily[c.family_id] || 0) + 1;
    });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Capability Families',
        'The atlas organizes capabilities into ' + families.length + ' families.'),
      SCA.ui.el('div', { class: 'card-grid' },
        families.map(function (f) {
          return SCA.ui.el('article', { class: 'card family-card' },
            SCA.ui.el('div', { class: 'card-top' },
              SCA.ui.badge(f.code, 'accent'),
              SCA.ui.el('span', { class: 'card-count',
                text: (capsByFamily[f.id] || 0) + ' capabilities' })),
            SCA.ui.el('h3', { text: f.name }),
            SCA.ui.el('p', { text: SCA.util.display(f.description) }),
            SCA.ui.el('a', {
              class: 'link',
              href: '#/capabilities?family=' + encodeURIComponent(f.id)
            }, 'View capabilities'));
        }))));
  };
})(SCA);
