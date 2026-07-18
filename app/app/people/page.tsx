import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { pg } from '@/lib/db'
import PeopleDirectory, { type PublicPerson } from '@/components/PeopleDirectory'

export const dynamic = 'force-dynamic'

const title = 'Люди в истории города'
const description =
  'Биографии людей, чьи судьбы связаны с памятными местами Тюмени: краткие очерки, связанные адреса и исторические события.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/people' },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Память Тюмени',
    title,
    description,
    url: '/people',
  },
}

export default async function PeoplePage() {
  if (!isFeatureEnabled('knowledge_graph_enabled')) notFound()
  const people = await pg<PublicPerson[]>`
    select slug,name,aliases,birth_year as "birthYear",death_year as "deathYear",
      short_bio as "shortBio",verification_status as "verificationStatus"
    from people where editorial_status='published' order by name`
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <Link href="/" className="text-[var(--accent)]">← На карту</Link>
    <h1 className="mt-5 text-3xl font-semibold">Люди в истории города</h1>
    {people.length === 0
      ? <p className="mt-8 rounded-xl border border-[var(--hairline)] p-5">Опубликованных биографий пока нет.</p>
      : <PeopleDirectory people={people} />}
  </main>
}
