import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Удаление пользователя — только admin, себя удалить нельзя */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole('admin')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }
  if (id === guard.session.user.id) {
    return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
  }

  const row = await pg.begin(async (sql) => {
    const [deleted] = await sql<{ id: string }[]>`
      delete from users where id = ${id} returning id`
    if (!deleted) return null
    await appendAdminAudit(sql, guard.session, {
      action: 'delete',
      entity: 'user',
      entityId: deleted.id,
    })
    return deleted
  })
  if (!row) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
