/*
 * Authentication abstraction. Step 1 ships only a local provider; a hosted
 * provider (Base44 auth, Supabase, an own API, OIDC) can be registered with
 * the SAME contract later without touching any UI code.
 *
 * Provider contract (all methods):
 *   signUp(input)          -> Promise<{ok, user?, errors?}>   input: {name,email,password,language?,region?}
 *   signIn(input)          -> Promise<{ok, user?, errors?}>   input: {email,password}
 *   signOut()              -> {ok}
 *   getCurrentUser()       -> user | null        (sanitized, never credential material)
 *   resetPassword(input)   -> Promise<{ok, token?, note?}>   input: {email}
 *   completeReset(input)   -> Promise<{ok, errors?}>         input: {email, token, new_password}
 *   updateProfile(id, patch) -> Promise<{ok, user?, errors?}>
 */
(function (SCA) {
  'use strict';
  var providers = {};
  var active = null;

  SCA.auth = {
    register: function (name, provider) {
      var required = ['signUp', 'signIn', 'signOut', 'getCurrentUser',
        'resetPassword', 'completeReset', 'updateProfile'];
      var missing = required.filter(function (m) { return typeof provider[m] !== 'function'; });
      if (missing.length) {
        throw new Error('Auth provider "' + name + '" is missing: ' + missing.join(', '));
      }
      providers[name] = provider;
    },
    use: function (name) {
      if (!providers[name]) { throw new Error('Unknown auth provider: ' + name); }
      active = providers[name];
      active.provider_name = name;
      return active;
    },
    current: function () { return active; },
    available: function () { return Object.keys(providers); }
  };
})(SCA);
