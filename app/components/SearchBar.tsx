'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'

interface DistrictOption {
  id: number
  name: string
}

interface Props {
  objects: GeoJSON.FeatureCollection | null
  categories: CategoryDto[]
  districts: DistrictOption[]
  onPickObject: (id: string) => void
  onPickCategory: (id: string) => void
  onPickDistrict: (id: number) => void
}

interface Suggestion {
  kind: 'object' | 'category' | 'district'
  key: string
  label: string
  sub: string
  color?: string
  pick: () => void
}

/** служебные слова, не сужающие поиск («Калининский район» → «Калининский») */
const STOP_WORDS = new Set(['район', 'районе', 'округ', 'округе', 'ао', 'г', 'город', 'тюмень', 'тюмени'])

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
const toWords = (s: string) => norm(s).split(/[^a-zа-я0-9]+/).filter(Boolean)

/** нестрогое сравнение слов: «исторические» ≈ «историческая» (общий корень) */
function wordMatch(qw: string, tw: string): boolean {
  if (tw.startsWith(qw)) return true
  if (qw.length < 4 || tw.length < 4) return false
  let i = 0
  while (i < qw.length && i < tw.length && qw[i] === tw[i]) i++
  return i >= 4 && i >= Math.min(qw.length, tw.length) - 2
}

function matches(queryWords: string[], target: string): boolean {
  const tw = toWords(target)
  return queryWords.every((qw) => STOP_WORDS.has(qw) || tw.some((w) => wordMatch(qw, w)))
}

/** Умный поиск: одна строка находит памятники, категории и округа */
export default function SearchBar({
  objects,
  categories,
  districts,
  onPickObject,
  onPickCategory,
  onPickDistrict,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim()
    if (q.length < 2) return []
    const qws = toWords(q)
    if (!qws.length) return []
    const meaningful = qws.some((w) => !STOP_WORDS.has(w))
    const out: Suggestion[] = []

    // округа/районы
    for (const d of districts) {
      if (matches(qws, `${d.name} округ район`)) {
        out.push({
          kind: 'district',
          key: `d${d.id}`,
          label: `${d.name} округ`,
          sub: 'Показать памятники округа',
          pick: () => onPickDistrict(d.id),
        })
      }
    }
    if (!meaningful) return out.slice(0, 6)

    // категории (темы)
    for (const c of categories) {
      if (matches(qws, `${c.title} памятники`)) {
        out.push({
          kind: 'category',
          key: `c${c.id}`,
          label: c.title,
          sub: 'Категория — отфильтровать карту',
          color: c.color,
          pick: () => onPickCategory(c.id),
        })
      }
    }

    // памятники по названию
    let found = 0
    for (const f of objects?.features ?? []) {
      if (found >= 6) break
      const p = f.properties as unknown as ObjectFeatureProps
      if (matches(qws, p.title)) {
        found++
        out.push({
          kind: 'object',
          key: `o${p.id}`,
          label: p.title,
          sub: 'Памятник',
          pick: () => onPickObject(p.id),
        })
      }
    }
    return out
  }, [query, objects, categories, districts, onPickObject, onPickCategory, onPickDistrict])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!open) return
    document.getElementById(`${listboxId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, listboxId])

  // клик мимо — закрыть подсказки
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  const pick = (s: Suggestion) => {
    s.pick()
    setQuery(s.kind === 'object' ? s.label : '')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = suggestions[active] ?? suggestions[0]
      if (s) pick(s)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showEmpty = open && query.trim().length >= 2 && suggestions.length === 0

  return (
    <div ref={rootRef} className="relative">
      <div className="search-surface panel flex h-14 items-center gap-3 rounded-2xl px-4 transition-all">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--ink-subtle)]">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Памятник, категория или округ…"
          aria-label="Поиск по карте"
          role="combobox"
          aria-expanded={open && (suggestions.length > 0 || showEmpty)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions[active] ? `${listboxId}-${active}` : undefined}
          autoComplete="off"
          className="w-full bg-transparent text-[15px] font-medium text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-subtle)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setOpen(false)
            }}
            aria-label="Очистить поиск"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-subtle)] transition-colors hover:bg-white/[0.06] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || showEmpty) && (
        <div id={listboxId} role="listbox" className="search-results panel panel-scroll absolute inset-x-0 top-full z-30 mt-2 max-h-[min(420px,56vh)] overflow-y-auto rounded-2xl p-1.5">
          {showEmpty && (
            <p role="status" className="px-4 py-2.5 text-sm text-[var(--ink-muted)]">Ничего не найдено</p>
          )}
          {suggestions.map((s, i) => (
            <button
              key={s.key}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === active}
              type="button"
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                i === active ? 'bg-white/[0.075]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-[var(--ink-muted)]">
                {s.kind === 'object' && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>
                )}
                {s.kind === 'district' && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" stroke="currentColor" strokeWidth="1.6"/><path d="M8 3v15m8-12v15" stroke="currentColor" strokeWidth="1.6"/></svg>
                )}
                {s.kind === 'category' && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--ink)]">{s.label}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--ink-subtle)]">{s.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
