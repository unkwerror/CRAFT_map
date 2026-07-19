'use client'

import { useEffect, useMemo, useState } from 'react'
import { lifeYears, nameInitials, verificationLabel } from '@/lib/people-format'

interface PanelPerson {
  slug: string
  name: string
  aliases: string[]
  birthYear: number | null
  deathYear: number | null
  shortBio: string | null
  portraitUrl: string | null
  verificationStatus: string
}

interface PanelPersonDetail extends PanelPerson {
  biography: string | null
  places: Array<{ id: string; title: string; address: string | null; relationType: string; publicNote: string | null }>
  events: Array<{ slug: string; title: string; dateFrom: string | null; relationType: string }>
}

interface Props {
  suspended: boolean
  selectedSlug: string | null
  onSelectPerson: (slug: string | null) => void
  onClose: () => void
  onSelectObject: (id: string) => void
}

function Portrait({ person, size }: { person: PanelPerson; size: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-12 w-12 text-[14px]'
  if (person.portraitUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.portraitUrl}
        alt=""
        loading="lazy"
        className={`${sizeClass} shrink-0 rounded-2xl border border-[var(--hairline)] object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${sizeClass} grid shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] font-semibold text-[var(--ink-subtle)]`}
    >
      {nameInitials(person.name)}
    </span>
  )
}

/** Окно «Люди» поверх карты: поиск, карточка человека, связанные места открываются на карте. */
export default function PeoplePanel({ suspended, selectedSlug, onSelectPerson, onClose, onSelectObject }: Props) {
  const [people, setPeople] = useState<PanelPerson[] | null>(null)
  const [listError, setListError] = useState(false)
  const [listTick, setListTick] = useState(0)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<{ slug: string; status: 'loading' | 'ready' | 'error'; data: PanelPersonDetail | null } | null>(null)
  const [detailTick, setDetailTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setListError(false)
    fetch('/api/v1/people', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<PanelPerson[]>
      })
      .then((rows) => {
        if (!cancelled) setPeople(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setListError(true)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [listTick])

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setDetail({ slug: selectedSlug, status: 'loading', data: null })
    fetch(`/api/v1/people/${selectedSlug}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<PanelPersonDetail>
      })
      .then((data) => {
        if (!cancelled) setDetail({ slug: selectedSlug, status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setDetail({ slug: selectedSlug, status: 'error', data: null })
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedSlug, detailTick])

  const q = query.trim().toLocaleLowerCase('ru-RU')
  const filtered = useMemo(() => {
    if (!people) return []
    if (!q) return people
    // Совпадает с personMatches из lib/memory-graph: имя и все псевдонимы.
    return people.filter((person) =>
      [person.name, ...person.aliases].some((value) => value.toLocaleLowerCase('ru-RU').includes(q))
    )
  }, [people, q])

  return (
    <section
      aria-label="Люди в истории города"
      className={`events-panel map-side-panel-xl panel-scroll absolute z-[12] overflow-y-auto outline-none max-xl:inset-0 xl:right-0 xl:top-0 xl:h-full xl:border-l xl:border-[var(--hairline)] ${suspended ? 'events-panel--suspended' : ''}`}
    >
      <div className="events-panel__header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Городская память</p>
            <h2 className="mt-1.5 text-[26px] font-[650] leading-tight tracking-[-0.015em] md:text-[29px]">
              Люди
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-muted)]">
              Судьбы, связанные с памятными местами: адреса из биографий открываются на карте.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Свернуть раздел «Люди» и вернуться к карте"
            className="events-panel__close flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {!selectedSlug && (
          <div className="events-search mt-4 flex items-center gap-2.5 rounded-xl px-3.5">
            <svg className="shrink-0 text-[var(--ink-subtle)]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              aria-label="Поиск по имени"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, фамилия или псевдоним"
              className="min-h-11 w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--ink-subtle)] [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        )}
      </div>

      <div className="events-panel__content">
        {!selectedSlug && (
          <>
            {people === null && !listError && (
              <div className="space-y-3" aria-busy="true">
                <span role="status" className="sr-only">Загружаем биографии</span>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="soft-pulse h-24 rounded-2xl border border-[var(--hairline)] bg-white/[0.04]" />
                ))}
              </div>
            )}
            {listError && (
              <div role="alert" className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5">
                <p className="font-medium">Не удалось загрузить биографии</p>
                <button
                  type="button"
                  onClick={() => setListTick((tick) => tick + 1)}
                  className="btn-accent mt-3 min-h-11 rounded-xl px-4 text-sm"
                >
                  Повторить
                </button>
              </div>
            )}
            {people !== null && !listError && (
              <>
                <p role="status" className={q ? 'mb-3 text-sm text-[var(--ink-subtle)]' : 'sr-only'}>
                  {q ? `Найдено: ${filtered.length}` : ''}
                </p>
                {people.length === 0 && (
                  <p className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5 text-[var(--ink-muted)]">
                    Опубликованных биографий пока нет — редакция готовит первые очерки.
                  </p>
                )}
                {people.length > 0 && filtered.length === 0 && (
                  <div className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5">
                    <p className="font-medium">Никого не нашлось</p>
                    <button type="button" onClick={() => setQuery('')} className="btn-ghost mt-3 min-h-10 rounded-xl px-4 text-sm">
                      Сбросить запрос
                    </button>
                  </div>
                )}
                <ul className="space-y-3">
                  {filtered.map((person, index) => {
                    const years = lifeYears(person.birthYear, person.deathYear)
                    return (
                      <li key={person.slug} className="fade-in-rise" style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}>
                        <button
                          type="button"
                          onClick={() => onSelectPerson(person.slug)}
                          className="group flex w-full items-start gap-3.5 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-4 text-left transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                        >
                          <Portrait person={person} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold leading-5 transition-colors group-hover:text-[var(--accent)]">
                              {person.name}
                            </span>
                            {years && <span className="mt-0.5 block text-[13px] text-[var(--ink-subtle)]">{years}</span>}
                            {person.shortBio && (
                              <span className="mt-1.5 line-clamp-2 block text-[13px] leading-5 text-[var(--ink-muted)]">
                                {person.shortBio}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}

        {selectedSlug && (
          <div className="fade-in-rise">
            <button
              type="button"
              onClick={() => onSelectPerson(null)}
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              ← Все люди
            </button>

            {detail?.status === 'loading' && (
              <div className="mt-5 space-y-3" aria-busy="true">
                <span role="status" className="sr-only">Загружаем биографию</span>
                <div className="soft-pulse h-20 w-20 rounded-2xl bg-white/[0.07]" />
                <div className="soft-pulse h-7 w-2/3 rounded-lg bg-white/[0.07]" />
                <div className="soft-pulse h-4 w-full rounded bg-white/[0.05]" />
              </div>
            )}

            {detail?.status === 'error' && (
              <div role="alert" className="mt-5 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5">
                <p className="font-medium">Не удалось загрузить биографию</p>
                <button
                  type="button"
                  onClick={() => setDetailTick((tick) => tick + 1)}
                  className="btn-accent mt-3 min-h-11 rounded-xl px-4 text-sm"
                >
                  Повторить
                </button>
              </div>
            )}

            {detail?.status === 'ready' && detail.data && (
              <div className="mt-4">
                <div className="flex items-start gap-4">
                  <Portrait person={detail.data} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-[650] leading-tight tracking-[-0.01em]">{detail.data.name}</h3>
                    {detail.data.aliases.length > 0 && (
                      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Также: {detail.data.aliases.join(', ')}</p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-medium">
                      {lifeYears(detail.data.birthYear, detail.data.deathYear) && (
                        <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-2.5 py-1 text-[var(--ink-muted)]">
                          {lifeYears(detail.data.birthYear, detail.data.deathYear)}
                        </span>
                      )}
                      {verificationLabel(detail.data.verificationStatus).verified && (
                        <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-emerald-200">
                          ✓ Проверено редакцией
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {detail.data.shortBio && <p className="mt-4 text-[15px] leading-7">{detail.data.shortBio}</p>}
                {detail.data.biography && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--ink-muted)]">
                    {detail.data.biography}
                  </p>
                )}

                {detail.data.places.length > 0 && (
                  <section className="mt-6" aria-label="Связанные места">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">
                      Связанные места
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {detail.data.places.map((place) => (
                        <li key={`${place.id}-${place.relationType}`}>
                          <button
                            type="button"
                            onClick={() => onSelectObject(place.id)}
                            className="group flex w-full items-start gap-3 rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3 text-left transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                          >
                            <svg className="mt-0.5 shrink-0 text-[var(--ink-subtle)] transition-colors group-hover:text-[var(--accent)]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.6" />
                              <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">
                                {place.title}
                              </span>
                              <span className="mt-0.5 block text-xs text-[var(--ink-subtle)]">{place.relationType}</span>
                              {place.publicNote && (
                                <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">{place.publicNote}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-[var(--ink-subtle)]">Место откроется на карте.</p>
                  </section>
                )}

                {detail.data.events.length > 0 && (
                  <section className="mt-6" aria-label="Исторические события">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">
                      События
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {detail.data.events.map((event) => (
                        <li key={event.slug} className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-3">
                          <p className="text-sm font-semibold">
                            {event.title}
                            {event.dateFrom && (
                              <span className="ml-2 text-xs font-normal text-[var(--ink-subtle)]">
                                {event.dateFrom.slice(0, 4)}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{event.relationType}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <a
                  href={`/people/${detail.slug}`}
                  className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--hairline)] px-4 text-[13px] font-semibold text-[var(--ink-muted)] hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
                >
                  Страница биографии для ссылки
                  <span aria-hidden>→</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
