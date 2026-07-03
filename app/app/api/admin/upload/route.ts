import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireRole } from '@/lib/guard'
import { UPLOADS_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 15 * 1024 * 1024

/** Загрузка фото: оригинал ≤1600px + превью 400px, webp */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл больше 15 МБ' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const id = randomUUID()
  await mkdir(UPLOADS_DIR, { recursive: true })

  try {
    const img = sharp(buf, { failOn: 'error' }).rotate()
    await img
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(UPLOADS_DIR, `${id}.webp`))
    await img
      .clone()
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(join(UPLOADS_DIR, `${id}_thumb.webp`))
  } catch {
    return NextResponse.json({ error: 'Файл не является изображением' }, { status: 400 })
  }

  return NextResponse.json({
    original: `/uploads/${id}.webp`,
    thumb: `/uploads/${id}_thumb.webp`,
  })
}
