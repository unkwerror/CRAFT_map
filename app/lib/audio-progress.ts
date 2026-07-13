const AUDIO_PROGRESS_PREFIX = 'craft-map:audio-progress:v1:'

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function audioProgressKey(audioUrl: string): string {
  return `${AUDIO_PROGRESS_PREFIX}${audioUrl}`
}

export function readAudioProgress(storage: ProgressStorage, audioUrl: string): number | null {
  try {
    const value = Number(storage.getItem(audioProgressKey(audioUrl)))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function writeAudioProgress(storage: ProgressStorage, audioUrl: string, seconds: number): void {
  try {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      storage.removeItem(audioProgressKey(audioUrl))
      return
    }
    storage.setItem(audioProgressKey(audioUrl), String(Math.round(seconds * 10) / 10))
  } catch {
    // Приватный режим/лимит localStorage не должны ломать аудиоплеер.
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const rounded = Math.floor(seconds)
  const minutes = Math.floor(rounded / 60)
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`
}
