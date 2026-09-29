/* UI building blocks: DOM helper, cards, badges, empty states, fields. */
(function (SCA) {
  'use strict';

  function append(node, child) {
    if (child === null || child === undefined || child === false) { return; }
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    if (typeof child === 'object') { node.appendChild(child); return; }
    node.appendChild(document.createTextNode(String(child)));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
        node.addEventListener(k.slice(2), v);
      }
      else { node.setAttribute(k, v); }
    });
    for (var i = 2; i < arguments.length; i++) { append(node, arguments[i]); }
    return node;
  }

  function pageHeader(title, subtitle) {
    return el('header', { class: 'page-header' },
      el('h1', { text: title }),
      subtitle ? el('p', { class: 'page-subtitle', text: subtitle }) : null);
  }

  function badge(text, tone) {
    return el('span', { class: 'badge badge-' + (tone || 'muted'), text: text });
  }

  /* Unknown values display as "Not yet documented", never fabricated. */
  function fieldRow(label, value) {
    var blank = SCA.util.isBlank(value);
    return el('div', { class: 'field-row' + (blank ? ' field-blank' : '') },
      el('dt', { text: label }),
      el('dd', { text: SCA.util.display(value) }));
  }

  function emptyState(opts) {
    return el('div', { class: 'empty-state' },
      el('div', { class: 'empty-icon', 'aria-hidden': 'true' }),
      el('h2', { text: opts.title }),
      el('p', { text: opts.message }),
      opts.actions || null);
  }

  /* Placeholder for systems that arrive in later build steps. Honest, no fake UI. */
  function comingStep(stepNumber, title, summary) {
    return el('div', { class: 'page-content' },
      pageHeader(title, 'Coming in build step ' + stepNumber),
      emptyState({
        title: 'Not built yet',
        message: summary +
          ' This is a deliberate placeholder: nothing in this section is simulated or fake.'
      }));
  }

  function denied(permission) {
    return el('div', { class: 'page-content' },
      pageHeader('Permission required'),
      emptyState({
        title: 'You do not have access to this section',
        message: 'Required permission: ' + permission +
          '. Sign in with an appropriate role, or contact a National Administrator.'
      }));
  }

  function select(id, options, selected) {
    var s = el('select', { id: id, 'aria-label': id });
    s.appendChild(el('option', { value: '', selected: selected ? null : true }, 'Any'));
    options.forEach(function (o) {
      var opt = el('option', { value: o.value },
        o.label);
      if (selected === o.value) { opt.selected = true; }
      s.appendChild(opt);
    });
    return s;
  }

  function errorList(errors) {
    var keys = Object.keys(errors || {});
    if (!keys.length) { return null; }
    return el('ul', { class: 'error-list' },
      keys.map(function (k) {
        return el('li', { text: errors[k] });
      }));
  }

  function downloadJSON(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  SCA.ui = {
    el: el,
    pageHeader: pageHeader,
    badge: badge,
    fieldRow: fieldRow,
    emptyState: emptyState,
    comingStep: comingStep,
    denied: denied,
    select: select,
    errorList: errorList,
    downloadJSON: downloadJSON
  };
})(SCA);
