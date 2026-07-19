import { describe, expect, it } from 'vitest'
import { translitSlug } from './translit'
import { slugSchema } from './memory-graph'

describe('translitSlug', () => {
  it('кириллица в латиницу с дефисами', () => {
    expect(translitSlug('Маршрут по центру Тюмени')).toBe('marshrut-po-tsentru-tyumeni')
  })
  it('ё, щ, ц и знаки препинания', () => {
    expect(translitSlug('Ёлка, щука и цирк!')).toBe('elka-schuka-i-tsirk')
  })
  it('твёрдый и мягкий знаки выпадают', () => {
    expect(translitSlug('Объезд подъёма')).toBe('obezd-podema')
  })
  it('латиница и цифры проходят как есть', () => {
    expect(translitSlug('Route 66 — West')).toBe('route-66-west')
  })
  it('пустая строка и только символы', () => {
    expect(translitSlug('')).toBe('')
    expect(translitSlug('«…»')).toBe('')
  })
  it('результат проходит slugSchema проекта', () => {
    const slug = translitSlug('Сквер имени 65-летия Победы')
    expect(slugSchema.safeParse(slug).success).toBe(true)
  })
  it('длина ограничена 120 символами без хвостового дефиса', () => {
    const slug = translitSlug('щ'.repeat(200))
    expect(slug.length).toBeLessThanOrEqual(120)
    expect(slug.endsWith('-')).toBe(false)
  })
})
