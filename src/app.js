/* Application entry point. */
(function (SCA) {
  'use strict';

  function registerServiceWorker() {
    /* Service workers only work over http(s); when the app is opened
       directly from the filesystem (file://) the app still runs, just
       without PWA install and precache. Documented in docs. */
    var httpLike = location.protocol === 'https:' ||
      location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && httpLike) {
      navigator.serviceWorker.register('./service-worker.js').catch(function () {
        /* Registration failure is not fatal offline: data lives in the storage adapter. */
      });
    }
  }

  function start() {
    /* 1. Local data layer (offline-first). */
    SCA.store.init();

    /* 2. Auth: local provider in Step 1 (replaceable by design). */
    SCA.auth.use(SCA.config.auth_provider);
    SCA.state.set('user', SCA.auth.current().getCurrentUser());

    /* 3. Shell. */
    SCA.navbar.render(document.getElementById('nav-root'));
    SCA.footer.render(document.getElementById('footer-root'));

    /* 4. Routes. */
    SCA.router.add('#/', SCA.pages.home);
    SCA.router.add('#/capabilities', SCA.pages.capabilities);
    SCA.router.add('#/capabilities/:id', SCA.pages.capability);
    SCA.router.add('#/families', SCA.pages.families);
    SCA.router.add('#/practitioners', SCA.pages.practitioners);
    SCA.router.add('#/apprentices', SCA.pages.apprentices);
    SCA.router.add('#/knowledge', SCA.pages.knowledge);
    SCA.router.add('#/knowledge/:id', SCA.pages.artifact);
    SCA.router.add('#/evidence', SCA.pages.evidence);
    SCA.router.add('#/evidence/:id', SCA.pages.source);
    SCA.router.add('#/pilots', SCA.pages.pilotsRegister);
    SCA.router.add('#/field-research', SCA.pages.fieldResearch);
    SCA.router.add('#/project/:id', SCA.pages.project);
    SCA.router.add('#/practitioner/:id', SCA.pages.practitioner);
    SCA.router.add('#/apprentice/:id', SCA.pages.apprentice);
    SCA.router.add('#/training/:id', SCA.pages.programDetail);
    SCA.router.add('#/apprenticeship/:id', SCA.pages.apprenticeshipDetail);
    SCA.router.add('#/census', SCA.pages.census);
    SCA.router.add('#/census/:id', SCA.pages.censusDetail);
    SCA.router.add('#/repair', SCA.pages.repairNetwork);
    SCA.router.add('#/workshop/:id', SCA.pages.workshopDetail);
    SCA.router.add('#/repair-capability/:id',
      SCA.pages.repairCapabilityDetail);
    SCA.router.add('#/spare-part/:id', SCA.pages.sparePartDetail);
    SCA.router.add('#/repair-record/:id', SCA.pages.repairRecordDetail);
    SCA.router.add('#/recovery', SCA.pages.recoverySystem);
    SCA.router.add('#/recovery-profile/:id', SCA.pages.recoveryProfileDetail);
    SCA.router.add('#/interventions', SCA.pages.interventionRegister);
    SCA.router.add('#/intervention/:id', SCA.pages.interventionDetail);
    SCA.router.add('#/pilot/:id', SCA.pages.pilotDetail);
    SCA.router.add('#/observatory', SCA.pages.observatory);
    SCA.router.add('#/measurements', SCA.pages.measurementsRegister);
    SCA.router.add('#/measurement/:id', SCA.pages.measurementDetail);
    SCA.router.add('#/indicators', SCA.pages.indicatorsRegister);
    SCA.router.add('#/indicator/:id', SCA.pages.indicatorDetail);
    SCA.router.add('#/marketplace', SCA.pages.marketplaceRegister);
    SCA.router.add('#/marketplace/:id', SCA.pages.marketplaceDetail);
    /* Stage 14: National Capability Reserve (frozen scope v1.1
       §32). Exactly #/reserves + #/reserves/:id; continuity plans
       have NO separate route (frozen decision 5). */
    SCA.router.add('#/reserves', SCA.pages.reserves);
    SCA.router.add('#/reserves/:id', SCA.pages.reserveDetail);
    /* Stage 15: Capability Scenario Analysis (frozen scope v1.1
       §25/A5). Exactly ONE route; the request is query-string
       encoded and transient — there is NO #/scenarios/:id route
       because there is no persistent Scenario record. */
    SCA.router.add('#/scenarios', SCA.pages.scenarios);
    SCA.router.add('#/graph', SCA.pages.graph);
    SCA.router.add('#/graph/:id', SCA.pages.graphDetail);
    SCA.router.add('#/map', SCA.pages.map);
    SCA.router.add('#/people', SCA.pages.people);
    SCA.router.add('#/training', SCA.pages.training);
    SCA.router.add('#/dashboard', SCA.pages.dashboard);
    SCA.router.add('#/export', SCA.pages.export);
    SCA.router.add('#/about', SCA.pages.about);
    SCA.router.add('#/signin', SCA.pages.signin);
    SCA.router.add('#/signup', SCA.pages.signup);
    SCA.router.add('#/reset', SCA.pages.reset);
    SCA.router.add('#/profile', SCA.pages.profile);
    SCA.router.start();

    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(SCA);
