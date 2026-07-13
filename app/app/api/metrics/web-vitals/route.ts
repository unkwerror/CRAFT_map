import { NextRequest, NextResponse } from 'next/server'
import { webVitalSchema } from '@/lib/web-vitals'

export const dynamic = 'force-dynamic'

const responseHeaders = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json(
      { error: 'Слишком большой запрос' },
      { status: 413, headers: responseHeaders }
    )
  }
  const rawPayload = await req.text().catch(() => '')
  if (rawPayload.length > 4096) {
    return NextResponse.json(
      { error: 'Слишком большой запрос' },
      { status: 413, headers: responseHeaders }
    )
  }
  const payload = (() => {
    try {
      return JSON.parse(rawPayload) as unknown
    } catch {
      return null
    }
  })()
  const parsed = webVitalSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректная метрика' },
      { status: 400, headers: responseHeaders }
    )
  }

  console.info(JSON.stringify({
    type: 'web_vital',
    timestamp: new Date().toISOString(),
    ...parsed.data,
  }))
  return new NextResponse(null, { status: 204, headers: responseHeaders })
}
