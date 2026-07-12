/** Ячейка CSV для Excel: экранирование разделителей и нейтрализация формул. */
export function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value)
  if (/^[=+@-]/.test(text)) text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
