/*
 * Capability Graph pages (Stage 7): inspection of how capabilities and
 * the systems around them connect.
 *
 * This is NOT a visualization project: a simple text/tree
 * representation, correct and honest, beats a pretty but misleading
 * picture. The page shows exactly what has been documented:
 *   - relationships (PROPOSED / DOCUMENTED / VERIFIED and their
 *     outcomes), with scope, provenance and review state;
 *   - dependency chains and reverse chains as inspection views;
 *   - cycles as legitimate structures;
 *   - «No relationship documented does not mean no relationship
 *     exists» on every view.
 *
 * Nothing is labeled critical, risky or important. No completeness
 * percentage: research coverage is described, never scored.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  var R = null;
  function reg() { if (!R) { R = SCA.graphRegistry; } return R; }

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: SCA.util.display(value) }));
  }

  function nodeLabel(n) {
    var rec = n ? SCA.graph.nodeRecord(n) : null;
    return (rec && (rec.name || rec.title || rec.public_name)) ||
      (n ? n.type + ':' + n.id : '?');
  }

  function nodeLink(n) {
    if (n.type === 'CAPABILITY') {
      return SCA.ui.el('a', { class: 'link', href: '#/capabilities/' + n.id },
        nodeLabel(n));
    }
    return SCA.ui.el('span', { text: nodeLabel(n) + ' ' });
  }

  function unknownNotice(extra) {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'No relationship documented does not mean no relationship exists.'),
      SCA.ui.el('p', { class: 'muted' },
        (extra || '') + 'The graph shows what research has documented, not ' +
        'what is true of the world. Everything not represented is Unknown, ' +
        'not independent.'));
  }

  /* Text tree for a dependency chain. Inspection only — no risk labels. */
  function chainLines(chainNode, lines, prefix) {
    lines.push(prefix + nodeLabel(chainNode.node) +
      (chainNode.cycle ? '  (cycle — relationship already shown above)' : ''));
    (chainNode.dependencies || []).forEach(function (d, i, arr) {
      var last = i === arr.length - 1;
      lines.push(prefix + (last ? '└─ ' : '├─ ') +
        d.edge.relationship_type + ' → ' + nodeLabel(d.node));
      chainLines(d, lines, prefix + (last ? '   ' : '│  '));
    });
  }

  /* ---------- overview + inspector ---------- */
  SCA.pages.graph = function (root) {
    var user = SCA.state.get('user');
    var all = SCA.store.all('graph_edges');
    var visible = SCA.graph.edges(user);
    var byStatus = {};
    visible.forEach(function (e) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    });

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader('Capability Graph',
        'How do capabilities connect to the people, materials, tools, ' +
        'energy and institutions around them?'),
      SCA.ui.el('div', { class: 'notice notice-warn' },
        SCA.ui.el('p', {},
          'The graph is a research tool, not a finished map of reality.'),
        SCA.ui.el('p', { class: 'muted' },
          'Most relationships in Somalia are not yet documented. That is a ' +
          'statement about research coverage, and it is never summarized as a ' +
          'completeness percentage: research has not been conducted everywhere, ' +
          'relationships have not all been documented, and technical sources ' +
          'are not always available. ' + all.length +
          ' relationship record(s) exist; ' + visible.length +
          ' are visible to you.')));

    /* Honest overview: statuses, types, nodes — never a score. */
    var typesUsed = {};
    visible.forEach(function (e) {
      typesUsed[e.relationship_type] = (typesUsed[e.relationship_type] || 0) + 1;
    });
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'What the graph currently documents' }),
      row('Relationships visible to you', visible.length),
      row('Proposed (unreviewed)', byStatus.PROPOSED || 0),
      row('Documented (provenance attached)', byStatus.DOCUMENTED || 0),
      row('Verified (reviewer-confirmed)', byStatus.VERIFIED || 0),
      row('Relationship types in use',
        Object.keys(typesUsed).map(function (t) {
          return t + ' (' + typesUsed[t] + ')'; }).join(', ') || 'None yet'),
      SCA.ui.el('p', { class: 'muted' },
        'Proposed relationships are researcher working data. Public visitors ' +
        'see Documented and Verified relationships only; person-level nodes ' +
        'stay protected.')));

    /* ---------- node inspector ---------- */
    var caps = SCA.store.all('capabilities');
    var capSel = SCA.ui.select('graph-node', caps.map(function (c) {
      return { value: c.id, label: c.code + ' — ' + c.name }; }));
    var inspector = SCA.ui.el('div', {});
    function renderInspector() {
      inspector.textContent = '';
      var capId = capSel.value;
      if (!capId) {
        inspector.appendChild(SCA.ui.el('p', { class: 'muted' },
          'Select a capability to inspect its neighborhood, dependency ' +
          'chain and dependents.'));
        return;
      }
      var me = { type: 'CAPABILITY', id: capId };
      var nb = SCA.graph.neighborhood(user, me);

      var groups = nb.groups;
      var CATS = [['dependencies', 'Depends on'],
        ['dependents', 'What depends on this'],
        ['support', 'Supports / enables'], ['maintenance', 'Maintains / repairs'],
        ['training', 'Teaching'], ['production', 'Produces'],
        ['fallback', 'Fallback pathways'], ['resource', 'Resources'],
        ['energy', 'Energy'], ['institution', 'Institutions'],
        ['location', 'Located in'], ['evidence', 'Evidence & documentation'],
        ['failure', 'Failure & recovery'], ['modernization', 'Modernization'],
        ['reproduction', 'Reproduction']];
      inspector.appendChild(unknownNotice());
      CATS.forEach(function (pair) {
        var cat = pair[0];
        if (!groups[cat] || !groups[cat].length) { return; }
        inspector.appendChild(SCA.ui.el('p', { class: 'card-meta',
          text: pair[1] + ':' }));
        inspector.appendChild(SCA.ui.el('ul', { class: 'detail-list' },
          groups[cat].map(function (step) {
            var other = step.target || step.other || step.source;
            return SCA.ui.el('li', {},
              nodeLink(other),
              SCA.ui.el('span', { class: 'muted',
                text: ' — ' + step.edge.relationship_type + ' (' +
                step.edge.status + ') ' }),
              SCA.ui.el('a', { class: 'link', href: '#/graph/' + step.edge.id },
                'view'));
          })));
      });
      inspector.appendChild(SCA.ui.el('p', { class: 'muted' },
        'Relationship groups with nothing listed are Unknown — not yet ' +
        'documented in the Atlas.'));

      /* Dependency chain (inspection only). */
      var chain = SCA.graph.chain(user, me, { depth: 6 });
      var lines = [];
      chainLines(chain.root, lines, '');
      inspector.appendChild(SCA.ui.el('p', { class: 'card-meta',
        text: 'Dependency chain (inspection view — no risk labels):' }));
      inspector.appendChild(SCA.ui.el('pre', { class: 'code-block',
        text: lines.join('\n') || nodeLabel(me) + ' (no dependencies documented)' }));

      /* Reverse chain: what depends on this. Count is never a score. */
      var deps = SCA.graph.dependents(user, me);
      inspector.appendChild(SCA.ui.el('p', { class: 'card-meta',
        text: 'Dependents (' + deps.length + ' documented — a count, not an ' +
        'importance score):' }));
      inspector.appendChild(deps.length ? SCA.ui.el('ul', { class: 'detail-list' },
        deps.map(function (step) {
          return SCA.ui.el('li', {},
            nodeLink(step.source),
            SCA.ui.el('span', { class: 'muted',
              text: ' — ' + step.edge.relationship_type + ' → this (' +
              step.edge.status + ') ' }),
            SCA.ui.el('a', { class: 'link', href: '#/graph/' + step.edge.id },
              'view'));
        })) : SCA.ui.el('p', { class: 'muted',
        text: 'No dependents documented (Unknown, not none).' }));

      /* Cycles: legitimate structures, reported, never judged. */
      var cyc = SCA.graph.cycles(user, me).cycles;
      if (cyc.length) {
        inspector.appendChild(SCA.ui.el('p', { class: 'card-meta',
          text: 'Cycles containing this node (' + cyc.length + ') — ' +
          'legitimate graph structures, preserved as documented:' }));
        inspector.appendChild(SCA.ui.el('ul', { class: 'detail-list' },
          cyc.map(function (c) {
            return SCA.ui.el('li', { text:
              c.nodes.map(nodeLabel).join(' → ') + ' → ' +
              nodeLabel(c.nodes[0]) });
          })));
      }
    }
    capSel.addEventListener('change', renderInspector);
    renderInspector();
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Inspect a capability' }),
      capSel, inspector));

    /* ---------- all relationships ---------- */
    content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Relationships' }),
      visible.length ? SCA.ui.el('ul', { class: 'detail-list' },
        visible.slice(0, 100).map(function (e) {
          return SCA.ui.el('li', {},
            nodeLink({ type: e.source_type, id: e.source_id }),
            SCA.ui.el('span', { class: 'muted',
              text: ' — ' + e.relationship_type + ' → ' }),
            nodeLink({ type: e.target_type, id: e.target_id }),
            SCA.ui.el('span', { class: 'muted', text: ' (' + e.status + ') ' }),
            SCA.ui.el('a', { class: 'link', href: '#/graph/' + e.id }, 'view'));
        })) : SCA.ui.el('p', { class: 'muted' },
        'No relationships documented yet. The graph starts empty by design: ' +
        'nothing is inferred, nothing is fabricated.')));

    /* ---------- create (researchers) ---------- */
    if (user && SCA.rbac.can(user, 'graph.create')) {
      content.appendChild(createSection(user));
    }

    /* ---------- review queue (reviewers) ---------- */
    if (user && SCA.rbac.can(user, 'graph.review')) {
      content.appendChild(reviewSection(user));
    }

    root.appendChild(content);
  };

  /* Record options for a node type, honest about emptiness. */
  function nodeOptions(type) {
    var coll = reg().collectionFor(type);
    var recs = coll ? SCA.store.all(coll) : [];
    return recs.map(function (r) {
      return { value: r.id,
        label: (r.code ? r.code + ' — ' : '') + (r.name || r.title || r.public_name || r.id) };
    });
  }

  /* End-picker: node type + record, rebuilt on type change. */
  function endPicker(prefix) {
    var types = Object.keys(reg().NODE_TYPES);
    var typeSel = SCA.ui.select(prefix + '-type', types.map(function (t) {
      return { value: t, label: reg().NODE_TYPES[t].label };
    }));
    var recSel = SCA.ui.select(prefix + '-rec', nodeOptions(types[0]));
    typeSel.addEventListener('change', function () {
      var opts = nodeOptions(typeSel.value);
      recSel.textContent = '';
      opts.forEach(function (o) {
        var op = SCA.ui.el('option', { value: o.value }, o.label);
        recSel.appendChild(op);
      });
      if (!opts.length) {
        recSel.appendChild(SCA.ui.el('option', { value: '' },
          'No records of this type yet (create via entry or import)'));
      }
    });
    return {
      node: function () {
        return { type: typeSel.value, id: recSel.value };
      },
      elements: [typeSel, recSel]
    };
  }

  function createSection(user) {
    var relTypes = Object.keys(reg().RELATIONSHIPS);
    var status = SCA.ui.el('p', { class: 'muted' });

    var typeSel = SCA.ui.select('graph-rel-type', relTypes.map(function (t) {
      return { value: t, label: t + ' — ' + reg().RELATIONSHIPS[t].label };
    }));
    var src = endPicker('graph-src');
    var tgt = endPicker('graph-tgt');
    var scopeSel = SCA.ui.select('graph-scope',
      SCA.enums.optionList(SCA.enums.graph_scopes));
    var scopeDesc = SCA.ui.el('input', { type: 'text',
      placeholder: 'Describe the scope (required unless General)' });
    var conditions = SCA.ui.el('input', { type: 'text',
      placeholder: 'Operating conditions, if any (optional)' });
    var limitations = SCA.ui.el('input', { type: 'text',
      placeholder: 'Limitations of this documentation (optional)' });

    var btn = SCA.ui.el('button', { class: 'btn btn-primary' },
      'Propose relationship');
    btn.addEventListener('click', function () {
      var res = SCA.graph.createRelationship(user, {
        relationship_type: typeSel.value,
        source_type: src.node().type, source_id: src.node().id,
        target_type: tgt.node().type, target_id: tgt.node().id,
        scope: scopeSel.value, scope_description: scopeDesc.value,
        conditions: conditions.value, limitations: limitations.value
      });
      status.textContent = '';
      if (res.ok) {
        status.appendChild(SCA.ui.el('span', { text:
          'Proposed as edge ' + res.record.id + '. It becomes DOCUMENTED ' +
          'once provenance is attached and verified only through review.' }));
      } else {
        status.appendChild(SCA.ui.errorList(res.errors));
      }
    });

    return SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Propose a relationship' }),
      SCA.ui.el('div', { class: 'notice' },
        SCA.ui.el('p', { class: 'muted' },
          'Every relationship originates here — from explicit researcher ' +
          'entry, imported reviewed data, or another authorized workflow. ' +
          'The system never infers relationships, never creates them from ' +
          'text, and never treats "usually required" as a documented fact.')),
      row('Relationship type', ''),
      typeSel,
      row('Source (from)', ''),
      src.elements[0], src.elements[1],
      row('Target (to)', ''),
      tgt.elements[0], tgt.elements[1],
      row('Scope', ''),
      scopeSel, scopeDesc,
      conditions, limitations,
      btn, status);
  }

  function reviewSection(user) {
    var status = SCA.ui.el('p', { class: 'muted' });
    var pending = SCA.store.all('graph_edges').filter(function (e) {
      return e.status === 'PROPOSED' || e.status === 'DOCUMENTED'; });

    if (!pending.length) {
      return SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Review queue' }),
        SCA.ui.el('p', { class: 'muted' },
          'No relationships awaiting review. No PROPOSED edge is ever ' +
          'automatically verified.'), status);
    }

    var list = SCA.ui.el('ul', { class: 'detail-list' });
    pending.forEach(function (e) {
      var reason = SCA.ui.el('input', { type: 'text',
        placeholder: 'Reason (required for every review action)' });
      var markBtn = SCA.ui.el('button', { class: 'btn btn-ghost' },
        'Mark documented');
      var verifyBtn = SCA.ui.el('button', { class: 'btn btn-ghost' }, 'Verify');
      var rejectBtn = SCA.ui.el('button', { class: 'btn btn-ghost' }, 'Reject');
      function run(fn, to) {
        var res = fn(user, e.id, { reason: reason.value });
        status.textContent = '';
        status.appendChild(res.ok
          ? SCA.ui.el('span', { text: 'Edge ' + e.id + ' ' + to + '.' })
          : SCA.ui.errorList(res.errors));
        if (res.ok) { location.hash = '#/graph'; location.hash = '#/graph/' + e.id; }
      }
      markBtn.addEventListener('click', function () {
        run(SCA.graph.markDocumented, 'marked DOCUMENTED'); });
      verifyBtn.addEventListener('click', function () {
        run(SCA.graph.verify, 'VERIFIED'); });
      rejectBtn.addEventListener('click', function () {
        run(SCA.graph.reject, 'REJECTED'); });

      list.appendChild(SCA.ui.el('li', {},
        SCA.ui.el('a', { class: 'link', href: '#/graph/' + e.id },
          nodeLabel({ type: e.source_type, id: e.source_id }) + ' ' +
          e.relationship_type + ' ' +
          nodeLabel({ type: e.target_type, id: e.target_id })),
        SCA.ui.el('span', { class: 'muted', text: ' — ' + e.status }),
        SCA.ui.el('div', {}, reason),
        SCA.ui.el('div', {}, markBtn, verifyBtn, rejectBtn)));
    });

    var panel = SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: 'Review queue (' + pending.length + ')' }),
      list, status);

    /* Integrity + admin tools. */
    var integ = SCA.graph.integrity();
    var integPanel = SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'Graph integrity: ' + (integ.ok ? 'no issues found' :
          integ.issues.length + ' issue(s) found') +
        ' (' + integ.checked + ' edge(s) checked).'),
      SCA.ui.el('p', { class: 'muted' },
        'An orphaned or broken edge must never silently remain: it is ' +
        'retired through the audited path, with history preserved.'));
    if (!integ.ok && user && SCA.rbac.can(user, 'graph.admin')) {
      integ.issues.forEach(function (issue) {
        var retireBtn = SCA.ui.el('button', { class: 'btn btn-ghost' },
          'Retire ' + issue.edge_id);
        retireBtn.addEventListener('click', function () {
          var res = SCA.graph.retire(user, issue.edge_id,
            'Integrity check: ' + issue.kind + ' (' + issue.detail + ')');
          status.textContent = '';
          status.appendChild(res.ok
            ? SCA.ui.el('span', { text: 'Edge ' + issue.edge_id + ' retired.' })
            : SCA.ui.errorList(res.errors));
        });
        integPanel.appendChild(SCA.ui.el('p', {},
          SCA.ui.el('span', { class: 'muted',
            text: issue.kind + ': ' + issue.detail + ' (edge ' +
            issue.edge_id + ') ' }), retireBtn));
      });
    } else if (!integ.ok) {
      integ.issues.forEach(function (issue) {
        integPanel.appendChild(SCA.ui.el('p', { class: 'muted',
          text: issue.kind + ': ' + issue.detail + ' (edge ' +
          issue.edge_id + ')' }));
      });
    }
    panel.appendChild(integPanel);
    return panel;
  }

  /* ---------- relationship detail ---------- */
  SCA.pages.graphDetail = function (root, params) {
    var user = SCA.state.get('user');
    var e = SCA.store.get('graph_edges', params.id);
    if (!e) {
      root.appendChild(SCA.ui.emptyState({
        title: 'Relationship not found',
        message: 'This edge does not exist.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/graph' },
          'Back to the Capability Graph')
      }));
      return;
    }
    var srcRec = SCA.graph.nodeRecord({ type: e.source_type, id: e.source_id });
    var tgtRec = SCA.graph.nodeRecord({ type: e.target_type, id: e.target_id });
    var srcHidden = !srcRec || (reg().PERSON_NODE_TYPES.indexOf(e.source_type) !== -1 &&
      !(user && (SCA.rbac.can(user, 'graph.create') || SCA.rbac.can(user, 'graph.review'))));
    var tgtHidden = !tgtRec || (reg().PERSON_NODE_TYPES.indexOf(e.target_type) !== -1 &&
      !(user && (SCA.rbac.can(user, 'graph.create') || SCA.rbac.can(user, 'graph.review'))));
    if (srcHidden || tgtHidden) {
      root.appendChild(SCA.ui.emptyState({
        title: 'Not available',
        message: 'This relationship references protected records.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/graph' },
          'Back to the Capability Graph')
      }));
      return;
    }

    var rel = reg().RELATIONSHIPS[e.relationship_type];
    var prov = [];
    Object.keys(SCA.graph.PROVENANCE_FIELDS).forEach(function (f) {
      (e[f] || []).forEach(function (id) {
        var rec = SCA.store.get(SCA.graph.PROVENANCE_FIELDS[f], id);
        prov.push(f.replace('_ids', '') + ': ' +
          (rec ? (rec.title || rec.name || rec.public_name || rec.code || id)
            : id + ' (broken reference)'));
      });
    });
    var regions = (e.region_ids || []).map(function (id) {
      var l = SCA.store.get('locations', id);
      return l ? (l.name || id) : id + ' (broken reference)';
    });

    var content = SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(e.relationship_type + ' — relationship detail', ''),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.el('span', { class: 'badge accent', text: e.status }),
        SCA.ui.el('span', { class: 'badge muted', text: 'v' + e.version })),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Direction' }),
        SCA.ui.el('p', {},
          nodeLink({ type: e.source_type, id: e.source_id }),
          SCA.ui.el('span', { class: 'muted',
            text: ' (' + reg().NODE_TYPES[e.source_type].label + ') ' }),
          SCA.ui.el('strong', { text: ' —' + e.relationship_type + '→ ' }),
          nodeLink({ type: e.target_type, id: e.target_id }),
          SCA.ui.el('span', { class: 'muted',
            text: ' (' + reg().NODE_TYPES[e.target_type].label + ') ' })),
        SCA.ui.el('p', { class: 'muted' },
          rel ? rel.meaning : 'Unknown relationship type in this build.')),
      SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Documentation' }),
        row('Status', e.status),
        row('Scope', e.scope + (e.scope_description ? ' — ' + e.scope_description : '')),
        row('Regions', regions.join(', ') || 'None (this relationship claims no geographic narrowing)'),
        row('Conditions', e.conditions),
        row('Limitations', e.limitations),
        row('Confidence', e.confidence === 'UNASSESSED' ? 'Not assessed' :
          e.confidence + ' — ' + (e.confidence_basis || '')),
        row('Provenance', prov.join(', ') || 'None attached (PROPOSED only)'),
        row('Reviewer', e.reviewer),
        row('Reviewed at', e.reviewed_at),
        row('Review reason', e.review_reason),
        row('Created by', e.created_by),
        row('Version', e.version)),
      unknownNotice('A scoped observation never becomes a national claim. '));

    if (e.supersedes_id || e.superseded_by_id) {
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Supersession' }),
        e.supersedes_id ? SCA.ui.el('p', {},
          'Supersedes: ',
          SCA.ui.el('a', { class: 'link', href: '#/graph/' + e.supersedes_id },
            e.supersedes_id)) : null,
        e.superseded_by_id ? SCA.ui.el('p', {},
          'Superseded by: ',
          SCA.ui.el('a', { class: 'link',
            href: '#/graph/' + e.superseded_by_id }, e.superseded_by_id)) : null,
        SCA.ui.el('p', { class: 'muted' },
          'Historical states are preserved, never overwritten.')));
    }

    if ((e.history || []).length) {
      content.appendChild(SCA.ui.el('section', { class: 'detail-section' },
        SCA.ui.el('h3', { text: 'Version history (' + e.history.length + ')' }),
        SCA.ui.el('ul', { class: 'detail-list' },
          e.history.map(function (h) {
            var txt = 'v' + h.version + ' — ' + h.changed_at + ' — ' +
              h.changed_by + (h.reason ? ' — "' + h.reason + '"' : '') +
              ' — status was ' + h.status;
            return SCA.ui.el('li', { text: txt });
          }))));
    }

    content.appendChild(SCA.ui.el('p', {},
      SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/graph' },
        'Back to the Capability Graph')));
    root.appendChild(content);
  };
})(SCA);
