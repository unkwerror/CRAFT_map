'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import EventsPanel from './EventsPanel'
import MapModeNav from './MapModeNav'
import ObjectCard from './ObjectCard'
import MapPreloader from './MapPreloader'
import PlacesListPanel from './PlacesListPanel'
import PlacesViewToggle from './PlacesViewToggle'
import type { MapViewMode } from './MapModeNav'
import type { PlacesView } from './PlacesViewToggle'
import { rankSearchMatch } from '@/lib/map-search'
import {
  decodeMapUrl,
  encodeMapUrl,
  type MapCameraState,
  type PublicMapUrlState,
  type PublicMapView,
} from '@/lib/public-map-url'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[var(--bg)]" role="status">
      <span className="sr-only">Загружаем интерактивную карту</span>
    </div>
  ),
})

interface Props {
  categories: CategoryDto[]
}

type FC = GeoJSON.FeatureCollection
type LoadFailure = 'timeout' | 'error' | null

interface DataFailures {
  objects: LoadFailure
  districts: LoadFailure
}

const DATA_REQUEST_TIMEOUT_MS = 10_000
const URL_REPLACE_DEBOUNCE_MS = 360

class DataRequestTimeoutError extends Error {}

async function fetchGeoJson(url: string): Promise<FC> {
  const controller = new AbortController()
  let timedOut = false
  const timer = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, DATA_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    const payload = await response.json() as FC
    return payload
  } catch (error) {
    if (timedOut) throw new DataRequestTimeoutError(`${url}: timeout`)
    throw error
  } finally {
    globalThis.clearTimeout(timer)
  }
}

function rejectedAsFailure(result: PromiseSettledResult<FC>): LoadFailure {
  if (result.status === 'fulfilled') return null
  return result.reason instanceof DataRequestTimeoutError ? 'timeout' : 'error'
}

function describeDataFailures(failures: DataFailures): string | null {
  if (failures.objects && failures.districts) {
    return failures.objects === 'timeout' || failures.districts === 'timeout'
      ? 'Не удалось вовремя загрузить памятные места и границы округов'
      : 'Не удалось загрузить памятные места и границы округов'
  }
  if (failures.objects) {
    return failures.objects === 'timeout'
      ? 'Памятные места загружаются слишком долго'
      : 'Не удалось загрузить памятные места'
  }
  if (failures.districts) {
    return failures.districts === 'timeout'
      ? 'Границы округов загружаются слишком долго — памятные места доступны'
      : 'Не удалось загрузить границы округов — памятные места доступны'
  }
  return null
}

function navigationHistoryState(): Record<string, unknown> {
  const current = window.history.state
  const next = current && typeof current === 'object' ? { ...current } : {}
  // Удаляем маркер старой логики возврата в афишу, если он остался в history.
  delete next.craftEventObject
  return next
}

function categoriesFromUrl(
  categoryIds: string[] | null,
  categories: CategoryDto[]
): ReadonlySet<string> {
  if (categoryIds === null) return new Set(categories.map((category) => category.id))
  if (categoryIds.length === 0) return new Set()
  const knownIds = new Set(categories.map((category) => category.id))
  const selected = categoryIds.filter((id) => knownIds.has(id))
  return new Set(selected.length ? selected : categories.map((category) => category.id))
}

function categoriesForUrl(
  activeCategories: ReadonlySet<string>,
  categories: CategoryDto[]
): string[] | null {
  const selected = categories
    .map((category) => category.id)
    .filter((id) => activeCategories.has(id))
  return selected.length === categories.length ? null : selected
}

function publicView(activeView: MapViewMode, placesView: PlacesView): PublicMapView {
  if (activeView === 'events') return 'events'
  return placesView === 'list' ? 'list' : 'map'
}

export default function MapApp({ categories }: Props) {
  const searchParams = useSearchParams()
  const [initialUrlState] = useState(() =>
    decodeMapUrl(new URLSearchParams(searchParams.toString()))
  )
  const initialView: PublicMapView = initialUrlState.objectId
    ? 'map'
    : initialUrlState.view
  const initialActiveCats = categoriesFromUrl(initialUrlState.categoryIds, categories)

  const [objectsFC, setObjectsFC] = useState<FC | null>(null)
  const [districtsFC, setDistrictsFC] = useState<FC | null>(null)
  const [activeCats, setActiveCats] = useState<ReadonlySet<string>>(
    () => initialActiveCats
  )
  const [activeDistrict, setActiveDistrict] = useState<number | null>(initialUrlState.districtId)
  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.objectId)
  const [activeView, setActiveView] = useState<MapViewMode>(
    initialView === 'events' ? 'events' : 'map'
  )
  const [eventsMounted, setEventsMounted] = useState(initialView === 'events')
  const [placesView, setPlacesView] = useState<PlacesView>(initialView === 'list' ? 'list' : 'map')
  const [searchQuery, setSearchQuery] = useState(initialUrlState.searchQuery ?? '')
  const [camera, setCamera] = useState<MapCameraState>({
    center: initialUrlState.center,
    zoom: initialUrlState.zoom,
    bearing: initialUrlState.bearing,
    pitch: initialUrlState.pitch,
  })
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [fitDistrict, setFitDistrict] = useState<{ districtId: number; tick: number } | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [showPreloader, setShowPreloader] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataFailures, setDataFailures] = useState<DataFailures>({
    objects: null,
    districts: null,
  })
  const [mapIssue, setMapIssue] = useState(false)
  const urlStateRef = useRef<PublicMapUrlState>({
    ...initialUrlState,
    view: initialView,
    categoryIds: categoriesForUrl(initialActiveCats, categories),
  })
  const replaceTimerRef = useRef<number | null>(null)

  const writeUrlState = useCallback((
    state: PublicMapUrlState,
    mode: 'push' | 'replace'
  ) => {
    const url = new URL(window.location.href)
    url.search = encodeMapUrl(url.searchParams, state).toString()
    if (mode === 'push' && url.href === window.location.href) return
    const method = mode === 'push' ? 'pushState' : 'replaceState'
    window.history[method](navigationHistoryState(), '', url)
  }, [])

  const cancelScheduledReplace = useCallback(() => {
    if (replaceTimerRef.current === null) return
    window.clearTimeout(replaceTimerRef.current)
    replaceTimerRef.current = null
  }, [])

  const flushScheduledReplace = useCallback(() => {
    if (replaceTimerRef.current === null) return
    cancelScheduledReplace()
    writeUrlState(urlStateRef.current, 'replace')
  }, [cancelScheduledReplace, writeUrlState])

  const scheduleUrlReplace = useCallback(() => {
    cancelScheduledReplace()
    replaceTimerRef.current = window.setTimeout(() => {
      replaceTimerRef.current = null
      writeUrlState(urlStateRef.current, 'replace')
    }, URL_REPLACE_DEBOUNCE_MS)
  }, [cancelScheduledReplace, writeUrlState])

  const pushUrlState = useCallback((patch: Partial<PublicMapUrlState>) => {
    // Сначала сохраняем завершившиеся ввод/перемещение в текущей записи,
    // затем создаём отдельную точку Back для дискретного действия.
    flushScheduledReplace()
    const nextState: PublicMapUrlState = { ...urlStateRef.current, ...patch }
    if (nextState.objectId) nextState.view = 'map'
    urlStateRef.current = nextState
    writeUrlState(nextState, 'push')
  }, [flushScheduledReplace, writeUrlState])

  const loadData = useCallback(async () => {
    setDataReady(false)
    setDataLoading(true)
    const [objectResult, districtResult] = await Promise.allSettled([
      fetchGeoJson('/api/objects'),
      fetchGeoJson('/api/districts'),
    ])
    if (objectResult.status === 'fulfilled') setObjectsFC(objectResult.value)
    else setObjectsFC((current) => current ?? { type: 'FeatureCollection', features: [] })
    if (districtResult.status === 'fulfilled') setDistrictsFC(districtResult.value)
    else setDistrictsFC((current) => current ?? { type: 'FeatureCollection', features: [] })
    setDataFailures({
      objects: rejectedAsFailure(objectResult),
      districts: rejectedAsFailure(districtResult),
    })
    setDataReady(true)
    setDataLoading(false)
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

  // Канонизируем только принадлежащие карте параметры, не стирая UTM и feature flags.
  useEffect(() => {
    writeUrlState(urlStateRef.current, 'replace')
    return cancelScheduledReplace
  }, [cancelScheduledReplace, writeUrlState])

  useEffect(() => {
    const syncFromHistory = () => {
      cancelScheduledReplace()
      const decoded = decodeMapUrl(new URL(window.location.href).searchParams)
      const nextView: PublicMapView = decoded.objectId ? 'map' : decoded.view
      const nextCategories = categoriesFromUrl(decoded.categoryIds, categories)
      urlStateRef.current = {
        ...decoded,
        view: nextView,
        categoryIds: categoriesForUrl(nextCategories, categories),
      }
      setPreviewId(null)
      setFitDistrict(null)
      setSelectedId(decoded.objectId)
      if (nextView === 'events') setEventsMounted(true)
      setActiveView(nextView === 'events' ? 'events' : 'map')
      setPlacesView(nextView === 'list' ? 'list' : 'map')
      setActiveCats(nextCategories)
      setActiveDistrict(decoded.districtId)
      setSearchQuery(decoded.searchQuery ?? '')
      setCamera({
        center: decoded.center,
        zoom: decoded.zoom,
        bearing: decoded.bearing,
        pitch: decoded.pitch,
      })
    }
    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [cancelScheduledReplace, categories])

  const districtOptions = useMemo(
    () =>
      (districtsFC?.features ?? [])
        .map((f) => f.properties as { id: number; name: string })
        .filter(Boolean),
    [districtsFC]
  )

  // Удалённый/переименованный округ из старой ссылки не должен давать пустую карту.
  useEffect(() => {
    if (activeDistrict === null || !districtsFC || dataFailures.districts) return
    if (districtOptions.some((district) => district.id === activeDistrict)) return
    setActiveDistrict(null)
    urlStateRef.current = { ...urlStateRef.current, districtId: null }
    scheduleUrlReplace()
  }, [activeDistrict, dataFailures.districts, districtOptions, districtsFC, scheduleUrlReplace])

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

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  const districtById = useMemo(
    () => new Map(districtOptions.map((district) => [district.id, district])),
    [districtOptions]
  )

  const listFeatures = useMemo(() => {
    const features = filteredFC?.features ?? []
    const query = placesView === 'list' ? searchQuery.trim() : ''
    if (query.length < 2) return features
    return features.filter((feature) => {
      const props = feature.properties as unknown as ObjectFeatureProps
      const category = categoryById.get(props.category)
      const district = props.district === null ? undefined : districtById.get(props.district)
      return rankSearchMatch(query, {
        title: props.title,
        address: props.address,
        category: category?.title,
        district: district ? `${district.name} округ` : null,
      }) !== null
    })
  }, [filteredFC, placesView, searchQuery, categoryById, districtById])

  useEffect(() => {
    if (!selectedId || !filteredFC) return
    const isStillVisible = filteredFC.features.some(
      (feature) => (feature.properties as unknown as ObjectFeatureProps).id === selectedId
    )
    if (!isStillVisible) {
      setSelectedId(null)
      urlStateRef.current = { ...urlStateRef.current, objectId: null }
      scheduleUrlReplace()
    }
  }, [selectedId, filteredFC, scheduleUrlReplace])

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

  const selectedAfterFilters = useCallback((
    categoryIds: ReadonlySet<string>,
    districtId: number | null
  ): string | null => {
    if (!selectedId) return null
    const feature = objectsFC?.features.find(
      (item) => (item.properties as unknown as ObjectFeatureProps).id === selectedId
    )
    const props = feature?.properties as unknown as ObjectFeatureProps | undefined
    if (!props || !categoryIds.has(props.category)) return null
    if (districtId !== null && props.district !== districtId) return null
    return selectedId
  }, [objectsFC, selectedId])

  const changeSearchQuery = useCallback((query: string) => {
    setSearchQuery(query)
    urlStateRef.current = {
      ...urlStateRef.current,
      searchQuery: query.trim() || null,
    }
    scheduleUrlReplace()
  }, [scheduleUrlReplace])

  const handleCameraChange = useCallback((nextCamera: MapCameraState) => {
    setCamera(nextCamera)
    urlStateRef.current = { ...urlStateRef.current, ...nextCamera }
    scheduleUrlReplace()
  }, [scheduleUrlReplace])

  const selectDistrict = useCallback((id: number | null) => {
    const nextSelectedId = selectedAfterFilters(activeCats, id)
    setPreviewId(null)
    setSelectedId(nextSelectedId)
    setActiveView('map')
    setPlacesView('map')
    setActiveDistrict(id)
    if (id !== null) setFitDistrict((p) => ({ districtId: id, tick: (p?.tick ?? 0) + 1 }))
    pushUrlState({
      view: 'map',
      objectId: nextSelectedId,
      districtId: id,
    })
  }, [activeCats, pushUrlState, selectedAfterFilters])

  // выбор из поиска: категория — единственный активный фильтр
  const pickCategory = useCallback((id: string) => {
    const nextCategories = new Set([id])
    const nextSelectedId = selectedAfterFilters(nextCategories, activeDistrict)
    setPreviewId(null)
    setSelectedId(nextSelectedId)
    setActiveView('map')
    setPlacesView('map')
    setActiveCats(nextCategories)
    pushUrlState({
      view: 'map',
      objectId: nextSelectedId,
      categoryIds: categoriesForUrl(nextCategories, categories),
    })
  }, [activeDistrict, categories, pushUrlState, selectedAfterFilters])

  const pickObject = useCallback((id: string) => {
    // Точечно ослабляем только конфликтующие фильтры, чтобы выбор не менял карту молча.
    const feature = objectsFC?.features.find(
      (item) => (item.properties as unknown as ObjectFeatureProps).id === id
    )
    const props = feature?.properties as unknown as ObjectFeatureProps | undefined
    let nextCategories = activeCats
    if (props && !activeCats.has(props.category)) {
      nextCategories = new Set([...activeCats, props.category])
      setActiveCats(nextCategories)
    }
    let nextDistrict = activeDistrict
    if (props && activeDistrict !== null && props.district !== activeDistrict) {
      nextDistrict = null
      setActiveDistrict(null)
    }
    setPreviewId(null)
    setActiveView('map')
    setPlacesView('map')
    setSelectedId(id)
    pushUrlState({
      view: 'map',
      objectId: id,
      categoryIds: categoriesForUrl(nextCategories, categories),
      districtId: nextDistrict,
    })
  }, [objectsFC, activeCats, activeDistrict, categories, pushUrlState])

  const pickEventObject = useCallback((id: string) => {
    pickObject(id)
  }, [pickObject])

  const activeDistrictName =
    activeDistrict === null
      ? null
      : (districtOptions.find((d) => d.id === activeDistrict)?.name ?? null)

  const showAllCategories = useCallback(() => {
    const nextCategories = new Set(categories.map((category) => category.id))
    const nextSelectedId = selectedAfterFilters(nextCategories, activeDistrict)
    setPreviewId(null)
    setSelectedId(nextSelectedId)
    setActiveCats(nextCategories)
    pushUrlState({ objectId: nextSelectedId, categoryIds: null })
  }, [activeDistrict, categories, pushUrlState, selectedAfterFilters])

  const resetFilters = useCallback(() => {
    const nextCategories = new Set(categories.map((category) => category.id))
    const nextSelectedId = selectedAfterFilters(nextCategories, null)
    setPreviewId(null)
    setSelectedId(nextSelectedId)
    setActiveCats(nextCategories)
    setActiveDistrict(null)
    pushUrlState({
      objectId: nextSelectedId,
      categoryIds: null,
      districtId: null,
    })
  }, [categories, pushUrlState, selectedAfterFilters])

  const toggleCategory = useCallback((id: string) => {
    const nextCategories = activeCats.size === categories.length
      ? new Set([id])
      : new Set(activeCats)
    if (activeCats.size !== categories.length) {
      if (nextCategories.has(id)) nextCategories.delete(id)
      else nextCategories.add(id)
    }
    const nextSelectedId = selectedAfterFilters(nextCategories, activeDistrict)
    setPreviewId(null)
    setSelectedId(nextSelectedId)
    setActiveCats(nextCategories)
    pushUrlState({
      objectId: nextSelectedId,
      categoryIds: categoriesForUrl(nextCategories, categories),
    })
  }, [activeCats, activeDistrict, categories, pushUrlState, selectedAfterFilters])

  const allCategoriesActive = activeCats.size === categories.length
  const hasCategoryFilter = !allCategoriesActive
  const hasDistrictFilter = activeDistrict !== null
  const dataFailureMessage = describeDataFailures(dataFailures)
  const listLoadError = dataFailures.objects === 'timeout'
    ? 'Памятные места загружаются слишком долго. Проверьте соединение и попробуйте ещё раз.'
    : dataFailures.objects === 'error'
      ? 'Не удалось загрузить памятные места. Проверьте соединение и попробуйте ещё раз.'
      : null
  const issueMessage = mapIssue
    ? dataFailureMessage
      ? `Не удалось загрузить карту. ${dataFailureMessage}`
      : 'Не удалось загрузить карту'
    : dataFailureMessage
  const hasLoadedObjects = (objectsFC?.features.length ?? 0) > 0
  const noFilterResults = Boolean(
    dataReady &&
    !dataFailures.objects &&
    hasLoadedObjects &&
    filteredFC?.features.length === 0 &&
    (hasCategoryFilter || hasDistrictFilter)
  )
  const catalogIsEmpty = Boolean(
    dataReady &&
    !dataFailures.objects &&
    objectsFC &&
    objectsFC.features.length === 0 &&
    !hasCategoryFilter &&
    !hasDistrictFilter
  )
  const selectedCategoryName = activeCats.size === 1
    ? categories.find((category) => activeCats.has(category.id))?.title
    : null
  const noResultsDescription = activeCats.size === 0
    ? 'Вы скрыли все категории. Верните категории или сбросьте все фильтры.'
    : hasDistrictFilter && hasCategoryFilter
      ? `В округе «${activeDistrictName ?? 'выбранном'}» по ${selectedCategoryName ? `категории «${selectedCategoryName}»` : 'выбранным категориям'} объектов пока нет.`
      : hasDistrictFilter
        ? `В округе «${activeDistrictName ?? 'выбранном'}» объектов пока нет.`
        : selectedCategoryName
          ? `В категории «${selectedCategoryName}» объектов пока нет.`
          : 'По выбранным категориям объектов пока нет.'

  const closeObject = useCallback(() => {
    if (!selectedId) return
    setSelectedId(null)
    setActiveView('map')
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null })
  }, [pushUrlState, selectedId])

  const changePlacesView = useCallback((view: PlacesView) => {
    if (activeView === 'map' && placesView === view && !selectedId) return
    setPreviewId(null)
    setSelectedId(null)
    setActiveView('map')
    setPlacesView(view)
    pushUrlState({ view, objectId: null })
  }, [activeView, placesView, pushUrlState, selectedId])

  const closePlacesList = useCallback(() => {
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null })
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-places-view-map]')?.focus()
    })
  }, [pushUrlState])

  const showAllSearchResults = useCallback((ids: string[], query: string) => {
    if (!ids.length) return
    setPreviewId(null)
    setSelectedId(null)
    setActiveView('map')
    setActiveCats(new Set(categories.map((category) => category.id)))
    setActiveDistrict(null)
    setSearchQuery(query)
    setPlacesView('list')
    pushUrlState({
      view: 'list',
      objectId: null,
      categoryIds: null,
      districtId: null,
      searchQuery: query,
    })
  }, [categories, pushUrlState])

  const changeView = useCallback((view: MapViewMode) => {
    const nextView: PublicMapView = view === 'events' ? 'events' : 'map'
    const changed = publicView(activeView, placesView) !== nextView || selectedId !== null
    if (!changed) return
    setPreviewId(null)
    setPlacesView('map')
    setSelectedId(null)
    if (view === 'events') setEventsMounted(true)
    setActiveView(view)
    pushUrlState({ view: nextView, objectId: null })
  }, [activeView, placesView, pushUrlState, selectedId])

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
      <h1 className="sr-only">Карта памятных мест Тюмени</h1>
      <MapView
        categories={categories}
        objects={filteredFC}
        districts={districtsFC}
        selected={selected}
        highlightedId={previewId}
        activeDistrictId={activeDistrict}
        fitDistrict={fitDistrict}
        camera={camera}
        onSelect={(id) => {
          if (id) pickObject(id)
          else closeObject()
        }}
        onCameraChange={handleCameraChange}
        onReady={() => {
          setMapReady(true)
          setMapIssue(false)
        }}
        onError={() => setMapIssue(true)}
      />

      <header className={`map-toolbar pointer-events-none absolute inset-x-0 top-0 z-10 p-3 md:p-5 ${selectedId || (activeView === 'map' && placesView === 'list') ? 'md:pr-[480px] xl:pr-[540px]' : activeView === 'events' ? 'xl:pr-[540px]' : ''}`}>
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
                  loading={dataLoading}
                  query={searchQuery}
                  onQueryChange={changeSearchQuery}
                  onPickObject={pickObject}
                  onPickCategory={pickCategory}
                  onPickDistrict={selectDistrict}
                  onShowAllObjects={showAllSearchResults}
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
                onToggleCat={toggleCategory}
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

      {activeView === 'map' && !showPreloader && !selectedId && (
        <PlacesViewToggle active={placesView} onChange={changePlacesView} />
      )}

      {activeView === 'map' && placesView === 'map' && issueMessage && !showPreloader && (
        <div className="map-issue-banner panel absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl" role="alert">
          <span className="text-[var(--ink-muted)]">
            {dataLoading && !mapIssue ? 'Повторно загружаем данные…' : issueMessage}
          </span>
          <button
            type="button"
            onClick={() => mapIssue ? window.location.reload() : void loadData()}
            disabled={dataLoading && !mapIssue}
            className="shrink-0 font-semibold text-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            {dataLoading && !mapIssue ? 'Загрузка…' : 'Повторить'}
          </button>
        </div>
      )}

      {activeView === 'map' && placesView === 'map' && noFilterResults && !showPreloader && !mapIssue && (
        <div className="panel absolute left-1/2 top-1/2 z-10 w-[min(380px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center">
          <p className="text-base font-semibold">По этим фильтрам ничего не найдено</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {noResultsDescription}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {hasCategoryFilter && hasDistrictFilter && (
              <button type="button" onClick={resetFilters} className="btn-accent min-h-11 rounded-xl px-4 text-sm">
                Сбросить всё
              </button>
            )}
            {hasCategoryFilter && (
              <button type="button" onClick={showAllCategories} className="btn-ghost min-h-11 rounded-xl px-4 text-sm">
                Все категории
              </button>
            )}
            {hasDistrictFilter && (
              <button type="button" onClick={() => selectDistrict(null)} className="btn-ghost min-h-11 rounded-xl px-4 text-sm">
                Сбросить округ
              </button>
            )}
          </div>
        </div>
      )}

      {activeView === 'map' && placesView === 'map' && catalogIsEmpty && !showPreloader && !mapIssue && (
        <div className="panel absolute left-1/2 top-1/2 z-10 w-[min(340px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center">
          <p className="text-base font-semibold">На карте пока нет объектов</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            Опубликованные памятные места появятся здесь позже.
          </p>
        </div>
      )}

      {eventsMounted && (
        <EventsPanel
          suspended={activeView !== 'events'}
          onClose={closeEvents}
          onSelectObject={pickEventObject}
        />
      )}

      {activeView === 'map' && placesView === 'list' && !selectedId && (
        <PlacesListPanel
          features={listFeatures}
          categories={categories}
          loading={dataLoading}
          searchQuery={searchQuery.trim().length >= 2 ? searchQuery.trim() : null}
          loadError={listLoadError}
          onRetry={() => void loadData()}
          onClose={closePlacesList}
          onSelectObject={pickObject}
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
