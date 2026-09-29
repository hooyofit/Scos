/* Home page. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.home = function (root) {
    var btn = function (label, href, primary) {
      return SCA.ui.el('a', {
        class: 'btn ' + (primary ? 'btn-primary' : 'btn-secondary'),
        href: href
      }, label);
    };

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.el('section', { class: 'hero' },
        SCA.ui.el('h1', { class: 'hero-title' },
          'Preserve Knowledge. Build Capability. Prepare the Future.'),
        SCA.ui.el('p', { class: 'hero-sub' },
          'An evidence-based capability atlas connecting Somali knowledge, people, technology, repair, training and resilience.'),
        SCA.ui.el('div', { class: 'hero-actions' },
          btn('Explore the Capability Atlas', '#/capabilities', true),
          btn('Explore Families', '#/families'),
          btn('Document Knowledge', '#/knowledge'),
          btn('People', '#/people'),
          btn('Training', '#/training'))),
      SCA.ui.el('p', { class: 'hero-explain' },
        'The platform connects historical knowledge, living practitioners, modern technology, technical repair, apprenticeship, evidence and national resilience.'),
      SCA.ui.el('section', { class: 'stat-strip' },
        stat('Capability families', String(SCA.store.count('families'))),
        stat('Capabilities in inventory', String(SCA.store.count('capabilities')) +
          ' — all E0, unverified'),
        stat('Evidence framework', 'E0 — E5'),
        stat('Maturity scale', 'L0 — L9')),
      SCA.ui.el('section', { class: 'philosophy-strip' },
        SCA.ui.el('p', { class: 'philosophy-main', text: '«Modernize without forgetting.»' }),
        SCA.ui.el('a', { class: 'link', href: '#/about' }, 'Read the methodology'))));

    function stat(label, value) {
      return SCA.ui.el('div', { class: 'stat' },
        SCA.ui.el('div', { class: 'stat-value', text: value }),
        SCA.ui.el('div', { class: 'stat-label', text: label }));
    }
  };
})(SCA);
