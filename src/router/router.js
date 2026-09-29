/*
 * Hash-based router. Hash routing means the app works from file://,
 * any static host, or offline with zero server configuration.
 */
(function (SCA) {
  'use strict';
  var routes = [];

  function add(pattern, handler) {
    routes.push({ parts: pattern.replace(/^#/, '').split('/'), handler: handler, pattern: pattern });
  }

  function match(hash) {
    var seg = hash.replace(/^#/, '').split('/');
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.parts.length !== seg.length) { continue; }
      var params = {};
      var hit = true;
      for (var j = 0; j < seg.length; j++) {
        if (r.parts[j].charAt(0) === ':') { params[r.parts[j].slice(1)] = decodeURIComponent(seg[j]); }
        else if (r.parts[j] !== seg[j]) { hit = false; break; }
      }
      if (hit) { return { handler: r.handler, params: params, pattern: r.pattern }; }
    }
    return null;
  }

  function notFound(root) {
    root.appendChild(SCA.ui.el('div', { class: 'page-content' },
      SCA.ui.emptyState({
        title: 'Page not found',
        message: 'This page does not exist.',
        actions: SCA.ui.el('a', { class: 'btn btn-primary', href: '#/' }, 'Back to home')
      })));
  }

  function render() {
    var hash = location.hash || '#/';
    var root = document.getElementById('page-root');
    var m = match(hash);
    root.innerHTML = '';
    if (!m) { notFound(root); }
    else { m.handler(root, m.params); }
    SCA.state.set('route', hash);
    window.scrollTo(0, 0);
  }

  SCA.router = {
    add: add,
    match: match,
    render: render,
    start: function () {
      if (!location.hash) { location.hash = '#/'; }
      window.addEventListener('hashchange', render);
      render();
    }
  };
})(SCA);
