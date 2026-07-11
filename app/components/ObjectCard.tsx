'use client'

import { useEffect, useRef, useState } from 'react'
import type { EventDto, ObjectFull } from '@/lib/types'
import ModelViewer from './ModelViewer'

interface Props {
  id: string
  onClose: () => void
}

type MediaItem =
  | { type: 'photo'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string; alt?: string }

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function eventDates(e: EventDto): string {
  return e.startsOn === e.endsOn
    ? formatDate(e.startsOn)
    : `${formatDate(e.startsOn)} — ${formatDate(e.endsOn)}`
}

/** Звёзды рейтинга (источник рейтинга пока не решён — значение задаётся в админке) */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1.5 text-sm" aria-label={`Рейтинг ${rating} из 5`}>
      <span className="relative inline-block leading-none text-white/25" aria-hidden>
        ★★★★★
        <span
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-[var(--accent)]"
          style={{ width: `${(rating / 5) * 100}%` }}
        >
          ★★★★★
        </span>
      </span>
      <span className="font-medium text-[var(--ink)]/90">{rating.toFixed(1)}</span>
    </span>
  )
}

/** Карточка объекта: панель справа (desktop) / bottom sheet (mobile) */
export default function ObjectCard({ id, onClose }: Props) {
  const [data, setData] = useState<ObjectFull | null>(null)
  const [error, setError] = useState(false)
  const [mediaIdx, setMediaIdx] = useState(0)
  const [view, setView] = useState<'media' | '3d'>('media')
  const [audioOpen, setAudioOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setMediaIdx(0)
    setView('media')
    setAudioOpen(false)
    setTextOpen(false)
    setDonateOpen(false)
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

  // фото и видео — в одной галерее (как в Яндекс.Картах)
  const media: MediaItem[] = [
    ...(data?.photos ?? []).map((p) => ({ type: 'photo' as const, src: p.original, alt: p.alt })),
    ...(data?.videos ?? []).map((v) => ({
      type: 'video' as const,
      src: v.src,
      poster: v.poster,
      alt: v.alt,
    })),
  ]
  const item = media[mediaIdx]

  const prev = () => setMediaIdx((i) => (i - 1 + media.length) % media.length)
  const next = () => setMediaIdx((i) => (i + 1) % media.length)

  const todayEvents = data?.events.filter((e) => e.isToday) ?? []
  const upcomingEvents = data?.events.filter((e) => !e.isToday) ?? []

  return (
    <aside
      className="panel-scroll absolute z-20 overflow-y-auto bg-[var(--surface)] text-[var(--ink)]
                 shadow-[-2px_0_12px_rgba(60,64,67,0.2)]
                 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[82vh] max-md:rounded-t-2xl
                 md:right-0 md:top-0 md:h-full md:w-[420px] md:border-l md:border-[var(--hairline)]"
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
                onClick={() => setView('media')}
                className={`rounded-md px-2.5 py-1 transition-colors ${view === 'media' ? 'bg-white/95 text-[var(--surface)]' : 'text-white/70 hover:text-white'}`}
              >
                Фото и видео
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

          {/* Медиа: 3D-модель или галерея фото+видео */}
          {view === '3d' && data.modelUrl ? (
            <div className="aspect-[4/3] w-full bg-[var(--surface-2)]">
              <ModelViewer src={data.modelUrl} alt={data.title} />
            </div>
          ) : media.length > 0 ? (
            <div
              className="relative aspect-[4/3] w-full select-none bg-black/20"
              onTouchStart={(e) => {
                touchX.current = e.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const start = touchX.current
                const end = e.changedTouches[0]?.clientX
                touchX.current = null
                if (start === null || end === undefined || media.length < 2) return
                if (end - start > 40) prev()
                if (start - end > 40) next()
              }}
            >
              {item?.type === 'video' ? (
                <video
                  key={item.src}
                  src={item.src}
                  poster={item.poster}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item?.src ?? ''}
                  alt={item?.alt ?? data.title}
                  className="h-full w-full object-cover"
                />
              )}
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Предыдущее"
                    className="btn-ghost absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 text-lg"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Следующее"
                    className="btn-ghost absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-lg"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {media.map((m, i) => (
                      <span
                        key={m.src}
                        className={`h-1.5 rounded-full transition-all ${i === mediaIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {item?.type !== 'video' && media.some((m) => m.type === 'video') && (
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                  ▶ есть видео
                </span>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--surface-2)] text-4xl opacity-40">
              📍
            </div>
          )}

          <div className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: data.categoryColor }}
                aria-hidden
              />
              {data.categoryTitle}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-[22px] font-medium leading-snug">{data.title}</h2>
              {data.rating !== null && <Stars rating={data.rating} />}
              {data.address && (
                <p className="text-sm text-[var(--ink-muted)]">
                  {data.address}
                  {data.districtName ? ` · ${data.districtName} округ` : ''}
                </p>
              )}
            </div>

            {/* Мероприятия: сегодняшние выделены */}
            {(todayEvents.length > 0 || upcomingEvents.length > 0) && (
              <div className="space-y-2">
                {todayEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-[var(--accent)]/60 bg-[var(--accent)]/10 p-3"
                  >
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      <span className="soft-pulse inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />
                      Сегодня · {eventDates(e)}
                    </p>
                    <p className="mt-1 text-sm font-medium">{e.title}</p>
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-sm text-[var(--ink)]/80">{e.description}</p>
                    )}
                  </div>
                ))}
                {upcomingEvents.map((e) => (
                  <div key={e.id} className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3">
                    <p className="text-xs font-medium text-[var(--ink-muted)]">📅 {eventDates(e)}</p>
                    <p className="mt-1 text-sm font-medium">{e.title}</p>
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-sm text-[var(--ink)]/80">{e.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Аудиогид: аудио + текстовая версия */}
            {data.audioUrl && (
              <div className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setAudioOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium"
                    aria-expanded={audioOpen}
                  >
                    <span className="btn-accent h-8 w-8 rounded-full text-xs" aria-hidden>
                      {audioOpen ? '▮▮' : '▶'}
                    </span>
                    Аудиогид
                  </button>
                  {data.audioText && (
                    <button
                      type="button"
                      onClick={() => setTextOpen((v) => !v)}
                      className="text-xs text-[var(--ink-muted)] underline decoration-dotted underline-offset-2 hover:text-[var(--ink)]"
                    >
                      {textOpen ? 'Скрыть текст' : 'Читать текстом'}
                    </button>
                  )}
                </div>
                {audioOpen && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={data.audioUrl} controls autoPlay className="mt-3 h-9 w-full" />
                )}
                {textOpen && data.audioText && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">
                    {data.audioText}
                  </p>
                )}
              </div>
            )}

            {data.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">
                {data.description}
              </p>
            )}

            {/* Секции описания («Архитектура», «История», …) */}
            {data.sections.map((s) => (
              <section key={s.title}>
                <h3 className="eyebrow mb-1.5">{s.title}</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">{s.text}</p>
              </section>
            ))}

            <div className="space-y-2 pt-1">
              <a
                href={`https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent w-full rounded-lg px-4 py-3 text-sm"
              >
                Маршрут в Яндекс.Картах →
              </a>
              <button
                type="button"
                onClick={() => setDonateOpen(true)}
                className="w-full rounded-[0.625rem] border border-[#d99a32] px-4 py-3 text-sm font-semibold text-[#8a5a10] transition-colors hover:bg-[#fff6e7]"
              >
                ♥ Пожертвовать на реставрацию
              </button>
            </div>
          </div>

          {/* Модалка пожертвования (платёжная интеграция — после решения заказчика) */}
          {donateOpen && (
            <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Пожертвование на реставрацию"
              onClick={() => setDonateOpen(false)}
            >
              <div
                className="panel w-full max-w-sm rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold">Пожертвование на реставрацию</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/85">
                  Средства направляются на сохранение и реставрацию объекта «{data.title}».
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Реквизиты и способ оплаты уточняются. Скоро здесь появится возможность сделать
                  пожертвование онлайн.
                </p>
                <button
                  type="button"
                  onClick={() => setDonateOpen(false)}
                  className="btn-accent mt-4 w-full px-4 py-2.5 text-sm"
                >
                  Понятно
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
