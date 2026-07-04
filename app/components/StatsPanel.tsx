'use client'

import type { StatRow } from '@/lib/types'

interface Props {
  stats: StatRow[]
  onDistrictClick: (name: string) => void
}

/** Проценты по округам — горизонтальные плашки, клик по названию → fitBounds */
export default function StatsPanel({ stats, onDistrictClick }: Props) {
  const total = stats.reduce((s, r) => s + r.cnt, 0)
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="eyebrow">Объекты по округам</h3>
        <span className="text-xs text-[var(--ink-subtle)]">{total} всего</span>
      </div>
      <ul className="space-y-2.5">
        {stats.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              onClick={() => onDistrictClick(r.name)}
              className="group block w-full text-left"
              title={`Показать ${r.name} округ на карте`}
            >
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-[var(--ink)]/85 underline-offset-2 group-hover:underline">
                  {r.name}
                </span>
                <span className="tabular-nums text-[var(--ink-muted)]">
                  {r.cnt} · {r.pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/35 transition-all duration-500 group-hover:bg-[var(--accent)]"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
