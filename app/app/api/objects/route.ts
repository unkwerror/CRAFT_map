import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  title: string
  category: string
  district: number | null
  thumb: string
  lng: number
  lat: number
}

/** GeoJSON FeatureCollection опубликованных объектов (лёгкие поля для карты) */
export async function GET() {
  const rows = await pg<Row[]>`
    select o.id, o.title, o.category_id as category, o.district_id as district,
           coalesce(o.photos -> 0 ->> 'thumb', '') as thumb,
           st_x(o.geom) as lng, st_y(o.geom) as lat
    from objects o
    where o.published
    order by o.sort_weight desc, o.created_at`

  return NextResponse.json({
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        title: r.title,
        category: r.category,
        district: r.district,
        thumb: r.thumb,
      },
    })),
  })
}
