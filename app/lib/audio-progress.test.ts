import { describe, expect, it } from 'vitest'
import { audioProgressKey, formatAudioTime, readAudioProgress, writeAudioProgress } from './audio-progress'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('audio progress', () => {
  it('stores progress per audio URL and clears invalid values', () => {
    const storage = memoryStorage()
    writeAudioProgress(storage, '/guide.mp3', 42.26)
    expect(storage.getItem(audioProgressKey('/guide.mp3'))).toBe('42.3')
    expect(readAudioProgress(storage, '/guide.mp3')).toBe(42.3)
    writeAudioProgress(storage, '/guide.mp3', 0)
    expect(readAudioProgress(storage, '/guide.mp3')).toBeNull()
  })

  it('formats player time', () => {
    expect(formatAudioTime(0)).toBe('0:00')
    expect(formatAudioTime(65.9)).toBe('1:05')
  })
})
