/* About / Methodology page. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function enumTable(title, list) {
    return SCA.ui.el('div', { class: 'about-block' },
      SCA.ui.el('h3', { text: title }),
      SCA.ui.el('table', { class: 'enum-table' },
        SCA.ui.el('tbody', {},
          list.map(function (e) {
            return SCA.ui.el('tr', {},
              SCA.ui.el('th', { scope: 'row', text: e.code }),
              SCA.ui.el('td', { text: e.label }));
          }))));
  }

  SCA.pages.about = function (root) {
    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('About & Methodology', SCA.MISSION),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'Philosophy' }),
        SCA.ui.el('ul', { class: 'principles' },
          SCA.PHILOSOPHY.map(function (p) {
            return SCA.ui.el('li', { text: '«' + p + '»' });
          })),
        SCA.ui.el('p', {},
          'Historical and indigenous knowledge is documented and preserved, while ' +
          'scientific and technical validation determines whether a practice should be ' +
          'adopted, modified, integrated with modern technology, or rejected. The ' +
          'platform is neither anti-modern nor romantic about historical practices.')),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'Evidence framework' }),
        SCA.ui.el('p', {},
          'Classifications are tools for honest documentation, not automatic judgments. ' +
          'A claim can be preserved without being declared true.'),
        enumTable('Evidence levels', SCA.enums.evidence_levels),
        enumTable('Capability status', SCA.enums.living_status),
        enumTable('Actions', SCA.enums.actions),
        enumTable('Capability maturity levels', SCA.enums.maturity),
        enumTable('Access levels', SCA.enums.access_levels)),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'Medical safety principle' }),
        SCA.ui.el('p', {},
          'Preserve the knowledge. Validate the treatment. Protect the patient.'),
        SCA.ui.el('p', {},
          'The atlas may document traditional medical knowledge, but documentation ' +
          'is always distinct from medical recommendation. Historical existence is ' +
          'never proof of medical effectiveness. No medical treatment ' +
          'recommendations are made in this build.')),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'What this platform communicates' }),
        SCA.ui.el('p', {},
          'Preserve what we know. Recover what we lost. Build what we need. Pass it forward.'),
        SCA.ui.el('p', {},
          'The platform communicates evidence, uncertainty and verification clearly, ' +
          'and makes no exaggerated claims about Somali history.')),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'Roles' }),
        SCA.ui.el('ul', { class: 'role-list' },
          SCA.roles.map(function (r) {
            return SCA.ui.el('li', {},
              SCA.ui.el('strong', { text: r.label + ': ' }),
              r.description);
          }))),

      SCA.ui.el('section', { class: 'about-block' },
        SCA.ui.el('h3', { text: 'Data and portability' }),
        SCA.ui.el('p', {},
          'All atlas data can be exported as plain JSON from the Export page at any ' +
          'time. The source code is standards-based and deployable on any static host ' +
          'or offline device. Your knowledge is not trapped inside this application.')),
      ));
  };
})(SCA);
