# ADR-0001: Portable, Offline-First Foundation

**Status:** Accepted (Step 1, 2026-09-28)
**Supersedes:** none

## Context

The Somali Capability Atlas must serve users in Somalia with unreliable
connectivity, must not lock the project's knowledge inside any single
platform, and must remain maintainable by the project itself over time. The
project rule applies to the software too: never build a critical system you
cannot eventually maintain yourself.

Options considered:

| Approach | Strength | Problem |
|---|---|---|
| Platform-native app (Base44 only) | Fastest start | Platform dependency, hard to export |
| Single HTML file | Extremely portable | Poor fit for database, auth, 240 capabilities |
| **Portable PWA with replaceable seams** | Portable + database + offline + mobile | Slightly more work |
| Full custom backend now | Maximum control | Too much complexity at the start |

## Decision

Build a portable, standards-based Progressive Web App whose source code, data,
schema and deployment are exportable and independent of any particular
platform. Specifically:

1. **No build step, no runtime dependencies.** Classic scripts on a single
   namespace so the app runs from `file://`, any static host, or offline media.
2. **Data layer as a seam.** Local dataset behind a small store API; hosted
   backends implement the same API later. JSON bundles are the interchange.
3. **Auth as a seam.** A fixed provider contract; Step 1 ships a local demo
   provider, replaced by a hosted provider in a later step.
4. **Export/import as a Day-1 feature**, with accounts excluded for privacy.
5. **Offline-first from the start**, because retrofitting offline support to
   an online-first app is far harder than building it in.

## Consequences

### Positive

- The project can deploy to Cloudflare Pages, Netlify, GitHub Pages, an own
  server, or run entirely offline from a USB stick.
- Data can leave the platform at any time, in a documented, versioned format.
- Migration framework means future schema changes do not strand old exports.
- No vendor can hold the knowledge hostage.

### Negative / accepted limitations (documented honestly)

- Step 1 accounts are device-local, demo-grade, salted-hashed in the browser.
  This is a foundation, not production security. Real multi-user auth arrives
  with a hosted provider in a later build step.
- Password reset tokens are shown locally; there is no email service yet.
- Service worker and PWA install require http(s). From `file://` the app
  works, but without precache and install.
- localStorage persistence on `file://` varies by browser; served deployments
  are the reliable offline path.
- No multi-device sync yet: data moves between devices via export/import
  until Step 10.

## Compliance with project rules

- No fabricated data anywhere; unknowns display "Not yet documented."
- Advanced systems are explicitly deferred; placeholders state which build
  step will deliver them.
- Documentation covers how to deploy outside any specific platform.
