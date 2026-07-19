import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { pg } from '@/lib/db'
import { slugSchema } from '@/lib/memory-graph'
import { lifeYears, nameInitials, verificationLabel } from '@/lib/people-format'
import { absoluteSiteUrl } from '@/lib/seo'

type Params = { params: Promise<{ slug: string }> }
export const dynamic = 'force-dynamic'

interface PersonRow {
  id: string
  name: string
  aliases: string[]
  birthYear: number | null
  deathYear: number | null
  shortBio: string | null
  biography: string | null
  portraitUrl: string | null
  verificationStatus: string
}

interface RelatedPlace {
  id: string
  title: string
  relationType: string
  publicNote: string | null
  thumb: string | null
}

interface RelatedEvent {
  slug: string
  title: string
  dateFrom: string | null
  relationType: string
}

const getPerson = cache(async (slug: string): Promise<PersonRow | null> => {
  if (!isFeatureEnabled('knowledge_graph_enabled')) return null
  if (!slugSchema.safeParse(slug).success) return null
  const [person] = await pg<PersonRow[]>`
    select id, name, aliases, birth_year as "birthYear", death_year as "deathYear",
      short_bio as "shortBio", biography, portrait_url as "portraitUrl",
      verification_status as "verificationStatus"
    from people where slug = ${slug} and editorial_status = 'published'`
  return person ?? null
})

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) return { title: 'Биография не найдена', robots: { index: false, follow: false } }
  const description = person.shortBio?.replace(/\s+/g, ' ').trim().slice(0, 200)
    || `${person.name} — люди в истории Тюмени`
  const canonicalPath = `/people/${slug}`
  const images = person.portraitUrl
    ? [{ url: absoluteSiteUrl(person.portraitUrl), alt: person.name }]
    : []
  return {
    title: person.name,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'profile',
      locale: 'ru_RU',
      siteName: 'Память Тюмени',
      title: person.name,
      description,
      url: canonicalPath,
      images,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title: person.name,
      description,
      images,
    },
  }
}

export default async function PersonPage({ params }: Params) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()

  const [places, events] = await Promise.all([
    pg<RelatedPlace[]>`
      select o.id, o.title, op.relation_type as "relationType", op.public_note as "publicNote",
        o.photos->0->>'thumb' as thumb
      from object_people op
      join objects o on o.id = op.object_id
      where op.person_id = ${person.id} and o.published
      order by o.title`,
    pg<RelatedEvent[]>`
      select e.slug, e.title, e.date_from as "dateFrom", pe.relation_type as "relationType"
      from person_historical_events pe
      join historical_events e on e.id = pe.event_id
      where pe.person_id = ${person.id} and e.editorial_status = 'published'
      order by e.date_from nulls last`,
  ])

  const years = lifeYears(person.birthYear, person.deathYear)
  const verification = verificationLabel(person.verificationStatus)

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <nav aria-label="Навигация">
        <Link href="/people" className="text-sm text-[var(--accent)] hover:underline">← Все люди</Link>
      </nav>

      <header className="mt-8 flex items-start gap-5">
        {person.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.portraitUrl}
            alt={`Портрет: ${person.name}`}
            className="h-24 w-24 shrink-0 rounded-2xl border border-[var(--hairline)] object-cover md:h-28 md:w-28"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] text-2xl font-semibold text-[var(--ink-subtle)] md:h-28 md:w-28"
          >
            {nameInitials(person.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="eyebrow">Городская память</p>
          <h1 className="mt-1 text-3xl font-semibold">{person.name}</h1>
          {person.aliases.length > 0 && (
            <p className="mt-1.5 text-sm text-[var(--ink-muted)]">Также: {person.aliases.join(', ')}</p>
          )}
          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
            {years && (
              <span className="rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1 text-[13px] font-medium text-[var(--ink-muted)]">
                {years}
              </span>
            )}
            <span
              className={`rounded-full border px-3 py-1 text-[13px] font-medium ${
                verification.verified
                  ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                  : 'border-[var(--hairline)] bg-white/[0.03] text-[var(--ink-subtle)]'
              }`}
            >
              {verification.verified ? '✓ ' : ''}{verification.text}
            </span>
          </p>
        </div>
      </header>

      {person.shortBio && <p className="mt-7 text-lg leading-8">{person.shortBio}</p>}
      {person.biography && (
        <div className="mt-5 whitespace-pre-line leading-7 text-[var(--ink-muted)]">{person.biography}</div>
      )}

      {places.length > 0 && (
        <section className="mt-10" aria-labelledby="person-places-heading">
          <h2 id="person-places-heading" className="text-xl font-semibold">Связанные места</h2>
          <ul className="mt-4 space-y-3">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/?object=${place.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-3 transition-colors hover:border-[var(--hairline-strong)] hover:bg-white/[0.05]"
                >
                  {place.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={place.thumb} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--ink-subtle)]">
                        <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold transition-colors group-hover:text-[var(--accent)]">
                      {place.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-[var(--ink-subtle)]">{place.relationType}</span>
                    {place.publicNote && (
                      <span className="mt-1 block text-sm leading-6 text-[var(--ink-muted)]">{place.publicNote}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-10" aria-labelledby="person-events-heading">
          <h2 id="person-events-heading" className="text-xl font-semibold">Исторические события</h2>
          <ul className="mt-4 space-y-3">
            {events.map((event) => (
              <li key={event.slug} className="rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-4">
                <p className="font-semibold">
                  {event.title}
                  {event.dateFrom && (
                    <span className="ml-2 text-sm font-normal text-[var(--ink-subtle)]">{event.dateFrom.slice(0, 4)}</span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{event.relationType}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
