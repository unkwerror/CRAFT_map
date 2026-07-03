import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
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
    const [row] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash: await hash(password, 12), role })
      .returning({ id: users.id })
    return NextResponse.json({ id: row?.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
  }
}
