import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { audioTextHash, legacyAudioStatus } from '@/lib/audio-variants'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { objectInputSchema } from '@/lib/validation'
import { calculateReadiness } from '@/lib/readiness'
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
  lng: number | null
  lat: number | null
  published: boolean
  sort_weight: number
  photo_count: number
  updated_at: string
  photos: { alt?: string }[]
  source_count: number
  media_rights_status: string | null
  audio_status: string | null
  accessibility_attributes: Record<string, unknown>
  has_short_variant: boolean
  verification_status: string
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
           st_x(o.geom) as lng, st_y(o.geom) as lat,
           o.published, o.sort_weight,
           jsonb_array_length(o.photos) as photo_count, o.updated_at, o.photos,
           (select count(*)::int from entity_sources es
             where es.entity_type = 'object' and es.entity_id = o.id) as source_count,
           o.media_rights_status,
           (select av.status from audio_variants av
             where av.object_id = o.id and av.variant = 'full' and av.locale = 'ru') as audio_status,
           o.accessibility_attributes,
           exists (select 1 from audio_variants av
             where av.object_id = o.id and av.variant = 'short' and av.locale = 'ru'
               and av.status = 'ready') as has_short_variant,
           o.verification_status
    from objects o
    left join districts d on d.id = o.district_id
    where true
      ${q ? pg`and o.title ilike ${'%' + q + '%'}` : pg``}
      ${category ? pg`and o.category_id = ${category}` : pg``}
      ${district ? pg`and o.district_id = ${district}` : pg``}
      ${published ? pg`and o.published = ${published === 'true'}` : pg``}
    order by ${pg.unsafe(sortCol)} ${dir}
    limit 500`

  const list: AdminObjectRow[] = rows.map((r) => {
    const readiness = calculateReadiness({
      hasCoordinates: r.lng !== null && r.lat !== null,
      address: r.address,
      photos: r.photos,
      sourceCount: Number(r.source_count),
      mediaRightsStatus: r.media_rights_status,
      audioStatus: r.audio_status,
      accessibilityAttributes: r.accessibility_attributes ?? {},
      hasShortVariant: r.has_short_variant,
      verificationStatus: r.verification_status,
    })
    return ({
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    districtName: r.district_name,
    address: r.address,
    lng: r.lng,
    lat: r.lat,
    published: r.published,
    sortWeight: r.sort_weight,
    photoCount: Number(r.photo_count),
    updatedAt: r.updated_at,
    readinessScore: readiness.score,
    readinessMissing: readiness.missing,
  })})
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
    const row = await pg.begin(async (sql) => {
      const [created] = await sql<{ id: string }[]>`
        insert into objects (title, description, category_id, address, geom, photos, videos,
                             audio_url, audio_text, rating, sections, model_url, published, sort_weight,
                             alternative_names, object_type, creation_period, protection_status,
                             materials, access_info, media_rights_status, verification_status)
        values (${d.title}, ${d.description ?? null}, ${d.categoryId}, ${d.address ?? null},
                st_setsrid(st_makepoint(${d.lng}, ${d.lat}), 4326),
                ${JSON.stringify(d.photos)}::jsonb, ${JSON.stringify(d.videos)}::jsonb,
                ${d.audioUrl ?? null}, ${d.audioText ?? null}, ${d.rating ?? null},
                ${JSON.stringify(d.sections)}::jsonb,
                ${d.modelUrl ?? null}, ${d.published}, ${d.sortWeight},
                ${JSON.stringify(d.alternativeNames)}::jsonb, ${d.objectType ?? null},
                ${d.creationPeriod ?? null}, ${d.protectionStatus ?? null},
                ${JSON.stringify(d.materials)}::jsonb, ${d.accessInfo ?? null},
                ${d.mediaRightsStatus ?? null}, ${d.verificationStatus})
        returning id`
      if (!created) throw new Error('Object insert returned no id')
      await sql`
        insert into audio_variants (
          object_id, variant, locale, script_text, status, audio_url, text_hash, manual_upload
        ) values (
          ${created.id}, 'full', 'ru', ${d.audioText ?? null},
          ${legacyAudioStatus(d.audioUrl, d.audioText ?? null)}, ${d.audioUrl ?? null},
          ${audioTextHash(d.audioText)}, ${Boolean(d.audioUrl)}
        )`
      await sql`
        insert into content_versions (entity_type, entity_id, version, payload, author_id, reason)
        values ('object', ${created.id}, 1, ${JSON.stringify(d)}::jsonb,
                ${guard.session.user.id}, 'Создание карточки')`
      await appendAdminAudit(sql, guard.session, {
        action: 'create',
        entity: 'object',
        entityId: created.id,
        metadata: { published: d.published },
      })
      return created
    })
    return NextResponse.json({ id: row.id }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/objects:', e)
    return NextResponse.json({ error: 'Не удалось создать объект (проверьте категорию)' }, { status: 400 })
  }
}
