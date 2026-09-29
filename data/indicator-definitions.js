/*
 * Seed: the 23 authorized Stage 12 Indicator DEFINITIONS (frozen
 * scope v1.1 §18 + implementation authorization §17: "These become
 * formal Stage 12 Indicator definitions").
 *
 * These are DEFINITIONS, not data: a definition specifies what is
 * measured and how it is interpreted. No measurement VALUES are
 * seeded here and no values are computed at seed time — the
 * production baseline contains ZERO measurements (authorization
 * §34: production measurement data must remain empty unless created
 * through an authorized workflow).
 *
 * The definitions are seeded APPROVED because the vocabulary itself
 * is frozen in the authorized scope. Seeding is performed by the
 * adapter (SCA.indicator.seedDefinitions) with two distinct seed
 * identities (author and reviewer) so creator/reviewer separation
 * is honest even at seed time. Version 1 of every definition.
 *
 * calc_spec methods (dynamic, read-only, version-pinned compute):
 *   LATEST — the most recent accepted measurement in the queried
 *            scope/period (never zero when none exist: UNKNOWN).
 *   SUM    — the sum of accepted measurements in scope.
 *   MEAN   — the arithmetic mean of accepted measurements.
 *   RATIO  — sum(analysis_role NUMERATOR) / sum(analysis_role
 *            DENOMINATOR) over accepted measurements linked to the
 *            indicator; honest UNKNOWN when either side is missing.
 * NO indicator is a score or a ranking. Each definition's
 * interpretation_notes state what it does NOT mean.
 */
var SCA_indicators_seed = {
  schema_version: 1,
  seeded_by: 'SCOS Stage 12 authorized seed vocabulary',
  reviewed_by: 'SCOS Stage 12 seed review (separate identity)',
  indicators: [
    { code: 'PRACTITIONER_DENSITY', name: 'Practitioner Density',
      category: 'HUMAN_CAPABILITY', frequency: 'PER_CENSUS',
      method: 'RATIO', spec: { method: 'RATIO' },
      description: 'Practitioners documented within a defined scope ' +
        'relative to a measured population or area denominator for the ' +
        'same scope.',
      definition: 'Accepted practitioner-count measurements (NUMERATOR ' +
        'role) divided by accepted population-or-area denominator ' +
        'measurements (DENOMINATOR role) for the same observation scope ' +
        'and period.',
      required_measurements: 'NUMERATOR: COUNT measurements of ' +
        'documented practitioners within the scope. DENOMINATOR: COUNT ' +
        'measurements of the scope population or area.',
      scope: 'One explicitly measured scope (community, district or ' +
        'defined population).',
      interpretation_notes: 'A density value describes DOCUMENTED ' +
        'practitioners per measured denominator. It is not a quality ' +
        'judgment and never a ranking between regions.',
      limitations: 'Only as good as its scope: a narrow survey scope ' +
        'must never be read as a national figure.' },
    { code: 'APPRENTICE_RATIO', name: 'Apprentice Ratio',
      category: 'HUMAN_CAPABILITY', frequency: 'PER_CENSUS',
      method: 'RATIO', spec: { method: 'RATIO' },
      description: 'Apprentices documented per practitioner documented ' +
        'within the same defined scope.',
      definition: 'Accepted apprentice-count measurements (NUMERATOR) ' +
        'divided by accepted practitioner-count measurements ' +
        '(DENOMINATOR) for the same observation scope and period.',
      required_measurements: 'NUMERATOR: COUNT of documented apprentices ' +
        'in scope. DENOMINATOR: COUNT of documented practitioners in ' +
        'scope.',
      scope: 'One explicitly measured scope.',
      interpretation_notes: 'Describes transmission POTENTIAL in the ' +
        'documented data only. A low ratio is not a verdict on a ' +
        'community.',
      limitations: 'Documentation coverage differences between scopes ' +
        'limit direct comparison.' },
    { code: 'TRAINER_AVAILABILITY', name: 'Trainer Availability',
      category: 'HUMAN_CAPABILITY', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted count of trainers available ' +
        'within a defined scope.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'within the queried scope.',
      required_measurements: 'COUNT measurements of documented trainers ' +
        'within the scope.',
      scope: 'One explicitly measured scope.',
      interpretation_notes: 'A documented count, not a capacity claim.',
      limitations: 'Counting trainers does not measure teaching ' +
        'quality (Stage 5 competence remains the authority).' },
    { code: 'COMPETENCE_REPRODUCTION_RATE',
      name: 'Competence Reproduction Rate', category: 'HUMAN_CAPABILITY',
      frequency: 'PER_PROJECT', method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted percentage describing how ' +
        'much assessed competence is being reproduced.',
      definition: 'The accepted PERCENTAGE measurement with the latest ' +
        'observed_at for the scope, with its methodology exposed.',
      required_measurements: 'PERCENTAGE measurements from assessed ' +
        'competence outcomes (Stage 5 remains the competence authority).',
      scope: 'The assessed population, explicitly stated.',
      interpretation_notes: 'Describes an assessed share. It is not a ' +
        'success score for any capability.',
      limitations: 'Depends entirely on the assessment methodology ' +
        'documented on the measurement.' },
    { code: 'DOCUMENTATION_COVERAGE', name: 'Documentation Coverage',
      category: 'KNOWLEDGE', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted percentage of a defined ' +
        'scope documented in the knowledge archive.',
      definition: 'The accepted PERCENTAGE measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'PERCENTAGE measurements of documented ' +
        'coverage within a defined scope.',
      scope: 'The documented scope, explicitly stated.',
      interpretation_notes: 'Measures documentation effort, NOT the ' +
        'existence or health of knowledge.',
      limitations: 'Undocumented does not mean unknown to the ' +
        'community — only to the archive.' },
    { code: 'KNOWLEDGE_CONCENTRATION', name: 'Knowledge Concentration',
      category: 'KNOWLEDGE', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted measure of how much of a ' +
        'capability\'s documented knowledge is held by few holders.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'describing concentration for the scope.',
      required_measurements: 'RATIO or PERCENTAGE measurements of ' +
        'documented knowledge concentration.',
      scope: 'The documented knowledge scope, explicitly stated.',
      interpretation_notes: 'A descriptive measure of single-holder ' +
        'exposure. It is not a risk score; interpretation stays human.',
      limitations: 'Reflects documentation, not the full living ' +
        'knowledge system.' },
    { code: 'TRANSMISSION_STATUS', name: 'Transmission Status',
      category: 'KNOWLEDGE', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical transmission ' +
        'state of a capability in a defined scope.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope; the category value is named, never ' +
        'scored.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'transmission state.',
      scope: 'The documented scope, explicitly stated.',
      interpretation_notes: 'A named state (e.g. documented as active, ' +
        'interrupted, historical) — not a grade.',
      limitations: 'Category semantics depend on the documented method.' },
    { code: 'INSTITUTIONAL_CONTINUITY', name: 'Institutional Continuity',
      category: 'KNOWLEDGE', frequency: 'ANNUAL',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical continuity ' +
        'state of institutions supporting a capability.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'institutional continuity.',
      scope: 'The documented institutional scope.',
      interpretation_notes: 'A named state, not a score.',
      limitations: 'Institutional records are only as complete as the ' +
        'documented data.' },
    { code: 'LOCAL_REPAIR_RATIO', name: 'Local Repair Ratio',
      category: 'REPAIR', frequency: 'CONTINUOUS',
      method: 'RATIO', spec: { method: 'RATIO' },
      description: 'Repairs completed locally relative to total ' +
        'documented repair events in a defined scope and period.',
      definition: 'Accepted locally-completed repair counts (NUMERATOR) ' +
        'divided by accepted total repair-event counts (DENOMINATOR) ' +
        'for the same scope and period (Stage 8 remains the repair ' +
        'authority).',
      required_measurements: 'NUMERATOR: COUNT of documented local ' +
        'repairs. DENOMINATOR: COUNT of documented total repair events.',
      scope: 'The documented repair-event scope and period.',
      interpretation_notes: 'A factual ratio over documented events. ' +
        'Not a repair-capability score.',
      limitations: 'Repair documentation coverage directly bounds the ' +
        'ratio.' },
    { code: 'REPAIR_TIME', name: 'Repair Time',
      category: 'REPAIR', frequency: 'CONTINUOUS',
      method: 'MEAN', spec: { method: 'MEAN' },
      description: 'The mean duration of documented repair events in a ' +
        'defined scope and period.',
      definition: 'The arithmetic mean of accepted DURATION measurements ' +
        'in the queried scope and period.',
      required_measurements: 'DURATION measurements of documented repair ' +
        'events.',
      scope: 'The documented repair-event scope and period.',
      interpretation_notes: 'A mean over documented events with the same ' +
        'unit. Not a performance grade.',
      limitations: 'Mixed units, scopes or periods are never silently ' +
        'averaged.' },
    { code: 'REPAIR_RADIUS', name: 'Repair Radius',
      category: 'REPAIR', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted distance measure describing ' +
        'how far repair support must travel for a defined scope.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope.',
      required_measurements: 'Distance (e.g. KILOMETERS) measurements ' +
        'for the documented scope.',
      scope: 'The documented scope, explicitly stated.',
      interpretation_notes: 'A factual distance measurement.',
      limitations: 'Depends on the documented measurement method.' },
    { code: 'SPARE_PART_AVAILABILITY', name: 'Spare-Part Availability',
      category: 'REPAIR', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted measure of spare-part ' +
        'availability for a defined scope (Stage 8 remains the ' +
        'spare-part authority).',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope.',
      required_measurements: 'Documented spare-part availability ' +
        'measurements (percentage or categorical).',
      scope: 'The documented scope, explicitly stated.',
      interpretation_notes: 'A descriptive availability measure, not a ' +
        'supply-chain score.',
      limitations: 'Only as good as the documented inventory data.' },
    { code: 'RECOVERY_TIME', name: 'Recovery Time',
      category: 'RESILIENCE', frequency: 'CONTINUOUS',
      method: 'MEAN', spec: { method: 'MEAN' },
      description: 'The mean duration of documented recovery events for ' +
        'a defined scope (Stage 9 remains the recovery authority).',
      definition: 'The arithmetic mean of accepted DURATION measurements ' +
        'in the queried scope and period.',
      required_measurements: 'DURATION measurements of documented ' +
        'recovery events.',
      scope: 'The documented recovery-event scope and period.',
      interpretation_notes: 'A mean over documented events. Not a ' +
        'resilience score.',
      limitations: 'Recovery documentation coverage bounds the value.' },
    { code: 'RECOVERY_DIFFICULTY', name: 'Recovery Difficulty',
      category: 'RESILIENCE', frequency: 'CONTINUOUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical difficulty ' +
        'state of documented recovery for a scope.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'recovery difficulty.',
      scope: 'The documented scope.',
      interpretation_notes: 'A named state, not a difficulty score.',
      limitations: 'Category semantics depend on the documented method.' },
    { code: 'EXTERNAL_RESCUE_DEPENDENCY',
      name: 'External Rescue Dependency', category: 'RESILIENCE',
      frequency: 'CONTINUOUS', method: 'RATIO', spec: { method: 'RATIO' },
      description: 'Documented recovery events requiring external rescue ' +
        'relative to total documented recovery events.',
      definition: 'Accepted external-rescue counts (NUMERATOR) divided ' +
        'by accepted total recovery-event counts (DENOMINATOR) for the ' +
        'same scope and period.',
      required_measurements: 'NUMERATOR: COUNT of documented ' +
        'external-rescue recovery events. DENOMINATOR: COUNT of all ' +
        'documented recovery events.',
      scope: 'The documented recovery-event scope and period.',
      interpretation_notes: 'A factual ratio over documented events. ' +
        'Not an independence score.',
      limitations: 'Documentation coverage bounds the ratio.' },
    { code: 'GEOGRAPHIC_REDUNDANCY', name: 'Geographic Redundancy',
      category: 'RESILIENCE', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted count of distinct locations ' +
        'where a capability is documented.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope (Stage 6 geographic-redundancy records remain ' +
        'the census authority).',
      required_measurements: 'COUNT measurements of documented distinct ' +
        'locations.',
      scope: 'The documented scope, explicitly stated.',
      interpretation_notes: 'A documented count. More locations does ' +
        'not automatically mean more capability.',
      limitations: 'Only reflects documented locations.' },
    { code: 'REPRODUCTION_RATE', name: 'Reproduction Rate',
      category: 'REPRODUCTION', frequency: 'PER_PROJECT',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted percentage describing how ' +
        'much a capability is being reproduced (Stage 5 remains the ' +
        'reproduction authority).',
      definition: 'The accepted PERCENTAGE measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'PERCENTAGE measurements of documented ' +
        'reproduction.',
      scope: 'The documented reproduction scope.',
      interpretation_notes: 'A documented percentage, not a capability ' +
        'health grade.',
      limitations: 'Methodology is exposed with the value.' },
    { code: 'CAPABILITY_PERSISTENCE', name: 'Capability Persistence',
      category: 'REPRODUCTION', frequency: 'ANNUAL',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical persistence ' +
        'state of a capability in a defined scope.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'persistence state.',
      scope: 'The documented scope.',
      interpretation_notes: 'A named state, not a score.',
      limitations: 'Category semantics depend on the documented method.' },
    { code: 'TRAINER_TO_APPRENTICE_CONTINUITY',
      name: 'Trainer-to-Apprentice Continuity', category: 'REPRODUCTION',
      frequency: 'PER_CENSUS', method: 'LATEST',
      spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical continuity state ' +
        'of the trainer-to-apprentice chain in a scope.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'chain continuity.',
      scope: 'The documented scope.',
      interpretation_notes: 'A named state, not a continuity score.',
      limitations: 'Depends on documented apprenticeship records ' +
        '(Stage 5 remains the authority).' },
    { code: 'INSTITUTIONAL_REPRODUCTION', name: 'Institutional Reproduction',
      category: 'REPRODUCTION', frequency: 'ANNUAL',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted categorical state of ' +
        'institutional reproduction of a capability.',
      definition: 'The accepted CATEGORICAL measurement with the latest ' +
        'observed_at for the scope.',
      required_measurements: 'CATEGORICAL measurements of documented ' +
        'institutional reproduction.',
      scope: 'The documented institutional scope.',
      interpretation_notes: 'A named state, not a score.',
      limitations: 'Only reflects documented institutions.' },
    { code: 'DEPENDENCY_EXPOSURE', name: 'Dependency Exposure',
      category: 'SYSTEMS', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted count of documented ' +
        'dependencies of a capability (often GRAPH_DERIVED from the ' +
        'Stage 7 graph, which is never modified by measurement).',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope; graph-derived inputs carry GRAPH_DERIVED ' +
        'provenance.',
      required_measurements: 'COUNT measurements of documented or ' +
        'graph-derived dependencies.',
      scope: 'The documented or graph-queried scope.',
      interpretation_notes: 'A descriptive count. High exposure is not ' +
        'automatically a weakness; interpretation stays human.',
      limitations: 'Graph-derived values reflect documented ' +
        'relationships only.' },
    { code: 'GRAPH_LEVERAGE', name: 'Graph Leverage',
      category: 'SYSTEMS', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted measure of a capability\'s ' +
        'position leverage in the documented dependency graph.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope (graph-derived inputs carry GRAPH_DERIVED ' +
        'provenance; Stage 7 remains the graph authority).',
      required_measurements: 'RATIO measurements of documented graph ' +
        'leverage.',
      scope: 'The documented graph scope.',
      interpretation_notes: 'A descriptive graph measure, never a ' +
        'criticality ranking.',
      limitations: 'Reflects the documented graph only.' },
    { code: 'CAPABILITY_CENTRALITY', name: 'Capability Centrality',
      category: 'SYSTEMS', frequency: 'PER_CENSUS',
      method: 'LATEST', spec: { method: 'LATEST' },
      description: 'The most recent accepted centrality measure of a ' +
        'capability within the documented dependency graph.',
      definition: 'The accepted measurement with the latest observed_at ' +
        'for the scope (graph-derived inputs carry GRAPH_DERIVED ' +
        'provenance).',
      required_measurements: 'RATIO measurements of documented ' +
        'centrality.',
      scope: 'The documented graph scope.',
      interpretation_notes: 'A descriptive graph measure, never a ' +
        'ranking.',
      limitations: 'Reflects the documented graph only.' }
  ]
};
