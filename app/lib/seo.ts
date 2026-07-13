export const SITE_URL = new URL('https://xn--80ayho4cq.site')

/** Приводит внутренние пути и URL загруженных файлов к абсолютному каноническому URL. */
export function absoluteSiteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

/**
 * Безопасная сериализация JSON-LD для inline-script: экранирование `<` не даёт
 * пользовательскому тексту преждевременно закрыть тег script.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
