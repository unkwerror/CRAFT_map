import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import type { Photo } from '@/lib/types'
import { csvCell } from '@/lib/csv'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  title: string
  description: string | null
  category_id: string
  district_name: string | null
  address: string | null
  lng: number | null
  lat: number | null
  photos: Photo[]
  published: boolean
  sort_weight: number
}

/** Экспорт всех объектов: ?format=csv | geojson */
export async function GET(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'geojson'

  const rows = await pg<Row[]>`
    select o.id, o.title, o.description, o.category_id, d.name as district_name,
           o.address, st_x(o.geom) as lng, st_y(o.geom) as lat,
           o.photos, o.published, o.sort_weight
    from objects o
    left join districts d on d.id = o.district_id
    order by o.created_at`

  if (format === 'csv') {
    const header = 'id;title;description;category;district;address;lng;lat;published;photos'
    const lines = rows.map((r) =>
      [
        r.id, r.title, r.description, r.category_id, r.district_name,
        r.address, r.lng, r.lat, r.published,
        r.photos.map((p) => p.original).join(' '),
      ].map(csvCell).join(';')
    )
    // BOM — чтобы Excel корректно открыл UTF-8
    return new NextResponse('﻿' + [header, ...lines].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="objects.csv"',
      },
    })
  }

  const fc = {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      // у непроверенных импортированных объектов координаты может ещё не быть
      geometry: r.lng !== null && r.lat !== null
        ? { type: 'Point', coordinates: [r.lng, r.lat] }
        : null,
      properties: {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category_id,
        district: r.district_name,
        address: r.address,
        published: r.published,
        sort_weight: r.sort_weight,
        photos: r.photos,
      },
    })),
  }
  return new NextResponse(JSON.stringify(fc, null, 2), {
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="objects.geojson"',
    },
  })
}
