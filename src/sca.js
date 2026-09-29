/*
 * Somali Capability Atlas (SCOS) — namespace bootstrap.
 * Loaded first; every other file attaches to window.SCA.
 * Written as classic scripts (no ES modules) so the app runs from
 * file:// , http(s):// , or any static host. See docs/architecture.md.
 */
(function (g) {
  'use strict';
  var SCA = g.SCA || {};

  SCA.APP_NAME = 'Somali Capability Atlas';
  SCA.INTERNAL_NAME = 'SCOS — Somali Capability Operating System';
  SCA.VERSION = '0.1.0';
  SCA.BUILD_STEP = 15;
  SCA.SCHEMA_VERSION = 1;
  SCA.MISSION = 'An evidence-based digital platform for documenting, preserving, ' +
    'validating, connecting, teaching and reproducing Somali capabilities.';
  SCA.PHILOSOPHY = [
    'Modernize without forgetting.',
    'A claim can be preserved without being declared true.',
    'Preserve the knowledge. Validate the treatment. Protect the patient.'
  ];
  SCA.POSITIONING = 'Preserve what we know. Recover what we lost. ' +
    'Build what we need. Pass it forward.';
  SCA.UNKNOWN_LABEL = 'Not yet documented';

  SCA.util = {
    uuid: function () {
      if (g.crypto && g.crypto.randomUUID) { try { return g.crypto.randomUUID(); } catch (e) {} }
      return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    },
    now: function () { return new Date().toISOString(); },
    isBlank: function (v) {
      return v === null || v === undefined || v === '' ||
        (typeof v === 'string' && v.trim() === '');
    },
    /* Display rule: unknown values are NEVER fabricated. */
    display: function (v, fallback) {
      return SCA.util.isBlank(v) ? (fallback || SCA.UNKNOWN_LABEL) : v;
    },
    clone: function (o) { return JSON.parse(JSON.stringify(o)); },
    isEmail: function (v) {
      return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    }
  };

  g.SCA = SCA;
})(typeof window !== 'undefined' ? window : globalThis);
