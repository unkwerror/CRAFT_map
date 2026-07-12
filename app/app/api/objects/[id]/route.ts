import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { uuidSchema } from '@/lib/validation'
import type { DescriptionSection, EventDto, ObjectFull, Photo, Video } from '@/lib/types'

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
  photos: Photo[]
  videos: Video[]
  audio_url: string | null
  audio_text: string | null
  rating: string | null
  sections: DescriptionSection[]
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
           o.photos, o.videos, o.audio_url, o.audio_text, o.rating, o.sections,
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
           (now() at time zone 'Asia/Yekaterinburg')::date between e.starts_on and e.ends_on as is_today
    from events e
    where e.object_id = ${id}
      and e.ends_on >= (now() at time zone 'Asia/Yekaterinburg')::date
    order by e.starts_on
    limit 10`

  const events: EventDto[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
    isToday: e.is_today,
  }))

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
    photos: r.photos,
    videos: r.videos,
    audioUrl: r.audio_url,
    audioText: r.audio_text,
    rating: r.rating === null ? null : Number(r.rating),
    sections: r.sections,
    modelUrl: r.model_url,
    published: r.published,
    sortWeight: r.sort_weight,
    events,
  }
  return NextResponse.json(dto)
}
