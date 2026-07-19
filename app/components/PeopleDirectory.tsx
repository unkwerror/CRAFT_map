'use client'

import Link from 'next/link'
import { useState } from 'react'
import { lifeYears, nameInitials, verificationLabel } from '@/lib/people-format'

export type PublicPerson = {
  slug: string
  name: string
  aliases: string[]
  birthYear: number | null
  deathYear: number | null
  shortBio: string | null
  portraitUrl: string | null
  verificationStatus: string
}

export default function PeopleDirectory({ people }: { people: PublicPerson[] }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase('ru-RU')
  // Совпадает с personMatches из lib/memory-graph: имя и все псевдонимы.
  const filtered = q
    ? people.filter((person) =>
        [person.name, ...person.aliases].some((value) => value.toLocaleLowerCase('ru-RU').includes(q))
      )
    : people

  return (
    <>
      <div className="relative mt-6">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-subtle)]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          aria-label="Поиск по имени"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Имя, фамилия или псевдоним"
          className="w-full rounded-xl border border-[var(--hairline)] bg-white/[0.04] py-3 pl-10 pr-4 text-[15px] outline-none transition-colors focus-visible:border-[var(--accent)] [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <p role="status" className={q ? 'mt-3 text-sm text-[var(--ink-subtle)]' : 'sr-only'}>
        {q ? `Найдено: ${filtered.length}` : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-6">
          <p className="font-medium">Никого не нашлось</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Попробуйте другое написание имени или сбросьте запрос.</p>
          <button type="button" onClick={() => setQuery('')} className="btn-ghost mt-4 min-h-10 rounded-xl px-4 text-sm">
            Сбросить запрос
          </button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((person) => {
            const years = lifeYears(person.birthYear, person.deathYear)
            const verification = verificationLabel(person.verificationStatus)
            return (
              <li key={person.slug}>
                <Link
                  href={`/people/${person.slug}`}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5 transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                >
                  {person.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.portraitUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-2xl border border-[var(--hairline)] object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] text-[15px] font-semibold text-[var(--ink-subtle)]"
                    >
                      {nameInitials(person.name)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <h2 className="text-lg font-semibold leading-6 transition-colors group-hover:text-[var(--accent)]">
                      {person.name}
                    </h2>
                    {years && <p className="mt-0.5 text-sm text-[var(--ink-subtle)]">{years}</p>}
                    {person.shortBio && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">{person.shortBio}</p>
                    )}
                    {verification.verified && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-emerald-200/90">
                        <span aria-hidden>✓</span> {verification.text}
                      </p>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
