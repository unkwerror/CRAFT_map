'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AudioGuide from './AudioGuide'
import ShareButton from './ShareButton'
import { geofenceState, haversineMeters } from '@/lib/geofence'
import { markRouteStopReached, routeProgressKey, type GuestRouteProgress } from '@/lib/route-progress'
import type { PublicRoute, PublicRouteStop } from '@/lib/routes'

interface Props {
  route: PublicRoute
  onExit: () => void
  onOpenStop: (objectId: string) => void
  onPositionChange: (position: { lng: number; lat: number } | null) => void
  onActiveStopChange: (stopNumber: number | null) => void
  onFocusPoints: (points: [number, number][]) => void
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`
}

function firstUnreachedIndex(stops: PublicRouteStop[], reached: readonly string[]): number {
  const index = stops.findIndex((stop) => !reached.includes(stop.id))
  return index === -1 ? Math.max(0, stops.length - 1) : index
}

/** HUD режима навигации: текущая точка, живое расстояние, отметки прихода и аудиогид. */
export default function RouteNavigator({
  route,
  onExit,
  onOpenStop,
  onPositionChange,
  onActiveStopChange,
  onFocusPoints,
}: Props) {
  const stops = route.stops
  const initialProgress = useMemo<GuestRouteProgress>(() => ({
    routeId: route.id,
    routeVersion: route.offlinePackageVersion,
    reachedStopIds: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  }), [route.id, route.offlinePackageVersion])

  const [progress, setProgress] = useState(initialProgress)
  const [current, setCurrent] = useState(0)
  const [position, setPosition] = useState<{ lng: number; lat: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'watching' | 'denied' | 'unavailable'>('watching')
  const [announcement, setAnnouncement] = useState('')
  const [audioOpen, setAudioOpen] = useState(false)
  const [variant, setVariant] = useState<'short' | 'full'>('full')

  const watchRef = useRef<number | null>(null)
  const insideRef = useRef(false)
  const currentRef = useRef(0)
  const advanceTimerRef = useRef<number | null>(null)
  const focusedOnceRef = useRef(false)

  // Прогресс общий с окном маршрута: тот же localStorage-ключ.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(routeProgressKey(route.id))
      if (raw) {
        const saved = JSON.parse(raw) as GuestRouteProgress
        if (saved.routeVersion === route.offlinePackageVersion) {
          setProgress(saved)
          setCurrent(firstUnreachedIndex(stops, saved.reachedStopIds))
          return
        }
      }
    } catch { /* повреждённый прогресс игнорируем */ }
    setCurrent(0)
  }, [route.id, route.offlinePackageVersion, stops])

  const persist = useCallback((next: GuestRouteProgress) => {
    try {
      localStorage.setItem(routeProgressKey(route.id), JSON.stringify(next))
    } catch { /* приватный режим */ }
  }, [route.id])

  const reach = useCallback((stopId: string) => {
    setProgress((previous) => {
      const next = markRouteStopReached(previous, stopId, stops.length)
      persist(next)
      return next
    })
  }, [persist, stops.length])

  // Смена цели: гистерезис заново, объявление для скринридера, фокус карты на «я + цель».
  useEffect(() => {
    currentRef.current = current
    insideRef.current = false
    const stop = stops[current]
    if (!stop) return
    onActiveStopChange(current + 1)
    setVariant(stop.shortAudioUrl ? 'short' : 'full')
    const points: [number, number][] = position
      ? [[position.lng, position.lat], [stop.lng, stop.lat]]
      : [[stop.lng, stop.lat]]
    onFocusPoints(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, stops, onActiveStopChange])

  // GPS запускается сразу: нажатие «Пойти по маршруту» и есть согласие на навигацию.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (event) => {
        const nextPosition = { lng: event.coords.longitude, lat: event.coords.latitude }
        setPosition(nextPosition)
        onPositionChange(nextPosition)
        setGpsStatus('watching')
        if (!focusedOnceRef.current) {
          focusedOnceRef.current = true
          const stop = stops[currentRef.current]
          if (stop) onFocusPoints([[nextPosition.lng, nextPosition.lat], [stop.lng, stop.lat]])
        }
        const stop = stops[currentRef.current]
        if (!stop) return
        const distance = haversineMeters(
          { lat: nextPosition.lat, lng: nextPosition.lng },
          { lat: stop.lat, lng: stop.lng }
        )
        const inside = geofenceState(distance, stop.arrivalRadiusMeters, insideRef.current)
        if (inside && !insideRef.current) {
          insideRef.current = true
          reach(stop.id)
          setAnnouncement(`Вы у точки «${stop.title}» — отмечена`)
          if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current)
          advanceTimerRef.current = window.setTimeout(() => {
            advanceTimerRef.current = null
            setCurrent((index) => (index < stops.length - 1 ? index + 1 : index))
          }, 1400)
        } else if (!inside) {
          insideRef.current = false
        }
      },
      (error) => {
        setGpsStatus(error.code === 1 ? 'denied' : 'unavailable')
        setPosition(null)
        onPositionChange(null)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000 }
    )
    return () => {
      if (watchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current)
      }
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current)
      onPositionChange(null)
      onActiveStopChange(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id])

  const stop = stops[current]
  if (!stop) return null

  const reachedCount = progress.reachedStopIds.length
  const finished = Boolean(progress.completedAt) || (stops.length > 0 && reachedCount >= stops.length)
  const distance = position
    ? haversineMeters({ lat: position.lat, lng: position.lng }, { lat: stop.lat, lng: stop.lng })
    : null
  const isReached = progress.reachedStopIds.includes(stop.id)
  const hasVariants = Boolean(stop.shortAudioUrl && stop.fullAudioUrl)
  const audioUrl = variant === 'short' ? stop.shortAudioUrl ?? stop.audioUrl : stop.fullAudioUrl ?? stop.audioUrl
  const audioText = variant === 'short' ? stop.shortAudioText ?? stop.audioText : stop.fullAudioText ?? stop.audioText
  const walkedMinutes = progress.completedAt
    ? Math.max(1, Math.round((Date.parse(progress.completedAt) - Date.parse(progress.startedAt)) / 60000))
    : null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-[14] flex justify-center px-3 xl:bottom-6">
      <section
        aria-label="Навигация по маршруту"
        className="panel fade-in-rise pointer-events-auto w-full max-w-md rounded-2xl p-3.5"
      >
        <p aria-live="polite" className="sr-only">{announcement}</p>

        {finished ? (
          <div role="status">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-[650]">Маршрут пройден!</h2>
                <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                  {stops.length} точек{walkedMinutes ? ` · примерно ${walkedMinutes} мин в пути` : ''}. Спасибо за прогулку.
                </p>
              </div>
              <button
                type="button"
                onClick={onExit}
                aria-label="Завершить навигацию"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--ink-subtle)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ShareButton title="Я прошёл маршрут по памятным местам Тюмени" />
              <button type="button" onClick={onExit} className="btn-accent min-h-11 rounded-xl px-4 text-sm">
                Завершить
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">
                Точка {current + 1} из {stops.length} · пройдено {reachedCount}
              </p>
              <button
                type="button"
                onClick={onExit}
                aria-label="Завершить навигацию"
                className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--ink-subtle)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenStop(stop.objectId)}
              aria-label={`Подробнее о точке: ${stop.title}`}
              className="group -mx-1 mt-0.5 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-1 py-1 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold transition-colors group-hover:text-[var(--accent)]">
                  {stop.title}
                </span>
                <span className="mt-0.5 block text-[13px] text-[var(--ink-muted)]">
                  {isReached
                    ? 'Точка пройдена'
                    : distance !== null
                      ? `До точки ${formatDistance(distance)}`
                      : gpsStatus === 'denied'
                        ? 'GPS выключен — отмечайте вручную'
                        : gpsStatus === 'unavailable'
                          ? 'GPS недоступен — отмечайте вручную'
                          : 'Определяем местоположение…'}
                </span>
              </span>
              <svg className="ml-auto shrink-0 text-[var(--ink-subtle)] transition-colors group-hover:text-[var(--accent)]" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                disabled={current === 0}
                onClick={() => setCurrent((index) => Math.max(0, index - 1))}
                aria-label="Предыдущая точка"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => reach(stop.id)}
                disabled={isReached}
                className="btn-accent min-h-11 flex-1 rounded-xl px-3 text-sm disabled:opacity-60"
              >
                {isReached ? 'Отмечена ✓' : 'Я у объекта'}
              </button>
              <button
                type="button"
                disabled={current === stops.length - 1}
                onClick={() => setCurrent((index) => Math.min(stops.length - 1, index + 1))}
                aria-label="Следующая точка"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] disabled:opacity-40"
              >
                →
              </button>
            </div>

            {(audioUrl || audioText) && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setAudioOpen((open) => !open)}
                  aria-expanded={audioOpen}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-1 text-[13px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  Аудиогид точки
                  <span aria-hidden className={`transition-transform ${audioOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {audioOpen && (
                  <div className="fade-in-rise">
                    {hasVariants && (
                      <div className="mb-2 flex gap-2" role="group" aria-label="Версия рассказа">
                        <button
                          type="button"
                          onClick={() => setVariant('short')}
                          aria-pressed={variant === 'short'}
                          className={`min-h-10 rounded-lg px-3 text-[13px] ${variant === 'short' ? 'btn-accent' : 'border border-[var(--hairline)]'}`}
                        >
                          Коротко
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariant('full')}
                          aria-pressed={variant === 'full'}
                          className={`min-h-10 rounded-lg px-3 text-[13px] ${variant === 'full' ? 'btn-accent' : 'border border-[var(--hairline)]'}`}
                        >
                          Подробно
                        </button>
                      </div>
                    )}
                    <AudioGuide key={`${stop.id}-${variant}`} audioUrl={audioUrl} audioText={audioText} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
