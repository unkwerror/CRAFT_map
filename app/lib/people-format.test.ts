import { describe, expect, it } from 'vitest'
import { lifeYears, nameInitials, verificationLabel } from './people-format'

describe('lifeYears', () => {
  it('оба года — диапазон через тире', () => expect(lifeYears(1901, 1957)).toBe('1901—1957'))
  it('только год рождения', () => expect(lifeYears(1901, null)).toBe('род. 1901'))
  it('только год смерти', () => expect(lifeYears(null, 1957)).toBe('ум. 1957'))
  it('нет данных — null, а не «?—»', () => expect(lifeYears(null, null)).toBeNull())
})

describe('verificationLabel', () => {
  it('verified', () => expect(verificationLabel('verified')).toEqual({ text: 'Проверено редакцией', verified: true }))
  it('прочие статусы — нейтральная формулировка', () => {
    expect(verificationLabel('needs_review').verified).toBe(false)
    expect(verificationLabel('unverified').text).toBe('Сведения уточняются')
  })
})

describe('nameInitials', () => {
  it('имя и фамилия', () => expect(nameInitials('Иван Краевед')).toBe('ИК'))
  it('одно слово', () => expect(nameInitials('Ермак')).toBe('Е'))
  it('лишние пробелы и третье слово игнорируются', () => expect(nameInitials('  Пётр  Ильич Чайковский ')).toBe('ПИ'))
})
