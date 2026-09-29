/* Profile page: manage basic profile information. */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.profile = function (root) {
    var user = SCA.state.get('user');
    if (!user) {
      root.appendChild(SCA.ui.denied('profile.manage'));
      return;
    }

    var message = SCA.ui.el('div', {});
    var name = SCA.ui.el('input', { type: 'text', value: user.name || '' });
    var phone = SCA.ui.el('input', { type: 'text', value: user.phone || '' });
    var region = SCA.ui.el('input', { type: 'text', value: user.region || '' });
    var bio = SCA.ui.el('textarea', { rows: '4' });
    bio.value = user.bio || '';

    function save(e) {
      e.preventDefault();
      message.innerHTML = '';
      SCA.auth.current().updateProfile(user.id, {
        name: name.value, phone: phone.value, region: region.value, bio: bio.value
      }).then(function (res) {
        if (res.ok) {
          SCA.state.set('user', res.user);
          message.appendChild(SCA.ui.el('p', { class: 'msg-ok' }, 'Profile saved.'));
        } else {
          message.appendChild(SCA.ui.errorList(res.errors));
        }
      });
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content narrow' },
      SCA.ui.pageHeader('Your profile'),
      SCA.ui.el('div', { class: 'form-card read-only-block' },
        SCA.ui.el('div', { class: 'field-row' },
          SCA.ui.el('dt', {}, 'Email'),
          SCA.ui.el('dd', { text: user.email || '' })),
        SCA.ui.el('div', { class: 'field-row' },
          SCA.ui.el('dt', {}, 'Role'),
          SCA.ui.el('dd', { text: SCA.roleLabel(user.role) })),
        SCA.ui.el('div', { class: 'field-row' },
          SCA.ui.el('dt', {}, 'Language'),
          SCA.ui.el('dd', { text: user.language || 'en' }))),
      SCA.ui.el('form', { class: 'form-card', onsubmit: save },
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Full name'), name),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Phone'), phone),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Region'), region),
        SCA.ui.el('label', { class: 'field' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Bio'), bio),
        message,
        SCA.ui.el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'Your email and role are read-only here. Role assignment is an ' +
        'administrative function that arrives in a later build step.')));
  };
})(SCA);
