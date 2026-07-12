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
  value: string
  onChange: (id: string) => void
}

interface MapObjectProperties {
  id: string
  title: string
  published: boolean
}

let protocolAdded = false

function ensurePmtilesProtocol() {
  if (protocolAdded) return
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  protocolAdded = true
}

/** Карта выбирает существующий объект; координаты памятников она не редактирует. */
export default function EventObjectMap({ objects, value, onChange }: Props) {
  const helpId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const onChangeRef = useRef(onChange)
  const labelFontRef = useRef<string[]>(['Noto Sans Bold'])
  const fittedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  onChangeRef.current = onChange

  const featureCollection = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, MapObjectProperties>
  >(
    () => ({
      type: 'FeatureCollection',
      features: objects.flatMap((object) => {
        if (object.lng === null || object.lat === null) return []
        return [{
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [object.lng, object.lat],
          },
          properties: {
            id: object.id,
            title: object.title,
            published: object.published,
          },
        }]
      }),
    }),
    [objects]
  )

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
          const layers = ['event-object-points', 'event-object-clusters'].filter((id) =>
            map.getLayer(id)
          )
          if (!layers.length) return
          const pad = 16
          const box: [maplibregl.PointLike, maplibregl.PointLike] = [
            [event.point.x - pad, event.point.y - pad],
            [event.point.x + pad, event.point.y + pad],
          ]
          const feature = map.queryRenderedFeatures(box, { layers })[0]
          if (!feature?.properties) return

          if ('cluster_id' in feature.properties) {
            const source = map.getSource('event-objects') as maplibregl.GeoJSONSource
            void source
              .getClusterExpansionZoom(Number(feature.properties.cluster_id))
              .then((zoom) => {
                const geometry = feature.geometry as GeoJSON.Point
                map.easeTo({
                  center: geometry.coordinates as [number, number],
                  zoom: zoom + 0.25,
                  duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 0
                    : 450,
                })
              })
          } else if (feature.properties.id) {
            onChangeRef.current(String(feature.properties.id))
          }
        })

        map.on('mousemove', (event) => {
          const layers = ['event-object-points', 'event-object-clusters'].filter((id) =>
            map.getLayer(id)
          )
          const features = layers.length
            ? map.queryRenderedFeatures(event.point, { layers })
            : []
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

    const existing = map.getSource('event-objects') as maplibregl.GeoJSONSource | undefined
    if (existing) {
      existing.setData(featureCollection)
      return
    }

    map.addSource('event-objects', {
      type: 'geojson',
      data: featureCollection,
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 14,
    })
    map.addLayer({
      id: 'event-object-selected',
      type: 'circle',
      source: 'event-objects',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 14,
        'circle-stroke-color': '#f59e0b',
        'circle-stroke-width': 4,
      },
    })
    map.addLayer({
      id: 'event-object-points',
      type: 'circle',
      source: 'event-objects',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['get', 'published'], '#2563eb', '#64748b'],
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    })
    map.addLayer({
      id: 'event-object-selected-label',
      type: 'symbol',
      source: 'event-objects',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']],
      layout: {
        'text-field': ['get', 'title'],
        'text-font': labelFontRef.current,
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 1.4],
        'text-max-width': 18,
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#0f172a',
        'text-halo-width': 2,
      },
    })
    map.addLayer({
      id: 'event-object-clusters',
      type: 'circle',
      source: 'event-objects',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#334155',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 24],
        'circle-stroke-color': '#cbd5e1',
        'circle-stroke-width': 1.5,
      },
    })
    map.addLayer({
      id: 'event-object-cluster-count',
      type: 'symbol',
      source: 'event-objects',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': labelFontRef.current,
        'text-size': 12,
      },
      paint: { 'text-color': '#ffffff' },
    })
  }, [ready, featureCollection])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || fittedRef.current || value || featureCollection.features.length === 0) {
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    for (const feature of featureCollection.features) {
      bounds.extend(feature.geometry.coordinates as [number, number])
    }
    fittedRef.current = true
    map.fitBounds(bounds, { padding: 38, maxZoom: 12, duration: 0 })
  }, [ready, value, featureCollection])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('event-object-selected')) return
    const filter: maplibregl.FilterSpecification = [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'id'], value],
    ]
    map.setFilter('event-object-selected', filter)
    map.setFilter('event-object-selected-label', filter)

    const selected = objects.find((object) => object.id === value)
    if (!selected || selected.lng === null || selected.lat === null) return
    map.easeTo({
      center: [selected.lng, selected.lat],
      // clusterMaxZoom=14: на z15 выбранная точка гарантированно уже не в кластере.
      zoom: Math.max(map.getZoom(), 15.1),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
    })
  }, [ready, value, objects])

  return (
    <div
      role="region"
      aria-label="Выбор памятника на карте"
      aria-describedby={helpId}
      className="relative h-80 min-h-64 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100"
    >
      <p id={helpId} className="sr-only">
        Выберите точку мышью или касанием. Для выбора с клавиатуры используйте поиск памятника.
      </p>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/85 text-sm text-slate-500">
          Загружаем карту…
        </div>
      )}
      {failed && (
        <div role="status" className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
          Карта не загрузилась. Выберите памятник через поиск.
        </div>
      )}
      {ready && featureCollection.features.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-slate-600 shadow">
          Нет памятников с координатами
        </div>
      )}
    </div>
  )
}
