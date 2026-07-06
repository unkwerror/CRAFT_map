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
  /** fitBounds на округ; tick — чтобы повторный клик срабатывал */
  fitDistrict: { districtId: number; tick: number } | null
  onSelect: (id: string | null) => void
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
  fitDistrict,
  onSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const labelFontRef = useRef<string[]>(['Noto Sans Bold'])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

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
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
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
      map.on('load', () => setReady(true))

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
      })

      mapRef.current = map
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // округа: белые границы 2px + подписи
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
      id: 'districts-line',
      type: 'line',
      source: 'districts',
      paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.9 },
    })
    map.addLayer({
      id: 'districts-label',
      type: 'symbol',
      source: 'districts',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': labelFontRef.current,
        'text-size': 13,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#1b3a5c',
        'text-halo-width': 1.4,
        'text-opacity': 0.85,
      },
    })
  }, [ready, districts])

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
      clusterMaxZoom: 15,
    })
    const color = categoryColorExpr(categories)

    // мягкая полупрозрачная обводка (как на референсе)
    map.addLayer({
      id: 'objects-halo',
      type: 'circle',
      source: 'objects',
      filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': color, 'circle-radius': 13, 'circle-opacity': 0.28 },
    })
    map.addLayer({
      id: 'objects-selected',
      type: 'circle',
      source: 'objects',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 17,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5,
      },
    })
    map.addLayer({
      id: 'objects-core',
      type: 'circle',
      source: 'objects',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': color,
        'circle-radius': 6.5,
        'circle-stroke-color': 'rgba(255,255,255,0.9)',
        'circle-stroke-width': 1.4,
      },
    })
    // кластеры: радиус растёт с количеством точек
    map.addLayer({
      id: 'clusters-halo',
      type: 'circle',
      source: 'objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#4a70a0',
        'circle-opacity': 0.35,
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 30, 33],
      },
    })
    map.addLayer({
      id: 'clusters-core',
      type: 'circle',
      source: 'objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#eaf2fa',
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 30, 22],
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
      paint: { 'text-color': '#16324e' },
    })
  }, [ready, objects, categories])

  // подсветка выбранного + плавное центрирование с offset под панель
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('objects-selected')) return
    map.setFilter('objects-selected', ['==', ['get', 'id'], selected?.id ?? ''])
    if (selected) {
      const desktop = window.innerWidth >= 768
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: Math.max(map.getZoom(), 13.5),
        offset: desktop ? [-190, 0] : [0, -140],
        duration: 700,
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
      map.fitBounds(geometryBounds(feature.geometry), { padding: 60, duration: 700 })
    }
  }, [ready, fitDistrict, districts])

  // Обёртка держит позиционирование: MapLibre вешает на контейнер класс
  // .maplibregl-map { position: relative }, который в прод-сборке перебивает
  // tailwind-класс absolute (порядок CSS-бандлов) и схлопывает высоту в 0.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
