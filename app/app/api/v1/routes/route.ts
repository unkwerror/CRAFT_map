import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'
export async function GET() {
  if (!isFeatureEnabled('routes_enabled')) return NextResponse.json([])
  const rows = await pg`
    select r.id, r.slug, r.title, r.summary, r.cover_url as "coverUrl", r.theme, r.mode,
      r.estimated_duration_minutes as "estimatedDurationMinutes", r.distance_meters as "distanceMeters",
      r.difficulty, r.age_group as "ageGroup", r.accessibility_profile as "accessibilityProfile",
      r.offline_package_version as "offlinePackageVersion", count(rs.id)::int as "stopCount"
    from routes r left join route_stops rs on rs.route_id=r.id
    where r.status='published' group by r.id order by r.published_at desc nulls last, r.title`
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}

