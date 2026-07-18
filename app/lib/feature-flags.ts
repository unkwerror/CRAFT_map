export const FEATURE_FLAG_NAMES = [
  'routes_enabled',
  'route_gps_autoplay_enabled',
  'offline_packages_enabled',
  'knowledge_graph_enabled',
  'timeline_enabled',
  'qr_campaigns_enabled',
  'condition_registry_enabled',
  'community_archive_enabled',
  'education_enabled',
  'multilingual_enabled',
  'ai_guide_enabled',
  'partner_portal_enabled',
  'ar_enabled',
] as const

export type FeatureFlagName = typeof FEATURE_FLAG_NAMES[number]

export function parseFeatureFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1'
}

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return parseFeatureFlag(process.env[`FEATURE_${name.toUpperCase()}`])
}

