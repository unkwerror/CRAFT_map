'use client'

import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, Map as MLMap } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle, TYUMEN_CENTER } from '@/lib/map-style'
import type { CategoryDto } from '@/lib/types'

let protocolAdded = false
function ensurePmtilesProtocol() {
  if (!protocolAdded) {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    protocolAdded = true
  }
}

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
  onSelect: (id: string | null) => void
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

export default function MapView({
  categories,
  objects,
  districts,
  selected,
  highlightedId,
  activeDistrictId,
  fitDistrict,
  onSelect,
  onReady,
  onError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null)
  const [perspective, setPerspective] = useState(false)
  const labelFontRef = useRef<string[]>(['Noto Sans Bold'])
  const onSelectRef = useRef(onSelect)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  onSelectRef.current = onSelect
  onReadyRef.current = onReady
  onErrorRef.current = onError

  // инициализация карты
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    ensurePmtilesProtocol()

    resolveMapStyle().then(({ style, labelFont }) => {
      if (cancelled || !containerRef.current) return
      labelFontRef.current = labelFont
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: TYUMEN_CENTER,
        zoom: 11.3,
        minZoom: 8,
        maxZoom: 19,
        attributionControl: { compact: true },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right')
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
              layout: { visibility: 'none' },
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
        setReady(true)
        onReadyRef.current?.()
      })

      // клик с расширенной зоной тапа (±14px ≈ 40px hit area)
      map.on('click', (e) => {
        const pad = 14
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - pad, e.point.y - pad],
          [e.point.x + pad, e.point.y + pad],
        ]
        const layers = ['objects-core', 'clusters-core'].filter((l) => map.getLayer(l))
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

      map.on('mousemove', (e) => {
        const layers = ['objects-core', 'clusters-core'].filter((l) => map.getLayer(l))
        if (!layers.length) return
        const features = map.queryRenderedFeatures(e.point, { layers })
        map.getCanvas().style.cursor = features.length ? 'pointer' : ''
        const feature = features[0]
        const nextObjectId = feature?.properties?.id ? String(feature.properties.id) : null
        const nextClusterId = feature?.properties?.cluster_id !== undefined
          ? Number(feature.properties.cluster_id)
          : null
        setHoveredId((current) => (current === nextObjectId ? current : nextObjectId))
        setHoveredClusterId((current) => (current === nextClusterId ? current : nextClusterId))
      })

      map.getCanvas().addEventListener('mouseleave', () => {
        map.getCanvas().style.cursor = ''
        setHoveredId(null)
        setHoveredClusterId(null)
      })

      mapRef.current = map
    }).catch(() => onErrorRef.current?.())

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Округа: спокойная служебная граница, не конкурирующая с дорогами и маркерами.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !districts) return
    const src = map.getSource('districts') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(districts)
      return
    }
    map.addSource('districts', { type: 'geojson', data: districts })
    map.addLayer({
      id: 'districts-fill',
      type: 'fill',
      source: 'districts',
      paint: { 'fill-color': '#7ea5bd', 'fill-opacity': 0.025 },
    })
    map.addLayer({
      id: 'districts-active',
      type: 'fill',
      source: 'districts',
      filter: ['==', ['get', 'id'], -1],
      paint: { 'fill-color': '#efad45', 'fill-opacity': 0.11 },
    })
    map.addLayer({
      id: 'districts-line',
      type: 'line',
      source: 'districts',
      paint: { 'line-color': '#a9bdcb', 'line-width': 1.1, 'line-opacity': 0.34 },
    })
    map.addLayer({
      id: 'districts-active-line',
      type: 'line',
      source: 'districts',
      filter: ['==', ['get', 'id'], -1],
      paint: {
        'line-color': '#f4bb62',
        'line-width': 2.2,
        'line-opacity': 0.88,
      },
    })
    map.addLayer({
      id: 'districts-label',
      type: 'symbol',
      source: 'districts',
      minzoom: 9,
      maxzoom: 14.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': labelFontRef.current,
        'text-size': 13,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
      },
      paint: {
        'text-color': '#b9cad6',
        'text-halo-color': '#142b3e',
        'text-halo-width': 1.2,
        'text-opacity': 0.58,
      },
    })
  }, [ready, districts])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const filter: maplibregl.FilterSpecification = [
      '==',
      ['get', 'id'],
      activeDistrictId ?? -1,
    ]
    if (map.getLayer('districts-active')) map.setFilter('districts-active', filter)
    if (map.getLayer('districts-active-line')) map.setFilter('districts-active-line', filter)
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

  // подсветка выбранного + плавное центрирование с offset под панель
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('objects-selected')) return
    map.setFilter('objects-selected', ['==', ['get', 'id'], selected?.id ?? ''])
    if (selected) {
      const desktop = window.innerWidth >= 768
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: Math.max(map.getZoom(), 15.1),
        offset: desktop ? [-230, 0] : [0, -140],
        duration: reducedMotion ? 0 : 700,
      })
    }
  }, [ready, selected])

  // fitBounds на выбранный округ
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

  const togglePerspective = () => {
    const map = mapRef.current
    if (!map || !ready) return
    const next = !perspective
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPerspective(next)
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', next ? 'visible' : 'none')
    }
    map.easeTo({
      pitch: next ? 48 : 0,
      bearing: next ? -12 : 0,
      zoom: next ? Math.max(map.getZoom(), 14.4) : map.getZoom(),
      duration: reducedMotion ? 0 : 720,
    })
  }

  // Обёртка держит позиционирование: MapLibre вешает на контейнер класс
  // .maplibregl-map { position: relative }, который в прод-сборке перебивает
  // tailwind-класс absolute (порядок CSS-бандлов) и схлопывает высоту в 0.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
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
  )
}
