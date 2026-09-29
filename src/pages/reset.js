/*
 * Reset password. Step 1 has no email service, so the one-time token is
 * shown locally with an honest explanation. Email delivery arrives with a
 * hosted auth provider in a later build step.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.reset = function (root) {
    var step1 = SCA.ui.el('div', {});
    var step2 = SCA.ui.el('div', { class: 'hidden' });
    var tokenShown = null;

    var email = SCA.ui.el('input', { type: 'email', required: true });

    function request(e) {
      e.preventDefault();
      SCA.auth.current().resetPassword({ email: email.value }).then(function (res) {
        step2.innerHTML = '';
        if (res.ok && res.token) {
          tokenShown = res.token;
          step2.appendChild(SCA.ui.el('p', { class: 'msg-ok' }, res.note));
          step2.appendChild(SCA.ui.el('p', { class: 'token-display', text: 'Reset token: ' + res.token }));
        } else {
          step2.appendChild(SCA.ui.el('p', { class: 'msg-ok' }, res.note || 'Request received.'));
        }
        step2.classList.remove('hidden');
      });
    }

    var token = SCA.ui.el('input', { type: 'text', required: true });
    var newPassword = SCA.ui.el('input', { type: 'password', minlength: '8', required: true });
    var result = SCA.ui.el('div', {});

    function complete(e) {
      e.preventDefault();
      result.innerHTML = '';
      SCA.auth.current().completeReset({
        email: email.value, token: token.value, new_password: newPassword.value
      }).then(function (res) {
        if (res.ok) {
          result.appendChild(SCA.ui.el('p', { class: 'msg-ok' },
            'Password updated. You can now sign in.'));
          setTimeout(function () { location.hash = '#/signin'; }, 1500);
        } else {
          result.appendChild(SCA.ui.errorList(res.errors));
        }
      });
    }

    step1.appendChild(SCA.ui.el('form', { onsubmit: request },
      SCA.ui.el('label', { class: 'field' },
        SCA.ui.el('span', { class: 'filter-label' }, 'Account email'), email),
      SCA.ui.el('button', { class: 'btn btn-primary', type: 'submit' },
        'Request reset token')));

    step2.appendChild(SCA.ui.el('form', { onsubmit: complete },
      SCA.ui.el('label', { class: 'field' },
        SCA.ui.el('span', { class: 'filter-label' }, 'Reset token'), token),
      SCA.ui.el('label', { class: 'field' },
        SCA.ui.el('span', { class: 'filter-label' }, 'New password (at least 8 characters)'), newPassword),
      result,
      SCA.ui.el('button', { class: 'btn btn-primary', type: 'submit' },
        'Set new password')));

    root.appendChild(SCA.ui.el('div', { class: 'page-content narrow' },
      SCA.ui.pageHeader('Reset password'),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'This build runs entirely offline, so the reset token is shown here ' +
        'instead of being emailed. It expires in 24 hours.'),
      step1, step2));
  };
})(SCA);
