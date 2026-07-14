'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistance, haversineDistanceMeters } from '@/lib/geo'
import type { Coordinates } from '@/lib/geo'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'
import usePlaceProgress from './usePlaceProgress'

type SavedFilter = 'all' | 'favorites' | 'visited'
type SortMode = 'default' | 'distance'
type LocationStatus = 'idle' | 'loading' | 'ready' | 'error'

interface PlaceItem {
  id: string
  title: string
  address: string | null
  thumb: string
  categoryTitle: string
  categoryColor: string
  coordinates: Coordinates
  sourceIndex: number
}

interface Props {
  features: GeoJSON.Feature[]
  categories: CategoryDto[]
  loading: boolean
  searchQuery: string | null
  loadError: string | null
  onRetry: () => void
  onClose: () => void
  onSelectObject: (id: string) => void
}

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === 1) {
    return 'Доступ к геопозиции запрещён. Разрешите его в настройках браузера или используйте обычный порядок.'
  }
  if (error.code === 2) {
    return 'Не удалось определить местоположение. Проверьте геолокацию устройства и попробуйте ещё раз.'
  }
  if (error.code === 3) {
    return 'Определение местоположения заняло слишком много времени. Попробуйте ещё раз.'
  }
  return 'Не удалось определить местоположение. Список доступен в обычном порядке.'
}

export default function PlacesListPanel({
  features,
  categories,
  loading,
  searchQuery,
  loadError,
  onRetry,
  onClose,
  onSelectObject,
}: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const locationRequestRef = useRef(0)
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const [location, setLocation] = useState<Coordinates | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const { favoriteIds, visitedIds, toggleFavorite, toggleVisited } = usePlaceProgress()

  const items = useMemo<PlaceItem[]>(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const result: PlaceItem[] = []
    features.forEach((feature, sourceIndex) => {
      if (feature.geometry.type !== 'Point') return
      const props = feature.properties as unknown as ObjectFeatureProps
      const [lng, lat] = feature.geometry.coordinates
      if (!props?.id || !props.title || !Number.isFinite(lng) || !Number.isFinite(lat)) return
      const category = categoryById.get(props.category)
      result.push({
        id: props.id,
        title: props.title,
        address: props.address,
        thumb: props.thumb,
        categoryTitle: category?.title ?? 'Категория не указана',
        categoryColor: category?.color ?? '#9aa7b5',
        coordinates: { lng: lng ?? 0, lat: lat ?? 0 },
        sourceIndex,
      })
    })
    return result
  }, [features, categories])

  const counts = useMemo(() => ({
    all: items.length,
    favorites: items.filter((item) => favoriteIds.has(item.id)).length,
    visited: items.filter((item) => visitedIds.has(item.id)).length,
  }), [items, favoriteIds, visitedIds])

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (savedFilter === 'favorites') return favoriteIds.has(item.id)
      if (savedFilter === 'visited') return visitedIds.has(item.id)
      return true
    })
    const withDistance = filtered.map((item) => ({
      ...item,
      distance: location ? haversineDistanceMeters(location, item.coordinates) : null,
    }))
    if (sortMode !== 'distance' || !location) return withDistance
    return [...withDistance].sort(
      (left, right) =>
        (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY) ||
        left.sourceIndex - right.sourceIndex
    )
  }, [items, savedFilter, favoriteIds, visitedIds, location, sortMode])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    return () => previousFocus?.focus?.()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // На телефоне список заменяет карту, но оставляет доступной единую нижнюю навигацию.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    let restore: (() => void) | null = null
    const sync = () => {
      restore?.()
      restore = null
      if (!media.matches || !panelRef.current) return
      const panel = panelRef.current
      const shell = panel.closest('.map-shell')
      if (!shell) return
      const siblings = Array.from(shell.children).filter((element) => {
        const htmlElement = element as HTMLElement
        return (
          element !== panel &&
          !htmlElement.hasAttribute('data-map-mode-mobile')
        )
      }) as HTMLElement[]
      const previous = siblings.map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }))
      for (const element of siblings) {
        element.inert = true
        element.setAttribute('aria-hidden', 'true')
      }
      restore = () => {
        for (const item of previous) {
          item.element.inert = item.inert
          if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
          else item.element.setAttribute('aria-hidden', item.ariaHidden)
        }
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => {
      locationRequestRef.current += 1
      media.removeEventListener('change', sync)
      restore?.()
    }
  }, [])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationError('Этот браузер не поддерживает геолокацию. Список доступен в обычном порядке.')
      return
    }
    const requestId = locationRequestRef.current + 1
    locationRequestRef.current = requestId
    setLocationStatus('loading')
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locationRequestRef.current !== requestId) return
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationStatus('ready')
        setSortMode('distance')
      },
      (error) => {
        if (locationRequestRef.current !== requestId) return
        setLocationStatus('error')
        setLocationError(locationErrorMessage(error))
        setSortMode('default')
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }

  const filterOptions: Array<{ id: SavedFilter; label: string; count: number }> = [
    { id: 'all', label: 'Все', count: counts.all },
    { id: 'favorites', label: 'Избранное', count: counts.favorites },
    { id: 'visited', label: 'Посещено', count: counts.visited },
  ]

  return (
    <aside
      ref={panelRef}
      data-places-list-panel
      tabIndex={-1}
      aria-labelledby="places-list-title"
      className="places-list-panel map-side-panel-md panel-scroll absolute z-[12] overflow-y-auto outline-none max-md:inset-0 md:right-0 md:top-0 md:h-full md:border-l md:border-[var(--hairline)]"
    >
      <div className="places-list-panel__header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Памятные места</p>
            <h1 id="places-list-title" className="mt-1.5 text-[26px] font-[650] leading-tight tracking-[-0.015em]">
              Список мест
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
              {searchQuery
                ? `Все места по запросу «${searchQuery}».`
                : 'Учитывает выбранные категории и округ.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="places-list-panel__close grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label="Закрыть список и вернуться к карте"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="m5 5 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="places-list-filters mt-4" role="group" aria-label="Фильтр сохранённых мест">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSavedFilter(option.id)}
              aria-pressed={savedFilter === option.id}
              className={`places-list-filter ${savedFilter === option.id ? 'places-list-filter--active' : ''}`}
            >
              {option.label} <span>{option.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          {location ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Сортировка мест">
              <button
                type="button"
                onClick={() => setSortMode('default')}
                aria-pressed={sortMode === 'default'}
                className={`places-sort-button ${sortMode === 'default' ? 'places-sort-button--active' : ''}`}
              >
                Обычный порядок
              </button>
              <button
                type="button"
                onClick={() => setSortMode('distance')}
                aria-pressed={sortMode === 'distance'}
                className={`places-sort-button ${sortMode === 'distance' ? 'places-sort-button--active' : ''}`}
              >
                Сначала ближайшие
              </button>
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'loading'}
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label="Обновить местоположение"
              >
                ↻
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === 'loading'}
              className="places-nearby-button min-h-11 rounded-xl px-3.5 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-65"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              {locationStatus === 'loading' ? 'Определяем местоположение…' : 'Рядом со мной'}
            </button>
          )}
          {locationError && (
            <p className="mt-2 text-[12px] leading-relaxed text-amber-200" role="alert">
              {locationError}
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-[var(--ink-subtle)]" aria-live="polite">
          Показано: {visibleItems.length}
        </p>
      </div>

      <div className="places-list-panel__content">
        {!loading && loadError && (
          <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4" role="alert">
            <p className="text-[13px] leading-relaxed text-amber-100">{loadError}</p>
            <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl px-3 text-[13px] font-semibold text-[var(--accent)] hover:bg-white/[0.05]">
              Повторить загрузку
            </button>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--ink-muted)]" role="status">
            Загружаем памятные места…
          </div>
        )}

        {!loading && !loadError && visibleItems.length === 0 && (
          <div className="places-list-empty">
            <span aria-hidden>{savedFilter === 'favorites' ? '♡' : savedFilter === 'visited' ? '✓' : '⌕'}</span>
            <h2>
              {savedFilter === 'favorites'
                ? 'В избранном пока пусто'
                : savedFilter === 'visited'
                  ? 'Посещённых мест пока нет'
                  : 'По текущим фильтрам мест нет'}
            </h2>
            <p>
              {savedFilter === 'all'
                ? 'Вернитесь к карте и измените категории или округ.'
                : 'Отмечайте места в списке или карточке памятника.'}
            </p>
            {savedFilter !== 'all' && (
              <button type="button" onClick={() => setSavedFilter('all')} className="btn-accent mt-4 min-h-11 px-4 text-sm">
                Показать все
              </button>
            )}
          </div>
        )}

        {visibleItems.length > 0 && (
          <ul className="space-y-3" aria-label="Памятные места">
            {visibleItems.map((item) => {
              const favorite = favoriteIds.has(item.id)
              const visited = visitedIds.has(item.id)
              return (
                <li key={item.id}>
                  <article className="place-list-card">
                    <button
                      type="button"
                      onClick={() => onSelectObject(item.id)}
                      className="place-list-card__main"
                    >
                      <span className="place-list-card__media" aria-hidden>
                        {item.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumb} alt="" loading="lazy" />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.4" />
                            <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="place-list-card__category">
                          <span style={{ background: item.categoryColor }} aria-hidden />
                          {item.categoryTitle}
                        </span>
                        <strong className="place-list-card__title">{item.title}</strong>
                        <small className="place-list-card__address">{item.address || 'Адрес не указан'}</small>
                        {item.distance !== null && Number.isFinite(item.distance) && (
                          <small className="place-list-card__distance">{formatDistance(item.distance)}</small>
                        )}
                      </span>
                      <svg className="shrink-0 text-[var(--ink-subtle)]" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="place-list-card__actions">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        aria-pressed={favorite}
                        aria-label={`${favorite ? 'Убрать из избранного' : 'Добавить в избранное'}: ${item.title}`}
                        className={favorite ? 'place-list-card__action--active' : ''}
                      >
                        <span aria-hidden>{favorite ? '♥' : '♡'}</span>
                        {favorite ? 'В избранном' : 'В избранное'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisited(item.id)}
                        aria-pressed={visited}
                        aria-label={`${visited ? 'Снять отметку о посещении' : 'Отметить посещённым'}: ${item.title}`}
                        className={visited ? 'place-list-card__action--active' : ''}
                      >
                        <span aria-hidden>✓</span>
                        {visited ? 'Посещено' : 'Отметить посещённым'}
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
