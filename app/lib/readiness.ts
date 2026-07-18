export interface ReadinessInput {
  hasCoordinates: boolean
  address: string | null
  photos: { alt?: string }[]
  sourceCount: number
  mediaRightsStatus: string | null
  audioStatus: string | null
  accessibilityAttributes: Record<string, unknown>
  hasShortVariant: boolean
  verificationStatus: string
}

export interface ReadinessResult {
  score: number
  missing: string[]
}

const CHECKS: Array<[keyof ReadinessInput | 'photoAlt', string, (input: ReadinessInput) => boolean]> = [
  ['hasCoordinates', 'Нет координат', (v) => v.hasCoordinates],
  ['address', 'Нет адреса', (v) => Boolean(v.address?.trim())],
  ['photos', 'Нет обложки', (v) => v.photos.length > 0],
  ['photoAlt', 'Нет alt-текста обложки', (v) => Boolean(v.photos[0]?.alt?.trim())],
  ['sourceCount', 'Нет источников', (v) => v.sourceCount > 0],
  ['mediaRightsStatus', 'Не указаны права на медиа', (v) => Boolean(v.mediaRightsStatus)],
  ['audioStatus', 'Аудио отсутствует или устарело', (v) => v.audioStatus === 'ready'],
  ['accessibilityAttributes', 'Не заполнена доступность', (v) => Object.keys(v.accessibilityAttributes).length > 0],
  ['hasShortVariant', 'Нет краткой аудиоверсии', (v) => v.hasShortVariant],
  ['verificationStatus', 'Карточка не проверена', (v) => v.verificationStatus === 'verified'],
]

export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const missing = CHECKS.filter(([, , ready]) => !ready(input)).map(([, reason]) => reason)
  return { score: Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100), missing }
}

