import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { reportStatusSchema } from '@/lib/validation'
import type { ContentReportRow, ReportStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  object_id: string | null
  object_title: string
  message: string
  contact: string | null
  status: ReportStatus
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

export async function GET(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const requestedStatus = req.nextUrl.searchParams.get('status')
  const parsedStatus = requestedStatus ? reportStatusSchema.safeParse(requestedStatus) : null
  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json({ error: 'Некорректный статус' }, { status: 400 })
  }
  const status = parsedStatus?.data

  const rows = await pg<Row[]>`
    select r.id, r.object_id, coalesce(o.title, r.object_title) as object_title,
           r.message, r.contact, r.status, r.resolved_at, r.created_at, r.updated_at
    from content_reports r
    left join objects o on o.id = r.object_id
    ${status ? pg`where r.status = ${status}` : pg``}
    order by
      case when r.status = 'new' then 0 else 1 end,
      r.created_at desc
    limit 500`

  const result: ContentReportRow[] = rows.map((row) => ({
    id: row.id,
    objectId: row.object_id,
    objectTitle: row.object_title,
    message: row.message,
    contact: row.contact,
    status: row.status,
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }))
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
