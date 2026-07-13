import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { eventInputSchema, uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })

/** Обновление мероприятия */
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

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
      const [updated] = await sql<{ id: string }[]>`
        update events
        set object_id = ${d.objectId}, title = ${d.title}, description = ${d.description ?? null},
            starts_on = ${d.startsOn}, ends_on = ${d.endsOn},
            starts_at = ${d.startsAt ?? null}, ends_at = ${d.endsAt ?? null},
            timezone = ${d.timezone}, venue = ${d.venue ?? null},
            organizer = ${d.organizer ?? null}, price_info = ${d.priceInfo ?? null},
            registration_url = ${d.registrationUrl ?? null}, accessibility = ${d.accessibility ?? null},
            status = ${d.status}, published = ${d.published}, updated_at = now()
        where id = ${id}
        returning id`
      if (!updated) return null
      await appendAdminAudit(sql, guard.session, {
        action: 'update',
        entity: 'event',
        entityId: updated.id,
        metadata: {
          objectId: d.objectId,
          status: d.status,
          published: d.published,
        },
      })
      return updated
    })
    if (!row) return notFound()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Не удалось сохранить мероприятие' }, { status: 400 })
  }
}

/** Удаление мероприятия */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const row = await pg.begin(async (sql) => {
    const [deleted] = await sql<{ id: string }[]>`
      delete from events where id = ${id} returning id`
    if (!deleted) return null
    await appendAdminAudit(sql, guard.session, {
      action: 'delete',
      entity: 'event',
      entityId: deleted.id,
    })
    return deleted
  })
  if (!row) return notFound()
  return NextResponse.json({ ok: true })
}
