import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from './auth'

type GuardResult = { session: Session; error?: never } | { session?: never; error: NextResponse }

/** Проверка авторизации для admin-API. role='admin' — только администратор. */
export async function requireRole(role: 'admin' | 'editor' = 'editor'): Promise<GuardResult> {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
  }
  if (role === 'admin' && session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 }) }
  }
  return { session }
}
