/*
 * Knowledge Archive (Stage 3): captured knowledge artifacts.
 * An artifact is preserved knowledge, not validated truth. Read access is
 * public; creation goes through the audited workflow (SCA.evidence), and
 * artifacts linked to Medicine & Human Survival (family S) require safety
 * notes — preserved knowledge is never presented as medical advice.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function section(title, node) {
    return SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: title }), node);
  }

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: SCA.util.display(value) }));
  }

  function artifactMatches(k, q) {
    var query = String(q || '').trim().toLowerCase();
    if (!query) { return true; }
    return [k.title, k.contributor, k.creator, k.artifact_type, k.description]
      .some(function (x) { return String(x || '').toLowerCase().indexOf(query) !== -1; });
  }

  SCA.pages.knowledge = function (root) {
    var filters = { query: '', evidence_level: '', verification_status: '', capability: '' };

    function capIdsOf(k) {
      return k.capability_ids || (k.capability_id ? [k.capability_id] : []);
    }

    function applyFilters() {
      var capMatch = null;
      if (filters.capability) {
        var q = filters.capability.toLowerCase();
        capMatch = SCA.store.all('capabilities').filter(function (c) {
          return c.code.toLowerCase().indexOf(q) !== -1 ||
            c.name.toLowerCase().indexOf(q) !== -1;
        }).map(function (c) { return c.id; });
      }
      return SCA.store.all('knowledge').filter(function (k) {
        if (filters.evidence_level && k.evidence_level !== filters.evidence_level) { return false; }
        if (filters.verification_status && k.verification_status !== filters.verification_status) { return false; }
        if (capMatch && !capIdsOf(k).some(function (id) { return capMatch.indexOf(id) !== -1; })) { return false; }
        return artifactMatches(k, filters.query);
      });
    }

    function renderResults() {
      results.innerHTML = '';
      var list = applyFilters();
      results.appendChild(SCA.ui.el('p', { class: 'result-count', text:
        list.length + (list.length === 1 ? ' artifact' : ' artifacts') + ' found' }));
      if (!list.length) {
        results.appendChild(SCA.ui.emptyState({
          title: 'No knowledge artifacts documented yet',
          message: 'The Knowledge Archive is empty: no artifacts have been entered ' +
            'into the Atlas. Captured knowledge arrives through the audited ' +
            'evidence workflow with consent and provenance — nothing is fabricated.'
        }));
        return;
      }
      list.forEach(function (k) {
        results.appendChild(SCA.ui.el('article', { class: 'card capability-card' },
          SCA.ui.el('div', { class: 'card-top' },
            SCA.ui.el('h3', {},
              SCA.ui.el('a', { class: 'link', href: '#/knowledge/' + k.id }, k.title)),
            SCA.ui.badge('Artifact', 'muted')),
          SCA.ui.el('div', { class: 'badge-row' },
            SCA.ui.badge('Evidence: ' + SCA.util.display(k.evidence_level), 'muted'),
            SCA.ui.badge('Verification: ' + (k.verification_status
              ? SCA.enums.label(SCA.enums.verification_states, k.verification_status)
              : SCA.util.display(null)), 'accent')),
          SCA.ui.el('p', { class: 'card-meta' },
            SCA.ui.el('a', { class: 'btn btn-ghost btn-small', href: '#/knowledge/' + k.id }, 'View artifact'))));
      });
    }

    var results = SCA.ui.el('div', { class: 'results' });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Knowledge Archive',
        'Captured knowledge: documents, recordings, photographs, transcripts ' +
        'and artifacts. An artifact preserves knowledge — it is not automatically ' +
        'validated truth. Unknown fields show "Not yet documented".'),
      SCA.ui.el('form', { class: 'filter-bar', onsubmit: function (e) { e.preventDefault(); } },
        SCA.ui.el('label', { class: 'filter filter-wide' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Search'),
          (function () {
            var i = SCA.ui.el('input', { type: 'search',
              placeholder: 'Title, contributor, description', 'aria-label': 'Search artifacts' });
            i.addEventListener('input', function () {
              filters.query = i.value; renderResults();
            });
            return i;
          })()),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Capability'),
          (function () {
            var i = SCA.ui.el('input', { type: 'search', placeholder: 'Code or name',
              'aria-label': 'Filter by capability' });
            i.addEventListener('input', function () {
              filters.capability = i.value; renderResults();
            });
            return i;
          })()),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Evidence level'),
          (function () {
            var s = SCA.ui.select('evidence_level', SCA.enums.optionList(SCA.enums.evidence_levels));
            s.addEventListener('change', function () {
              filters.evidence_level = s.value; renderResults();
            });
            return s;
          })()),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Verification'),
          (function () {
            var s = SCA.ui.select('verification_status', SCA.enums.optionList(SCA.enums.verification_states));
            s.addEventListener('change', function () {
              filters.verification_status = s.value; renderResults();
            });
            return s;
          })())),
      results));
    renderResults();
  };

  /* ---- Artifact detail ---- */
  SCA.pages.artifact = function (root, params) {
    var k = SCA.store.get('knowledge', params.id);
    if (!k) {
      root.appendChild(SCA.ui.emptyState({
        title: 'Artifact not found',
        message: 'This record does not exist.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/knowledge' }, 'Back to the Knowledge Archive')
      }));
      return;
    }

    var capIds = k.capability_ids || (k.capability_id ? [k.capability_id] : []);
    var caps = capIds.map(function (id) { return SCA.store.get('capabilities', id); })
      .filter(Boolean);
    var sources = (k.source_ids || []).map(function (sid) {
      return SCA.store.get('evidence', sid);
    }).filter(Boolean);
    var history = SCA.audit.forEntity('knowledge', k.id);
    var isMedical = caps.some(function (c) {
      var f = SCA.store.get('families', c.family_id);
      return !!(f && f.code === 'S');
    });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(k.title, ''),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'Type: ' + SCA.util.display(k.artifact_type)),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Evidence: ' + SCA.util.display(k.evidence_level), 'muted'),
        SCA.ui.badge('Verification: ' + (k.verification_status
          ? SCA.enums.label(SCA.enums.verification_states, k.verification_status)
          : SCA.util.display(null)), 'accent'),
        SCA.ui.badge('Access: ' + SCA.util.display(k.access_level), 'muted')),

      SCA.ui.el('p', { class: 'muted' },
        'A knowledge artifact is captured knowledge, not automatically ' +
        'validated truth. Preservation does not assert effectiveness or safety.'),
      isMedical ? section('Medical safety',
        SCA.ui.el('div', { class: 'notice' },
          SCA.ui.el('p', {}, 'Preserve the knowledge. Validate the treatment. Protect the patient.'),
          SCA.ui.el('p', { class: 'muted' },
            'This artifact relates to Medicine, Hygiene & Human Survival. It is ' +
            'preserved documentation, not medical advice, and it has not been ' +
            'clinically validated by the Atlas.'))) : null,

      section('Description', SCA.ui.el('p', {}, SCA.util.display(k.description))),
      section('Content',
        row('Original language', k.original_language),
        row('Transcription', k.transcription),
        row('Translated text', k.translated_text),
        row('Claim text', k.claim_text),
        row('Context', k.context),
        row('Historical period', k.historical_period)),
      section('Technical documentation',
        row('Materials', (k.materials || []).join(', ') || null),
        row('Tools', (k.tools || []).join(', ') || null),
        row('Procedure summary', k.procedure_summary),
        row('Decision points', k.decision_points),
        row('Environmental conditions', k.environmental_conditions),
        row('Failure modes', k.failure_modes),
        row('Troubleshooting', k.troubleshooting),
        row('Measurements', k.measurements),
        row('Limitations', k.limitations)),
      section('Comparison and safety',
        row('Modern equivalent', k.modern_equivalent),
        row('Comparison notes', k.comparison_notes),
        row('Safety notes', k.safety_notes)),
      section('Connected capabilities',
        caps.length
          ? SCA.ui.el('ul', { class: 'detail-list' },
              caps.map(function (c) {
                return SCA.ui.el('li', {},
                  SCA.ui.el('a', { class: 'link', href: '#/capabilities/' + c.id },
                    c.code + ' — ' + c.name));
              }))
          : SCA.ui.el('p', { class: 'muted', text: 'Not yet connected to any capability.' })),
      section('Sources',
        sources.length
          ? SCA.ui.el('ul', { class: 'detail-list' },
              sources.map(function (s) {
                return SCA.ui.el('li', {},
                  SCA.ui.el('a', { class: 'link', href: '#/evidence/' + s.id }, s.title));
              }))
          : SCA.ui.el('p', { class: 'muted', text: 'Not yet documented' })),
      section('Provenance',
        row('Contributor', k.contributor),
        row('Entered by', k.entered_by),
        row('Entered at', k.created_at),
        row('Consent record', k.consent_id),
        row('Reviewer', k.reviewer),
        row('Review notes', k.review_notes),
        row('Provenance', k.provenance)),
      section('Audit history',
        history.length
          ? SCA.ui.el('ul', { class: 'detail-list' },
              history.map(function (h) {
                return SCA.ui.el('li', { text:
                  h.timestamp + ' — ' + h.actor + ' — ' + h.action });
              }))
          : SCA.ui.el('p', { class: 'muted', text: 'No audit entries yet.' })),

      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/knowledge' }, 'Back to the Knowledge Archive'))
    ));
  };
})(SCA);
