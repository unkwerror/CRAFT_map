'use client'

import { useState } from 'react'
import { publicSiteOrigin } from '@/lib/seo'

export default function ShareButton({ title, label = 'Поделиться' }: { title: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const current = new URL(window.location.href)
    const url = `${publicSiteOrigin(current.origin)}${current.pathname}${current.search}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Скопируйте ссылку', url)
    }
  }

  return (
    <>
      <button type="button" onClick={() => void share()} className="btn-ghost min-h-11 rounded-xl px-4 text-sm">
        {copied ? 'Ссылка скопирована' : label}
      </button>
      {/* Смена текста кнопки не озвучивается скринридером — дублируем в live region. */}
      <span aria-live="polite" className="sr-only">{copied ? 'Ссылка скопирована' : ''}</span>
    </>
  )
}
