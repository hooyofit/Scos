/*
 * Repair & Spare-Part Network pages (Stage 8).
 *
 * Practical interfaces, not a visual showcase. Every view shows exactly
 * what has been documented, with scope labels:
 *   - "documented in the current dataset" never means "the only ones
 *     that exist";
 *   - unknown areas are displayed as Unknown, never as zero, false or
 *     "none";
 *   - no rankings: workshops are not scored, sorted by name only;
 *   - repair records (detailed procedures) are authenticated-only;
 *     technician and apprentice identities need repair person
 *     visibility.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  function row(label, value) {
    return SCA.ui.el('p', { class: 'detail-row' },
      SCA.ui.el('span', { class: 'detail-label', text: label }),
      SCA.ui.el('span', { text: value }));
  }

  function statusBadge(status) {
    return SCA.ui.el('span', {
      class: 'badge badge-' + String(status || 'UNKNOWN').toLowerCase()
    }, SCA.util.display(status));
  }

  function list(items) {
    if (!items || !items.length) {
      return SCA.ui.el('p', { class: 'muted' },
        'Not yet documented (this is not a claim that none exist).');
    }
    return SCA.ui.el('ul', { class: 'plain-list' },
      items.map(function (t) { return SCA.ui.el('li', {}, String(t)); }));
  }

  function unknownNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'Not documented does not mean nonexistent.'),
      SCA.ui.el('p', { class: 'muted' },
        'The Repair Network describes what research has documented. ' +
        'Every workshop, capability, part and pathway not represented ' +
        'here is Unknown — not absent.'));
  }

  /* ---------- Repair Network overview ---------- */

  SCA.pages.repairNetwork = function (root) {
    var user = SCA.state.get('user');
    var ov = SCA.repair.geographicOverview(user);

    var q = { workshop: '', part: '' };

    function render() {
      var user2 = SCA.state.get('user');
      var ov2 = SCA.repair.geographicOverview(user2);
      var workshops = SCA.repair.searchWorkshops(user2,
        q.workshop ? { query: q.workshop } : {});
      var parts = SCA.repair.searchSpareParts(user2,
        q.part ? { query: q.part } : {});
      var records = SCA.repair.searchRepairRecords(user2, {});

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Repair & Spare-Part Network'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'What has been documented about repairing and maintaining ' +
        'important systems: workshops, repair capabilities, spare-part ' +
        'pathways and completed repairs. Existence is not competence: ' +
        'each capability is documented separately.'));

      root.appendChild(unknownNotice());

      /* Overview counts (descriptive, never scored). */
      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Documented so far'),
          row('Documented workshops', String(ov2.documented_workshops)),
          row('Documented repair capabilities',
            String(ov2.documented_repair_capabilities)),
          row('Regions represented', String(ov2.regions_represented)),
          row('Spare-part pathways with supply documented',
            String(ov2.spare_part_pathways)),
          row('Fabrication pathways', String(ov2.fabrication_pathways)),
          SCA.ui.el('p', { class: 'muted' },
            'Counts describe the documented dataset only.')),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Unknown areas'),
          row('Parts with unknown compatibility',
            String(ov2.unknown_compatibility_parts)),
          SCA.ui.el('p', { class: 'muted' },
            'A part with unknown compatibility is not compatible and ' +
            'not incompatible: its compatibility is not yet ' +
            'documented. Compatibility requires evidence — similarity ' +
            'never creates it.'))));

      /* Workshop search + list (deterministic, name-sorted). */
      var wsSearch = SCA.ui.el('input', {
        class: 'input', type: 'search',
        placeholder: 'Filter workshops by name…',
        value: q.workshop
      });
      wsSearch.addEventListener('input', function () {
        q.workshop = wsSearch.value;
        render();
      });
      var wsCard = SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Workshops (' + workshops.length + ')'),
        wsSearch,
        (workshops.length ? SCA.ui.el('ul', { class: 'plain-list' },
          workshops.map(function (w) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link',
                href: '#/workshop/' + w.id }, SCA.util.display(w.name)),
              ' — ',
              statusBadge(w.status),
              SCA.ui.el('span', { class: 'muted' },
                ' · services: ' +
                (w.services && w.services.length ?
                  w.services.join(', ') : SCA.UNKNOWN_LABEL)));
          })) :
          SCA.ui.el('p', { class: 'muted' },
            'No workshop documented yet (not a claim that none exist).')));
      root.appendChild(wsCard);

      /* Spare-part search + list. */
      var partSearch = SCA.ui.el('input', {
        class: 'input', type: 'search',
        placeholder: 'Filter spare parts…',
        value: q.part
      });
      partSearch.addEventListener('input', function () {
        q.part = partSearch.value;
        render();
      });
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Spare parts (' + parts.length + ')'),
        partSearch,
        (parts.length ? SCA.ui.el('ul', { class: 'plain-list' },
          parts.map(function (p) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link',
                href: '#/spare-part/' + p.id },
                SCA.util.display(p.name)),
              ' — compatibility: ', statusBadge(p.compatibility_status),
              ' · availability: ', statusBadge(p.availability_status));
          })) :
          SCA.ui.el('p', { class: 'muted' },
            'No spare part documented yet.'))));

      /* Recent repair records (authenticated only). */
      root.appendChild(SCA.ui.el('div', { class: 'card' },
        SCA.ui.el('h2', {}, 'Repair records'),
        records.length ?
          SCA.ui.el('ul', { class: 'plain-list' },
            records.slice(-10).reverse().map(function (r) {
              return SCA.ui.el('li', {},
                SCA.ui.el('a', { class: 'link',
                  href: '#/repair-record/' + r.id },
                  SCA.util.display(r.date) + ' — ' +
                  SCA.util.display(r.failure_type)),
                ' — ', statusBadge(r.review_status));
            })) :
          (user2 ?
            SCA.ui.el('p', { class: 'muted' },
              'No repair record documented yet.') :
            SCA.ui.el('p', { class: 'muted' },
              'Sign in to view repair records: detailed repair ' +
              'documentation is not published to anonymous users ' +
              '(safety).')),
        SCA.ui.el('p', { class: 'muted' },
          'A repair record is historical documentation, not ' +
          'automatically a validated engineering procedure.')));
    }
    render();
  };

  /* ---------- Workshop detail ---------- */

  SCA.pages.workshopDetail = function (root, params) {
    var user = SCA.state.get('user');
    var w = SCA.store.get('workshops', params.id);
    root.innerHTML = '';
    if (!w) {
      root.appendChild(SCA.ui.el('h1', {}, 'Workshop'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'This workshop does not exist in the local dataset.'));
      return;
    }
    var view = SCA.repair.publicWorkshop(user, w);
    if (!view) {
      root.appendChild(SCA.ui.el('h1', {}, 'Workshop'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'This workshop record is not public.'));
      return;
    }
    var caps = SCA.repair.searchRepairCapabilities(user,
      { workshop_id: w.id });

    root.appendChild(SCA.ui.el('h1', {}, view.name));
    root.appendChild(statusBadge(view.status));
    if (view.status === 'REPORTED') {
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'Existence reported — not yet verified. A workshop record is ' +
        'never automatically verified.'));
    }

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Documented record'),
      row('Operating status', SCA.util.display(view.operating_status)),
      row('Availability', SCA.util.display(view.availability)),
      row('Services', list(view.services)),
      row('Supported asset types', list(view.supported_asset_types)),
      row('Supported models', list(view.supported_models)),
      row('Apprentice capacity', SCA.util.display(view.apprentice_capacity)),
      view.location_restricted ?
        SCA.ui.el('p', { class: 'muted' },
          'Exact location is protected (privacy policy).') :
        row('Location', SCA.store.get('locations', view.location_id) ?
          (SCA.store.get('locations', view.location_id).name ||
            view.location_id) : SCA.UNKNOWN_LABEL),
      row('Contact', view.contact_visibility === 'PUBLIC' ?
        SCA.util.display(view.contact_details) :
        'Restricted to signed-in staff.'),
      row('Limitations', SCA.util.display(view.limitations)),
      row('Safety notes', SCA.util.display(view.safety_notes))));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Repair capabilities'),
      SCA.ui.el('p', { class: 'muted' },
        'A workshop record does not mean it can repair every asset in ' +
        'its category. Each capability below is documented ' +
        'separately.'),
      caps.length ?
        SCA.ui.el('ul', { class: 'plain-list' },
          caps.map(function (c) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { class: 'link',
                href: '#/repair-capability/' + c.id },
                SCA.repair.assetLabel(c.asset_type, c.asset_id) ||
                  (c.asset_type + ':' + c.asset_id)),
              ' — ', statusBadge(c.status),
              ' · operations: ' +
              [].concat(c.repair_operations || [],
                c.diagnostic_capability ? ['diagnosis'] : [],
                c.fabrication_capability ? ['fabrication'] : [],
                c.testing_capability ? ['testing'] : [])
                .join(', ') || SCA.UNKNOWN_LABEL);
          })) :
        SCA.ui.el('p', { class: 'muted' },
          'No repair capability documented for this workshop yet (not ' +
          'a claim that none exist).'),
      row('Documented diagnostic capabilities',
        SCA.util.display(view.diagnostic_capabilities)),
      row('Documented repair capabilities',
        SCA.util.display(view.repair_capabilities)),
      row('Documented fabrication capabilities',
        SCA.util.display(view.fabrication_capabilities)),
      row('Documented testing capabilities',
        SCA.util.display(view.testing_capabilities))));

    root.appendChild(unknownNotice());
  };

  /* ---------- Repair capability detail ---------- */

  SCA.pages.repairCapabilityDetail = function (root, params) {
    var user = SCA.state.get('user');
    var c = SCA.store.get('repair_capabilities', params.id);
    root.innerHTML = '';
    if (!c) {
      root.appendChild(SCA.ui.el('h1', {}, 'Repair capability'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'This repair capability does not exist in the local dataset.'));
      return;
    }
    var view = SCA.repair.publicCapability(user, c);
    root.appendChild(SCA.ui.el('h1', {},
      'Repair capability: ' +
      (SCA.repair.assetLabel(c.asset_type, c.asset_id) ||
        (c.asset_type + ':' + c.asset_id))));
    root.appendChild(statusBadge(view.status));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'What is documented'),
      row('Workshop', (function () {
        var w = SCA.store.get('workshops', c.workshop_id);
        return w ? (w.name || w.id) : SCA.UNKNOWN_LABEL;
      })()),
      row('Practitioners', view.practitioners_restricted ?
        'Restricted (privacy).' :
        String((view.practitioner_ids || []).length) + ' linked'),
      row('Manufacturer', SCA.util.display(c.manufacturer)),
      row('Model', SCA.util.display(c.model)),
      row('Operations', [].concat(
        c.diagnostic_capability ? ['Diagnosis'] : [],
        (c.repair_operations || []).length ? ['Repair'] : [],
        c.fabrication_capability ? ['Fabrication'] : [],
        c.testing_capability ? ['Testing'] : []).join(', ') ||
        SCA.UNKNOWN_LABEL),
      SCA.ui.el('p', { class: 'muted' },
        'Diagnosis, repair, fabrication and testing are independent: ' +
        'one never implies another.'),
      row('Competence status', SCA.util.display(c.competence_status) +
        (c.competence_status === 'ASSESSED' ||
          c.competence_status === 'VERIFIED' ?
          ' (linked Stage 5 record)' : '')),
      SCA.ui.el('p', { class: 'muted' },
        'Years of experience never substitute for competence ' +
        'verification: Stage 5 owns competence authority.'),
      row('Supported conditions', SCA.util.display(c.supported_conditions)),
      row('Limitations', SCA.util.display(c.limitations)),
      row('Reviewer', SCA.util.display(c.reviewer)),
      row('Review reason', SCA.util.display(c.review_reason)),
      c.supersedes_id ?
        row('Supersedes', c.supersedes_id) : null,
      c.status === 'SUPERSEDED' ?
        SCA.ui.el('p', { class: 'muted' },
          'This capability is preserved history: it was superseded ' +
          'through an audited correction, not silently edited.') : null));

    root.appendChild(unknownNotice());
  };

  /* ---------- Spare-part detail ---------- */

  SCA.pages.sparePartDetail = function (root, params) {
    var user = SCA.state.get('user');
    var p = SCA.store.get('spare_parts', params.id);
    root.innerHTML = '';
    if (!p) {
      root.appendChild(SCA.ui.el('h1', {}, 'Spare part'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'This spare part does not exist in the local dataset.'));
      return;
    }
    var pp = SCA.repair.sparePartPathway(user, p.id);
    var fab = SCA.repair.fabricationPathway(user, p.id);

    root.appendChild(SCA.ui.el('h1', {}, p.name));
    root.appendChild(SCA.ui.el('p', {},
      'Compatibility: ', statusBadge(p.compatibility_status),
      ' · Availability: ', statusBadge(p.availability_status)));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Part record'),
      row('Part number', SCA.util.display(p.part_number)),
      row('Manufacturer', SCA.util.display(p.manufacturer)),
      row('Manufacturer part number',
        SCA.util.display(p.manufacturer_part_number)),
      row('Function', SCA.util.display(p['function'])),
      row('Specification', SCA.util.display(p.specification)),
      row('Compatible assets', (p.asset_ids || []).map(function (aid) {
        return SCA.repair.assetLabel(p.asset_type, aid) || aid;
      }).join(', ') || SCA.UNKNOWN_LABEL),
      row('Limitations', SCA.util.display(p.limitations)),
      row('Safety notes', SCA.util.display(p.safety_notes)),
      SCA.ui.el('p', { class: 'muted' },
        'Availability is not compatibility: a part stocked locally is ' +
        'not thereby compatible. Similar is not compatible.')));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Spare-part pathway'),
      row('Local stock', pp.local_stock.status === 'DOCUMENTED' ?
        pp.local_stock.value : 'Unknown / not yet documented'),
      row('Regional stock', pp.regional_stock.status === 'DOCUMENTED' ?
        pp.regional_stock.value : 'Unknown / not yet documented'),
      row('External supplier / import',
        pp.external_supplier.status === 'DOCUMENTED' ?
          pp.external_supplier.value : 'Unknown / not yet documented'),
      row('Alternative parts', pp.alternative_parts.status ===
        'DOCUMENTED' ?
        pp.alternative_parts.parts.map(function (a) {
          return a.name; }).join(', ') : 'Unknown / not yet documented'),
      row('Substitute materials', pp.substitute_materials.status ===
        'DOCUMENTED' ?
        pp.substitute_materials.materials.map(function (m) {
          return m.name; }).join(', ') :
        'Unknown / not yet documented'),
      row('Lead time', pp.lead_time.status === 'DOCUMENTED' ?
        pp.lead_time.value : 'Unknown / not yet documented'),
      row('Last verified', pp.last_verified.status === 'DOCUMENTED' ?
        pp.last_verified.value : 'Not yet verified'),
      SCA.ui.el('p', { class: 'muted' }, pp.scope_note)));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Local fabrication pathway'),
      SCA.ui.el('p', { class: 'muted' },
        'Fabrication is inspected step by step with evidence at each ' +
        'step — never reduced to one "locally manufacturable" boolean.'),
      fab.steps.map(function (st) {
        return row(st.step.replace(/_/g, ' '),
          st.status === 'DOCUMENTED' ? 'Documented' :
          st.status === 'REPORTED' ? 'Reported' : 'Unknown');
      })));

    root.appendChild(unknownNotice());
  };

  /* ---------- Repair record detail ---------- */

  SCA.pages.repairRecordDetail = function (root, params) {
    var user = SCA.state.get('user');
    var r = SCA.store.get('repair_records', params.id);
    root.innerHTML = '';
    if (!r) {
      root.appendChild(SCA.ui.el('h1', {}, 'Repair record'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'This repair record does not exist in the local dataset.'));
      return;
    }
    var view = SCA.repair.publicRepairRecord(user, r);
    if (!view) {
      root.appendChild(SCA.ui.el('h1', {}, 'Repair record'));
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'Detailed repair documentation is available to signed-in ' +
        'users only (safety).'));
      return;
    }
    root.appendChild(SCA.ui.el('h1', {},
      'Repair record — ' + SCA.util.display(r.date)));
    root.appendChild(statusBadge(r.review_status));
    if (r.review_status === 'ACCEPTED') {
      root.appendChild(SCA.ui.el('p', { class: 'muted' },
        'Accepted means reviewed as documentation/evidence — not that ' +
        'every technical conclusion is scientifically validated.'));
    }

    function names(coll, ids) {
      return (ids || []).map(function (id) {
        var rec = SCA.store.get(coll, id);
        return rec ? (rec.name || rec.title || id) : id;
      }).join(', ');
    }

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Failure & diagnosis'),
      row('Asset', SCA.repair.assetLabel(r.asset_type, r.asset_id) ||
        (r.asset_type + ':' + r.asset_id)),
      row('Failure category', SCA.util.display(r.failure_type)),
      row('Symptoms', SCA.util.display(r.symptoms)),
      row('Diagnosis', SCA.util.display(r.diagnosis)),
      row('Root cause', SCA.util.display(r.root_cause)),
      SCA.ui.el('p', { class: 'muted' },
        'Root cause is never inferred from symptoms: it is documented ' +
        'evidence, not automatic inference.')));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Repair'),
      row('Repair action', SCA.util.display(r.repair_action)),
      row('Workshop', (function () {
        var w = SCA.store.get('workshops', r.workshop_id);
        return w ? (w.name || w.id) : SCA.UNKNOWN_LABEL;
      })()),
      row('Technicians', view.persons_restricted ?
        'Restricted (privacy).' :
        (r.technician_ids || []).length + ' documented'),
      row('Tools used', names('tools', r.tools_used)),
      row('Materials used', names('materials', r.materials_used)),
      row('Parts used', names('spare_parts', r.parts_used)),
      row('Substitutes used', names('spare_parts', r.substitutes_used)),
      row('Local substitute', r.local_substitute ? 'Yes' :
        (r.local_substitute === false ? 'No' : 'Unknown')),
      row('Fabrication used', r.fabrication_used ? 'Yes' :
        (r.fabrication_used === false ? 'No' : 'Unknown')),
      row('Repair time', SCA.util.display(r.repair_time)),
      row('Downtime', SCA.util.display(r.downtime)),
      row('Cost', SCA.util.display(r.repair_cost)),
      row('External dependency', SCA.util.display(r.external_dependency))));

    root.appendChild(SCA.ui.el('div', { class: 'card' },
      SCA.ui.el('h2', {}, 'Result & knowledge'),
      row('Test result', SCA.util.display(r.test_result)),
      row('Returned to service', r.return_to_service ? 'Yes' :
        (r.return_to_service === false ? 'No' : 'Unknown')),
      row('Lesson', SCA.util.display(r.lesson)),
      r.knowledge_artifact_id ?
        row('Knowledge artifact', SCA.ui.el('a', { class: 'link',
          href: '#/knowledge/' + r.knowledge_artifact_id },
        'View artifact').outerHTML ? 'Linked to the Knowledge Archive' :
          'Linked') : null,
      row('Apprentice participation', view.persons_restricted ?
        'Restricted (privacy).' :
        ((r.apprentice_ids || []).length ?
          (r.apprentice_ids.length + ' apprentice(s)') :
          'Not documented')),
      SCA.ui.el('p', { class: 'muted' },
        'Apprentice participation is practical learning, not ' +
        'certification. Assessments and certifications stay with ' +
        'Stage 5.'),
      row('Safety notes', SCA.util.display(r.safety_notes)),
      row('PPE requirements', SCA.util.display(r.ppe_requirements)),
      row('Qualification requirements',
        SCA.util.display(r.qualification_requirements)),
      row('Reviewer', SCA.util.display(r.reviewer)),
      row('Review reason', SCA.util.display(r.review_reason))));

    root.appendChild(unknownNotice());
  };
})(SCA);
