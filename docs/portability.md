# Portability

Which components are platform-independent and which are platform-specific.

## Platform-independent (everything below runs identically on any host)

- The entire application: `index.html`, `src/**`, `config/**`, `styles/**`,
  `data/**`, `icons/**`, `manifest.webmanifest`, `service-worker.js`.
- The database schema: `schemas/*.json` are plain JSON Schema, loadable by
  any backend (Postgres, SQLite, MongoDB, Base44 entities, Supabase) or
  validation tooling.
- The data itself: JSON exports (per collection or full bundle) with
  `schema_version` and a migration path. No proprietary formats.
- Tests: `node tests/run-all.js`, plain Node, no dependencies.
- Documentation: `docs/` is Markdown.

## Platform-specific (and how it is isolated)

There is intentionally **no Base44-specific code** in the application.
Two integration points are designed as replaceable seams, isolated behind
abstraction layers so a future backend does not touch UI code:

1. **Data provider** (`src/data-layer/adapter.js`): the local store. Any
   backend adapter implements the same small API
   (`all/get/count/insert/update/remove/dataset/replaceDataset`). JSON
   bundles are the migration path for moving data between providers.
   The storage engine itself is internal (`SCA._storage`): localStorage is
   the current implementation, IndexedDB the planned browser storage, a
   hosted backend the eventual one (ADR-0002). No application code touches
   the storage engine directly, and a test enforces that.
2. **Auth provider** (`src/auth/interface.js` + `src/auth/local.js`): a
   fixed contract; a hosted provider (Base44 auth, Supabase, OIDC) is
   registered and activated with one line in `config/app.config.js`.

Configuration is separated from logic (`config/app.config.js`): names,
colors, languages, storage keys, export policy, feature flags, and the
active provider choices. Environment-specific deployment configuration is
covered in `deployment-guides.md`; there are no environment variables
required in Stage 1 and no secrets in the codebase.

## If a vendor decision becomes unavoidable

Critical development rule: do not silently make architectural decisions that
create vendor lock-in. If a decision is unavoidable because of the current
platform, it is documented (as this file and
`architecture-decision-adr-0001` do). When two approaches exist, the
preferred one is: portable, open, exportable, offline-capable,
maintainable, understandable by future developers.
