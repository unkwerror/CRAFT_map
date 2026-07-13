import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Память Тюмени — карта памятных объектов',
    short_name: 'Память Тюмени',
    description:
      'Интерактивная карта памятников, памятных мест и городских историй Тюмени.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0c1822',
    theme_color: '#0c1822',
    lang: 'ru',
    categories: ['education', 'travel', 'navigation'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Открыть карту памятных мест',
        short_name: 'Карта',
        description: 'Перейти к интерактивной карте Тюмени',
        url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      {
        name: 'Предстоящие мероприятия',
        short_name: 'Мероприятия',
        description: 'Открыть городскую афишу памятных мест',
        url: '/?view=events',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    ],
  }
}
