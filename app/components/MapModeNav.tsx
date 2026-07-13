'use client'

export type MapViewMode = 'map' | 'events'
export type MapNavigationMode = MapViewMode | 'list'

interface Props {
  active: MapNavigationMode
  onChange: (mode: MapNavigationMode) => void
  className?: string
}

/** Единая навигация публичной карты: карта, список мест и общая афиша. */
export default function MapModeNav({ active, onChange, className = '' }: Props) {
  return (
    <nav
      className={`map-mode-nav panel ${className}`}
      aria-label="Разделы карты"
    >
      <button
        type="button"
        data-map-mode-map
        data-places-view-map
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
        data-map-mode-list
        data-places-view-list
        onClick={() => onChange('list')}
        aria-current={active === 'list' ? 'page' : undefined}
        className={`map-mode-nav__item ${active === 'list' ? 'map-mode-nav__item--active' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="4.5" cy="6" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1.5" fill="currentColor" />
        </svg>
        <span>Список</span>
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
