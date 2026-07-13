import { NextRequest } from 'next/server'
import { pg } from '@/lib/db'
import { publicJsonResponse } from '@/lib/http-cache'

export const dynamic = 'force-dynamic'

interface Row {
  id: number
  name: string
  geometry: GeoJSON.MultiPolygon
}

/** Полигоны округов (GeoJSON FeatureCollection) */
export async function GET(req: NextRequest) {
  const rows = await pg<Row[]>`
    select id, name, st_asgeojson(geom)::json as geometry
    from districts
    order by name`

  return publicJsonResponse(
    req,
    {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: { id: r.id, name: r.name },
      })),
    },
    { maxAge: 3600, staleWhileRevalidate: 86400 }
  )
}
