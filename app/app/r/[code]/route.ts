import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { absoluteSiteUrl } from '@/lib/seo'
import { shortLinkCodeSchema, shortLinkTargetPath } from '@/lib/short-links'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ code: string }> }

async function resolveSlug(targetType: string, targetId: string): Promise<string | null> {
  if (targetType === 'route') {
    const [row] = await pg<{ slug: string }[]>`select slug from routes where id = ${targetId}`
    return row?.slug ?? null
  }
  if (targetType === 'person') {
    const [row] = await pg<{ slug: string }[]>`select slug from people where id = ${targetId}`
    return row?.slug ?? null
  }
  return null
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!isFeatureEnabled('qr_campaigns_enabled')) {
    return NextResponse.json({ error: 'Короткие ссылки пока недоступны' }, { status: 404 })
  }
  const { code } = await params
  if (!shortLinkCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 })
  }
  const [row] = await pg<{ id: string; target_type: string; target_id: string }[]>`
    select id, target_type, target_id from short_links
    where code = ${code} and enabled and (expires_at is null or expires_at > now()) limit 1`
  if (!row) return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 })
  const slug = await resolveSlug(row.target_type, row.target_id)
  const path = shortLinkTargetPath(row.target_type, row.target_id, slug)
  if (!path) return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 })

  // Обезличенный qr_open: случайный per-scan идентификатор, без IP и геолокации.
  // Сбой аналитики не должен мешать переходу.
  try {
    const [campaign] = await pg<{ id: string }[]>`
      select id from qr_campaigns where short_link_id = ${row.id} and enabled
        and (active_from is null or active_from <= current_date)
        and (active_until is null or active_until >= current_date) limit 1`
    await pg`
      insert into analytics_events (event_name, schema_version, occurred_at, session_id, entity_type, entity_id, campaign_id, referrer_category)
      values ('qr_open', 1, now(), ${randomBytes(12).toString('base64url')}, ${row.target_type}, ${row.target_id}, ${campaign?.id ?? null}, 'qr')`
  } catch (error) {
    console.error('qr_open analytics failed', error)
  }
  // За прокси req.nextUrl.origin — внутренний 0.0.0.0:3000; публичный origin берём из seo-хелпера.
  return NextResponse.redirect(absoluteSiteUrl(path), 307)
}
