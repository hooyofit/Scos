/* Minimal reactive state (pub/sub). */
(function (SCA) {
  'use strict';
  var state = {};
  var subs = {};

  SCA.state = {
    get: function (key) { return state[key]; },
    set: function (key, value) {
      state[key] = value;
      (subs[key] || []).forEach(function (fn) {
        try { fn(value, state); } catch (e) {}
      });
    },
    on: function (key, fn) {
      subs[key] = subs[key] || [];
      subs[key].push(fn);
    }
  };
})(SCA);
