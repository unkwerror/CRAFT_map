'use client'

import { useEffect, useId, useState } from 'react'
import type { DescriptionSection } from '@/lib/types'

interface Props {
  objectId: string
  description: string | null
  sections: DescriptionSection[]
}

function descriptionPreview(text: string): string {
  const firstLines = text.split('\n').slice(0, 6).join('\n')
  const candidate = firstLines.length < text.length ? firstLines : text
  if (candidate.length <= 420) {
    return candidate.length < text.length ? `${candidate.trimEnd()}…` : candidate
  }
  const clipped = candidate.slice(0, 420).replace(/\s+\S*$/u, '').trimEnd()
  return `${clipped || candidate.slice(0, 420)}…`
}

/** Длинные тексты раскрываются постепенно, а разделы работают как компактный accordion. */
export default function ObjectSections({ objectId, description, sections }: Props) {
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [openSection, setOpenSection] = useState<number | null>(null)
  const baseId = useId()
  const longDescription = (description?.length ?? 0) > 420 || (description?.split('\n').length ?? 0) > 6
  const visibleDescription = description && longDescription && !descriptionOpen
    ? descriptionPreview(description)
    : description

  useEffect(() => {
    setDescriptionOpen(false)
    setOpenSection(null)
  }, [objectId])

  if (!description && sections.length === 0) return null

  return (
    <section className="object-story" aria-labelledby={`${baseId}-title`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id={`${baseId}-title`} className="text-base font-semibold">О памятнике</h3>
        {sections.length > 0 && <span className="text-[11px] text-[var(--ink-subtle)]">Разделов: {sections.length}</span>}
      </div>

      {description && (
        <div className="rounded-2xl border border-[var(--hairline)] bg-white/[0.025] p-3.5">
          <p
            id={`${baseId}-description`}
            className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/84"
          >
            {visibleDescription}
          </p>
          {longDescription && (
            <button
              type="button"
              onClick={() => setDescriptionOpen((open) => !open)}
              aria-expanded={descriptionOpen}
              aria-controls={`${baseId}-description`}
              className="mt-2 min-h-9 text-xs font-semibold text-[var(--accent)]"
            >
              {descriptionOpen ? 'Свернуть' : 'Читать полностью'}
            </button>
          )}
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-2.5 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white/[0.025]">
          {sections.map((section, index) => {
            const open = openSection === index
            const contentId = `${baseId}-section-${index}`
            return (
              <div key={`${section.title}-${index}`} className="object-disclosure border-b border-white/[0.07] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenSection(open ? null : index)}
                  aria-expanded={open}
                  aria-controls={contentId}
                  className="flex min-h-12 w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left text-sm font-semibold"
                >
                  <span>{section.title}</span>
                  <span className={`object-disclosure__chevron ${open ? 'object-disclosure__chevron--open' : ''}`} aria-hidden>⌄</span>
                </button>
                {open && (
                  <div id={contentId} className="object-reveal px-3.5 pb-4">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/82">{section.text}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
