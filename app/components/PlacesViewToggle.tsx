'use client'

export type PlacesView = 'map' | 'list'

interface Props {
  active: PlacesView
  onChange: (view: PlacesView) => void
}

/** Переключатель доступного представления одного и того же набора мест. */
export default function PlacesViewToggle({ active, onChange }: Props) {
  return (
    <nav
      data-places-view-toggle
      className="places-view-toggle panel"
      aria-label="Представление памятных мест"
    >
      <button
        type="button"
        data-places-view-map
        onClick={() => onChange('map')}
        aria-current={active === 'map' ? 'page' : undefined}
        className={`places-view-toggle__item ${active === 'map' ? 'places-view-toggle__item--active' : ''}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 3v15m8-12v15" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        Карта
      </button>
      <button
        type="button"
        data-places-view-list
        onClick={() => onChange('list')}
        aria-current={active === 'list' ? 'page' : undefined}
        className={`places-view-toggle__item ${active === 'list' ? 'places-view-toggle__item--active' : ''}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="4.5" cy="6" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1.5" fill="currentColor" />
        </svg>
        Список
      </button>
    </nav>
  )
}
