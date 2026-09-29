/* Site footer. */
(function (SCA) {
  'use strict';
  SCA.footer = {
    render: function (mount) {
      mount.appendChild(SCA.ui.el('footer', { class: 'site-footer' },
        SCA.ui.el('div', { class: 'footer-inner' },
          SCA.ui.el('p', { class: 'footer-philosophy', text: '«Modernize without forgetting.»' }),
          SCA.ui.el('p', { class: 'footer-meta' },
            SCA.config.name + ' — ' + SCA.INTERNAL_NAME +
            '. Foundation build, Step ' + SCA.BUILD_STEP + ' of 17. Version ' + SCA.VERSION + '.'),
          SCA.ui.el('p', { class: 'footer-links' },
            SCA.ui.el('a', { href: '#/about' }, 'About & methodology'),
            ' · ',
            SCA.ui.el('a', { href: '#/export' }, 'Data export'),
            ' · ',
            SCA.ui.el('a', { href: '#/signin' }, 'Sign in')))));
    }
  };
})(SCA);
