/*
 * Field Research dashboard + project view (Stage 4).
 * Shows counts, never researcher rankings or capability scores.
 * Field data is not public by default: this whole section requires
 * research.read (every signed-in role); anonymous visitors are refused.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  var RECORD_COLLECTIONS = ['observations', 'field_notes', 'knowledge'];

  function recordsWith(pred) {
    var out = [];
    RECORD_COLLECTIONS.forEach(function (coll) {
      SCA.store.all(coll).forEach(function (r) {
        if (pred(r)) { out.push({ collection: coll, record: r }); }
      });
    });
    return out;
  }

  function statusOf(r) { return r.status || 'DRAFT'; }

  function countTile(label, n, opts) {
    return SCA.ui.el('div', { class: 'stat-tile' },
      SCA.ui.el('p', { class: 'stat-number', text: String(n) }),
      SCA.ui.el('p', { class: 'stat-label', text: label }));
  }

  /* ---------- Dashboard ---------- */
  SCA.pages.fieldResearch = function (root) {
    var user = SCA.state.get('user');
    if (!user || !SCA.rbac.can(user, 'research.read')) {
      root.appendChild(SCA.ui.denied('Field research',
        'Field research data is not public. Sign in with a research role.'));
      return;
    }

    var projects = SCA.store.all('research_projects');
    var sessions = SCA.store.all('research_sessions');
    var drafts = recordsWith(function (r) { return statusOf(r) === 'DRAFT'; });
    var submitted = recordsWith(function (r) { return statusOf(r) === 'SUBMITTED'; });
    var underReview = recordsWith(function (r) { return statusOf(r) === 'UNDER_REVIEW'; });
    var clarifications = recordsWith(function (r) { return statusOf(r) === 'NEEDS_CLARIFICATION'; });
    var accepted = recordsWith(function (r) { return statusOf(r) === 'ACCEPTED_AS_EVIDENCE'; });
    var conflicts = recordsWith(function (r) { return r.conflict_status === true; });
    var queuePending = SCA.queue.pending();
    var withdrawnConsents = SCA.store.all('consents').filter(function (c) {
      return c.consent_state === 'WITHDRAWN'; });
    var mediaMissingConsent = SCA.store.all('field_media').filter(function (m) {
      return !m.consent_id; });

    var tileRow = SCA.ui.el('div', { class: 'stat-grid' },
      countTile('Projects', projects.length),
      countTile('Sessions', sessions.length),
      countTile('Draft records', drafts.length),
      countTile('Submitted', submitted.length),
      countTile('Under review', underReview.length),
      countTile('Clarifications requested', clarifications.length),
      countTile('Accepted as evidence', accepted.length),
      countTile('Conflicts', conflicts.length),
      countTile('Offline records awaiting export/sync', queuePending.length),
      countTile('Consent issues (withdrawn + media without consent)',
        withdrawnConsents.length + mediaMissingConsent.length));

    var projectList = projects.length
      ? SCA.ui.el('ul', { class: 'detail-list' }, projects.map(function (p) {
          return SCA.ui.el('li', {},
            SCA.ui.el('a', { class: 'link', href: '#/project/' + p.id },
              (p.project_code || '') + ' — ' + p.title),
            SCA.ui.badge(' ' + (p.status
              ? SCA.enums.label(SCA.enums.project_statuses, p.status)
              : 'Draft'), 'accent'));
        }))
      : SCA.ui.el('p', { class: 'muted',
          text: 'No research projects exist yet. Projects are created by research roles and approved before field collection.' });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Field Research',
        'Offline-first, provenance-first, consent-aware, audit-friendly field ' +
        'collection. An observation is never automatically a verified fact: ' +
        'Observation → Field Record → Evidence → Review → Verification.'),
      tileRow,
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Research projects' }),
        projectList),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Offline collection queue' }),
        queuePending.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, queuePending.slice(0, 12).map(function (e) {
              return SCA.ui.el('li', { text: e.entity_type + ' ' + e.local_id +
                ' — ' + (SCA.enums.label(SCA.enums.queue_statuses, e.sync_status) || e.sync_status) +
                (e.last_error ? ' — last error: ' + e.last_error : '') });
            }))
          : SCA.ui.el('p', { class: 'muted',
              text: 'No records waiting for export or synchronization.' })),
      SCA.ui.el('p', { class: 'muted',
        text: 'No researcher rankings or capability scores are produced here, by design.' })
    ));
  };

  /* ---------- Project detail ---------- */
  SCA.pages.project = function (root, params) {
    var user = SCA.state.get('user');
    if (!user || !SCA.rbac.can(user, 'research.read')) {
      root.appendChild(SCA.ui.denied('Field research',
        'Field research data is not public.'));
      return;
    }
    var p = SCA.store.get('research_projects', params.id);
    if (!p) {
      root.appendChild(SCA.ui.emptyState({ title: 'Project not found',
        message: 'This research project does not exist.' }));
      return;
    }

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }

    var sessions = SCA.store.all('research_sessions').filter(function (s) {
      return s.project_id === p.id; });

    var statusLabel = p.status
      ? SCA.enums.label(SCA.enums.project_statuses, p.status) : 'Draft';

    /* New session form: gated by research.create + approved project. */
    var canCreate = SCA.rbac.can(user, 'research.create') &&
      ['APPROVED', 'ACTIVE', 'PAUSED'].indexOf(p.status) !== -1;
    var sessionForm = null;
    if (SCA.rbac.can(user, 'research.create') && !canCreate) {
      sessionForm = SCA.ui.el('p', { class: 'muted',
        text: 'Field collection is not allowed while the project status is "' +
          statusLabel + '". Only APPROVED, ACTIVE or PAUSED projects accept sessions.' });
    } else if (canCreate) {
      var purpose = SCA.ui.el('input', { type: 'text', placeholder: 'Purpose of the field visit' });
      var locality = SCA.ui.el('input', { type: 'text', placeholder: 'Locality (optional)' });
      var precision = SCA.ui.select('precision',
        SCA.enums.optionList(SCA.enums.location_precision), 'LOCALITY_ONLY');
      precision.removeChild(precision.firstChild);
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { class: 'btn btn-primary', type: 'button' },
        'Create session (works offline)');
      btn.addEventListener('click', function () {
        var res = SCA.research.createSession(user, {
          project_id: p.id,
          purpose: purpose.value,
          locality: locality.value || null,
          location_precision: precision.value,
          researcher_ids: [user.name]
        });
        if (res.ok) { location.hash = '#/project/' + p.id; location.reload(); }
        else { msg.textContent = ''; msg.appendChild(SCA.ui.errorList(res.errors)); }
      });
      sessionForm = SCA.ui.el('div', { class: 'filter-bar' },
        purpose, locality, precision, btn, msg);
    }

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader((p.project_code || '') + ' — ' + p.title, ''),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Status: ' + statusLabel, 'accent'),
        SCA.ui.badge('Version: ' + SCA.util.display(p.version), 'muted')),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Project' }),
        row('Objective', p.objective),
        row('Description', p.description),
        row('Geographic scope', p.geographic_scope),
        row('Historical scope', p.historical_scope),
        row('Methodology', p.methodology),
        row('Lead researcher', p.lead_researcher),
        row('Research team', (p.research_team || []).join(', ') || null),
        row('Capabilities targeted', (p.capability_ids || []).length + ' record(s)'),
        row('Ethics notes', p.ethics_notes),
        row('Safety notes', p.safety_notes),
        row('Consent requirements', p.consent_requirements)),
      sessionForm ? SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'New research session' }), sessionForm) : null,
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Sessions' }),
        sessions.length
          ? SCA.ui.el('ul', { class: 'detail-list' }, sessions.map(function (s) {
              var obs = SCA.store.all('observations').filter(function (o) {
                return o.session_id === s.id; });
              return SCA.ui.el('li', {},
                (s.date_start || '') + ' — ' + (s.purpose || 'session') +
                ' — location precision: ' + (s.location_precision
                  ? SCA.enums.label(SCA.enums.location_precision, s.location_precision)
                  : 'Not yet documented') +
                ' — records: ' + obs.length);
            }))
          : SCA.ui.el('p', { class: 'muted', text: 'No sessions recorded yet.' })),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/field-research' },
          'Back to Field Research'))));
  };
})(SCA);
