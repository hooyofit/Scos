/*
 * Bilingual framework (English / Somali).
 * Step 1 provides the framework and English strings only.
 * Somali strings must be contributed by Somali speakers in a later
 * build step. Nothing is machine-translated or fabricated.
 */
(function (SCA) {
  'use strict';
  var strings = {
    en: {
      app_name: 'Somali Capability Atlas',
      tagline: 'Preserve Knowledge. Build Capability. Prepare the Future.',
      not_documented: 'Not yet documented',
      sign_in: 'Sign in',
      sign_out: 'Sign out',
      sign_up: 'Create account'
    },
    so: {
      /* Somali interface arrives in a later build step. Do not add
         machine-translated placeholders here. */
    },
    ar: {
      /* Arabic can be added later (design languages: Somali + English first). */
    }
  };

  var active = (SCA.config && SCA.config.default_language) || 'en';

  SCA.i18n = {
    available: function () {
      return (SCA.config.languages || []).map(function (l) {
        return { code: l.code, label: l.label, ready: !!l.ready };
      });
    },
    activeLanguage: function () { return active; },
    isReady: function (code) {
      return !!(strings[code] && Object.keys(strings[code]).length);
    },
    setLanguage: function (code) {
      if (SCA.i18n.isReady(code)) { active = code; }
      return SCA.i18n.activeLanguage();
    },
    t: function (key) {
      return (strings[active] && strings[active][key]) ||
        strings.en[key] || key;
    }
  };
})(SCA);
