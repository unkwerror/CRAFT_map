import {
  DEFAULT_SPEECHKIT_OPTIONS,
  SPEECHKIT_SPEED_MAX,
  SPEECHKIT_SPEED_MIN,
  SPEECHKIT_VOICES,
  type SpeechkitOptions,
  type SpeechkitRole,
  type SpeechkitVoice,
} from './speechkit-options'

export const SPEECHKIT_TEXT_LIMIT = 5000
export const SPEECHKIT_AUDIO_LIMIT = 30 * 1024 * 1024

type TextValidationResult =
  | { success: true; text: string }
  | { success: false; error: string }

type RequestValidationResult =
  | ({ success: true; text: string } & SpeechkitOptions)
  | { success: false; error: string }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validates the small JSON contract accepted by the admin SpeechKit endpoint. */
export function validateSpeechkitText(payload: unknown): TextValidationResult {
  if (!isRecord(payload) || typeof payload.text !== 'string') {
    return { success: false, error: 'Передайте текст для озвучивания' }
  }

  const text = payload.text.trim()
  if (!text) {
    return { success: false, error: 'Введите текст аудиогида' }
  }
  if (text.length > SPEECHKIT_TEXT_LIMIT) {
    return {
      success: false,
      error: `Текст для озвучивания не должен превышать ${SPEECHKIT_TEXT_LIMIT} символов`,
    }
  }

  return { success: true, text }
}

function findVoice(value: unknown) {
  if (typeof value !== 'string') return undefined
  return SPEECHKIT_VOICES.find((voice) => voice.value === value)
}

/** Validates text and the allowlisted synthesis options accepted by the admin endpoint. */
export function validateSpeechkitRequest(payload: unknown): RequestValidationResult {
  const textValidation = validateSpeechkitText(payload)
  if (!textValidation.success) return textValidation
  if (!isRecord(payload)) return { success: false, error: 'Некорректный запрос' }

  const voiceValue = payload.voice ?? DEFAULT_SPEECHKIT_OPTIONS.voice
  const voice = findVoice(voiceValue)
  if (!voice) return { success: false, error: 'Выбран неподдерживаемый голос' }

  const roleValue = payload.role ?? DEFAULT_SPEECHKIT_OPTIONS.role
  if (typeof roleValue !== 'string' || !voice.roles.some((role) => role.value === roleValue)) {
    return { success: false, error: 'Выбранное амплуа недоступно для этого голоса' }
  }

  const speedValue = payload.speed ?? DEFAULT_SPEECHKIT_OPTIONS.speed
  if (
    typeof speedValue !== 'number' ||
    !Number.isFinite(speedValue) ||
    speedValue < SPEECHKIT_SPEED_MIN ||
    speedValue > SPEECHKIT_SPEED_MAX
  ) {
    return {
      success: false,
      error: `Скорость речи должна быть числом от ${SPEECHKIT_SPEED_MIN} до ${SPEECHKIT_SPEED_MAX}`,
    }
  }

  return {
    success: true,
    text: textValidation.text,
    voice: voice.value as SpeechkitVoice,
    role: roleValue as SpeechkitRole,
    speed: speedValue,
  }
}

function getAudioData(value: unknown): unknown {
  if (!isRecord(value)) return undefined
  const result = isRecord(value.result) ? value.result : value
  const audioChunk = isRecord(result.audioChunk) ? result.audioChunk : undefined
  return audioChunk?.data
}

function decodeBase64(value: string): Buffer | null {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null
  return Buffer.from(value, 'base64')
}

/** Extracts and joins audio chunks from a SpeechKit v3 REST JSON/NDJSON response. */
export function parseSpeechkitAudioResponse(body: string): Buffer | null {
  const source = body.trim()
  if (!source) return null

  let messages: unknown[]
  try {
    messages = [JSON.parse(source)]
  } catch {
    try {
      messages = source.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    } catch {
      return null
    }
  }

  const chunks: Buffer[] = []
  let size = 0
  for (const message of messages) {
    const data = getAudioData(message)
    if (typeof data !== 'string') continue
    const chunk = decodeBase64(data)
    if (!chunk) return null
    size += chunk.length
    if (size > SPEECHKIT_AUDIO_LIMIT) return null
    chunks.push(chunk)
  }

  return chunks.length > 0 ? Buffer.concat(chunks, size) : null
}

export function looksLikeMp3(audio: Uint8Array): boolean {
  if (audio.length < 3) return false
  return (
    (audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33) ||
    (audio[0] === 0xff && ((audio[1] ?? 0) & 0xe0) === 0xe0)
  )
}
