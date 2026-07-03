import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { objectInputSchema, publishedPatchSchema, uuidSchema } from '@/lib/validation'
import type { ObjectFull, Photo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

/** Объект для формы редактирования (в любом статусе публикации) */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const rows = await pg<{
    id: string
    title: string
    description: string | null
    category_id: string
    category_title: string
    category_color: string
    district_name: string | null
    address: string | null
    lng: number
    lat: number
    photos: Photo[]
    model_url: string | null
    published: boolean
  }[]>`
    select o.id, o.title, o.description, o.category_id,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat, o.photos, o.model_url, o.published
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id}
    limit 1`

  const r = rows[0]
  if (!r) return notFound()

  const dto: ObjectFull = {
    id: r.id,
    title: r.title,
    description: r.description,
    categoryId: r.category_id,
    categoryTitle: r.category_title,
    categoryColor: r.category_color,
    districtName: r.district_name,
    address: r.address,
    lng: r.lng,
    lat: r.lat,
    photos: r.photos,
    modelUrl: r.model_url,
    published: r.published,
  }
  return NextResponse.json(dto)
}

/** Полное обновление объекта */
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const parsed = objectInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const d = parsed.data

  const rows = await pg<{ id: string }[]>`
    update objects
    set title = ${d.title}, description = ${d.description ?? null},
        category_id = ${d.categoryId}, address = ${d.address ?? null},
        geom = st_setsrid(st_makepoint(${d.lng}, ${d.lat}), 4326),
        photos = ${JSON.stringify(d.photos)}::jsonb, model_url = ${d.modelUrl ?? null},
        published = ${d.published}, sort_weight = ${d.sortWeight}
    where id = ${id}
    returning id`
  if (!rows.length) return notFound()
  return NextResponse.json({ ok: true })
}

/** Быстрое скрытие/показ (published) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const parsed = publishedPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })

  const rows = await pg<{ id: string }[]>`
    update objects set published = ${parsed.data.published} where id = ${id} returning id`
  if (!rows.length) return notFound()
  return NextResponse.json({ ok: true })
}

/** Физическое удаление — только admin */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('admin')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const rows = await pg<{ id: string }[]>`delete from objects where id = ${id} returning id`
  if (!rows.length) return notFound()
  return NextResponse.json({ ok: true })
}
