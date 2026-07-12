'use client'

import type { CategoryDto } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
  activeCats: ReadonlySet<string>
  activeDistrictName: string | null
  onShowAll: () => void
  onToggleCat: (id: string) => void
  onClearDistrict: () => void
}

/** Быстрые фильтры под строкой поиска: чипы категорий + активный округ */
export default function CategoryChips({
  categories,
  activeCats,
  activeDistrictName,
  onShowAll,
  onToggleCat,
  onClearDistrict,
}: Props) {
  const allActive = activeCats.size === categories.length

  return (
    <div className="scrollbar-none -mx-1 mt-2 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-2" aria-label="Категории объектов">
      <button
        type="button"
        onClick={onShowAll}
        aria-pressed={allActive}
        className={`category-chip panel flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition-all ${
          allActive ? 'category-chip--active text-[var(--ink)]' : 'text-[var(--ink-subtle)]'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="4" cy="4" r="1.5" fill="currentColor" />
          <circle cx="12" cy="4" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        Все
      </button>
      {categories.map((c) => {
        const on = activeCats.has(c.id) && !allActive
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggleCat(c.id)}
            aria-pressed={on}
            className={`category-chip panel flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition-all ${
              on ? 'category-chip--active text-[var(--ink)]' : 'text-[var(--ink-subtle)] opacity-70 hover:opacity-100'
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: c.color }}
              aria-hidden
            />
            {c.title}
          </button>
        )
      })}

      {activeDistrictName && (
        <button
          type="button"
          onClick={onClearDistrict}
          title="Сбросить фильтр по округу"
          className="category-chip panel flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--accent)]"
        >
          {activeDistrictName} округ
          <span aria-hidden className="text-[var(--ink-subtle)]">✕</span>
        </button>
      )}
    </div>
  )
}
