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
    <div className="space-y-5">
      <fieldset>
        <legend className="eyebrow mb-2.5">Категории</legend>
        <div className="space-y-0.5">
          {categories.map((c) => (
            <label
              key={c.id}
              className="-mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={activeCats.has(c.id)}
                onChange={() => onToggleCat(c.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: c.color }}
                aria-hidden
              />
              <span className="text-[var(--ink)]/90">{c.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="district-select" className="eyebrow mb-1.5 block">
          Округ
        </label>
        <select
          id="district-select"
          value={activeDistrict ?? ''}
          onChange={(e) => onDistrict(e.target.value ? Number(e.target.value) : null)}
          className="field"
        >
          <option value="">Все округа</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-[var(--hairline)] pt-4">
        <StatsPanel stats={stats} onDistrictClick={onDistrictByName} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: карточка слева сверху */}
      <div className="panel absolute left-4 top-4 z-10 hidden w-80 rounded-2xl p-5 md:block">
        <h1 className="mb-4 text-[15px] font-semibold leading-tight text-[var(--ink)]">
          Памятные объекты Тюмени
        </h1>
        {body}
      </div>

      {/* Mobile: шторка снизу */}
      <div className="absolute inset-x-0 bottom-0 z-10 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="panel mx-auto mb-2 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-[var(--ink)]"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />
          Фильтры и статистика
          <span className="text-[var(--ink-subtle)]" aria-hidden>
            {open ? '▾' : '▴'}
          </span>
        </button>
        {open && (
          <div className="panel panel-scroll max-h-[60vh] overflow-y-auto rounded-t-2xl p-5 pb-6">
            {body}
          </div>
        )}
      </div>
    </>
  )
}
