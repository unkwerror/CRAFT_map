import { NextRequest, NextResponse } from 'next/server'
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

  const rows = await pg<{ id: string }[]>`
    update events
    set object_id = ${d.objectId}, title = ${d.title}, description = ${d.description ?? null},
        starts_on = ${d.startsOn}, ends_on = ${d.endsOn}, updated_at = now()
    where id = ${id}
    returning id`
  if (!rows.length) return notFound()
  return NextResponse.json({ ok: true })
}

/** Удаление мероприятия */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const rows = await pg<{ id: string }[]>`delete from events where id = ${id} returning id`
  if (!rows.length) return notFound()
  return NextResponse.json({ ok: true })
}
