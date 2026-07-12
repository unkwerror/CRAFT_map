import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from './db'
import { users } from './schema'

type GuardResult = { session: Session; error?: never } | { session?: never; error: NextResponse }

/** Проверка авторизации для admin-API. role='admin' — только администратор. */
export async function requireRole(role: 'admin' | 'editor' = 'editor'): Promise<GuardResult> {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
  }
  const [currentUser] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  if (!currentUser) {
    return { error: NextResponse.json({ error: 'Сессия отозвана' }, { status: 401 }) }
  }
  const currentRole = currentUser.role === 'admin' ? 'admin' : 'editor'
  if (role === 'admin' && currentRole !== 'admin') {
    return { error: NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 }) }
  }
  session.user.email = currentUser.email
  session.user.role = currentRole
  return { session }
}
