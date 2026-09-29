/*
 * Apprentices list + Apprentice Passport (Stage 5).
 *
 * The passport summarizes the learner's pathway: current/target level,
 * mentors, milestones, practical hours, assessments, certification,
 * employment, trainer readiness and portfolio. It is offline-first and
 * exportable as portable JSON, and it exposes no private information
 * (anonymous apprentices stay masked).
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.apprentices = function (root) {
    var user = SCA.state.get('user');
    var apprentices = SCA.store.all('apprentices');

    var listEl = SCA.ui.el('ul', { class: 'detail-list' }, apprentices.map(function (a) {
      var c = SCA.store.get('capabilities', a.capability_id);
      return SCA.ui.el('li', {},
        SCA.ui.el('a', { class: 'link', href: '#/apprentice/' + a.id, text: a.public_name }),
        SCA.ui.badge(' ' + (c ? c.code : ''), 'muted'),
        SCA.ui.badge(' ' + (a.current_level || 'L0') + ' → ' +
          (a.target_level || 'Not set'), 'accent'),
        a.anonymous_option ? SCA.ui.badge(' Anonymous', 'muted') : null);
    }));

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Apprentices',
        'Who is learning what, from whom. A pathway from practitioner to ' +
        'apprentice to competent practitioner to new trainer.'),
      apprentices.length ? listEl
        : SCA.ui.el('p', { class: 'muted',
            text: 'No apprentice data has yet been entered into the Atlas.' }));

    if (user && SCA.rbac.can(user, 'apprentice.create')) {
      var name = SCA.ui.el('input', { type: 'text', placeholder: 'Public name' });
      var anon = SCA.ui.el('input', { type: 'checkbox' });
      var capSel = SCA.ui.select('cap',
        SCA.store.all('capabilities').slice(0, 240).map(function (c) {
          return { value: c.id, label: c.code + ' — ' + c.name }; }));
      var target = SCA.ui.select('target',
        SCA.enums.optionList(SCA.enums.competence_levels), 'L3');
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { class: 'btn btn-primary', type: 'button' },
        'Register apprentice (works offline)');
      btn.addEventListener('click', function () {
        var res = SCA.training.createApprentice(user, {
          public_name: name.value,
          anonymous_option: anon.checked,
          capability_id: capSel.value,
          target_level: target.value,
          training_start: new Date().toISOString().slice(0, 10)
        });
        if (res.ok) { location.hash = '#/apprentice/' + res.record.id; location.reload(); }
        else { msg.textContent = ''; msg.appendChild(SCA.ui.errorList(res.errors)); }
      });
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Register an apprentice' }),
        SCA.ui.el('div', { class: 'filter-bar' }, name,
          SCA.ui.el('label', {}, anon, ' Anonymous'), capSel, target, btn),
        msg));
    }
    root.appendChild(content);
  };

  /* ---------- Apprentice Passport ---------- */
  SCA.pages.apprentice = function (root, params) {
    var user = SCA.state.get('user');
    var res = SCA.training.getPassport(user, params.id);
    if (!res.ok) {
      root.appendChild(SCA.ui.denied('Apprentice Passport',
        'The passport is available to signed-in roles only.'));
      return;
    }
    var pass = res.passport;
    var a = pass.apprentice;
    var c = SCA.store.get('capabilities', a.capability_id);

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }

    var milestonesAll = [];
    pass.apprenticeships.forEach(function (s) {
      (s.milestones || []).forEach(function (m) { milestonesAll.push({ s: s, m: m }); });
    });

    var exportBox = SCA.ui.el('textarea', {
      class: 'export-preview', rows: 10, readonly: 'readonly' });
    var exportBtn = SCA.ui.el('button', { class: 'btn btn-ghost', type: 'button' },
      'Show portable passport export (offline JSON)');
    exportBtn.addEventListener('click', function () {
      var out = SCA.training.exportPassport(user, params.id);
      exportBox.value = out.ok ? out.json : JSON.stringify(out.errors);
    });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Apprentice Passport — ' + a.public_name,
        a.anonymous ? 'Identity protected.' :
        'A portable record of the learning pathway. No cloud required.'),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Learner' }),
        row('Capability', c ? c.code + ' — ' + c.name : a.capability_id),
        row('Current level', a.current_level),
        row('Target level', a.target_level),
        row('Training start', a.training_start),
        row('Practical hours', a.practical_hours),
        row('Demonstrations completed', a.demonstrations_completed),
        row('Employment', a.employment),
        row('Trainer readiness', a.trainer_ready ? 'Developing toward trainer' : 'Not yet assessed'),
        row('Portfolio items', (a.portfolio || []).length)),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Mentors' }),
        pass.mentors.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, pass.mentors.map(function (m) {
              return SCA.ui.el('li', {},
                SCA.ui.el('a', { class: 'link', href: '#/practitioner/' + m.id,
                  text: m.public_name }),
                SCA.ui.el('span', { text: ' — ' + (m.competence_level || 'L0') +
                  (m.trainer_readiness ? ' — ' + SCA.enums.label(
                    SCA.enums.trainer_readiness, m.trainer_readiness) : '') }));
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No mentors recorded yet.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Milestones' }),
        milestonesAll.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, milestonesAll.map(function (x) {
              return SCA.ui.el('li', { text: x.m.title + ' — ' +
                SCA.enums.label(SCA.enums.milestone_statuses, x.m.status) +
                (x.m.completed_date ? ' (' + x.m.completed_date + ')' : '') });
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'No milestones configured. Milestones are defined per training program/capability — there is no universal checklist.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Assessments' }),
        pass.assessments.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, pass.assessments.map(function (m) {
              return SCA.ui.el('li', { text:
                (m.assessment_date || '') + ' — ' +
                SCA.enums.label(SCA.enums.assessment_types, m.assessment_type) +
                ' — ' + SCA.enums.label(SCA.enums.assessment_results, m.result) +
                ' — review: ' + SCA.enums.label(SCA.enums.assessment_review_statuses, m.review_status) });
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No assessments yet.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Certification' }),
        pass.certifications.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, pass.certifications.map(function (cc) {
              return SCA.ui.el('li', { text: cc.certification_level + ' — ' +
                SCA.enums.label(SCA.enums.certification_statuses, cc.status) +
                ' — issued ' + (cc.issued_date || '') + ' by ' + cc.issued_by });
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'Not certified. Certification is competence-based; attendance is not certification.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Offline export' }),
        exportBtn, exportBox),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/apprentices' },
          'Back to Apprentices'))));
  };
})(SCA);
