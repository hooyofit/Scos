# Architecture

## Layering

The application is deliberately layered so that each layer can be replaced:

```
┌──────────────────────────────────────────────┐
│ Pages (src/pages)          — screens         │
├──────────────────────────────────────────────┤
│ Router / State (src/router, src/state)       │
├──────────────────────────────────────────────┤
│ Components (src/components)  — UI atoms      │
├──────────────────────────────────────────────┤
│ RBAC (src/rbac)             — permissions     │
├──────────────────────────────────────────────┤
│ Auth (src/auth)             — abstraction    │  ← replace local with hosted
├──────────────────────────────────────────────┤
│ Models (src/models)         — validation     │
├──────────────────────────────────────────────┤
│ Data layer (src/data-layer) — store,         │
│   storage, migration, transfer (export/import)│  ← replace local with API
├──────────────────────────────────────────────┤
│ Storage (browser localStorage / memory)     │
└──────────────────────────────────────────────┘
```

Two seams are designed for replacement without touching UI code:

1. **Data provider seam.** Everything above the store goes through the small
   `SCA.store` API (`all/get/count/insert/update/remove/dataset/replaceDataset`).
   A hosted backend adapter (Base44 entities, Supabase, an own REST API) implements
   the same API in a later build step. The JSON export/import format is the
   interoperability contract between backends.

2. **Auth provider seam.** `SCA.auth` registers providers against a fixed contract
   (`signUp, signIn, signOut, getCurrentUser, resetPassword, completeReset,
   updateProfile`). Step 1 ships `local`; a hosted provider can be added and
   activated by changing one line in `config/app.config.js`.

## Why classic scripts, not ES modules

The app must run when `index.html` is opened directly from the filesystem
(`file://`). ES modules are blocked by CORS on `file://`; classic `<script>`
tags are not. All files attach to the single `SCA` namespace and load in the
order listed in `index.html`. When a bundler is introduced later (optional),
the same files can be wrapped; nothing depends on script-tag semantics beyond
load order.

## Storage roadmap (Stage 1.1 rule)

```
UI → SCA.store → storage adapter → localStorage today
                              → IndexedDB later (planned)
                              → hosted backend eventually
```

SCA.store is the single application-level data interface. The storage
adapter is internal (`SCA._storage`) and only the data layer and the local
auth provider may touch it; pages, models, components, router and state
never may. localStorage is the CURRENT implementation; IndexedDB is the
PLANNED next-generation browser storage behind the same adapter (bridge:
load at boot, sync in-memory API, async persist). Enforced automatically by
`tests/storage-architecture.test.js`. Full reasoning:
`architecture-decision-adr-0002-storage-abstraction.md`.

## Deployment modes

- `file://` = emergency/portable/offline mode (the Atlas survives without a
  web server; no service worker or PWA install).
- Static HTTPS hosting = normal PWA mode.
- Hosted backend = the future synchronized national system (via the store
  and auth seams).

## Data flow

- All collections live in one dataset: `{ schema_version, collections: {...} }`
  persisted under the `sca:dataset` key.
- `SCA.store` validates writes through the models (`SCA.models`) and enforces
  referential integrity (capabilities must reference an existing family).
- On load, `SCA.migrations` brings an older persisted dataset up to the
  current `SCA.SCHEMA_VERSION`, forward-only with rollback support.
- Every mutation persists immediately and notifies subscribers (pub/sub),
  so the UI reflects real state, including zero-record empty states.

## Privacy and consent, structurally

- `users` are excluded from export/import entirely; `_auth` credential
  material is never rendered, exported, or logged.
- Practitioner records carry `anonymous_option`, `documentation_consent`
  and `contact_visibility` as required fields.
- Location records carry `privacy_level`. The Map (Step 13) must respect it:
  precise practitioner locations are never public without consent.
- Knowledge artifacts carry `consent_status` and `access_level`.

## Bilingual framework

`src/i18n.js` provides the framework and English strings. Somali strings are
deliberately empty: translations must be written and reviewed by Somali
speakers in a later build step. Nothing is machine-translated.

## Offline system (and what is honestly implemented)

| Requirement | Status in Stage 1 |
|---|---|
| Local data storage | Implemented (localStorage adapter behind a seam; IndexedDB possible later) |
| Offline browsing | Implemented (whole app runs from file:// or cached shell) |
| Offline search | Implemented (capability filters run against local data) |
| Offline forms | Implemented for auth, profile, import/export forms |
| Offline data collection | NOT IMPLEMENTED — field-research forms arrive with Stages 4-5 (reason: no research forms exist yet) |
| Synchronization when connectivity returns | NOT IMPLEMENTED — planned for Stages 4-5/10; export/import is the interim data-movement path |
| Conflict handling | NOT IMPLEMENTED — designed together with synchronization |
| Versioning | Implemented (schema_version + migration framework) |
| Backup / export | Implemented (JSON per collection + full bundle) |

The application never becomes unusable when the internet disappears: all
Step 1 functionality works offline.

## Testing

`node tests/run-all.js`: syntax check of every JS file plus suites for model
validation, migrations, RBAC, and export/import round-trips. The loader in
`tests/helpers.js` mirrors the `index.html` script order, so tests exercise
the same code paths the app loads.
