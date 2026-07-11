'use client'

import type { CategoryDto } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
  activeCats: ReadonlySet<string>
  activeDistrictName: string | null
  onToggleCat: (id: string) => void
  onClearDistrict: () => void
}

/** Быстрые фильтры под строкой поиска: чипы категорий + активный округ */
export default function CategoryChips({
  categories,
  activeCats,
  activeDistrictName,
  onToggleCat,
  onClearDistrict,
}: Props) {
  return (
    <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {categories.map((c) => {
        const on = activeCats.has(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggleCat(c.id)}
            aria-pressed={on}
            className={`panel flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity ${
              on ? '' : 'opacity-55'
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: on ? c.color : 'var(--ink-subtle)' }}
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
          className="panel flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs font-medium"
        >
          {activeDistrictName} округ
          <span aria-hidden className="text-[var(--ink-subtle)]">✕</span>
        </button>
      )}
    </div>
  )
}
