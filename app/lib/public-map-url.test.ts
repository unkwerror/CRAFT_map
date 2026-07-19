import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUBLIC_MAP_URL_STATE,
  decodeMapUrl,
  encodeMapUrl,
} from './public-map-url'

describe('decodeMapUrl', () => {
  it('returns safe defaults for an empty query', () => {
    expect(decodeMapUrl('')).toEqual(DEFAULT_PUBLIC_MAP_URL_STATE)
  })

  it('parses every supported public map parameter', () => {
    const state = decodeMapUrl(
      '?view=list&object=place-42&category=war&category=art&category=war' +
      '&district=4&media=video&media=audio' +
      '&q=%D0%9F%D1%91%D1%82%D1%80+%D0%9F%D0%B5%D1%80%D0%B2%D1%8B%D0%B9' +
      '&lng=65.5343167&lat=57.1529876&zoom=11.346&bearing=-12.34&pitch=48.06'
    )

    expect(state).toEqual({
      view: 'list',
      objectId: 'place-42',
      categoryIds: ['art', 'war'],
      districtId: 4,
      mediaTypes: ['audio', 'video'],
      searchQuery: 'Пётр Первый',
      routeSlug: null,
      personSlug: null,
      center: { lng: 65.53432, lat: 57.15299 },
      zoom: 11.35,
      bearing: -12.3,
      pitch: 48.1,
    })
  })

  it('ignores malformed, partial, out-of-range and unknown values', () => {
    expect(decodeMapUrl(
      '?view=globe&object=%00bad&district=2.5&media=hologram&media=&q=++' +
      '&lng=65.5&lat=not-a-number&zoom=20&bearing=181&pitch=-1&unknown=value'
    )).toEqual(DEFAULT_PUBLIC_MAP_URL_STATE)
  })

  it('keeps a deliberately empty category selection distinct from no filter', () => {
    expect(decodeMapUrl('').categoryIds).toBeNull()
    expect(decodeMapUrl('?category=').categoryIds).toEqual([])
  })

  it('accepts media types as repeated keys and as a comma-separated list', () => {
    expect(decodeMapUrl('?media=video&media=3d&media=video').mediaTypes)
      .toEqual(['3d', 'video'])
    expect(decodeMapUrl('?media=video,audio,%20audio,laser').mediaTypes)
      .toEqual(['audio', 'video'])
    expect(decodeMapUrl('').mediaTypes).toEqual([])
  })

  it.each(['map', 'events', 'list'] as const)('accepts the %s view', (view) => {
    expect(decodeMapUrl(`?view=${view}`).view).toBe(view)
  })
})

describe('encodeMapUrl', () => {
  it('uses stable key order, sorted categories and reasonable camera precision', () => {
    const query = encodeMapUrl('', {
      view: 'list',
      objectId: ' place-42 ',
      categoryIds: ['war', 'art', 'war'],
      districtId: 4,
      mediaTypes: ['video', 'audio', 'video'],
      searchQuery: ' Пётр Первый ',
      center: { lng: 65.5343167, lat: 57.1529876 },
      zoom: 11.346,
      bearing: -12.34,
      pitch: 48.06,
    }).toString()

    expect(query).toBe(
      'view=list&object=place-42&category=art&category=war&district=4' +
      '&media=audio&media=video' +
      '&q=%D0%9F%D1%91%D1%82%D1%80+%D0%9F%D0%B5%D1%80%D0%B2%D1%8B%D0%B9' +
      '&lng=65.53432&lat=57.15299&zoom=11.35&bearing=-12.3&pitch=48.1'
    )
  })

  it('omits the default map view and invalid runtime values', () => {
    expect(encodeMapUrl('', {
      view: 'map',
      districtId: -1,
      center: { lng: Number.NaN, lat: 57.15 },
      zoom: 100,
    }).toString()).toBe('')
  })

  it('round-trips through its canonical representation', () => {
    const original = decodeMapUrl(
      '?pitch=10.04&category=z&view=events&media=3d,audio&category=a&lng=65.5&lat=57.1&zoom=12'
    )
    const encoded = encodeMapUrl('', original)

    expect(encoded.toString()).toBe(
      'view=events&category=a&category=z&media=3d&media=audio&lng=65.5&lat=57.1&zoom=12&pitch=10'
    )
    expect(decodeMapUrl(encoded)).toEqual(original)
  })

  it('serializes an explicit empty category selection', () => {
    expect(encodeMapUrl('', { categoryIds: [] }).toString()).toBe('category=')
  })

  it('omits an empty or invalid media selection', () => {
    expect(encodeMapUrl('', { mediaTypes: [] }).toString()).toBe('')
    expect(encodeMapUrl('', {
      mediaTypes: ['laser' as never, 'audio'],
    }).toString()).toBe('media=audio')
  })

  it('preserves query parameters not owned by the map codec', () => {
    const encoded = encodeMapUrl(
      '?utm_source=city&feature=preview&object=old&category=old&view=events&media=3d',
      { view: 'list', objectId: 'new', categoryIds: null, mediaTypes: ['video'] }
    )

    expect(encoded.toString()).toBe(
      'utm_source=city&feature=preview&view=list&object=new&media=video'
    )
  })
})

describe('routes and people params', () => {
  it('принимает корректные slug маршрута и человека', () => {
    const state = decodeMapUrl('view=routes&route=demo-marshrut&person=ivan-kraeved')
    expect(state.view).toBe('routes')
    expect(state.routeSlug).toBe('demo-marshrut')
    expect(state.personSlug).toBe('ivan-kraeved')
  })

  it('отбрасывает мусорные slug', () => {
    const state = decodeMapUrl('route=..%2Fetc&person=%D0%98%D0%B2%D0%B0%D0%BD')
    expect(state.routeSlug).toBeNull()
    expect(state.personSlug).toBeNull()
  })

  it('кодирует route и person в канонический query', () => {
    const params = encodeMapUrl(new URLSearchParams('utm_source=qr'), {
      ...DEFAULT_PUBLIC_MAP_URL_STATE,
      view: 'people',
      personSlug: 'ivan-kraeved',
      routeSlug: 'demo-marshrut',
    })
    expect(params.get('view')).toBe('people')
    expect(params.get('route')).toBe('demo-marshrut')
    expect(params.get('person')).toBe('ivan-kraeved')
    expect(params.get('utm_source')).toBe('qr')
  })
})
