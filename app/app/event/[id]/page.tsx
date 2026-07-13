import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import ShareButton from '@/components/ShareButton'
import { eventSchemaDateTimes, formatEventDates, formatEventTime } from '@/lib/public-events-ui'
import { getPublicEventById } from '@/lib/public-events'
import { absoluteSiteUrl, serializeJsonLd } from '@/lib/seo'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const getEvent = cache(async (id: string) => {
  if (!uuidSchema.safeParse(id).success) return null
  return getPublicEventById(id)
})

type Params = { params: Promise<{ id: string }> }

function statusTitle(status: 'scheduled' | 'postponed' | 'cancelled'): string | null {
  if (status === 'cancelled') return 'Мероприятие отменено'
  if (status === 'postponed') return 'Мероприятие перенесено — уточните актуальную дату'
  return null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) return { title: 'Мероприятие не найдено', robots: { index: false, follow: false } }
  const description = event.description?.replace(/\s+/g, ' ').trim().slice(0, 200)
    || `${formatEventDates(event.startsOn, event.endsOn)} — ${event.objectTitle}`
  const images = event.thumb ? [{ url: absoluteSiteUrl(event.thumb), alt: event.title }] : []
  return {
    title: event.title,
    description,
    alternates: { canonical: `/event/${event.id}` },
    openGraph: {
      type: 'article',
      locale: 'ru_RU',
      siteName: 'Память Тюмени',
      title: event.title,
      description,
      url: `/event/${event.id}`,
      images,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      images,
    },
  }
}

export default async function EventPage({ params }: Params) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) notFound()

  const pageUrl = absoluteSiteUrl(`/event/${event.id}`)
  const status = statusTitle(event.status)
  const eventStatus = event.status === 'cancelled'
    ? 'https://schema.org/EventCancelled'
    : event.status === 'postponed'
      ? 'https://schema.org/EventPostponed'
      : 'https://schema.org/EventScheduled'
  const structuredDates = eventSchemaDateTimes(
    event.startsOn,
    event.endsOn,
    event.startsAt,
    event.endsAt
  )
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${pageUrl}#event`,
    name: event.title,
    description: event.description ?? undefined,
    url: pageUrl,
    ...structuredDates,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: event.thumb ? [absoluteSiteUrl(event.thumb)] : undefined,
    location: {
      '@type': 'Place',
      name: event.venue ?? event.objectTitle,
      url: absoluteSiteUrl(`/object/${event.objectId}`),
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address ?? undefined,
        addressLocality: 'Тюмень',
        addressRegion: 'Тюменская область',
        addressCountry: 'RU',
      },
    },
    organizer: event.organizer ? { '@type': 'Organization', name: event.organizer } : undefined,
    isAccessibleForFree: event.priceInfo?.toLocaleLowerCase('ru').includes('бесплат') || undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="object-page mx-auto max-w-2xl px-4 py-8">
        <Link href="/?view=events" className="text-[15px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
          ← Все мероприятия
        </Link>

        <p className="eyebrow mt-6">Афиша города</p>
        <h1 className="mt-2 text-[30px] font-[680] leading-[1.16] tracking-[-0.018em] md:text-[38px]">
          {event.title}
        </h1>

        {status && (
          <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${event.status === 'cancelled' ? 'border-red-400/35 bg-red-400/10 text-red-200' : 'border-amber-400/35 bg-amber-400/10 text-amber-200'}`} role="status">
            {status}
          </div>
        )}

        {event.thumb && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.thumb} alt="" className="max-h-[360px] w-full object-cover" />
          </div>
        )}

        <dl className="mt-6 grid gap-4 rounded-2xl border border-[var(--hairline)] bg-white/[0.03] p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">Когда</dt>
            <dd className="mt-1 text-[16px] font-semibold leading-relaxed">
              {formatEventDates(event.startsOn, event.endsOn)}
              {formatEventTime(event.startsAt, event.endsAt) && (
                <span className="block text-[var(--accent)]">{formatEventTime(event.startsAt, event.endsAt)}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">Где</dt>
            <dd className="mt-1 text-[16px] font-semibold leading-relaxed">
              {event.venue ?? event.objectTitle}
              {event.address && <span className="block text-sm font-normal text-[var(--ink-muted)]">{event.address}</span>}
            </dd>
          </div>
          {event.organizer && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">Организатор</dt>
              <dd className="mt-1 text-[15px]">{event.organizer}</dd>
            </div>
          )}
          {event.priceInfo && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">Стоимость</dt>
              <dd className="mt-1 text-[15px]">{event.priceInfo}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <section className="mt-6" aria-labelledby="event-description">
            <h2 id="event-description" className="text-xl font-semibold">О мероприятии</h2>
            <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.75] text-[var(--ink)]/90">{event.description}</p>
          </section>
        )}

        {event.accessibility && (
          <section className="mt-6 rounded-xl border border-[var(--hairline)] p-4" aria-labelledby="event-accessibility">
            <h2 id="event-accessibility" className="text-sm font-semibold">Доступность</h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink-muted)]">{event.accessibility}</p>
          </section>
        )}

        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          Место связано с памятником «{event.objectTitle}».
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {event.registrationUrl && event.status !== 'cancelled' && (
            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-accent min-h-11 px-5 py-3 text-sm">
              Зарегистрироваться ↗
            </a>
          )}
          <a href={`/api/events/${event.id}/calendar`} className="btn-ghost min-h-11 rounded-xl px-4 py-3 text-sm">
            Добавить в календарь
          </a>
          <Link href={`/?object=${event.objectId}`} className="btn-ghost min-h-11 rounded-xl px-4 py-3 text-sm">
            Показать памятник на карте
          </Link>
          <ShareButton title={event.title} />
        </div>
      </main>
    </>
  )
}
