import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import {
  contentReportInputSchema,
  isContentReportHoneypotFilled,
} from '@/lib/validation'

export const dynamic = 'force-dynamic'

const responseOptions = {
  headers: { 'Cache-Control': 'no-store' },
}

// Публичное сообщение об ошибке в карточке опубликованного памятника.
export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json(
      { error: 'Слишком большой запрос' },
      { status: 413, ...responseOptions }
    )
  }

  const payload: unknown = await req.json().catch(() => null)
  if (isContentReportHoneypotFilled(payload)) {
    // Honeypot: бот получает обычный успешный ответ, но запись не создаётся.
    return NextResponse.json({ ok: true }, { status: 201, ...responseOptions })
  }

  const parsed = contentReportInputSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
      { status: 400, ...responseOptions }
    )
  }
  const { objectId, message, contact } = parsed.data

  try {
    const rows = await pg<{ id: string }[]>`
      insert into content_reports (object_id, object_title, message, contact)
      select o.id, o.title, ${message}, ${contact}
      from objects o
      where o.id = ${objectId} and o.published
      returning id`
    if (!rows.length) {
      return NextResponse.json(
        { error: 'Объект не найден' },
        { status: 404, ...responseOptions }
      )
    }
    return NextResponse.json({ ok: true }, { status: 201, ...responseOptions })
  } catch (error) {
    console.error('POST /api/reports failed:', error)
    return NextResponse.json(
      { error: 'Не удалось отправить сообщение' },
      { status: 500, ...responseOptions }
    )
  }
}
