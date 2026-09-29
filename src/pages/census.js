/*
 * Census pages (Stage 6): national overview (honest about gaps), census
 * list, census detail with the Capability × Location matrix, data gaps,
 * snapshots and regional profiles. Public aggregate views are
 * privacy-thresholded; small counts show as Restricted.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: SCA.util.display(value) }));
  }

  function label(list, code) {
    return SCA.enums.label(list, code);
  }

  /* ---------- Census list + national overview ---------- */
  SCA.pages.census = function (root) {
    var user = SCA.state.get('user');
    var censuses = SCA.store.all('capability_censuses');
    var overview = SCA.census.nationalOverview(user);

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Capability Census',
        'Where does a capability exist? Who possesses it, who teaches it, ' +
        'how widely is it distributed - and what do we still not know?'),
      SCA.ui.el('div', { class: 'notice notice-warn' },
        SCA.ui.el('p', { text: overview.disclaimer })));

    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'What the Atlas currently documents' }),
      row('Capabilities in the inventory', overview.total_capabilities),
      row('Capabilities with documented information',
        overview.documented_capabilities),
      row('Documented practitioners', overview.documented_practitioners),
      row('Locations in the Atlas', overview.locations_in_atlas),
      row('Locations with accepted census data',
        overview.locations_with_census_data),
      row('Evidence distribution', Object.keys(overview.evidence_distribution)
        .map(function (k) {
          return k + ': ' + overview.evidence_distribution[k]; }).join(' / ')),
      SCA.ui.el('p', { class: 'muted', text: overview.no_rankings_note })));

    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Censuses' }),
      censuses.length
        ? SCA.ui.el('ul', { class: 'detail-list' }, censuses.map(function (c) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link', href: '#/census/' + c.id,
                text: c.title }),
              SCA.ui.badge(' ' + label(SCA.enums.census_statuses, c.status),
                'accent'),
              SCA.ui.badge(' ' + label(SCA.enums.census_scope_levels,
                c.scope_level), 'muted'));
          }))
        : SCA.ui.el('p', { class: 'muted',
            text: 'No census has been created yet. A region with no census ' +
              'data is Not Surveyed - which is information, not a finding ' +
              'that capabilities are absent.' })));

    if (user && SCA.rbac.can(user, 'census.create')) {
      var title = SCA.ui.el('input', { type: 'text',
        placeholder: 'Census title' });
      var scopeSel = SCA.ui.select('scope',
        SCA.enums.optionList(SCA.enums.census_scope_levels), 'COMMUNITY');
      var methSel = SCA.ui.select('meth',
        [{ value: '', label: '(methodology attached before approval)' }]
          .concat(SCA.store.all('census_methodologies').map(function (m) {
            return { value: m.id, label: m.title + ' (' + m.status + ')' };
          })));
      var msg = SCA.ui.el('p', { class: 'muted' });
      var btn = SCA.ui.el('button', { class: 'btn btn-primary', type: 'button' },
        'Create census (works offline)');
      btn.addEventListener('click', function () {
        var res = SCA.census.createCensus(user, {
          title: title.value, scope_level: scopeSel.value,
          methodology_id: methSel.value || null });
        if (res.ok) { location.hash = '#/census/' + res.record.id; location.reload(); }
        else { msg.textContent = ''; msg.appendChild(SCA.ui.errorList(res.errors)); }
      });
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Create a census' }),
        SCA.ui.el('p', { class: 'muted',
          text: 'Scope locations and capabilities are defined after ' +
            'creation, on the census page. Estimates require an approved ' +
            'methodology with an estimation method.' }),
        SCA.ui.el('div', { class: 'filter-bar' }, title, scopeSel, methSel, btn),
        msg));
    }
    root.appendChild(content);
  };

  /* ---------- Census detail ---------- */
  SCA.pages.censusDetail = function (root, params) {
    var user = SCA.state.get('user');
    var c = SCA.store.get('capability_censuses', params.id);
    if (!c) {
      root.appendChild(SCA.ui.emptyState({ title: 'Census not found',
        message: 'This census does not exist.' }));
      return;
    }
    var meth = c.methodology_id ?
      SCA.store.get('census_methodologies', c.methodology_id) : null;
    var matrix = SCA.census.matrix(c.id, user);
    var gaps = SCA.census.gaps(c.id).gaps.slice(0, 25);
    var cov = SCA.census.coverageMeasurements(c.id);
    var snapshots = SCA.store.all('census_snapshots').filter(function (s) {
      return s.census_id === c.id; });

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(c.title,
        'A measurement exercise. Unknown stays Unknown; absence of data ' +
        'is never absence of capability.'),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge(' ' + label(SCA.enums.census_statuses, c.status), 'accent'),
        SCA.ui.badge(' ' + label(SCA.enums.census_scope_levels, c.scope_level),
          'muted'),
        meth ? SCA.ui.badge(' Methodology: ' + meth.title +
          ' (' + (meth.status) + ')', 'muted') : null));

    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Coverage (measurements, not scores)' }),
      row('Capabilities in scope', cov.capabilities_in_scope),
      row('Capabilities surveyed',
        cov.capabilities_surveyed + ' of ' + cov.capabilities_in_scope),
      row('Capabilities with documented practitioners',
        cov.capabilities_with_documented_practitioners + ' of ' +
        cov.capabilities_surveyed + ' surveyed'),
      row('Capabilities with documented trainers',
        cov.capabilities_with_documented_trainers + ' of ' +
        cov.capabilities_surveyed + ' surveyed'),
      row('Locations in scope', cov.locations_in_scope),
      row('Locations surveyed',
        cov.locations_surveyed + ' of ' + cov.locations_in_scope)));

    /* Capability × Location matrix */
    var matrixEl;
    if (matrix.rows.length) {
      matrixEl = SCA.ui.el('table', { class: 'enum-table census-matrix' },
        SCA.ui.el('thead', {},
          SCA.ui.el('tr', {},
            ['Capability', 'Location', 'Survey', 'Practitioners', 'Trainers',
              'Apprentices', 'Evidence'].map(function (h) {
              return SCA.ui.el('th', { text: h }); }))),
        SCA.ui.el('tbody', {}, matrix.rows.map(function (r) {
          return SCA.ui.el('tr', {},
            SCA.ui.el('td', { text: r.capability_code }),
            SCA.ui.el('td', { text: r.location_name }),
            SCA.ui.el('td', { text: label(SCA.enums.survey_statuses,
              r.survey_status) }),
            SCA.ui.el('td', { text: r.practitioners }),
            SCA.ui.el('td', { text: r.trainers }),
            SCA.ui.el('td', { text: r.apprentices }),
            SCA.ui.el('td', { text: r.evidence_status }));
        })));
    } else {
      matrixEl = SCA.ui.el('p', { class: 'muted',
        text: 'No accepted observations yet. Cells without data stay ' +
          'Not Surveyed, never "absent".' });
    }
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Capability × Location matrix' }),
      matrixEl));

    /* Data gaps */
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Data gaps — what to investigate next' }),
      SCA.ui.el('p', { class: 'muted',
        text: 'A work list for researchers, not a risk ranking.' }),
      gaps.length
        ? SCA.ui.el('ul', { class: 'detail-list' }, gaps.map(function (g) {
            return SCA.ui.el('li', { text: g.message });
          }))
        : SCA.ui.el('p', { class: 'muted', text: 'No gaps listed.' }),
      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/field-research' },
          'Plan field research for a gap (manual workflow, never automatic)'))));

    /* Snapshots */
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Snapshots (immutable once published)' }),
      snapshots.length
        ? SCA.ui.el('ul', { class: 'detail-list' }, snapshots.map(function (s) {
            return SCA.ui.el('li', {},
              SCA.ui.el('span', { text: (s.label || s.id) + ' — ' +
                label(SCA.enums.snapshot_statuses, s.status) +
                ' — surveyed ' + s.capabilities_surveyed + ' of ' +
                s.capabilities_in_scope + ' capabilities' }),
              (s.unknown_fields || []).length
                ? SCA.ui.el('span', { class: 'muted',
                    text: ' (some cells Unknown: ' +
                      s.unknown_fields.length + ')' }) : null);
          }))
        : SCA.ui.el('p', { class: 'muted',
            text: 'No snapshot yet. A later census produces a NEW snapshot; ' +
              'published snapshots are never overwritten.' })));

    /* Actions */
    if (user) {
      var actMsg = SCA.ui.el('p', { class: 'muted' });
      function act(labelText, fn) {
        var b = SCA.ui.el('button', { class: 'btn btn-ghost', type: 'button' },
          labelText);
        b.addEventListener('click', function () {
          var res = fn();
          if (res && res.ok) { location.reload(); }
          else { actMsg.textContent = '';
            actMsg.appendChild(SCA.ui.errorList((res && res.errors) || {})); }
        });
        return b;
      }
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Census actions' }),
        SCA.ui.el('div', { class: 'badge-row' },
          c.status === 'DRAFT' && SCA.rbac.can(user, 'census.approve')
            ? act('Approve census (needs approved methodology + reason)',
              function () { return SCA.census.setCensusStatus(user, c.id,
                'APPROVED', { reason: 'Approved from census page' }); }) : null,
          c.status === 'APPROVED'
            ? act('Start census (Active)', function () {
              return SCA.census.setCensusStatus(user, c.id, 'ACTIVE', {}); })
            : null,
          c.status === 'ACTIVE' && SCA.rbac.can(user, 'census.submit')
            ? act('Complete census', function () {
              return SCA.census.setCensusStatus(user, c.id, 'COMPLETED', {}); })
            : null,
          SCA.rbac.can(user, 'census.snapshot')
            ? act('Generate snapshot (draft)', function () {
              return SCA.census.generateSnapshot(user, c.id); }) : null,
          SCA.rbac.can(user, 'census.snapshot')
            ? act('Publish latest draft snapshot', function () {
              var draft = SCA.store.all('census_snapshots').filter(
                function (s) {
                  return s.census_id === c.id && s.status === 'DRAFT'; })[0];
              if (!draft) { return { ok: false,
                errors: { id: 'No draft snapshot to publish.' } }; }
              return SCA.census.publishSnapshot(user, draft.id); }) : null),
        actMsg));
    }
    root.appendChild(content);
  };
})(SCA);
