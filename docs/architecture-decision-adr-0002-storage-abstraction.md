# ADR-0002: Storage Abstraction — localStorage Today, IndexedDB Planned, Hosted Eventually

**Status:** Accepted (Stage 1.1 correction, 2026-09-28)
**Supersedes:** none (extends ADR-0001)

## Context

Stage 1 was conditionally approved with one required correction: localStorage
is acceptable as the Stage 1 implementation, but must not become the permanent
storage architecture. The future Atlas may hold thousands of capability and
evidence records, practitioners, photo/audio/video metadata, field
observations, apprenticeships, assessments, geographic information, dependency
relationships, synchronization queues and audit records. That is a much larger
data problem than localStorage is designed for.

The required architecture is:

```
UI → SCA.store → storage adapter → localStorage today
                              → IndexedDB later
                              → hosted backend eventually
```

## Decision

1. **SCA.store remains the single application-level data interface.**
   Pages, models, components, router and state code never access
   localStorage or the storage adapter directly.
2. **The storage adapter is internal.** It is published as `SCA._storage`
   (leading underscore = internal, not a public API). Only two categories
   of code may use it:
   - the data layer itself (`src/data-layer/adapter.js`), and
   - the local auth provider (`src/auth/local.js`), which is infrastructure
     and stores sessions/reset tokens, not atlas data.
3. **localStorage is the CURRENT implementation** — synchronous, simple and
   adequate for the Stage 1 dataset it was written for (12 families, 0
   capabilities) and for the Stage 2 inventory (240 compact records).
4. **IndexedDB is the PLANNED next-generation browser storage** behind the
   same adapter. Because IndexedDB is asynchronous while the SCA.store API
   is synchronous, the planned bridge is: load the dataset into memory at
   boot, serve the existing synchronous in-memory API, and persist
   asynchronously after each mutation (write-behind). Application code does
   not change; only the adapter body does. Larger binary artifacts
   (photographs, audio, video) belong in IndexedDB object stores when they
   arrive (Stage 3), referenced by ID from JSON records.
5. **A hosted backend is the EVENTUAL implementation** of the same store API
   (ADR-0001). The same write-behind bridge pattern is what a future
   online-first synchronized system will build its sync queue on, so this
   correction also keeps synchronization possible rather than foreclosing it.
6. **Enforcement is tested, not just documented.**
   `tests/storage-architecture.test.js` fails the build if any application
   file references localStorage or the internal storage handle outside the
   documented allowlist.

## Consequences

- Positive: the storage engine can be replaced twice (localStorage →
  IndexedDB → hosted) without touching any page, model or component.
- Positive: the rule is enforced automatically, so future stages cannot
  silently couple application code to localStorage.
- Accepted limitation: until the IndexedDB adapter lands, dataset size is
  bound by browser localStorage limits (typically ~5 MB). Sufficient for
  Stage 1 and Stage 2's 240 structured records; revisited when binary
  artifacts and large evidence volumes arrive.
- Accepted limitation: the synchronous store API means the IndexedDB
  adapter must use the write-behind bridge; a power loss at the wrong moment
  could drop the last in-flight mutation. Mitigation later: explicit
  flush-on-idle + beforeunload hooks when the adapter is written.
