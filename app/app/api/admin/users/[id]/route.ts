import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
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

  const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id })
  if (!rows.length) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
