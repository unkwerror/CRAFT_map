import { NextRequest, NextResponse } from 'next/server'
import { analyticsEventSchema, clampOccurredAt } from '@/lib/analytics'
import { pg } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const length = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(length) && length > 4096) {
    return NextResponse.json({ error: { code: 'payload_too_large', message: 'Слишком большой запрос' } }, { status: 413 })
  }
  const parsed = analyticsEventSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_event', message: 'Некорректное событие' } }, { status: 400 })
  }
  const d = parsed.data
  try {
    await pg`
      insert into analytics_events (
        event_name, schema_version, occurred_at, session_id, entity_type, entity_id,
        route_id, campaign_id, locale, device_category, referrer_category, outcome
      ) values (
        ${d.eventName}, ${d.schemaVersion}, ${clampOccurredAt(d.timestamp)}, ${d.sessionId}, ${d.entityType},
        ${d.entityId}, ${d.routeId}, ${d.campaignId}, ${d.locale}, ${d.deviceCategory},
        ${d.referrerCategory}, ${d.outcome}
      )`
  } catch (error) {
    // Аналитика не должна отдавать 500 и шуметь в клиенте: событие просто теряется.
    console.error('analytics insert', error)
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
