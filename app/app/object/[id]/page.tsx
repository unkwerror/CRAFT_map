import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pg } from '@/lib/db'
import { normalizePhotos, normalizeSections, normalizeVideos } from '@/lib/object-content'
import { uuidSchema } from '@/lib/validation'
import type { DescriptionSection, Photo, Video } from '@/lib/types'
import AudioGuide from '@/components/AudioGuide'
import ObjectMediaGallery from '@/components/ObjectMediaGallery'
import ObjectSections from '@/components/ObjectSections'

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

async function getObject(id: string): Promise<Row | null> {
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
  }
}

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const obj = await getObject(id)
  if (!obj) return { title: 'Объект не найден' }
  const description = obj.description?.slice(0, 200) ?? `${obj.category_title} — карта памятных объектов Тюмени`
  return {
    title: `${obj.title} — Карта памятных объектов Тюмени`,
    description,
    openGraph: {
      title: obj.title,
      description,
      images: obj.photos[0] ? [{ url: obj.photos[0].original }] : [],
    },
  }
}

export default async function ObjectPage({ params }: Params) {
  const { id } = await params
  const obj = await getObject(id)
  if (!obj) notFound()

  return (
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

      {obj.address && (
        <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ink-muted)]">
          {obj.address}
          {obj.district_name ? ` · ${obj.district_name} округ` : ''}
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

      <div className="mt-5 space-y-4">
        <AudioGuide audioUrl={obj.audio_url} audioText={obj.audio_text} />
        <ObjectSections objectId={obj.id} description={obj.description} sections={obj.sections} />
      </div>

      <a
        href={`https://yandex.ru/maps/?rtext=~${obj.lat},${obj.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-accent mt-7 px-5 py-3 text-sm"
      >
        Маршрут в Яндекс.Картах →
      </a>
    </main>
  )
}
