export interface SearchMatchTarget {
  title: string
  address?: string | null
  category?: string | null
  district?: string | null
}

// Служебные слова не должны превращать запрос «г. Тюмень, район» в совпадение
// со всеми объектами. Они игнорируются только при сопоставлении токенов:
// точное название и префикс по-прежнему сравниваются целиком.
const SEARCH_STOP_WORDS = new Set([
  'ао',
  'г',
  'город',
  'города',
  'городе',
  'городом',
  'тюмень',
  'тюмени',
  'район',
  'района',
  'районе',
  'районом',
  'району',
  'районы',
  'округ',
  'округа',
  'округе',
  'округом',
  'округу',
  'округи',
  'в',
  'во',
  'на',
  'у',
  'к',
  'ко',
  'с',
  'со',
  'по',
  'для',
  'из',
  'за',
  'о',
  'об',
  'от',
  'до',
  'и',
  'или',
])

/** Нормализация общей для индекса и пользовательского запроса формы. */
export function normalizeSearchText(value: string): string {
  return value
    // NFKC превращает «№» в латинское "No"; для адресного поиска нужен сам номер.
    .replaceAll('№', ' ')
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function tokens(value: string): string[] {
  return value ? value.split(' ') : []
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left[index] === right[index]) index++
  return index
}

/** Одна вставка/удаление/замена или перестановка соседних букв. */
function isSingleTypo(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false
  if (left.length === right.length) {
    const mismatches: number[] = []
    for (let index = 0; index < left.length; index++) {
      if (left[index] !== right[index]) mismatches.push(index)
      if (mismatches.length > 2) return false
    }
    if (mismatches.length <= 1) return true
    const first = mismatches[0]!
    const second = mismatches[1]!
    return second === first + 1 && left[first] === right[second] && left[second] === right[first]
  }

  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  let shortIndex = 0
  let longIndex = 0
  let skipped = false
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex++
      longIndex++
      continue
    }
    if (skipped) return false
    skipped = true
    longIndex++
  }
  return true
}

/**
 * 1 — точный токен, 0.9 — безопасный префикс, 0.75 — близкие русские формы
 * с достаточно длинным общим корнем. Для слов от пяти букв допускается ровно
 * одна опечатка; короткие названия защищены от случайных совпадений.
 */
function tokenSimilarity(queryToken: string, targetToken: string): number | null {
  if (queryToken === targetToken) return 1

  const shorterLength = Math.min(queryToken.length, targetToken.length)
  if (shorterLength >= 2 && targetToken.startsWith(queryToken)) return 0.9
  if (shorterLength >= 4 && queryToken.startsWith(targetToken)) return 0.88

  if (shorterLength < 5) return null
  const shared = commonPrefixLength(queryToken, targetToken)
  const required = Math.max(4, shorterLength - 2)
  if (shared >= required) return 0.75
  return isSingleTypo(queryToken, targetToken) ? 0.65 : null
}

function tokenMatchQuality(queryTokens: string[], targetTokens: string[]): number | null {
  let total = 0
  for (const queryToken of queryTokens) {
    let best = 0
    for (const targetToken of targetTokens) {
      best = Math.max(best, tokenSimilarity(queryToken, targetToken) ?? 0)
    }
    if (best === 0) return null
    total += best
  }
  return total / queryTokens.length
}

interface ScoreBand {
  exact: number
  prefix: number
  tokens: number
}

// Непересекающиеся диапазоны фиксируют продуктовый приоритет независимо от
// качества совпадения внутри поля: title > address > category/district.
const TITLE_SCORE: ScoreBand = { exact: 1000, prefix: 900, tokens: 700 }
const ADDRESS_SCORE: ScoreBand = { exact: 600, prefix: 550, tokens: 500 }
const META_SCORE: ScoreBand = { exact: 400, prefix: 350, tokens: 300 }

function rankField(
  normalizedQuery: string,
  meaningfulQueryTokens: string[],
  rawTarget: string | null | undefined,
  band: ScoreBand
): number | null {
  if (!rawTarget) return null
  const normalizedTarget = normalizeSearchText(rawTarget)
  if (!normalizedTarget) return null

  if (normalizedTarget === normalizedQuery) return band.exact
  if (normalizedTarget.startsWith(normalizedQuery)) return band.prefix

  const quality = tokenMatchQuality(meaningfulQueryTokens, tokens(normalizedTarget))
  if (quality === null) return null
  return band.tokens + Math.round(quality * 99)
}

/**
 * Возвращает устойчивый rank для сортировки по убыванию или null, если запись
 * не соответствует запросу. Шкала намеренно разрежена: точное название выше
 * префикса/токенов названия, затем идут адрес и категория/округ.
 */
export function rankSearchMatch(query: string, target: SearchMatchTarget): number | null {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return null

  const meaningfulQueryTokens = tokens(normalizedQuery).filter(
    (token) => !SEARCH_STOP_WORDS.has(token)
  )
  if (meaningfulQueryTokens.length === 0) return null

  const scores = [
    rankField(normalizedQuery, meaningfulQueryTokens, target.title, TITLE_SCORE),
    rankField(normalizedQuery, meaningfulQueryTokens, target.address, ADDRESS_SCORE),
    rankField(normalizedQuery, meaningfulQueryTokens, target.category, META_SCORE),
    rankField(normalizedQuery, meaningfulQueryTokens, target.district, META_SCORE),
  ].filter((score): score is number => score !== null)

  return scores.length ? Math.max(...scores) : null
}
