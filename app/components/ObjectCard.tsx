'use client'

import { useEffect, useRef, useState } from 'react'
import type { ObjectFull } from '@/lib/types'

interface Props {
  id: string
  onClose: () => void
}

/** Карточка объекта: панель справа (desktop) / bottom sheet (mobile) */
export default function ObjectCard({ id, onClose }: Props) {
  const [data, setData] = useState<ObjectFull | null>(null)
  const [error, setError] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setPhotoIdx(0)
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
      className="panel-scroll absolute z-20 overflow-y-auto bg-[#122a42] text-white shadow-2xl
                 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[72vh] max-md:rounded-t-2xl
                 md:right-0 md:top-0 md:h-full md:w-[400px]"
      aria-label="Карточка объекта"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-white hover:bg-black/60"
      >
        ✕
      </button>

      {error && <p className="p-6 pt-14 text-white/70">Не удалось загрузить объект.</p>}
      {!data && !error && <p className="p-6 pt-14 text-white/50">Загрузка…</p>}

      {data && (
        <>
          {/* Галерея */}
          {photos.length > 0 ? (
            <div
              className="relative aspect-[4/3] w-full select-none bg-black/30"
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
                    className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Следующее фото"
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {photos.map((p, i) => (
                      <span
                        key={p.original}
                        className={`h-1.5 w-1.5 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#16324e] text-5xl">
              📍
            </div>
          )}

          <div className="space-y-3 p-5">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: `${data.categoryColor}26`, color: data.categoryColor }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: data.categoryColor }}
                aria-hidden
              />
              {data.categoryTitle}
            </span>

            <h2 className="text-xl font-bold leading-snug">{data.title}</h2>

            {data.address && (
              <p className="text-sm text-white/60">
                {data.address}
                {data.districtName ? ` · ${data.districtName} округ` : ''}
              </p>
            )}

            {data.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">
                {data.description}
              </p>
            )}

            <a
              href={`https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F0A93B] px-4 py-3 text-sm font-semibold text-[#122a42] hover:brightness-110"
            >
              Маршрут в Яндекс.Картах →
            </a>
          </div>
        </>
      )}
    </aside>
  )
}
