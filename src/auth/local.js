/*
 * Local auth provider (offline-first demo implementation of the contract).
 *
 * HONEST LIMITATIONS (documented, not hidden):
 * - Passwords are salted and hashed with SHA-256 locally; accounts live in
 *   this browser/device only. This is a foundation, not production security.
 * - There is no email service in Step 1, so a password reset generates a
 *   one-time token that is SHOWN LOCALLY, never emailed.
 * - Replacement by a hosted provider happens in a later build step through
 *   the same SCA.auth contract.
 */
(function (SCA, g) {
  'use strict';
  var SESSION_KEY = SCA.config.session_key;
  var RESET_KEY = SCA.config.reset_token_key;

  /* ---- hashing ---- */
  function bytesToHex(buf) {
    var arr = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < arr.length; i++) {
      out += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
    }
    return out;
  }

  async function hashPassword(password, salt) {
    var input = salt + ':' + password;
    if (g.crypto && g.crypto.subtle) {
      var buf = await g.crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(input));
      return 'sha256:' + bytesToHex(buf);
    }
    /* Fallback when Web Crypto is unavailable. Clearly marked weak. */
    var h1 = 5381, h2 = 5271;
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
    return 'weak-fallback:' + h1.toString(16) + '-' + h2.toString(16);
  }

  function randomToken() {
    var bytes = new Uint8Array(24);
    if (g.crypto && g.crypto.getRandomValues) {
      g.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) { bytes[i] = Math.floor(Math.random() * 256); }
    }
    var s = '';
    for (var j = 0; j < bytes.length; j++) { s += bytes[j].toString(16); }
    return s;
  }

  /* ---- helpers ---- */
  function sanitized(user) {
    if (!user) { return null; }
    var u = {};
    ['id', 'name', 'email', 'role', 'phone', 'language', 'region',
      'profile_photo', 'bio', 'status', 'created_at', 'updated_at'].forEach(function (f) {
      u[f] = user[f] === undefined ? null : user[f];
    });
    return u;
  }

  function findByEmail(email) {
    var wanted = String(email || '').trim().toLowerCase();
    return SCA.store.all('users').filter(function (u) {
      return u.email && u.email.trim().toLowerCase() === wanted;
    })[0] || null;
  }

  function setSession(user) {
    SCA._storage.set(SESSION_KEY, { user_id: user.id, signed_in_at: SCA.util.now() });
  }

  /* ---- provider ---- */
  var LocalAuthProvider = {
    signUp: async function (input) {
      var errors = {};
      if (SCA.util.isBlank(input.name)) { errors.name = 'Required.'; }
      if (!SCA.util.isEmail(input.email)) { errors.email = 'Enter a valid email address.'; }
      if (!input.password || input.password.length < 8) {
        errors.password = 'At least 8 characters.';
      }
      if (Object.keys(errors).length) { return { ok: false, errors: errors }; }
      if (findByEmail(input.email)) {
        return { ok: false, errors: { email: 'An account with this email already exists.' } };
      }
      var salt = randomToken();
      var hash = await hashPassword(input.password, salt);
      var result = SCA.store.insert('users', {
        name: input.name.trim(),
        email: input.email.trim(),
        role: 'public', /* New accounts are Public Users. Roles are assigned
                           by administrators in a later build step. */
        phone: null,
        language: input.language || SCA.config.default_language,
        region: SCA.util.isBlank(input.region) ? null : input.region.trim(),
        profile_photo: null,
        bio: null,
        status: 'active',
        _auth: { provider: 'local', salt: salt, password_hash: hash }
      });
      if (!result.ok) { return { ok: false, errors: result.errors }; }
      setSession(result.record);
      return { ok: true, user: sanitized(result.record) };
    },

    signIn: async function (input) {
      var user = findByEmail(input.email);
      if (!user || !user._auth) {
        return { ok: false, errors: { email: 'No account found for this email.' } };
      }
      var hash = await hashPassword(input.password, user._auth.salt);
      if (hash !== user._auth.password_hash) {
        return { ok: false, errors: { password: 'Incorrect password.' } };
      }
      if (user.status === 'disabled') {
        return { ok: false, errors: { email: 'This account is disabled.' } };
      }
      setSession(user);
      return { ok: true, user: sanitized(user) };
    },

    signOut: function () {
      SCA._storage.remove(SESSION_KEY);
      return { ok: true };
    },

    getCurrentUser: function () {
      var session = SCA._storage.get(SESSION_KEY, null);
      if (!session || !session.user_id) { return null; }
      return sanitized(SCA.store.get('users', session.user_id));
    },

    resetPassword: async function (input) {
      var user = findByEmail(input.email);
      if (!user) {
        /* Do not reveal whether the account exists. */
        return { ok: true, token: null, note: 'If the account exists, a reset token has been created.' };
      }
      var tokens = SCA._storage.get(RESET_KEY, {});
      var token = randomToken();
      tokens[user.id] = {
        token: token,
        created_at: SCA.util.now(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      SCA._storage.set(RESET_KEY, tokens);
      return {
        ok: true,
        token: token,
        note: 'Step 1 has no email service. This one-time token is shown ' +
          'locally and expires in 24 hours. Email delivery arrives with a ' +
          'hosted auth provider in a later build step.'
      };
    },

    completeReset: async function (input) {
      var user = findByEmail(input.email);
      var tokens = SCA._storage.get(RESET_KEY, {});
      var entry = user ? tokens[user.id] : null;
      if (!user || !entry || entry.token !== input.token) {
        return { ok: false, errors: { token: 'Invalid token or email.' } };
      }
      if (new Date(entry.expires_at).getTime() < Date.now()) {
        delete tokens[user.id];
        SCA._storage.set(RESET_KEY, tokens);
        return { ok: false, errors: { token: 'This token has expired. Request a new one.' } };
      }
      if (!input.new_password || input.new_password.length < 8) {
        return { ok: false, errors: { new_password: 'At least 8 characters.' } };
      }
      var salt = randomToken();
      var hash = await hashPassword(input.new_password, salt);
      SCA.store.update('users', user.id, {
        _auth: { provider: 'local', salt: salt, password_hash: hash },
        updated_at: SCA.util.now()
      });
      delete tokens[user.id];
      SCA._storage.set(RESET_KEY, tokens);
      return { ok: true };
    },

    updateProfile: async function (userId, patch) {
      var user = SCA.store.get('users', userId);
      if (!user) { return { ok: false, errors: { id: 'Account not found.' } }; }
      var allowed = {};
      ['name', 'phone', 'language', 'region', 'bio', 'profile_photo'].forEach(function (f) {
        if (patch[f] !== undefined) {
          allowed[f] = SCA.util.isBlank(patch[f]) ? null : patch[f];
        }
      });
      var result = SCA.store.update('users', userId, allowed);
      if (!result.ok) { return { ok: false, errors: result.errors }; }
      return { ok: true, user: sanitized(result.record) };
    }
  };

  SCA.auth.register('local', LocalAuthProvider);
})(SCA, typeof window !== 'undefined' ? window : globalThis);
