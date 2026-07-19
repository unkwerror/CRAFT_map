'use client'

import { useEffect, useState } from 'react'
import OfflineRoutePackage from './OfflineRoutePackage'
import RouteWalk from './RouteWalk'
import { formatWalkMinutes } from '@/lib/route-legs'
import type { PublicRoute } from '@/lib/routes'

export interface RouteListItem {
  slug: string
  title: string
  summary: string | null
  mode: string
  estimatedDurationMinutes: number | null
  distanceMeters: number | null
  difficulty: string | null
  stopCount: number
}

export interface RouteDetailState {
  slug: string
  status: 'loading' | 'ready' | 'error'
  data: PublicRoute | null
}

interface Props {
  suspended: boolean
  offlineEnabled: boolean
  selectedSlug: string | null
  detail: RouteDetailState | null
  /** Меняется после выхода из навигации — RouteWalk перечитывает гостевой прогресс. */
  walkKey?: number
  onSelectRoute: (slug: string | null) => void
  onRetryDetail: () => void
  onStartNavigation: () => void
  /** Свернуть окно, оставив маршрут на карте (мобильный просмотр). */
  onCollapse: () => void
  onClose: () => void
  onSelectObject: (id: string) => void
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

function routeStats(route: {
  stopCount?: number
  stops?: unknown[]
  estimatedDurationMinutes: number | null
  distanceMeters: number | null
  difficulty: string | null
  mode: string
}): string {
  const stops = route.stopCount ?? route.stops?.length ?? 0
  const parts = [`${stops} ${stopsWord(stops)}`]
  if (route.estimatedDurationMinutes) parts.push(`${route.estimatedDurationMinutes} мин`)
  if (route.distanceMeters) parts.push(`${(route.distanceMeters / 1000).toFixed(1).replace('.', ',')} км`)
  if (MODE_RU[route.mode]) parts.push(MODE_RU[route.mode]!)
  if (route.difficulty) parts.push(route.difficulty)
  return parts.join(' · ')
}

/** Окно «Маршруты» поверх карты: каталог, карточка маршрута и прохождение с аудиогидом. */
export default function RoutesPanel({
  suspended,
  offlineEnabled,
  selectedSlug,
  detail,
  walkKey = 0,
  onSelectRoute,
  onRetryDetail,
  onStartNavigation,
  onCollapse,
  onClose,
  onSelectObject,
}: Props) {
  const [routes, setRoutes] = useState<RouteListItem[] | null>(null)
  const [listError, setListError] = useState(false)
  const [listTick, setListTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setListError(false)
    fetch('/api/v1/routes', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<RouteListItem[]>
      })
      .then((rows) => {
        if (!cancelled) setRoutes(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setListError(true)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [listTick])

  const activeDetail = selectedSlug && detail && detail.slug === selectedSlug ? detail : null

  return (
    <section
      aria-label="Маршруты по памятным местам"
      className={`events-panel map-side-panel-xl panel-scroll absolute z-[12] overflow-y-auto outline-none max-xl:inset-0 xl:right-0 xl:top-0 xl:h-full xl:border-l xl:border-[var(--hairline)] ${suspended ? 'events-panel--suspended' : ''}`}
    >
      <div className="events-panel__header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Прогулки по городу</p>
            <h2 className="mt-1.5 text-[26px] font-[650] leading-tight tracking-[-0.015em] md:text-[29px]">
              Маршруты
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-muted)]">
              Выберите прогулку — точки и линия маршрута появятся на карте.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Свернуть маршруты и вернуться к карте"
            className="events-panel__close flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="events-panel__content">
        {!selectedSlug && (
          <>
            {routes === null && !listError && (
              <div className="space-y-3" aria-busy="true">
                <span role="status" className="sr-only">Загружаем маршруты</span>
                {[0, 1].map((index) => (
                  <div key={index} className="soft-pulse h-32 rounded-2xl border border-[var(--hairline)] bg-white/[0.04]" />
                ))}
              </div>
            )}
            {listError && (
              <div role="alert" className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5">
                <p className="font-medium">Не удалось загрузить маршруты</p>
                <button
                  type="button"
                  onClick={() => setListTick((tick) => tick + 1)}
                  className="btn-accent mt-3 min-h-11 rounded-xl px-4 text-sm"
                >
                  Повторить
                </button>
              </div>
            )}
            {routes !== null && !listError && routes.length === 0 && (
              <p className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5 text-[var(--ink-muted)]">
                Опубликованных маршрутов пока нет — редакция готовит первые прогулки.
              </p>
            )}
            {routes !== null && routes.length > 0 && (
              <ul className="space-y-3">
                {routes.map((route, index) => (
                  <li key={route.slug} className="fade-in-rise" style={{ animationDelay: `${Math.min(index * 60, 240)}ms` }}>
                    <button
                      type="button"
                      onClick={() => onSelectRoute(route.slug)}
                      className="group block w-full rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5 text-left transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-lg font-semibold leading-6 transition-colors group-hover:text-[var(--accent)]">
                          {route.title}
                        </span>
                        <span aria-hidden className="mt-0.5 text-[var(--ink-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">→</span>
                      </span>
                      {route.summary && (
                        <span className="mt-2 block text-sm leading-6 text-[var(--ink-muted)]">{route.summary}</span>
                      )}
                      <span className="mt-3 block text-[13px] text-[var(--ink-subtle)]">{routeStats(route)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {selectedSlug && (
          <div className="fade-in-rise">
            <button
              type="button"
              onClick={() => onSelectRoute(null)}
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              ← Все маршруты
            </button>

            {activeDetail?.status === 'loading' && (
              <div className="mt-5 space-y-3" aria-busy="true">
                <span role="status" className="sr-only">Загружаем маршрут</span>
                <div className="soft-pulse h-8 w-3/4 rounded-lg bg-white/[0.07]" />
                <div className="soft-pulse h-4 w-full rounded bg-white/[0.05]" />
                <div className="soft-pulse h-48 rounded-2xl border border-[var(--hairline)] bg-white/[0.04]" />
              </div>
            )}

            {activeDetail?.status === 'error' && (
              <div role="alert" className="mt-5 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5">
                <p className="font-medium">Не удалось загрузить маршрут</p>
                <button type="button" onClick={onRetryDetail} className="btn-accent mt-3 min-h-11 rounded-xl px-4 text-sm">
                  Повторить
                </button>
              </div>
            )}

            {activeDetail?.status === 'ready' && activeDetail.data && (
              <div className="mt-4">
                <h3 className="text-[22px] font-[650] leading-tight tracking-[-0.01em]">{activeDetail.data.title}</h3>
                <p className="mt-1.5 text-[13px] text-[var(--ink-subtle)]">
                  {routeStats(activeDetail.data)}
                  {typeof activeDetail.data.walkSeconds === 'number' && activeDetail.data.walkSeconds > 0 &&
                    ` · в пути ${formatWalkMinutes(activeDetail.data.walkSeconds)}`}
                </p>
                {activeDetail.data.summary && (
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{activeDetail.data.summary}</p>
                )}
                {activeDetail.data.description && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--ink-muted)]">
                    {activeDetail.data.description}
                  </p>
                )}

                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={onStartNavigation}
                    className="btn-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="m12 2 7 19-7-5-7 5 7-19Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                    Пойти по маршруту
                  </button>
                  <button
                    type="button"
                    onClick={onCollapse}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)] xl:hidden"
                  >
                    Показать на карте
                  </button>
                  <p className="text-xs leading-5 text-[var(--ink-subtle)]">
                    Навигация: расстояние до точки по GPS, отметки прихода и аудиогид прямо на карте.
                  </p>
                </div>

                <section className="mt-6" aria-label="Точки маршрута">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">
                    Точки маршрута
                  </h4>
                  <ol className="mt-3 space-y-2">
                    {activeDetail.data.stops.map((stop, index) => (
                      <li key={stop.id}>
                        <button
                          type="button"
                          onClick={() => onSelectObject(stop.objectId)}
                          className="group flex w-full items-center gap-3 rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3 text-left transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                        >
                          <span
                            aria-hidden
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-[var(--accent-ink)]"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">
                              {stop.title}
                            </span>
                            {stop.address && (
                              <span className="mt-0.5 block truncate text-xs text-[var(--ink-subtle)]">{stop.address}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-[var(--ink-subtle)]">
                    Точка на карте или в списке открывает карточку места.
                  </p>
                </section>

                {offlineEnabled && (
                  <OfflineRoutePackage slug={activeDetail.slug} version={activeDetail.data.offlinePackageVersion} />
                )}
                <RouteWalk
                  key={`walk-${activeDetail.slug}-${walkKey}`}
                  routeId={activeDetail.data.id}
                  version={activeDetail.data.offlinePackageVersion}
                  stops={activeDetail.data.stops}
                />

                <a
                  href={`/routes/${activeDetail.slug}`}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--hairline)] px-4 text-[13px] font-semibold text-[var(--ink-muted)] hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
                >
                  Страница маршрута для ссылки
                  <span aria-hidden>→</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
