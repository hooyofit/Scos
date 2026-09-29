/*
 * Seed: the 12 capability families (permanent top-level categories).
 * Family codes: W L A P F C H M R S T G (per project specification).
 * These are the real project structure, not fabricated data.
 * Capability records arrive in Stage 2. Descriptions are scope statements.
 */
var SCA_seed = {
  schema_version: 1,
  families: [
    { code: 'W', name: 'Water & Hydrology', display_order: 1, status: null,
      description: 'Scope: water sourcing, storage, transport, management and dryland hydrology.' },
    { code: 'L', name: 'Pastoralism & Livestock', display_order: 2, status: null,
      description: 'Scope: herding, animal husbandry, breeding, mobility and rangeland knowledge.' },
    { code: 'A', name: 'Agriculture & Land', display_order: 3, status: null,
      description: 'Scope: dryland farming, soil, seeds, land management and seasonality.' },
    { code: 'P', name: 'Food Preservation & Processing', display_order: 4, status: null,
      description: 'Scope: storing, drying, processing and preserving food.' },
    { code: 'F', name: 'Fisheries & Marine Knowledge', display_order: 5, status: null,
      description: 'Scope: boats, fishing, navigation and coastal knowledge.' },
    { code: 'C', name: 'Climate, Weather & Environmental Intelligence', display_order: 6, status: null,
      description: 'Scope: forecasting, environmental reading and seasonal knowledge.' },
    { code: 'H', name: 'Shelter, Aqal & Climate-Adapted Architecture', display_order: 7, status: null,
      description: 'Scope: mobile and settled shelter, materials and climate adaptation.' },
    { code: 'M', name: 'Crafts & Materials', display_order: 8, status: null,
      description: 'Scope: weaving, woodwork, metalwork, leather and material processing.' },
    { code: 'R', name: 'Repair, Engineering & Local Manufacturing', display_order: 9, status: null,
      description: 'Scope: maintenance, repair, fabrication and local production.' },
    { code: 'S', name: 'Medicine, Hygiene & Human Survival', display_order: 10, status: null,
      description: 'Scope: health knowledge, hygiene and survival practices. Documentation is never medical recommendation; subject to strict scientific validation.' },
    { code: 'T', name: 'Trade, Transport & Economic Self-Reliance', display_order: 11, status: null,
      description: 'Scope: trade networks, transport and economic organization.' },
    { code: 'G', name: 'Governance, Community Organization & Knowledge Transmission', display_order: 12, status: null,
      description: 'Scope: decision-making, community organization and how knowledge is passed on.' }
  ]
};
