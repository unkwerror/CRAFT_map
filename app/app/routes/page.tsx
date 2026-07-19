import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

const title = 'Маршруты'
const description =
  'Готовые прогулки по памятным местам Тюмени: маршруты с остановками у памятников, описаниями и историями мест.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/routes' },
  openGraph: { type: 'website', locale: 'ru_RU', siteName: 'Память Тюмени', title, description, url: '/routes' },
}

interface RouteCardRow {
  slug: string
  title: string
  summary: string | null
  mode: string
  minutes: number | null
  distance: number | null
  difficulty: string | null
  cover: string | null
  stops: number
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

function formatKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} км`
}

export default async function RoutesPage() {
  if (!isFeatureEnabled('routes_enabled')) notFound()
  const routes = await pg<RouteCardRow[]>`
    select r.slug, r.title, r.summary, r.mode, r.estimated_duration_minutes as minutes,
      r.distance_meters as distance, r.difficulty,
      coalesce(r.cover_url, first_photo.thumb) as cover,
      count(rs.id)::int as stops
    from routes r
    left join route_stops rs on rs.route_id = r.id
    left join lateral (
      select o.photos->0->>'thumb' as thumb
      from route_stops rs2
      join objects o on o.id = rs2.object_id
      where rs2.route_id = r.id and jsonb_array_length(o.photos) > 0
      order by rs2.position
      limit 1
    ) first_photo on true
    where r.status = 'published'
    group by r.id, first_photo.thumb
    order by r.published_at desc nulls last, r.title`

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-8">
      <nav aria-label="Навигация">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← На карту</Link>
      </nav>

      <header className="mt-8">
        <p className="eyebrow">Прогулки по городу</p>
        <h1 className="mt-2 text-3xl font-semibold">Маршруты</h1>
        <p className="mt-3 max-w-xl leading-7 text-[var(--ink-muted)]">
          Готовые прогулки по памятным местам: выбирайте маршрут, слушайте аудиогид у каждой точки
          и отмечайте пройденное — прогресс сохраняется прямо в браузере.
        </p>
      </header>

      {routes.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-6 text-[var(--ink-muted)]">
          Опубликованных маршрутов пока нет — редакция готовит первые прогулки.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {routes.map((route) => (
            <li key={route.slug}>
              <Link
                href={`/routes/${route.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white/[0.03] transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
              >
                {route.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={route.cover} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                ) : (
                  <span aria-hidden className="grid aspect-[16/9] w-full place-items-center bg-[var(--surface-2)]">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="text-[var(--ink-subtle)]">
                      <path d="M5 19c4-1 3-5 7-6s6-3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 3.4" />
                      <circle cx="5" cy="19" r="2.2" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="18" cy="7" r="2.2" fill="currentColor" />
                    </svg>
                  </span>
                )}
                <span className="flex flex-1 flex-col p-5">
                  <h2 className="text-xl font-semibold transition-colors group-hover:text-[var(--accent)]">{route.title}</h2>
                  {route.summary && <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{route.summary}</p>}
                  <p className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-4 text-[13px] text-[var(--ink-subtle)]">
                    <span>{route.stops} {stopsWord(route.stops)}</span>
                    {route.minutes !== null && <span>· {route.minutes} мин</span>}
                    {route.distance !== null && route.distance > 0 && <span>· {formatKm(route.distance)}</span>}
                    {MODE_RU[route.mode] && <span>· {MODE_RU[route.mode]}</span>}
                    {route.difficulty && <span>· {route.difficulty}</span>}
                  </p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
