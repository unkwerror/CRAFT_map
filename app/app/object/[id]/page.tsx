import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { pg } from '@/lib/db'
import { normalizePhotos, normalizeSections, normalizeVideos } from '@/lib/object-content'
import { formatEventDates, formatEventTime } from '@/lib/public-events-ui'
import { getPublicEventsForObject } from '@/lib/public-events'
import { absoluteSiteUrl, serializeJsonLd } from '@/lib/seo'
import { uuidSchema } from '@/lib/validation'
import type { DescriptionSection, Photo, PublicEventDto, Video } from '@/lib/types'
import AudioGuide from '@/components/AudioGuide'
import ObjectMediaGallery from '@/components/ObjectMediaGallery'
import ObjectSections from '@/components/ObjectSections'
import ShareButton from '@/components/ShareButton'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  title: string
  description: string | null
  category_title: string
  category_color: string
  district_name: string | null
  address: string | null
  lng: number
  lat: number
  photos: Photo[]
  videos: Video[]
  audio_url: string | null
  audio_text: string | null
  sections: DescriptionSection[]
  model_url: string | null
}

type ObjectPageData = Row & { events: PublicEventDto[] }

const getObject = cache(async (id: string): Promise<ObjectPageData | null> => {
  if (!uuidSchema.safeParse(id).success) return null
  const rows = await pg<Row[]>`
    select o.id, o.title, o.description,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           coalesce(o.photos, '[]'::jsonb) as photos,
           coalesce(o.videos, '[]'::jsonb) as videos,
           o.audio_url, o.audio_text,
           coalesce(o.sections, '[]'::jsonb) as sections,
           o.model_url
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id} and o.published
    limit 1`
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    photos: normalizePhotos(row.photos),
    videos: normalizeVideos(row.videos),
    sections: normalizeSections(row.sections),
    events: await getPublicEventsForObject(id),
  }
})

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const obj = await getObject(id)
  if (!obj) {
    return {
      title: 'Объект не найден',
      robots: { index: false, follow: false },
    }
  }
  const description = obj.description?.replace(/\s+/g, ' ').trim().slice(0, 200)
    || `${obj.category_title} — карта памятных объектов Тюмени`
  const canonicalPath = `/object/${obj.id}`
  const images = obj.photos.map((photo) => ({
    url: absoluteSiteUrl(photo.original),
    alt: photo.alt ?? obj.title,
  }))
  return {
    title: obj.title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: obj.title,
      description,
      type: 'article',
      locale: 'ru_RU',
      siteName: 'Память Тюмени',
      url: canonicalPath,
      images,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title: obj.title,
      description,
      images,
    },
  }
}

export default async function ObjectPage({ params }: Params) {
  const { id } = await params
  const obj = await getObject(id)
  if (!obj) notFound()

  const pageUrl = absoluteSiteUrl(`/object/${obj.id}`)
  const mapUrl = absoluteSiteUrl(`/?object=${obj.id}`)
  const description = obj.description?.trim()
    || `${obj.category_title} в Тюмени${obj.address ? ` по адресу ${obj.address}` : ''}.`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    '@id': `${pageUrl}#attraction`,
    identifier: obj.id,
    name: obj.title,
    description,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    hasMap: mapUrl,
    touristType: obj.category_title,
    image: obj.photos.map((photo) => absoluteSiteUrl(photo.original)),
    address: {
      '@type': 'PostalAddress',
      ...(obj.address ? { streetAddress: obj.address } : {}),
      addressLocality: 'Тюмень',
      addressRegion: 'Тюменская область',
      addressCountry: 'RU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: obj.lat,
      longitude: obj.lng,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="object-page mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/?object=${obj.id}`}
        className="text-[15px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
      >
        ← Показать на карте
      </Link>

      <div className="mt-5 flex items-center gap-2 text-[13px] font-semibold leading-none text-[var(--ink-muted)]">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: obj.category_color }}
          aria-hidden
        />
        {obj.category_title}
      </div>

      <h1 className="mt-2 text-[28px] font-[650] leading-[1.2] tracking-[-0.012em] md:text-[32px]">{obj.title}</h1>

        {(obj.address || obj.district_name) && (
          <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ink-muted)]">
            {obj.address}
            {obj.address && obj.district_name ? ' · ' : ''}
            {obj.district_name ? `${obj.district_name} округ` : ''}
          </p>
        )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--hairline)]">
        <ObjectMediaGallery
          objectId={obj.id}
          title={obj.title}
          photos={obj.photos}
          videos={obj.videos}
          modelUrl={obj.model_url}
        />
      </div>

      {obj.events.length > 0 && (
        <section className="mt-6" aria-labelledby="object-events">
          <h2 id="object-events" className="text-xl font-semibold">Мероприятия</h2>
          <div className="mt-3 space-y-3">
            {obj.events.map((event) => {
              const time = formatEventTime(event.startsAt, event.endsAt)
              return (
                <article key={event.id} className="rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-4">
                  <p className="text-[13px] font-semibold text-[var(--accent)]">
                    {formatEventDates(event.startsOn, event.endsOn)}{time ? ` · ${time}` : ''}
                  </p>
                  <h3 className="mt-1.5 text-[17px] font-semibold">{event.title}</h3>
                  {event.status !== 'scheduled' && (
                    <p className={`mt-1 text-sm font-semibold ${event.status === 'cancelled' ? 'text-red-300' : 'text-amber-300'}`}>
                      {event.status === 'cancelled' ? 'Отменено' : 'Перенесено'}
                    </p>
                  )}
                  {event.venue && <p className="mt-1 text-sm text-[var(--ink-muted)]">{event.venue}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                    <Link href={`/event/${event.id}`} className="text-[var(--accent)] hover:underline">Подробнее</Link>
                    <a href={`/api/events/${event.id}/calendar`} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">В календарь</a>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="mt-5 space-y-4">
        <AudioGuide audioUrl={obj.audio_url} audioText={obj.audio_text} />
        <ObjectSections objectId={obj.id} description={obj.description} sections={obj.sections} />
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <a
          href={`https://yandex.ru/maps/?rtext=~${obj.lat},${obj.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent px-5 py-3 text-sm"
        >
          Маршрут в Яндекс.Картах →
        </a>
        <ShareButton title={obj.title} />
      </div>
      </main>
    </>
  )
}
