'use client'

import maplibregl from 'maplibre-gl'
import type { Map as MLMap } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle } from '@/lib/map-style'
import { formatWalkMinutes, type RouteLeg } from '@/lib/route-legs'

let protocolAdded = false

export interface RouteMapStop {
  id: string
  title: string
  lat: number
  lng: number
  /** Номер точки на маркере, 1..n */
  number: number
}

/** Обзорная мини-карта маршрута с нумерованными точками. Доступная альтернатива — список точек рядом. */
export default function RouteMap({ stops, legs }: { stops: RouteMapStop[]; legs?: RouteLeg[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current || stops.length === 0) return
    let cancelled = false
    let observer: ResizeObserver | null = null
    if (!protocolAdded) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolAdded = true
    }
    resolveMapStyle().then(({ style, labelFont }) => {
      if (cancelled || !containerRef.current) return
      const bounds = new maplibregl.LngLatBounds()
      for (const stop of stops) bounds.extend([stop.lng, stop.lat])
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        bounds,
        fitBoundsOptions: { padding: 56, maxZoom: 15.5 },
        attributionControl: { compact: true },
        // Скролл страницы не должен «залипать» на встроенной карте.
        cooperativeGestures: true,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Чтобы изменить масштаб, прокручивайте с зажатым Ctrl',
          'CooperativeGesturesHandler.MacHelpText': 'Чтобы изменить масштаб, прокручивайте с зажатым ⌘',
          'CooperativeGesturesHandler.MobileHelpText': 'Перемещайте карту двумя пальцами',
        },
      })
      for (const stop of stops) {
        const el = document.createElement('div')
        el.className = 'route-map-marker'
        el.textContent = String(stop.number)
        el.title = stop.title
        new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map)
      }
      // Контейнер может домериться после создания карты (шрифты, layout) —
      // без resize канвас остаётся 400px и точки уезжают из кадра.
      const refit = () => {
        map.resize()
        map.fitBounds(bounds, { padding: 56, maxZoom: 15.5, animate: false })
      }
      const walkLegs = (legs ?? []).filter((leg) => leg.coordinates.length >= 2)
      map.once('load', () => {
        if (walkLegs.length) {
          map.addSource('route-page-path', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: walkLegs.map((leg) => ({
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: leg.coordinates },
                properties: {},
              })),
            },
          })
          map.addSource('route-page-times', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: walkLegs.map((leg) => ({
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: leg.coordinates[Math.floor(leg.coordinates.length / 2)]!,
                },
                properties: { label: formatWalkMinutes(leg.seconds) },
              })),
            },
          })
          map.addLayer({
            id: 'route-page-line',
            type: 'line',
            source: 'route-page-path',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#efad45', 'line-width': 3.5, 'line-opacity': 0.85 },
          })
          map.addLayer({
            id: 'route-page-time-labels',
            type: 'symbol',
            source: 'route-page-times',
            layout: {
              'text-field': ['get', 'label'],
              'text-font': labelFont,
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
        refit()
      })
      observer = new ResizeObserver(() => {
        if (mapRef.current) refit()
      })
      observer.observe(containerRef.current)
      mapRef.current = map
    })
    return () => {
      cancelled = true
      observer?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Карта строится один раз: состав точек опубликованного маршрута в рамках визита не меняется.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (stops.length === 0) return null
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Карта маршрута: точек — ${stops.length}. Полный список точек приведён ниже.`}
      className="h-64 w-full overflow-hidden rounded-2xl border border-[var(--hairline)] md:h-80"
    />
  )
}
