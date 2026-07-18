import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { EDITORIAL_STATUSES, canTransitionEditorialStatus, type EditorialStatus } from '@/lib/editorial-workflow'
import { requireRole } from '@/lib/guard'
import { uuidSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }
const inputSchema = z.object({ status: z.enum(EDITORIAL_STATUSES), comment: z.string().trim().max(2000).nullish() }).strict()

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })

  const result = await pg.begin(async (sql) => {
    const [current] = await sql<{ editorial_status: EditorialStatus }[]>`
      select editorial_status from objects where id = ${id} for update`
    if (!current) return 'not_found' as const
    if (!canTransitionEditorialStatus(current.editorial_status, parsed.data.status)) return 'invalid' as const
    const publicVisible = parsed.data.status === 'published'
    await sql`update objects set editorial_status = ${parsed.data.status}, published = ${publicVisible} where id = ${id}`
    await sql`
      insert into editorial_tasks (entity_type, entity_id, status, assignee_id, comments)
      values ('object', ${id}, ${parsed.data.status}, ${guard.session.user.id}, ${parsed.data.comment ?? null})`
    await appendAdminAudit(sql, guard.session, {
      action: publicVisible ? 'publish' : 'update', entity: 'object', entityId: id,
      metadata: { previousStatus: current.editorial_status, status: parsed.data.status, published: publicVisible },
    })
    return 'ok' as const
  })
  if (result === 'not_found') return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  if (result === 'invalid') return NextResponse.json({ error: 'Недопустимый переход статуса' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
