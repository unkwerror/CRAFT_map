import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/seo'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import WebVitals from '@/components/WebVitals'
import './globals.css'

const title = 'Память Тюмени — карта памятных объектов'
const description =
  'Интерактивная карта памятников и значимых мест Тюмени: патриотизм, историческая память, достоинство, преемственность поколений.'

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: title,
    template: '%s — Память Тюмени',
  },
  description,
  applicationName: 'Память Тюмени',
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: '/',
    siteName: 'Память Тюмени',
    title,
    description,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
  appleWebApp: {
    capable: true,
    title: 'Память Тюмени',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c1822',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <WebVitals />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
