'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface ObjectOption {
  id: string
  title: string
}

interface Props {
  objects: ObjectOption[]
  /** id выбранного объекта; '' — ничего не выбрано (режим «добавить») */
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  placeholder?: string
}

/** Комбобокс выбора объекта: поиск по названию вместо <select> на сотни позиций. */
export default function ObjectPicker({
  objects,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Начните вводить название…',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = useMemo(() => objects.find((option) => option.id === value) ?? null, [objects, value])

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ru-RU')
    const list = q
      ? objects.filter((option) => option.title.toLocaleLowerCase('ru-RU').includes(q))
      : objects
    return list.slice(0, 30)
  }, [objects, query])

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function choose(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-label={ariaLabel}
        placeholder={selected ? selected.title : placeholder}
        value={open ? query : selected?.title ?? query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter') {
            if (open && matches[active]) {
              event.preventDefault()
              choose(matches[active].id)
            }
          } else if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
        className="w-full rounded-lg border p-2"
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            setQuery('')
          }}
          aria-label="Сбросить выбранный объект"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-slate-400 hover:text-slate-700"
        >
          ×
        </button>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500" role="presentation">Ничего не найдено</li>
          )}
          {matches.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === value}
              // preventDefault: клик не должен снять фокус с инпута до выбора
              onMouseDown={(event) => {
                event.preventDefault()
                choose(option.id)
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${index === active ? 'bg-slate-100' : ''} ${option.id === value ? 'font-semibold' : ''}`}
            >
              {option.title}
            </li>
          ))}
          {query.trim() === '' && objects.length > matches.length && (
            <li className="px-3 py-2 text-xs text-slate-400" role="presentation">
              Показаны первые {matches.length} — уточните запрос
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
