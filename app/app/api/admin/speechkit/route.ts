import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/guard'
import { UPLOADS_DIR } from '@/lib/paths'
import {
  looksLikeMp3,
  parseSpeechkitAudioResponse,
  validateSpeechkitRequest,
} from '@/lib/speechkit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SPEECHKIT_URL = 'https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis'
const SPEECHKIT_TIMEOUT_MS = 120_000

function upstreamError(status: number): NextResponse {
  if (status === 401 || status === 403) {
    return NextResponse.json(
      { error: 'SpeechKit отклонил API-ключ. Проверьте ключ и права сервисного аккаунта' },
      { status: 502 }
    )
  }
  if (status === 429) {
    return NextResponse.json(
      { error: 'SpeechKit временно недоступен: превышен лимит запросов' },
      { status: 429 }
    )
  }
  return NextResponse.json({ error: 'Не удалось синтезировать речь в SpeechKit' }, { status: 502 })
}

export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const contentLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: 'Слишком большой запрос' }, { status: 413 })
  }

  const rawPayload = await req.text().catch(() => '')
  if (rawPayload.length > 64 * 1024) {
    return NextResponse.json({ error: 'Слишком большой запрос' }, { status: 413 })
  }
  const payload = (() => {
    try {
      return JSON.parse(rawPayload) as unknown
    } catch {
      return null
    }
  })()
  const validation = validateSpeechkitRequest(payload)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const apiKey = process.env.YANDEX_SPEECHKIT_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SpeechKit не настроен: не задан API-ключ' },
      { status: 503 }
    )
  }

  let response: Response
  try {
    response = await fetch(SPEECHKIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: validation.text,
        hints: [
          { voice: validation.voice },
          { role: validation.role },
          { speed: String(validation.speed) },
        ],
        outputAudioSpec: { containerAudio: { containerAudioType: 'MP3' } },
        unsafeMode: validation.text.length > 250,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(SPEECHKIT_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return NextResponse.json(
      { error: timedOut ? 'SpeechKit не успел озвучить текст. Повторите позже' : 'SpeechKit сейчас недоступен' },
      { status: timedOut ? 504 : 502 }
    )
  }

  if (!response.ok) return upstreamError(response.status)

  let audio: Buffer | null
  try {
    audio = parseSpeechkitAudioResponse(await response.text())
  } catch {
    audio = null
  }
  if (!audio || !looksLikeMp3(audio)) {
    return NextResponse.json(
      { error: 'SpeechKit вернул аудио в неожиданном формате' },
      { status: 502 }
    )
  }

  const filename = `speechkit-${randomUUID()}.mp3`
  const filePath = join(UPLOADS_DIR, filename)
  try {
    await mkdir(UPLOADS_DIR, { recursive: true })
    await writeFile(filePath, audio, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      await unlink(filePath).catch(() => undefined)
    }
    return NextResponse.json({ error: 'Не удалось сохранить аудиофайл' }, { status: 500 })
  }

  return NextResponse.json({ url: `/uploads/${filename}` })
}
