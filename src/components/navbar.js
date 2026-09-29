/* Site navigation: sections per the project specification.
   Primary sections: Home, Capability Atlas, Knowledge, People, Map,
   Training, About. Export stays one click away in the footer. */
(function (SCA) {
  'use strict';
  var LINKS = [
    { hash: '#/', label: 'Home' },
    { hash: '#/capabilities', label: 'Capability Atlas' },
    { hash: '#/knowledge', label: 'Knowledge' },
    { hash: '#/evidence', label: 'Evidence' },
    { hash: '#/people', label: 'People' },
    { hash: '#/map', label: 'Map' },
    { hash: '#/training', label: 'Training' },
    { hash: '#/graph', label: 'Graph' },
    { hash: '#/repair', label: 'Repair' },
    { hash: '#/recovery', label: 'Recovery' },
    { hash: '#/interventions', label: 'Interventions' },
    { hash: '#/pilots', label: 'Pilots' },
    { hash: '#/observatory', label: 'Observatory' },
    { hash: '#/measurements', label: 'Measurements' },
    { hash: '#/indicators', label: 'Indicators' },
    { hash: '#/marketplace', label: 'Marketplace' },
    { hash: '#/reserves', label: 'Reserves' },
    { hash: '#/scenarios', label: 'Scenarios' },
    { hash: '#/about', label: 'About' }
  ];

  SCA.navbar = {
    render: function (mount) {
      var menuOpen = false;

      var toggle = SCA.ui.el('button', {
        class: 'nav-toggle', 'aria-label': 'Menu', 'aria-expanded': 'false',
        onclick: function () {
          menuOpen = !menuOpen;
          navList.className = 'nav-links' + (menuOpen ? ' open' : '');
          toggle.setAttribute('aria-expanded', String(menuOpen));
        }
      }, 'Menu');

      var brand = SCA.ui.el('a', { class: 'brand', href: '#/' },
        SCA.ui.el('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'SCA'),
        SCA.ui.el('span', { class: 'brand-name' }, 'Somali Capability Atlas'));

      var navList = SCA.ui.el('nav', { class: 'nav-links', 'aria-label': 'Main' },
        LINKS.map(function (l) {
          return SCA.ui.el('a', { class: 'nav-link', href: l.hash, 'data-hash': l.hash }, l.label);
        }));

      var authArea = SCA.ui.el('div', { class: 'nav-auth' });

      function updateActive(hash) {
        Array.prototype.forEach.call(navList.querySelectorAll('.nav-link'), function (a) {
          var h = a.getAttribute('data-hash');
          var isCurrent = h === hash ||
            (h !== '#/' && hash.indexOf(h) === 0);
          a.className = 'nav-link' + (isCurrent ? ' active' : '');
        });
      }

      function updateUser(user) {
        authArea.innerHTML = '';
        if (user) {
          authArea.appendChild(SCA.ui.el('a', { class: 'nav-user', href: '#/profile' }, user.name));
          authArea.appendChild(SCA.ui.el('button', {
            class: 'btn btn-ghost',
            onclick: function () {
              SCA.auth.current().signOut();
              SCA.state.set('user', null);
              location.hash = '#/';
            }
          }, 'Sign out'));
        } else {
          authArea.appendChild(SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/signin' }, 'Sign in'));
          authArea.appendChild(SCA.ui.el('a', { class: 'btn btn-primary', href: '#/signup' }, 'Create account'));
        }
      }

      SCA.state.on('user', updateUser);
      SCA.state.on('route', updateActive);

      mount.appendChild(SCA.ui.el('div', { class: 'nav-inner' },
        brand, toggle, navList, authArea));
    }
  };
})(SCA);
