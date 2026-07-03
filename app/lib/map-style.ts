import type { StyleSpecification } from 'maplibre-gl'

export const TYUMEN_CENTER: [number, number] = [65.534, 57.152]

/**
 * Временная растровая подложка — ТОЛЬКО для разработки (фаза 3),
 * пока не собран tiles/data/tyumen.pmtiles. В проде внешние тайлы не используются.
 */
export const FALLBACK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© участники OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export interface ResolvedStyle {
  style: string | StyleSpecification
  /** шрифты для подписей поверх карты (кластеры, округа) */
  labelFont: string[]
  isFallback: boolean
}

/** PMTiles-стиль, если файл подложки существует; иначе dev-fallback на растровый OSM */
export async function resolveMapStyle(): Promise<ResolvedStyle> {
  try {
    const head = await fetch('/tiles/tyumen.pmtiles', { method: 'HEAD' })
    if (head.ok) {
      return { style: '/map-style.json', labelFont: ['Noto Sans Bold'], isFallback: false }
    }
  } catch {
    // файла нет — используем fallback
  }
  return { style: FALLBACK_RASTER_STYLE, labelFont: ['Open Sans Semibold'], isFallback: true }
}
