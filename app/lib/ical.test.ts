import { describe, expect, it } from 'vitest'
import { createEventCalendar, type CalendarEvent } from './ical'

const base: CalendarEvent = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Лекция, встреча',
  description: 'Первая строка\nВторая строка',
  startsOn: '2026-07-18',
  endsOn: '2026-07-18',
  startsAt: '18:30',
  endsAt: '20:00',
  timezone: 'Asia/Yekaterinburg',
  venue: 'Зал; №1',
  address: 'ул. Республики, 1',
  organizer: 'Музей',
  status: 'scheduled',
  url: 'https://example.test/event/1',
}

describe('createEventCalendar', () => {
  it('creates a timed event with escaped text and local timezone', () => {
    const value = createEventCalendar(base, new Date('2026-07-13T00:00:00Z'))
    expect(value).toContain('DTSTART;TZID=Asia/Yekaterinburg:20260718T183000')
    expect(value).toContain('DTEND;TZID=Asia/Yekaterinburg:20260718T200000')
    expect(value).toContain('SUMMARY:Лекция\\, встреча')
    expect(value).toContain('LOCATION:Зал\\; №1\\, ул. Республики\\, 1')
    expect(value).toContain('STATUS:CONFIRMED')
  })

  it('uses exclusive end date for all-day events and exposes cancellation', () => {
    const value = createEventCalendar(
      { ...base, startsAt: null, endsAt: null, endsOn: '2026-07-19', status: 'cancelled' },
      new Date('2026-07-13T00:00:00Z')
    )
    expect(value).toContain('DTSTART;VALUE=DATE:20260718')
    expect(value).toContain('DTEND;VALUE=DATE:20260720')
    expect(value).toContain('STATUS:CANCELLED')
  })
})
