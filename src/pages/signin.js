/* Sign in page. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.signin = function (root) {
    var email = SCA.ui.el('input', { type: 'email', autocomplete: 'email', required: true });
    var password = SCA.ui.el('input', { type: 'password', autocomplete: 'current-password', required: true });
    var errors = SCA.ui.el('div', {});

    function submit(e) {
      e.preventDefault();
      errors.innerHTML = '';
      SCA.auth.current().signIn({ email: email.value, password: password.value })
        .then(function (res) {
          if (res.ok) {
            SCA.state.set('user', res.user);
            location.hash = '#/';
          } else {
            errors.appendChild(SCA.ui.errorList(res.errors));
          }
        });
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content narrow' },
      SCA.ui.pageHeader('Sign in'),
      SCA.ui.el('form', { class: 'form-card', onsubmit: submit },
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Email'), email),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Password'), password),
        errors,
        SCA.ui.el('button', { class: 'btn btn-primary', type: 'submit' }, 'Sign in')),
      SCA.ui.el('p', { class: 'page-subtitle' },
        SCA.ui.el('a', { class: 'link', href: '#/signup' }, 'Create an account'), ' · ',
        SCA.ui.el('a', { class: 'link', href: '#/reset' }, 'Forgot password?'))));
  };
})(SCA);
