import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
const inputSchema = z.object({ enabled: z.boolean() }).strict()

// Выключение кампании гасит и short link: потерянная/повреждённая табличка перестаёт вести на сайт.
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: 'Кампания не найдена' }, { status: 404 })
  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  const found = await pg.begin(async (sql) => {
    const [campaign] = await sql<{ short_link_id: string }[]>`
      update qr_campaigns set enabled = ${parsed.data.enabled}, updated_at = now() where id = ${id} returning short_link_id`
    if (!campaign) return false
    await sql`update short_links set enabled = ${parsed.data.enabled}, updated_at = now() where id = ${campaign.short_link_id}`
    return true
  })
  if (!found) return NextResponse.json({ error: 'Кампания не найдена' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
