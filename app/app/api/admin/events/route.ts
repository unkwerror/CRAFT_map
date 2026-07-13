import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { eventInputSchema } from '@/lib/validation'
import type { AdminEventRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  object_id: string
  object_title: string
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
  status: AdminEventRow['status']
  published: boolean
}

/** Список мероприятий (ближайшие сверху) */
export async function GET() {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const rows = await pg<Row[]>`
    select e.id, e.object_id, o.title as object_title, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on,
           case when e.starts_at is null then null else to_char(e.starts_at, 'HH24:MI') end as starts_at,
           case when e.ends_at is null then null else to_char(e.ends_at, 'HH24:MI') end as ends_at,
           e.timezone, e.venue, e.organizer, e.price_info, e.registration_url,
           e.accessibility, e.status, e.published
    from events e
    join objects o on o.id = e.object_id
    order by e.starts_on desc, e.created_at desc
    limit 500`

  const list: AdminEventRow[] = rows.map((r) => ({
    id: r.id,
    objectId: r.object_id,
    objectTitle: r.object_title,
    title: r.title,
    description: r.description,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    timezone: r.timezone,
    venue: r.venue,
    organizer: r.organizer,
    priceInfo: r.price_info,
    registrationUrl: r.registration_url,
    accessibility: r.accessibility,
    status: r.status,
    published: r.published,
  }))
  return NextResponse.json(list)
}

/** Создание мероприятия */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const parsed = eventInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
      { status: 400 }
    )
  }
  const d = parsed.data

  try {
    const row = await pg.begin(async (sql) => {
      const [created] = await sql<{ id: string }[]>`
        insert into events (
          object_id, title, description, starts_on, ends_on, starts_at, ends_at,
          timezone, venue, organizer, price_info, registration_url, accessibility,
          status, published
        )
        values (
          ${d.objectId}, ${d.title}, ${d.description ?? null}, ${d.startsOn}, ${d.endsOn},
          ${d.startsAt ?? null}, ${d.endsAt ?? null}, ${d.timezone}, ${d.venue ?? null},
          ${d.organizer ?? null}, ${d.priceInfo ?? null}, ${d.registrationUrl ?? null},
          ${d.accessibility ?? null}, ${d.status}, ${d.published}
        )
        returning id`
      if (!created) throw new Error('Event insert returned no id')
      await appendAdminAudit(sql, guard.session, {
        action: 'create',
        entity: 'event',
        entityId: created.id,
        metadata: {
          objectId: d.objectId,
          status: d.status,
          published: d.published,
        },
      })
      return created
    })
    return NextResponse.json({ id: row.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Не удалось создать мероприятие (проверьте объект)' }, { status: 400 })
  }
}
