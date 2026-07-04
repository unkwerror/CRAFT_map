import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { uuidSchema } from '@/lib/validation'
import type { ObjectFull, Photo } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
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
}

/** Полная карточка опубликованного объекта */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })
  }

  const rows = await pg<Row[]>`
    select o.id, o.title, o.description, o.category_id,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           o.photos, o.model_url, o.published
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id} and o.published
    limit 1`

  const r = rows[0]
  if (!r) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

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
