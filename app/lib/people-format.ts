/** Форматирование данных людей для публичных страниц («Люди в истории города»). */

export function lifeYears(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear !== null && deathYear !== null) return `${birthYear}—${deathYear}`
  if (birthYear !== null) return `род. ${birthYear}`
  if (deathYear !== null) return `ум. ${deathYear}`
  return null
}

export function verificationLabel(status: string): { text: string; verified: boolean } {
  if (status === 'verified') return { text: 'Проверено редакцией', verified: true }
  return { text: 'Сведения уточняются', verified: false }
}

/** Инициалы для аватара-заглушки: первые буквы двух первых слов имени. */
export function nameInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('ru-RU'))
    .join('')
}
