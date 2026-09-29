/*
 * Capability Intervention pages (Stage 10: Capability Intervention
 * Foundation).
 *
 * One workspace: the intervention register (neutral, searchable,
 * never ranked) and the intervention detail (the full planning
 * record with its lifecycle). Every view shows exactly what has been
 * documented, with scope labels:
 *   - "documented in the current dataset" never means "the only ones
 *     that exist";
 *   - unknown areas are displayed as Unknown, never as zero, false or
 *     "none";
 *   - no scores, no rankings, no prioritization, no "best"
 *     recommendation — funding and priority decisions are human ones;
 *   - anonymous visitors see only APPROVED / ACTIVE / COMPLETED
 *     records; drafts and review-in-progress material are staff-only;
 *   - practitioner references follow the existing Stage 5 masking
 *     rules: public views show role descriptions and counts, never
 *     private identities.
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

  function muted(text) {
    return SCA.ui.el('p', { class: 'muted', text: text });
  }

  function scopeNotice() {
    return SCA.ui.el('div', { class: 'notice' },
      SCA.ui.el('p', {},
        'A planning layer, not a judgment layer.'),
      SCA.ui.el('p', { class: 'muted' },
        'Interventions record what humans propose and undertake to ' +
        'strengthen capabilities. Completing an activity never implies ' +
        'it succeeded — outcome status is assessed separately by ' +
        'reviewers, on evidence. Nothing here is scored, ranked or ' +
        'prioritized: those are governance decisions, made by people.'));
  }

  function roleDisplay(role) {
    /* Stage 5 masking: never a practitioner identity here — a role
     * description, honest UNKNOWN, or "identity restricted". */
    if ((role.status || 'UNKNOWN') === 'IDENTIFIED') {
      return role.role + ': 1 — identity restricted';
    }
    return role.role + ': UNKNOWN (not yet identified)';
  }

  /* ---------- Intervention register ---------- */

  SCA.pages.interventionRegister = function (root) {
    var q = { query: '', type: '', status: '' };

    function render() {
      var user = SCA.state.get('user');
      var canRead = SCA.rbac.can(user, 'intervention.read');
      var canCreate = SCA.rbac.can(user, 'intervention.create');

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('h1', {}, 'Capability Interventions'));
      root.appendChild(SCA.ui.el('p', { class: 'lede' },
        'What is being proposed or undertaken to strengthen Somali ' +
        'capabilities: documenting and preserving knowledge, training ' +
        'people, building infrastructure, organizing repair, ' +
        'production, resilience, modernization and validation ' +
        'activities.'));
      root.appendChild(scopeNotice());

      if (!canRead) {
        root.appendChild(muted('Intervention information requires ' +
          'signing in.'));
        return;
      }

      var filters = {};
      if (q.query) { filters.query = q.query; }
      if (q.type) { filters.intervention_type = q.type; }
      if (q.status) { filters.status = q.status; }
      var res = SCA.intervention.searchInterventions(user, filters);
      var list = res.ok ? res.results : [];

      var counts = {};
      SCA.intervention.PUBLIC_STATUSES.concat(['DRAFT', 'SUBMITTED',
        'UNDER_REVIEW', 'SUSPENDED', 'CANCELLED']).forEach(function (st) {
        counts[st] = 0;
      });
      list.forEach(function (iv) {
        counts[iv.status] = (counts[iv.status] || 0) + 1;
      });

      root.appendChild(SCA.ui.el('div', { class: 'grid grid-2' },
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Interventions documented'),
          row('Records visible to you in this dataset',
            String(list.length) +
            ' (not a claim about what exists)'),
          Object.keys(counts).map(function (st) {
            return row(st, String(counts[st]));
          })),
        SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Find interventions'),
          muted('Neutral search by name, type or lifecycle state. ' +
            'The register never ranks or recommends.'),
          SCA.ui.el('input', { type: 'search',
            placeholder: 'Search interventions…',
            value: q.query,
            oninput: function (e) {
              q.query = e.target.value;
              render();
            } }),
          SCA.ui.el('p', {},
            SCA.ui.el('select', {
              onchange: function (e) { q.type = e.target.value; render(); }
            }, [SCA.ui.el('option', { value: '',
              text: 'All intervention types' })]
              .concat(SCA.enums.optionList(
                SCA.enums.intervention_types).map(function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              }))),
            SCA.ui.el('select', {
              onchange: function (e) {
                q.status = e.target.value;
                render();
              }
            }, [SCA.ui.el('option', { value: '',
              text: 'All visible lifecycle states' })]
              .concat(SCA.enums.optionList(
                SCA.enums.intervention_statuses).map(function (o) {
                return SCA.ui.el('option', { value: o.value,
                  text: o.label });
              })))))));

      if (canCreate) {
        root.appendChild(SCA.ui.el('div', { class: 'card' },
          SCA.ui.el('h2', {}, 'Plan an intervention'),
          muted('Creates a DRAFT planning record. Canonical ' +
            'references (capabilities, evidence, recovery profiles…) ' +
            'are attached on the record and validated against the ' +
            'existing collections — never copied or fabricated.'),
          renderCreateForm(user)));
      }

      root.appendChild(SCA.ui.el('h2', {}, 'Intervention register'));
      if (!list.length) {
        root.appendChild(muted('No interventions documented here yet ' +
          '(this is not a claim that none exist or none are needed).'));
      } else {
        root.appendChild(SCA.ui.el('ul', { class: 'plain-list' },
          list.map(function (iv) {
            return SCA.ui.el('li', {},
              SCA.ui.el('a', { href: '#/intervention/' + iv.id },
                iv.name),
              ' — ' + SCA.enums.label(SCA.enums.intervention_types,
                iv.intervention_type) + ' — ' +
                SCA.util.display(iv.status));
          })));
      }
    }

    function renderCreateForm(user) {
      var form = SCA.ui.el('div', {});
      var fields = {
        name: SCA.ui.el('input', { type: 'text',
          placeholder: 'Intervention name (e.g. Solar pump maintenance training)' }),
        intervention_type: SCA.ui.el('select', {},
          SCA.enums.optionList(SCA.enums.intervention_types)
            .map(function (o) {
              return SCA.ui.el('option', { value: o.value,
                text: o.label });
            })),
        objective: SCA.ui.el('input', { type: 'text',
          placeholder: 'Objective (what this intervention should achieve)' }),
        problem_description: SCA.ui.el('input', { type: 'text',
          placeholder: 'Problem / context (free-form only where no ' +
            'FailureScenario exists)' }),
        capability_ids: SCA.ui.el('input', { type: 'text',
          placeholder: 'Capability record ids (comma separated)' }),
        implementation_region: SCA.ui.el('input', { type: 'text',
          placeholder: 'Implementation region (as documented)' })
      };
      var msg = muted('');
      var btn = SCA.ui.el('button', { text: 'Create DRAFT intervention' });
      btn.addEventListener('click', function () {
        var res = SCA.intervention.createIntervention(user, {
          name: fields.name.value,
          intervention_type: fields.intervention_type.value,
          objective: fields.objective.value,
          problem_description: fields.problem_description.value,
          capability_ids: fields.capability_ids.value ?
            fields.capability_ids.value.split(',')
              .map(function (x) { return x.trim(); })
              .filter(Boolean) : [],
          implementation_region: fields.implementation_region.value
        });
        if (res.ok) {
          msg.textContent = 'Intervention created as DRAFT. Submit it ' +
            'for review when the plan is ready.';
          Object.keys(fields).forEach(function (k) {
            if (k !== 'intervention_type') { fields[k].value = ''; }
          });
        } else {
          msg.textContent = Object.keys(res.errors || {})
            .map(function (k) { return k + ': ' + res.errors[k]; })
            .join(' ');
        }
        render();
      });
      Object.keys(fields).forEach(function (k) {
        form.appendChild(fields[k]);
      });
      form.appendChild(btn);
      form.appendChild(msg);
      return form;
    }

    render();
  };

  /* ---------- Intervention detail ---------- */

  SCA.pages.interventionDetail = function (root, params) {
    var user = SCA.state.get('user');
    root.innerHTML = '';
    var res = SCA.intervention.getIntervention(user, params.id);
    if (!res.ok) {
      root.appendChild(SCA.ui.el('h1', {}, 'Intervention'));
      root.appendChild(muted(res.errors.permission ||
        res.errors.id ||
        'Not documented in this dataset (this is not a claim that it ' +
        'does not exist).'));
      return;
    }
    var iv = res.record;
    var canReview = SCA.rbac.can(user, 'intervention.review');
    var canUpdate = SCA.rbac.can(user, 'intervention.update');

    root.appendChild(SCA.ui.el('h1', {}, iv.name || 'Intervention'));
    root.appendChild(statusBadge(iv.status));
    root.appendChild(row('Intervention type',
      SCA.enums.label(SCA.enums.intervention_types,
        iv.intervention_type) || 'Unknown'));
    root.appendChild(row('Objective', SCA.util.display(iv.objective)));
    if (iv.description) {
      root.appendChild(row('Description', iv.description));
    }

    /* Problem / context. */
    root.appendChild(SCA.ui.el('h2', {}, 'Problem & context'));
    if (iv.problem_description) {
      root.appendChild(row('Problem', iv.problem_description));
    }
    if (iv.observed_condition) {
      root.appendChild(row('Observed condition', iv.observed_condition));
    }
    if (iv.implementation_region) {
      root.appendChild(row('Implementation region',
        iv.implementation_region));
    }
    if (iv.intended_beneficiaries) {
      root.appendChild(row('Intended beneficiaries',
        iv.intended_beneficiaries));
    }
    if ((iv.failure_scenario_ids || []).length) {
      root.appendChild(row('Documented failure scenarios',
        iv.failure_scenario_ids.map(function (id) {
          return SCA.intervention.referenceLabel('failure_scenarios', id);
        }).join(', ')));
    }

    /* Canonical references (labels only, never copied data). */
    root.appendChild(SCA.ui.el('h2', {}, 'Canonical references'));
    Object.keys(SCA.intervention.REFERENCE_FIELDS)
      .forEach(function (field) {
        var ids = iv[field] || [];
        if (!ids.length) { return; }
        root.appendChild(row(field.replace(/_/g, ' '),
          ids.map(function (id) {
            return SCA.intervention.referenceLabel(
              SCA.intervention.REFERENCE_FIELDS[field], id);
          }).join(', ')));
      });
    if (iv.responsible_organization_id) {
      root.appendChild(row('Responsible organization',
        SCA.intervention.referenceLabel('organizations',
          iv.responsible_organization_id)));
    }

    /* Dependency disclosure (No Orphan Project Rule). */
    root.appendChild(SCA.ui.el('h2', {}, 'Dependencies'));
    ['required_capabilities', 'required_skills', 'required_equipment',
      'required_materials', 'required_tools',
      'required_infrastructure', 'required_energy',
      'required_spare_parts', 'required_repair_capability',
      'required_training', 'institutional_support',
      'external_dependencies', 'dependencies'].forEach(function (f) {
      if ((iv[f] || []).length) {
        root.appendChild(row(f.replace(/_/g, ' '), iv[f].join(', ')));
      }
    });
    if (iv.fallback_arrangement) {
      root.appendChild(row('Fallback arrangement', iv.fallback_arrangement));
    }
    if (iv.training_requirements) {
      root.appendChild(row('Training requirements',
        iv.training_requirements));
    }
    if (iv.maintenance_requirements) {
      root.appendChild(row('Maintenance requirements',
        iv.maintenance_requirements));
    }
    if (iv.self_contained) {
      root.appendChild(muted('This record claims explicitly to be ' +
        'self-contained (an auditable claim, never an assumption).'));
    }

    /* Successor / reproduction arrangements (Stage 5 masking in
     * roleDisplay — public views never show identities). */
    root.appendChild(SCA.ui.el('h2', {},
      'People, succession & reproduction'));
    (iv.critical_roles || []).forEach(function (role) {
      root.appendChild(row('Critical role', roleDisplay(role)));
    });
    if (iv.depends_on_human_capability &&
      !(iv.critical_roles || []).length) {
      root.appendChild(muted('Depends on human capability, but no ' +
        'critical roles are recorded yet (approval requires them — ' +
        'UNKNOWN is honest; blank is not).'));
    }
    if (iv.reproduction_pathway) {
      root.appendChild(row('Reproduction pathway',
        iv.reproduction_pathway));
    }
    if ((iv.training_program_ids || []).length) {
      root.appendChild(row('Training programs',
        iv.training_program_ids.map(function (id) {
          return SCA.intervention.referenceLabel('training_programs',
            id);
        }).join(', ')));
    }

    /* Economic & environmental context (factual, never ranked). */
    root.appendChild(SCA.ui.el('h2', {}, 'Economic & environmental ' +
      'context (factual planning data, never rankings)'));
    ['estimated_implementation_cost', 'estimated_operating_cost',
      'estimated_maintenance_cost', 'local_labor_requirement',
      'imported_inputs', 'local_inputs', 'revenue_model',
      'replacement_cost', 'lifecycle_considerations',
      'resource_consumption', 'energy_requirements', 'waste',
      'emissions_documented', 'water_use', 'material_use',
      'environmental_risks', 'climate_exposure',
      'repairability_notes', 'end_of_life'].forEach(function (f) {
      if (!SCA.util.isBlank(iv[f])) {
        root.appendChild(row(f.replace(/_/g, ' '), iv[f]));
      }
    });
    if (iv.safety_considerations) {
      root.appendChild(row('Safety considerations',
        iv.safety_considerations));
    }

    /* Lifecycle. */
    root.appendChild(SCA.ui.el('h2', {}, 'Lifecycle'));
    root.appendChild(row('Status', SCA.util.display(iv.status)));
    root.appendChild(muted('DRAFT → SUBMITTED → UNDER_REVIEW → ' +
      'APPROVED → ACTIVE → COMPLETED, with SUSPENDED and CANCELLED ' +
      'paths. Completion records that the activity ended — never that ' +
      'the outcome was successful.'));
    if (iv.reviewer) {
      root.appendChild(row('Last review action by', iv.reviewer));
    }
    if (iv.last_reason) {
      root.appendChild(row('Last recorded reason', iv.last_reason));
    }
    root.appendChild(row('Version', iv.version || '1'));

    /* Outcome. */
    root.appendChild(SCA.ui.el('h2', {}, 'Outcome'));
    root.appendChild(row('Outcome status',
      SCA.enums.label(SCA.enums.intervention_outcomes,
        iv.outcome_status || 'UNKNOWN') || 'Unknown'));
    if (iv.outcome_status && iv.outcome_status !== 'UNKNOWN') {
      root.appendChild(row('Assessed by', iv.outcome_reviewer));
      root.appendChild(row('Assessment reason', iv.outcome_reason));
    }
    root.appendChild(muted('COMPLETED + UNKNOWN is valid: absence of ' +
      'outcome evidence is unknown, never "successful" or ' +
      '"failed". No scores exist in this system.'));

    /* Audit / history summary. */
    root.appendChild(SCA.ui.el('h2', {}, 'History'));
    (iv.history || []).slice(-10).forEach(function (h) {
      root.appendChild(row((h.changed_at || '') + ' — ' +
        (h.change_type || 'TRANSITION'),
        (h.status || '') + (h.reason ? ' — ' + h.reason : '')));
    });
    if (!(iv.history || []).length) {
      root.appendChild(muted('No recorded changes yet.'));
    }

    /* Actions (lifecycle tools for permitted roles). */
    var actions = [];
    if (iv.status === 'DRAFT' && canUpdate) {
      actions.push(actionBtn('Submit for review', function () {
        return SCA.intervention.submitIntervention(user, iv.id);
      }));
    }
    if (iv.status === 'SUBMITTED' && canReview) {
      actions.push(actionBtn('Start review', function () {
        return SCA.intervention.reviewIntervention(user, iv.id);
      }));
    }
    if (iv.status === 'UNDER_REVIEW' && canReview) {
      actions.push(actionBtn('Approve', function () {
        return SCA.intervention.approveIntervention(user, iv.id,
          window.prompt('Approval reason (required, audited):') || '');
      }));
      actions.push(actionBtn('Return for correction', function () {
        return SCA.intervention.returnForCorrection(user, iv.id,
          window.prompt('Correction reason (required, audited):') || '');
      }));
      actions.push(actionBtn('Cancel (discard)', function () {
        return SCA.intervention.cancelFromReview(user, iv.id,
          window.prompt('Cancellation reason (required, audited):') || '');
      }));
    }
    if (iv.status === 'APPROVED' && canUpdate) {
      actions.push(actionBtn('Activate', function () {
        return SCA.intervention.activateIntervention(user, iv.id);
      }));
    }
    if (iv.status === 'ACTIVE' && canUpdate) {
      actions.push(actionBtn('Suspend', function () {
        return SCA.intervention.suspendIntervention(user, iv.id,
          window.prompt('Suspension reason (required, audited):') || '');
      }));
      actions.push(actionBtn('Complete', function () {
        return SCA.intervention.completeIntervention(user, iv.id);
      }));
      actions.push(actionBtn('Cancel', function () {
        return SCA.intervention.cancelIntervention(user, iv.id,
          window.prompt('Cancellation reason (required, audited):') || '');
      }));
    }
    if (iv.status === 'SUSPENDED' && canUpdate) {
      actions.push(actionBtn('Resume', function () {
        return SCA.intervention.resumeIntervention(user, iv.id,
          window.prompt('Resumption reason (required, audited):') || '');
      }));
      actions.push(actionBtn('Complete', function () {
        return SCA.intervention.completeIntervention(user, iv.id);
      }));
      actions.push(actionBtn('Cancel', function () {
        return SCA.intervention.cancelIntervention(user, iv.id,
          window.prompt('Cancellation reason (required, audited):') || '');
      }));
    }
    if (iv.status === 'COMPLETED' && canReview) {
      actions.push(actionBtn('Assess outcome', function () {
        var outcome = window.prompt('Outcome (one of SUCCESSFUL, ' +
          'MIXED, UNSUCCESSFUL, INSUFFICIENT_EVIDENCE; requires ' +
          'outcome evidence references):') || '';
        var reason = window.prompt('Assessment reason (required):') || '';
        return SCA.intervention.setOutcomeStatus(user, iv.id,
          outcome.trim(), reason);
      }));
    }
    if (['APPROVED', 'ACTIVE', 'SUSPENDED'].indexOf(iv.status) !== -1 &&
      canUpdate) {
      actions.push(actionBtn('Amend (audited)', function () {
        var reason = window.prompt('Amendment reason (required, ' +
          'audited):') || '';
        var description = window.prompt('New description (blank keeps ' +
          'the current one):') || '';
        return SCA.intervention.amendIntervention(user, iv.id,
          description ? { description: description } : {}, reason);
      }));
    }
    if (actions.length) {
      root.appendChild(SCA.ui.el('h2', {}, 'Actions'));
      var bar = SCA.ui.el('div', { class: 'grid grid-2' });
      actions.forEach(function (a) { bar.appendChild(a); });
      root.appendChild(bar);
    }
    root.appendChild(muted('Privacy: public views show APPROVED, ' +
      'ACTIVE and COMPLETED information only; drafts and review ' +
      'material are staff-only, and practitioner identities stay ' +
      'masked by the existing Stage 5 rules.'));
  };

  function actionBtn(label, fn) {
    var msg = muted('');
    var btn = SCA.ui.el('button', { text: label });
    btn.addEventListener('click', function () {
      var res = fn();
      if (!res.ok) {
        msg.textContent = Object.keys(res.errors || {})
          .map(function (k) { return k + ': ' + res.errors[k]; })
          .join(' ');
      } else {
        if (SCA.router.render) { SCA.router.render(); }
      }
    });
    var wrap = SCA.ui.el('div', { class: 'card' }, btn, msg);
    return wrap;
  }
})(SCA);
