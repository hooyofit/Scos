/*
 * Practitioner Directory + Profile (Stage 5).
 *
 * No rankings, no reputation scores, no "best practitioner". Search and
 * filter only. The public view shows only consented public records;
 * anonymous practitioners are masked. Private contact details never
 * appear here.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.practitioners = function (root) {
    var user = SCA.state.get('user');
    var capabilities = SCA.store.all('capabilities');

    var capSel = SCA.ui.select('cap', [{ value: '', label: 'All capabilities' }]
      .concat(capabilities.slice(0, 240).map(function (c) {
        return { value: c.id, label: c.code + ' — ' + c.name }; })));
    var regionInput = SCA.ui.el('input', { type: 'text', placeholder: 'Region' });
    var statusSel = SCA.ui.select('status', [{ value: '', label: 'All statuses' }]
      .concat(SCA.enums.optionList(SCA.enums.practitioner_statuses)));
    var teachSel = SCA.ui.select('teach', [
      { value: '', label: 'Any teaching ability' },
      { value: 'yes', label: 'Can teach' },
      { value: 'no', label: 'Not recorded as teacher' }]);
    var availInput = SCA.ui.el('input', { type: 'text', placeholder: 'Availability' });
    var orgSel = SCA.ui.select('org', [{ value: '', label: 'All organizations' }]
      .concat(SCA.store.all('organizations').map(function (o) {
        return { value: o.id, label: o.name }; })));

    var results = SCA.ui.el('div', {});

    function render() {
      results.textContent = '';
      var list = user && SCA.rbac.can(user, 'practitioner.read')
        ? SCA.store.all('practitioners')
        : SCA.training.publicPractitioners().map(function (p) {
            return SCA.store.get('practitioners', p.id); });
      list = list.filter(function (p) {
        if (capSel.value && (p.capability_ids || p.capabilities || []).indexOf(capSel.value) === -1) { return false; }
        if (regionInput.value && (p.region || '').toLowerCase().indexOf(regionInput.value.toLowerCase()) === -1) { return false; }
        if (statusSel.value && p.verification_status !== statusSel.value) { return false; }
        if (teachSel.value === 'yes' && p.can_teach !== true) { return false; }
        if (teachSel.value === 'no' && p.can_teach === true) { return false; }
        if (availInput.value && (p.availability || '').toLowerCase().indexOf(availInput.value.toLowerCase()) === -1) { return false; }
        if (orgSel.value && p.organization_id !== orgSel.value) { return false; }
        return true;
      });
      /* Sorted alphabetically by public name — a stable, non-judgmental
         ordering. Never by score. */
      list.sort(function (a, b) {
        return (a.public_name || '').localeCompare(b.public_name || ''); });
      results.appendChild(list.length
        ? SCA.ui.el('ul', { class: 'detail-list' }, list.map(function (p) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link', href: '#/practitioner/' + p.id },
                p.public_name),
              SCA.ui.badge(' ' + (p.verification_status
                ? SCA.enums.label(SCA.enums.practitioner_statuses, p.verification_status)
                : 'Candidate'), 'accent'),
              p.can_teach ? SCA.ui.badge(' Can teach', 'muted') : null,
              p.anonymous_option ? SCA.ui.badge(' Anonymous', 'muted') : null);
          }))
        : SCA.ui.el('p', { class: 'muted',
            text: 'No practitioner data has yet been entered into the Atlas.' }));
    }

    [capSel, regionInput, statusSel, teachSel, availInput, orgSel]
      .forEach(function (c) {
        c.addEventListener('change', render);
        c.addEventListener('input', render);
      });

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Practitioner Directory',
        'The human side of capability: who practices, who demonstrates, ' +
        'who teaches. No rankings — only documentation.'),
      SCA.ui.el('div', { class: 'filter-bar' },
        capSel, regionInput, statusSel, teachSel, availInput, orgSel),
      results);

    /* Create form (gated): field researchers can register practitioners
       offline. */
    if (user && SCA.rbac.can(user, 'practitioner.create')) {
      var name = SCA.ui.el('input', { type: 'text', placeholder: 'Public name' });
      var anon = SCA.ui.el('input', { type: 'checkbox' });
      var anonLabel = SCA.ui.el('label', {}, anon, ' Anonymous (identity protected)');
      var capSel2 = SCA.ui.select('cap2', capabilities.slice(0, 240).map(function (c) {
        return { value: c.id, label: c.code + ' — ' + c.name }; }));
      var region2 = SCA.ui.el('input', { type: 'text', placeholder: 'Region (no precise location)' });
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { class: 'btn btn-primary', type: 'button' },
        'Register practitioner (works offline)');
      btn.addEventListener('click', function () {
        var rec = {
          public_name: name.value,
          anonymous_option: anon.checked,
          region: region2.value || null,
          contact_visibility: 'RESEARCH_TEAM',
          documentation_consent: false
        };
        if (capSel2.value) { rec.capability_ids = [capSel2.value]; }
        var res = SCA.training.createPractitioner(user, rec);
        if (res.ok) { location.hash = '#/practitioner/' + res.record.id; location.reload(); }
        else { msg.textContent = ''; msg.appendChild(SCA.ui.errorList(res.errors)); }
      });
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Register a practitioner' }),
        SCA.ui.el('div', { class: 'filter-bar' }, name, anonLabel, capSel2, region2, btn),
        msg));
    }

    root.appendChild(content);
    render();
  };

  /* ---------- Practitioner profile ---------- */
  SCA.pages.practitioner = function (root, params) {
    var user = SCA.state.get('user');
    var profile = SCA.training.profileFor(user, params.id);
    if (!profile) {
      root.appendChild(SCA.ui.emptyState({ title: 'Practitioner not found',
        message: 'This practitioner record does not exist.' }));
      return;
    }
    var p = SCA.store.get('practitioners', params.id);
    var caps = (profile.capability_ids || []).map(function (id) {
      var c = SCA.store.get('capabilities', id);
      return c ? c.code + ' — ' + c.name : id;
    });
    var assessments = SCA.store.all('competence_assessments').filter(function (m) {
      return m.practitioner_id === p.id; });
    var certifications = SCA.store.all('capability_certifications').filter(function (c) {
      return c.practitioner_id === p.id && c.status === 'ISSUED'; });
    var apprenticeships = SCA.store.all('apprenticeships').filter(function (s) {
      return s.mentor_id === p.id; });

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }
    function listRow(items, emptyText) {
      return items.length ? items.join(', ') : emptyText;
    }

    var medical = (profile.capability_ids || []).some(function (id) {
      var c = SCA.store.get('capabilities', id);
      return c && c.family_id && SCA.store.get('families', c.family_id).code === 'S';
    });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(profile.public_name,
        profile.anonymous ? 'Identity protected: this practitioner is documented anonymously.' : ''),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Status: ' + SCA.enums.label(SCA.enums.practitioner_statuses,
          profile.verification_status), 'accent'),
        SCA.ui.badge('Competence: ' + (profile.competence_level || 'L0') +
          (profile.competence_status && profile.competence_status !== 'NOT_ASSESSED'
            ? ' — ' + SCA.enums.label(SCA.enums.assessment_results, profile.competence_status)
            : ' (not yet assessed)'), 'muted'),
        profile.can_teach ? SCA.ui.badge('Trainer readiness: ' +
          SCA.enums.label(SCA.enums.trainer_readiness, profile.trainer_readiness), 'muted') : null),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Profile' }),
        row('Capabilities', listRow(caps, 'Not yet documented')),
        row('Region', profile.region),
        row('Community', profile.community),
        row('Experience', profile.experience_years !== null
          ? profile.experience_years + ' years (context, not proof of competence)' : null),
        row('Languages', listRow(profile.languages, 'Not yet documented')),
        row('Availability', profile.availability),
        row('Knowledge holder type', SCA.enums.label(
          SCA.enums.knowledge_holder_types, profile.knowledge_holder_type)),
        row('Apprentice capacity', profile.apprentice_capacity),
        row('Verification pathways', listRow(
          (profile.verification_pathways || []).map(function (v) {
            return SCA.enums.label(SCA.enums.verification_pathways, v); }),
          'None recorded yet — listing a practitioner is not verification'))),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Competence assessments' }),
        assessments.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, assessments.map(function (m) {
              return SCA.ui.el('li', { text:
                (m.assessment_date || '') + ' — ' +
                SCA.enums.label(SCA.enums.assessment_types, m.assessment_type) +
                ' — result: ' + SCA.enums.label(SCA.enums.assessment_results, m.result) +
                (m.competence_level ? ' — level: ' + m.competence_level : '') +
                ' — review: ' + SCA.enums.label(SCA.enums.assessment_review_statuses, m.review_status) });
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'No competence assessments recorded. This person can remain Documented / Not Yet Assessed without being downgraded.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Certifications' }),
        certifications.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, certifications.map(function (c) {
              return SCA.ui.el('li', { text: (c.issued_date || '') + ' — ' +
                c.certification_level + ' — status: ' +
                SCA.enums.label(SCA.enums.certification_statuses, c.status) +
                (c.limitations ? ' — limitations: ' + c.limitations : '') });
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No certifications issued.' })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Apprenticeships as mentor' }),
        apprenticeships.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, apprenticeships.map(function (s) {
              return SCA.ui.el('li', {},
                SCA.ui.el('a', { class: 'link', href: '#/apprenticeship/' + s.id,
                  text: 'Apprenticeship ' + s.id.slice(0, 8) }),
                SCA.ui.el('span', { text: ' — ' +
                  SCA.enums.label(SCA.enums.apprenticeship_statuses, s.status) }));
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No mentorships recorded.' })),
      profile.successor ? SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Succession (authorized view)' }),
        SCA.ui.el('p', { class: 'muted', text: 'Succession information is not public; shown only to authorized roles.' }),
        row('Succession notes', (profile.successor || {}).notes)) : null,
      medical ? SCA.ui.el('p', { class: 'muted',
        text: 'This record documents a historical/community health practice. Listing is not medical endorsement, and demonstrated competence is not clinical safety. No treatment instructions are provided.' }) : null,
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/practitioners' },
          'Back to Practitioners'))));
  };
})(SCA);
