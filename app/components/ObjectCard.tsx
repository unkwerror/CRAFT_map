'use client'

import { useEffect, useRef, useState } from 'react'
import type { ObjectFull } from '@/lib/types'
import ModelViewer from './ModelViewer'

interface Props {
  id: string
  onClose: () => void
}

/** Карточка объекта: панель справа (desktop) / bottom sheet (mobile) */
export default function ObjectCard({ id, onClose }: Props) {
  const [data, setData] = useState<ObjectFull | null>(null)
  const [error, setError] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [view, setView] = useState<'photos' | '3d'>('photos')
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setPhotoIdx(0)
    setView('photos')
    fetch(`/api/objects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ObjectFull) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const photos = data?.photos ?? []
  const photo = photos[photoIdx]

  const prev = () => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)
  const next = () => setPhotoIdx((i) => (i + 1) % photos.length)

  return (
    <aside
      className="panel-scroll absolute z-20 overflow-y-auto bg-[var(--surface)] text-[var(--ink)]
                 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]
                 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[74vh] max-md:rounded-t-2xl
                 md:right-0 md:top-0 md:h-full md:w-[400px] md:border-l md:border-[var(--hairline)]"
      aria-label="Карточка объекта"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="btn-ghost absolute right-3 top-3 z-10 h-8 w-8 text-base leading-none"
      >
        ✕
      </button>

      {error && <p className="p-6 pt-14 text-[var(--ink-muted)]">Не удалось загрузить объект.</p>}
      {!data && !error && <p className="p-6 pt-14 text-[var(--ink-subtle)]">Загрузка…</p>}

      {data && (
        <>
          {/* Переключатель Фото / 3D-модель */}
          {data.modelUrl && (
            <div className="absolute left-3 top-3 z-10 flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs font-medium backdrop-blur">
              <button
                type="button"
                onClick={() => setView('photos')}
                className={`rounded-md px-2.5 py-1 transition-colors ${view === 'photos' ? 'bg-white/95 text-[var(--surface)]' : 'text-white/70 hover:text-white'}`}
              >
                Фото
              </button>
              <button
                type="button"
                onClick={() => setView('3d')}
                className={`rounded-md px-2.5 py-1 transition-colors ${view === '3d' ? 'bg-white/95 text-[var(--surface)]' : 'text-white/70 hover:text-white'}`}
              >
                3D-модель
              </button>
            </div>
          )}

          {/* Медиа: 3D-модель или галерея фото */}
          {view === '3d' && data.modelUrl ? (
            <div className="aspect-[4/3] w-full bg-[var(--surface-2)]">
              <ModelViewer src={data.modelUrl} alt={data.title} />
            </div>
          ) : photos.length > 0 ? (
            <div
              className="relative aspect-[4/3] w-full select-none bg-black/20"
              onTouchStart={(e) => {
                touchX.current = e.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const start = touchX.current
                const end = e.changedTouches[0]?.clientX
                touchX.current = null
                if (start === null || end === undefined || photos.length < 2) return
                if (end - start > 40) prev()
                if (start - end > 40) next()
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo?.original ?? ''}
                alt={photo?.alt ?? data.title}
                className="h-full w-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Предыдущее фото"
                    className="btn-ghost absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 text-lg"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Следующее фото"
                    className="btn-ghost absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-lg"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {photos.map((p, i) => (
                      <span
                        key={p.original}
                        className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--surface-2)] text-4xl opacity-40">
              📍
            </div>
          )}

          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: data.categoryColor }}
                aria-hidden
              />
              {data.categoryTitle}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold leading-snug">{data.title}</h2>
              {data.address && (
                <p className="text-sm text-[var(--ink-muted)]">
                  {data.address}
                  {data.districtName ? ` · ${data.districtName} округ` : ''}
                </p>
              )}
            </div>

            {data.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">
                {data.description}
              </p>
            )}

            <a
              href={`https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent mt-1 w-full px-4 py-3 text-sm"
            >
              Маршрут в Яндекс.Картах →
            </a>
          </div>
        </>
      )}
    </aside>
  )
}
