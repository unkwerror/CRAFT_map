'use client'

import { useEffect, useRef, useState } from 'react'
import type { AdminObjectRow } from '@/lib/types'
import EventObjectMap from './EventObjectMap'
import ObjectPicker from './ObjectPicker'

interface Props {
  objects: AdminObjectRow[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  placeholder?: string
  dialogTitle?: string
}

/** Поле выбора объекта: поиск по названию + кнопка «На карте» с диалогом выбора кликом. */
export default function ObjectFieldWithMap({
  objects,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Найти объект по названию…',
  dialogTitle = 'Выбор объекта на карте',
}: Props) {
  const [open, setOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        openButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    openButtonRef.current?.focus()
  }

  const selectedTitle = objects.find((object) => object.id === value)?.title ?? null

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <ObjectPicker
          objects={objects}
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel}
          placeholder={placeholder}
        />
      </div>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        На карте
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogTitle}
            className="relative w-full max-w-2xl space-y-3 rounded-2xl bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{dialogTitle}</h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Закрыть выбор на карте"
                className="rounded-lg border px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>
            <ObjectPicker
              objects={objects}
              value={value}
              onChange={(id) => {
                onChange(id)
                if (id) close()
              }}
              ariaLabel={`${ariaLabel} — поиск в диалоге`}
              placeholder={placeholder}
            />
            <EventObjectMap
              objects={objects}
              value={value}
              onChange={(id) => {
                onChange(id)
                close()
              }}
            />
            <p className="text-xs text-slate-500">
              {selectedTitle ? `Выбрано: ${selectedTitle}. ` : ''}Клик по точке выбирает объект и закрывает окно.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
