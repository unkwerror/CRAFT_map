import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'

const sourceSchema = z.object({
  type: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(300).nullish(),
  publisher: z.string().trim().max(300).nullish(),
  publicationYear: z.number().int().min(1).max(3000).nullish(),
  url: z.string().url().max(2000).refine((v) => ['http:', 'https:'].includes(new URL(v).protocol)).nullish(),
  archiveCode: z.string().trim().max(300).nullish(),
  accessDate: z.string().date().nullish(),
  verificationStatus: z.enum(['unverified', 'needs_review', 'verified', 'rejected']).default('unverified'),
  objectId: z.string().uuid().optional(),
  statement: z.string().trim().max(2000).nullish(),
}).strict()

export async function GET(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const objectId = req.nextUrl.searchParams.get('objectId')
  const rows = objectId
    ? await pg`select s.*, es.statement from content_sources s join entity_sources es on es.source_id = s.id where es.entity_type = 'object' and es.entity_id = ${objectId} order by s.created_at desc limit 200`
    : await pg`select * from content_sources order by created_at desc limit 200`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const parsed = sourceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const row = await pg.begin(async (sql) => {
    const [created] = await sql<{ id: string }[]>`
      insert into content_sources (type, title, author, publisher, publication_year, url,
        archive_code, access_date, verification_status)
      values (${d.type}, ${d.title}, ${d.author ?? null}, ${d.publisher ?? null},
        ${d.publicationYear ?? null}, ${d.url ?? null}, ${d.archiveCode ?? null},
        ${d.accessDate ?? null}, ${d.verificationStatus}) returning id`
    if (!created) throw new Error('Source insert returned no id')
    if (d.objectId) await sql`
      insert into entity_sources (entity_type, entity_id, source_id, statement)
      values ('object', ${d.objectId}, ${created.id}, ${d.statement ?? null})`
    return created
  })
  return NextResponse.json(row, { status: 201 })
}
