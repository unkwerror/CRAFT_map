import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { appendAdminAudit } from '@/lib/audit'
import { db, pg } from '@/lib/db'
import { users } from '@/lib/schema'
import { requireRole } from '@/lib/guard'
import { userInputSchema } from '@/lib/validation'
import type { UserRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Список пользователей — только admin */
export async function GET() {
  const guard = await requireRole('admin')
  if (guard.error) return guard.error

  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .orderBy(users.email)
  return NextResponse.json(rows as UserRow[])
}

/** Создание пользователя — только admin */
export async function POST(req: NextRequest) {
  const guard = await requireRole('admin')
  if (guard.error) return guard.error

  const parsed = userInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { email, password, role } = parsed.data

  try {
    const passwordHash = await hash(password, 12)
    const row = await pg.begin(async (sql) => {
      const [created] = await sql<{ id: string }[]>`
        insert into users (email, password_hash, role)
        values (${email.toLowerCase()}, ${passwordHash}, ${role})
        returning id`
      if (!created) throw new Error('User insert returned no id')
      await appendAdminAudit(sql, guard.session, {
        action: 'create',
        entity: 'user',
        entityId: created.id,
        metadata: { role },
      })
      return created
    })
    return NextResponse.json({ id: row.id }, { status: 201 })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 409 }
      )
    }
    console.error('POST /api/admin/users failed:', error)
    return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
  }
}
