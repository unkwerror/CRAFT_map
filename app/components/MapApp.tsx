'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MapView from './MapView'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import EventsPanel from './EventsPanel'
import MapModeNav from './MapModeNav'
import ObjectCard from './ObjectCard'
import MapPreloader from './MapPreloader'
import type { MapViewMode } from './MapModeNav'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
}

type FC = GeoJSON.FeatureCollection

const EVENT_OBJECT_HISTORY_KEY = 'craftEventObject'

function historyState(eventObject: boolean): Record<string, unknown> {
  const current = window.history.state
  const next = current && typeof current === 'object' ? { ...current } : {}
  if (eventObject) next[EVENT_OBJECT_HISTORY_KEY] = true
  else delete next[EVENT_OBJECT_HISTORY_KEY]
  return next
}

function isEventObjectHistoryEntry(): boolean {
  const state = window.history.state
  return Boolean(state && typeof state === 'object' && state[EVENT_OBJECT_HISTORY_KEY] === true)
}

export default function MapApp({ categories }: Props) {
  const searchParams = useSearchParams()

  const [objectsFC, setObjectsFC] = useState<FC | null>(null)
  const [districtsFC, setDistrictsFC] = useState<FC | null>(null)
  const [activeCats, setActiveCats] = useState<ReadonlySet<string>>(
    () => new Set(categories.map((c) => c.id))
  )
  const [activeDistrict, setActiveDistrict] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('object'))
  const [activeView, setActiveView] = useState<MapViewMode>(
    searchParams.get('view') === 'events' ? 'events' : 'map'
  )
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [fitDistrict, setFitDistrict] = useState<{ districtId: number; tick: number } | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [showPreloader, setShowPreloader] = useState(true)
  const [loadIssue, setLoadIssue] = useState(false)
  const [mapIssue, setMapIssue] = useState(false)

  const loadData = useCallback(async () => {
    setDataReady(false)
    setLoadIssue(false)
    const fetchGeoJson = async (url: string): Promise<FC> => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return response.json() as Promise<FC>
    }
    const [objectResult, districtResult] = await Promise.allSettled([
      fetchGeoJson('/api/objects'),
      fetchGeoJson('/api/districts'),
    ])
    if (objectResult.status === 'fulfilled') setObjectsFC(objectResult.value)
    else setObjectsFC({ type: 'FeatureCollection', features: [] })
    if (districtResult.status === 'fulfilled') setDistrictsFC(districtResult.value)
    else setDistrictsFC({ type: 'FeatureCollection', features: [] })
    setLoadIssue(objectResult.status === 'rejected' || districtResult.status === 'rejected')
    setDataReady(true)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if ((!mapReady && !mapIssue) || !dataReady) return
    const timer = window.setTimeout(() => setShowPreloader(false), 420)
    return () => window.clearTimeout(timer)
  }, [mapReady, mapIssue, dataReady])

  useEffect(() => {
    if (mapReady) return
    const timer = window.setTimeout(() => setMapIssue(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [mapReady])

  // URL сохраняет открытую вкладку и карточку, чтобы ссылкой можно было поделиться.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedId) url.searchParams.set('object', selectedId)
    else url.searchParams.delete('object')
    if (activeView === 'events') url.searchParams.set('view', 'events')
    else url.searchParams.delete('view')
    window.history.replaceState(window.history.state, '', url)
  }, [selectedId, activeView])

  useEffect(() => {
    const syncFromHistory = () => {
      const params = new URL(window.location.href).searchParams
      const objectId = params.get('object')
      setSelectedId(objectId)
      setActiveView(params.get('view') === 'events' ? 'events' : 'map')
    }
    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  const districtOptions = useMemo(
    () =>
      (districtsFC?.features ?? [])
        .map((f) => f.properties as { id: number; name: string })
        .filter(Boolean),
    [districtsFC]
  )

  // фильтрация на клиенте, без перезапросов
  const filteredFC = useMemo<FC | null>(() => {
    if (!objectsFC) return null
    return {
      type: 'FeatureCollection',
      features: objectsFC.features.filter((f) => {
        const p = f.properties as unknown as ObjectFeatureProps
        if (!activeCats.has(p.category)) return false
        if (activeDistrict !== null && p.district !== activeDistrict) return false
        return true
      }),
    }
  }, [objectsFC, activeCats, activeDistrict])

  useEffect(() => {
    if (!selectedId || !filteredFC) return
    const isStillVisible = filteredFC.features.some(
      (feature) => (feature.properties as unknown as ObjectFeatureProps).id === selectedId
    )
    if (!isStillVisible) setSelectedId(null)
  }, [selectedId, filteredFC])

  const selected = useMemo(() => {
    if (!selectedId || !objectsFC) return null
    const f = objectsFC.features.find(
      (ft) => (ft.properties as unknown as ObjectFeatureProps).id === selectedId
    )
    if (!f || f.geometry.type !== 'Point') return null
    const [lng, lat] = f.geometry.coordinates
    return { id: selectedId, lng: lng ?? 0, lat: lat ?? 0 }
  }, [selectedId, objectsFC])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const category of categories) counts[category.id] = 0
    for (const feature of objectsFC?.features ?? []) {
      const props = feature.properties as unknown as ObjectFeatureProps
      if (activeDistrict !== null && props.district !== activeDistrict) continue
      counts[props.category] = (counts[props.category] ?? 0) + 1
    }
    return counts
  }, [objectsFC, categories, activeDistrict])

  const selectDistrict = useCallback((id: number | null) => {
    setPreviewId(null)
    setActiveDistrict(id)
    if (id !== null) setFitDistrict((p) => ({ districtId: id, tick: (p?.tick ?? 0) + 1 }))
  }, [])

  // выбор из поиска: категория — единственный активный фильтр
  const pickCategory = useCallback((id: string) => {
    setPreviewId(null)
    setActiveCats(new Set([id]))
  }, [])

  const pickObject = useCallback((id: string) => {
    // Точечно ослабляем только конфликтующие фильтры, чтобы выбор не менял карту молча.
    const feature = objectsFC?.features.find(
      (item) => (item.properties as unknown as ObjectFeatureProps).id === id
    )
    const props = feature?.properties as unknown as ObjectFeatureProps | undefined
    if (props && !activeCats.has(props.category)) {
      setActiveCats((current) => new Set([...current, props.category]))
    }
    if (props && activeDistrict !== null && props.district !== activeDistrict) {
      setActiveDistrict(null)
    }
    setPreviewId(null)
    setSelectedId(id)
  }, [objectsFC, activeCats, activeDistrict])

  const pickEventObject = useCallback((id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'events')
    url.searchParams.set('object', id)
    window.history.pushState(historyState(true), '', url)
    pickObject(id)
  }, [pickObject])

  const activeDistrictName =
    activeDistrict === null
      ? null
      : (districtOptions.find((d) => d.id === activeDistrict)?.name ?? null)

  const showAllCategories = useCallback(() => {
    setPreviewId(null)
    setActiveCats(new Set(categories.map((category) => category.id)))
  }, [categories])

  const closeObject = useCallback(() => {
    if (activeView === 'events' && isEventObjectHistoryEntry()) {
      window.history.back()
      return
    }
    setSelectedId(null)
  }, [activeView])

  const changeView = useCallback((view: MapViewMode) => {
    setPreviewId(null)
    if (view === activeView) {
      if (selectedId && isEventObjectHistoryEntry()) {
        window.history.back()
      } else {
        setSelectedId(null)
      }
      return
    }
    setSelectedId(null)
    setActiveView(view)
    const url = new URL(window.location.href)
    url.searchParams.delete('object')
    if (view === 'events') url.searchParams.set('view', 'events')
    else url.searchParams.delete('view')
    window.history.pushState(historyState(false), '', url)
  }, [activeView, selectedId])

  const closeEvents = useCallback(() => {
    changeView('map')
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-map-mode-map]'))
        .find((element) => element.offsetParent !== null)
        ?.focus()
    })
  }, [changeView])

  return (
    <main className="map-shell relative h-dvh w-full overflow-hidden">
      <MapView
        categories={categories}
        objects={filteredFC}
        districts={districtsFC}
        selected={selected}
        highlightedId={previewId}
        activeDistrictId={activeDistrict}
        fitDistrict={fitDistrict}
        onSelect={setSelectedId}
        onReady={() => {
          setMapReady(true)
          setMapIssue(false)
        }}
        onError={() => setMapIssue(true)}
      />

      <header className={`map-toolbar pointer-events-none absolute inset-x-0 top-0 z-10 p-3 md:p-5 ${selectedId ? 'md:pr-[480px] xl:pr-[540px]' : activeView === 'events' ? 'xl:pr-[540px]' : ''}`}>
        <div className="mx-auto flex max-w-[1480px] items-start gap-3">
          <div className="brand-panel panel pointer-events-auto hidden h-14 w-[252px] shrink-0 items-center gap-3 rounded-2xl px-3.5 2xl:flex">
            <div className="brand-panel__crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gerb-tyumen.svg" alt="" className="h-8 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">Память Тюмени</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-subtle)]">Истории, сохранённые городом</p>
            </div>
          </div>

          <div className="pointer-events-auto min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1 md:max-w-[620px]">
                <SearchBar
                  objects={objectsFC}
                  categories={categories}
                  districts={districtOptions}
                  loading={!dataReady}
                  onPickObject={pickObject}
                  onPickCategory={pickCategory}
                  onPickDistrict={selectDistrict}
                  onPreviewObject={setPreviewId}
                />
              </div>
              <div className="hidden shrink-0 xl:block">
                <MapModeNav active={activeView} onChange={changeView} />
              </div>
            </div>
            {activeView === 'map' && (
              <CategoryChips
                categories={categories}
                activeCats={activeCats}
                activeDistrictName={activeDistrictName}
                counts={categoryCounts}
                visibleCount={filteredFC?.features.length ?? 0}
                onShowAll={showAllCategories}
                onToggleCat={(id) => {
                  setPreviewId(null)
                  setActiveCats((prev) => {
                    if (prev.size === categories.length) return new Set([id])
                    const nextSet = new Set(prev)
                    if (nextSet.has(id)) nextSet.delete(id)
                    else nextSet.add(id)
                    return nextSet
                  })
                }}
                onClearDistrict={() => selectDistrict(null)}
              />
            )}
          </div>
        </div>
      </header>

      <div
        data-map-mode-mobile
        className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[15] flex justify-center px-3 xl:hidden"
      >
        <MapModeNav
          active={activeView}
          onChange={changeView}
          className="pointer-events-auto w-full max-w-[360px]"
        />
      </div>

      {activeView === 'map' && (loadIssue || mapIssue) && !showPreloader && (
        <div className="map-issue-banner panel absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl" role="alert">
          <span className="text-[var(--ink-muted)]">{mapIssue ? 'Не удалось загрузить карту' : 'Часть данных не загрузилась'}</span>
          <button type="button" onClick={() => mapIssue ? window.location.reload() : void loadData()} className="font-semibold text-[var(--accent)]">
            Повторить
          </button>
        </div>
      )}

      {activeView === 'map' && activeCats.size === 0 && !showPreloader && (
        <div className="panel absolute left-1/2 top-1/2 z-10 w-[min(320px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold">Все категории скрыты</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
            Выберите категорию сверху или верните все объекты.
          </p>
          <button type="button" onClick={showAllCategories} className="btn-accent mt-4 min-h-11 rounded-xl px-4 text-sm">
            Показать все
          </button>
        </div>
      )}

      {activeView === 'events' && (
        <EventsPanel
          suspended={Boolean(selectedId)}
          onClose={closeEvents}
          onSelectObject={pickEventObject}
        />
      )}

      {selectedId && <ObjectCard id={selectedId} onClose={closeObject} />}

      {showPreloader && activeView === 'map' && !selectedId && (
        <MapPreloader
          progress={12 + (dataReady ? 44 : 0) + (mapReady || mapIssue ? 44 : 0)}
          label={!dataReady ? 'Загружаем объекты' : !mapReady && !mapIssue ? 'Настраиваем карту' : mapIssue ? 'Проверяем соединение' : 'Готово'}
          leaving={(mapReady || mapIssue) && dataReady}
        />
      )}
    </main>
  )
}
