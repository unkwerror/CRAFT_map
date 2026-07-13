import { describe, expect, it } from 'vitest'
import { normalizeSearchText, rankSearchMatch } from './map-search'

describe('normalizeSearchText', () => {
  it('normalizes Unicode, case, ё and punctuation', () => {
    expect(normalizeSearchText('  ПЁТР—Первый, №１  ')).toBe('петр первый 1')
  })
})

describe('rankSearchMatch', () => {
  it('treats ё and е as the same letter', () => {
    expect(rankSearchMatch('Пётр Первый', { title: 'Петр Первый' })).toBe(1000)
  })

  it('ranks an exact title above a title prefix and a token match', () => {
    const exact = rankSearchMatch('Памятник Петру', { title: 'Памятник Петру' })
    const prefix = rankSearchMatch('Памятник Петру', {
      title: 'Памятник Петру Первому',
    })
    const token = rankSearchMatch('Петру', { title: 'Монумент Петру Первому' })

    expect(exact).not.toBeNull()
    expect(prefix).not.toBeNull()
    expect(token).not.toBeNull()
    expect(exact!).toBeGreaterThan(prefix!)
    expect(prefix!).toBeGreaterThan(token!)
  })

  it('matches a multiword district query without relying on the word район', () => {
    expect(
      rankSearchMatch('Калининский район', {
        title: 'Памятник морякам',
        district: 'Калининский округ',
      })
    ).not.toBeNull()
  })

  it('matches safe common roots in a multiword category query', () => {
    expect(
      rankSearchMatch('исторические памятники', {
        title: 'Вечный огонь',
        category: 'Историческая память',
      })
    ).not.toBeNull()
  })

  it('finds an object by address and keeps address above metadata', () => {
    const address = rankSearchMatch('Республики 22', {
      title: 'Мемориальный знак',
      address: 'ул. Республики, 22',
    })
    const metadata = rankSearchMatch('Республики 22', {
      title: 'Мемориальный знак',
      category: 'Республики 22',
    })

    expect(address).not.toBeNull()
    expect(metadata).not.toBeNull()
    expect(address!).toBeGreaterThan(metadata!)
  })

  it('tolerates one typo only in sufficiently long words', () => {
    expect(rankSearchMatch('памяник', { title: 'Памятник героям' })).not.toBeNull()
    expect(rankSearchMatch('памятнки', { title: 'Памятник героям' })).not.toBeNull()
    expect(rankSearchMatch('мак', { title: 'Маяк' })).toBeNull()
  })

  it('rejects a query made only of map stop words', () => {
    expect(
      rankSearchMatch('г. Тюмень, район и округ', {
        title: 'Памятник морякам России',
        district: 'Центральный округ',
      })
    ).toBeNull()
  })

  it('returns null when no field matches', () => {
    expect(
      rankSearchMatch('театр кукол', {
        title: 'Памятник морякам России',
        address: 'Заречный парк',
        category: 'Патриотизм',
        district: 'Центральный округ',
      })
    ).toBeNull()
  })
})
