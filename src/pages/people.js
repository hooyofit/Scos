/* People page: placeholder for practitioners, apprentices, trainers,
   researchers. Real systems arrive in Stage 4 (practitioner & knowledge-
   holder network) and Stage 5 (apprenticeship & training). */
(function (SCA) {
  'use strict';
  SCA.pages = SCA.pages || {};
  SCA.pages.people = function (root) {
    root.appendChild(SCA.ui.comingStep(4, 'People',
      'The people network will register practitioners, knowledge holders, ' +
      'apprentices, trainers and researchers, with consent, anonymity options, ' +
      'competence levels and access-controlled contact information.'));
  };
})(SCA);
