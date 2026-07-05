import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import type { GeocodeStatus, ImportReviewRow, Photo } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Объекты импорта с доски КРАФТ для ручной проверки координат.
 * Сортировка по срочности: failed → pending → medium → high (→ verified при ?all=1).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const includeVerified = req.nextUrl.searchParams.get('all') === '1'

  const rows = await pg<{
    id: string
    source_id: number
    title: string
    description: string | null
    category_id: string
    address: string | null
    import_district: string | null
    district_name: string | null
    lng: number | null
    lat: number | null
    geocode_status: GeocodeStatus
    geocode_query: string | null
    geocode_note: string | null
    import_flags: string[]
    photos: Photo[]
    published: boolean
    nearby: ImportReviewRow['nearby']
  }[]>`
    select o.id, o.source_id, o.title, o.description, o.category_id, o.address,
           o.import_district, d.name as district_name,
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           o.geocode_status, o.geocode_query, o.geocode_note, o.import_flags,
           o.photos, o.published,
           coalesce(nb.nearby, '[]'::jsonb) as nearby
    from objects o
    left join districts d on d.id = o.district_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'sourceId', b.source_id, 'title', b.title,
               'dist', round(st_distance(o.geom::geography, b.geom::geography))
             ) order by o.geom::geography <-> b.geom::geography) as nearby
      from objects b
      where b.id <> o.id and o.geom is not null and b.geom is not null
        and st_dwithin(o.geom::geography, b.geom::geography, 100)
    ) nb on true
    where o.source_id is not null
      and (${includeVerified} or o.geocode_status <> 'verified')
    order by array_position(
               array['failed', 'pending', 'medium', 'high', 'verified'], o.geocode_status),
             o.source_id`

  const dto: ImportReviewRow[] = rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    title: r.title,
    description: r.description,
    categoryId: r.category_id,
    address: r.address,
    importDistrict: r.import_district,
    districtName: r.district_name,
    lng: r.lng,
    lat: r.lat,
    geocodeStatus: r.geocode_status,
    geocodeQuery: r.geocode_query,
    geocodeNote: r.geocode_note,
    importFlags: r.import_flags,
    photos: r.photos,
    published: r.published,
    nearby: r.nearby,
  }))
  return NextResponse.json(dto)
}
