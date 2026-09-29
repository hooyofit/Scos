/* Dashboard page (placeholder until Step 14). Counts shown are real. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};
  SCA.pages.dashboard = function (root) {
    var user = SCA.state.get('user');
    if (!SCA.rbac.can(user, 'dashboard.view')) {
      root.appendChild(SCA.ui.denied('dashboard.view'));
      return;
    }
    var tile = function (label, value) {
      return SCA.ui.el('div', { class: 'stat' },
        SCA.ui.el('div', { class: 'stat-value', text: String(value) }),
        SCA.ui.el('div', { class: 'stat-label', text: label }));
    };
    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Dashboard', 'Advanced dashboards arrive in build step 14.'),
      SCA.ui.el('div', { class: 'stat-strip' },
        tile('Families', SCA.store.count('families')),
        tile('Capabilities', SCA.store.count('capabilities')),
        tile('Practitioners', SCA.store.count('practitioners')),
        tile('Apprentices', SCA.store.count('apprentices')),
        tile('Evidence sources', SCA.store.count('evidence')),
        tile('Knowledge artifacts', SCA.store.count('knowledge'))),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'These numbers are live counts from the local dataset. Analytical dashboards, ' +
        'charts and national overviews are deliberately not built yet.')));
  };
})(SCA);
