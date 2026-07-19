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
    select slug, name, aliases, birth_year as "birthYear", death_year as "deathYear",
      short_bio as "shortBio", portrait_url as "portraitUrl",
      verification_status as "verificationStatus"
    from people where editorial_status = 'published' order by name`

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-8">
      <nav aria-label="Навигация">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← На карту</Link>
      </nav>

      <header className="mt-8">
        <p className="eyebrow">Городская память</p>
        <h1 className="mt-2 text-3xl font-semibold">Люди в истории города</h1>
        <p className="mt-3 max-w-xl leading-7 text-[var(--ink-muted)]">
          Судьбы, связанные с памятными местами Тюмени: у каждого человека — краткий очерк,
          адреса на карте и события, в которых он участвовал.
        </p>
      </header>

      {people.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-6 text-[var(--ink-muted)]">
          Опубликованных биографий пока нет — редакция готовит первые очерки.
        </p>
      ) : (
        <PeopleDirectory people={people} />
      )}
    </main>
  )
}
