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
    <div className="scrollbar-none -mx-1 mt-2 flex max-w-full gap-2 overflow-x-auto px-1 pb-2 md:pr-12">
      {categories.map((c) => {
        const on = activeCats.has(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggleCat(c.id)}
            aria-pressed={on}
            className={`panel flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
              on ? 'border-white/15 bg-[#203d54] text-[var(--ink)]' : 'border-transparent text-[var(--ink-subtle)] opacity-65 hover:bg-white/[0.04] hover:opacity-100'
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
          className="panel flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-[#9b7130] bg-[#3b352c] px-3 text-sm font-medium text-[#f4c46e]"
        >
          {activeDistrictName} округ
          <span aria-hidden className="text-[var(--ink-subtle)]">✕</span>
        </button>
      )}
    </div>
  )
}
