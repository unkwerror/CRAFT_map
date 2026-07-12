'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EventDto, ObjectFull } from '@/lib/types'
import ModelViewer from './ModelViewer'

const DONATION_URL = process.env.NEXT_PUBLIC_DONATION_URL

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
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [requestKey, setRequestKey] = useState(0)
  const [mobileModal, setMobileModal] = useState(false)
  const touchX = useRef<number | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setMediaIdx(0)
    setView('media')
    setAudioOpen(false)
    setTextOpen(false)
    setShareState('idle')
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
  }, [id, requestKey])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setMobileModal(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!mobileModal) return
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], audio[controls], video[controls], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', trapFocus)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [mobileModal])

  async function shareObject() {
    const url = `${window.location.origin}/object/${id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: data?.title ?? 'Памятный объект Тюмени', url })
        return
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const field = document.createElement('textarea')
      field.value = url
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setShareState('copied')
    window.setTimeout(() => setShareState('idle'), 1800)
  }

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
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal={mobileModal ? true : undefined}
      className="object-sheet panel-scroll absolute z-20 overflow-y-auto bg-[var(--surface)] text-[var(--ink)] outline-none
                 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[86vh] max-md:rounded-t-[24px]
                 md:right-0 md:top-0 md:h-full md:w-[440px] md:border-l md:border-[var(--hairline)]"
      aria-label="Карточка объекта"
    >
      <div className="absolute left-1/2 top-2 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-white/35 md:hidden" aria-hidden />
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="btn-ghost absolute right-3 top-3 z-10 h-11 w-11 text-base leading-none"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {error && (
        <div className="p-6 pt-16">
          <p className="text-sm text-[var(--ink-muted)]">Не удалось загрузить объект.</p>
          <button type="button" onClick={() => setRequestKey((value) => value + 1)} className="btn-accent mt-4 min-h-11 rounded-xl px-4 text-sm">
            Повторить
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="object-skeleton" aria-label="Загружаем карточку">
          <div className="object-skeleton__media" />
          <div className="space-y-3 p-6">
            <div className="object-skeleton__line w-24" />
            <div className="object-skeleton__line h-7 w-4/5" />
            <div className="object-skeleton__line w-3/5" />
            <div className="pt-3"><div className="object-skeleton__line w-full" /></div>
            <div className="object-skeleton__line w-[92%]" />
            <div className="object-skeleton__line w-2/3" />
          </div>
        </div>
      )}

      {data && (
        <div className="flex min-h-full flex-col">
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
                  className="object-media h-full w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item?.src}
                  src={item?.src ?? ''}
                  alt={item?.alt ?? data.title}
                  decoding="async"
                  className="object-media h-full w-full object-cover"
                />
              )}
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Предыдущее"
                    className="btn-ghost absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 text-lg"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Следующее"
                    className="btn-ghost absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 text-lg"
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
                  {!data.modelUrl && (
                    <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
                      {mediaIdx + 1} / {media.length}
                    </span>
                  )}
                </>
              )}
              {item?.type !== 'video' && media.some((m) => m.type === 'video') && (
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur">
                  ▶ есть видео
                </span>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--surface-2)] text-[var(--ink-subtle)]">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
          )}

          <div className="object-content flex flex-1 flex-col gap-4 p-6">
            <div
              className="object-category-badge flex w-fit items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold"
              style={{ '--category-color': data.categoryColor } as CSSProperties}
            >
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
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 2v3m6-3v3M2 7h12" stroke="currentColor" strokeWidth="1.3"/></svg>
                      {eventDates(e)}
                    </p>
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
                    <span className="btn-accent h-10 w-10 rounded-full text-xs" aria-hidden>
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
                  <audio src={data.audioUrl} controls autoPlay className="mt-3 h-9 w-full" />
                )}
                {textOpen && data.audioText && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">
                    {data.audioText}
                  </p>
                )}
              </div>
            )}

            {DONATION_URL && (
              <a
                href={DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="restoration-link flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] px-4 text-sm font-semibold text-[var(--ink-muted)]"
              >
                <span aria-hidden>♡</span>
                Поддержать реставрацию
              </a>
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

            <div className="object-actions sticky bottom-0 z-[1] -mx-6 -mb-6 mt-auto grid grid-cols-[1fr_auto] gap-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
              <a
                href={`https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent min-h-12 w-full rounded-xl px-4 py-3 text-sm"
              >
                Маршрут в Яндекс Картах
              </a>
              <button
                type="button"
                onClick={() => void shareObject()}
                className="share-button flex h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--hairline-strong)] px-3 text-sm font-semibold text-[var(--ink)]"
                aria-label="Поделиться объектом"
              >
                {shareState === 'copied' ? (
                  <span className="text-xs text-[var(--accent)]">Скопировано</span>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7"/><circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="m8.2 10.8 7.5-4.5m-7.5 6.9 7.5 4.5" stroke="currentColor" strokeWidth="1.7"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
