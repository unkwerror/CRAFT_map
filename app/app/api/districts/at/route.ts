import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { districtLookupQuerySchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

interface DistrictRow {
  id: number
  name: string
}

/** Округ в точке. Использует тот же ST_Contains, что и триггер objects_set_district. */
export async function GET(req: NextRequest) {
  const parsed = districtLookupQuerySchema.safeParse({
    lng: req.nextUrl.searchParams.get('lng'),
    lat: req.nextUrl.searchParams.get('lat'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные координаты' }, { status: 400 })
  }

  const { lng, lat } = parsed.data
  const [district] = await pg<DistrictRow[]>`
    select id, name
    from districts
    where st_contains(geom, st_setsrid(st_makepoint(${lng}, ${lat}), 4326))
    limit 1`

  return NextResponse.json({ district: district ?? null })
}
