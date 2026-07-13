import { describe, expect, it } from 'vitest'
import {
  eventSchemaDateTimes,
  filterPublicEvents,
  filterPublicEventsByPeriod,
  formatEventDates,
  formatEventTime,
  groupPublicEvents,
  parsePublicEventsResponse,
} from './public-events-ui'
import type { PublicEventDto } from './types'

function makeEvent(overrides: Partial<PublicEventDto> = {}): PublicEventDto {
  return {
    id: 'event-b',
    title: 'Встреча у памятника',
    description: null,
    startsOn: '2026-08-10',
    endsOn: '2026-08-10',
    startsAt: '18:30',
    endsAt: '20:00',
    timezone: 'Asia/Yekaterinburg',
    venue: 'Городская площадь',
    organizer: 'Музей истории',
    priceInfo: 'Бесплатно',
    registrationUrl: null,
    accessibility: null,
    status: 'scheduled',
    isToday: false,
    objectId: 'object-1',
    objectTitle: 'Памятник героям',
    categoryTitle: 'Историческая память',
    categoryColor: '#d97706',
    address: 'ул. Республики, 22',
    districtName: 'Центральный',
    thumb: '/uploads/thumb.webp',
    ...overrides,
  }
}

describe('formatEventDates', () => {
  it('formats a single date and a range in one month', () => {
    expect(formatEventDates('2026-07-13', '2026-07-13')).toBe('13 июля 2026')
    expect(formatEventDates('2026-07-13', '2026-07-15')).toBe('13–15 июля 2026')
  })

  it('formats ranges across months and years', () => {
    expect(formatEventDates('2026-07-30', '2026-08-02')).toBe('30 июля — 2 августа 2026')
    expect(formatEventDates('2026-12-31', '2027-01-02')).toBe(
      '31 декабря 2026 — 2 января 2027'
    )
  })

  it('falls back safely for an unexpected date format', () => {
    expect(formatEventDates('13.07.2026', '14.07.2026')).toBe(
      '13.07.2026 — 14.07.2026'
    )
  })
})

describe('formatEventTime', () => {
  it('formats start time with and without an end', () => {
    expect(formatEventTime('18:30', '20:00')).toBe('18:30–20:00')
    expect(formatEventTime('18:30', null)).toBe('18:30')
    expect(formatEventTime(null, null)).toBeNull()
  })
})

describe('eventSchemaDateTimes', () => {
  it('omits an incorrect midnight end for a timed event without end time', () => {
    expect(eventSchemaDateTimes('2026-07-18', '2026-07-18', '18:00', null)).toEqual({
      startDate: '2026-07-18T18:00:00+05:00',
    })
  })

  it('keeps explicit timed and all-day ranges', () => {
    expect(eventSchemaDateTimes('2026-07-18', '2026-07-18', '18:00', '20:00')).toEqual({
      startDate: '2026-07-18T18:00:00+05:00',
      endDate: '2026-07-18T20:00:00+05:00',
    })
    expect(eventSchemaDateTimes('2026-07-18', '2026-07-19', null, null)).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-19',
    })
  })
})

describe('public event search', () => {
  it('ignores punctuation, repeated spaces, case and ё/е', () => {
    const events = [
      makeEvent({ title: 'Новогодняя ёлка' }),
      makeEvent({ id: 'event-c', address: null, districtName: null }),
    ]

    expect(filterPublicEvents(events, '  РЕСПУБЛИКИ   22  ').map((event) => event.id)).toEqual([
      'event-b',
    ])
    expect(filterPublicEvents(events, 'елка').map((event) => event.id)).toEqual(['event-b'])
  })
})

describe('public event period filters', () => {
  const events = [
    makeEvent({ id: 'today', startsOn: '2026-07-13', endsOn: '2026-07-13' }),
    makeEvent({ id: 'weekend', startsOn: '2026-07-18', endsOn: '2026-07-19' }),
    makeEvent({ id: 'month', startsOn: '2026-07-30', endsOn: '2026-08-02' }),
    makeEvent({ id: 'later', startsOn: '2026-09-01', endsOn: '2026-09-01' }),
  ]

  it('filters today, the nearest weekend and the current month', () => {
    expect(filterPublicEventsByPeriod(events, 'today', '2026-07-13').map((event) => event.id)).toEqual(['today'])
    expect(filterPublicEventsByPeriod(events, 'weekend', '2026-07-13').map((event) => event.id)).toEqual(['weekend'])
    expect(filterPublicEventsByPeriod(events, 'month', '2026-07-13').map((event) => event.id)).toEqual(['today', 'weekend', 'month'])
  })
})

describe('public event grouping', () => {
  it('sorts today first, keeps stable date ordering and creates one group per month', () => {
    const source = [
      makeEvent({ id: 'august-b', startsOn: '2026-08-10' }),
      makeEvent({ id: 'september', startsOn: '2026-09-01', endsOn: '2026-09-02' }),
      makeEvent({ id: 'today', startsOn: '2026-07-12', endsOn: '2026-07-14', isToday: true }),
      makeEvent({ id: 'august-a', startsOn: '2026-08-10' }),
    ]
    const originalOrder = source.map((event) => event.id)

    const groups = groupPublicEvents(source)

    expect(groups.map((group) => group.key)).toEqual(['today', '2026-08', '2026-09'])
    expect(groups[1]?.events.map((event) => event.id)).toEqual(['august-a', 'august-b'])
    expect(source.map((event) => event.id)).toEqual(originalOrder)
  })
})

describe('parsePublicEventsResponse', () => {
  it('accepts an empty list and complete events', () => {
    expect(parsePublicEventsResponse([])).toEqual([])
    const event = makeEvent()
    expect(parsePublicEventsResponse([event])).toEqual([event])
  })

  it('rejects malformed payloads before the UI renders them', () => {
    expect(parsePublicEventsResponse({})).toBeNull()
    expect(parsePublicEventsResponse([null])).toBeNull()
    expect(parsePublicEventsResponse([{}])).toBeNull()
    const { startsOn: _startsOn, ...withoutDate } = makeEvent()
    expect(parsePublicEventsResponse([withoutDate])).toBeNull()
  })
})
