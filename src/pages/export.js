/*
 * Export / Import page. Data portability is a first-class Day-1 feature.
 * Export requires the data.export permission; import requires data.import.
 */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};

  SCA.pages.export = function (root) {
    var user = SCA.state.get('user');
    if (!SCA.rbac.can(user, 'data.export')) {
      root.appendChild(SCA.ui.denied('data.export'));
      return;
    }

    var canImport = SCA.rbac.can(user, 'data.import');
    var fileInput = null;
    var pendingText = null;

    var feedback = SCA.ui.el('div', { class: 'feedback' });
    var previewArea = SCA.ui.el('div', { class: 'feedback' });

    function say(msg, isError) {
      feedback.innerHTML = '';
      feedback.appendChild(SCA.ui.el('p', {
        class: isError ? 'msg-error' : 'msg-ok', text: msg
      }));
    }

    function exportRow(name, note, downloadLabel, download, primary) {
      return SCA.ui.el('div', { class: 'export-row' },
        SCA.ui.el('span', { class: 'export-name', text: name }),
        SCA.ui.el('span', { class: 'card-count', text: note }),
        SCA.ui.el('button', {
          class: 'btn ' + (primary ? 'btn-primary' : 'btn-secondary'),
          onclick: download
        }, downloadLabel));
    }

    function previewImport() {
      pendingText = null;
      previewArea.innerHTML = '';
      var f = fileInput.files && fileInput.files[0];
      if (!f) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        pendingText = String(reader.result);
        try {
          var bundle = SCA.transfer.parse(pendingText);
          var v = SCA.transfer.validateBundle(bundle);
          if (!v.ok) {
            previewArea.appendChild(SCA.ui.el('p', { class: 'msg-error',
              text: 'Invalid file: ' + v.errors.join(' ') }));
            pendingText = null;
            return;
          }
          var counts = Object.keys(bundle.collections).map(function (c) {
            return c + ': ' + bundle.collections[c].length;
          }).join(', ');
          previewArea.appendChild(SCA.ui.el('p', { class: 'msg-ok',
            text: 'Ready to import: ' + counts +
              '. Schema version ' + (bundle.schema_version || 1) + '.' }));
          previewArea.appendChild(SCA.ui.el('p', { class: 'page-subtitle' },
            'Warning: importing replaces the current contents of the included ' +
            'collections. User accounts are preserved. Export first if in doubt.'));
          previewArea.appendChild(SCA.ui.el('button', {
            class: 'btn btn-danger',
            onclick: function () {
              var res = SCA.transfer.importBundle(pendingText);
              if (res.ok) {
                var migrated = res.appliedMigrations.length
                  ? res.appliedMigrations.map(function (m) { return m.to_version; }).join(', ')
                  : 'none';
                say('Import complete: ' + JSON.stringify(res.counts) +
                  '. Migrations applied: ' + migrated + '.');
                pendingText = null;
                fileInput.value = '';
                previewArea.innerHTML = '';
                render();
              } else {
                say('Import failed: ' + res.errors.join(' '), true);
              }
            }
          }, 'Replace local data with this import'));
        } catch (e) {
          previewArea.appendChild(SCA.ui.el('p', { class: 'msg-error', text: e.message }));
        }
      };
      reader.readAsText(f);
    }

    function render() {
      /* Export rows are rebuilt on every render so counts stay live. */
      var rows = SCA.transfer.EXPORTABLE.map(function (name) {
        return exportRow(name, SCA.store.count(name) + ' records', 'Download JSON',
          function () {
            SCA.ui.downloadJSON(name + '.json', SCA.transfer.exportCollection(name));
            say(name + '.json downloaded.');
          });
      });

      rows.push(exportRow('Full bundle (all collections)', SCA.config.export.note,
        'Download bundle',
        function () {
          SCA.ui.downloadJSON('somali-capability-atlas-bundle.json',
            SCA.transfer.exportAll());
          say('Full bundle downloaded.');
        }, true));

      var importSection;
      if (canImport) {
        if (!fileInput) {
          fileInput = SCA.ui.el('input', { type: 'file', accept: 'application/json' });
          fileInput.addEventListener('change', previewImport);
        }
        importSection = SCA.ui.el('section', { class: 'about-block' },
          SCA.ui.el('h3', { text: 'Import data' }),
          SCA.ui.el('p', { class: 'page-subtitle' },
            'Import a bundle or single-collection JSON file exported by this application.'),
          fileInput, previewArea);
      } else {
        importSection = SCA.ui.el('section', { class: 'about-block' },
          SCA.ui.el('h3', { text: 'Import data' }),
          SCA.ui.el('p', { class: 'page-subtitle' },
            'Importing requires the data.import permission (Project Manager, ' +
            'Regional or National Administrator).'));
      }

      root.innerHTML = '';
      root.appendChild(SCA.ui.el('div', { class: 'page-content' },
        SCA.ui.pageHeader('Data Export & Import',
          'Your data belongs to you. Plain JSON, versioned, no lock-in.'),
        feedback,
        SCA.ui.el('section', { class: 'about-block' },
          SCA.ui.el('h3', { text: 'Export collections' }), rows),
        importSection));
    }

    render();
  };
})(SCA);
