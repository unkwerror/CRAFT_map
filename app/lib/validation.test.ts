import { describe, expect, it } from 'vitest'
import {
  contentReportInputSchema,
  districtLookupQuerySchema,
  eventInputSchema,
  isContentReportHoneypotFilled,
  isValidCalendarDate,
  objectInputSchema,
  reportStatusPatchSchema,
} from './validation'

const validObject = {
  title: 'Памятник',
  categoryId: 'memory',
  lng: 65.53,
  lat: 57.15,
}

describe('objectInputSchema', () => {
  it('applies safe defaults', () => {
    const result = objectInputSchema.parse(validObject)
    expect(result.sortWeight).toBe(0)
    expect(result.photos).toEqual([])
    expect(result.published).toBe(true)
  })

  it('accepts and preserves sort weight', () => {
    expect(objectInputSchema.parse({ ...validObject, sortWeight: 25 }).sortWeight).toBe(25)
  })

  it('rejects coordinates outside the globe', () => {
    expect(objectInputSchema.safeParse({ ...validObject, lat: 100 }).success).toBe(false)
  })

  it('accepts local /uploads media paths', () => {
    const result = objectInputSchema.parse({
      ...validObject,
      photos: [{
        original: '/uploads/123e4567-e89b-42d3-a456-426614174000.webp',
        thumb: '/uploads/123e4567-e89b-42d3-a456-426614174000_thumb.webp',
      }],
      videos: [{
        src: '/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4',
        poster: '/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp',
        captions: '/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.vtt',
      }],
      audioUrl: '/uploads/audio-1.mp3',
      modelUrl: '/uploads/model-1.glb',
    })
    expect(result.photos).toHaveLength(1)
    expect(result.videos[0]?.captions).toBe('/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.vtt')
    expect(result.audioUrl).toBe('/uploads/audio-1.mp3')
    expect(result.modelUrl).toBe('/uploads/model-1.glb')
  })

  it('rejects external or unsafe media URLs', () => {
    expect(objectInputSchema.safeParse({
      ...validObject,
      photos: [{ original: 'https://evil.example/x.jpg', thumb: '/uploads/ok.webp' }],
    }).success).toBe(false)

    expect(objectInputSchema.safeParse({
      ...validObject,
      photos: [{ original: '/uploads/../secret.webp', thumb: '/uploads/ok.webp' }],
    }).success).toBe(false)

    expect(objectInputSchema.safeParse({
      ...validObject,
      audioUrl: 'https://cdn.example/audio.mp3',
    }).success).toBe(false)

    expect(objectInputSchema.safeParse({
      ...validObject,
      modelUrl: '/etc/passwd',
    }).success).toBe(false)
  })

  it('normalizes empty optional media paths to null', () => {
    const result = objectInputSchema.parse({
      ...validObject,
      audioUrl: '',
      modelUrl: null,
      videos: [{ src: '/uploads/clip.mp4', poster: '', captions: '' }],
    })
    expect(result.audioUrl).toBeNull()
    expect(result.modelUrl).toBeNull()
    expect(result.videos[0]?.poster).toBeNull()
    expect(result.videos[0]?.captions).toBeNull()
  })
})

describe('districtLookupQuerySchema', () => {
  it('parses valid query-string coordinates', () => {
    expect(districtLookupQuerySchema.parse({ lng: '65.53', lat: '57.15' })).toEqual({
      lng: 65.53,
      lat: 57.15,
    })
  })

  it('rejects missing, empty and out-of-range coordinates', () => {
    expect(districtLookupQuerySchema.safeParse({ lng: null, lat: '57.15' }).success).toBe(false)
    expect(districtLookupQuerySchema.safeParse({ lng: '', lat: '57.15' }).success).toBe(false)
    expect(districtLookupQuerySchema.safeParse({ lng: '181', lat: '57.15' }).success).toBe(false)
  })
})

describe('content reports', () => {
  const validReport = {
    objectId: '123e4567-e89b-42d3-a456-426614174000',
    message: 'На странице указан неверный адрес памятника.',
    website: '',
  }

  it('trims public input and normalizes an omitted contact', () => {
    expect(contentReportInputSchema.parse({
      ...validReport,
      message: `  ${validReport.message}  `,
    })).toEqual({
      ...validReport,
      message: validReport.message,
      contact: null,
    })
  })

  it('enforces message, contact and object id limits', () => {
    expect(contentReportInputSchema.safeParse({ ...validReport, message: 'Коротко' }).success)
      .toBe(false)
    expect(contentReportInputSchema.safeParse({ ...validReport, message: '😀'.repeat(5) }).success)
      .toBe(false)
    expect(contentReportInputSchema.safeParse({ ...validReport, message: '😀'.repeat(2001) }).success)
      .toBe(false)
    expect(contentReportInputSchema.safeParse({ ...validReport, contact: 'x'.repeat(301) }).success)
      .toBe(false)
    expect(contentReportInputSchema.safeParse({ ...validReport, objectId: 'not-a-uuid' }).success)
      .toBe(false)
  })

  it('accepts only known admin report statuses', () => {
    expect(reportStatusPatchSchema.safeParse({ status: 'resolved' }).success).toBe(true)
    expect(reportStatusPatchSchema.safeParse({ status: 'pending' }).success).toBe(false)
  })

  it('detects only a filled string honeypot', () => {
    expect(isContentReportHoneypotFilled({ website: 'https://bot.example' })).toBe(true)
    expect(isContentReportHoneypotFilled({ website: '   ' })).toBe(false)
    expect(isContentReportHoneypotFilled({ website: 123 })).toBe(false)
  })
})

const validEvent = {
  objectId: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Мероприятие',
  startsOn: '2028-02-29',
  endsOn: '2028-02-29',
}

describe('eventInputSchema', () => {
  it('accepts real leap dates and applies safe event defaults', () => {
    expect(eventInputSchema.parse(validEvent)).toMatchObject({
      startsAt: null,
      endsAt: null,
      timezone: 'Asia/Yekaterinburg',
      status: 'scheduled',
      published: true,
    })
  })

  it.each(['2027-02-29', '2028-04-31', '2028-13-01', '0000-01-01'])(
    'rejects an impossible calendar date: %s',
    (startsOn) => {
      expect(eventInputSchema.safeParse({ ...validEvent, startsOn, endsOn: startsOn }).success)
        .toBe(false)
      expect(isValidCalendarDate(startsOn)).toBe(false)
    }
  )

  it('validates times and a same-day interval', () => {
    expect(eventInputSchema.safeParse({ ...validEvent, startsAt: '09:30', endsAt: '12:00' }).success)
      .toBe(true)
    expect(eventInputSchema.safeParse({ ...validEvent, startsAt: '25:00' }).success).toBe(false)
    expect(eventInputSchema.safeParse({ ...validEvent, startsAt: null, endsAt: '12:00' }).success)
      .toBe(false)
    expect(eventInputSchema.safeParse({ ...validEvent, startsAt: '12:00', endsAt: '09:30' }).success)
      .toBe(false)
  })

  it('validates extended public event fields', () => {
    expect(eventInputSchema.safeParse({
      ...validEvent,
      registrationUrl: 'javascript:alert(1)',
    }).success).toBe(false)
    expect(eventInputSchema.safeParse({
      ...validEvent,
      status: 'unknown',
    }).success).toBe(false)
  })
})
