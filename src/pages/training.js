/*
 * Training Programs list/detail + Apprenticeship view (Stage 5).
 * A training program can exist without being tied to a formal school.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.training = function (root) {
    var user = SCA.state.get('user');
    var programs = SCA.store.all('training_programs');

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Training',
        'Structured programs and apprenticeships. Practitioner → Trainer → ' +
        'Apprentice → Competent Practitioner → New Trainer.'),
      programs.length
        ? SCA.ui.el('ul', { class: 'detail-list' }, programs.map(function (t) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link', href: '#/training/' + t.id,
                text: t.title }),
              SCA.ui.badge(' ' + SCA.enums.label(
                SCA.enums.training_program_statuses, t.status), 'accent'));
          }))
        : SCA.ui.el('p', { class: 'muted',
            text: 'No training programs have yet been entered into the Atlas.' }));

    if (user && SCA.rbac.can(user, 'training.create')) {
      var title = SCA.ui.el('input', { type: 'text', placeholder: 'Program title' });
      var capSel = SCA.ui.select('cap',
        SCA.store.all('capabilities').slice(0, 240).map(function (c) {
          return { value: c.id, label: c.code + ' — ' + c.name }; }));
      var objective = SCA.ui.el('input', { type: 'text', placeholder: 'Objective' });
      var methodology = SCA.ui.el('input', { type: 'text', placeholder: 'Methodology' });
      var trainerReq = SCA.ui.el('input', { type: 'text', placeholder: 'Trainer requirements' });
      var milestones = SCA.ui.el('input', { type: 'text',
        placeholder: 'Suggested milestones, comma separated' });
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { class: 'btn btn-primary', type: 'button' },
        'Create program (works offline)');
      btn.addEventListener('click', function () {
        var rec = {
          title: title.value,
          objective: objective.value || null,
          methodology: methodology.value || null,
          trainer_requirements: trainerReq.value || null
        };
        if (capSel.value) { rec.capability_ids = [capSel.value]; }
        if (milestones.value.trim()) {
          rec.suggested_milestones = milestones.value.split(',')
            .map(function (x) { return x.trim(); }).filter(Boolean);
        }
        var res = SCA.training.createTrainingProgram(user, rec);
        if (res.ok) { location.hash = '#/training/' + res.record.id; location.reload(); }
        else { msg.textContent = ''; msg.appendChild(SCA.ui.errorList(res.errors)); }
      });
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Create a training program' }),
        SCA.ui.el('div', { class: 'filter-bar' }, title, capSel, objective,
          methodology, trainerReq, milestones, btn),
        msg));
    }
    root.appendChild(content);
  };

  /* ---------- Training program detail ---------- */
  SCA.pages.programDetail = function (root, params) {
    var user = SCA.state.get('user');
    var t = SCA.store.get('training_programs', params.id);
    if (!t) {
      root.appendChild(SCA.ui.emptyState({ title: 'Program not found',
        message: 'This training program does not exist.' }));
      return;
    }
    var apprenticeships = SCA.store.all('apprenticeships').filter(function (s) {
      return s.program_id === t.id; });

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(t.title, ''),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Status: ' + SCA.enums.label(
          SCA.enums.training_program_statuses, t.status), 'accent')),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Program' }),
        row('Objective', t.objective),
        row('Description', t.description),
        row('Prerequisites', t.prerequisites),
        row('Methodology', t.methodology),
        row('Practical requirements', t.practical_requirements),
        row('Safety requirements', t.safety_requirements),
        row('Assessment method', t.assessment_method),
        row('Trainer requirements', t.trainer_requirements),
        row('Duration', t.duration),
        row('Suggested milestones', (t.suggested_milestones || []).join('; '))),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Apprenticeships under this program' }),
        apprenticeships.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, apprenticeships.map(function (s) {
              return SCA.ui.el('li', {},
                SCA.ui.el('a', { class: 'link', href: '#/apprenticeship/' + s.id,
                  text: 'Apprenticeship ' + s.id.slice(0, 8) }),
                SCA.ui.el('span', { text: ' — ' + SCA.enums.label(
                  SCA.enums.apprenticeship_statuses, s.status) }));
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No apprenticeships registered under this program yet.' })),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/training' }, 'Back to Training'))));
  };

  /* ---------- Apprenticeship view ---------- */
  SCA.pages.apprenticeshipDetail = function (root, params) {
    var user = SCA.state.get('user');
    var s = SCA.store.get('apprenticeships', params.id);
    if (!s) {
      root.appendChild(SCA.ui.emptyState({ title: 'Apprenticeship not found',
        message: 'This apprenticeship does not exist.' }));
      return;
    }
    var apprentice = SCA.store.get('apprentices', s.apprentice_id);
    var mentor = SCA.store.get('practitioners', s.mentor_id);
    var capability = SCA.store.get('capabilities', s.capability_id);

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Apprenticeship — ' +
        (apprentice ? apprentice.public_name : s.apprentice_id), ''),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Status: ' + SCA.enums.label(
          SCA.enums.apprenticeship_statuses, s.status), 'accent'),
        s.successor_pathway
          ? SCA.ui.badge('Successor pathway', 'muted') : null),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Pathway' }),
        row('Mentor', mentor ? mentor.public_name : null),
        row('Apprentice', apprentice ? apprentice.public_name : null),
        row('Capability', capability ? capability.code + ' — ' + capability.name : null),
        row('Start date', s.start_date),
        row('Expected end', s.expected_end_date),
        row('Actual end', s.actual_end_date),
        row('Practical hours', s.practical_hours),
        row('Completion status', s.completion_status
          ? SCA.enums.label(SCA.enums.completion_statuses, s.completion_status) : null),
        row('Interruption reason', s.interruption_reason)),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Milestones' }),
        (s.milestones || []).length
          ? SCA.ui.el('ul', { class: 'detail-list' }, s.milestones.map(function (m) {
              return SCA.ui.el('li', { text: m.title + ' — ' +
                SCA.enums.label(SCA.enums.milestone_statuses, m.status) +
                (m.completed_date ? ' (' + m.completed_date + ')' : '') });
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'No milestones configured for this apprenticeship.' })),
      SCA.ui.el('p', { class: 'muted',
        text: 'Discontinuation is recorded with its reason, not treated automatically as failure.' }),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/apprentice/' + s.apprentice_id },
          'Open Apprentice Passport'))));
  };
})(SCA);
