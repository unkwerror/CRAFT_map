import { pg } from './db'
import { normalizePhotos } from './object-content'
import type { PublicEventDto } from './types'

interface PublicEventRow {
  id: string
  title: string
  description: string | null
  starts_on: string
  ends_on: string
  is_today: boolean
  object_id: string
  object_title: string
  category_title: string
  category_color: string
  address: string | null
  district_name: string | null
  photos: unknown
}

/** Все текущие и будущие мероприятия у опубликованных памятников. */
export async function getUpcomingEvents(): Promise<PublicEventDto[]> {
  const rows = await pg<PublicEventRow[]>`
    with local_date as (
      select (now() at time zone 'Asia/Yekaterinburg')::date as today
    )
    select e.id, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           local_date.today between e.starts_on and e.ends_on as is_today,
           o.id as object_id, o.title as object_title,
           c.title as category_title, c.color as category_color,
           o.address, d.name as district_name, o.photos
    from events e
    join objects o on o.id = e.object_id
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    cross join local_date
    where o.published
      and e.ends_on >= local_date.today
    order by is_today desc, e.starts_on asc, e.ends_on asc, e.id asc`

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isToday: row.is_today,
    objectId: row.object_id,
    objectTitle: row.object_title,
    categoryTitle: row.category_title,
    categoryColor: row.category_color,
    address: row.address,
    districtName: row.district_name,
    thumb: normalizePhotos(row.photos)[0]?.thumb ?? '',
  }))
}
