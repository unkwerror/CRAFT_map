import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { objectInputSchema } from '@/lib/validation'
import type { AdminObjectRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SORTS: Record<string, string> = {
  title: 'o.title',
  updated_at: 'o.updated_at',
  created_at: 'o.created_at',
  sort_weight: 'o.sort_weight',
}

interface Row {
  id: string
  title: string
  category_id: string
  district_name: string | null
  address: string | null
  published: boolean
  sort_weight: number
  photo_count: number
  updated_at: string
}

/** Список объектов для админки: поиск, фильтры, сортировка */
export async function GET(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() ?? ''
  const category = sp.get('category') ?? ''
  const district = Number(sp.get('district')) || 0
  const published = sp.get('published') ?? '' // '' | 'true' | 'false'
  const sortCol = SORTS[sp.get('sort') ?? ''] ?? 'o.updated_at'
  const dir = sp.get('dir') === 'asc' ? pg`asc` : pg`desc`

  const rows = await pg<Row[]>`
    select o.id, o.title, o.category_id, d.name as district_name, o.address,
           o.published, o.sort_weight,
           jsonb_array_length(o.photos) as photo_count, o.updated_at
    from objects o
    left join districts d on d.id = o.district_id
    where true
      ${q ? pg`and o.title ilike ${'%' + q + '%'}` : pg``}
      ${category ? pg`and o.category_id = ${category}` : pg``}
      ${district ? pg`and o.district_id = ${district}` : pg``}
      ${published ? pg`and o.published = ${published === 'true'}` : pg``}
    order by ${pg.unsafe(sortCol)} ${dir}
    limit 500`

  const list: AdminObjectRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    districtName: r.district_name,
    address: r.address,
    published: r.published,
    sortWeight: r.sort_weight,
    photoCount: Number(r.photo_count),
    updatedAt: r.updated_at,
  }))
  return NextResponse.json(list)
}

/** Создание объекта */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const parsed = objectInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const d = parsed.data

  try {
    const [row] = await pg<{ id: string }[]>`
      insert into objects (title, description, category_id, address, geom, photos, published, sort_weight)
      values (${d.title}, ${d.description ?? null}, ${d.categoryId}, ${d.address ?? null},
              st_setsrid(st_makepoint(${d.lng}, ${d.lat}), 4326),
              ${pg.json(d.photos)}, ${d.published}, ${d.sortWeight})
      returning id`
    return NextResponse.json({ id: row?.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Не удалось создать объект (проверьте категорию)' }, { status: 400 })
  }
}
