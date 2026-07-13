import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/guard'
import { UPLOADS_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

const LIMITS = {
  video: 100 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  captions: 1024 * 1024,
} as const

const EXTENSIONS: Record<keyof typeof LIMITS, string[]> = {
  video: ['.mp4', '.webm'],
  audio: ['.mp3', '.m4a', '.ogg', '.wav'],
  captions: ['.vtt'],
}

/** Лёгкая проверка сигнатуры, чтобы не принять произвольный файл под видео-расширением */
function looksLikeMedia(buf: Buffer, ext: string): boolean {
  if (ext === '.vtt') return buf.toString('utf8', 0, Math.min(buf.length, 128)).replace(/^\uFEFF/, '').startsWith('WEBVTT')
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

/** Загрузка видео (mp4/webm, ≤100 МБ), аудио (≤30 МБ) и WebVTT-субтитров (≤1 МБ).
 *  Без транскодинга: файл сохраняется как есть и отдаётся nginx/раздачей uploads. */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const contentLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > LIMITS.video + 1024 * 1024) {
    return NextResponse.json({ error: 'Файл больше 100 МБ' }, { status: 413 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = form?.get('kind')
  if (kind !== 'video' && kind !== 'audio' && kind !== 'captions') {
    return NextResponse.json({ error: 'Не указан тип файла (video/audio/captions)' }, { status: 400 })
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

  const header = Buffer.from(await file.slice(0, 256).arrayBuffer())
  if (!looksLikeMedia(header, ext)) {
    return NextResponse.json({ error: 'Файл повреждён или формат не соответствует расширению' }, { status: 400 })
  }

  const id = randomUUID()
  await mkdir(UPLOADS_DIR, { recursive: true })
  const target = join(UPLOADS_DIR, `${id}${ext}`)
  const temporary = `${target}.part`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    const reader = file.stream().getReader()
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      await handle.write(chunk.value)
    }
    await handle.sync()
    await handle.close()
    // Временный файл закрыт для nginx, а публичное имя появляется уже с правами на чтение.
    await chmod(temporary, 0o644)
    await rename(temporary, target)
  } catch (error) {
    await handle.close().catch(() => undefined)
    await unlink(temporary).catch(() => undefined)
    throw error
  }

  return NextResponse.json({ url: `/uploads/${id}${ext}` })
}
