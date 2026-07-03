import { NextResponse } from 'next/server'
import { pg } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Row {
  id: number
  name: string
  geometry: GeoJSON.MultiPolygon
}

/** Полигоны округов (GeoJSON FeatureCollection) */
export async function GET() {
  const rows = await pg<Row[]>`
    select id, name, st_asgeojson(geom)::json as geometry
    from districts
    order by name`

  return NextResponse.json({
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: { id: r.id, name: r.name },
    })),
  })
}
