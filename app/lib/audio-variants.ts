import { createHash } from 'node:crypto'

export function audioTextHash(text: string | null | undefined): string | null {
  const normalized = text?.replace(/\r\n/g, '\n').trim()
  return normalized ? createHash('sha256').update(normalized).digest('hex') : null
}

export function legacyAudioStatus(audioUrl: string | null, audioText: string | null): 'empty' | 'stale' | 'ready' {
  if (audioUrl) return 'ready'
  if (audioText?.trim()) return 'stale'
  return 'empty'
}
