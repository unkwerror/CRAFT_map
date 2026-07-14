interface Props {
  progress?: number
  /** Честный indeterminate-бар вместо фиктивного процента загрузки. */
  indeterminate?: boolean
  label?: string
  leaving?: boolean
}

/** Полноэкранное состояние загрузки карты: используется и серверным loading.tsx. */
export default function MapPreloader({
  progress = 18,
  indeterminate = false,
  label = 'Подготавливаем карту',
  leaving = false,
}: Props) {
  return (
    <div
      className={`map-preloader ${leaving ? 'map-preloader--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="map-preloader__glow" aria-hidden />
      <div className="map-preloader__content">
        <div className="map-preloader__mark" aria-hidden>
          <span className="map-preloader__ring" />
          <span className="map-preloader__dot" />
        </div>
        <p className="map-preloader__title">Память Тюмени</p>
        <p className="map-preloader__label">{label}</p>
        <div
          className={`map-preloader__track ${indeterminate ? 'map-preloader__track--indeterminate' : ''}`}
          aria-hidden
        >
          <span style={indeterminate ? undefined : { width: `${Math.max(8, Math.min(progress, 100))}%` }} />
        </div>
      </div>
    </div>
  )
}
