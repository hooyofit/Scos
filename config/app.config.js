/*
 * Application configuration, kept OUT of application code.
 * Edit this file to change names, colors, languages or feature flags.
 * No secrets belong here.
 */
(function (SCA) {
  'use strict';
  SCA.config = {
    name: 'Somali Capability Atlas',
    internal_name: 'SCOS — Somali Capability Operating System',
    tagline: 'Preserve Knowledge. Build Capability. Prepare the Future.',

    /* Local data layer */
    storage_prefix: 'sca',
    dataset_key: 'sca:dataset',
    session_key: 'sca:session',
    reset_token_key: 'sca:reset-tokens',

    /* Bilingual framework. 'so' is a placeholder: translations must be
       written and reviewed by Somali speakers in a later step (not fabricated). */
    default_language: 'en',
    languages: [
      { code: 'en', label: 'English', ready: true },
      { code: 'so', label: 'Soomaali', ready: false },
      { code: 'ar', label: 'Arabi (Arabic, can be added later)', ready: false }
    ],

    /* Visual direction: deep blue, earth/sand, white, limited green accents. */
    theme: {
      primary: '#1F3B57',
      accent: '#C8A96A',
      success: '#3E7A5E',
      background: '#F7F5F0',
      surface: '#FFFFFF',
      ink: '#22303C'
    },

    /* Which collections are exportable as JSON. 'users' is deliberately
       excluded for privacy: user accounts are never part of a data export. */
    export: {
      collections: ['families', 'capabilities', 'practitioners',
        'evidence', 'locations', 'apprentices', 'knowledge',
        'claims', 'consents', 'audit_log',
        'research_projects', 'research_sessions', 'observations', 'field_notes',
        'participants', 'field_media', 'research_queue',
        'organizations', 'apprenticeships', 'competence_assessments',
        'training_programs', 'capability_certifications',
        'census_methodologies', 'capability_censuses', 'census_observations',
        'census_snapshots', 'geographic_redundancies',
        'graph_edges', 'workshops', 'resources', 'materials', 'tools',
        'energy_sources', 'failure_scenarios',
        'repair_capabilities', 'spare_parts', 'repair_records',
        'recovery_profiles', 'capability_interventions',
        'pilot_projects', 'measurements', 'indicators',
        'marketplace_listings',
        'capability_reserves', 'continuity_plans',
        'capability_assets'],
      note: 'User accounts are excluded from exports by design (privacy).'
    },

    /* Application shell cache version. The service worker MUST carry the
       same version; the Build/Runtime Integrity Suite enforces this. */
    cache_version: 'sca-step13-v1',

    /* Stage 6 census: public aggregate views suppress small counts to
       protect individuals in small communities. Counts below the
       threshold display as Restricted. Architecture only - real
       statistical disclosure control comes later. */
    census: {
      privacy_threshold: 3
    },

    /* Feature flags: advanced systems arrive in later build steps. */
    features: {
      import_export: true,
      auth_local: true,
      evidence_archive: true,      /* Stage 3 */
      field_research: true,        /* Stage 4 */
      practitioner_framework: true, /* Stage 5 */
      capability_census: true,      /* Stage 6 */
      dependency_graph: false,      /* Step 8  */
      failure_simulation: false,   /* Step 9  */
      offline_field_sync: false,   /* Step 10 */
      workshops_repair: false,     /* Step 11 */
      marketplace: true,           /* Stage 13 (Capability Marketplace, frozen scope v1.0) */
      advanced_map: false,         /* Step 13 */
      dashboards: false,           /* Step 14 */
      pilot_management: false,     /* Step 15 */
      advanced_certification: false/* Step 16 */
    },

    /* Replaceable backend seam. Step 1 ships 'local' only; a hosted adapter
       (Base44, Supabase, own API, sync server) implements the same interfaces
       later without touching UI code. See docs/architecture.md. */
    data_provider: 'local',
    auth_provider: 'local'
  };
})(SCA);
