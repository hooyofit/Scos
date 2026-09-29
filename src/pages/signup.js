/* Create account page. New accounts are Public Users; roles are assigned
   by administrators in a later build step. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.signup = function (root) {
    var name = SCA.ui.el('input', { type: 'text', autocomplete: 'name', required: true });
    var email = SCA.ui.el('input', { type: 'email', autocomplete: 'email', required: true });
    var password = SCA.ui.el('input', { type: 'password', autocomplete: 'new-password',
      minlength: '8', required: true });
    var confirm = SCA.ui.el('input', { type: 'password', autocomplete: 'new-password', required: true });
    var region = SCA.ui.el('input', { type: 'text', autocomplete: 'address-level1' });
    var errors = SCA.ui.el('div', {});

    function submit(e) {
      e.preventDefault();
      errors.innerHTML = '';
      if (password.value !== confirm.value) {
        errors.appendChild(SCA.ui.errorList({ confirm: 'Passwords do not match.' }));
        return;
      }
      SCA.auth.current().signUp({
        name: name.value, email: email.value, password: password.value,
        region: region.value
      }).then(function (res) {
        if (res.ok) {
          SCA.state.set('user', res.user);
          location.hash = '#/';
        } else {
          errors.appendChild(SCA.ui.errorList(res.errors));
        }
      });
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content narrow' },
      SCA.ui.pageHeader('Create account'),
      SCA.ui.el('form', { class: 'form-card', onsubmit: submit },
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Full name'), name),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Email'), email),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Password (at least 8 characters)'), password),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Confirm password'), confirm),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Region (optional)'), region),
        errors,
        SCA.ui.el('button', { class: 'btn btn-primary', type: 'submit' }, 'Create account')),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'New accounts receive the Public User role. Specialist roles (Researcher, ' +
        'Practitioner, and so on) are assigned by administrators in a later build step.')));
  };
})(SCA);
