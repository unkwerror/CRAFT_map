/** Человекочитаемый канонический origin (IDN: память.site). */
export const SITE_ORIGIN = 'https://память.site'

/**
 * metadataBase / технические URL. Браузеры и Next нормализуют IDN в punycode
 * (xn--80ayho4cq.site) — это тот же домен, не «чужой» сайт.
 */
export const SITE_URL = new URL(SITE_ORIGIN)

/** Приводит внутренние пути к абсолютному URL с кириллическим доменом. */
export function absoluteSiteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_ORIGIN}${normalized}`
}

/** Origin для share/clipboard: предпочитает текущий host, если это наш домен. */
export function publicSiteOrigin(currentOrigin?: string): string {
  if (!currentOrigin) return SITE_ORIGIN
  try {
    const host = new URL(currentOrigin).hostname
    if (
      host === 'память.site' ||
      host === 'www.память.site' ||
      host === 'xn--80ayho4cq.site' ||
      host === 'www.xn--80ayho4cq.site'
    ) {
      return SITE_ORIGIN
    }
  } catch {
    // ignore
  }
  return currentOrigin
}

/**
 * Безопасная сериализация JSON-LD для inline-script: экранирование `<` не даёт
 * пользовательскому тексту преждевременно закрыть тег script.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
