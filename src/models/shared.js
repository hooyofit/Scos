/*
 * Shared model validation. Values that are not yet known stay null and are
 * displayed as "Not yet documented". Validators only reject wrong TYPES and
 * wrong ENUM VALUES; they never require knowledge that does not exist yet.
 */
(function (SCA) {
  'use strict';
  SCA.validateFields = function (model, record) {
    var errors = {};
    var ok = true;

    (model.required || []).forEach(function (f) {
      if (SCA.util.isBlank(record[f])) {
        errors[f] = 'Required.';
        ok = false;
      }
    });

    Object.keys(model.fields).forEach(function (f) {
      var value = record[f];
      if (value === null || value === undefined || value === '') { return; }
      var spec = model.fields[f];

      if (spec.type === 'string' && typeof value !== 'string') {
        errors[f] = 'Must be text.';
        ok = false;
      }
      if (spec.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
        errors[f] = 'Must be a number.';
        ok = false;
      }
      if (spec.type === 'boolean' && typeof value !== 'boolean') {
        errors[f] = 'Must be true or false.';
        ok = false;
      }
      if (spec.type === 'array' && !Array.isArray(value)) {
        errors[f] = 'Must be a list.';
        ok = false;
      }
      if (spec.type === 'any') { /* type refined in a later build stage */ }
      if (spec.enum) {
        var list = spec.enum === 'roles' ? SCA.roles : SCA.enums[spec.enum];
        if (!list || !SCA.enums.has(list, value)) {
          errors[f] = 'Unknown classification code: ' + value;
          ok = false;
        }
      }
    });

    return { valid: ok, errors: errors };
  };

  /* A template record: every field present, every value null. Used to show
     the structure of a record without inventing its contents. */
  SCA.templateFor = function (model) {
    var t = {};
    Object.keys(model.fields).forEach(function (f) { t[f] = null; });
    return t;
  };
})(SCA);
