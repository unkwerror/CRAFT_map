'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  eventsWord,
  filterPublicEvents,
  filterPublicEventsByPeriod,
  formatEventDates,
  formatEventTime,
  groupPublicEvents,
  parsePublicEventsResponse,
} from '@/lib/public-events-ui'
import type { EventPeriod } from '@/lib/public-events-ui'
import type { PublicEventDto } from '@/lib/types'
import { publicSiteOrigin } from '@/lib/seo'

interface Props {
  suspended: boolean
  onClose: () => void
  onSelectObject: (id: string) => void
}

function EventCard({ event, onSelect }: { event: PublicEventDto; onSelect: () => void }) {
  const location = [event.address, event.districtName ? `${event.districtName} округ` : null]
    .filter(Boolean)
    .join(' · ')
  const time = formatEventTime(event.startsAt, event.endsAt)

  async function shareEvent() {
    const url = `${publicSiteOrigin(window.location.origin)}/event/${event.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url })
        return
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Скопируйте ссылку', url)
    }
  }

  return (
    <article className="event-card">
      <a
        href={`/event/${event.id}`}
        className="event-card__button"
      >
        {event.thumb && (
          <span className="event-card__media" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.thumb} alt="" loading="lazy" />
          </span>
        )}
        <span className="event-card__body">
          <span className="event-card__meta">
            {event.startsOn === event.endsOn ? (
              <time dateTime={`${event.startsOn}${event.startsAt ? `T${event.startsAt}` : ''}`}>
                {formatEventDates(event.startsOn, event.endsOn)}{time ? ` · ${time}` : ''}
              </time>
            ) : (
              <span>{formatEventDates(event.startsOn, event.endsOn)}{time ? ` · ${time}` : ''}</span>
            )}
            {event.isToday && <span className="event-card__today">Идёт сегодня</span>}
          </span>
          <span className="event-card__title">{event.title}</span>
          {event.status !== 'scheduled' && (
            <span className={`event-card__status event-card__status--${event.status}`}>
              {event.status === 'cancelled' ? 'Отменено' : 'Перенесено'}
            </span>
          )}
          {event.description && (
            <span className="event-card__description">{event.description}</span>
          )}
          {(event.venue || event.priceInfo) && (
            <span className="event-card__facts">
              {event.venue && <small>{event.venue}</small>}
              {event.priceInfo && <small>{event.priceInfo}</small>}
            </span>
          )}
          <span className="event-card__object">
            <span
              className="event-card__category-dot"
              style={{ background: event.categoryColor }}
              aria-hidden
            />
            <span>
              <strong>{event.objectTitle}</strong>
              {location && <small>{location}</small>}
            </span>
          </span>
          <span className="event-card__action">
            Подробнее о событии
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </a>
      <div className="event-card__footer">
        <button type="button" onClick={onSelect}>На карте</button>
        <a href={`/api/events/${event.id}/calendar`}>В календарь</a>
        <button type="button" onClick={() => void shareEvent()}>Поделиться</button>
        {event.registrationUrl && event.status !== 'cancelled' && (
          <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">Регистрация ↗</a>
        )}
      </div>
    </article>
  )
}

function tyumenTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Yekaterinburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

const PERIODS: { value: EventPeriod; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'today', label: 'Сегодня' },
  { value: 'weekend', label: 'Выходные' },
  { value: 'month', label: 'Этот месяц' },
]

/** Общая афиша текущих и будущих мероприятий. */
export default function EventsPanel({ suspended, onClose, onSelectObject }: Props) {
  const [events, setEvents] = useState<PublicEventDto[] | null>(null)
  const [error, setError] = useState(false)
  const [requestKey, setRequestKey] = useState(0)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<EventPeriod>('all')
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    setEvents(null)
    setError(false)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    fetch('/api/events', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        const payload = (await response.json()) as unknown
        const parsed = parsePublicEventsResponse(payload)
        if (!parsed) throw new Error('invalid response')
        return parsed
      })
      .then((payload) => {
        if (!cancelled) setEvents(payload)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [requestKey])

  useEffect(() => {
    if (!suspended) panelRef.current?.focus({ preventScroll: true })
  }, [suspended])

  useEffect(() => {
    if (suspended) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (query) {
        setQuery('')
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, query, suspended])

  // До xl список заменяет карту целиком: скрываем фон и исключаем его из tab-порядка.
  useEffect(() => {
    if (suspended) return
    const media = window.matchMedia('(max-width: 1279px)')
    let restore: (() => void) | null = null

    const sync = () => {
      restore?.()
      restore = null
      if (!media.matches || !panelRef.current) return
      const panel = panelRef.current
      const shell = panel.closest('.map-shell')
      if (!shell) return
      const siblings = Array.from(shell.children).filter(
        (element) => element !== panel && !(element as HTMLElement).hasAttribute('data-map-mode-mobile')
      ) as HTMLElement[]
      const previous = siblings.map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }))
      for (const element of siblings) {
        element.inert = true
        element.setAttribute('aria-hidden', 'true')
      }
      restore = () => {
        for (const item of previous) {
          item.element.inert = item.inert
          if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
          else item.element.setAttribute('aria-hidden', item.ariaHidden)
        }
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
      restore?.()
    }
  }, [suspended])

  const todayIso = useMemo(tyumenTodayIso, [])
  const filtered = useMemo(() => {
    const byQuery = filterPublicEvents(events ?? [], query)
    return filterPublicEventsByPeriod(byQuery, period, todayIso)
  }, [events, period, query, todayIso])
  const groups = useMemo(() => groupPublicEvents(filtered), [filtered])

  return (
    <aside
      ref={panelRef}
      data-events-panel
      tabIndex={-1}
      inert={suspended ? true : undefined}
      aria-hidden={suspended || undefined}
      aria-busy={!events && !error}
      aria-label="Предстоящие мероприятия"
      className={`events-panel map-side-panel-xl panel-scroll absolute z-[12] overflow-y-auto outline-none max-xl:inset-0 xl:right-0 xl:top-0 xl:h-full xl:border-l xl:border-[var(--hairline)] ${suspended ? 'events-panel--suspended' : ''}`}
    >
      <div className="events-panel__header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Афиша города</p>
            <h1 className="mt-1.5 text-[26px] font-[650] leading-tight tracking-[-0.015em] md:text-[29px]">
              Мероприятия
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-muted)]">
              Все текущие и предстоящие события у памятных мест Тюмени.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="events-panel__close hidden h-11 w-11 shrink-0 items-center justify-center rounded-full xl:flex"
            aria-label="Вернуться к карте"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="m5 5 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="events-search mt-5 flex min-h-12 items-center gap-2.5 rounded-xl px-3.5">
          <svg className="shrink-0 text-[var(--ink-subtle)]" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <label htmlFor="events-search-input" className="sr-only">Найти мероприятие</label>
          <input
            id="events-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, памятник или адрес"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--ink-subtle)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
              aria-label="Очистить поиск"
            >
              ×
            </button>
          )}
        </div>

        <div className="events-periods" aria-label="Период мероприятий">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              aria-pressed={period === item.value}
              className={period === item.value ? 'events-periods__item events-periods__item--active' : 'events-periods__item'}
            >
              {item.label}
            </button>
          ))}
        </div>

        {events && events.length > 0 && (
          <p className="mt-3 text-xs text-[var(--ink-subtle)]" aria-live="polite">
            {query.trim() || period !== 'all'
              ? `Найдено: ${filtered.length}`
              : `${events.length} ${eventsWord(events.length)}`}
          </p>
        )}
      </div>

      <div className="events-panel__content">
        {!events && !error && (
          <div className="space-y-3" role="status">
            <span className="sr-only">Загружаем мероприятия</span>
            {[0, 1, 2].map((item) => (
              <div key={item} className="event-card event-card--skeleton" aria-hidden>
                <span className="object-skeleton__line w-28" />
                <span className="object-skeleton__line mt-4 h-5 w-4/5" />
                <span className="object-skeleton__line mt-3 w-full" />
                <span className="object-skeleton__line mt-2 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="events-empty" role="alert">
            <span className="events-empty__icon" aria-hidden>!</span>
            <h2>Не удалось загрузить мероприятия</h2>
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="btn-accent mt-5 min-h-11 px-5 text-sm">
              Повторить
            </button>
          </div>
        )}

        {events?.length === 0 && (
          <div className="events-empty">
            <span className="events-empty__icon" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 3v4m10-4v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <h2>Предстоящих мероприятий пока нет</h2>
            <p>Загляните позже или исследуйте памятные места на карте.</p>
            <button type="button" onClick={onClose} className="btn-accent mt-5 min-h-11 px-5 text-sm">
              Открыть карту
            </button>
          </div>
        )}

        {events && events.length > 0 && filtered.length === 0 && (
          <div className="events-empty">
            <span className="events-empty__icon" aria-hidden>⌕</span>
            <h2>Ничего не найдено</h2>
            <p>Попробуйте изменить запрос или выбранный период.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPeriod('all')
              }}
              className="btn-accent mt-5 min-h-11 px-5 text-sm"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.key} className="event-group" aria-labelledby={`event-group-${group.key}`}>
            <div className="event-group__heading">
              <h2 id={`event-group-${group.key}`}>{group.title}</h2>
              {group.today && <span className="soft-pulse h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />}
              <span>{group.events.length}</span>
            </div>
            <div className="space-y-3">
              {group.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onSelect={() => onSelectObject(event.objectId)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
