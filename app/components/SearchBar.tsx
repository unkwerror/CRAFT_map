'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import { rankSearchMatch } from '@/lib/map-search'
import type { CategoryDto, ObjectFeatureProps } from '@/lib/types'

interface DistrictOption {
  id: number
  name: string
}

interface Props {
  objects: GeoJSON.FeatureCollection | null
  categories: CategoryDto[]
  districts: DistrictOption[]
  loading: boolean
  onPickObject: (id: string) => void
  onPickCategory: (id: string) => void
  onPickDistrict: (id: number) => void
  onPreviewObject: (id: string | null) => void
}

type SuggestionKind = 'object' | 'category' | 'district'

interface Suggestion {
  kind: SuggestionKind
  id: string
  key: string
  label: string
  sub: string
  color?: string
  thumb?: string
  target: {
    title: string
    address?: string | null
    category?: string | null
    district?: string | null
  }
  pick: () => void
}

interface RankedSuggestion extends Suggestion {
  rank: number
}

interface RecentItem {
  kind: SuggestionKind
  id: string
}

const RECENT_SEARCH_KEY = 'craft-map-recent-searches'

function placeWord(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'мест'
  if (mod10 === 1) return 'место'
  if (mod10 >= 2 && mod10 <= 4) return 'места'
  return 'мест'
}

function ResultIcon({ suggestion }: { suggestion: Suggestion }) {
  if (suggestion.kind === 'object' && suggestion.thumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={suggestion.thumb} alt="" className="h-full w-full object-cover" />
    )
  }
  if (suggestion.kind === 'district') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3v15m8-12v15" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (suggestion.kind === 'category') {
    return (
      <span
        className="inline-block h-3 w-3 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.05)]"
        style={{ background: suggestion.color }}
      />
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2" fill="currentColor" />
    </svg>
  )
}

/** Поиск и режим исследования карты в одной устойчивой панели. */
export default function SearchBar({
  objects,
  categories,
  districts,
  loading,
  onPickObject,
  onPickCategory,
  onPickDistrict,
  onPreviewObject,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  const districtById = useMemo(
    () => new Map(districts.map((district) => [district.id, district])),
    [districts]
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const category of categories) counts.set(category.id, 0)
    for (const feature of objects?.features ?? []) {
      const props = feature.properties as unknown as ObjectFeatureProps
      counts.set(props.category, (counts.get(props.category) ?? 0) + 1)
    }
    return counts
  }, [objects, categories])

  const districtCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const district of districts) counts.set(district.id, 0)
    for (const feature of objects?.features ?? []) {
      const props = feature.properties as unknown as ObjectFeatureProps
      if (props.district !== null) {
        counts.set(props.district, (counts.get(props.district) ?? 0) + 1)
      }
    }
    return counts
  }, [objects, districts])

  const entries = useMemo<Suggestion[]>(() => {
    const result: Suggestion[] = []

    for (const feature of objects?.features ?? []) {
      const props = feature.properties as unknown as ObjectFeatureProps
      const category = categoryById.get(props.category)
      const district = props.district === null ? undefined : districtById.get(props.district)
      const location = props.address || (district ? `${district.name} округ` : 'Тюмень')
      result.push({
        kind: 'object',
        id: props.id,
        key: `object:${props.id}`,
        label: props.title,
        sub: [category?.title, location].filter(Boolean).join(' · '),
        color: category?.color,
        thumb: props.thumb || undefined,
        target: {
          title: props.title,
          address: props.address,
          category: category?.title,
          district: district ? `${district.name} округ` : null,
        },
        pick: () => onPickObject(props.id),
      })
    }

    for (const category of categories) {
      const count = categoryCounts.get(category.id) ?? 0
      result.push({
        kind: 'category',
        id: category.id,
        key: `category:${category.id}`,
        label: category.title,
        sub: `${count} ${placeWord(count)} в категории`,
        color: category.color,
        target: { title: category.title, category: `${category.title} памятники` },
        pick: () => onPickCategory(category.id),
      })
    }

    for (const district of districts) {
      const count = districtCounts.get(district.id) ?? 0
      result.push({
        kind: 'district',
        id: String(district.id),
        key: `district:${district.id}`,
        label: `${district.name} округ`,
        sub: `${count} ${placeWord(count)} · приблизить на карте`,
        target: { title: `${district.name} округ`, district: `${district.name} район` },
        pick: () => onPickDistrict(district.id),
      })
    }

    return result
  }, [objects, categories, districts, categoryById, districtById, categoryCounts, districtCounts, onPickObject, onPickCategory, onPickDistrict])

  const entryByKey = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries]
  )

  const search = useMemo(() => {
    if (query.trim().length < 2) {
      return { suggestions: [] as RankedSuggestion[], objectMatchCount: 0 }
    }
    const ranked = entries
      .map((entry) => {
        const rank = rankSearchMatch(query, entry.target)
        return rank === null ? null : { ...entry, rank }
      })
      .filter((entry): entry is RankedSuggestion => entry !== null)

    const objectsFound = ranked
      .filter((entry) => entry.kind === 'object')
      .sort((left, right) => right.rank - left.rank || left.label.localeCompare(right.label, 'ru'))
    const filtersFound = ranked
      .filter((entry) => entry.kind !== 'object')
      .sort((left, right) => right.rank - left.rank || left.label.localeCompare(right.label, 'ru'))
    const objectResults = objectsFound.slice(0, 6)
    const filterResults = filtersFound.slice(0, 3)
    const filterFirst = (filterResults[0]?.rank ?? -1) > (objectResults[0]?.rank ?? -1)

    return {
      suggestions: filterFirst
        ? [...filterResults, ...objectResults]
        : [...objectResults, ...filterResults],
      objectMatchCount: objectsFound.length,
    }
  }, [query, entries])

  const featured = useMemo(
    () => entries.filter((entry) => entry.kind === 'object').slice(0, 3),
    [entries]
  )
  const recentEntries = useMemo(
    () => recent
      .map((item) => entryByKey.get(`${item.kind}:${item.id}`))
      .filter((entry): entry is Suggestion => Boolean(entry)),
    [recent, entryByKey]
  )

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY) ?? '[]') as unknown
      if (Array.isArray(parsed)) {
        setRecent(
          parsed
            .filter((item): item is RecentItem => {
              if (!item || typeof item !== 'object') return false
              const value = item as Partial<RecentItem>
              return (
                (value.kind === 'object' || value.kind === 'category' || value.kind === 'district') &&
                typeof value.id === 'string'
              )
            })
            .slice(0, 5)
        )
      }
    } catch {
      // Повреждённая история не должна ломать поиск.
    }
  }, [])

  useEffect(() => setActive(0), [query, search.suggestions.length])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key !== '/' || isTyping || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      inputRef.current?.focus()
      setOpen(true)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    if (!open || !search.suggestions.length) return
    document.getElementById(`${panelId}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, panelId, search.suggestions.length])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      onPreviewObject(null)
      return
    }
    const suggestion = search.suggestions[active]
    onPreviewObject(suggestion?.kind === 'object' ? suggestion.id : null)
  }, [active, open, query, search.suggestions, onPreviewObject])

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        onPreviewObject(null)
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open, onPreviewObject])

  useEffect(() => () => onPreviewObject(null), [onPreviewObject])

  const remember = (suggestion: Suggestion) => {
    setRecent((current) => {
      const next = [
        { kind: suggestion.kind, id: suggestion.id },
        ...current.filter((item) => !(item.kind === suggestion.kind && item.id === suggestion.id)),
      ].slice(0, 5)
      try {
        window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next))
      } catch {
        // private mode / запрещённое хранилище: поиск продолжает работать без истории
      }
      return next
    })
  }

  const pick = (suggestion: Suggestion) => {
    remember(suggestion)
    suggestion.pick()
    setQuery(suggestion.kind === 'object' ? suggestion.label : '')
    setOpen(false)
    onPreviewObject(null)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      onPreviewObject(null)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      onPreviewObject(null)
      return
    }
    if (!open || !search.suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, search.suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(search.suggestions.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const suggestion = search.suggestions[active] ?? search.suggestions[0]
      if (suggestion) pick(suggestion)
    }
  }

  const normalizedLength = query.trim().length
  const listboxOpen = open && normalizedLength >= 2 && search.suggestions.length > 0
  const showLoading = open && loading && normalizedLength >= 2
  const showEmpty = open && !loading && normalizedLength >= 2 && search.suggestions.length === 0
  const showQuick = open && query.trim().length === 0
  const showShortHint = open && query.trim().length > 0 && normalizedLength < 2

  const renderResult = (suggestion: RankedSuggestion, index: number) => (
    <button
      key={suggestion.key}
      id={`${panelId}-option-${index}`}
      role="option"
      aria-selected={index === active}
      tabIndex={-1}
      type="button"
      onClick={() => pick(suggestion)}
      onMouseEnter={() => {
        setActive(index)
        onPreviewObject(suggestion.kind === 'object' ? suggestion.id : null)
      }}
      className={`search-result flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
        index === active ? 'search-result--active' : ''
      }`}
    >
      <span aria-hidden className="search-result__visual flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[var(--ink-muted)]">
        <ResultIcon suggestion={suggestion} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{suggestion.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-subtle)]">{suggestion.sub}</span>
      </span>
      <svg className="search-result__arrow shrink-0 text-[var(--ink-subtle)]" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  const objectResults = search.suggestions.filter((suggestion) => suggestion.kind === 'object')
  const filterResults = search.suggestions.filter((suggestion) => suggestion.kind !== 'object')
  const filtersFirst = search.suggestions[0]?.kind !== 'object'
  const resultGroups = filtersFirst
    ? [
        { label: 'Категории и округа', items: filterResults },
        { label: 'Места', items: objectResults },
      ]
    : [
        { label: 'Места', items: objectResults },
        { label: 'Категории и округа', items: filterResults },
      ]

  return (
    <div ref={rootRef} className="relative">
      <div className={`search-surface panel flex h-14 items-center gap-3 rounded-2xl px-4 ${open ? 'search-surface--open' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--ink-subtle)]">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Название, адрес, категория или округ…"
          aria-label="Поиск по карте"
          role="combobox"
          aria-expanded={listboxOpen}
          aria-controls={listboxOpen ? panelId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && search.suggestions[active] ? `${panelId}-option-${active}` : undefined}
          autoComplete="off"
          className="w-full bg-transparent text-[15px] font-medium text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-subtle)] [&::-webkit-search-cancel-button]:hidden"
        />
        {loading && !query && <span className="search-spinner" aria-label="Загружаем объекты" />}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setOpen(true)
              onPreviewObject(null)
            }}
            aria-label="Очистить поиск"
            className="search-clear flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-subtle)]"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <kbd className="search-shortcut hidden rounded-md px-1.5 py-1 text-[10px] font-medium md:inline-flex">/</kbd>
      </div>

      {open && (
        <div
          id={panelId}
          role={search.suggestions.length ? 'listbox' : undefined}
          onMouseLeave={() => onPreviewObject(null)}
          className="search-results panel panel-scroll absolute inset-x-0 top-full z-30 mt-2 max-h-[min(520px,68vh)] overflow-y-auto rounded-2xl p-1.5"
        >
          {showQuick && (
            <div className="search-discovery p-2">
              <div className="flex items-start justify-between gap-4 px-1 pb-3 pt-1">
                <div>
                  <p className="text-sm font-semibold">Исследуйте памятные места</p>
                  <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                    {objects?.features.length ?? 0} объектов с историями на карте Тюмени
                  </p>
                </div>
                <span className="search-discovery__spark" aria-hidden>✦</span>
              </div>

              {recentEntries.length > 0 && (
                <section className="border-t border-white/[0.07] py-3">
                  <p className="search-group-title px-1">Недавнее</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentEntries.slice(0, 4).map((suggestion) => (
                      <button key={suggestion.key} type="button" onClick={() => pick(suggestion)} className="search-quick-chip">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 7v5l3 2M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M21 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span>{suggestion.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="border-t border-white/[0.07] py-3">
                <p className="search-group-title px-1">Быстрый выбор темы</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 max-[430px]:grid-cols-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => pick(entryByKey.get(`category:${category.id}`)!)}
                      className="search-topic-card"
                      style={{ '--topic-color': category.color } as CSSProperties}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--topic-color)]" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{category.title}</span>
                      <span className="text-[11px] text-[var(--ink-subtle)]">{categoryCounts.get(category.id) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </section>

              {featured.length > 0 && (
                <section className="border-t border-white/[0.07] pt-3">
                  <p className="search-group-title px-1">Интересные места</p>
                  <div className="mt-1.5">
                    {featured.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        onClick={() => pick(suggestion)}
                        onMouseEnter={() => onPreviewObject(suggestion.id)}
                        onMouseLeave={() => onPreviewObject(null)}
                        className="search-featured flex w-full items-center gap-3 rounded-xl p-2 text-left"
                      >
                        <span className="search-result__visual flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[var(--ink-muted)]">
                          <ResultIcon suggestion={suggestion} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{suggestion.label}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-subtle)]">{suggestion.sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {showShortHint && (
            <div className="search-message flex items-center gap-3 px-3 py-3 text-sm text-[var(--ink-muted)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.045]">···</span>
              Введите ещё один символ
            </div>
          )}

          {showLoading && (
            <div className="search-message flex items-center gap-3 px-3 py-3 text-sm text-[var(--ink-muted)]" role="status">
              <span className="search-spinner" />
              Загружаем места для поиска…
            </div>
          )}

          {showEmpty && (
            <div className="search-empty px-4 py-5 text-center" role="status">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.045] text-[var(--ink-subtle)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7"/><path d="m20 20-3.5-3.5M9 9l4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              </span>
              <p className="mt-3 text-sm font-semibold">Ничего не нашли</p>
              <p className="mx-auto mt-1 max-w-[300px] text-xs leading-relaxed text-[var(--ink-subtle)]">
                Попробуйте название улицы, округа или более короткую формулировку.
              </p>
            </div>
          )}

          {normalizedLength >= 2 && search.suggestions.length > 0 && resultGroups.map((group) => {
            if (!group.items.length) return null
            return (
              <section key={group.label} className="search-group py-1">
                <div className="search-group-title flex items-center justify-between px-3 pb-1 pt-1.5">
                  <span>{group.label}</span>
                  {group.label === 'Места' && search.objectMatchCount > 0 && (
                    <span>{search.objectMatchCount} найдено</span>
                  )}
                </div>
                {group.items.map((suggestion) => renderResult(suggestion, search.suggestions.indexOf(suggestion)))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
