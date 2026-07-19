import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import OfflineRoutePackage from '@/components/OfflineRoutePackage'
import RouteMap from '@/components/RouteMap'
import RouteWalk from '@/components/RouteWalk'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { formatWalkMinutes, totalWalk, type RouteLeg } from '@/lib/route-legs'
import { ensureRouteLegs } from '@/lib/route-legs-server'
import type { PublicRouteStop } from '@/lib/routes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

interface RouteRow {
  id: string
  title: string
  summary: string | null
  description: string | null
  minutes: number | null
  distance: number | null
  version: number
  mode: string
  difficulty: string | null
  accessibilityProfile: Record<string, string | number | boolean | null>
}

const MODE_RU: Record<string, string> = { walking: 'пешком', bicycle: 'на велосипеде', car: 'на автомобиле' }

function stopsWord(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'точек'
  if (mod10 === 1) return 'точка'
  if (mod10 >= 2 && mod10 <= 4) return 'точки'
  return 'точек'
}

const loadRoute = cache(async (slug: string): Promise<RouteRow | undefined> => {
  const [route] = await pg<RouteRow[]>`
    select id, title, summary, description, estimated_duration_minutes as minutes,
      distance_meters as distance, offline_package_version as version, mode, difficulty,
      accessibility_profile as "accessibilityProfile"
    from routes where slug = ${slug} and status = 'published'`
  return route
})

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isFeatureEnabled('routes_enabled')) return {}
  const { slug } = await params
  const route = await loadRoute(slug)
  if (!route) return {}
  const title = `${route.title} — маршрут по памятным местам Тюмени`
  const description = route.summary ?? 'Готовый пешеходный маршрут по памятным местам Тюмени с аудиогидом.'
  return {
    title,
    description,
    alternates: { canonical: `/routes/${slug}` },
    openGraph: { type: 'article', locale: 'ru_RU', siteName: 'Память Тюмени', title, description, url: `/routes/${slug}` },
  }
}

export default async function RoutePage({ params }: Params) {
  if (!isFeatureEnabled('routes_enabled')) notFound()
  const { slug } = await params
  const route = await loadRoute(slug)
  if (!route) notFound()

  const stops = await pg<(PublicRouteStop & { pathToNext: RouteLeg | null })[]>`
    select rs.id, rs.object_id as "objectId", o.title, o.address,
      st_x(o.geom) as lng, st_y(o.geom) as lat, rs.position,
      rs.arrival_radius_meters as "arrivalRadiusMeters",
      rs.recommended_duration_minutes as "recommendedDurationMinutes",
      rs.intro_text as "introText", rs.directions_text as "directionsText",
      rs.path_to_next as "pathToNext",
      o.photos->0->>'thumb' as thumb,
      coalesce(sa.audio_url, fa.audio_url, o.audio_url) as "audioUrl",
      coalesce(sa.script_text, fa.script_text, o.audio_text) as "audioText",
      sa.audio_url as "shortAudioUrl", sa.script_text as "shortAudioText",
      fa.audio_url as "fullAudioUrl", fa.script_text as "fullAudioText"
    from route_stops rs
    join objects o on o.id = rs.object_id
    left join audio_variants sa on sa.id = rs.short_audio_variant_id
    left join audio_variants fa on fa.id = rs.full_audio_variant_id
    where rs.route_id = ${route.id} and o.published
    order by rs.position`

  const access = Object.entries(route.accessibilityProfile ?? {})
    .filter(([, value]) => value !== null && value !== false && value !== '')
  const mapStops = stops.map((stop, index) => ({
    id: stop.id,
    title: stop.title,
    lat: stop.lat,
    lng: stop.lng,
    number: index + 1,
  }))
  const legs = await ensureRouteLegs(route.id, stops)
  const walk = totalWalk(legs)

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <nav aria-label="Навигация">
        <Link href="/routes" className="text-sm text-[var(--accent)] hover:underline">← Все маршруты</Link>
      </nav>

      <header className="mt-8">
        <p className="eyebrow">Маршрут{MODE_RU[route.mode] ? ` · ${MODE_RU[route.mode]}` : ''}</p>
        <h1 className="mt-2 text-3xl font-semibold">{route.title}</h1>
        {route.summary && <p className="mt-3 text-lg leading-7 text-[var(--ink-muted)]">{route.summary}</p>}
        <p className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium text-[var(--ink-muted)]">
          <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1.5">
            {stops.length} {stopsWord(stops.length)}
          </span>
          {route.minutes !== null && (
            <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1.5">{route.minutes} мин</span>
          )}
          {route.distance !== null && route.distance > 0 && (
            <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1.5">
              {(route.distance / 1000).toFixed(1).replace('.', ',')} км
            </span>
          )}
          {legs.length > 0 && (
            <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1.5">
              в пути {formatWalkMinutes(walk.seconds)}
            </span>
          )}
          {route.difficulty && (
            <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1.5">{route.difficulty}</span>
          )}
        </p>
        <a
          href={`/?route=${slug}&nav=1`}
          className="btn-accent mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m12 2 7 19-7-5-7 5 7-19Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Пойти по маршруту
        </a>
      </header>

      {stops.length > 0 && (
        <div className="mt-6">
          <RouteMap stops={mapStops} legs={legs} />
        </div>
      )}

      {access.length > 0 && (
        <section className="mt-5 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold">Доступность</h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
            {access.map(([key, value]) => (
              <li key={key}>{value === true ? key : `${key}: ${value}`}</li>
            ))}
          </ul>
        </section>
      )}

      {route.description && (
        <p className="mt-6 whitespace-pre-line leading-7 text-[var(--ink-muted)]">{route.description}</p>
      )}

      <section className="mt-10" aria-labelledby="route-stops-heading">
        <h2 id="route-stops-heading" className="text-xl font-semibold">Точки маршрута</h2>
        <ol className="mt-4 space-y-3">
          {stops.map((stop, index) => (
            <li key={stop.id}>
              <Link
                href={`/object/${stop.objectId}`}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-3 transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
              >
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[13px] font-bold text-[var(--accent-ink)]"
                >
                  {index + 1}
                </span>
                {stop.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stop.thumb} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold transition-colors group-hover:text-[var(--accent)]">{stop.title}</span>
                  {stop.address && <span className="mt-0.5 block truncate text-sm text-[var(--ink-subtle)]">{stop.address}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-label="Прохождение маршрута">
        <h2 className="text-xl font-semibold">Пройти маршрут</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          Отмечайте точки по мере прогулки — вручную или по GPS. Прогресс сохраняется в браузере,
          регистрация не нужна.
        </p>
        {isFeatureEnabled('offline_packages_enabled') && <OfflineRoutePackage slug={slug} version={route.version} />}
        <RouteWalk routeId={route.id} version={route.version} stops={stops} />
      </section>
    </main>
  )
}
