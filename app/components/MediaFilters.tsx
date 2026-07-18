'use client'

export type MediaFilter = 'audio' | 'video' | '3d'

interface Props {
  active: ReadonlySet<MediaFilter>
  onToggle: (filter: MediaFilter) => void
}

/** Чипы форматов медиа под категориями: аудио, видео и 3D-модели. */
export default function MediaFilters({ active, onToggle }: Props) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Фильтры по форматам">
      {([['audio', 'С аудио'], ['video', 'С видео'], ['3d', 'С 3D']] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={active.has(id)}
          onClick={() => onToggle(id)}
          className={`category-chip panel flex h-10 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${
            active.has(id)
              ? 'category-chip--district text-[var(--accent)]'
              : 'text-[var(--ink-subtle)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
