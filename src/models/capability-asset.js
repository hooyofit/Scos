/*
 * CapabilityAsset model (Stage 14: National Capability Reserve
 * & Institutional Continuity, frozen scope v1.1 + Gate C
 * implementation authorization).
 *
 * A CapabilityAsset is ONE documented component required for
 * capability continuity: a person, knowledge, tool, equipment,
 * material, spare part, documentation, training, workshop,
 * institution, biological resource, energy source or fallback
 * capability. It is intentionally broader than physical
 * equipment, and it is deliberately a STANDALONE collection
 * (frozen §1 decision 1) — assets may be reused across continuity
 * structures, carry independent provenance and be validated and
 * transferred independently.
 *
 * FROZEN Stage 14 v1.1 rules made structural here:
 *  - asset_category comes from the frozen thirteen-value
 *    vocabulary (authorization §12). No free text.
 *  - reference_type + reference_id follow the established
 *    polymorphic-reference pattern (Stage 13 provider pattern).
 *    An asset REFERENCES an authoritative existing record; it
 *    NEVER duplicates practitioners, apprentices, knowledge,
 *    tools, materials, spare parts, workshops, organizations,
 *    training programs or capabilities (authorization §12).
 *  - BIOLOGICAL rule (frozen §13): where no authoritative
 *    biological record exists, the asset may be documented WITHOUT
 *    a reference ("Not yet documented" semantics) with descriptive
 *    notes retained. No new biological entity is ever created.
 *  - A reserve is composed of assets through reserve_id (HARD
 *    reference); an asset never manufactures its reserve.
 *  - NO scoring, ranking, quantity-value, condition-percentage or
 *    inventory-count quality fields (authorization §37). Notes are
 *    descriptive documentation, never a state of readiness.
 */
(function (SCA) {
  'use strict';
  var m = {
    collection: 'capability_assets',
    required: ['asset_category', 'reserve_id'],
    fields: {
      /* The reserve this asset belongs to (hard reference). */
      reserve_id: { type: 'string' },

      /* Frozen thirteen-value category vocabulary. */
      asset_category: { type: 'string', enum: 'asset_categories' },

      /* Polymorphic authoritative reference (Stage 13 provider
       * pattern). May be absent ONLY under the documented-only
       * biological rule (frozen §13). */
      reference_type: { type: 'string' },
      reference_id: { type: 'string' },

      /* Descriptive documentation. */
      notes: { type: 'string' },

      created_by: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      history: { type: 'array' }
    }
  };
  m.validate = function (record) { return SCA.validateFields(m, record); };

  /* Structural privacy pin (authorization §28). */
  m.CONTACT_FIELDS_PROHIBITED = ['phone', 'email', 'street_address',
    'address', 'contact', 'messaging_handle', 'whatsapp', 'telegram'];

  /* Structural boundary pins (authorization §3/§12/§37): an asset
   * is a documented reference, never an inventory valuation,
   * quality judgement or duplicate of the referenced record. */
  m.FORBIDDEN_FIELDS = ['score', 'ranking', 'rating', 'value',
    'monetary_value', 'price', 'condition_score', 'quality',
    'quantity_score', 'readiness', 'readiness_score', 'risk',
    'risk_score', 'probability', 'percentage', 'battery',
    'serial_number', 'owner_name'];

  /* The authoritative source mapping (frozen §7 of the Gate C
   * authorization): each category references EXISTING frozen
   * entities only. reference_type values are the collection keys.
   * EQUIPMENT resolves against Stage 8's authoritative technical
   * records where available (tools as the equipment-bearing
   * record type, plus workshops/materials/spare parts where the
   * documented equipment is one of those). BIOLOGICAL has NO
   * authoritative source entity and is documentation-only. */
  m.SOURCES = {
    HUMAN: ['practitioners', 'apprentices'],
    KNOWLEDGE: ['knowledge', 'evidence_sources'],
    TOOL: ['tools'],
    EQUIPMENT: ['tools', 'materials', 'spare_parts'],
    MATERIAL: ['materials'],
    SPARE_PART: ['spare_parts'],
    DOCUMENTATION: ['knowledge', 'evidence_sources'],
    TRAINING: ['training_programs'],
    WORKSHOP: ['workshops'],
    INSTITUTION: ['organizations'],
    BIOLOGICAL: [],
    ENERGY: ['energy_sources'],
    FALLBACK_CAPABILITY: ['capabilities']
  };

  /* Categories that may legitimately carry NO reference: only
   * BIOLOGICAL (frozen §13 documentation-only rule). Every other
   * category REQUIRES an authoritative reference that resolves. */
  m.DOCUMENTATION_ONLY = ['BIOLOGICAL'];

  SCA.models = SCA.models || {};
  SCA.models.capabilityAsset = m;
  SCA.models.capability_assets = m;
})(SCA);
