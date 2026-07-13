import { describe, expect, it } from 'vitest'
import {
  looksLikeMp3,
  parseSpeechkitAudioResponse,
  SPEECHKIT_TEXT_LIMIT,
  validateSpeechkitRequest,
  validateSpeechkitText,
} from './speechkit'

describe('validateSpeechkitText', () => {
  it('trims a valid text', () => {
    expect(validateSpeechkitText({ text: '  Памятник  ' })).toEqual({
      success: true,
      text: 'Памятник',
    })
  })

  it('rejects missing, empty and overlong text', () => {
    expect(validateSpeechkitText({}).success).toBe(false)
    expect(validateSpeechkitText({ text: '   ' }).success).toBe(false)
    expect(validateSpeechkitText({ text: 'я'.repeat(SPEECHKIT_TEXT_LIMIT + 1) }).success).toBe(false)
  })
})

describe('validateSpeechkitRequest', () => {
  it('uses backward-compatible defaults', () => {
    expect(validateSpeechkitRequest({ text: '  Памятник  ' })).toEqual({
      success: true,
      text: 'Памятник',
      voice: 'marina',
      role: 'friendly',
      speed: 1,
    })
  })

  it('accepts an allowlisted compatible voice, role and speed', () => {
    expect(validateSpeechkitRequest({
      text: 'Памятник',
      voice: 'kirill',
      role: 'strict',
      speed: 1.25,
    })).toEqual({
      success: true,
      text: 'Памятник',
      voice: 'kirill',
      role: 'strict',
      speed: 1.25,
    })
  })

  it('rejects unknown voices and roles incompatible with the selected voice', () => {
    expect(validateSpeechkitRequest({ text: 'Текст', voice: 'unknown' })).toEqual({
      success: false,
      error: 'Выбран неподдерживаемый голос',
    })
    expect(validateSpeechkitRequest({ text: 'Текст', voice: 'julia', role: 'friendly' })).toEqual({
      success: false,
      error: 'Выбранное амплуа недоступно для этого голоса',
    })
  })

  it('rejects non-numeric, non-finite and out-of-range speeds', () => {
    for (const speed of ['1', Number.NaN, Number.POSITIVE_INFINITY, 0.09, 3.01]) {
      expect(validateSpeechkitRequest({ text: 'Текст', speed }).success).toBe(false)
    }
  })

  it('accepts the documented speed boundaries', () => {
    expect(validateSpeechkitRequest({ text: 'Текст', speed: 0.1 }).success).toBe(true)
    expect(validateSpeechkitRequest({ text: 'Текст', speed: 3 }).success).toBe(true)
  })
})

describe('parseSpeechkitAudioResponse', () => {
  it('joins audio from an NDJSON response', () => {
    const body = [
      JSON.stringify({ result: { audioChunk: { data: Buffer.from('ID3').toString('base64') } } }),
      JSON.stringify({ result: { audioChunk: { data: Buffer.from('audio').toString('base64') } } }),
    ].join('\n')

    expect(parseSpeechkitAudioResponse(body)?.toString()).toBe('ID3audio')
  })

  it('accepts the unwrapped REST response and rejects malformed data', () => {
    const body = JSON.stringify({ audioChunk: { data: Buffer.from('ID3').toString('base64') } })
    expect(parseSpeechkitAudioResponse(body)?.toString()).toBe('ID3')
    expect(parseSpeechkitAudioResponse('{"result":')).toBeNull()
    expect(parseSpeechkitAudioResponse(JSON.stringify({ result: { audioChunk: { data: '***' } } }))).toBeNull()
  })
})

describe('looksLikeMp3', () => {
  it('recognizes ID3 and MPEG frame headers', () => {
    expect(looksLikeMp3(Buffer.from([0x49, 0x44, 0x33]))).toBe(true)
    expect(looksLikeMp3(Buffer.from([0xff, 0xfb, 0x90]))).toBe(true)
    expect(looksLikeMp3(Buffer.from('OggS'))).toBe(false)
  })
})
