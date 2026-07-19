import { z } from 'zod'

export const ANALYTICS_EVENT_NAMES = [
  'map_open', 'search_submit', 'search_zero_results', 'filter_apply', 'filter_reset',
  'place_open', 'media_view', 'model_3d_open', 'audio_start', 'audio_progress_25',
  'audio_progress_50', 'audio_progress_75', 'audio_complete', 'qr_open',
  'favorite_add', 'visited_mark', 'event_view', 'calendar_add',
] as const

const sessionId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/)

export const analyticsEventSchema = z.object({
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  schemaVersion: z.literal(1),
  timestamp: z.string().datetime({ offset: true }),
  sessionId,
  entityType: z.enum(['object', 'event', 'route', 'campaign']).nullable().default(null),
  entityId: z.string().uuid().nullable().default(null),
  routeId: z.string().uuid().nullable().default(null),
  campaignId: z.string().uuid().nullable().default(null),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default('ru'),
  deviceCategory: z.enum(['mobile', 'tablet', 'desktop']).nullable().default(null),
  referrerCategory: z.enum(['direct', 'search', 'social', 'qr', 'internal', 'other']).nullable().default(null),
  outcome: z.string().trim().max(64).nullable().default(null),
}).strict()


/**
 * Клиентское время события зажимается к серверному окну ±48 часов:
 * произвольный occurred_at из запроса не должен искажать отчёты.
 */
export function clampOccurredAt(timestamp: string, now: Date = new Date()): string {
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return now.toISOString()
  const windowMs = 48 * 60 * 60 * 1000
  if (Math.abs(now.getTime() - parsed) > windowMs) return now.toISOString()
  return new Date(parsed).toISOString()
}
