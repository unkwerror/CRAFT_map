import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit } from '@/lib/audit'
import { audioTextHash, legacyAudioStatus } from '@/lib/audio-variants'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { objectInputSchema, publishedPatchSchema, uuidSchema } from '@/lib/validation'
import type { DescriptionSection, ObjectFull, Photo, Video } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

/** Объект для формы редактирования (в любом статусе публикации) */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const rows = await pg<{
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
    videos: Video[]
    audio_url: string | null
    audio_text: string | null
    rating: string | null
    sections: DescriptionSection[]
    model_url: string | null
    published: boolean
    sort_weight: number
    alternative_names: string[]
    object_type: string | null
    creation_period: string | null
    protection_status: string | null
    materials: string[]
    access_info: string | null
    media_rights_status: string | null
    verification_status: 'unverified' | 'needs_review' | 'verified'
  }[]>`
    select o.id, o.title, o.description, o.category_id,
           c.title as category_title, c.color as category_color,
           d.name as district_name, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat, o.photos, o.videos,
           o.audio_url, o.audio_text, o.rating, o.sections, o.model_url, o.published,
           o.sort_weight, o.alternative_names, o.object_type, o.creation_period,
           o.protection_status, o.materials, o.access_info, o.media_rights_status,
           o.verification_status
    from objects o
    join categories c on c.id = o.category_id
    left join districts d on d.id = o.district_id
    where o.id = ${id}
    limit 1`

  const r = rows[0]
  if (!r) return notFound()

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
    videos: r.videos,
    audioUrl: r.audio_url,
    audioText: r.audio_text,
    rating: r.rating === null ? null : Number(r.rating),
    sections: r.sections,
    modelUrl: r.model_url,
    published: r.published,
    sortWeight: r.sort_weight,
    events: [],
    alternativeNames: r.alternative_names,
    objectType: r.object_type,
    creationPeriod: r.creation_period,
    protectionStatus: r.protection_status,
    materials: r.materials,
    accessInfo: r.access_info,
    mediaRightsStatus: r.media_rights_status,
    verificationStatus: r.verification_status,
  }
  return NextResponse.json(dto)
}

/** Полное обновление объекта */
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const parsed = objectInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const d = parsed.data

  const row = await pg.begin(async (sql) => {
    const [updated] = await sql<{ id: string }[]>`
      update objects
      set title = ${d.title}, description = ${d.description ?? null},
          category_id = ${d.categoryId}, address = ${d.address ?? null},
          geom = st_setsrid(st_makepoint(${d.lng}, ${d.lat}), 4326),
          photos = ${JSON.stringify(d.photos)}::jsonb,
          videos = ${JSON.stringify(d.videos)}::jsonb,
          audio_url = ${d.audioUrl ?? null}, audio_text = ${d.audioText ?? null},
          rating = ${d.rating ?? null},
          sections = ${JSON.stringify(d.sections)}::jsonb,
          model_url = ${d.modelUrl ?? null},
          published = ${d.published}, sort_weight = ${d.sortWeight},
          alternative_names = ${JSON.stringify(d.alternativeNames)}::jsonb,
          object_type = ${d.objectType ?? null}, creation_period = ${d.creationPeriod ?? null},
          protection_status = ${d.protectionStatus ?? null},
          materials = ${JSON.stringify(d.materials)}::jsonb,
          access_info = ${d.accessInfo ?? null}, media_rights_status = ${d.mediaRightsStatus ?? null},
          verification_status = ${d.verificationStatus}
      where id = ${id}
      returning id`
    if (!updated) return null
    await sql`
      insert into audio_variants (
        object_id, variant, locale, script_text, status, audio_url, text_hash, manual_upload
      ) values (
        ${updated.id}, 'full', 'ru', ${d.audioText ?? null},
        ${legacyAudioStatus(d.audioUrl, d.audioText ?? null)}, ${d.audioUrl ?? null},
        ${audioTextHash(d.audioText)}, ${Boolean(d.audioUrl)}
      )
      on conflict (object_id, variant, locale) do update set
        script_text = excluded.script_text,
        status = case
          when audio_variants.text_hash is distinct from excluded.text_hash
               and audio_variants.audio_url is not null then 'stale'
          else excluded.status
        end,
        audio_url = excluded.audio_url,
        text_hash = excluded.text_hash,
        manual_upload = excluded.manual_upload,
        version = case when audio_variants.text_hash is distinct from excluded.text_hash
                       then audio_variants.version + 1 else audio_variants.version end,
        updated_at = now()`
    await sql`
      insert into content_versions (entity_type, entity_id, version, payload, author_id, reason)
      select 'object', ${updated.id}, coalesce(max(version), 0) + 1,
             ${JSON.stringify(d)}::jsonb, ${guard.session.user.id}, 'Обновление карточки'
      from content_versions where entity_type = 'object' and entity_id = ${updated.id}`
    await appendAdminAudit(sql, guard.session, {
      action: 'update',
      entity: 'object',
      entityId: updated.id,
      metadata: { published: d.published },
    })
    return updated
  })
  if (!row) return notFound()
  return NextResponse.json({ ok: true })
}

/** Быстрое скрытие/показ (published) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const parsed = publishedPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })

  const row = await pg.begin(async (sql) => {
    const [updated] = await sql<{ id: string }[]>`
      update objects set published = ${parsed.data.published} where id = ${id} returning id`
    if (!updated) return null
    await appendAdminAudit(sql, guard.session, {
      action: parsed.data.published ? 'publish' : 'unpublish',
      entity: 'object',
      entityId: updated.id,
      metadata: { published: parsed.data.published },
    })
    return updated
  })
  if (!row) return notFound()
  return NextResponse.json({ ok: true })
}

/** Физическое удаление — только admin */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole('admin')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  const row = await pg.begin(async (sql) => {
    const [deleted] = await sql<{ id: string }[]>`
      delete from objects where id = ${id} returning id`
    if (!deleted) return null
    await appendAdminAudit(sql, guard.session, {
      action: 'delete',
      entity: 'object',
      entityId: deleted.id,
    })
    return deleted
  })
  if (!row) return notFound()
  return NextResponse.json({ ok: true })
}
