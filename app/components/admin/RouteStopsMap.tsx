'use client'

import maplibregl from 'maplibre-gl'
import type { Map as MLMap } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle, TYUMEN_CENTER } from '@/lib/map-style'
import type { AdminObjectRow } from '@/lib/types'

interface Props {
  objects: AdminObjectRow[]
  /** id объектов-остановок в порядке следования */
  stopIds: string[]
  onToggle: (objectId: string) => void
}

let protocolAdded = false

function ensurePmtilesProtocol() {
  if (protocolAdded) return
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  protocolAdded = true
}

/** Конструктор маршрута на карте: клик добавляет точку, повторный клик по выбранной — убирает. */
export default function RouteStopsMap({ objects, stopIds, onToggle }: Props) {
  const helpId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const onToggleRef = useRef(onToggle)
  const labelFontRef = useRef<string[]>(['Noto Sans Bold'])
  const fittedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  onToggleRef.current = onToggle

  const pointsCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => ({
    type: 'FeatureCollection',
    features: objects.flatMap((object) => {
      if (object.lng === null || object.lat === null) return []
      const stopIndex = stopIds.indexOf(object.id)
      return [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [object.lng, object.lat] },
        properties: {
          id: object.id,
          title: object.title,
          published: object.published,
          chosen: stopIndex >= 0,
          stopNumber: stopIndex >= 0 ? stopIndex + 1 : 0,
        },
      }]
    }),
  }), [objects, stopIds])

  const lineCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    const coordinates = stopIds.flatMap((stopId) => {
      const object = objects.find((item) => item.id === stopId)
      return object && object.lng !== null && object.lat !== null ? [[object.lng, object.lat]] : []
    })
    return {
      type: 'FeatureCollection',
      features: coordinates.length >= 2
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }]
        : [],
    }
  }, [objects, stopIds])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    let loadTimer: number | undefined
    ensurePmtilesProtocol()

    void resolveMapStyle()
      .then(({ style, labelFont }) => {
        if (cancelled || !containerRef.current) return
        labelFontRef.current = labelFont
        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: TYUMEN_CENTER,
          zoom: 10.8,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          touchPitch: false,
        })
        mapRef.current = map
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

        map.on('load', () => {
          if (cancelled) return
          if (loadTimer !== undefined) window.clearTimeout(loadTimer)
          setFailed(false)
          setReady(true)
        })

        map.on('click', (event) => {
          const layers = ['route-stop-chosen', 'route-object-points', 'route-object-clusters']
            .filter((id) => map.getLayer(id))
          if (!layers.length) return
          const pad = 16
          const box: [maplibregl.PointLike, maplibregl.PointLike] = [
            [event.point.x - pad, event.point.y - pad],
            [event.point.x + pad, event.point.y + pad],
          ]
          const feature = map.queryRenderedFeatures(box, { layers })[0]
          if (!feature?.properties) return
          if ('cluster_id' in feature.properties) {
            const source = map.getSource('route-objects') as maplibregl.GeoJSONSource
            void source
              .getClusterExpansionZoom(Number(feature.properties.cluster_id))
              .then((zoom) => {
                const geometry = feature.geometry as GeoJSON.Point
                map.easeTo({
                  center: geometry.coordinates as [number, number],
                  zoom: zoom + 0.25,
                  duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
                })
              })
          } else if (feature.properties.id) {
            onToggleRef.current(String(feature.properties.id))
          }
        })

        map.on('mousemove', (event) => {
          const layers = ['route-stop-chosen', 'route-object-points', 'route-object-clusters']
            .filter((id) => map.getLayer(id))
          const features = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : []
          map.getCanvas().style.cursor = features.length ? 'pointer' : ''
        })

        loadTimer = window.setTimeout(() => {
          if (!map.loaded()) setFailed(true)
        }, 12_000)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (loadTimer !== undefined) window.clearTimeout(loadTimer)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const pointsSource = map.getSource('route-objects') as maplibregl.GeoJSONSource | undefined
    const lineSource = map.getSource('route-path') as maplibregl.GeoJSONSource | undefined
    if (pointsSource && lineSource) {
      pointsSource.setData(pointsCollection)
      lineSource.setData(lineCollection)
      return
    }

    map.addSource('route-path', { type: 'geojson', data: lineCollection })
    map.addSource('route-objects', {
      type: 'geojson',
      data: pointsCollection,
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 14,
    })
    map.addLayer({
      id: 'route-path-line',
      type: 'line',
      source: 'route-path',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-opacity': 0.75 },
    })
    map.addLayer({
      id: 'route-object-points',
      type: 'circle',
      source: 'route-objects',
      filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'chosen']]],
      paint: {
        'circle-color': ['case', ['get', 'published'], '#2563eb', '#64748b'],
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    })
    map.addLayer({
      id: 'route-stop-chosen',
      type: 'circle',
      source: 'route-objects',
      filter: ['all', ['!', ['has', 'point_count']], ['get', 'chosen']],
      paint: {
        'circle-color': '#f59e0b',
        'circle-radius': 12,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: 'route-stop-number',
      type: 'symbol',
      source: 'route-objects',
      filter: ['all', ['!', ['has', 'point_count']], ['get', 'chosen']],
      layout: {
        'text-field': ['to-string', ['get', 'stopNumber']],
        'text-font': labelFontRef.current,
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#1e293b' },
    })
    map.addLayer({
      id: 'route-object-clusters',
      type: 'circle',
      source: 'route-objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#334155',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 24],
        'circle-stroke-color': '#cbd5e1',
        'circle-stroke-width': 1.5,
      },
    })
    map.addLayer({
      id: 'route-object-cluster-count',
      type: 'symbol',
      source: 'route-objects',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': labelFontRef.current,
        'text-size': 12,
      },
      paint: { 'text-color': '#ffffff' },
    })
  }, [ready, pointsCollection, lineCollection])

  // Первичный кадр: по остановкам (редактирование) или по всем объектам (новый маршрут).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || fittedRef.current || pointsCollection.features.length === 0) return
    const chosen = pointsCollection.features.filter((feature) => feature.properties?.chosen)
    const frame = chosen.length >= 2 ? chosen : pointsCollection.features
    const bounds = new maplibregl.LngLatBounds()
    for (const feature of frame) bounds.extend(feature.geometry.coordinates as [number, number])
    fittedRef.current = true
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 })
  }, [ready, pointsCollection])

  return (
    <div
      role="region"
      aria-label="Составление маршрута на карте"
      aria-describedby={helpId}
      className="relative h-96 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100"
    >
      <p id={helpId} className="sr-only">
        Клик по памятнику добавляет его в маршрут, повторный клик по выбранной точке убирает её.
        Для выбора с клавиатуры используйте поиск объекта под картой.
      </p>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/85 text-sm text-slate-500">
          Загружаем карту…
        </div>
      )}
      {failed && (
        <div role="status" className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
          Карта не загрузилась. Добавляйте остановки через поиск объекта.
        </div>
      )}
      {ready && stopIds.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow">
          Точек: {stopIds.length}
        </div>
      )}
    </div>
  )
}
