'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MapView from './MapView'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import ObjectCard from './ObjectCard'
import MapPreloader from './MapPreloader'
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
  const [dataReady, setDataReady] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [showPreloader, setShowPreloader] = useState(true)
  const [loadIssue, setLoadIssue] = useState(false)
  const [mapIssue, setMapIssue] = useState(false)

  const loadData = useCallback(async () => {
    setDataReady(false)
    setLoadIssue(false)
    const fetchGeoJson = async (url: string): Promise<FC> => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return response.json() as Promise<FC>
    }
    const [objectResult, districtResult] = await Promise.allSettled([
      fetchGeoJson('/api/objects'),
      fetchGeoJson('/api/districts'),
    ])
    if (objectResult.status === 'fulfilled') setObjectsFC(objectResult.value)
    else setObjectsFC({ type: 'FeatureCollection', features: [] })
    if (districtResult.status === 'fulfilled') setDistrictsFC(districtResult.value)
    else setDistrictsFC({ type: 'FeatureCollection', features: [] })
    setLoadIssue(objectResult.status === 'rejected' || districtResult.status === 'rejected')
    setDataReady(true)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if ((!mapReady && !mapIssue) || !dataReady) return
    const timer = window.setTimeout(() => setShowPreloader(false), 420)
    return () => window.clearTimeout(timer)
  }, [mapReady, mapIssue, dataReady])

  useEffect(() => {
    if (mapReady) return
    const timer = window.setTimeout(() => setMapIssue(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [mapReady])

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

  const showAllCategories = useCallback(() => {
    setActiveCats(new Set(categories.map((category) => category.id)))
  }, [categories])

  const closeObject = useCallback(() => setSelectedId(null), [])

  return (
    <main className="map-shell relative h-dvh w-full overflow-hidden">
      <MapView
        categories={categories}
        objects={filteredFC}
        districts={districtsFC}
        selected={selected}
        fitDistrict={fitDistrict}
        onSelect={setSelectedId}
        onReady={() => {
          setMapReady(true)
          setMapIssue(false)
        }}
        onError={() => setMapIssue(true)}
      />

      <header className={`pointer-events-none absolute inset-x-0 top-0 z-10 p-3 md:p-5 ${selectedId ? 'md:pr-[460px]' : ''}`}>
        <div className="mx-auto flex max-w-[1480px] items-start gap-3">
          <div className={`brand-panel panel pointer-events-auto h-14 w-[252px] shrink-0 items-center gap-3 rounded-2xl px-3.5 ${selectedId ? 'hidden xl:flex' : 'hidden md:flex'}`}>
            <div className="brand-panel__crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gerb-tyumen.svg" alt="" className="h-8 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">Память Тюмени</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-subtle)]">Истории, сохранённые городом</p>
            </div>
          </div>

          <div className="pointer-events-auto min-w-0 flex-1 md:max-w-[620px]">
            <SearchBar
              objects={objectsFC}
              categories={categories}
              districts={districtOptions}
              onPickObject={pickObject}
              onPickCategory={pickCategory}
              onPickDistrict={selectDistrict}
            />
            <CategoryChips
              categories={categories}
              activeCats={activeCats}
              activeDistrictName={activeDistrictName}
              onShowAll={showAllCategories}
              onToggleCat={(id) =>
                setActiveCats((prev) => {
                  if (prev.size === categories.length) return new Set([id])
                  const nextSet = new Set(prev)
                  if (nextSet.has(id)) nextSet.delete(id)
                  else nextSet.add(id)
                  return nextSet
                })
              }
              onClearDistrict={() => setActiveDistrict(null)}
            />
          </div>
        </div>
      </header>

      <div className="brand-panel panel absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-10 flex h-11 items-center gap-2.5 rounded-2xl px-2.5 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gerb-tyumen.svg" alt="" className="h-7 w-auto" />
        <p className="pr-1 text-xs font-semibold">Память Тюмени</p>
      </div>

      {(loadIssue || mapIssue) && !showPreloader && (
        <div className="panel absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl" role="alert">
          <span className="text-[var(--ink-muted)]">{mapIssue ? 'Не удалось загрузить карту' : 'Часть данных не загрузилась'}</span>
          <button type="button" onClick={() => mapIssue ? window.location.reload() : void loadData()} className="font-semibold text-[var(--accent)]">
            Повторить
          </button>
        </div>
      )}

      {activeCats.size === 0 && !showPreloader && (
        <div className="panel absolute left-1/2 top-1/2 z-10 w-[min(320px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold">Все категории скрыты</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
            Выберите категорию сверху или верните все объекты.
          </p>
          <button type="button" onClick={showAllCategories} className="btn-accent mt-4 min-h-11 rounded-xl px-4 text-sm">
            Показать все
          </button>
        </div>
      )}

      {selectedId && <ObjectCard id={selectedId} onClose={closeObject} />}

      {showPreloader && (
        <MapPreloader
          progress={12 + (dataReady ? 44 : 0) + (mapReady || mapIssue ? 44 : 0)}
          label={!dataReady ? 'Загружаем объекты' : !mapReady && !mapIssue ? 'Настраиваем карту' : mapIssue ? 'Проверяем соединение' : 'Готово'}
          leaving={(mapReady || mapIssue) && dataReady}
        />
      )}
    </main>
  )
}
