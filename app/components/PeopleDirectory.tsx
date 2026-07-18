'use client'

import Link from 'next/link'
import { useState } from 'react'

export type PublicPerson = {
  slug: string
  name: string
  aliases: string[]
  birthYear: number | null
  deathYear: number | null
  shortBio: string | null
  verificationStatus: string
}

export default function PeopleDirectory({ people }: { people: PublicPerson[] }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase('ru-RU')
  // Совпадает с personMatches из lib/memory-graph: имя и все псевдонимы.
  const filtered = q
    ? people.filter((person) => [person.name, ...person.aliases].some((value) => value.toLocaleLowerCase('ru-RU').includes(q)))
    : people
  return <>
    <input
      type="search"
      aria-label="Поиск по имени"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Имя, фамилия или псевдоним"
      className="mt-6 w-full rounded-xl border border-[var(--hairline)] bg-transparent p-3 outline-none focus-visible:border-[var(--accent)]"
    />
    {filtered.length === 0
      ? <p className="mt-6 rounded-xl border border-[var(--hairline)] p-5">Никого не нашлось. Попробуйте другое написание имени.</p>
      : <ul className="mt-6 grid gap-4 md:grid-cols-2">{filtered.map((person) => <li key={person.slug}>
          <Link href={`/people/${person.slug}`} className="block rounded-2xl border border-[var(--hairline)] bg-white/[.03] p-5 hover:bg-white/[.06]">
            <h2 className="text-xl font-semibold">{person.name}</h2>
            {(person.birthYear || person.deathYear) && <p className="mt-1 text-sm text-[var(--ink-subtle)]">{person.birthYear ?? '?'}—{person.deathYear ?? ''}</p>}
            {person.shortBio && <p className="mt-3 text-sm text-[var(--ink-muted)]">{person.shortBio}</p>}
            <p className="mt-3 text-xs text-[var(--ink-subtle)]">{person.verificationStatus === 'verified' ? 'Проверено редакцией' : 'Статус проверки указан в карточке'}</p>
          </Link>
        </li>)}</ul>}
  </>
}
