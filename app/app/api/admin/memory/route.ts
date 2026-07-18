import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { memoryAdminInputSchema } from '@/lib/memory-graph'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const [people, timeline, relations, events, media] = await Promise.all([
    pg`select id,slug,name,aliases,birth_year as "birthYear",death_year as "deathYear",verification_status as "verificationStatus",editorial_status as "editorialStatus" from people order by updated_at desc limit 500`,
    pg`select t.id,t.object_id as "objectId",o.title as "objectTitle",t.entry_type as "entryType",t.date_from as "dateFrom",t.date_to as "dateTo",t.approximate,t.title,t.editorial_status as "editorialStatus" from timeline_entries t join objects o on o.id=t.object_id order by t.updated_at desc limit 500`,
    pg`select op.object_id as "objectId",o.title as "objectTitle",op.person_id as "personId",p.name as "personName",op.relation_type as "relationType",op.public_note as "publicNote" from object_people op join objects o on o.id=op.object_id join people p on p.id=op.person_id order by o.title,p.name limit 1000`,
    pg`select id,slug,title,date_from as "dateFrom",date_to as "dateTo",approximate,editorial_status as "editorialStatus" from historical_events order by updated_at desc limit 500`,
    pg`select m.id,m.object_id as "objectId",o.title as "objectTitle",m.timeline_entry_id as "timelineEntryId",m.alt_text as "altText",m.rights_status as "rightsStatus",m.current_file_url is not null as "hasCurrentPair",m.editorial_status as "editorialStatus" from archive_media m join objects o on o.id=m.object_id order by m.updated_at desc limit 500`,
  ])
  return NextResponse.json({ people, timeline, relations, events, media })
}

export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const parsed = memoryAdminInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  try {
    if (d.kind === 'person') {
      const p = d.person
      const [row] = await pg<{ id: string }[]>`insert into people(slug,name,aliases,birth_year,death_year,short_bio,biography,portrait_url,verification_status,editorial_status) values(${p.slug},${p.name},${JSON.stringify(p.aliases)}::jsonb,${p.birthYear??null},${p.deathYear??null},${p.shortBio??null},${p.biography??null},${p.portraitUrl??null},${p.verificationStatus},'draft') returning id`
      return NextResponse.json(row, { status: 201 })
    }
    if (d.kind === 'timeline') {
      const e = d.entry
      const [row] = await pg<{ id: string }[]>`insert into timeline_entries(object_id,entry_type,date_from,date_to,approximate,title,description,editorial_status) values(${e.objectId},${e.entryType},${e.dateFrom??null},${e.dateTo??null},${e.approximate},${e.title},${e.description??null},'draft') returning id`
      return NextResponse.json(row, { status: 201 })
    }
    if (d.kind === 'event') {
      const ev = d.event
      const [row] = await pg<{ id: string }[]>`insert into historical_events(slug,title,date_from,date_to,approximate,description,geography) values(${ev.slug},${ev.title},${ev.dateFrom??null},${ev.dateTo??null},${ev.approximate},${ev.description??null},${ev.geography??null}) returning id`
      return NextResponse.json(row, { status: 201 })
    }
    if (d.kind === 'archiveMedia') {
      const m = d.media
      if (m.timelineEntryId) {
        const [entry] = await pg<{ id: string }[]>`select id from timeline_entries where id=${m.timelineEntryId} and object_id=${m.objectId}`
        if (!entry) return NextResponse.json({ error: 'Запись хронологии не относится к выбранному объекту' }, { status: 400 })
      }
      const [row] = await pg<{ id: string }[]>`insert into archive_media(object_id,timeline_entry_id,capture_from,capture_to,approximate,file_url,current_file_url,source_id,rights_status,original_author,alt_text) values(${m.objectId},${m.timelineEntryId??null},${m.captureFrom??null},${m.captureTo??null},${m.approximate},${m.fileUrl},${m.currentFileUrl??null},${m.sourceId},${m.rightsStatus},${m.originalAuthor??null},${m.altText}) returning id`
      return NextResponse.json(row, { status: 201 })
    }
    if (d.kind === 'objectEvent') {
      await pg`insert into object_historical_events(object_id,event_id,relation_type) values(${d.objectId},${d.eventId},${d.relationType}) on conflict do nothing`
      return NextResponse.json({ ok: true }, { status: 201 })
    }
    if (d.kind === 'personEvent') {
      await pg`insert into person_historical_events(person_id,event_id,relation_type) values(${d.personId},${d.eventId},${d.relationType}) on conflict do nothing`
      return NextResponse.json({ ok: true }, { status: 201 })
    }
    await pg`insert into object_people(object_id,person_id,relation_type,public_note) values(${d.objectId},${d.personId},${d.relationType},${d.publicNote??null}) on conflict(object_id,person_id,relation_type) do update set public_note=excluded.public_note`
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Не удалось сохранить. Проверьте уникальность slug и выбранные записи.' }, { status: 409 })
  }
}
