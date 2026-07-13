import { NextRequest, NextResponse } from 'next/server'
import { publicJsonResponse } from '@/lib/http-cache'
import { getUpcomingEvents } from '@/lib/public-events'

export const dynamic = 'force-dynamic'

/** Текущие и предстоящие мероприятия у опубликованных памятников. */
export async function GET(req: NextRequest) {
  try {
    return publicJsonResponse(
      req,
      await getUpcomingEvents(),
      { maxAge: 60, staleWhileRevalidate: 600 }
    )
  } catch (error) {
    console.error('GET /api/events:', error)
    return NextResponse.json(
      { error: 'Не удалось загрузить мероприятия' },
      { status: 500 }
    )
  }
}
