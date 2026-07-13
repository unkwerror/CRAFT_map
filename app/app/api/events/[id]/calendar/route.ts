import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { createEventCalendar, type CalendarEvent } from '@/lib/ical'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

interface Row {
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
  status: CalendarEvent['status']
  address: string | null
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  const rows = await pg<Row[]>`
    select e.id, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.status, o.address
    from events e
    join objects o on o.id = e.object_id
    where e.id = ${id} and e.published and o.published
    limit 1`
  const row = rows[0]
  if (!row) return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })

  const body = createEventCalendar({
    id: row.id,
    title: row.title,
    description: row.description,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    venue: row.venue,
    address: row.address,
    organizer: row.organizer,
    status: row.status,
    url: `${req.nextUrl.origin}/event/${row.id}`,
  })

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="event-${row.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
