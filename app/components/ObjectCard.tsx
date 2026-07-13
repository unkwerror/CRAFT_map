'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EventDto, ObjectFull } from '@/lib/types'
import AudioGuide from './AudioGuide'
import ObjectMediaGallery from './ObjectMediaGallery'
import ObjectSections from './ObjectSections'

const DONATION_URL = process.env.NEXT_PUBLIC_DONATION_URL

interface Props {
  id: string
  onClose: () => void
}

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
  const [eventsOpen, setEventsOpen] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [requestKey, setRequestKey] = useState(0)
  const [mobileModal, setMobileModal] = useState(false)
  const sheetTouchY = useRef<number | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setEventsOpen(false)
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

  // На телефоне это настоящий modal bottom sheet: карта и поиск под ним недоступны.
  useEffect(() => {
    if (!mobileModal || !panelRef.current) return
    const sheet = panelRef.current
    const shell = sheet.closest('.map-shell')
    if (!shell) return
    const backdrop = shell.querySelector('[data-object-sheet-backdrop]')
    const siblings = Array.from(shell.children).filter(
      (element) =>
        element !== sheet &&
        element !== backdrop &&
        !(element as HTMLElement).hasAttribute('data-events-panel')
    ) as HTMLElement[]
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    const previousOverflow = document.body.style.overflow
    for (const element of siblings) {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    }
    document.body.style.overflow = 'hidden'
    return () => {
      for (const item of previous) {
        item.element.inert = item.inert
        if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
        else item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
      document.body.style.overflow = previousOverflow
    }
  }, [mobileModal])

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

  const todayEvents = data?.events.filter((e) => e.isToday) ?? []
  const upcomingEvents = data?.events.filter((e) => !e.isToday) ?? []
  const shownUpcomingEvents = eventsOpen ? upcomingEvents : upcomingEvents.slice(0, 2)

  return (
    <>
      <div
        data-object-sheet-backdrop
        className="object-sheet-backdrop absolute inset-0 z-[19] bg-black/55 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={mobileModal ? true : undefined}
        aria-labelledby={data ? titleId : undefined}
        aria-label={data ? undefined : 'Карточка объекта'}
        className="object-sheet panel-scroll absolute z-20 overflow-y-auto bg-[var(--surface)] text-[var(--ink)] outline-none
                   max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92dvh] max-md:rounded-t-[26px]
                   md:right-0 md:top-0 md:h-full md:w-[clamp(460px,38vw,520px)] md:border-l md:border-[var(--hairline)]"
      >
      <div
        className="absolute left-1/2 top-0 z-20 flex h-7 w-20 -translate-x-1/2 items-center justify-center md:hidden"
        onTouchStart={(event) => {
          sheetTouchY.current = event.touches[0]?.clientY ?? null
        }}
        onTouchEnd={(event) => {
          const start = sheetTouchY.current
          const end = event.changedTouches[0]?.clientY
          sheetTouchY.current = null
          if (start !== null && end !== undefined && end - start > 55) onClose()
        }}
        aria-hidden
      >
        <span className="h-1 w-9 rounded-full bg-white/35" />
      </div>
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
          <ObjectMediaGallery
            objectId={data.id}
            title={data.title}
            photos={data.photos}
            videos={data.videos}
            modelUrl={data.modelUrl}
          />

          <div className="object-content flex flex-1 flex-col gap-3.5 p-4 pb-5 md:gap-4 md:p-6">
            <div
              className="object-category-badge flex w-fit items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-semibold leading-none"
              style={{ '--category-color': data.categoryColor } as CSSProperties}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: data.categoryColor }}
                aria-hidden
              />
              {data.categoryTitle}
            </div>

            <div className="space-y-2">
              <h2 id={titleId} className="text-[23px] font-[650] leading-[1.22] tracking-[-0.012em] md:text-[26px]">{data.title}</h2>
              {data.rating !== null && <Stars rating={data.rating} />}
              {(data.address || data.districtName) && (
                <p className="flex items-start gap-1.5 text-[15px] leading-[1.55] text-[var(--ink-muted)]">
                  <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <span>
                    {data.address}
                    {data.address && data.districtName ? ' · ' : ''}
                    {data.districtName ? `${data.districtName} округ` : ''}
                  </span>
                </p>
              )}
            </div>

            {/* Мероприятия: сегодняшние выделены */}
            {(todayEvents.length > 0 || upcomingEvents.length > 0) && (
              <section className="space-y-2" aria-labelledby={`${titleId}-events`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 id={`${titleId}-events`} className="text-[15px] font-semibold leading-snug">Мероприятия</h3>
                  <span className="text-xs text-[var(--ink-subtle)]">{todayEvents.length + upcomingEvents.length}</span>
                </div>
                {todayEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-[var(--accent)]/60 bg-[var(--accent)]/10 p-3"
                  >
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      <span className="soft-pulse inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />
                      Сегодня · {eventDates(e)}
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-[1.4]">{e.title}</p>
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)]/88">{e.description}</p>
                    )}
                  </div>
                ))}
                {shownUpcomingEvents.map((e) => (
                  <div key={e.id} className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium leading-snug text-[var(--ink-muted)]">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 2v3m6-3v3M2 7h12" stroke="currentColor" strokeWidth="1.3"/></svg>
                      {eventDates(e)}
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-[1.4]">{e.title}</p>
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)]/88">{e.description}</p>
                    )}
                  </div>
                ))}
                {upcomingEvents.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setEventsOpen((open) => !open)}
                    aria-expanded={eventsOpen}
                    className="min-h-10 w-full rounded-xl text-[13px] font-semibold text-[var(--ink-muted)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
                  >
                    {eventsOpen ? 'Скрыть остальные' : `Ещё ${upcomingEvents.length - 2}`}
                  </button>
                )}
              </section>
            )}

            <AudioGuide audioUrl={data.audioUrl} audioText={data.audioText} />

            <ObjectSections objectId={data.id} description={data.description} sections={data.sections} />

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

            <div className="object-actions sticky bottom-0 z-[1] -mx-4 -mb-5 mt-auto grid grid-cols-[1fr_auto] gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:-mx-6 md:-mb-6 md:px-6 md:pb-6 md:pt-5">
              <a
                href={`https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent min-h-12 w-full rounded-xl px-4 py-3 text-sm"
              >
                <span className="md:hidden">Построить маршрут</span>
                <span className="hidden md:inline">Маршрут в Яндекс Картах</span>
              </a>
              <button
                type="button"
                onClick={() => void shareObject()}
                className="share-button flex h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--hairline-strong)] px-3 text-sm font-semibold text-[var(--ink)]"
                aria-label="Поделиться объектом"
              >
                {shareState === 'copied' ? (
                  <span className="text-xs text-[var(--accent)]" role="status">Скопировано</span>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7"/><circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="m8.2 10.8 7.5-4.5m-7.5 6.9 7.5 4.5" stroke="currentColor" strokeWidth="1.7"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </aside>
    </>
  )
}
