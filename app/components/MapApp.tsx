'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import EventsPanel from './EventsPanel'
import MapModeNav from './MapModeNav'
import ObjectCard from './ObjectCard'
import MapPreloader from './MapPreloader'
import PlacesListPanel from './PlacesListPanel'
import MediaFilters, { type MediaFilter } from './MediaFilters'
import type { MapNavigationMode, MapViewMode } from './MapModeNav'
import type { RouteOverlayStop } from './MapView'
import type { RouteDetailState } from './RoutesPanel'
import type { PublicRoute } from '@/lib/routes'
import { rankSearchMatch } from '@/lib/map-search'
import {
  decodeMapUrl,
  encodeMapUrl,
  type MapCameraState,
  type PublicMapUrlState,
  type PublicMapView,
} from '@/lib/public-map-url'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'
import { trackPublicEvent } from '@/lib/analytics-client'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[var(--bg)]" role="status">
      <span className="sr-only">Загружаем интерактивную карту</span>
    </div>
  ),
})
const RoutesPanel = dynamic(() => import('./RoutesPanel'), { ssr: false })
const PeoplePanel = dynamic(() => import('./PeoplePanel'), { ssr: false })
const RouteNavigator = dynamic(() => import('./RouteNavigator'), { ssr: false })

interface Props {
  categories: CategoryDto[]
  routesEnabled?: boolean
  peopleEnabled?: boolean
  offlinePackagesEnabled?: boolean
}

type FC = GeoJSON.FeatureCollection
type LoadFailure = 'timeout' | 'error' | null
type PlacesView = Exclude<MapNavigationMode, 'events' | 'routes'>
/** Активный слой поверх карты; «people» не имеет вкладки и открывается из списка. */
type ActiveView = MapViewMode | 'people'

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

function publicView(activeView: ActiveView, placesView: PlacesView): PublicMapView {
  if (activeView === 'events' || activeView === 'routes' || activeView === 'people') return activeView
  return placesView === 'list' ? 'list' : 'map'
}

export default function MapApp({
  categories,
  routesEnabled = false,
  peopleEnabled = false,
  offlinePackagesEnabled = false,
}: Props) {
  const searchParams = useSearchParams()
  const [initialUrlState] = useState(() =>
    decodeMapUrl(new URLSearchParams(searchParams.toString()))
  )
  const rawInitialView: PublicMapView = initialUrlState.objectId
    ? 'map'
    : initialUrlState.view
  const initialView: PublicMapView =
    (rawInitialView === 'routes' && !routesEnabled) || (rawInitialView === 'people' && !peopleEnabled)
      ? 'map'
      : rawInitialView
  const initialActiveCats = categoriesFromUrl(initialUrlState.categoryIds, categories)

  const [objectsFC, setObjectsFC] = useState<FC | null>(null)
  const [districtsFC, setDistrictsFC] = useState<FC | null>(null)
  const [activeCats, setActiveCats] = useState<ReadonlySet<string>>(
    () => initialActiveCats
  )
  const [activeDistrict, setActiveDistrict] = useState<number | null>(initialUrlState.districtId)
  const [mediaFilters, setMediaFilters] = useState<ReadonlySet<MediaFilter>>(
    () => new Set(initialUrlState.mediaTypes)
  )
  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.objectId)
  const [activeView, setActiveView] = useState<ActiveView>(
    initialView === 'events' || initialView === 'routes' || initialView === 'people'
      ? initialView
      : 'map'
  )
  const [eventsMounted, setEventsMounted] = useState(initialView === 'events')
  const [routeSlug, setRouteSlug] = useState<string | null>(
    routesEnabled ? initialUrlState.routeSlug : null
  )
  const [personSlug, setPersonSlug] = useState<string | null>(
    peopleEnabled ? initialUrlState.personSlug : null
  )
  const [routesMounted, setRoutesMounted] = useState(
    initialView === 'routes' || (routesEnabled && initialUrlState.routeSlug !== null)
  )
  const [peopleMounted, setPeopleMounted] = useState(initialView === 'people')
  const [routeDetail, setRouteDetail] = useState<RouteDetailState | null>(null)
  const [routeRetryTick, setRouteRetryTick] = useState(0)
  const [fitRoute, setFitRoute] = useState<{ tick: number } | null>(null)
  const [navMode, setNavMode] = useState(
    routesEnabled && initialUrlState.navMode && initialUrlState.routeSlug !== null
  )
  const [navUserPosition, setNavUserPosition] = useState<{ lng: number; lat: number } | null>(null)
  const [navActiveStop, setNavActiveStop] = useState<number | null>(null)
  const [fitPoints, setFitPoints] = useState<{ points: [number, number][]; tick: number } | null>(null)
  const [walkTick, setWalkTick] = useState(0)
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
    routeSlug: routesEnabled ? initialUrlState.routeSlug : null,
    personSlug: peopleEnabled ? initialUrlState.personSlug : null,
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
    // Не сбрасываем dataReady, если данные уже есть: иначе preloader/мигание на mobile.
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
    trackPublicEvent('map_open')
  }, [loadData])

  useEffect(() => {
    if (selectedId) trackPublicEvent('place_open', selectedId)
  }, [selectedId])

  useEffect(() => {
    if (showPreloader === false) return
    if ((!mapReady && !mapIssue) || !dataReady) return
    const timer = window.setTimeout(() => setShowPreloader(false), 420)
    return () => window.clearTimeout(timer)
  }, [mapReady, mapIssue, dataReady, showPreloader])

  useEffect(() => {
    if (mapReady || mapIssue) return
    // Mobile на медленной сети: не показываем «ошибку карты» слишком рано.
    const timer = window.setTimeout(() => setMapIssue(true), 20_000)
    return () => window.clearTimeout(timer)
  }, [mapReady, mapIssue])

  // Канонизируем только принадлежащие карте параметры, не стирая UTM и feature flags.
  useEffect(() => {
    writeUrlState(urlStateRef.current, 'replace')
    return cancelScheduledReplace
  }, [cancelScheduledReplace, writeUrlState])

  useEffect(() => {
    const syncFromHistory = () => {
      cancelScheduledReplace()
      const decoded = decodeMapUrl(new URL(window.location.href).searchParams)
      const rawView: PublicMapView = decoded.objectId ? 'map' : decoded.view
      const nextView: PublicMapView =
        (rawView === 'routes' && !routesEnabled) || (rawView === 'people' && !peopleEnabled)
          ? 'map'
          : rawView
      const nextRouteSlug = routesEnabled ? decoded.routeSlug : null
      const nextPersonSlug = peopleEnabled ? decoded.personSlug : null
      const nextCategories = categoriesFromUrl(decoded.categoryIds, categories)
      urlStateRef.current = {
        ...decoded,
        view: nextView,
        categoryIds: categoriesForUrl(nextCategories, categories),
        routeSlug: nextRouteSlug,
        personSlug: nextPersonSlug,
      }
      setPreviewId(null)
      setFitDistrict(null)
      setSelectedId(decoded.objectId)
      if (nextView === 'events') setEventsMounted(true)
      if (nextView === 'routes' || nextRouteSlug !== null) setRoutesMounted(true)
      if (nextView === 'people') setPeopleMounted(true)
      setActiveView(
        nextView === 'events' || nextView === 'routes' || nextView === 'people' ? nextView : 'map'
      )
      setPlacesView(nextView === 'list' ? 'list' : 'map')
      setRouteSlug(nextRouteSlug)
      setNavMode(routesEnabled && decoded.navMode && nextRouteSlug !== null)
      setPersonSlug(nextPersonSlug)
      setActiveCats(nextCategories)
      setActiveDistrict(decoded.districtId)
      setMediaFilters(new Set(decoded.mediaTypes))
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
  }, [cancelScheduledReplace, categories, peopleEnabled, routesEnabled])

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
        if (mediaFilters.has('audio') && !p.hasAudio) return false
        if (mediaFilters.has('video') && !p.hasVideo) return false
        if (mediaFilters.has('3d') && !p.has3d) return false
        return true
      }),
    }
  }, [objectsFC, activeCats, activeDistrict, mediaFilters])

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
      // Медиафильтры учитываются, иначе числа в чипах спорят со счётчиком «мест на карте».
      if (mediaFilters.has('audio') && !props.hasAudio) continue
      if (mediaFilters.has('video') && !props.hasVideo) continue
      if (mediaFilters.has('3d') && !props.has3d) continue
      counts[props.category] = (counts[props.category] ?? 0) + 1
    }
    return counts
  }, [objectsFC, categories, activeDistrict, mediaFilters])

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
    setCamera((current) => {
      const sameCenter =
        Math.abs((current.center?.lng ?? 0) - (nextCamera.center?.lng ?? 0)) < 0.00001 &&
        Math.abs((current.center?.lat ?? 0) - (nextCamera.center?.lat ?? 0)) < 0.00001
      const sameView =
        Math.abs((current.zoom ?? 0) - (nextCamera.zoom ?? 0)) < 0.01 &&
        Math.abs((current.bearing ?? 0) - (nextCamera.bearing ?? 0)) < 0.1 &&
        Math.abs((current.pitch ?? 0) - (nextCamera.pitch ?? 0)) < 0.1
      return sameCenter && sameView ? current : nextCamera
    })
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
    setMediaFilters(new Set())
    pushUrlState({
      objectId: nextSelectedId,
      categoryIds: null,
      districtId: null,
      mediaTypes: [],
    })
  }, [categories, pushUrlState, selectedAfterFilters])

  const toggleMediaFilter = useCallback((filter: MediaFilter) => {
    const next = new Set(mediaFilters)
    if (next.has(filter)) next.delete(filter)
    else next.add(filter)
    setMediaFilters(next)
    pushUrlState({ mediaTypes: [...next] })
  }, [mediaFilters, pushUrlState])

  const resetMediaFilters = useCallback(() => {
    setMediaFilters(new Set())
    pushUrlState({ mediaTypes: [] })
  }, [pushUrlState])

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
  const hasMediaFilter = mediaFilters.size > 0
  const activeFilterKinds =
    [hasCategoryFilter, hasDistrictFilter, hasMediaFilter].filter(Boolean).length
  const dataFailureMessage = describeDataFailures(dataFailures)
  const listLoadError = dataFailures.objects === 'timeout'
    ? 'Памятные места загружаются слишком долго. Проверьте соединение и попробуйте ещё раз.'
    : dataFailures.objects === 'error'
      ? 'Не удалось загрузить памятные места. Проверьте соединение и попробуйте ещё раз.'
      : null
  const issueMessage = mapIssue
    ? dataFailureMessage
      ? `Не удалось загрузить подложку карты. ${dataFailureMessage}`
      : 'Не удалось загрузить подложку карты'
    : dataFailureMessage
  const hasLoadedObjects = (objectsFC?.features.length ?? 0) > 0
  const noFilterResults = Boolean(
    dataReady &&
    !dataFailures.objects &&
    hasLoadedObjects &&
    filteredFC?.features.length === 0 &&
    (hasCategoryFilter || hasDistrictFilter || hasMediaFilter)
  )
  const catalogIsEmpty = Boolean(
    dataReady &&
    !dataFailures.objects &&
    objectsFC &&
    objectsFC.features.length === 0 &&
    !hasCategoryFilter &&
    !hasDistrictFilter && !hasMediaFilter
  )
  const selectedCategoryName = activeCats.size === 1
    ? categories.find((category) => activeCats.has(category.id))?.title
    : null
  const noResultsDescription = activeCats.size === 0
    ? 'Вы скрыли все категории. Верните категории или сбросьте все фильтры.'
    : hasMediaFilter && !hasCategoryFilter && !hasDistrictFilter
      ? 'Под выбранные форматы (аудио/видео/3D) объектов не нашлось.'
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

  const closePlacesList = useCallback(() => {
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null })
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-places-view-map]'))
        .find((element) => element.offsetParent !== null)
        ?.focus()
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

  const changeView = useCallback((view: MapNavigationMode) => {
    const nextView: PublicMapView = view
    const changed = publicView(activeView, placesView) !== nextView || selectedId !== null
    if (!changed) return
    setPreviewId(null)
    setSelectedId(null)
    if (view === 'list') {
      setActiveView('map')
      setPlacesView('list')
    } else {
      setPlacesView('map')
      if (view === 'events') setEventsMounted(true)
      if (view === 'routes') setRoutesMounted(true)
      setActiveView(view)
    }
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

  // Крестик окна закрывает всё: и окно, и линию маршрута на карте (решение владельца).
  const closeRoutes = useCallback(() => {
    setPreviewId(null)
    setSelectedId(null)
    setRouteSlug(null)
    setNavMode(false)
    setActiveView('map')
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null, routeSlug: null, navMode: false })
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-map-mode-map]'))
        .find((element) => element.offsetParent !== null)
        ?.focus()
    })
  }, [pushUrlState])

  // «Показать на карте»: окно сворачивается, маршрут остаётся (мобильный сценарий просмотра).
  const collapseRoutes = useCallback(() => {
    setPreviewId(null)
    setSelectedId(null)
    setActiveView('map')
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null, navMode: false })
  }, [pushUrlState])

  const enterNavigation = useCallback(() => {
    setPreviewId(null)
    setSelectedId(null)
    setNavMode(true)
    setActiveView('map')
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null, navMode: true })
  }, [pushUrlState])

  const exitNavigation = useCallback(() => {
    setNavMode(false)
    setNavUserPosition(null)
    setNavActiveStop(null)
    setActiveView('routes')
    setRoutesMounted(true)
    // Окно перечитает гостевой прогресс, набранный в навигации.
    setWalkTick((tick) => tick + 1)
    pushUrlState({ view: 'routes', objectId: null, navMode: false })
  }, [pushUrlState])

  const openPeople = useCallback(() => {
    setPreviewId(null)
    setSelectedId(null)
    setPlacesView('map')
    setPeopleMounted(true)
    setActiveView('people')
    pushUrlState({ view: 'people', objectId: null })
  }, [pushUrlState])

  const closePeople = useCallback(() => {
    setActiveView('map')
    setPlacesView('map')
    pushUrlState({ view: 'map', objectId: null })
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-map-mode-map]'))
        .find((element) => element.offsetParent !== null)
        ?.focus()
    })
  }, [pushUrlState])

  const selectRoute = useCallback((slug: string | null) => {
    setPreviewId(null)
    setSelectedId(null)
    setRouteSlug(slug)
    if (slug) setRoutesMounted(true)
    pushUrlState({ view: 'routes', routeSlug: slug, objectId: null })
  }, [pushUrlState])

  const clearRoute = useCallback(() => {
    setRouteSlug(null)
    setNavMode(false)
    pushUrlState({ routeSlug: null, navMode: false })
  }, [pushUrlState])

  const selectPerson = useCallback((slug: string | null) => {
    setPreviewId(null)
    setSelectedId(null)
    setPersonSlug(slug)
    pushUrlState({ view: 'people', personSlug: slug, objectId: null })
  }, [pushUrlState])

  // Карточка выбранного маршрута: данные нужны и окну, и линии на карте.
  useEffect(() => {
    if (!routeSlug || !routesEnabled) {
      setRouteDetail(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setRouteDetail({ slug: routeSlug, status: 'loading', data: null })
    fetch(`/api/v1/routes/${routeSlug}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<PublicRoute>
      })
      .then((data) => {
        if (cancelled) return
        setRouteDetail({ slug: routeSlug, status: 'ready', data })
        setFitRoute((previous) => ({ tick: (previous?.tick ?? 0) + 1 }))
      })
      .catch(() => {
        if (!cancelled) setRouteDetail({ slug: routeSlug, status: 'error', data: null })
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [routeSlug, routesEnabled, routeRetryTick])

  const routeOverlayStops = useMemo<RouteOverlayStop[] | null>(() => {
    if (!routeDetail?.data) return null
    return routeDetail.data.stops.map((stop, index) => ({
      objectId: stop.objectId,
      title: stop.title,
      lng: stop.lng,
      lat: stop.lat,
      number: index + 1,
    }))
  }, [routeDetail])

  // Листание карточек точек маршрута в режиме навигации.
  const navSwitcher = useMemo(() => {
    if (!navMode || !selectedId || routeDetail?.status !== 'ready' || !routeDetail.data) return null
    const navStops = routeDetail.data.stops
    const index = navStops.findIndex((stop) => stop.objectId === selectedId)
    if (index === -1) return null
    return {
      index,
      total: navStops.length,
      title: navStops[index]!.title,
      prevId: index > 0 ? navStops[index - 1]!.objectId : null,
      nextId: index < navStops.length - 1 ? navStops[index + 1]!.objectId : null,
    }
  }, [navMode, selectedId, routeDetail])

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
        routeStops={routeOverlayStops}
        routeLegs={routeDetail?.status === 'ready' ? routeDetail.data?.legs ?? null : null}
        routeActiveStopNumber={navMode ? navActiveStop : null}
        userPosition={navMode ? navUserPosition : null}
        fitPoints={fitPoints}
        fitRoute={fitRoute}
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

      <header
        className={[
          'map-toolbar pointer-events-none absolute inset-x-0 top-0 z-10 p-3 md:p-5',
          selectedId || (activeView === 'map' && placesView === 'list')
            ? 'map-toolbar--with-panel-md map-toolbar--with-panel-xl'
            : activeView === 'events' || activeView === 'routes' || activeView === 'people'
              ? 'map-toolbar--with-panel-xl'
              : '',
        ].join(' ')}
      >
        <div className="mx-auto flex max-w-[1480px] items-start gap-3">
          <div
            className="brand-crest-compact panel pointer-events-auto 2xl:hidden"
            title="Память Тюмени"
            aria-label="Память Тюмени"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gerb-tyumen.svg" alt="" aria-hidden className="h-7 w-auto" />
          </div>
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
                <div className="flex items-center gap-2">
                  <MapModeNav
                    active={publicView(activeView, placesView)}
                    onChange={changeView}
                    showRoutes={routesEnabled}
                  />
                  {peopleEnabled && (
                    <button
                      type="button"
                      data-people-entry
                      onClick={openPeople}
                      aria-pressed={activeView === 'people'}
                      className={`panel grid min-h-11 place-items-center rounded-xl px-3 text-sm font-semibold transition-colors ${activeView === 'people' ? 'text-[var(--accent)]' : 'hover:text-[var(--accent)]'}`}
                    >
                      Люди
                    </button>
                  )}
                </div>
              </div>
            </div>
            {activeView === 'map' && (
              <>
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
                <MediaFilters active={mediaFilters} onToggle={toggleMediaFilter} />
              </>
            )}
          </div>
        </div>
      </header>

      <div
        data-map-mode-mobile
        className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[15] flex justify-center px-3 xl:hidden"
      >
        <MapModeNav
          active={publicView(activeView, placesView)}
          onChange={changeView}
          showRoutes={routesEnabled}
          className="pointer-events-auto w-full max-w-[430px]"
        />
      </div>

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
            {activeFilterKinds >= 2 && (
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
            {hasMediaFilter && (
              <button type="button" onClick={resetMediaFilters} className="btn-ghost min-h-11 rounded-xl px-4 text-sm">
                Сбросить форматы
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

      {navMode && routesEnabled && routeSlug && routeDetail?.status === 'ready' && routeDetail.data && (
        <RouteNavigator
          route={routeDetail.data}
          onExit={exitNavigation}
          onOpenStop={pickObject}
          onPositionChange={setNavUserPosition}
          onActiveStopChange={setNavActiveStop}
          onFocusPoints={(points) => setFitPoints((previous) => ({ points, tick: (previous?.tick ?? 0) + 1 }))}
        />
      )}

      {routeSlug && !navMode && routeDetail?.status === 'ready' && routeDetail.data &&
        activeView === 'map' && placesView === 'map' && !selectedId && !showPreloader && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-[11] flex justify-center px-3 xl:bottom-6">
          <div className="panel fade-in-rise pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full py-1 pl-1 pr-1">
            <button
              type="button"
              onClick={() => changeView('routes')}
              className="flex min-h-10 min-w-0 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors hover:text-[var(--accent)]"
            >
              <span
                aria-hidden
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-[var(--accent-ink)]"
              >
                {routeDetail.data.stops.length}
              </span>
              <span className="truncate">Маршрут: {routeDetail.data.title}</span>
            </button>
            <button
              type="button"
              onClick={clearRoute}
              aria-label="Убрать маршрут с карты"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--ink-subtle)] transition-colors hover:text-[var(--ink)]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {eventsMounted && (
        <EventsPanel
          suspended={activeView !== 'events'}
          onClose={closeEvents}
          onSelectObject={pickEventObject}
        />
      )}

      {routesMounted && routesEnabled && (
        <RoutesPanel
          suspended={activeView !== 'routes'}
          offlineEnabled={offlinePackagesEnabled}
          selectedSlug={routeSlug}
          detail={routeDetail}
          walkKey={walkTick}
          onSelectRoute={selectRoute}
          onRetryDetail={() => setRouteRetryTick((tick) => tick + 1)}
          onStartNavigation={enterNavigation}
          onCollapse={collapseRoutes}
          onClose={closeRoutes}
          onSelectObject={pickObject}
        />
      )}

      {peopleMounted && peopleEnabled && (
        <PeoplePanel
          suspended={activeView !== 'people'}
          selectedSlug={personSlug}
          onSelectPerson={selectPerson}
          onClose={closePeople}
          onSelectObject={pickObject}
        />
      )}

      {activeView === 'map' && placesView === 'list' && !selectedId && (
        <PlacesListPanel
          features={listFeatures}
          categories={categories}
          loading={dataLoading}
          searchQuery={searchQuery.trim().length >= 2 ? searchQuery.trim() : null}
          loadError={listLoadError}
          routesEnabled={routesEnabled}
          peopleEnabled={peopleEnabled}
          onOpenRoutes={() => changeView('routes')}
          onOpenPeople={openPeople}
          onRetry={() => void loadData()}
          onClose={closePlacesList}
          onSelectObject={pickObject}
          onClearSearch={() => changeSearchQuery('')}
        />
      )}

      {selectedId && (
        <ObjectCard
          id={selectedId}
          onClose={closeObject}
          navStrip={navSwitcher ? {
            index: navSwitcher.index,
            total: navSwitcher.total,
            onPrev: navSwitcher.prevId ? () => pickObject(navSwitcher.prevId!) : null,
            onNext: navSwitcher.nextId ? () => pickObject(navSwitcher.nextId!) : null,
          } : null}
        />
      )}

      {showPreloader && activeView === 'map' && !selectedId && (
        <MapPreloader
          indeterminate
          label={
            !dataReady
              ? 'Загружаем объекты'
              : !mapReady && !mapIssue
                ? 'Настраиваем карту'
                : mapIssue
                  ? 'Проверяем соединение'
                  : 'Готово'
          }
          leaving={(mapReady || mapIssue) && dataReady}
        />
      )}
    </main>
  )
}
