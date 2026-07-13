import type { DescriptionSection, Photo, Video } from './types'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function requiredText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** Нормализация JSONB не даёт старым/ручным данным уронить публичный интерфейс. */
export function normalizePhotos(value: unknown): Photo[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const candidate = record(item)
    const original = requiredText(candidate?.original)
    const thumb = requiredText(candidate?.thumb)
    if (!original || !thumb) return []
    const alt = optionalText(candidate?.alt)
    return [{ original, thumb, ...(alt ? { alt } : {}) }]
  })
}

export function normalizeVideos(value: unknown): Video[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const candidate = record(item)
    const src = requiredText(candidate?.src)
    if (!src) return []
    const poster = optionalText(candidate?.poster)
    const alt = optionalText(candidate?.alt)
    const captions = optionalText(candidate?.captions)
    return [{
      src,
      ...(poster ? { poster } : {}),
      ...(alt ? { alt } : {}),
      ...(captions ? { captions } : {}),
    }]
  })
}

export function normalizeSections(value: unknown): DescriptionSection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const candidate = record(item)
    const title = requiredText(candidate?.title)
    const text = requiredText(candidate?.text)
    return title && text ? [{ title, text }] : []
  })
}
