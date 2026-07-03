'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MapView from './MapView'
import FilterPanel from './FilterPanel'
import ObjectCard from './ObjectCard'
import type { CategoryDto, ObjectFeatureProps, StatRow } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
}

type FC = GeoJSON.FeatureCollection

export default function MapApp({ categories }: Props) {
  const searchParams = useSearchParams()

  const [objectsFC, setObjectsFC] = useState<FC | null>(null)
  const [districtsFC, setDistrictsFC] = useState<FC | null>(null)
  const [stats, setStats] = useState<StatRow[]>([])
  const [activeCats, setActiveCats] = useState<ReadonlySet<string>>(
    () => new Set(categories.map((c) => c.id))
  )
  const [activeDistrict, setActiveDistrict] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('object'))
  const [fitDistrict, setFitDistrict] = useState<{ districtId: number; tick: number } | null>(null)

  useEffect(() => {
    fetch('/api/objects')
      .then((r) => r.json())
      .then(setObjectsFC)
      .catch(() => setObjectsFC({ type: 'FeatureCollection', features: [] }))
    fetch('/api/districts')
      .then((r) => r.json())
      .then(setDistrictsFC)
      .catch(() => setDistrictsFC({ type: 'FeatureCollection', features: [] }))
  }, [])

  // статистика считается на сервере (view/SQL), при смене категорий — перезапрос
  useEffect(() => {
    const all = activeCats.size === categories.length
    const url = all ? '/api/stats' : `/api/stats?categories=${[...activeCats].join(',')}`
    fetch(url)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats([]))
  }, [activeCats, categories.length])

  // шаринг: /?object=<id>
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedId) url.searchParams.set('object', selectedId)
    else url.searchParams.delete('object')
    window.history.replaceState(null, '', url)
  }, [selectedId])

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

  const selected = useMemo(() => {
    if (!selectedId || !objectsFC) return null
    const f = objectsFC.features.find(
      (ft) => (ft.properties as unknown as ObjectFeatureProps).id === selectedId
    )
    if (!f || f.geometry.type !== 'Point') return null
    const [lng, lat] = f.geometry.coordinates
    return { id: selectedId, lng: lng ?? 0, lat: lat ?? 0 }
  }, [selectedId, objectsFC])

  const selectDistrict = (id: number | null) => {
    setActiveDistrict(id)
    if (id !== null) setFitDistrict((p) => ({ districtId: id, tick: (p?.tick ?? 0) + 1 }))
  }

  const selectDistrictByName = (name: string) => {
    const d = districtOptions.find((o) => o.name === name)
    if (d) selectDistrict(d.id)
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        categories={categories}
        objects={filteredFC}
        districts={districtsFC}
        selected={selected}
        fitDistrict={fitDistrict}
        onSelect={setSelectedId}
      />
      <FilterPanel
        categories={categories}
        districts={districtOptions}
        activeCats={activeCats}
        activeDistrict={activeDistrict}
        stats={stats}
        onToggleCat={(id) =>
          setActiveCats((prev) => {
            const nextSet = new Set(prev)
            if (nextSet.has(id)) nextSet.delete(id)
            else nextSet.add(id)
            return nextSet
          })
        }
        onDistrict={selectDistrict}
        onDistrictByName={selectDistrictByName}
      />
      {selectedId && <ObjectCard id={selectedId} onClose={() => setSelectedId(null)} />}
    </main>
  )
}
