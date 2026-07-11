import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { eventInputSchema } from '@/lib/validation'
import type { AdminEventRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  object_id: string
  object_title: string
  title: string
  description: string | null
  starts_on: string
  ends_on: string
}

/** Список мероприятий (ближайшие сверху) */
export async function GET() {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const rows = await pg<Row[]>`
    select e.id, e.object_id, o.title as object_title, e.title, e.description,
           to_char(e.starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(e.ends_on, 'YYYY-MM-DD') as ends_on
    from events e
    join objects o on o.id = e.object_id
    order by e.starts_on desc, e.created_at desc
    limit 500`

  const list: AdminEventRow[] = rows.map((r) => ({
    id: r.id,
    objectId: r.object_id,
    objectTitle: r.object_title,
    title: r.title,
    description: r.description,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
  }))
  return NextResponse.json(list)
}

/** Создание мероприятия */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const parsed = eventInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
      { status: 400 }
    )
  }
  const d = parsed.data

  try {
    const [row] = await pg<{ id: string }[]>`
      insert into events (object_id, title, description, starts_on, ends_on)
      values (${d.objectId}, ${d.title}, ${d.description ?? null}, ${d.startsOn}, ${d.endsOn})
      returning id`
    return NextResponse.json({ id: row?.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Не удалось создать мероприятие (проверьте объект)' }, { status: 400 })
  }
}
