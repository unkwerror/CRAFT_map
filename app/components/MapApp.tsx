'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MapView from './MapView'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import ObjectCard from './ObjectCard'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
}

type FC = GeoJSON.FeatureCollection

export default function MapApp({ categories }: Props) {
  const searchParams = useSearchParams()

  const [objectsFC, setObjectsFC] = useState<FC | null>(null)
  const [districtsFC, setDistrictsFC] = useState<FC | null>(null)
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

  // выбор из поиска: категория — единственный активный фильтр
  const pickCategory = (id: string) => {
    setActiveCats(new Set([id]))
  }

  const pickObject = (id: string) => {
    // объект мог быть скрыт фильтрами — сбрасываем их, чтобы карточка и маркер были видны
    setActiveCats(new Set(categories.map((c) => c.id)))
    setActiveDistrict(null)
    setSelectedId(id)
  }

  const activeDistrictName =
    activeDistrict === null
      ? null
      : (districtOptions.find((d) => d.id === activeDistrict)?.name ?? null)

  return (
    <main className="map-shell relative h-dvh w-full overflow-hidden">
      <MapView
        categories={categories}
        objects={filteredFC}
        districts={districtsFC}
        selected={selected}
        fitDistrict={fitDistrict}
        onSelect={setSelectedId}
      />

      {/* Поиск: вверху по центру + чипы категорий */}
      <div className="absolute inset-x-3 top-3 z-10 md:left-[324px] md:right-4 md:top-4">
        <div className="max-w-[440px]">
        <SearchBar
          objects={objectsFC}
          categories={categories}
          districts={districtOptions}
          onPickObject={pickObject}
          onPickCategory={pickCategory}
          onPickDistrict={selectDistrict}
        />
        </div>
        <CategoryChips
          categories={categories}
          activeCats={activeCats}
          activeDistrictName={activeDistrictName}
          onToggleCat={(id) =>
            setActiveCats((prev) => {
              const nextSet = new Set(prev)
              if (nextSet.has(id)) nextSet.delete(id)
              else nextSet.add(id)
              return nextSet
            })
          }
          onClearDistrict={() => setActiveDistrict(null)}
        />
      </div>

      {/* Герб Тюмени — привязка к городу */}
      <div className="panel absolute bottom-7 left-3 z-10 flex items-center gap-2.5 rounded-lg px-2.5 py-2 md:bottom-auto md:left-4 md:top-4 md:w-[292px] md:px-3 md:py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gerb-tyumen.svg" alt="Герб Тюмени" className="h-8 w-auto md:h-10" />
        <div className="hidden md:block">
          <p className="text-sm font-semibold leading-tight">Памятные объекты Тюмени</p>
          <p className="text-xs text-[var(--ink-subtle)]">Интерактивная карта</p>
        </div>
      </div>

      {selectedId && <ObjectCard id={selectedId} onClose={() => setSelectedId(null)} />}
    </main>
  )
}
