/* Stage 2 inventory integrity test.
 *
 * Protects the frozen 240-capability research inventory. Fails if a
 * capability is deleted, renamed, duplicated, recoded, moved to another
 * family, or if a 241st capability appears. Also verifies the conservative
 * initial metadata, the no-fabrication rule, persistence, export/import
 * and search behavior.
 */
'use strict';
var H = require('./helpers');

/* Canonical inventory: code -> [name, family code]. FROZEN. */
var CANONICAL = {
  'W01': ['Traditional well identification', 'W'],
  'W02': ['Well digging', 'W'],
  'W03': ['Well deepening', 'W'],
  'W04': ['Well lining/stabilization', 'W'],
  'W05': ['Well maintenance', 'W'],
  'W06': ['Traditional well-water lifting', 'W'],
  'W07': ['Animal-powered water lifting', 'W'],
  'W08': ['Hand/mechanical pumping', 'W'],
  'W09': ['Berkad construction', 'W'],
  'W10': ['Berkad maintenance', 'W'],
  'W11': ['Rainwater harvesting', 'W'],
  'W12': ['Seasonal water-source mapping', 'W'],
  'W13': ['Surface-water identification', 'W'],
  'W14': ['Water-source quality recognition', 'W'],
  'W15': ['Water storage in traditional containers', 'W'],
  'W16': ['Water rationing during drought', 'W'],
  'W17': ['Community water-sharing systems', 'W'],
  'W18': ['Water-point protection', 'W'],
  'W19': ['Pastoral water-route knowledge', 'W'],
  'W20': ['Drought water planning', 'W'],
  'L01': ['Camel selection', 'L'],
  'L02': ['Camel breeding knowledge', 'L'],
  'L03': ['Camel identification', 'L'],
  'L04': ['Camel age estimation', 'L'],
  'L05': ['Camel condition assessment', 'L'],
  'L06': ['Camel milk management', 'L'],
  'L07': ['Camel milk fermentation', 'L'],
  'L08': ['Camel milk preservation', 'L'],
  'L09': ['Goat selection', 'L'],
  'L10': ['Sheep selection', 'L'],
  'L11': ['Cattle selection', 'L'],
  'L12': ['Livestock disease recognition', 'L'],
  'L13': ['Traditional animal care', 'L'],
  'L14': ['Herd movement planning', 'L'],
  'L15': ['Seasonal grazing knowledge', 'L'],
  'L16': ['Drought migration planning', 'L'],
  'L17': ['Pasture assessment', 'L'],
  'L18': ['Livestock watering management', 'L'],
  'L19': ['Livestock valuation', 'L'],
  'L20': ['Herd-risk diversification', 'L'],
  'A01': ['Local seed selection', 'A'],
  'A02': ['Seed saving', 'A'],
  'A03': ['Seed exchange', 'A'],
  'A04': ['Seed storage', 'A'],
  'A05': ['Sorghum cultivation', 'A'],
  'A06': ['Cowpea cultivation', 'A'],
  'A07': ['Intercropping', 'A'],
  'A08': ['Mixed cropping', 'A'],
  'A09': ['Traditional planting calendars', 'A'],
  'A10': ['Rainfall-based planting decisions', 'A'],
  'A11': ['Soil recognition', 'A'],
  'A12': ['Soil fertility management', 'A'],
  'A13': ['Manure management', 'A'],
  'A14': ['Crop-residue management', 'A'],
  'A15': ['Traditional soil bunding', 'A'],
  'A16': ['Erosion control', 'A'],
  'A17': ['Small-scale irrigation', 'A'],
  'A18': ['Flood-recession farming', 'A'],
  'A19': ['Traditional weed management', 'A'],
  'A20': ['Traditional pest recognition', 'A'],
  'P01': ['Grain drying', 'P'],
  'P02': ['Grain storage', 'P'],
  'P03': ['Grain protection from pests', 'P'],
  'P04': ['Meat drying', 'P'],
  'P05': ['Meat salting', 'P'],
  'P06': ['Meat smoking', 'P'],
  'P07': ['Fish drying', 'P'],
  'P08': ['Fish salting', 'P'],
  'P09': ['Fish smoking', 'P'],
  'P10': ['Milk fermentation', 'P'],
  'P11': ['Butter production', 'P'],
  'P12': ['Ghee production', 'P'],
  'P13': ['Fermented-food preparation', 'P'],
  'P14': ['Fruit drying', 'P'],
  'P15': ['Vegetable drying', 'P'],
  'P16': ['Traditional food packaging', 'P'],
  'P17': ['Traditional food storage', 'P'],
  'P18': ['Food preservation without electricity', 'P'],
  'P19': ['Food rationing during scarcity', 'P'],
  'P20': ['Food preservation planning', 'P'],
  'F01': ['Traditional fishing-ground identification', 'F'],
  'F02': ['Seasonal fishing knowledge', 'F'],
  'F03': ['Fish-species recognition', 'F'],
  'F04': ['Fish behavior recognition', 'F'],
  'F05': ['Tidal knowledge', 'F'],
  'F06': ['Coastal-current knowledge', 'F'],
  'F07': ['Wind knowledge at sea', 'F'],
  'F08': ['Wave-condition recognition', 'F'],
  'F09': ['Traditional marine navigation', 'F'],
  'F10': ['Landmark navigation', 'F'],
  'F11': ['Fishing-net construction', 'F'],
  'F12': ['Fishing-net repair', 'F'],
  'F13': ['Fishing-line preparation', 'F'],
  'F14': ['Traditional fishing methods', 'F'],
  'F15': ['Boat construction', 'F'],
  'F16': ['Boat maintenance', 'F'],
  'F17': ['Boat repair', 'F'],
  'F18': ['Fish handling', 'F'],
  'F19': ['Fish grading', 'F'],
  'F20': ['Fish processing', 'F'],
  'C01': ['Seasonal Calendar Knowledge', 'C'],
  'C02': ['Wind-Direction Recognition', 'C'],
  'C03': ['Cloud Recognition', 'C'],
  'C04': ['Rainfall-Pattern Recognition', 'C'],
  'C05': ['Storm Recognition', 'C'],
  'C06': ['Drought Indicators', 'C'],
  'C07': ['Flood Indicators', 'C'],
  'C08': ['Coastal Weather Observation', 'C'],
  'C09': ['Sea-Condition Observation', 'C'],
  'C10': ['Star-Based Orientation', 'C'],
  'C11': ['Moon-Cycle Observation', 'C'],
  'C12': ['Sun-Based Orientation', 'C'],
  'C13': ['Landscape Navigation', 'C'],
  'C14': ['Animal Behavior Observation', 'C'],
  'C15': ['Bird Behavior Observation', 'C'],
  'C16': ['Insect/Environmental Indicators', 'C'],
  'C17': ['Vegetation Indicators', 'C'],
  'C18': ['Pasture-Condition Indicators', 'C'],
  'C19': ['Traditional Climate Memory', 'C'],
  'C20': ['Environmental Change Observation', 'C'],
  'H01': ['Aqal construction', 'H'],
  'H02': ['Aqal frame construction', 'H'],
  'H03': ['Aqal assembly', 'H'],
  'H04': ['Aqal disassembly', 'H'],
  'H05': ['Aqal transportation', 'H'],
  'H06': ['Local-material selection', 'H'],
  'H07': ['Natural ventilation', 'H'],
  'H08': ['Passive cooling', 'H'],
  'H09': ['Shade management', 'H'],
  'H10': ['Orientation of buildings', 'H'],
  'H11': ['Lightweight structures', 'H'],
  'H12': ['Portable structures', 'H'],
  'H13': ['Temporary shelter construction', 'H'],
  'H14': ['Traditional roofing', 'H'],
  'H15': ['Traditional flooring', 'H'],
  'H16': ['Local wall construction', 'H'],
  'H17': ['Natural insulation', 'H'],
  'H18': ['Wind management', 'H'],
  'H19': ['Heat management', 'H'],
  'H20': ['Repair of traditional structures', 'H'],
  'M01': ['Mat weaving', 'M'],
  'M02': ['Basket weaving', 'M'],
  'M03': ['Fibre preparation', 'M'],
  'M04': ['Rope making', 'M'],
  'M05': ['Cordage production', 'M'],
  'M06': ['Leather preparation', 'M'],
  'M07': ['Leather tanning', 'M'],
  'M08': ['Leatherworking', 'M'],
  'M09': ['Traditional textile production', 'M'],
  'M10': ['Traditional dyeing', 'M'],
  'M11': ['Pottery', 'M'],
  'M12': ['Clay preparation', 'M'],
  'M13': ['Traditional pottery firing', 'M'],
  'M14': ['Woodworking', 'M'],
  'M15': ['Traditional tool handles', 'M'],
  'M16': ['Furniture construction', 'M'],
  'M17': ['Household implements', 'M'],
  'M18': ['Traditional containers', 'M'],
  'M19': ['Decorative craftsmanship', 'M'],
  'M20': ['Craft-tool maintenance', 'M'],
  'R01': ['Hand-tool maintenance', 'R'],
  'R02': ['Tool sharpening', 'R'],
  'R03': ['Metalworking', 'R'],
  'R04': ['Blacksmithing', 'R'],
  'R05': ['Welding', 'R'],
  'R06': ['Basic machining', 'R'],
  'R07': ['Mechanical repair', 'R'],
  'R08': ['Engine repair', 'R'],
  'R09': ['Bicycle repair', 'R'],
  'R10': ['Motorcycle repair', 'R'],
  'R11': ['Vehicle repair', 'R'],
  'R12': ['Pump repair', 'R'],
  'R13': ['Generator repair', 'R'],
  'R14': ['Solar-system repair', 'R'],
  'R15': ['Electrical repair', 'R'],
  'R16': ['Refrigeration repair', 'R'],
  'R17': ['Fishing-engine repair', 'R'],
  'R18': ['Boat-engine maintenance', 'R'],
  'R19': ['Spare-part fabrication', 'R'],
  'R20': ['Material substitution', 'R'],
  'S01': ['Basic first-aid knowledge', 'S'],
  'S02': ['Wound cleaning', 'S'],
  'S03': ['Wound dressing', 'S'],
  'S04': ['Burn care', 'S'],
  'S05': ['Traditional bone setting', 'S'],
  'S06': ['Splinting/immobilization', 'S'],
  'S07': ['Therapeutic massage/bodywork', 'S'],
  'S08': ['Traditional maternal-care knowledge', 'S'],
  'S09': ['Newborn-care knowledge', 'S'],
  'S10': ['Breastfeeding knowledge', 'S'],
  'S11': ['Medicinal-plant identification', 'S'],
  'S12': ['Medicinal-plant preparation', 'S'],
  'S13': ['Traditional oral hygiene', 'S'],
  'S14': ['Traditional dental treatment', 'S'],
  'S15': ['Sanitation/latrine practices', 'S'],
  'S16': ['Handwashing/hygiene', 'S'],
  'S17': ['Household/community water disinfection', 'S'],
  'S18': ['Food hygiene', 'S'],
  'S19': ['Community disease recognition/isolation', 'S'],
  'S20': ['Emergency referral/community health navigation', 'S'],
  'T01': ['Local market knowledge', 'T'],
  'T02': ['Market-to-market trade networks', 'T'],
  'T03': ['Long-distance trade-route knowledge', 'T'],
  'T04': ['Caravan logistics', 'T'],
  'T05': ['Animal-based freight transport', 'T'],
  'T06': ['Livestock trekking to markets', 'T'],
  'T07': ['Coastal/maritime cargo movement', 'T'],
  'T08': ['Route planning/navigation', 'T'],
  'T09': ['Transport risk management', 'T'],
  'T10': ['Merchant trust/agency networks', 'T'],
  'T11': ['Barter/exchange systems', 'T'],
  'T12': ['Weights, measures & commercial standards', 'T'],
  'T13': ['Market-price information', 'T'],
  'T14': ['Market aggregation/brokerage', 'T'],
  'T15': ['Trade credit/merchant finance', 'T'],
  'T16': ['Hawala/value-transfer networks', 'T'],
  'T17': ['Mobile-money commerce', 'T'],
  'T18': ['Inventory/storage for trade', 'T'],
  'T19': ['Trade diversification/risk spreading', 'T'],
  'T20': ['Emergency supply routing', 'T'],
  'G01': ['Community decision-making', 'G'],
  'G02': ['Elders/community mediation', 'G'],
  'G03': ['Xeer/customary law knowledge', 'G'],
  'G04': ['Resource-sharing agreements', 'G'],
  'G05': ['Community water governance', 'G'],
  'G06': ['Pasture/grazing governance', 'G'],
  'G07': ['Collective security/self-protection', 'G'],
  'G08': ['Community mutual aid', 'G'],
  'G09': ['Community labor/mobilization', 'G'],
  'G10': ['Cooperative organization', 'G'],
  'G11': ['Knowledge-holder identification', 'G'],
  'G12': ['Apprenticeship', 'G'],
  'G13': ['Oral knowledge transmission', 'G'],
  'G14': ['Storytelling/proverb-based teaching', 'G'],
  'G15': ['Practical demonstration learning', 'G'],
  'G16': ['Community documentation', 'G'],
  'G17': ['Knowledge archiving', 'G'],
  'G18': ['Intergenerational knowledge transfer', 'G'],
  'G19': ['Crisis collective action', 'G'],
  'G20': ['Institutional memory/continuity', 'G'],
};

var FAMILIES = {
  'W': 'Water & Hydrology',
  'L': 'Pastoralism & Livestock',
  'A': 'Agriculture & Land',
  'P': 'Food Preservation & Processing',
  'F': 'Fisheries & Marine Knowledge',
  'C': 'Climate, Weather & Environmental Intelligence',
  'H': 'Shelter, Aqal & Climate-Adapted Architecture',
  'M': 'Crafts & Materials',
  'R': 'Repair, Engineering & Local Manufacturing',
  'S': 'Medicine, Hygiene & Human Survival',
  'T': 'Trade, Transport & Economic Self-Reliance',
  'G': 'Governance, Community Organization & Knowledge Transmission',
};

module.exports = function run() {
  H.loadCore();
  console.log('  inventory-integrity.test.js');

  SCA.store.wipe();
  SCA.store.init();

  var caps = SCA.store.all('capabilities');
  var fams = {};
  SCA.store.all('families').forEach(function (f) { fams[f.id] = f; });

  /* Count: exactly 240. */
  H.assertEq(caps.length, 240, 'exactly 240 capability records');

  /* Uniqueness: no duplicate codes. */
  var codes = caps.map(function (c) { return c.code; });
  H.assertEq(codes.length, Object.keys(CANONICAL).length, 'no unexpected extra records');
  H.assert(codes.every(function (c, i) { return codes.indexOf(c) === i; }), 'no duplicate codes');

  /* Codes, names, family mapping: exact match against the frozen table. */
  var byCode = {};
  caps.forEach(function (c) { byCode[c.code] = c; });
  Object.keys(CANONICAL).forEach(function (code) {
    var c = byCode[code];
    H.assert(!!c, 'record exists: ' + code);
    if (!c) { return; }
    H.assertEq(c.name, CANONICAL[code][0], 'name matches inventory: ' + code);
    var fam = fams[c.family_id];
    H.assert(!!fam, 'family resolves: ' + code);
    H.assertEq(fam.code, CANONICAL[code][1], 'family mapping correct: ' + code);
    H.assertEq(fam.name, FAMILIES[CANONICAL[code][1]], 'family name correct: ' + code);
  });
  H.assert(!byCode['CAP-T1'] && !byCode['W21'] && !byCode['X01'],
    'no fabricated codes beyond the inventory');

  /* Family counts: exactly 20 per family. */
  var perFam = {};
  caps.forEach(function (c) {
    var fc = fams[c.family_id].code;
    perFam[fc] = (perFam[fc] || 0) + 1;
  });
  Object.keys(FAMILIES).forEach(function (fc) {
    H.assertEq(perFam[fc], 20, '20 records in family ' + fc);
  });
  H.assertEq(Object.keys(perFam).length, 12, 'exactly 12 families hold records');

  /* Evidence defaults: every record is an unverified inventory record. */
  caps.forEach(function (c) {
    H.assertEq(c.evidence_level, 'E0', 'E0 default: ' + c.code);
    H.assertEq(c.verification_status, 'Unverified', 'Unverified default: ' + c.code);
    H.assertEq(c.historical_status, 'Not yet verified', 'historical status default: ' + c.code);
    H.assertEq(c.living_status, 'S0', 'living status S0 (Unknown): ' + c.code);
    H.assertEq(c.capability_maturity, null, 'maturity unknown: ' + c.code);
    H.assertEq(c.documentation_status, 'Inventory record only', 'documentation status: ' + c.code);
    H.assertEq(c.transmission_status, 'Not yet documented', 'transmission status: ' + c.code);
    H.assertEq(c.version, '1', 'version 1 baseline: ' + c.code);
    H.assertEq(c.action, null, 'no action assigned: ' + c.code);
    H.assertEq(c.priority_flags, [], 'no priority flags: ' + c.code);
    H.assertEq(c.criticality, null, 'no criticality ranking: ' + c.code);
    H.assertEq(c.centrality, null, 'no centrality ranking: ' + c.code);
    H.assertEq(c.graph_leverage, null, 'no graph leverage: ' + c.code);
    H.assertEq(c.irreplaceability, null, 'no irreplaceability ranking: ' + c.code);
    H.assertEq(c.preservation_urgency, null, 'no urgency ranking: ' + c.code);
  });

  /* No fabrication: empty research fields, no regions, no sources. */
  caps.forEach(function (c) {
    H.assertEq(c.regions, [], 'no invented regions: ' + c.code);
    H.assertEq(c.region, null, 'no invented region field: ' + c.code);
    H.assertEq(c.source_ids, [], 'no invented sources: ' + c.code);
    H.assertEq(c.practitioners, [], 'no invented practitioners: ' + c.code);
    H.assertEq(c.apprentices, [], 'no invented apprentices: ' + c.code);
    H.assertEq(c.knowledge_holders, [], 'no invented knowledge holders: ' + c.code);
    H.assertEq(c.dependencies, [], 'no invented dependencies: ' + c.code);
    H.assertEq(c.failure_scenarios, [], 'no invented failure scenarios: ' + c.code);
    H.assertEq(c.reviewer, null, 'no invented reviewer: ' + c.code);
  });
  H.assertEq(SCA.store.count('practitioners'), 0, 'no practitioner records in store');
  H.assertEq(SCA.store.count('evidence'), 0, 'no evidence/source records in store');

  /* Every record validates against the Stage 1 model. */
  caps.forEach(function (c) {
    var v = SCA.models.capability.validate(c);
    H.assert(v.valid === true, 'model-valid record: ' + c.code +
      (v.errors ? ' errors: ' + JSON.stringify(v.errors) : ''));
  });

  /* Persistence: records survive a reload. */
  SCA.store.init(); /* reload from storage, no re-seed */
  H.assertEq(SCA.store.count('capabilities'), 240, '240 records after reload');

  /* Export -> wipe -> import: 240 identical records. */
  var text = SCA.transfer.exportCollection('capabilities');
  var parsed = JSON.parse(text);
  H.assertEq(parsed.kind, 'collection', 'capabilities.json is a collection export');
  H.assertEq(parsed.records.length, 240, 'capabilities.json holds 240 records');
  var before = SCA.store.all('capabilities');
  SCA.store.wipe();
  var res = SCA.transfer.importBundle(text);
  H.assert(res.ok === true, 'import of capabilities.json succeeds');
  var after = SCA.store.all('capabilities');
  H.assertEq(after.length, 240, '240 records restored');
  var same = JSON.stringify(before) === JSON.stringify(after);
  H.assert(same, 'records identical after export -> wipe -> import');

  /* Restore the standard baseline before the full-bundle round trip. */
  SCA.store.wipe();
  SCA.store.init();
  H.assertEq(SCA.store.count('capabilities'), 240, 'baseline re-seeded');

  /* Full bundle export/import keeps the 240 plus families. */
  var bundleText = SCA.transfer.exportAll();
  SCA.store.wipe();
  var resB = SCA.transfer.importBundle(bundleText);
  H.assert(resB.ok === true, 'full bundle re-import succeeds');
  H.assertEq(SCA.store.count('capabilities'), 240, '240 after full-bundle round trip');
  H.assertEq(SCA.store.count('families'), 12, '12 families after full-bundle round trip');
  H.assert(JSON.parse(bundleText).collections.capabilities.every(function (c) {
    return c.evidence_level === 'E0' && c.verification_status === 'Unverified';
  }), 'export preserves evidence state');
  H.assert(bundleText.indexOf('password_hash') === -1, 'no credentials in export');
  H.assert(bundleText.indexOf('@') === -1 ||
    JSON.parse(bundleText).collections.users === undefined, 'no user data in export');

  /* Search behavior (pure matcher, same function the page uses). */
  var all = SCA.store.all('capabilities');
  var famByName = {};
  SCA.store.all('families').forEach(function (f) { famByName[f.id] = f; });
  function search(q) {
    return all.filter(function (c) {
      var f = famByName[c.family_id];
      return SCA.models.capability.matchesQuery(c, f.name, f.code, q);
    });
  }
  H.assertEq(search('W11').length, 1, 'search W11 -> exactly one record');
  H.assertEq(search('W11')[0].name, 'Rainwater harvesting', 'W11 is Rainwater harvesting');
  H.assertEq(search('rain').filter(function (c) {
    return c.code === 'W11'; }).length, 1, 'search rain -> finds W11');
  H.assertEq(search('Rainwater').length, 1, 'search by partial name works');
  H.assertEq(search('Water & Hydrology').length, 20,
    'search by family name -> all 20 family records');
  /* Note: a single-letter query like 'W' legitimately matches every record
     containing that letter (substring semantics); family-code searching is
     exercised through exact/partial codes below. */
  H.assertEq(search('E0').length, 240, 'search E0 -> all unverified records');
  H.assertEq(search('W1').length, 10, 'partial code W1 -> W10..W19 (10 records)');
  H.assertEq(search('zzzz-nothing').length, 0, 'nonsense query -> no results');

  /* Family filter behavior. */
  var famW = SCA.store.all('families').filter(function (f) { return f.code === 'W'; })[0];
  H.assertEq(all.filter(function (c) { return c.family_id === famW.id; }).length, 20,
    'family filter W -> 20 records');

  /* Clean up so later suites start from the standard baseline. */
  SCA.store.wipe();
  SCA.store.init();
};
