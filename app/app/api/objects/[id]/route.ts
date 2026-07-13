import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { normalizePhotos, normalizeSections, normalizeVideos } from '@/lib/object-content'
import { uuidSchema } from '@/lib/validation'
import type { EventDto, ObjectFull } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  title: string
  description: string | null
  category_id: string
  category_title: string
  category_color: string
  district_name: string | null
  address: string | null
  lng: number
  lat: number
  photos: unknown
  videos: unknown
  audio_url: string | null
  audio_text: string | null
  rating: string | null
  sections: unknown
  model_url: string | null
  published: boolean
  sort_weight: number
}

interface EventRow {
  id: string
  title: string
  description: string | null
  starts_on: string
  ends_on: string
  starts_at: string | null
  ends_at: string | null
  timezone: string
  venue: string | null
  organizer: string | null
  price_info: string | null
  registration_url: string | null
  accessibility: string | null
  status: EventDto['status']
  is_today: boolean
}

/** Полная карточка опубликованного объекта */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  }

  const rows = await pg<Row[]>`
    select o.id, o.title, o.description, o.category_id,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           coalesce(o.photos, '[]'::jsonb) as photos,
           coalesce(o.videos, '[]'::jsonb) as videos,
           o.audio_url, o.audio_text, o.rating,
           coalesce(o.sections, '[]'::jsonb) as sections,
           o.model_url, o.published, o.sort_weight
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id} and o.published
    limit 1`

  const r = rows[0]
  if (!r) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

  // текущие и будущие мероприятия («сегодня» — по тюменскому времени)
  const eventRows = await pg<EventRow[]>`
    select e.id, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.price_info, e.registration_url,
           e.accessibility, e.status,
           (now() at time zone 'Asia/Yekaterinburg')::date between e.starts_on and e.ends_on as is_today
    from events e
    where e.object_id = ${id}
      and e.published
      and e.ends_on >= (now() at time zone 'Asia/Yekaterinburg')::date
    order by e.starts_on
    limit 10`

  const events: EventDto[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    timezone: e.timezone,
    venue: e.venue,
    organizer: e.organizer,
    priceInfo: e.price_info,
    registrationUrl: e.registration_url,
    accessibility: e.accessibility,
    status: e.status,
    isToday: e.is_today,
  }))
  const photos = normalizePhotos(r.photos)
  const videos = normalizeVideos(r.videos)
  const sections = normalizeSections(r.sections)

  const dto: ObjectFull = {
    id: r.id,
    title: r.title,
    description: r.description,
    categoryId: r.category_id,
    categoryTitle: r.category_title,
    categoryColor: r.category_color,
    districtName: r.district_name,
    address: r.address,
    lng: r.lng,
    lat: r.lat,
    photos,
    videos,
    audioUrl: r.audio_url,
    audioText: r.audio_text,
    rating: r.rating === null ? null : Number(r.rating),
    sections,
    modelUrl: r.model_url,
    published: r.published,
    sortWeight: r.sort_weight,
    events,
  }
  return NextResponse.json(dto)
}
