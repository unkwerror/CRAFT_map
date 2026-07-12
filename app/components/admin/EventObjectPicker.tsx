'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { rankSearchMatch } from '@/lib/map-search'
import type { AdminObjectRow } from '@/lib/types'

const EventObjectMap = dynamic(() => import('./EventObjectMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-sm text-slate-500">
      Загружаем карту…
    </div>
  ),
})

interface Props {
  objects: AdminObjectRow[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  loadError?: string
  error?: string
  disabled?: boolean
}

const RESULT_LIMIT = 10

function objectMeta(object: AdminObjectRow): string {
  return [object.address, object.districtName].filter(Boolean).join(' · ')
}

/** Два равноправных способа выбрать существующий объект: поиск и карта. */
export default function EventObjectPicker({
  objects,
  value,
  onChange,
  loading,
  loadError,
  error,
  disabled = false,
}: Props) {
  const inputId = useId()
  const listboxId = useId()
  const helpId = useId()
  const errorId = useId()
  const mapPanelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressNextEmptySyncRef = useRef(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mapOpen, setMapOpen] = useState(false)
  const [desktop, setDesktop] = useState(false)

  const objectById = useMemo(
    () => new Map(objects.map((object) => [object.id, object])),
    [objects]
  )
  const selected = objectById.get(value)

  const ranked = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      const all = [...objects].sort((left, right) =>
        left.title.localeCompare(right.title, 'ru')
      )
      return { total: all.length, items: all.slice(0, RESULT_LIMIT) }
    }

    const matches = objects
      .map((object) => ({
        object,
        rank: rankSearchMatch(trimmed, {
          title: object.title,
          address: object.address,
          district: object.districtName,
          category: [
            object.published ? 'опубликован опубликованные' : 'скрыт скрытые',
            object.lng === null || object.lat === null ? 'без координат' : '',
          ].join(' '),
        }),
      }))
      .filter((entry): entry is { object: AdminObjectRow; rank: number } =>
        entry.rank !== null
      )
      .sort(
        (left, right) =>
          right.rank - left.rank || left.object.title.localeCompare(right.object.title, 'ru')
      )

    return {
      total: matches.length,
      items: matches.slice(0, RESULT_LIMIT).map((entry) => entry.object),
    }
  }, [objects, query])

  useEffect(() => {
    if (!value && suppressNextEmptySyncRef.current) {
      suppressNextEmptySyncRef.current = false
      return
    }
    setQuery(selected?.title ?? '')
  }, [value, selected?.title])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (ranked.items.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0)
      return
    }
    if (activeIndex < ranked.items.length) return
    setActiveIndex(Math.max(0, ranked.items.length - 1))
  }, [activeIndex, ranked.items.length])

  useEffect(() => {
    if (error) inputRef.current?.focus({ preventScroll: true })
  }, [error])

  useEffect(() => {
    if (!open) return
    document
      .getElementById(`${listboxId}-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId, open])

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', closeOutside)
    return () => window.removeEventListener('pointerdown', closeOutside)
  }, [])

  const commit = (object: AdminObjectRow) => {
    setQuery(object.title)
    setOpen(false)
    onChange(object.id)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      if (selected) setQuery(selected.title)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (ranked.items.length === 0) return
      setActiveIndex((index) => Math.min(index + 1, ranked.items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (ranked.items.length === 0) return
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(Math.max(0, ranked.items.length - 1))
    } else if (event.key === 'Enter' && open) {
      const object = ranked.items[activeIndex]
      if (object) {
        event.preventDefault()
        commit(object)
      }
    }
  }

  const describedBy = [helpId, error ? errorId : ''].filter(Boolean).join(' ')
  const showMap = desktop || mapOpen

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <div className="min-w-0">
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          Памятник / локация *
        </label>
        <p id={helpId} className="mb-2 text-xs text-slate-500">
          Найдите по названию, адресу или округу либо выберите точку на карте.
        </p>

        <div ref={rootRef} className="relative">
          <div
            className={`flex min-h-11 items-center rounded-lg border bg-white px-3 focus-within:ring-2 focus-within:ring-slate-300 ${
              error ? 'border-red-500' : 'border-slate-300 focus-within:border-slate-500'
            }`}
          >
            <svg className="mr-2 shrink-0 text-slate-400" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={open && ranked.items.length > 0 ? listboxId : undefined}
              aria-activedescendant={
                open && ranked.items[activeIndex]
                  ? `${listboxId}-${activeIndex}`
                  : undefined
              }
              aria-required="true"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={describedBy}
              autoComplete="off"
              disabled={disabled}
              value={query}
              placeholder={loading ? 'Загружаем памятники…' : 'Начните вводить название или адрес'}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
                if (value) {
                  suppressNextEmptySyncRef.current = true
                  onChange('')
                }
              }}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:text-slate-400"
            />
            {query && !disabled && (
              <button
                type="button"
                aria-label="Очистить поиск памятника"
                onClick={() => {
                  setQuery('')
                  setOpen(true)
                  onChange('')
                  inputRef.current?.focus()
                }}
                className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          {open && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(20rem,40dvh)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {loading && (
                <p role="status" className="px-3 py-3 text-sm text-slate-500">
                  Загружаем памятники…
                </p>
              )}
              {!loading && loadError && (
                <p role="status" className="px-3 py-3 text-sm text-red-600">
                  {loadError}
                </p>
              )}
              {!loading && !loadError && ranked.items.length === 0 && (
                <p role="status" className="px-3 py-3 text-sm text-slate-500">
                  Ничего не найдено
                </p>
              )}
              {!loading && !loadError && ranked.items.length > 0 && (
                <ul id={listboxId} role="listbox" aria-label="Памятники">
                  {ranked.items.map((object, index) => {
                    const meta = objectMeta(object)
                    const active = index === activeIndex
                    const selectedOption = object.id === value
                    const hasCoords = object.lng !== null && object.lat !== null
                    return (
                      <li key={object.id} role="presentation">
                        <button
                          id={`${listboxId}-${index}`}
                          type="button"
                          role="option"
                          aria-selected={selectedOption}
                          tabIndex={-1}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => commit(object)}
                          className={`flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left ${
                            active ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span aria-hidden className="mt-1 text-slate-400">
                            {selectedOption ? '✓' : '●'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-900">
                              {object.title}
                            </span>
                            {meta && (
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {meta}
                              </span>
                            )}
                            <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                              <span className={`rounded-full px-1.5 py-0.5 ${
                                object.published
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {object.published ? 'опубликован' : 'скрыт'}
                              </span>
                              {!hasCoords && (
                                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                                  без координат
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {!loading && !loadError && ranked.total > RESULT_LIMIT && (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  Показаны первые {RESULT_LIMIT} из {ranked.total}. Уточните запрос.
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        )}

        {selected && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">{selected.title}</p>
            {objectMeta(selected) && (
              <p className="mt-0.5 text-xs text-slate-500">{objectMeta(selected)}</p>
            )}
            {!selected.published && (
              <p className="mt-1 text-xs text-amber-700">
                Объект скрыт: мероприятие появится на публичной карте после публикации.
              </p>
            )}
            {(selected.lng === null || selected.lat === null) && (
              <p className="mt-1 text-xs text-amber-700">
                У объекта нет координат, поэтому он не показан на карте выбора.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          aria-expanded={mapOpen}
          aria-controls={mapPanelId}
          onClick={() => setMapOpen((shown) => !shown)}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 md:hidden"
        >
          {mapOpen ? 'Скрыть карту' : 'Выбрать на карте'}
        </button>
      </div>

      {showMap && (
        <div id={mapPanelId} className="min-w-0">
          <EventObjectMap objects={objects} value={value} onChange={(id) => {
            const object = objectById.get(id)
            if (object) commit(object)
          }} />
        </div>
      )}
    </div>
  )
}
