import { pg } from './db'
import type { PublicEventDto } from './types'

interface PublicEventRow {
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
  status: PublicEventDto['status']
  is_today: boolean
  object_id: string
  object_title: string
  category_title: string
  category_color: string
  address: string | null
  district_name: string | null
  thumb: string | null
}

function toPublicEventDto(row: PublicEventRow): PublicEventDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    venue: row.venue,
    organizer: row.organizer,
    priceInfo: row.price_info,
    registrationUrl: row.registration_url,
    accessibility: row.accessibility,
    status: row.status,
    isToday: row.is_today,
    objectId: row.object_id,
    objectTitle: row.object_title,
    categoryTitle: row.category_title,
    categoryColor: row.category_color,
    address: row.address,
    districtName: row.district_name,
    thumb: row.thumb ?? '',
  }
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
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.price_info, e.registration_url,
           e.accessibility, e.status,
           local_date.today between e.starts_on and e.ends_on as is_today,
           o.id as object_id, o.title as object_title,
           c.title as category_title, c.color as category_color,
           o.address, d.name as district_name,
           coalesce(o.photos -> 0 ->> 'thumb', '') as thumb
    from events e
    join objects o on o.id = e.object_id
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    cross join local_date
    where o.published
      and e.published
      and e.ends_on >= local_date.today
    order by is_today desc, e.starts_on asc, e.starts_at asc nulls last, e.ends_on asc, e.id asc
    limit 500`

  return rows.map(toPublicEventDto)
}

/** Отдельное опубликованное мероприятие, включая прошедшее для стабильной deep link. */
export async function getPublicEventById(id: string): Promise<PublicEventDto | null> {
  const rows = await pg<PublicEventRow[]>`
    with local_date as (
      select (now() at time zone 'Asia/Yekaterinburg')::date as today
    )
    select e.id, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.price_info, e.registration_url,
           e.accessibility, e.status,
           local_date.today between e.starts_on and e.ends_on as is_today,
           o.id as object_id, o.title as object_title,
           c.title as category_title, c.color as category_color,
           o.address, d.name as district_name,
           coalesce(o.photos -> 0 ->> 'thumb', '') as thumb
    from events e
    join objects o on o.id = e.object_id
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    cross join local_date
    where e.id = ${id} and e.published and o.published
    limit 1`
  return rows[0] ? toPublicEventDto(rows[0]) : null
}

/** Текущие и будущие опубликованные мероприятия конкретного памятника. */
export async function getPublicEventsForObject(id: string): Promise<PublicEventDto[]> {
  const rows = await pg<PublicEventRow[]>`
    with local_date as (
      select (now() at time zone 'Asia/Yekaterinburg')::date as today
    )
    select e.id, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.price_info, e.registration_url,
           e.accessibility, e.status,
           local_date.today between e.starts_on and e.ends_on as is_today,
           o.id as object_id, o.title as object_title,
           c.title as category_title, c.color as category_color,
           o.address, d.name as district_name,
           coalesce(o.photos -> 0 ->> 'thumb', '') as thumb
    from events e
    join objects o on o.id = e.object_id
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    cross join local_date
    where e.object_id = ${id} and e.published and o.published
      and e.ends_on >= local_date.today
    order by is_today desc, e.starts_on, e.starts_at nulls last, e.id
    limit 20`
  return rows.map(toPublicEventDto)
}
