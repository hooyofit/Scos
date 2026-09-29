/*
 * Evidence Archive (Stage 3): the registry of EvidenceSources.
 * Read access is public; creating and reviewing are RBAC-gated and go
 * through SCA.evidence (the audited workflow), never raw store writes from
 * the UI. A source type is a classification, not a credibility rating.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function section(title, node) {
    return SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: title }), node);
  }

  function matchesSource(s, q) {
    var query = String(q || '').trim().toLowerCase();
    if (!query) { return true; }
    return [s.title, s.author, s.organization, s.citation, s.identifier,
      s.independence_group, s.geographic_scope]
      .some(function (x) { return String(x || '').toLowerCase().indexOf(query) !== -1; });
  }

  SCA.pages.evidence = function (root) {
    var filters = { query: '', source_type: '', review_status: '' };

    function applyFilters() {
      return SCA.store.all('evidence').filter(function (s) {
        if (filters.source_type && s.source_type !== filters.source_type) { return false; }
        if (filters.review_status && s.review_status !== filters.review_status) { return false; }
        return matchesSource(s, filters.query);
      });
    }

    function sourceCard(s) {
      var typeLabel = s.source_type
        ? SCA.enums.label(SCA.enums.source_types, s.source_type)
        : SCA.util.display(null);
      var reviewLabel = s.review_status
        ? SCA.enums.label(SCA.enums.verification_states, s.review_status)
        : SCA.util.display(null);
      var link = SCA.ui.el('a', { class: 'btn btn-ghost btn-small',
        href: '#/evidence/' + s.id }, 'View source');
      return SCA.ui.el('article', { class: 'card capability-card' },
        SCA.ui.el('div', { class: 'card-top' },
          SCA.ui.el('h3', {},
            SCA.ui.el('a', { class: 'link', href: '#/evidence/' + s.id }, s.title)),
          SCA.ui.badge('Source', 'muted')),
        SCA.ui.el('p', { class: 'card-meta' }, 'Type: ' + typeLabel),
        SCA.ui.el('div', { class: 'badge-row' },
          SCA.ui.badge('Author: ' + SCA.util.display(s.author), 'muted'),
          SCA.ui.badge('Review: ' + reviewLabel, 'accent')),
        SCA.ui.el('p', { class: 'card-meta' }, link));
    }

    function renderResults() {
      results.innerHTML = '';
      var list = applyFilters();
      results.appendChild(SCA.ui.el('p', { class: 'result-count', text:
        list.length + (list.length === 1 ? ' source' : ' sources') + ' found' }));
      if (!list.length) {
        results.appendChild(SCA.ui.emptyState({
          title: 'No sources documented yet',
          message: 'The Evidence Archive is empty: no sources have been entered ' +
            'into the Atlas. Sources are created through the audited evidence ' +
            'workflow; nothing is fabricated to populate the interface.'
        }));
        return;
      }
      list.forEach(function (s) { results.appendChild(sourceCard(s)); });
    }

    var results = SCA.ui.el('div', { class: 'results' });

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Evidence Archive',
        'The registry of sources behind the Atlas: books, archives, interviews, ' +
        'reports and more. A source being listed is documentation of provenance, ' +
        'not a credibility claim — review status is decided by reviewers.'),
      SCA.ui.el('form', { class: 'filter-bar', onsubmit: function (e) { e.preventDefault(); } },
        SCA.ui.el('label', { class: 'filter filter-wide' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Search'),
          (function () {
            var i = SCA.ui.el('input', { type: 'search',
              placeholder: 'Title, author, organization, citation',
              'aria-label': 'Search sources' });
            i.addEventListener('input', function () {
              filters.query = i.value; renderResults();
            });
            return i;
          })()),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Type'),
          (function () {
            var s = SCA.ui.select('source_type', SCA.enums.optionList(SCA.enums.source_types));
            s.addEventListener('change', function () {
              filters.source_type = s.value; renderResults();
            });
            return s;
          })()),
        SCA.ui.el('label', { class: 'filter' },
          SCA.ui.el('span', { class: 'filter-label' }, 'Review status'),
          (function () {
            var s = SCA.ui.select('review_status', SCA.enums.optionList(SCA.enums.verification_states));
            s.addEventListener('change', function () {
              filters.review_status = s.value; renderResults();
            });
            return s;
          })())),
      results));
    renderResults();
  };

  /* ---- Source detail ---- */
  SCA.pages.source = function (root, params) {
    var s = SCA.store.get('evidence', params.id);
    if (!s) {
      root.appendChild(SCA.ui.emptyState({
        title: 'Source not found',
        message: 'This record does not exist.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/evidence' }, 'Back to the Evidence Archive')
      }));
      return;
    }

    function row(label, value) {
      return SCA.ui.el('p', { class: 'detail-row' },
        SCA.ui.el('span', { class: 'detail-label', text: label }),
        SCA.ui.el('span', { text: SCA.util.display(value) }));
    }

    var claimsUsing = SCA.store.all('claims').filter(function (c) {
      return (c.source_ids || []).indexOf(s.id) !== -1;
    });
    var artifactsUsing = SCA.store.all('knowledge').filter(function (k) {
      return (k.source_ids || []).indexOf(s.id) !== -1;
    });
    var history = SCA.audit.forEntity('evidence', s.id);

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(s.title, ''),
      SCA.ui.el('p', { class: 'page-subtitle' },
        'Type: ' + (s.source_type
          ? SCA.enums.label(SCA.enums.source_types, s.source_type)
          : SCA.util.display(null))),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Review: ' + (s.review_status
          ? SCA.enums.label(SCA.enums.verification_states, s.review_status)
          : SCA.util.display(null)), 'accent'),
        SCA.ui.badge('Version: ' + SCA.util.display(s.version), 'muted')),

      section('Description', SCA.ui.el('p', {}, SCA.util.display(s.description))),
      section('Bibliographic details',
        row('Author', s.author),
        row('Organization', s.organization),
        row('Publication date', s.publication_date),
        row('Publication place', s.publication_place),
        row('Language', s.language),
        row('Identifier', s.identifier),
        row('Citation', s.citation),
        row('URL', s.url)),
      section('Scope and reliability',
        row('Geographic scope', s.geographic_scope),
        row('Temporal scope', s.temporal_scope),
        row('Reliability notes', s.reliability_notes),
        SCA.ui.el('p', { class: 'muted' },
          'Independence group: ' + SCA.util.display(s.independence_group) +
          '. Sources sharing an independence group derive from the same ' +
          'original and count as ONE evidence stream, not several.')),
      section('Connected capabilities',
        claimsUsing.length || artifactsUsing.length
          ? SCA.ui.el('ul', { class: 'detail-list' },
              claimsUsing.map(function (c) {
                var cap = SCA.store.get('capabilities', c.capability_id);
                return SCA.ui.el('li', {},
                  SCA.ui.el('a', { class: 'link',
                    href: '#/capabilities/' + c.capability_id },
                    cap ? cap.code + ' — ' + cap.name : c.capability_id),
                  ' (claim)');
              }).concat(artifactsUsing.map(function (k) {
                var capIds = k.capability_ids ||
                  (k.capability_id ? [k.capability_id] : []);
                return SCA.ui.el('li', {},
                  SCA.ui.el('a', { class: 'link', href: '#/knowledge/' + k.id }, k.title),
                  ' (knowledge artifact)');
              })))
          : SCA.ui.el('p', { class: 'muted',
              text: 'Not yet connected to any capability.' })),
      section('Provenance',
        row('Entered by', s.entered_by),
        row('Entered at', s.created_at),
        row('Reviewed by', s.reviewed_by),
        row('Provenance', s.provenance)),
      section('Audit history',
        history.length
          ? SCA.ui.el('ul', { class: 'detail-list' },
              history.map(function (h) {
                return SCA.ui.el('li', { text:
                  h.timestamp + ' — ' + h.actor + ' — ' + h.action +
                  (h.old_value || h.new_value
                    ? ' (' + SCA.util.display(h.old_value) + ' -> ' + SCA.util.display(h.new_value) + ')'
                    : '') });
              }))
          : SCA.ui.el('p', { class: 'muted', text: 'No audit entries yet.' })),

      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/evidence' }, 'Back to the Evidence Archive'))
    ));
  };
})(SCA);
