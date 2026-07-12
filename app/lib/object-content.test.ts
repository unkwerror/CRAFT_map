import { describe, expect, it } from 'vitest'
import { normalizePhotos, normalizeSections, normalizeVideos } from './object-content'

describe('object content normalization', () => {
  it('returns empty arrays for legacy non-array JSONB', () => {
    expect(normalizePhotos(null)).toEqual([])
    expect(normalizeVideos({ src: '/video.mp4' })).toEqual([])
    expect(normalizeSections('История')).toEqual([])
  })

  it('filters malformed entries and optional fields', () => {
    expect(normalizePhotos([
      { original: '/photo.webp', thumb: '/thumb.webp', alt: 42 },
      { original: '', thumb: '/broken.webp' },
    ])).toEqual([{ original: '/photo.webp', thumb: '/thumb.webp' }])

    expect(normalizeVideos([
      { src: '/video.mp4', poster: '/poster.webp', alt: 'Видео' },
      { src: 10 },
    ])).toEqual([{ src: '/video.mp4', poster: '/poster.webp', alt: 'Видео' }])
  })

  it('keeps only complete description sections', () => {
    expect(normalizeSections([
      { title: 'История', text: 'Текст' },
      { title: 'Пусто', text: ' ' },
      null,
    ])).toEqual([{ title: 'История', text: 'Текст' }])
  })
})
