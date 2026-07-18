import { NextRequest } from 'next/server'
import { pg } from '@/lib/db'
import { publicJsonResponse } from '@/lib/http-cache'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  title: string
  category: string
  district: number | null
  address: string | null
  thumb: string
  lng: number
  lat: number
  has_event: boolean
  has_audio: boolean
  has_video: boolean
  has_3d: boolean
  object_type: string | null
  creation_period: string | null
}

/** GeoJSON FeatureCollection опубликованных объектов (лёгкие поля для карты) */
export async function GET(req: NextRequest) {
  // «сегодня» — по тюменскому времени, независимо от TZ сервера
  const rows = await pg<Row[]>`
    select o.id, o.title, o.category_id as category, o.district_id as district,
           o.address,
           coalesce(o.photos -> 0 ->> 'thumb', '') as thumb,
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           (o.audio_url is not null or o.audio_text is not null) as has_audio,
           jsonb_array_length(o.videos) > 0 as has_video,
           o.model_url is not null as has_3d,
           o.object_type, o.creation_period,
           exists (
             select 1 from events e
             where e.object_id = o.id
               and e.published
               and e.status <> 'cancelled'
               and (now() at time zone 'Asia/Yekaterinburg')::date between e.starts_on and e.ends_on
           ) as has_event
    from objects o
    where o.published
    order by o.sort_weight desc, o.created_at`

  return publicJsonResponse(
    req,
    {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          title: r.title,
          category: r.category,
          district: r.district,
          address: r.address,
          thumb: r.thumb,
          hasEvent: r.has_event,
          hasAudio: r.has_audio,
          hasVideo: r.has_video,
          has3d: r.has_3d,
          objectType: r.object_type,
          creationPeriod: r.creation_period,
        },
      })),
    },
    { maxAge: 30, staleWhileRevalidate: 300 }
  )
}
