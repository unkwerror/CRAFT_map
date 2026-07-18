import { describe, expect, it } from 'vitest'
import { audioTextHash, legacyAudioStatus } from './audio-variants'

describe('audio variants compatibility', () => {
  it('normalizes line endings before hashing', () => {
    expect(audioTextHash('Текст\r\nстрока')).toBe(audioTextHash('Текст\nстрока'))
  })
  it('maps the legacy state explicitly', () => {
    expect(legacyAudioStatus('/uploads/a.mp3', 'text')).toBe('ready')
    expect(legacyAudioStatus(null, 'text')).toBe('stale')
    expect(legacyAudioStatus(null, null)).toBe('empty')
  })
})
