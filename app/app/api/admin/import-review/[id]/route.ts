import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { importReviewPatchSchema, uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * Проверка импорта: { lng, lat } — установить/поправить координату,
 * { verify: true } — подтвердить (geocode_status = verified, published = true).
 * Можно одним запросом: координата применяется до подтверждения.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  }

  const parsed = importReviewPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }
  const { lng, lat, verify } = parsed.data

  if (lng !== undefined && lat !== undefined) {
    const rows = await pg<{ id: string }[]>`
      update objects
      set geom = st_setsrid(st_makepoint(${lng}, ${lat}), 4326)
      where id = ${id} and source_id is not null
      returning id`
    if (!rows.length) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  }

  if (verify) {
    const rows = await pg<{ id: string }[]>`
      update objects
      set geocode_status = 'verified', published = true
      where id = ${id} and source_id is not null and geom is not null
      returning id`
    if (!rows.length) {
      return NextResponse.json(
        { error: 'Нельзя подтвердить объект без координаты' },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
