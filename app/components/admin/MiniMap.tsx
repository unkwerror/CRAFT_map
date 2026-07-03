'use client'

import maplibregl from 'maplibre-gl'
import type { Map as MLMap, Marker } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle, TYUMEN_CENTER } from '@/lib/map-style'

let protocolAdded = false

interface Props {
  lng: number | null
  lat: number | null
  onChange: (lng: number, lat: number) => void
}

/** Мини-карта в форме объекта: координата ставится кликом, маркер можно перетаскивать */
export default function MiniMap({ lng, lat, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    if (!protocolAdded) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolAdded = true
    }

    const hasInitial = lng !== null && lat !== null

    resolveMapStyle().then(({ style }) => {
      if (cancelled || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: hasInitial ? [lng, lat] : TYUMEN_CENTER,
        zoom: hasInitial ? 14.5 : 11,
        attributionControl: { compact: true },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

      const setMarker = (lngLat: [number, number]) => {
        if (!markerRef.current) {
          markerRef.current = new maplibregl.Marker({ color: '#E14B4B', draggable: true })
            .setLngLat(lngLat)
            .addTo(map)
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current?.getLngLat()
            if (pos) onChangeRef.current(Number(pos.lng.toFixed(6)), Number(pos.lat.toFixed(6)))
          })
        } else {
          markerRef.current.setLngLat(lngLat)
        }
      }

      if (hasInitial) setMarker([lng, lat])

      map.on('click', (e) => {
        const pos: [number, number] = [
          Number(e.lngLat.lng.toFixed(6)),
          Number(e.lngLat.lat.toFixed(6)),
        ]
        setMarker(pos)
        onChangeRef.current(pos[0], pos[1])
      })

      mapRef.current = map
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // синхронизация при ручном вводе координат в поля формы
  useEffect(() => {
    if (lng === null || lat === null) return
    markerRef.current?.setLngLat([lng, lat])
  }, [lng, lat])

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-xl border border-slate-300"
    />
  )
}
