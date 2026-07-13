'use client'

export type MapViewMode = 'map' | 'events'

interface Props {
  active: MapViewMode
  onChange: (mode: MapViewMode) => void
  className?: string
}

/** Основная навигация публичной карты: карта и общая афиша. */
export default function MapModeNav({ active, onChange, className = '' }: Props) {
  return (
    <nav
      className={`map-mode-nav panel ${className}`}
      aria-label="Разделы карты"
    >
      <button
        type="button"
        data-map-mode-map
        onClick={() => onChange('map')}
        aria-current={active === 'map' ? 'page' : undefined}
        className={`map-mode-nav__item ${active === 'map' ? 'map-mode-nav__item--active' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 3v15m8-12v15" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        <span>Карта</span>
      </button>
      <button
        type="button"
        data-map-mode-events
        onClick={() => onChange('events')}
        aria-current={active === 'events' ? 'page' : undefined}
        className={`map-mode-nav__item ${active === 'events' ? 'map-mode-nav__item--active' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M7 3v4m10-4v4M3 10h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 14h3m2 0h3m-8 3h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span>Мероприятия</span>
      </button>
    </nav>
  )
}
