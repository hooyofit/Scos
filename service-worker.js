/*
 * Service worker: precache the application shell so the atlas opens with
 * no network at all. App data lives in localStorage, not in this cache.
 * Registered only over http(s); see src/app.js and docs/deployment-guides.md.
 */
var CACHE = 'sca-step15-v1';

var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './styles/main.css',
  './src/sca.js',
  './config/app.config.js',
  './src/i18n.js',
  './src/data-layer/storage.js',
  './src/data-layer/migration.js',
  './src/data-layer/adapter.js',
  './src/data-layer/transfer.js',
  './src/audit/audit.js',
  './src/evidence/workflow.js',
  './src/research/queue.js',
  './src/research/workflow.js',
  './src/training/workflow.js',
  './src/census/workflow.js',
  './src/graph/workflow.js',
  './src/models/enums.js',
  './src/models/shared.js',
  './src/models/user.js',
  './src/models/family.js',
  './src/models/capability.js',
  './src/models/practitioner.js',
  './src/models/apprentice.js',
  './src/models/evidence.js',
  './src/models/location.js',
  './src/models/knowledge-artifact.js',
  './src/models/claim.js',
  './src/models/consent.js',
  './src/models/audit-log.js',
  './src/models/research-project.js',
  './src/models/research-session.js',
  './src/models/field-observation.js',
  './src/models/field-note.js',
  './src/models/research-participant.js',
  './src/models/field-media.js',
  './src/models/research-queue.js',
  './src/models/organization.js',
  './src/models/apprenticeship.js',
  './src/models/competence-assessment.js',
  './src/models/training-program.js',
  './src/models/capability-certification.js',
  './src/models/census-methodology.js',
  './src/models/capability-census.js',
  './src/models/census-observation.js',
  './src/models/census-snapshot.js',
  './src/models/geographic-redundancy.js',
  './src/models/graph-edge.js',
  './src/models/workshop.js',
  './src/models/resource.js',
  './src/models/material.js',
  './src/models/tool.js',
  './src/models/energy-source.js',
  './src/models/failure-scenario.js',
  './src/models/repair-capability.js',
  './src/models/spare-part.js',
  './src/models/repair-record.js',
  './src/repair/workflow.js',
  './src/models/recovery-profile.js',
  './src/recovery/workflow.js',
  './src/models/capability-intervention.js',
  './src/intervention/workflow.js',
  './src/models/pilot-project.js',
  './src/pilots/workflow.js',
  './src/models/measurement.js',
  './src/models/indicator.js',
    './src/models/marketplace-listing.js',
    './src/models/capability-reserve.js',
    './src/models/continuity-plan.js',
    './src/models/capability-asset.js',
  './src/measurement/workflow.js',
  './src/indicator/workflow.js',
    './src/marketplace/workflow.js',
    './src/reserve/workflow.js',
    './src/scenario/workflow.js',
  './src/observatory/views.js',
  './data/indicator-definitions.js',
  './src/graph/registry.js',
  './src/graph/workflow.js',
  './src/rbac/roles.js',
  './src/rbac/permissions.js',
  './src/auth/interface.js',
  './src/auth/local.js',
  './src/state/state.js',
  './src/components/ui.js',
  './src/components/navbar.js',
  './src/components/footer.js',
  './src/router/router.js',
  './src/pages/home.js',
  './src/pages/capabilities.js',
  './src/pages/capability.js',
  './src/pages/families.js',
  './src/pages/practitioners.js',
  './src/pages/apprentices.js',
  './src/pages/knowledge.js',
  './src/pages/evidence.js',
  './src/pages/field-research.js',
  './src/pages/census.js',
  './src/pages/graph.js',
  './src/pages/repair.js',
  './src/pages/recovery.js',
  './src/pages/intervention.js',
  './src/pages/pilots.js',
  './src/pages/measurements.js',
  './src/pages/indicators.js',
    './src/pages/marketplace.js',
    './src/pages/reserves.js',
    './src/pages/scenarios.js',
  './src/pages/observatory.js',
  './src/pages/map.js',
  './src/pages/dashboard.js',
  './src/pages/export.js',
  './src/pages/about.js',
  './src/pages/people.js',
  './src/pages/training.js',
  './src/pages/signin.js',
  './src/pages/signup.js',
  './src/pages/reset.js',
  './src/pages/profile.js',
  './src/app.js',
  './data/families.js',
  './data/capabilities.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE) { return caches.delete(k); }
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Cache-first for same-origin GET; network fallback, then offline fallback
   to the shell for navigations. */
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') { return; }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) { return cached; }
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
