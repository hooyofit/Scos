/*
 * Capability detail page (Stage 2). Shows exactly what is documented and
 * nothing more: unknown fields display as "Not yet documented". The
 * research-status section keeps the inventory/evidence/verification
 * distinction visible on every record.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function section(title, node) {
    return SCA.ui.el('section', { class: 'detail-section' },
      SCA.ui.el('h3', { text: title }), node);
  }

  function emptyList() {
    return SCA.ui.el('p', { class: 'muted', text: 'Not yet documented' });
  }

  function listOf(items) {
    if (!items || !items.length) { return emptyList(); }
    return SCA.ui.el('ul', { class: 'detail-list' },
      items.map(function (i) { return SCA.ui.el('li', { text: String(i) }); }));
  }

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: SCA.util.display(value) }));
  }

  SCA.pages.capability = function (root, params) {
    var c = SCA.store.get('capabilities', params.id);
    if (!c) {
      root.appendChild(SCA.ui.emptyState({
        title: 'Capability not found',
        message: 'This record does not exist.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/capabilities' }, 'Back to the Capability Atlas')
      }));
      return;
    }

    var fam = SCA.store.get('families', c.family_id);
    var isMedical = fam && fam.code === 'S';

    var knowledge = SCA.store.all('knowledge').filter(function (k) {
      return k.capability_id === c.id;
    });
    var sources = (c.source_ids || []).map(function (sid) {
      return SCA.store.get('evidence', sid);
    }).filter(Boolean);

    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.pageHeader(c.name, ''),
      SCA.ui.el('p', { class: 'page-subtitle' },
        SCA.ui.el('code', { class: 'cap-code', text: c.code }),
        ' — Family: ',
        SCA.ui.el('a', { class: 'link', href: '#/capabilities?family=' + fam.id },
          fam.code + ' — ' + fam.name)),
      SCA.ui.el('div', { class: 'badge-row' },
        SCA.ui.badge('Evidence: ' + SCA.util.display(c.evidence_level &&
          c.evidence_level + ' — ' + SCA.enums.label(SCA.enums.evidence_levels, c.evidence_level)), 'muted'),
        SCA.ui.badge('Verification: ' + SCA.util.display(c.verification_status), 'muted'),
        SCA.ui.badge('Documentation: ' + SCA.util.display(c.documentation_status), 'accent'),
        SCA.ui.badge('Version: ' + SCA.util.display(c.version), 'muted')),

      /* Research status: the inventory/evidence distinction, on every record. */
      section('Research status',
        SCA.ui.el('div', { class: 'notice' },
          SCA.ui.el('p', {},
            'Inventory record — research documentation not yet completed.'),
          SCA.ui.el('p', { class: 'muted' },
            'This capability has been identified as a research subject. That does not ' +
            'mean it has been proven to work, was practiced by all Somalis, is ' +
            'currently practiced, or should be revived. Evidence, verification and ' +
            'validation belong to later research stages.'))),
      isMedical ? section('Medical safety',
        SCA.ui.el('div', { class: 'notice' },
          SCA.ui.el('p', {},
            'Preserve the knowledge. Validate the treatment. Protect the patient.'),
          SCA.ui.el('p', { class: 'muted' },
            'This record documents a research subject. It is not a medical ' +
            'recommendation, and it contains no treatment instructions.'))) : null,

      section('Description',
        SCA.ui.el('p', {}, SCA.util.display(c.short_description)),
        SCA.ui.el('p', { class: 'muted' },
          'Detailed description: ' + SCA.util.display(c.description))),
      section('Evidence',
        row('Historical status', c.historical_status),
        row('Living status', c.living_status ? c.living_status + ' — ' +
          SCA.enums.label(SCA.enums.living_status, c.living_status) : null),
        row('Evidence level', c.evidence_level),
        row('Verification status', c.verification_status),
        row('Reviewer', c.reviewer),
        row('Reviewed at', c.reviewed_at),
        SCA.ui.el('p', { class: 'muted' },
          'S0 (Unknown / not yet documented) means no living-status assessment has ' +
          'been documented for this record. It is not a finding that the capability ' +
          'is historically absent or no longer practiced. Evidence levels (E0–E5) ' +
          'and living status (S0–S7) are independent scales; capability maturity is ' +
          'a separate field and remains unset until a maturity assessment is performed.')),
      /* Stage 3: evidence archive section — connected claims, artifacts,
         sources; explicit E0 wording; controlled upgrade panel. */
      section('Evidence archive', (function () {
        var claims = SCA.store.all('claims').filter(function (x) {
          return x.capability_id === c.id; });
        var artifacts = SCA.store.all('knowledge').filter(function (x) {
          var ids = x.capability_ids || (x.capability_id ? [x.capability_id] : []);
          return ids.indexOf(c.id) !== -1; });
        var sourceIds = {};
        claims.forEach(function (x) { (x.source_ids || []).forEach(function (sid) { sourceIds[sid] = true; }); });
        artifacts.forEach(function (x) { (x.source_ids || []).forEach(function (sid) { sourceIds[sid] = true; }); });
        var sources = Object.keys(sourceIds).map(function (sid) {
          return SCA.store.get('evidence', sid); }).filter(Boolean);

        var node = SCA.ui.el('div', {},
          SCA.ui.el('p', { class: 'card-meta' },
            'Connected claims: ' + claims.length +
            ' — knowledge artifacts: ' + artifacts.length +
            ' — sources: ' + sources.length),
          SCA.ui.el('div', { class: 'notice' },
            SCA.ui.el('p', {},
              (c.evidence_level === 'E0')
                ? 'No evidence has yet been entered into the Atlas for this capability.'
                : 'Evidence level ' + c.evidence_level + ' — ' +
                  SCA.enums.label(SCA.enums.evidence_levels, c.evidence_level) + '.'),
            SCA.ui.el('p', { class: 'muted' },
              '"No evidence has yet been entered" is a statement about the Atlas, ' +
              'not about history or practice: it does not mean the capability is ' +
              'false, nonexistent, historically absent or unimportant.')));
        [['Claims', claims, function (x) { return SCA.ui.el('li', { text: x.claim_text }); }],
         ['Knowledge artifacts', artifacts, function (x) {
           return SCA.ui.el('li', {},
             SCA.ui.el('a', { class: 'link', href: '#/knowledge/' + x.id }, x.title)); }],
         ['Sources', sources, function (x) {
           return SCA.ui.el('li', {},
             SCA.ui.el('a', { class: 'link', href: '#/evidence/' + x.id }, x.title)); }]]
          .forEach(function (pair) {
            node.appendChild(SCA.ui.el('p', { class: 'card-meta', text: pair[0] + ':' }));
            node.appendChild(pair[1].length
              ? SCA.ui.el('ul', { class: 'detail-list' }, pair[1].map(pair[2]))
              : SCA.ui.el('p', { class: 'muted', text: 'Not yet documented' }));
          });

        /* Controlled evidence-level upgrade: one step at a time, requires
           a reason and at least one cited source, restricted to holders of
           evidence.verify. This is the ONLY UI path to change E-levels. */
        var user = SCA.state.get('user');
        if (user && SCA.rbac.can(user, 'evidence.verify')) {
          var from = c.evidence_level || 'E0';
          var nextLevel = 'E' + (parseInt(from.slice(1), 10) + 1);
          var allowed = SCA.enums.has(SCA.enums.evidence_levels, nextLevel);
          var status = SCA.ui.el('p', { class: 'muted' });
          node.appendChild(SCA.ui.el('details', { class: 'upgrade-panel' },
            SCA.ui.el('summary', {},
              'Reviewer: evidence level review (' + from + ' -> ' +
                (allowed ? nextLevel : '—') + ')'),
            allowed ? (function () {
              var reason = SCA.ui.el('textarea', { rows: 3,
                placeholder: 'Why does the cited evidence meet the criteria for ' + nextLevel + '?' });
              var sourceSel = SCA.ui.select('upgrade-source',
                SCA.store.all('evidence').map(function (src) {
                  return { value: src.id, label: src.title }; }));
              var btn = SCA.ui.el('button', { class: 'btn btn-primary',
                type: 'submit' }, 'Request upgrade');
              btn.addEventListener('click', function () {
                var res = SCA.evidence.requestUpgrade(user, c.id, {
                  to: nextLevel,
                  reason: reason.value,
                  source_ids: sourceSel.value ? [sourceSel.value] : []
                });
                if (res.ok) {
                  location.hash = '#/capabilities/' + c.id;
                } else {
                  status.textContent = '';
                  status.appendChild(SCA.ui.errorList(res.errors));
                }
              });
              return SCA.ui.el('div', {},
                reason, sourceSel, btn, status);
            })() : SCA.ui.el('p', { class: 'muted' },
              'This record is already at the highest evidence level (E5).')));
        }
        return node;
      })()),
      section('Geographic scope',
        SCA.ui.el('p', { class: 'muted' },
          'Regions currently documented: ' + (c.regions && c.regions.length
            ? c.regions.join(', ')
            : 'none. No regional coverage is assigned without supporting evidence.'))),
      /* Stage 8: documented repair & maintenance pathways for this
         capability (as an asset). Deterministic inspection only —
         no ranking, no scoring; undocumented never means nonexistent. */
      section('Repair & Maintenance', (function () {
        var ruser = SCA.state.get('user');
        var caps = SCA.repair.searchRepairCapabilities(ruser,
          { asset_type: 'CAPABILITY', asset_id: c.id });
        var parts = SCA.repair.searchSpareParts(ruser,
          { asset_type: 'CAPABILITY' });
        var records = SCA.repair.searchRepairRecords(ruser,
          { asset_type: 'CAPABILITY', asset_id: c.id });
        var els = [];
        els.push(caps.length ?
          SCA.ui.el('ul', { class: 'plain-list' }, caps.map(function (rc) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link',
                href: '#/repair-capability/' + rc.id },
                'Repair capability: ' + (rc.repair_operations || [])
                  .join(', ') + (rc.diagnostic_capability ?
                  ' (+diagnosis)' : '') + (rc.fabrication_capability ?
                  ' (+fabrication)' : '') + (rc.testing_capability ?
                  ' (+testing)' : '')),
              ' — ', String(rc.status));
          })) :
          SCA.ui.el('p', { class: 'muted', text:
            'No repair capability documented for this capability yet ' +
            '(not a claim that none exist).' }));
        els.push(parts.length ?
          SCA.ui.el('p', { class: 'muted', text:
            'Spare parts documented for this capability: ' +
            parts.map(function (pp) {
              return pp.name + ' (compatibility ' +
                pp.compatibility_status + ')';
            }).join('; ') }) :
          SCA.ui.el('p', { class: 'muted', text:
            'No spare part documented for this capability yet.' }));
        els.push(records.length ?
          SCA.ui.el('p', { class: 'muted', text:
            'Repair records: ' + records.length +
            '. See the Repair & Spare-Part Network.' }) :
          SCA.ui.el('p', { class: 'muted', text:
            'No repair record documented for this capability yet.' }));
        return els;
      })()),
      section('Practitioners',
        listOf(c.practitioners)),
      section('Knowledge',
        knowledge.length ? listOf(knowledge.map(function (k) { return k.title; }))
          : emptyList()),
      /* Stage 7: capability graph relationships. Inspection only —
         nothing here is labeled critical, risky or important. No
         relationship documented never means no relationship exists. */
      section('Relationships (graph)', (function () {
        var guser = SCA.state.get('user');
        var me = { type: 'CAPABILITY', id: c.id };
        var deps = SCA.graph.dependencies(guser, me);
        var dependents = SCA.graph.dependents(guser, me);
        var rels = SCA.graph.outgoing(guser, me, { statuses: null });
        var groups = SCA.graph.neighborhood(guser, me).groups;

        function nodeLabel(n) {
          var rec = SCA.graph.nodeRecord(n);
          return (rec && (rec.name || rec.title || rec.public_name)) ||
            (n.type + ':' + n.id);
        }
        function relList(steps) {
          if (!steps || !steps.length) {
            return SCA.ui.el('p', { class: 'muted', text: 'Not yet documented' });
          }
          return SCA.ui.el('ul', { class: 'detail-list' },
            steps.map(function (step) {
              var other = step.target || step.other || step.source;
              return SCA.ui.el('li', {},
                (step.direction === 'incoming' ? '← ' : '') +
                step.edge.relationship_type + ' — ' + nodeLabel(other) +
                ' (' + SCA.enums.label(SCA.enums.graph_edge_statuses,
                  step.edge.status) + ') ',
                SCA.ui.el('a', { class: 'link', href: '#/graph/' + step.edge.id }, 'view'));
            }));
        }
        function catLabel(cat) {
          return { dependency: 'Depends on', dependents: 'What depends on this',
            support: 'Supports / enables', maintenance: 'Maintains / repairs',
            training: 'Teaching', production: 'Produces', fallback: 'Fallback',
            resource: 'Resources', energy: 'Energy', institution: 'Institutions',
            location: 'Located in', evidence: 'Evidence & documentation',
            failure: 'Failure & recovery', modernization: 'Modernization',
            reproduction: 'Reproduction' }[cat] || cat;
        }
        var node = SCA.ui.el('div', {},
          SCA.ui.el('p', { class: 'card-meta' },
            'Relationships documented: ' + rels.length +
            ' — dependencies: ' + deps.length +
            ' — dependents: ' + dependents.length),
          SCA.ui.el('div', { class: 'notice' },
            SCA.ui.el('p', {},
              'No relationship documented does not mean no relationship exists.'),
            SCA.ui.el('p', { class: 'muted' },
              'The graph shows what research has documented, not what is true ' +
              'of the world. Everything not represented here is Unknown, not ' +
              'independent.')),
          SCA.ui.el('p', {},
            SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/graph' },
              'Open the Capability Graph')));
        Object.keys(groups).forEach(function (cat) {
          node.appendChild(SCA.ui.el('p', { class: 'card-meta',
            text: catLabel(cat) + ':' }));
          node.appendChild(relList(groups[cat]));
        });
        return node;
      })()),
      section('Modern equivalent',
        SCA.ui.el('p', {}, SCA.util.display(c.modern_equivalent))),
      section('Fallback',
        SCA.ui.el('p', {}, SCA.util.display(c.fallback))),
      section('Resilience',
        row('Recovery time', c.recovery_time),
        row('Recovery difficulty', c.recovery_difficulty),
        row('Repair radius', c.repair_radius),
        row('Recovery radius', c.recovery_radius)),
      section('Safety',
        SCA.ui.el('p', {}, SCA.util.display(c.safety_notes))),
      section('Sources',
        sources.length ? listOf(sources.map(function (s) { return s.title || s.id; }))
          : SCA.ui.el('p', { class: 'muted', text: 'Not yet documented' })),
      /* Stage 5: the human side of this capability — who practices, who
         teaches, who learns, and whether the knowledge can reproduce
         itself. Never a score; Unknown where not documented. */
      section('People & Capability Reproduction',
        (function () {
          var user = SCA.state.get('user');
          var profile = SCA.training.reproductionProfile(c.id);
          if (profile.practitioner_count === 0 && profile.apprentice_count === 0 &&
            profile.organizations_with_capability.length === 0) {
            return SCA.ui.el('p', { class: 'muted',
              text: 'No practitioner data has yet been entered into the Atlas.' });
          }
          var practitioners = SCA.store.all('practitioners').filter(function (p) {
            return (p.capability_ids || p.capabilities || []).indexOf(c.id) !== -1; });
          var trainers = practitioners.filter(function (p) {
            return p.trainer_readiness === 'READY' ||
              p.trainer_readiness === 'ACTIVE_TRAINER'; });
          var apprentices = SCA.store.all('apprentices').filter(function (a) {
            return a.capability_id === c.id; });
          return [
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Practitioners documented' }),
              SCA.ui.el('span', { text: String(profile.practitioner_count) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Verified practitioners' }),
              SCA.ui.el('span', { text: String(profile.verified_practitioner_count) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Trainers' }),
              SCA.ui.el('span', { text: String(profile.trainer_count) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Active apprenticeships' }),
              SCA.ui.el('span', { text: String(profile.active_apprentice_count) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Completed apprenticeships' }),
              SCA.ui.el('span', { text: String(profile.completed_apprenticeship_count) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Organizations with this capability' }),
              SCA.ui.el('span', { text: String(profile.organizations_with_capability.length) })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Geographic coverage' }),
              SCA.ui.el('span', { text: profile.geographic_coverage.length
                ? profile.geographic_coverage.join(', ')
                : 'Unknown' })),
            SCA.ui.el('p', { class: 'detail-row' },
              SCA.ui.el('span', { class: 'detail-label', text: 'Last verified' }),
              SCA.ui.el('span', { text: profile.last_verified || 'Unknown' })),
            practitioners.length ? listOf(practitioners.map(function (p) {
              return p.public_name +
                (p.verification_status ? ' (' + SCA.enums.label(
                  SCA.enums.practitioner_statuses, p.verification_status) + ')' : ''); }))
              : null,
            trainers.length ? SCA.ui.el('p', { class: 'muted',
              text: 'Trainers: ' + trainers.map(function (p) {
                return p.public_name; }).join(', ') }) : null,
            apprentices.length ? SCA.ui.el('p', { class: 'muted',
              text: 'Apprentices: ' + apprentices.map(function (a) {
                return a.public_name; }).join(', ') }) : null
          ];
        })()),

      /* Stage 14: read-only continuity section (frozen scope v1.1
       * + authorization §32). Consumes every authority, owns none;
       * the existence of a plan or reserve NEVER implies the
       * capability is resilient. */
      (function () {
        var c = SCA.reserve.continuityForCapability(params.id);
        var kids = [
          SCA.ui.el('h2', { text: 'Continuity' }),
          SCA.ui.el('p', { class: 'muted',
            text: 'A read-only continuity summary. The existence of ' +
              'a plan or reserve never implies this capability is ' +
              'resilient.' }),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Practitioners documented' }),
            SCA.ui.el('span', { text: String(c.people.practitioners) +
              ' (within the available evidence/census scope)' })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Trainers documented' }),
            SCA.ui.el('span', { text: String(c.people.trainers) })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Apprentices documented' }),
            SCA.ui.el('span', { text: String(c.people.apprentices) })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'One-Person Test (derived)' }),
            SCA.ui.el('span', { text: c.one_person_test.wording })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Three-Generation Test (derived)' }),
            SCA.ui.el('span', { text: SCA.enums.label(
              SCA.enums.three_generation_states,
              c.three_generation_test.state) +
              ' (derived from Stage 5; never stored)' })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Recovery profiles (Stage 9)' }),
            SCA.ui.el('span', { text: c.recovery_profiles.length ?
              c.recovery_profiles.map(function (rp) {
                return rp.id; }).join(', ') : 'Not yet documented' })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Continuity plans' }),
            SCA.ui.el('span', { text: c.continuity_plans.length ?
              c.continuity_plans.map(function (pl) {
                return pl.id + ' (' + pl.status + ')'; }).join(', ') :
              'Not yet documented' })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Reserves' }),
            SCA.ui.el('span', { text: c.reserves.length ?
              c.reserves.map(function (r) {
                return r.name + ' (' + r.status + ')'; }).join(', ') :
              'Not yet documented' })),
          SCA.ui.el('p', { class: 'detail-row' },
            SCA.ui.el('span', { class: 'detail-label',
              text: 'Known gaps (documented conditions)' }),
            SCA.ui.el('span', { text: c.known_gaps.length ?
              c.known_gaps.join(', ') : 'None documented' }))
        ];
        return SCA.ui.el('div', { class: 'card' }, kids);
      })(),

      SCA.ui.el('p', {},
        SCA.ui.el('a', { class: 'btn btn-ghost', href: '#/capabilities' }, 'Back to the Capability Atlas'))
    ));
  };
})(SCA);
