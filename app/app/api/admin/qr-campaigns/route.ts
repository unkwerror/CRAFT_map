import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { requireRole } from '@/lib/guard'

const inputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  targetType: z.enum(['object', 'event', 'route', 'person']),
  targetId: z.string().uuid(),
  placementType: z.string().trim().max(100).nullish(),
  placementName: z.string().trim().max(300).nullish(),
  printBatch: z.string().trim().max(100).nullish(),
}).strict()

async function targetExists(type: string, id: string): Promise<boolean> {
  if (type === 'object') return (await pg`select 1 from objects where id = ${id}`).length > 0
  if (type === 'event') return (await pg`select 1 from events where id = ${id}`).length > 0
  if (type === 'route') return (await pg`select 1 from routes where id = ${id}`).length > 0
  return (await pg`select 1 from people where id = ${id}`).length > 0
}

export async function GET() {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  if (!isFeatureEnabled('qr_campaigns_enabled')) return NextResponse.json([], { status: 200 })
  const rows = await pg`
    select qc.*, sl.code, sl.target_type, sl.target_id, sl.enabled as link_enabled,
      (select count(*)::int from analytics_events ae where ae.campaign_id = qc.id and ae.event_name = 'qr_open') as scans
    from qr_campaigns qc join short_links sl on sl.id = qc.short_link_id
    order by qc.created_at desc limit 500`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  if (!isFeatureEnabled('qr_campaigns_enabled')) return NextResponse.json({ error: 'Функция выключена' }, { status: 404 })
  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  const d = parsed.data
  if (!(await targetExists(d.targetType, d.targetId))) {
    return NextResponse.json({ error: 'Выбранная цель не найдена' }, { status: 400 })
  }
  const code = randomBytes(9).toString('base64url')
  try {
    const result = await pg.begin(async (sql) => {
      const [link] = await sql<{ id: string }[]>`
        insert into short_links (code, target_type, target_id) values (${code}, ${d.targetType}, ${d.targetId}) returning id`
      if (!link) throw new Error('Short link insert returned no id')
      const [campaign] = await sql<{ id: string }[]>`
        insert into qr_campaigns (short_link_id, name, placement_type, placement_name, print_batch)
        values (${link.id}, ${d.name}, ${d.placementType ?? null}, ${d.placementName ?? null}, ${d.printBatch ?? null}) returning id`
      return { id: campaign!.id, code }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Не удалось создать кампанию' }, { status: 409 })
  }
}
