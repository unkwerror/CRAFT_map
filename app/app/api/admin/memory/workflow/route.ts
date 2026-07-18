import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { canTransitionEditorialStatus, type EditorialStatus } from '@/lib/editorial-workflow'
import { requireRole } from '@/lib/guard'
import { memoryWorkflowInputSchema, type MemoryWorkflowEntity } from '@/lib/memory-graph'

export const dynamic = 'force-dynamic'

const TABLES: Record<MemoryWorkflowEntity, string> = {
  person: 'people',
  historical_event: 'historical_events',
  timeline_entry: 'timeline_entries',
  archive_media: 'archive_media',
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const parsed = memoryWorkflowInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  const { entity, id, status, comment } = parsed.data

  try {
    const result = await pg.begin(async (sql) => {
      const [current] = await sql<{ editorial_status: EditorialStatus }[]>`
        select editorial_status from ${sql(TABLES[entity])} where id = ${id} for update`
      if (!current) return 'not_found' as const
      if (!canTransitionEditorialStatus(current.editorial_status, status)) return 'invalid' as const
      await sql`update ${sql(TABLES[entity])} set editorial_status = ${status}, updated_at = now() where id = ${id}`
      await sql`
        insert into editorial_tasks (entity_type, entity_id, status, assignee_id, comments)
        values (${entity}, ${id}, ${status}, ${guard.session.user.id}, ${comment ?? null})`
      await appendAdminAudit(sql, guard.session, {
        action: status === 'published' ? 'publish' : 'update', entity, entityId: id,
        metadata: { previousStatus: current.editorial_status, status },
      })
      return 'ok' as const
    })
    if (result === 'not_found') return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    if (result === 'invalid') return NextResponse.json({ error: 'Недопустимый переход статуса' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // 23514 — check violation: у архивного фото нет источника/прав/alt для публикации.
    if ((error as { code?: string }).code === '23514') {
      return NextResponse.json({ error: 'Нельзя опубликовать архивное фото без источника, статуса прав и alt-текста' }, { status: 409 })
    }
    throw error
  }
}
