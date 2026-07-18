import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { pg } from '@/lib/db'
import { slugSchema } from '@/lib/memory-graph'
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

const getPerson = cache(async (slug: string): Promise<PersonRow | null> => {
  if (!isFeatureEnabled('knowledge_graph_enabled')) return null
  if (!slugSchema.safeParse(slug).success) return null
  const [person] = await pg<PersonRow[]>`
    select id,name,aliases,birth_year as "birthYear",death_year as "deathYear",short_bio as "shortBio",
      biography,portrait_url as "portraitUrl",verification_status as "verificationStatus"
    from people where slug=${slug} and editorial_status='published'`
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

function lifeYears(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear !== null && deathYear !== null) return `${birthYear}—${deathYear}`
  if (birthYear !== null) return `род. ${birthYear}`
  if (deathYear !== null) return `ум. ${deathYear}`
  return null
}

export default async function PersonPage({ params }: Params) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()
  const [places, events] = await Promise.all([
    pg<{ id: string; title: string; relationType: string; publicNote: string | null }[]>`select o.id,o.title,op.relation_type as "relationType",op.public_note as "publicNote" from object_people op join objects o on o.id=op.object_id where op.person_id=${person.id} and o.published order by o.title`,
    pg<{ slug: string; title: string; dateFrom: string | null; relationType: string }[]>`select e.slug,e.title,e.date_from as "dateFrom",pe.relation_type as "relationType" from person_historical_events pe join historical_events e on e.id=pe.event_id where pe.person_id=${person.id} and e.editorial_status='published' order by e.date_from nulls last`,
  ])
  const years = lifeYears(person.birthYear, person.deathYear)
  return <main className="mx-auto max-w-3xl px-4 py-8"><Link href="/people" className="text-[var(--accent)]">← Все люди</Link><h1 className="mt-5 text-3xl font-semibold">{person.name}</h1>{person.aliases.length > 0 && <p className="mt-2 text-sm text-[var(--ink-muted)]">Также: {person.aliases.join(', ')}</p>}<p className="mt-3 text-sm">{years && `${years} · `}{person.verificationStatus === 'verified' ? 'Проверено редакцией' : 'Сведения проверяются редакцией'}</p>{person.shortBio && <p className="mt-6 text-lg">{person.shortBio}</p>}{person.biography && <div className="mt-5 whitespace-pre-line leading-7 text-[var(--ink-muted)]">{person.biography}</div>}{places.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Связанные места</h2><ul className="mt-3 space-y-3">{places.map((place) => <li key={place.id}><Link href={`/?object=${place.id}`} className="text-[var(--accent)] hover:underline">{place.title}</Link><span className="text-[var(--ink-muted)]"> · {place.relationType}</span>{place.publicNote && <p className="text-sm text-[var(--ink-muted)]">{place.publicNote}</p>}</li>)}</ul></section>}{events.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Исторические события</h2><ul className="mt-3 space-y-2">{events.map((event) => <li key={event.slug}><span className="font-medium">{event.title}</span><span className="text-[var(--ink-muted)]"> · {event.relationType}</span></li>)}</ul></section>}</main>
}
