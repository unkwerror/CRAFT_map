'use client'

import { useState } from 'react'
import type { CategoryDto, StatRow } from '@/lib/types'
import StatsPanel from './StatsPanel'

interface DistrictOption {
  id: number
  name: string
}

interface Props {
  categories: CategoryDto[]
  districts: DistrictOption[]
  activeCats: ReadonlySet<string>
  activeDistrict: number | null
  stats: StatRow[]
  onToggleCat: (id: string) => void
  onDistrict: (id: number | null) => void
  onDistrictByName: (name: string) => void
}

/** Фильтры + статистика: карточка слева (desktop) / шторка снизу (mobile) */
export default function FilterPanel({
  categories,
  districts,
  activeCats,
  activeDistrict,
  stats,
  onToggleCat,
  onDistrict,
  onDistrictByName,
}: Props) {
  const [open, setOpen] = useState(false)

  const body = (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          Категории
        </legend>
        <div className="space-y-1.5">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={activeCats.has(c.id)}
                onChange={() => onToggleCat(c.id)}
                className="h-4 w-4 accent-white"
              />
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ background: c.color }}
                aria-hidden
              />
              <span className="text-white/90">{c.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="district-select"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
        >
          Округ
        </label>
        <select
          id="district-select"
          value={activeDistrict ?? ''}
          onChange={(e) => onDistrict(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-white/15 bg-[#16324e] px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        >
          <option value="">Все округа</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <StatsPanel stats={stats} onDistrictClick={onDistrictByName} />
    </div>
  )

  return (
    <>
      {/* Desktop: карточка слева сверху */}
      <div className="absolute left-4 top-4 z-10 hidden w-80 rounded-2xl bg-[#122a42]/90 p-4 shadow-xl backdrop-blur md:block">
        <h1 className="mb-3 text-base font-bold leading-tight text-white">
          Памятные объекты Тюмени
        </h1>
        {body}
      </div>

      {/* Mobile: шторка снизу */}
      <div className="absolute inset-x-0 bottom-0 z-10 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mx-auto mb-2 flex items-center gap-2 rounded-full bg-[#122a42]/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[#F0A93B]" aria-hidden />
          Фильтры и статистика
          <span aria-hidden>{open ? '▾' : '▴'}</span>
        </button>
        {open && (
          <div className="panel-scroll max-h-[60vh] overflow-y-auto rounded-t-2xl bg-[#122a42]/95 p-4 pb-6 shadow-2xl backdrop-blur">
            {body}
          </div>
        )}
      </div>
    </>
  )
}
