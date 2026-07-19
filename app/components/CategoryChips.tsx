'use client'

import type { CSSProperties } from 'react'
import type { CategoryDto } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
  activeCats: ReadonlySet<string>
  activeDistrictName: string | null
  counts: Record<string, number>
  visibleCount: number
  onShowAll: () => void
  onToggleCat: (id: string) => void
  onClearDistrict: () => void
}

function placeWord(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'мест'
  if (mod10 === 1) return 'место'
  if (mod10 >= 2 && mod10 <= 4) return 'места'
  return 'мест'
}

/** Быстрые фильтры под строкой поиска: чипы категорий + активный округ */
export default function CategoryChips({
  categories,
  activeCats,
  activeDistrictName,
  counts,
  visibleCount,
  onShowAll,
  onToggleCat,
  onClearDistrict,
}: Props) {
  const allActive = activeCats.size === categories.length
  const availableCount = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return (
    <div className="category-strip-wrap">
      <div
        className="category-strip scrollbar-none -mx-1 mt-2 flex w-full max-w-full items-center gap-1.5 overflow-x-auto pb-2 pl-1 pr-8"
        role="group"
        aria-label="Категории объектов"
      >
        <button
          type="button"
          onClick={onShowAll}
          aria-pressed={allActive}
          className={`category-chip panel flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium ${
            allActive ? 'category-chip--active text-[var(--ink)]' : 'text-[var(--ink-subtle)]'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="4" cy="4" r="1.5" fill="currentColor" />
            <circle cx="12" cy="4" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
          Все категории
          <span className="category-chip__count">{availableCount}</span>
        </button>

        {activeDistrictName && (
          <button
            type="button"
            onClick={onClearDistrict}
            title="Сбросить фильтр по округу"
            className="category-chip category-chip--district panel flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--accent)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 3v15m8-12v15" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            {activeDistrictName} округ
            <span aria-hidden className="category-chip__close">✕</span>
          </button>
        )}

        {categories.map((c) => {
          const selected = activeCats.has(c.id)
          const emphasized = selected && !allActive
          const style = {
            '--chip-color': c.color,
          } as CSSProperties
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggleCat(c.id)}
              aria-pressed={selected}
              style={style}
              className={`category-chip category-chip--tinted panel flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium ${
                emphasized
                  ? 'category-chip--active text-[var(--ink)]'
                  : selected
                    ? 'text-[var(--ink-muted)]'
                    : 'category-chip--muted text-[var(--ink-subtle)]'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: c.color }}
                aria-hidden
              />
              {c.title}
              <span className="category-chip__count">{counts[c.id] ?? 0}</span>
            </button>
          )
        })}

        <span className="result-count panel flex h-10 shrink-0 items-center rounded-full px-3 text-xs text-[var(--ink-muted)]" role="status" aria-live="polite">
          <strong>{visibleCount}</strong>&nbsp;{placeWord(visibleCount)} на карте
        </span>
      </div>
    </div>
  )
}
