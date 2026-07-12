import { describe, expect, it } from 'vitest'
import { csvCell } from './csv'

describe('csvCell', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1)'])('neutralizes formulas: %s', (value) => {
    expect(csvCell(value)).toBe(`'${value}`)
  })

  it('quotes separators, line breaks and quotes', () => {
    expect(csvCell('Текст; "цитата"\nстрока')).toBe('"Текст; ""цитата""\nстрока"')
  })

  it('keeps regular values unchanged', () => {
    expect(csvCell('Памятник')).toBe('Памятник')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(null)).toBe('')
  })
})
