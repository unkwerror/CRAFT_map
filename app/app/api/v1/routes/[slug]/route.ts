import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { totalWalk, type RouteLeg } from '@/lib/route-legs'
import { ensureRouteLegs } from '@/lib/route-legs-server'
import type { PublicRouteStop } from '@/lib/routes'

type Params = { params: Promise<{ slug: string }> }

type StopRow = PublicRouteStop & { pathToNext: RouteLeg | null }

export async function GET(_req: Request, { params }: Params) {
  if (!isFeatureEnabled('routes_enabled')) {
    return NextResponse.json({ error: 'Маршруты недоступны' }, { status: 404 })
  }
  const { slug } = await params
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'Маршрут не найден' }, { status: 404 })
  }

  const [route] = await pg<Record<string, unknown>[]>`
    select id, slug, title, summary, description, cover_url as "coverUrl", theme, mode,
      estimated_duration_minutes as "estimatedDurationMinutes", distance_meters as "distanceMeters",
      difficulty, age_group as "ageGroup", accessibility_profile as "accessibilityProfile",
      offline_package_version as "offlinePackageVersion"
    from routes where slug = ${slug} and status = 'published'`
  if (!route) return NextResponse.json({ error: 'Маршрут не найден' }, { status: 404 })

  const stops = await pg<StopRow[]>`
    select rs.id, rs.object_id as "objectId", o.title, o.address,
      st_x(o.geom) as lng, st_y(o.geom) as lat, rs.position,
      rs.arrival_radius_meters as "arrivalRadiusMeters",
      rs.recommended_duration_minutes as "recommendedDurationMinutes",
      rs.intro_text as "introText", rs.directions_text as "directionsText",
      rs.path_to_next as "pathToNext",
      coalesce(sa.audio_url, fa.audio_url, o.audio_url) as "audioUrl",
      coalesce(sa.script_text, fa.script_text, o.audio_text) as "audioText",
      sa.audio_url as "shortAudioUrl", sa.script_text as "shortAudioText",
      fa.audio_url as "fullAudioUrl", fa.script_text as "fullAudioText"
    from route_stops rs
    join objects o on o.id = rs.object_id
    left join audio_variants sa on sa.id = rs.short_audio_variant_id
    left join audio_variants fa on fa.id = rs.full_audio_variant_id
    where rs.route_id = ${route.id as string} and o.published
    order by rs.position`

  const legs = await ensureRouteLegs(route.id as string, stops)
  const walk = totalWalk(legs)
  const payload = {
    ...route,
    stops: stops.map(({ pathToNext: _pathToNext, ...stop }) => stop),
    legs,
    walkSeconds: legs.length ? walk.seconds : null,
    walkMeters: legs.length ? walk.meters : null,
  }
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
