import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { absoluteSiteUrl } from '@/lib/seo'
import { uuidSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

// Печатные QR: уровень коррекции M, quiet zone 4 модуля, чёрное на белом для контраста.
const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024, color: { dark: '#000000', light: '#FFFFFF' } }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: 'Кампания не найдена' }, { status: 404 })
  const [row] = await pg<{ code: string }[]>`
    select sl.code from qr_campaigns qc join short_links sl on sl.id = qc.short_link_id where qc.id = ${id}`
  if (!row) return NextResponse.json({ error: 'Кампания не найдена' }, { status: 404 })

  const url = absoluteSiteUrl(`/r/${row.code}`)
  const format = req.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'svg'
  if (format === 'png') {
    const png = await QRCode.toBuffer(url, { ...QR_OPTIONS, type: 'png' })
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${row.code}.png"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' })
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="qr-${row.code}.svg"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
