export interface Photo {
  original: string
  thumb: string
  alt?: string
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
  published: boolean
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

export interface UserRow {
  id: string
  email: string
  role: 'admin' | 'editor'
}
