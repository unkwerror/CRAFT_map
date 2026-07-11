'use client'

import type { DescriptionSection } from '@/lib/types'

interface Props {
  sections: DescriptionSection[]
  onChange: (sections: DescriptionSection[]) => void
}

/** Секции описания («Архитектура», «История», …) — произвольный набор */
export default function SectionsEditor({ sections, onChange }: Props) {
  const update = (idx: number, patch: Partial<DescriptionSection>) =>
    onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)))

  const move = (idx: number, delta: -1 | 1) => {
    const next = [...sections]
    const a = next[idx]
    const b = next[idx + delta]
    if (!a || !b) return
    next[idx] = b
    next[idx + delta] = a
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <input
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Заголовок (например, «Архитектура»)"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-slate-500"
            />
            <div className="flex shrink-0 items-center gap-1 text-slate-500">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Выше"
                className="rounded px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} title="Ниже"
                className="rounded px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => onChange(sections.filter((_, j) => j !== i))} title="Убрать"
                className="rounded px-1.5 py-1 text-red-600 hover:bg-red-50">✕</button>
            </div>
          </div>
          <textarea
            value={s.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder="Текст секции…"
            rows={4}
            maxLength={10000}
            className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...sections, { title: '', text: '' }])}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
      >
        + Добавить секцию
      </button>
    </div>
  )
}
