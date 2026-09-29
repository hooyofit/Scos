/*
 * Role-based permissions. 'anon' means not signed in.
 * The national administrator holds every permission; this is enforced below
 * rather than repeated in the matrix.
 */
(function (SCA) {
  'use strict';
  var AUTHENTICATED = SCA.roleCodes.slice(); /* all signed-in roles */

  var P = {
    /* Anyone, including anonymous visitors, can read public atlas data. */
    'data.read': ['anon'].concat(SCA.roleCodes),

    /* Content creation. */
    'capability.create': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'capability.update': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'evidence.create': ['researcher', 'community_steward', 'technician',
      'reviewer', 'regional_administrator', 'national_administrator'],
    'practitioner.create': ['practitioner', 'community_steward', 'researcher',
      'regional_administrator', 'national_administrator'],
    'apprentice.enroll': ['apprentice', 'trainer', 'community_steward',
      'regional_administrator', 'national_administrator'],
    'knowledge.create': ['researcher', 'practitioner', 'workshop', 'trainer',
      'reviewer', 'community_steward', 'regional_administrator',
      'national_administrator'],

    /* Stage 3 evidence permissions. Least privilege: creating evidence is
       open to documentation roles, but review and verification are separate
       authorities. Verification (evidence level changes) is held only by
       reviewers and administrators — never by every user. */
    'evidence.read': ['anon'].concat(SCA.roleCodes),
    'evidence.edit': ['researcher', 'community_steward', 'reviewer',
      'regional_administrator', 'national_administrator'],
    'evidence.review': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'evidence.verify': ['reviewer', 'national_administrator'],
    'evidence.export': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],

    /* Stage 4 field research permissions. Field researchers can collect
       and submit, but NEVER verify evidence: evidence verification stays
       with Stage 3 (evidence.review / evidence.verify). Project approval
       and participant/consent/media management are separate authorities. */
    'research.read': SCA.roleCodes,
    'research.create': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'research.edit': ['researcher', 'community_steward', 'reviewer',
      'regional_administrator', 'national_administrator'],
    'research.submit': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'research.review': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'research.approve': ['regional_administrator', 'national_administrator'],
    'research.export': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'participant.manage': ['researcher', 'community_steward', 'reviewer',
      'regional_administrator', 'national_administrator'],
    'consent.manage': ['researcher', 'community_steward', 'reviewer',
      'regional_administrator', 'national_administrator'],
    'media.manage': ['researcher', 'practitioner', 'community_steward',
      'technician', 'reviewer', 'regional_administrator', 'national_administrator'],
    'projects.manage': ['project_manager', 'regional_administrator',
      'national_administrator'],

    /* Stage 5: practitioner, apprenticeship, training and certification
       permissions. Least privilege throughout:
       - A researcher can document practitioners but NOT assess, verify or
         certify anyone.
       - A practitioner cannot assess or certify themselves.
       - Verification and certification are separate authorities. */
    'practitioner.read': SCA.roleCodes,
    'practitioner.create': ['practitioner', 'community_steward', 'researcher',
      'reviewer', 'regional_administrator', 'national_administrator'],
    'practitioner.edit': ['practitioner', 'community_steward', 'researcher',
      'reviewer', 'regional_administrator', 'national_administrator'],
    'practitioner.verify': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'apprentice.read': SCA.roleCodes,
    'apprentice.create': ['practitioner', 'trainer', 'community_steward',
      'researcher', 'reviewer', 'regional_administrator',
      'national_administrator'],
    'apprentice.edit': ['practitioner', 'trainer', 'community_steward',
      'researcher', 'reviewer', 'regional_administrator',
      'national_administrator'],
    'apprenticeship.manage': ['practitioner', 'trainer', 'community_steward',
      'researcher', 'reviewer', 'regional_administrator',
      'national_administrator'],
    'training.read': SCA.roleCodes,
    'training.create': ['trainer', 'workshop', 'community_steward',
      'researcher', 'regional_administrator', 'national_administrator'],
    'training.edit': ['trainer', 'workshop', 'reviewer',
      'regional_administrator', 'national_administrator'],
    'training.approve': ['regional_administrator', 'national_administrator'],
    'assessment.create': ['trainer', 'technician', 'reviewer',
      'community_steward', 'regional_administrator', 'national_administrator'],
    'assessment.review': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'certification.issue': ['trainer', 'reviewer', 'regional_administrator',
      'national_administrator'],
    'certification.revoke': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'reproduction.read': SCA.roleCodes,

    /* Data portability. */
    'data.export': ['researcher', 'community_steward', 'reviewer',
      'project_manager', 'regional_administrator', 'national_administrator'],
    'data.import': ['project_manager', 'regional_administrator',
      'national_administrator'],

    /* Oversight. */
    'dashboard.view': ['reviewer', 'project_manager', 'regional_administrator',
      'national_administrator'],
    'users.manage': ['national_administrator'],
    'roles.assign': ['national_administrator'],

    /* Self-service for every signed-in account. */
    'profile.manage': AUTHENTICATED,

    /* Stage 6: capability census. Least privilege:
       - Census data is publicly READABLE (aggregate, privacy-thresholded)
         but no public user can modify it.
       - Researchers/technicians create and submit census work; they
         cannot review or approve it.
       - Reviewers review observations (and may reconcile duplicates).
       - Regional administrators approve regional census projects.
       - National administrators approve methodology and publish snapshots. */
    'census.read': ['anon'].concat(SCA.roleCodes),
    'census.create': ['researcher', 'technician', 'regional_administrator'],
    'census.edit': ['researcher', 'technician', 'regional_administrator'],
    'census.submit': ['researcher', 'technician'],
    'census.review': ['reviewer', 'regional_administrator'],
    'census.approve': ['regional_administrator'],
    'census.export': ['researcher', 'technician', 'reviewer',
      'project_manager', 'regional_administrator'],
    'census.snapshot': ['national_administrator'],
    'census.aggregate': ['national_administrator'],
    'census.merge': ['reviewer', 'regional_administrator'],

    /* Stage 7: capability graph. Least privilege:
       - The graph is publicly READABLE (privacy-filtered; people and
         restricted locations stay protected).
       - Researchers/technicians create PROPOSED relationships and may
         mark them DOCUMENTED once provenance is attached.
       - Reviewers verify or reject; they never self-verify their own
         unreviewed claims without the process.
       - Only the national administrator performs administrative graph
         operations (retiring orphaned edges, integrity actions). */
    'graph.read': ['anon'].concat(SCA.roleCodes),
    'graph.create': ['researcher', 'technician'],
    'graph.update': ['researcher', 'technician', 'reviewer',
      'regional_administrator'],
    'graph.review': ['reviewer', 'regional_administrator'],
    'graph.export': ['researcher', 'technician', 'reviewer',
      'project_manager', 'regional_administrator'],
    'graph.admin': [],

    /* Stage 8: repair & spare-part network. Least privilege:
       - Public browsing of workshops, repair capabilities and spare
         parts is privacy-filtered (repair.read includes anon); repair
         RECORDS (detailed procedures, technician/apprentice
         participation) are authenticated-only (repair.records.read) so
         dangerous detailed procedures are never published anonymously.
       - Researchers/technicians/practitioners/workshops create entry
         data; they can never verify it.
       - Review authority (workshop.review, sparepart.review,
         repair.review) is separate from ordinary data entry.
       - Verification of competence stays with Stage 5: repair
         capability records may LINK assessments/certifications but
         never issue them. */
    'repair.read': ['anon'].concat(SCA.roleCodes),
    'repair.records.read': SCA.roleCodes,
    'repair.create': ['researcher', 'technician', 'practitioner',
      'workshop', 'community_steward'],
    'repair.update': ['researcher', 'technician', 'community_steward'],
    'repair.review': ['reviewer', 'regional_administrator'],
    'repair.export': ['researcher', 'technician', 'reviewer',
      'project_manager', 'regional_administrator'],
    'repair.admin': [],
    'workshop.create': ['researcher', 'technician', 'practitioner',
      'workshop', 'community_steward'],
    'workshop.update': ['researcher', 'technician', 'community_steward',
      'workshop'],
    'workshop.review': ['reviewer', 'regional_administrator'],

    /* Stage 9: failure & recovery. Least privilege:
       - Recovery coverage is publicly READABLE (privacy-filtered;
         recovery profiles are not personal records, and targets are
         never practitioners).
       - Researchers/technicians/practitioners/workshops/stewards
         create PROPOSED recovery profiles; they can never verify.
       - Review authority (recovery.review) covers verification,
         rejection AND audited administrative retirement (there is no
         separate RETIRED state: retirement = REJECTED + explicit
         reason, audited).
       - Deliberately NO recovery.export permission (frozen scope):
         export uses the existing global export machinery. */
    'recovery.read': ['anon'].concat(SCA.roleCodes),
    'recovery.create': ['researcher', 'technician', 'practitioner',
      'workshop', 'community_steward'],
    'recovery.update': ['researcher', 'technician', 'community_steward'],
    'recovery.review': ['reviewer', 'regional_administrator'],

    'sparepart.create': ['researcher', 'technician', 'community_steward'],
    'sparepart.update': ['researcher', 'technician', 'community_steward'],
    'sparepart.review': ['reviewer', 'regional_administrator'],

    /* Stage 10: capability interventions. Least privilege:
       - Public states (APPROVED / ACTIVE / COMPLETED) are publicly
         readable; DRAFT / SUBMITTED / UNDER_REVIEW and internal
         planning material are staff-only. SUSPENDED and CANCELLED
         follow explicit access classification (staff-only here).
       - Creators (researcher/technician/practitioner/workshop/
         community_steward/project_manager) plan and execute: create,
         edit drafts, submit, activate, suspend, resume, complete,
         amend and cancel.
       - Review authority (intervention.review) is held ONLY by
         reviewer and regional_administrator — roles that can neither
         create nor update interventions, so a creator can NEVER
         self-approve or self-review (structural separation, doubled
         in the workflow by a created_by guard).
       - Outcome status is reviewer-governed, never self-declared.
       - Deliberately NO intervention.export permission (frozen
         scope): export uses the existing global export machinery.
       - No geographic RBAC: "regional review" is the existing role. */
    'intervention.read': ['anon'].concat(SCA.roleCodes),
    'intervention.create': ['researcher', 'technician', 'practitioner',
      'workshop', 'community_steward', 'project_manager'],
    'intervention.update': ['researcher', 'technician', 'practitioner',
      'workshop', 'community_steward', 'project_manager'],
    'intervention.review': ['reviewer', 'regional_administrator'],

    /* Stage 11: regional capability pilots. A pilot COORDINATES; it
       never re-governs. Least privilege:
       - Public states (APPROVED / ACTIVE / CONCLUDED) are publicly
         readable; PROPOSED planning material and CANCELLED records
         are staff-only (and a pilot never carries outcome data of
         its own at all).
       - project_manager plans and runs pilots: create, edit, amend,
         activate, cancel — but NEVER approve (the frozen scope pins
         creator/approver separation, doubled in the workflow by a
         created_by guard that applies at every role level including
         NATIONAL).
       - Approval and conclusion are administrative authorities
         held by regional_administrator AND national_administrator
         (the EXISTING flat roles — this is NOT a geographic RBAC
         engine and the app never claims a user can act "because
         the pilot is in their region"). Both are declared
         explicitly per the frozen Stage 11 scope, not left to the
         NATIONAL consistency rule below.
       - Reviewers read; they hold no pilot lifecycle authority.
       - Deliberately NO pilot.export permission (frozen scope):
         export uses the existing global export machinery. */
    'pilot.read': ['anon'].concat(SCA.roleCodes),
    'pilot.create': ['researcher', 'community_steward', 'project_manager'],
    'pilot.update': ['researcher', 'community_steward', 'project_manager'],
    'pilot.approve': ['regional_administrator',
      'national_administrator'],
    'pilot.conclude': ['regional_administrator',
      'national_administrator'],

    /* Stage 12: Capability Observatory & Measurement Foundation
     * (frozen scope v1.1 §27). Exactly the eight pinned flat
     * permissions — no geographic engine, no second family.
     * measurement.update applies to DRAFT only (enforced by the
     * workflow); indicator.update means creating a NEW VERSION,
     * never mutating an approved formula. Reviewer separation
     * (creator never reviews their own record) is enforced at the
     * workflow/service layer at every role level including
     * NATIONAL. */
    'measurement.read': ['anon'].concat(SCA.roleCodes),
    'measurement.create': ['researcher', 'community_steward',
      'project_manager'],
    'measurement.update': ['researcher', 'community_steward',
      'project_manager'],
    'measurement.review': ['reviewer', 'regional_administrator'],
    'indicator.read': ['anon'].concat(SCA.roleCodes),
    'indicator.create': ['researcher', 'reviewer',
      'regional_administrator'],
    'indicator.update': ['researcher', 'reviewer',
      'regional_administrator'],
    'indicator.review': ['reviewer', 'regional_administrator'],

    /* Stage 13: Capability Marketplace (frozen scope v1.0 §13 +
       authorization §15). Exactly the five flat marketplace
       permissions. marketplace.update applies to DRAFT edits and
       PUBLISHED availability amendments; pausing/resuming is a
       creator action under marketplace.update; withdrawal is a
       creator action under marketplace.withdraw. Reviewer
       separation (creator never publishes/rejects their own
       listing) is enforced at the workflow/service layer at every
       role level including NATIONAL (explicitly declared here, per
       the Stage 11r1 precedent).
       Deliberately NO marketplace.export permission (frozen scope):
       listings move only inside the atomic full transfer package.
       Deliberately NO marketplace.delete permission: nothing is
       ever hard-deleted; terminal listings are immutable.
       No geographic permission engine of any kind exists. */
    'marketplace.read': ['anon'].concat(SCA.roleCodes),
    'marketplace.create': ['researcher', 'community_steward',
      'practitioner', 'technician', 'workshop', 'trainer',
      'project_manager'],
    'marketplace.update': ['researcher', 'community_steward',
      'practitioner', 'technician', 'workshop', 'trainer',
      'project_manager'],
    'marketplace.review': ['reviewer', 'regional_administrator',
      'national_administrator'],
    'marketplace.withdraw': ['researcher', 'community_steward',
      'practitioner', 'technician', 'workshop', 'trainer',
      'project_manager'],

    /* Stage 14: National Capability Reserve & Institutional
       Continuity (frozen scope v1.1 + Gate C authorization §7).
       Exactly the five flat reserve permissions; they govern ALL
       three Stage 14 entities (reserves, continuity plans and
       assets — no plan.* or asset.* permissions exist).
       reserve.read includes anon (public views show explicitly
       public information only; person-level references remain
       governed by Stage 5 visibility rules).
       reserve.create/update: DRAFT creation, editing, submission
       and asset composition are creator actions under these
       permissions.
       reserve.review: SUBMITTED -> VERIFIED/REJECTED, VERIFIED ->
       ACTIVE (with the documented-custodian requirement),
       SUSPENDED -> ACTIVE, and plan REVIEWED/ACTIVE designation.
       Creator/reviewer separation is enforced at the workflow
       service layer at every role level including NATIONAL
       (Stage 11r1/13 precedent).
       reserve.retire: ACTIVE/SUSPENDED -> RETIRED for reserves and
       plans; retirement is documented, audited and immutable.
       Deliberately NO reserve.activate/suspend/resume/publish/
       export/delete permission (frozen scope §21): lifecycle
       authority is implemented through these five permissions
       with service-layer role checks. Nothing is ever hard-deleted;
       terminal records are immutable. No geographic permission
       engine of any kind exists. */
    'reserve.read': ['anon'].concat(SCA.roleCodes),
    'reserve.create': ['researcher', 'community_steward',
      'practitioner', 'technician', 'workshop', 'trainer',
      'project_manager'],
    'reserve.update': ['researcher', 'community_steward',
      'practitioner', 'technician', 'workshop', 'trainer',
      'project_manager'],
    'reserve.review': ['reviewer', 'regional_administrator'],
    'reserve.retire': ['reviewer', 'regional_administrator']
  };

  /* Consistency rule: the national administrator always holds every
     permission. If a future edit forgets it, this repairs the matrix. */
  Object.keys(P).forEach(function (k) {
    if (P[k].indexOf('national_administrator') === -1) {
      P[k].push('national_administrator');
    }
  });

  function roleOf(user) {
    return (user && user.role) || 'anon';
  }

  function can(user, permission) {
    var roles = P[permission];
    if (!roles) { return false; }
    return roles.indexOf(roleOf(user)) !== -1;
  }

  SCA.rbac = {
    can: can,
    roleOf: roleOf,
    matrix: P,
    permissions: function () { return Object.keys(P); },
    rolesFor: function (permission) { return (P[permission] || []).slice(); }
  };
})(SCA);
