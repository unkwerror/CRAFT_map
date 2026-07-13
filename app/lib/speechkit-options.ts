export const SPEECHKIT_ROLES = {
  neutral: { value: 'neutral', label: 'Нейтральный' },
  friendly: { value: 'friendly', label: 'Дружелюбный' },
  good: { value: 'good', label: 'Радостный' },
  strict: { value: 'strict', label: 'Строгий' },
  evil: { value: 'evil', label: 'Раздражённый' },
  whisper: { value: 'whisper', label: 'Шёпот' },
} as const

export type SpeechkitRole = keyof typeof SPEECHKIT_ROLES

interface SpeechkitVoiceOption {
  value: string
  label: string
  roles: readonly (typeof SPEECHKIT_ROLES)[SpeechkitRole][]
}

// Public Russian voices supported by SpeechKit API v3. Voices without roles are
// intentionally omitted: every combination exposed to the admin UI must be valid.
export const SPEECHKIT_VOICES = [
  { value: 'alena', label: 'Алёна', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good] },
  { value: 'ermil', label: 'Ермил', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good] },
  { value: 'jane', label: 'Джейн', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good, SPEECHKIT_ROLES.evil] },
  { value: 'omazh', label: 'Омаж', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.evil] },
  { value: 'zahar', label: 'Захар', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good] },
  { value: 'dasha', label: 'Даша', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good, SPEECHKIT_ROLES.friendly] },
  { value: 'julia', label: 'Юлия', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict] },
  { value: 'lera', label: 'Лера', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.friendly] },
  { value: 'masha', label: 'Маша', roles: [SPEECHKIT_ROLES.good, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.friendly] },
  { value: 'marina', label: 'Марина', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.whisper, SPEECHKIT_ROLES.friendly] },
  { value: 'alexander', label: 'Александр', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good] },
  { value: 'kirill', label: 'Кирилл', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.good] },
  { value: 'anton', label: 'Антон', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.good] },
  { value: 'saule_ru', label: 'Сауле', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.whisper] },
  { value: 'zamira_ru', label: 'Замира', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.friendly] },
  { value: 'zhanar_ru', label: 'Жанар', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.friendly] },
  { value: 'yulduz_ru', label: 'Юлдуз', roles: [SPEECHKIT_ROLES.neutral, SPEECHKIT_ROLES.strict, SPEECHKIT_ROLES.friendly, SPEECHKIT_ROLES.whisper] },
] as const satisfies readonly SpeechkitVoiceOption[]

export type SpeechkitVoice = (typeof SPEECHKIT_VOICES)[number]['value']

export const SPEECHKIT_SPEED_MIN = 0.1
export const SPEECHKIT_SPEED_MAX = 3
export const SPEECHKIT_SPEED_STEP = 0.1

export interface SpeechkitOptions {
  voice: SpeechkitVoice
  role: SpeechkitRole
  speed: number
}

export const DEFAULT_SPEECHKIT_OPTIONS: SpeechkitOptions = {
  voice: 'marina',
  role: 'friendly',
  speed: 1,
}
