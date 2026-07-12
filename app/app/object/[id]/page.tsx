import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pg } from '@/lib/db'
import { uuidSchema } from '@/lib/validation'
import type { DescriptionSection, Photo, Video } from '@/lib/types'

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
}

async function getObject(id: string): Promise<Row | null> {
  if (!uuidSchema.safeParse(id).success) return null
  const rows = await pg<Row[]>`
    select o.id, o.title, o.description,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat, o.photos,
           o.videos, o.audio_url, o.audio_text, o.sections
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id} and o.published
    limit 1`
  return rows[0] ?? null
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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/?object=${obj.id}`}
        className="text-sm text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
      >
        ← Показать на карте
      </Link>

      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: obj.category_color }}
          aria-hidden
        />
        {obj.category_title}
      </div>

      <h1 className="mt-2 text-2xl font-semibold leading-snug">{obj.title}</h1>

      {obj.address && (
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          {obj.address}
          {obj.district_name ? ` · ${obj.district_name} округ` : ''}
        </p>
      )}

      {obj.photos.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {obj.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.original}
              src={p.original}
              alt={p.alt ?? obj.title}
              className="w-full rounded-xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {obj.videos.length > 0 && (
        <div className="mt-5 space-y-3">
          {obj.videos.map((v) => (
            <video
              key={v.src}
              src={v.src}
              poster={v.poster}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-xl bg-black"
            />
          ))}
        </div>
      )}

      {obj.audio_url && (
        <div className="mt-6">
          <h2 className="eyebrow mb-2">Аудиогид</h2>
          <audio src={obj.audio_url} controls preload="metadata" className="h-9 w-full" />
          {obj.audio_text && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/85">
              {obj.audio_text}
            </p>
          )}
        </div>
      )}

      {obj.description && (
        <p className="mt-6 whitespace-pre-line leading-relaxed text-[var(--ink)]/85">
          {obj.description}
        </p>
      )}

      {obj.sections.map((s) => (
        <section key={s.title} className="mt-6">
          <h2 className="eyebrow mb-1.5">{s.title}</h2>
          <p className="whitespace-pre-line leading-relaxed text-[var(--ink)]/85">{s.text}</p>
        </section>
      ))}

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
