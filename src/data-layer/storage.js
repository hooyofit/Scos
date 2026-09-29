/*
 * STORAGE ADAPTER (internal). The ONLY module in the application that may
 * reference localStorage.
 *
 * Storage roadmap (docs/architecture-decision-adr-0002-storage-abstraction.md):
 *   - CURRENT implementation: localStorage (synchronous, simple, adequate
 *     for the Stage 1 dataset).
 *   - PLANNED next-generation browser storage: IndexedDB behind this same
 *     adapter, using a load-at-boot / sync-in-memory-API / async-persist
 *     bridge so application code never changes.
 *   - EVENTUAL: a hosted backend adapter implementing the same SCA.store API.
 *
 * Architecture rule (Stage 1.1): application code (pages, models, components,
 * router, state) must NEVER touch localStorage or this adapter directly.
 * Allowed interfaces are SCA.store (all atlas data) and SCA.auth (sessions;
 * the local auth provider is infrastructure and may use this adapter).
 *
 * Published as SCA._storage (underscore = internal, not a public API) so a
 * future IndexedDB adapter can replace the body of this file only.
 * Uses localStorage when available; falls back to in-memory storage with a
 * warning when it is not (e.g. some sandboxed contexts).
 */
(function (SCA, g) {
  'use strict';
  var backend = null;
  var persistent = false;

  try {
    var probe = '__sca_probe__';
    g.localStorage.setItem(probe, '1');
    g.localStorage.removeItem(probe);
    backend = g.localStorage;
    persistent = true;
  } catch (e) {
    backend = null;
    persistent = false;
  }

  var memory = {};

  SCA._storage = {
    persistent: persistent,
    get: function (key, fallback) {
      var raw;
      try {
        raw = persistent ? backend.getItem(key) : (memory[key] || null);
      } catch (e) { raw = null; }
      if (raw === null || raw === undefined) { return fallback; }
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      if (persistent) { backend.setItem(key, raw); }
      else { memory[key] = raw; }
    },
    remove: function (key) {
      if (persistent) { backend.removeItem(key); }
      else { delete memory[key]; }
    }
  };
})(SCA, typeof window !== 'undefined' ? window : globalThis);
