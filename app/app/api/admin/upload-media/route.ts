import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/guard'
import { UPLOADS_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

const LIMITS = {
  video: 100 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
} as const

const EXTENSIONS: Record<keyof typeof LIMITS, string[]> = {
  video: ['.mp4', '.webm'],
  audio: ['.mp3', '.m4a', '.ogg', '.wav'],
}

/** Лёгкая проверка сигнатуры, чтобы не принять произвольный файл под видео-расширением */
function looksLikeMedia(buf: Buffer, ext: string): boolean {
  if (buf.length < 12) return false
  switch (ext) {
    case '.mp4':
    case '.m4a':
      return buf.toString('latin1', 4, 8) === 'ftyp'
    case '.webm':
      return buf.readUInt32BE(0) === 0x1a45dfa3 // EBML (webm/mkv)
    case '.mp3':
      return buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0)
    case '.ogg':
      return buf.toString('latin1', 0, 4) === 'OggS'
    case '.wav':
      return buf.toString('latin1', 0, 4) === 'RIFF'
    default:
      return false
  }
}

/** Загрузка видео (mp4/webm, ≤100 МБ) и аудио аудиогида (mp3/m4a/ogg/wav, ≤30 МБ).
 *  Без транскодинга: файл сохраняется как есть и отдаётся nginx/раздачей uploads. */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = form?.get('kind')
  if (kind !== 'video' && kind !== 'audio') {
    return NextResponse.json({ error: 'Не указан тип файла (video/audio)' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  const ext = extname(file.name).toLowerCase()
  if (!EXTENSIONS[kind].includes(ext)) {
    return NextResponse.json(
      { error: `Допустимые форматы: ${EXTENSIONS[kind].join(', ')}` },
      { status: 400 }
    )
  }
  if (file.size > LIMITS[kind]) {
    return NextResponse.json(
      { error: `Файл больше ${Math.round(LIMITS[kind] / 1024 / 1024)} МБ` },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  if (!looksLikeMedia(buf, ext)) {
    return NextResponse.json({ error: 'Файл повреждён или формат не соответствует расширению' }, { status: 400 })
  }

  const id = randomUUID()
  await mkdir(UPLOADS_DIR, { recursive: true })
  await writeFile(join(UPLOADS_DIR, `${id}${ext}`), buf)

  return NextResponse.json({ url: `/uploads/${id}${ext}` })
}
