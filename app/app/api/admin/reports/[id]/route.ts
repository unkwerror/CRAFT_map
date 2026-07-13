import { NextRequest, NextResponse } from 'next/server'
import { appendAdminAudit, type AuditAction } from '@/lib/audit'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { reportStatusPatchSchema, uuidSchema } from '@/lib/validation'
import type { ReportStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const actionForStatus: Record<ReportStatus, AuditAction> = {
  new: 'reopen',
  resolved: 'resolve',
  rejected: 'reject',
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 })
  }
  const parsed = reportStatusPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректный статус' }, { status: 400 })
  }
  const nextStatus = parsed.data.status

  const row = await pg.begin(async (sql) => {
    const [current] = await sql<{ status: ReportStatus }[]>`
      select status from content_reports where id = ${id} for update`
    if (!current) return null

    const [updated] = await sql<{ id: string }[]>`
      update content_reports
      set status = ${nextStatus},
          resolved_by = case
            when ${nextStatus} = 'new' then null
            else ${guard.session.user.id}::uuid
          end,
          resolved_at = case
            when ${nextStatus} = 'new' then null
            else now()
          end,
          updated_at = now()
      where id = ${id}
      returning id`
    if (!updated) return null

    await appendAdminAudit(sql, guard.session, {
      action: actionForStatus[nextStatus],
      entity: 'report',
      entityId: updated.id,
      metadata: { previousStatus: current.status, status: nextStatus },
    })
    return updated
  })

  if (!row) {
    return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 })
  }
  return NextResponse.json(
    { ok: true, status: nextStatus },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
