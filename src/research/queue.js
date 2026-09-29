/*
 * Offline collection queue (Stage 4).
 *
 * Every locally created or changed field record gets a queue entry so the
 * researcher always sees what exists only on this device. Statuses are
 * honest by construction: a fresh record is LOCAL_ONLY. It becomes
 * READY_FOR_EXPORT on submit, EXPORTED when written to a package/bundle,
 * IMPORTED when a package is accepted elsewhere, SYNCHRONIZED only after an
 * explicit completed round trip, CONFLICT when the same id arrives with
 * divergent content (both versions preserved, human review required), and
 * FAILED when an attempt errored (retry_count + last_error record it).
 */
(function (SCA) {
  'use strict';

  function enqueue(entityType, localId, operation, opts) {
    opts = opts || {};
    var res = SCA.store.insert('research_queue', {
      entity_type: entityType,
      local_id: localId,
      operation: operation || 'create',
      dependency_ids: opts.dependency_ids || [],
      sync_status: 'LOCAL_ONLY',
      retry_count: 0,
      last_error: null,
      device_note: opts.device_note || null,
      version: '1'
    });
    return res;
  }

  function entriesFor(entityType, localId) {
    return SCA.store.all('research_queue').filter(function (e) {
      return e.entity_type === entityType && e.local_id === localId;
    });
  }

  function setStatus(entityType, localId, status, extra) {
    var updated = 0;
    SCA.store.all('research_queue').forEach(function (e) {
      if (e.entity_type === entityType && e.local_id === localId) {
        var res = SCA.store.update('research_queue', e.id, Object.assign({
          sync_status: status,
          modified_at: SCA.util.now()
        }, extra || {}));
        if (res.ok) { updated++; }
      }
    });
    return updated;
  }

  function markFailed(entityType, localId, error) {
    SCA.store.all('research_queue').forEach(function (e) {
      if (e.entity_type === entityType && e.local_id === localId) {
        SCA.store.update('research_queue', e.id, {
          sync_status: 'FAILED',
          retry_count: (e.retry_count || 0) + 1,
          last_error: String(error || 'unknown error'),
          modified_at: SCA.util.now()
        });
      }
    });
  }

  /* Honest status reporting: never claim synchronized without a round trip. */
  function pending() {
    return SCA.store.all('research_queue').filter(function (e) {
      return e.sync_status === 'LOCAL_ONLY' || e.sync_status === 'READY_FOR_EXPORT' ||
        e.sync_status === 'CONFLICT' || e.sync_status === 'FAILED';
    });
  }

  function counts() {
    var c = {};
    SCA.store.all('research_queue').forEach(function (e) {
      c[e.sync_status] = (c[e.sync_status] || 0) + 1;
    });
    return c;
  }

  SCA.queue = {
    enqueue: enqueue,
    entriesFor: entriesFor,
    setStatus: setStatus,
    markFailed: markFailed,
    pending: pending,
    counts: counts
  };
})(SCA);
