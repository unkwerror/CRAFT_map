'use client'

import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, Map as MLMap } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle, TYUMEN_CENTER } from '@/lib/map-style'
import type { MapCameraState } from '@/lib/public-map-url'
import { formatWalkMinutes, smoothLegCoordinates, type RouteLeg as RouteLegType } from '@/lib/route-legs'
import type { CategoryDto } from '@/lib/types'

let protocolAdded = false
function ensurePmtilesProtocol() {
  if (!protocolAdded) {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    protocolAdded = true
  }
}

export interface RouteOverlayStop {
  objectId: string
  title: string
  lng: number
  lat: number
  number: number
}

export type { RouteLeg } from '@/lib/route-legs'

export interface MapViewProps {
  categories: CategoryDto[]
  /** уже отфильтрованные объекты */
  objects: GeoJSON.FeatureCollection | null
  districts: GeoJSON.FeatureCollection | null
  selected: { id: string; lng: number; lat: number } | null
  /** временная подсветка маркера при наведении на результат поиска */
  highlightedId: string | null
  activeDistrictId: number | null
  /** fitBounds на округ; tick — чтобы повторный клик срабатывал */
  fitDistrict: { districtId: number; tick: number } | null
  /** Активный маршрут: линия и нумерованные точки поверх объектов. */
  routeStops: RouteOverlayStop[] | null
  /** Сегменты по улицам с временем пешком; без них линия строится напрямую между точками. */
  routeLegs: RouteLegType[] | null
  /** Номер текущей цели в режиме навигации — подсвечивается кольцом. */
  routeActiveStopNumber: number | null
  /** Позиция пользователя в режиме навигации (своя точка, без GeolocateControl). */
  userPosition: { lng: number; lat: number } | null
  /** fitBounds на произвольный набор точек (навигация: «я + цель»). */
  fitPoints: { points: [number, number][]; tick: number } | null
  /** fitBounds на маршрут; tick — чтобы повторный выбор срабатывал. */
  fitRoute: { tick: number } | null
  /** Камера из shareable URL; null-поля восстанавливают обзор города. */
  camera: MapCameraState
  onSelect: (id: string | null) => void
  onCameraChange?: (camera: MapCameraState) => void
  onReady?: () => void
  onError?: () => void
}

function categoryColorExpr(categories: CategoryDto[]): ExpressionSpecification {
  const expr: unknown[] = ['match', ['get', 'category']]
  for (const c of categories) expr.push(c.id, c.color)
  expr.push('#9aa7b5')
  return expr as ExpressionSpecification
}

function geometryBounds(geometry: GeoJSON.Geometry): [[number, number], [number, number]] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  const walk = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === 'number') {
      const [x, y] = coords as [number, number]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      return
    }
    for (const c of coords as unknown[]) walk(c)
  }
  if ('coordinates' in geometry) walk(geometry.coordinates)
  return [[minX, minY], [maxX, maxY]]
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const TYUMEN_OVERVIEW_ZOOM = 11.3

const MAP_LOCALE: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Показать сведения о карте',
  'GeolocateControl.FindMyLocation': 'Моё местоположение',
  'GeolocateControl.LocationNotAvailable': 'Не удалось определить местоположение',
  'Map.Title': 'Карта памятных мест Тюмени',
  'NavigationControl.ResetBearing': 'Перетащите, чтобы повернуть карту; нажмите, чтобы вернуть север',
  'NavigationControl.ZoomIn': 'Приблизить карту',
  'NavigationControl.ZoomOut': 'Отдалить карту',
}

interface SavedCamera {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

function readCamera(map: MLMap): MapCameraState {
  const center = map.getCenter()
  return {
    center: { lng: center.lng, lat: center.lat },
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  }
}

function cameraValuesMatch(left: MapCameraState, right: MapCameraState): boolean {
  const leftCenter = left.center ?? { lng: TYUMEN_CENTER[0], lat: TYUMEN_CENTER[1] }
  const rightCenter = right.center ?? { lng: TYUMEN_CENTER[0], lat: TYUMEN_CENTER[1] }
  return (
    Math.abs(leftCenter.lng - rightCenter.lng) < 0.00001 &&
    Math.abs(leftCenter.lat - rightCenter.lat) < 0.00001 &&
    Math.abs((left.zoom ?? TYUMEN_OVERVIEW_ZOOM) - (right.zoom ?? TYUMEN_OVERVIEW_ZOOM)) < 0.01 &&
    Math.abs((left.bearing ?? 0) - (right.bearing ?? 0)) < 0.1 &&
    Math.abs((left.pitch ?? 0) - (right.pitch ?? 0)) < 0.1
  )
}

function cameraMatches(map: MLMap, camera: MapCameraState): boolean {
  return cameraValuesMatch(readCamera(map), camera)
}

function errorMessageFromMapEvent(event: { error?: Error | string; message?: string }): string {
  if (typeof event.error === 'string') return event.error
  if (event.error instanceof Error) return event.error.message
  if (typeof event.message === 'string') return event.message
  return ''
}

/** Обычные сетевые/тайловые сбои не должны сбрасывать карту на mobile. */
function isIgnorableMapError(message: string): boolean {
  const text = message.toLowerCase()
  return (
    text.includes('tile') ||
    text.includes('ajax') ||
    text.includes('404') ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('load failed') ||
    text.includes('aborted') ||
    text.includes('cancel')
  )
}

export default function MapView({
  categories,
  objects,
  districts,
  selected,
  highlightedId,
  activeDistrictId,
  fitDistrict,
  routeStops,
  routeLegs,
  routeActiveStopNumber,
  userPosition,
  fitPoints,
  fitRoute,
  camera,
  onSelect,
  onCameraChange,
  onReady,
  onError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null)
  const [perspective, setPerspective] = useState(() => (camera.pitch ?? 0) > 0.5)
  const cameraBeforePerspectiveRef = useRef<SavedCamera | null>(null)
  const labelFontRef = useRef<string[]>(['Noto Sans Bold'])
  const initialCameraRef = useRef(camera)
  const lastEmittedCameraRef = useRef<MapCameraState | null>(null)
  const lastFlownObjectIdRef = useRef<string | null>(null)
  const onSelectRef = useRef(onSelect)
  const onCameraChangeRef = useRef(onCameraChange)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  onSelectRef.current = onSelect
  onCameraChangeRef.current = onCameraChange
  onReadyRef.current = onReady
  onErrorRef.current = onError

  // инициализация карты
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    let hoverFrame: number | null = null
    let latestHoverPoint: [number, number] | null = null
    let resizeObserver: ResizeObserver | null = null
    let resizeMap: (() => void) | null = null
    ensurePmtilesProtocol()

    resolveMapStyle().then(({ style, labelFont }) => {
      if (cancelled || !containerRef.current) return
      labelFontRef.current = labelFont
      const initialCamera = initialCameraRef.current
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: initialCamera.center
          ? [initialCamera.center.lng, initialCamera.center.lat]
          : TYUMEN_CENTER,
        zoom: initialCamera.zoom ?? TYUMEN_OVERVIEW_ZOOM,
        bearing: initialCamera.bearing ?? 0,
        pitch: initialCamera.pitch ?? 0,
        minZoom: 8,
        maxZoom: 19,
        attributionControl: { compact: true },
        locale: MAP_LOCALE,
        // Компас (стрелка «на север») отключён: для городской карты он путает,
        // а 2D/3D и «Город» закрывают ориентацию явно.
        // dragRotate остаётся жестом двумя пальцами / правой кнопкой.
        dragRotate: true,
        pitchWithRotate: true,
      })
      // На тач-устройствах зум — щипком; кнопки «+/−» не занимают правый край экрана.
      if (window.matchMedia('(pointer: fine)').matches) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
      }
      // «Моё местоположение»: кнопка + пульсирующая точка юзера и круг точности.
      // Требует HTTPS (на проде есть). Трекинг слетает в «пассивный» режим при ручном
      // перемещении карты — повторный клик снова центрирует.
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
          showAccuracyCircle: true,
        }),
        'bottom-right'
      )
      map.on('error', (event) => {
        const message = errorMessageFromMapEvent(event)
        if (isIgnorableMapError(message)) return
        onErrorRef.current?.()
      })

      resizeMap = () => {
        if (cancelled || !mapRef.current) return
        map.resize()
      }
      window.addEventListener('orientationchange', resizeMap)
      window.visualViewport?.addEventListener('resize', resizeMap)
      resizeObserver = new ResizeObserver(resizeMap)
      resizeObserver.observe(containerRef.current)

      map.on('load', () => {
        // В перспективном режиме локальная векторная подложка получает объёмные здания.
        // На растровом fallback слой просто не создаётся.
        if (map.getSource('openmaptiles') && !map.getLayer('buildings-3d')) {
          const firstLabel = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
          map.addLayer(
            {
              id: 'buildings-3d',
              type: 'fill-extrusion',
              source: 'openmaptiles',
              'source-layer': 'building',
              minzoom: 14.2,
              layout: { visibility: (initialCamera.pitch ?? 0) > 0.5 ? 'visible' : 'none' },
              paint: {
                'fill-extrusion-color': '#2b4d63',
                'fill-extrusion-height': [
                  'case',
                  ['!=', ['get', 'render_height'], null],
                  ['to-number', ['get', 'render_height'], 8],
                  ['!=', ['get', 'height'], null],
                  ['to-number', ['get', 'height'], 8],
                  8,
                ],
                'fill-extrusion-base': [
                  'case',
                  ['!=', ['get', 'render_min_height'], null],
                  ['to-number', ['get', 'render_min_height'], 0],
                  ['!=', ['get', 'min_height'], null],
                  ['to-number', ['get', 'min_height'], 0],
                  0,
                ],
                'fill-extrusion-opacity': 0.78,
              },
            },
            firstLabel
          )
        }
        // iOS/Chrome mobile: после появления UI-chrome контейнер может сменить высоту.
        map.resize()
        const cameraState = readCamera(map)
        lastEmittedCameraRef.current = cameraState
        setReady(true)
        onCameraChangeRef.current?.(cameraState)
        onReadyRef.current?.()
      })

      map.on('moveend', () => {
        const cameraState = readCamera(map)
        lastEmittedCameraRef.current = cameraState
        onCameraChangeRef.current?.(cameraState)
      })

      // клик с расширенной зоной тапа (±14px ≈ 40px hit area)
      map.on('click', (e) => {
        const pad = 14
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - pad, e.point.y - pad],
          [e.point.x + pad, e.point.y + pad],
        ]
        const layers = ['route-stops-overlay', 'objects-core', 'clusters-core']
          .filter((l) => map.getLayer(l))
        const features = map.queryRenderedFeatures(box, { layers })
        const f = features[0]
        if (!f) {
          onSelectRef.current(null)
          return
        }
        if (f.properties && 'cluster_id' in f.properties) {
          const source = map.getSource('objects') as maplibregl.GeoJSONSource
          source.getClusterExpansionZoom(Number(f.properties.cluster_id)).then((zoom) => {
            const geom = f.geometry as GeoJSON.Point
            map.easeTo({ center: geom.coordinates as [number, number], zoom: zoom + 0.3 })
          })
        } else if (f.properties?.id) {
          onSelectRef.current(String(f.properties.id))
        }
      })

      // MapLibre может присылать десятки mousemove за кадр. Запрашиваем отрисованные
      // объекты не чаще одного раза за animation frame и всегда берём свежую точку.
      map.on('mousemove', (event) => {
        latestHoverPoint = [event.point.x, event.point.y]
        if (hoverFrame !== null) return
        hoverFrame = window.requestAnimationFrame(() => {
          hoverFrame = null
          const point = latestHoverPoint
          if (!point) return
          const layers = ['route-stops-overlay', 'objects-core', 'clusters-core']
            .filter((layer) => map.getLayer(layer))
          if (!layers.length) return
          const features = map.queryRenderedFeatures(point, { layers })
          map.getCanvas().style.cursor = features.length ? 'pointer' : ''
          const feature = features[0]
          const nextObjectId = feature?.properties?.id ? String(feature.properties.id) : null
          const nextClusterId = feature?.properties?.cluster_id !== undefined
            ? Number(feature.properties.cluster_id)
            : null
          setHoveredId((current) => (current === nextObjectId ? current : nextObjectId))
          setHoveredClusterId((current) => (current === nextClusterId ? current : nextClusterId))
        })
      })

      map.getCanvas().addEventListener('mouseleave', () => {
        latestHoverPoint = null
        if (hoverFrame !== null) {
          window.cancelAnimationFrame(hoverFrame)
          hoverFrame = null
        }
        map.getCanvas().style.cursor = ''
        setHoveredId(null)
        setHoveredClusterId(null)
      })

      mapRef.current = map
    }).catch(() => onErrorRef.current?.())

    return () => {
      cancelled = true
      if (hoverFrame !== null) window.cancelAnimationFrame(hoverFrame)
      resizeObserver?.disconnect()
      if (resizeMap) {
        window.removeEventListener('orientationchange', resizeMap)
        window.visualViewport?.removeEventListener('resize', resizeMap)
      }
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Округа: без постоянных контуров. Подсветка только при выборе округа в поиске.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !districts) return
    const src = map.getSource('districts') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(districts)
      return
    }
    map.addSource('districts', { type: 'geojson', data: districts })
    // Слои под маркерами, если они уже созданы.
    const before = map.getLayer('objects-event-pulse') ? 'objects-event-pulse' : undefined
    map.addLayer(
      {
        id: 'districts-active-fill',
        type: 'fill',
        source: 'districts',
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'fill-color': '#efad45',
          'fill-opacity': 0.14,
        },
      },
      before
    )
    map.addLayer(
      {
        id: 'districts-active-line',
        type: 'line',
        source: 'districts',
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'line-color': '#f4bb62',
          'line-width': 2.4,
          'line-opacity': 0.95,
        },
      },
      before
    )
    map.addLayer(
      {
        id: 'districts-active-label',
        type: 'symbol',
        source: 'districts',
        filter: ['==', ['get', 'id'], -1],
        layout: {
          'text-field': ['concat', ['get', 'name'], ' округ'],
          'text-font': labelFontRef.current,
          'text-size': 13,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#f6e2b3',
          'text-halo-color': '#142b3e',
          'text-halo-width': 1.5,
        },
      },
      before
    )
  }, [ready, districts])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const filter: maplibregl.FilterSpecification = [
      '==',
      ['get', 'id'],
      activeDistrictId ?? -1,
    ]
    if (map.getLayer('districts-active-fill')) map.setFilter('districts-active-fill', filter)
    if (map.getLayer('districts-active-line')) map.setFilter('districts-active-line', filter)
    if (map.getLayer('districts-active-label')) map.setFilter('districts-active-label', filter)
  }, [ready, districts, activeDistrictId])

  // объекты: кластеры + цветные маркеры категорий
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const data = objects ?? EMPTY_FC
    const src = map.getSource('objects') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(data)
      return
    }
    map.addSource('objects', {
      type: 'geojson',
      data,
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 14,
    })
    const color = categoryColorExpr(categories)

    // пульсирующее кольцо у объектов с мероприятием на сегодня (анимация ниже)
    map.addLayer({
      id: 'objects-event-pulse',
      type: 'circle',
      source: 'objects',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'hasEvent'], true]],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 13,
        'circle-stroke-color': '#ffd166',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.9,
      },
    })

    // мягкая полупрозрачная обводка (как на референсе)
    map.addLayer({
      id: 'objects-halo',
      type: 'circle',
      source: 'objects',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 11, 12, 13, 16, 16],
        'circle-opacity': 0.28,
      },
    })
    map.addLayer({
      id: 'objects-selected',
      type: 'circle',
      source: 'objects',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 17,
        'circle-stroke-color': '#f0a93b',
        'circle-stroke-width': 2.5,
      },
    })
    map.addLayer({
      id: 'objects-hover',
      type: 'circle',
      source: 'objects',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 12, 15, 16, 19],
        'circle-stroke-color': 'rgba(255,255,255,0.92)',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.9,
      },
    })
    map.addLayer({
      id: 'objects-core',
      type: 'circle',
      source: 'objects',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5.5, 12, 6.5, 16, 8.5],
        'circle-stroke-color': 'rgba(255,255,255,0.9)',
        'circle-stroke-width': 1.4,
      },
    })
    map.addLayer({
      id: 'objects-label',
      type: 'symbol',
      source: 'objects',
      minzoom: 14.2,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'title'],
        'text-font': labelFontRef.current,
        'text-size': ['interpolate', ['linear'], ['zoom'], 14.2, 10.5, 17, 12.5],
        'text-anchor': 'top',
        'text-offset': [0, 1.35],
        'text-max-width': 16,
        'text-optional': true,
      },
      paint: {
        'text-color': '#e5eef4',
        'text-halo-color': '#102536',
        'text-halo-width': 1.4,
        'text-halo-blur': 0.5,
      },
    })
    map.addLayer({
      id: 'objects-focus-label',
      type: 'symbol',
      source: 'objects',
      filter: ['==', ['get', 'id'], ''],
      layout: {
        'text-field': ['get', 'title'],
        'text-font': labelFontRef.current,
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 1.45],
        'text-max-width': 18,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0d202f',
        'text-halo-width': 2,
        'text-halo-blur': 0.6,
      },
    })
    // кластеры: радиус растёт с количеством точек
    map.addLayer({
      id: 'clusters-halo',
      type: 'circle',
      source: 'objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#7894a9',
        'circle-opacity': 0.22,
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 30, 33],
      },
    })
    map.addLayer({
      id: 'clusters-core',
      type: 'circle',
      source: 'objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#213e55',
        'circle-stroke-color': '#8fa8ba',
        'circle-stroke-width': 1,
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 30, 22],
      },
    })
    map.addLayer({
      id: 'clusters-hover',
      type: 'circle',
      source: 'objects',
      filter: ['==', ['get', 'cluster_id'], -1],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 30, 26],
        'circle-stroke-color': '#d8e7f0',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.82,
      },
    })
    map.addLayer({
      id: 'clusters-count',
      type: 'symbol',
      source: 'objects',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': labelFontRef.current,
        'text-size': 12,
      },
      paint: { 'text-color': '#eef4f8' },
    })
  }, [ready, objects, categories])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const focusId = highlightedId ?? hoveredId ?? selected?.id ?? ''
    if (map.getLayer('objects-hover')) {
      map.setFilter('objects-hover', ['==', ['get', 'id'], focusId])
    }
    if (map.getLayer('objects-focus-label')) {
      map.setFilter('objects-focus-label', ['==', ['get', 'id'], focusId])
    }
    if (map.getLayer('clusters-hover')) {
      map.setFilter('clusters-hover', ['==', ['get', 'cluster_id'], hoveredClusterId ?? -1])
    }
  }, [ready, objects, selected, highlightedId, hoveredId, hoveredClusterId])

  // анимация пульса: кольцо расширяется и гаснет (объекты с мероприятием сегодня)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const hasPulse = (objects ?? EMPTY_FC).features.some(
      (f) => (f.properties as { hasEvent?: boolean } | null)?.hasEvent
    )
    if (!hasPulse || !map.getLayer('objects-event-pulse')) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const tick = () => {
      const t = (performance.now() % 1800) / 1800
      if (map.getLayer('objects-event-pulse')) {
        map.setPaintProperty('objects-event-pulse', 'circle-radius', 9 + t * 14)
        map.setPaintProperty('objects-event-pulse', 'circle-stroke-opacity', 0.9 * (1 - t))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, objects])

  // подсветка выбранного + flyTo только при смене объекта (не при каждом re-render)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('objects-selected')) return
    map.setFilter('objects-selected', ['==', ['get', 'id'], selected?.id ?? ''])
    if (!selected) {
      lastFlownObjectIdRef.current = null
      return
    }
    if (lastFlownObjectIdRef.current === selected.id) return
    lastFlownObjectIdRef.current = selected.id
    const desktop = window.innerWidth >= 768
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({
      center: [selected.lng, selected.lat],
      zoom: Math.max(map.getZoom(), 15.1),
      offset: desktop ? [-230, 0] : [0, -140],
      duration: reducedMotion ? 0 : 700,
    })
  }, [ready, selected])

  // Активный маршрут: линия между точками + нумерованные маркеры поверх объектов.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const stops = routeStops ?? []
    const legs = (routeLegs ?? []).filter((leg) => leg.coordinates.length >= 2)
    const stopsData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: stops.map((stop) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
        properties: { id: stop.objectId, number: stop.number, title: stop.title },
      })),
    }
    const lineData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: legs.length
        ? legs.map((leg) => ({
            type: 'Feature' as const,
            // Углы уличной геометрии срезаются для мягкой «навигаторской» линии.
            geometry: { type: 'LineString' as const, coordinates: smoothLegCoordinates(leg.coordinates) },
            properties: {},
          }))
        : stops.length >= 2
          ? [{
              type: 'Feature' as const,
              geometry: { type: 'LineString' as const, coordinates: stops.map((stop) => [stop.lng, stop.lat]) },
              properties: {},
            }]
          : [],
    }
    // Подпись времени пешком — на середине каждого сегмента.
    const timesData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: legs.map((leg) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: leg.coordinates[Math.floor(leg.coordinates.length / 2)]!,
        },
        properties: { label: formatWalkMinutes(leg.seconds) },
      })),
    }
    const stopsSource = map.getSource('route-overlay-stops') as maplibregl.GeoJSONSource | undefined
    const lineSource = map.getSource('route-overlay-path') as maplibregl.GeoJSONSource | undefined
    const timesSource = map.getSource('route-overlay-times') as maplibregl.GeoJSONSource | undefined
    if (stopsSource && lineSource && timesSource) {
      stopsSource.setData(stopsData)
      lineSource.setData(lineData)
      timesSource.setData(timesData)
    } else {
      map.addSource('route-overlay-path', { type: 'geojson', data: lineData })
      map.addSource('route-overlay-times', { type: 'geojson', data: timesData })
      map.addSource('route-overlay-stops', { type: 'geojson', data: stopsData })
      // Кайма под линией даёт глубину и отделяет маршрут от подложки.
      map.addLayer({
        id: 'route-overlay-line-casing',
        type: 'line',
        source: 'route-overlay-path',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(9, 17, 25, 0.75)', 'line-width': 8 },
      })
      map.addLayer({
        id: 'route-overlay-line',
        type: 'line',
        source: 'route-overlay-path',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f2b357', 'line-width': 4.5, 'line-opacity': 0.96 },
      })
      // Шевроны направления вдоль линии.
      map.addLayer({
        id: 'route-overlay-direction',
        type: 'symbol',
        source: 'route-overlay-path',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 110,
          'text-field': '›',
          'text-font': labelFontRef.current,
          'text-size': 14,
          'text-keep-upright': false,
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-padding': 0,
        },
        paint: { 'text-color': '#10243a' },
      })
      // Кольцо текущей цели навигации — под маркерами точек.
      map.addLayer({
        id: 'route-stop-active-halo',
        type: 'circle',
        source: 'route-overlay-stops',
        filter: ['==', ['get', 'number'], -1],
        paint: {
          'circle-color': 'rgba(239, 173, 69, 0.22)',
          'circle-radius': 21,
          'circle-stroke-color': '#efad45',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'route-stops-overlay',
        type: 'circle',
        source: 'route-overlay-stops',
        paint: {
          'circle-color': '#efad45',
          'circle-radius': 13,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'route-stops-overlay-number',
        type: 'symbol',
        source: 'route-overlay-stops',
        layout: {
          'text-field': ['to-string', ['get', 'number']],
          'text-font': labelFontRef.current,
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#10243a' },
      })
      map.addLayer({
        id: 'route-overlay-time-labels',
        type: 'symbol',
        source: 'route-overlay-times',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': labelFontRef.current,
          'text-size': 11.5,
          'text-offset': [0, -0.8],
          'text-padding': 4,
        },
        paint: {
          'text-color': '#f6dfae',
          'text-halo-color': '#0d1720',
          'text-halo-width': 1.8,
        },
      })
    }
    // Слои объектов пересоздаются позже — маршрут держим над ними.
    for (const layerId of ['route-overlay-line-casing', 'route-overlay-line', 'route-overlay-direction', 'route-overlay-time-labels', 'route-stop-active-halo', 'route-stops-overlay', 'route-stops-overlay-number']) {
      if (map.getLayer(layerId)) map.moveLayer(layerId)
    }
  }, [ready, routeStops, routeLegs, objects])

  // Подсветка текущей цели навигации.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('route-stop-active-halo')) return
    map.setFilter('route-stop-active-halo', ['==', ['get', 'number'], routeActiveStopNumber ?? -1])
  }, [ready, routeActiveStopNumber, routeStops, objects])

  // Точка пользователя в режиме навигации.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: userPosition
        ? [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [userPosition.lng, userPosition.lat] },
            properties: {},
          }]
        : [],
    }
    const source = map.getSource('nav-user') as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(data)
    } else {
      map.addSource('nav-user', { type: 'geojson', data })
      map.addLayer({
        id: 'nav-user-halo',
        type: 'circle',
        source: 'nav-user',
        paint: { 'circle-color': 'rgba(74, 163, 255, 0.25)', 'circle-radius': 16 },
      })
      map.addLayer({
        id: 'nav-user-dot',
        type: 'circle',
        source: 'nav-user',
        paint: {
          'circle-color': '#4aa3ff',
          'circle-radius': 7,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      })
    }
    for (const layerId of ['nav-user-halo', 'nav-user-dot']) {
      if (map.getLayer(layerId)) map.moveLayer(layerId)
    }
  }, [ready, userPosition, objects])

  // Кадрирование на «я + цель» в навигации.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !fitPoints || fitPoints.points.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const point of fitPoints.points) bounds.extend(point)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.fitBounds(bounds, {
      padding: { top: 130, bottom: 260, left: 70, right: 70 },
      maxZoom: 17,
      duration: reducedMotion ? 0 : 650,
    })
  }, [ready, fitPoints])

  // fitBounds на активный маршрут; на десктопе правый край занят окном «Маршруты».
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !fitRoute || !routeStops || routeStops.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const stop of routeStops) bounds.extend([stop.lng, stop.lat])
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sidePanel = window.innerWidth >= 1280
    map.fitBounds(bounds, {
      padding: {
        top: 120,
        bottom: sidePanel ? 90 : 180,
        left: 70,
        right: sidePanel ? 580 : 70,
      },
      maxZoom: 15.8,
      duration: reducedMotion ? 0 : 700,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitRoute])

  // fitBounds на выбранный округ (контуры на карте не рисуем — только навигация)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !fitDistrict || !districts) return
    const feature = districts.features.find(
      (f) => (f.properties as { id?: number } | null)?.id === fitDistrict.districtId
    )
    if (feature?.geometry) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      map.fitBounds(geometryBounds(feature.geometry), { padding: 60, duration: reducedMotion ? 0 : 700 })
    }
  }, [ready, fitDistrict, districts])

  // Back/Forward и shareable URL: применяем камеру только если она пришла снаружи,
  // а не как эхо собственного moveend (иначе mobile «дёргает» и перезагружает вид).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (lastEmittedCameraRef.current && cameraValuesMatch(lastEmittedCameraRef.current, camera)) {
      return
    }
    if (cameraMatches(map, camera)) {
      lastEmittedCameraRef.current = camera
      return
    }
    const center = camera.center ?? { lng: TYUMEN_CENTER[0], lat: TYUMEN_CENTER[1] }
    const pitch = camera.pitch ?? 0
    cameraBeforePerspectiveRef.current = null
    setPerspective(pitch > 0.5)
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', pitch > 0.5 ? 'visible' : 'none')
    }
    const nextCamera: MapCameraState = {
      center: { lng: center.lng, lat: center.lat },
      zoom: camera.zoom ?? TYUMEN_OVERVIEW_ZOOM,
      bearing: camera.bearing ?? 0,
      pitch,
    }
    lastEmittedCameraRef.current = nextCamera
    map.jumpTo({
      center: [center.lng, center.lat],
      zoom: nextCamera.zoom ?? TYUMEN_OVERVIEW_ZOOM,
      bearing: nextCamera.bearing ?? 0,
      pitch,
    })
  }, [ready, camera])

  const togglePerspective = () => {
    const map = mapRef.current
    if (!map || !ready) return
    const next = !perspective
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (next) {
      const center = map.getCenter()
      cameraBeforePerspectiveRef.current = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      }
    }
    setPerspective(next)
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', next ? 'visible' : 'none')
    }
    if (next) {
      map.easeTo({
        pitch: 48,
        bearing: -12,
        zoom: Math.max(map.getZoom(), 14.4),
        duration: reducedMotion ? 0 : 720,
      })
      return
    }
    const previousCamera = cameraBeforePerspectiveRef.current
    cameraBeforePerspectiveRef.current = null
    map.easeTo({
      ...(previousCamera ?? { pitch: 0, bearing: 0 }),
      duration: reducedMotion ? 0 : 720,
    })
  }

  const showTyumenOverview = () => {
    const map = mapRef.current
    if (!map || !ready) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cameraBeforePerspectiveRef.current = null
    setPerspective(false)
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', 'none')
    }
    map.easeTo({
      center: TYUMEN_CENTER,
      zoom: TYUMEN_OVERVIEW_ZOOM,
      pitch: 0,
      bearing: 0,
      duration: reducedMotion ? 0 : 720,
    })
  }

  // Обёртка держит позиционирование: MapLibre вешает на контейнер класс
  // .maplibregl-map { position: relative }, который в прод-сборке перебивает
  // tailwind-класс absolute (порядок CSS-бандлов) и схлопывает высоту в 0.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <div className="map-view-tools">
        <button
          type="button"
          onClick={showTyumenOverview}
          aria-label="Показать всю Тюмень"
          title="Вся Тюмень"
          className="map-home-toggle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M8 9.5h8M8 13h8M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Город</span>
        </button>
        <button
          type="button"
          onClick={togglePerspective}
          aria-label={perspective ? 'Вернуть плоский вид карты' : 'Включить перспективный вид карты'}
          aria-pressed={perspective}
          className={`map-perspective-toggle ${perspective ? 'map-perspective-toggle--active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m3.5 8 8.5-4 8.5 4-8.5 4-8.5-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="m3.5 12 8.5 4 8.5-4M3.5 16l8.5 4 8.5-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{perspective ? '2D' : '3D'}</span>
        </button>
      </div>
    </div>
  )
}
