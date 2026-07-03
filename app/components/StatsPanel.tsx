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
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Объекты по округам
        </h3>
        <span className="text-xs text-white/40">{total} всего</span>
      </div>
      <ul className="space-y-1.5">
        {stats.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              onClick={() => onDistrictClick(r.name)}
              className="group block w-full text-left"
              title={`Показать ${r.name} округ на карте`}
            >
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-white/85 underline-offset-2 group-hover:underline">
                  {r.name}
                </span>
                <span className="tabular-nums text-white/60">
                  {r.cnt} · {r.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#7fa8d0] transition-all duration-500"
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
