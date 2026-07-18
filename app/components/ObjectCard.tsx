'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EventDto, ObjectFull } from '@/lib/types'
import { publicSiteOrigin } from '@/lib/seo'
import AudioGuide from './AudioGuide'
import ObjectMediaGallery from './ObjectMediaGallery'
import ObjectSections from './ObjectSections'
import ObjectPassport from './ObjectPassport'
import MemoryGraphSection from './MemoryGraphSection'
import ReportIssue from './ReportIssue'
import usePlaceProgress from './usePlaceProgress'

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
  const dates = e.startsOn === e.endsOn
    ? formatDate(e.startsOn)
    : `${formatDate(e.startsOn)} — ${formatDate(e.endsOn)}`
  const time = e.startsAt ? `${e.startsAt}${e.endsAt ? `–${e.endsAt}` : ''}` : ''
  return time ? `${dates}, ${time}` : dates
}

function EventLinks({ event }: { event: EventDto }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-semibold">
      <a href={`/event/${event.id}`} className="text-[var(--accent)] hover:underline">
        Подробнее
      </a>
      <a href={`/api/events/${event.id}/calendar`} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
        В календарь
      </a>
      {event.registrationUrl && event.status !== 'cancelled' && (
        <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
          Регистрация ↗
        </a>
      )}
    </div>
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
  const { favoriteIds, visitedIds, toggleFavorite, toggleVisited } = usePlaceProgress()
  const favorite = favoriteIds.has(id)
  const visited = visitedIds.has(id)
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    setData(null)
    setError(false)
    setEventsOpen(false)
    setShareState('idle')
    fetch(`/api/objects/${id}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ObjectFull) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
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
      if (event.key === 'Escape' && !document.querySelector('[data-media-lightbox]')) {
        onCloseRef.current()
      }
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
    const url = `${publicSiteOrigin(window.location.origin)}/object/${id}`
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
        role={mobileModal ? 'dialog' : 'complementary'}
        aria-modal={mobileModal ? true : undefined}
        aria-labelledby={data ? titleId : undefined}
        aria-label={data ? undefined : 'Карточка объекта'}
        className="object-sheet map-side-panel-md panel-scroll absolute z-20 overflow-y-auto bg-[var(--surface)] text-[var(--ink)] outline-none
                   max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92dvh] max-md:rounded-t-[26px]
                   md:right-0 md:top-0 md:h-full md:border-l md:border-[var(--hairline)]"
      >
      <div
        className="absolute inset-x-0 top-0 z-20 flex h-12 items-start justify-center pt-2 md:hidden"
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
        className="btn-ghost absolute right-3 top-3 z-30 h-11 w-11 text-base leading-none"
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

            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Личные отметки места">
              <button
                type="button"
                onClick={() => toggleFavorite(data.id)}
                aria-pressed={favorite}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors ${favorite ? 'border-[var(--accent)]/45 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--hairline)] bg-white/[0.025] text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
              >
                <span aria-hidden>{favorite ? '♥' : '♡'}</span>
                {favorite ? 'В избранном' : 'В избранное'}
              </button>
              <button
                type="button"
                onClick={() => toggleVisited(data.id)}
                aria-pressed={visited}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors ${visited ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-200' : 'border-[var(--hairline)] bg-white/[0.025] text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
              >
                <span aria-hidden>✓</span>
                {visited ? 'Посещено' : 'Отметить'}
              </button>
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
                    {e.status !== 'scheduled' && (
                      <p className={`mt-1 text-[13px] font-semibold ${e.status === 'cancelled' ? 'text-red-300' : 'text-amber-300'}`}>
                        {e.status === 'cancelled' ? 'Мероприятие отменено' : 'Мероприятие перенесено — уточните дату'}
                      </p>
                    )}
                    {e.venue && <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{e.venue}</p>}
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)]/88">{e.description}</p>
                    )}
                    <EventLinks event={e} />
                  </div>
                ))}
                {shownUpcomingEvents.map((e) => (
                  <div key={e.id} className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium leading-snug text-[var(--ink-muted)]">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 2v3m6-3v3M2 7h12" stroke="currentColor" strokeWidth="1.3"/></svg>
                      {eventDates(e)}
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-[1.4]">{e.title}</p>
                    {e.status !== 'scheduled' && (
                      <p className={`mt-1 text-[13px] font-semibold ${e.status === 'cancelled' ? 'text-red-300' : 'text-amber-300'}`}>
                        {e.status === 'cancelled' ? 'Мероприятие отменено' : 'Мероприятие перенесено — уточните дату'}
                      </p>
                    )}
                    {e.venue && <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{e.venue}</p>}
                    {e.description && (
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)]/88">{e.description}</p>
                    )}
                    <EventLinks event={e} />
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
            <ObjectPassport object={data} />
            <MemoryGraphSection objectId={data.id} />

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

            <ReportIssue objectId={data.id} title={data.title} />

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
