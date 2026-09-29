/*
 * Audit service (Stage 3). Append-only history for evidence actions.
 * Entries are records like any other — stored through SCA.store, never via
 * direct storage access — and are never overwritten: correcting history
 * means appending a new entry, not editing an old one.
 */
(function (SCA) {
  'use strict';

  function log(action, opts) {
    opts = opts || {};
    var entry = {
      actor: opts.actor || 'system',
      action: action,
      entity: opts.entity || null,
      entity_id: opts.entity_id || null,
      entity_code: opts.entity_code || null,
      old_value: (opts.old_value === undefined || opts.old_value === null)
        ? null : String(opts.old_value),
      new_value: (opts.new_value === undefined || opts.new_value === null)
        ? null : String(opts.new_value),
      reason: opts.reason || null,
      version: opts.version || null,
      timestamp: SCA.util.now()
    };
    var res = SCA.store.insert('audit_log', entry);
    if (!res.ok) { return res; }
    return { ok: true, record: res.record };
  }

  function forEntity(entity, id) {
    return SCA.store.all('audit_log').filter(function (e) {
      return e.entity === entity && e.entity_id === id;
    });
  }

  SCA.audit = {
    log: log,
    forEntity: forEntity
  };
})(SCA);
