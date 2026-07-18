import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { EDITORIAL_STATUSES, canTransitionEditorialStatus, type EditorialStatus } from '@/lib/editorial-workflow'
import { requireRole } from '@/lib/guard'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
const inputSchema = z.object({ status: z.enum(EDITORIAL_STATUSES), comment: z.string().trim().max(2000).nullish() }).strict()

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: 'Маршрут не найден' }, { status: 404 })
  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  const target = parsed.data.status

  const result = await pg.begin(async (sql) => {
    const [current] = await sql<{ status: EditorialStatus }[]>`select status from routes where id = ${id} for update`
    if (!current) return 'not_found' as const
    if (!canTransitionEditorialStatus(current.status, target)) return 'invalid' as const
    if (target === 'published') {
      const [stopStat] = await sql<{ total: number }[]>`
        select count(*)::int as total from route_stops rs join objects o on o.id = rs.object_id
        where rs.route_id = ${id} and o.published`
      if (!stopStat || stopStat.total < 2) return 'few_stops' as const
    }
    await sql`
      update routes set status = ${target},
        published_at = case when ${target} = 'published' then coalesce(published_at, now()) else published_at end,
        updated_at = now()
      where id = ${id}`
    await sql`
      insert into editorial_tasks (entity_type, entity_id, status, assignee_id, comments)
      values ('route', ${id}, ${target}, ${guard.session.user.id}, ${parsed.data.comment ?? null})`
    await appendAdminAudit(sql, guard.session, {
      action: target === 'published' ? 'publish' : 'update', entity: 'route', entityId: id,
      metadata: { previousStatus: current.status, status: target },
    })
    return 'ok' as const
  })
  if (result === 'not_found') return NextResponse.json({ error: 'Маршрут не найден' }, { status: 404 })
  if (result === 'invalid') return NextResponse.json({ error: 'Недопустимый переход статуса' }, { status: 409 })
  if (result === 'few_stops') return NextResponse.json({ error: 'Для публикации нужны минимум две опубликованные остановки' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
