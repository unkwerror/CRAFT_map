export interface Photo {
  original: string
  thumb: string
  alt?: string
}

export interface Video {
  src: string
  /** превью-кадр (постер), опционально */
  poster?: string
  alt?: string
}

/** Секция описания («Архитектура», «История», …) — структура расширяемая */
export interface DescriptionSection {
  title: string
  text: string
}

/** Мероприятие у памятника (вводится администратором вручную) */
export interface EventDto {
  id: string
  title: string
  description: string | null
  /** YYYY-MM-DD */
  startsOn: string
  endsOn: string
  /** идёт сегодня (по тюменскому времени, считает сервер) */
  isToday: boolean
}

export interface CategoryDto {
  id: string
  title: string
  color: string
}

export interface DistrictDto {
  id: number
  name: string
  geometry: GeoJSON.MultiPolygon
}

export interface StatRow {
  name: string
  cnt: number
  pct: number
}

/** properties фич в GeoJSON публичного API объектов */
export interface ObjectFeatureProps {
  id: string
  title: string
  category: string
  district: number | null
  thumb: string
  /** у объекта есть мероприятие на сегодняшнюю дату — маркер пульсирует */
  hasEvent: boolean
}

export interface ObjectFull {
  id: string
  title: string
  description: string | null
  categoryId: string
  categoryTitle: string
  categoryColor: string
  districtName: string | null
  address: string | null
  lng: number
  lat: number
  photos: Photo[]
  videos: Video[]
  audioUrl: string | null
  /** текстовая версия аудиогида */
  audioText: string | null
  /** 0–5 с шагом 0.1; источник рейтинга не решён — пока проставляется в админке */
  rating: number | null
  sections: DescriptionSection[]
  modelUrl: string | null
  published: boolean
  /** приоритет показа на карте */
  sortWeight: number
  /** текущие и ближайшие мероприятия у объекта */
  events: EventDto[]
}

export interface AdminEventRow {
  id: string
  objectId: string
  objectTitle: string
  title: string
  description: string | null
  startsOn: string
  endsOn: string
}

export interface AdminObjectRow {
  id: string
  title: string
  categoryId: string
  districtName: string | null
  address: string | null
  published: boolean
  sortWeight: number
  photoCount: number
  updatedAt: string
}

export type GeocodeStatus = 'pending' | 'high' | 'medium' | 'failed' | 'verified'

/** Строка режима «Проверка импорта» (объекты из monuments.json) */
export interface ImportReviewRow {
  id: string
  sourceId: number
  title: string
  description: string | null
  categoryId: string
  address: string | null
  /** округ, заявленный на доске КРАФТ */
  importDistrict: string | null
  /** округ по факту (ST_Contains по координате) */
  districtName: string | null
  lng: number | null
  lat: number | null
  geocodeStatus: GeocodeStatus
  geocodeQuery: string | null
  geocodeNote: string | null
  importFlags: string[]
  photos: Photo[]
  published: boolean
  /** объекты ближе 100 м — кандидаты в дубли */
  nearby: { id: string; sourceId: number | null; title: string; dist: number }[]
}

export interface UserRow {
  id: string
  email: string
  role: 'admin' | 'editor'
}
