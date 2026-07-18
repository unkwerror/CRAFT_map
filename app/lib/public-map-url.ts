export type PublicMapView = 'map' | 'events' | 'list'

export const PUBLIC_MAP_MEDIA_TYPES = ['audio', 'video', '3d'] as const

export type PublicMapMediaType = typeof PUBLIC_MAP_MEDIA_TYPES[number]

export interface PublicMapCenter {
  lng: number
  lat: number
}

export interface MapCameraState {
  center: PublicMapCenter | null
  zoom: number | null
  bearing: number | null
  pitch: number | null
}

/**
 * Состояние публичной карты, которое можно безопасно положить в query string.
 * `null` означает, что параметр не задан; для categoryIds пустой массив отдельно
 * обозначает явно скрытые пользователем категории. Для mediaTypes пустой массив
 * означает «фильтр форматов не задан» — отдельного явно пустого состояния нет.
 */
export interface PublicMapUrlState extends MapCameraState {
  view: PublicMapView
  objectId: string | null
  categoryIds: string[] | null
  districtId: number | null
  mediaTypes: PublicMapMediaType[]
  searchQuery: string | null
}

export type PublicMapUrlStateInput = Partial<PublicMapUrlState>

export const DEFAULT_PUBLIC_MAP_URL_STATE: Readonly<PublicMapUrlState> = {
  view: 'map',
  objectId: null,
  categoryIds: null,
  districtId: null,
  mediaTypes: [],
  searchQuery: null,
  center: null,
  zoom: null,
  bearing: null,
  pitch: null,
}

const VIEW_VALUES = new Set<PublicMapView>(['map', 'events', 'list'])
const MEDIA_TYPE_VALUES = new Set<string>(PUBLIC_MAP_MEDIA_TYPES)
const DECIMAL_NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/
const POSITIVE_INTEGER = /^\d+$/
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

const MAX_IDENTIFIER_LENGTH = 200
const MAX_SEARCH_LENGTH = 300
const MAX_CATEGORY_COUNT = 100

const OWNED_QUERY_KEYS = [
  'view',
  'object',
  'category',
  'district',
  'media',
  'q',
  'lng',
  'lat',
  'zoom',
  'bearing',
  'pitch',
] as const

const CAMERA_LIMITS = {
  lng: [-180, 180],
  lat: [-90, 90],
  zoom: [8, 19],
  bearing: [-180, 180],
  pitch: [0, 60],
} as const

const CAMERA_PRECISION = {
  lng: 5,
  lat: 5,
  zoom: 2,
  bearing: 1,
  pitch: 1,
} as const

function readView(value: unknown): PublicMapView {
  return typeof value === 'string' && VIEW_VALUES.has(value as PublicMapView)
    ? value as PublicMapView
    : 'map'
}

function readIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (
    !trimmed ||
    trimmed.length > MAX_IDENTIFIER_LENGTH ||
    CONTROL_CHARACTER.test(trimmed)
  ) return null
  return trimmed
}

function readSearchQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_SEARCH_LENGTH)
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function readCategoryIds(values: readonly unknown[]): string[] {
  const ids = values
    .map(readIdentifier)
    .filter((value): value is string => value !== null)
  return [...new Set(ids)].sort(compareStrings).slice(0, MAX_CATEGORY_COUNT)
}

/**
 * Канонический вид — повторяющиеся `media=`, как у `category=`. На вход также
 * принимаем запись через запятую (`media=audio,video`) из старых или ручных ссылок.
 */
function readMediaTypes(values: readonly unknown[]): PublicMapMediaType[] {
  const types = values
    .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    .map((value) => value.trim())
    .filter((value): value is PublicMapMediaType => MEDIA_TYPE_VALUES.has(value))
  return [...new Set(types)].sort(compareStrings)
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

function readBoundedNumber(
  value: unknown,
  limits: readonly [number, number],
  precision: number
): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!DECIMAL_NUMBER.test(raw)) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < limits[0] || parsed > limits[1]) return null
  return roundTo(parsed, precision)
}

function readDistrictId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!POSITIVE_INTEGER.test(raw)) return null
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function canonicalNumber(value: number): string {
  return String(Object.is(value, -0) ? 0 : value)
}

/**
 * Разбирает только известные параметры. Неизвестные или повреждённые значения
 * игнорируются, поэтому функция всегда возвращает полное безопасное состояние.
 */
export function decodeMapUrl(
  input: string | URLSearchParams
): PublicMapUrlState {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  const lng = readBoundedNumber(
    params.get('lng'),
    CAMERA_LIMITS.lng,
    CAMERA_PRECISION.lng
  )
  const lat = readBoundedNumber(
    params.get('lat'),
    CAMERA_LIMITS.lat,
    CAMERA_PRECISION.lat
  )

  return {
    view: readView(params.get('view')),
    objectId: readIdentifier(params.get('object')),
    categoryIds: params.has('category')
      ? readCategoryIds(params.getAll('category'))
      : null,
    districtId: readDistrictId(params.get('district')),
    mediaTypes: readMediaTypes(params.getAll('media')),
    searchQuery: readSearchQuery(params.get('q')),
    center: lng !== null && lat !== null ? { lng, lat } : null,
    zoom: readBoundedNumber(
      params.get('zoom'),
      CAMERA_LIMITS.zoom,
      CAMERA_PRECISION.zoom
    ),
    bearing: readBoundedNumber(
      params.get('bearing'),
      CAMERA_LIMITS.bearing,
      CAMERA_PRECISION.bearing
    ),
    pitch: readBoundedNumber(
      params.get('pitch'),
      CAMERA_LIMITS.pitch,
      CAMERA_PRECISION.pitch
    ),
  }
}

/**
 * Собирает канонический query в фиксированном порядке. Режим `map` и отсутствующие
 * значения не записываются; пустой `category=` сохраняет явный выбор «ни одной».
 */
function encodeOwnedMapUrlState(
  state: PublicMapUrlStateInput
): URLSearchParams {
  const params = new URLSearchParams()
  const view = readView(state.view)
  if (view !== 'map') params.set('view', view)

  const objectId = readIdentifier(state.objectId)
  if (objectId) params.set('object', objectId)

  if (Array.isArray(state.categoryIds)) {
    const categoryIds = readCategoryIds(state.categoryIds)
    if (categoryIds.length === 0) params.append('category', '')
    else categoryIds.forEach((id) => params.append('category', id))
  }

  const districtId = readDistrictId(state.districtId)
  if (districtId !== null) params.set('district', String(districtId))

  if (Array.isArray(state.mediaTypes)) {
    readMediaTypes(state.mediaTypes).forEach((type) => params.append('media', type))
  }

  const searchQuery = readSearchQuery(state.searchQuery)
  if (searchQuery) params.set('q', searchQuery)

  const lng = readBoundedNumber(
    state.center?.lng,
    CAMERA_LIMITS.lng,
    CAMERA_PRECISION.lng
  )
  const lat = readBoundedNumber(
    state.center?.lat,
    CAMERA_LIMITS.lat,
    CAMERA_PRECISION.lat
  )
  if (lng !== null && lat !== null) {
    params.set('lng', canonicalNumber(lng))
    params.set('lat', canonicalNumber(lat))
  }

  const zoom = readBoundedNumber(
    state.zoom,
    CAMERA_LIMITS.zoom,
    CAMERA_PRECISION.zoom
  )
  if (zoom !== null) params.set('zoom', canonicalNumber(zoom))

  const bearing = readBoundedNumber(
    state.bearing,
    CAMERA_LIMITS.bearing,
    CAMERA_PRECISION.bearing
  )
  if (bearing !== null) params.set('bearing', canonicalNumber(bearing))

  const pitch = readBoundedNumber(
    state.pitch,
    CAMERA_LIMITS.pitch,
    CAMERA_PRECISION.pitch
  )
  if (pitch !== null) params.set('pitch', canonicalNumber(pitch))

  return params
}

/**
 * Применяет состояние карты к существующему query. Параметры, которыми codec не
 * владеет (например, UTM-метки), сохраняются без изменений и в прежнем порядке.
 */
export function encodeMapUrl(
  base: string | URLSearchParams,
  state: PublicMapUrlStateInput
): URLSearchParams {
  const params = new URLSearchParams(
    typeof base === 'string' ? base : base.toString()
  )
  OWNED_QUERY_KEYS.forEach((key) => params.delete(key))
  encodeOwnedMapUrlState(state).forEach((value, key) => params.append(key, value))
  return params
}
