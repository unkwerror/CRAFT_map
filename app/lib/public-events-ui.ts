import { normalizeSearchText } from './map-search'
import type { PublicEventDto } from './types'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

interface DateParts {
  year: number
  month: number
  day: number
}

export interface PublicEventGroup {
  key: string
  title: string
  today: boolean
  events: PublicEventDto[]
}

export type EventPeriod = 'all' | 'today' | 'weekend' | 'month'

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return { year, month, day }
}

function isoToUtc(value: string): Date | null {
  const parts = parseIsoDate(value)
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : null
}

function utcToIso(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function shiftUtcDate(value: Date, days: number): Date {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export function formatEventDates(startsOn: string, endsOn: string): string {
  const start = parseIsoDate(startsOn)
  const end = parseIsoDate(endsOn)
  if (!start || !end) return startsOn === endsOn ? startsOn : `${startsOn} — ${endsOn}`

  const startMonth = MONTHS_GENITIVE[start.month - 1]
  const endMonth = MONTHS_GENITIVE[end.month - 1]
  if (startsOn === endsOn) return `${start.day} ${startMonth} ${start.year}`
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${endMonth} ${end.year}`
  }
  if (start.year === end.year) {
    return `${start.day} ${startMonth} — ${end.day} ${endMonth} ${end.year}`
  }
  return `${start.day} ${startMonth} ${start.year} — ${end.day} ${endMonth} ${end.year}`
}

export function formatEventTime(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt) return null
  return endsAt ? `${startsAt}–${endsAt}` : startsAt
}

/** Даты для schema.org: не публикуем полночь как ложное окончание timed-события. */
export function eventSchemaDateTimes(
  startsOn: string,
  endsOn: string,
  startsAt: string | null,
  endsAt: string | null
): { startDate: string; endDate?: string } {
  const startDate = startsAt ? `${startsOn}T${startsAt}:00+05:00` : startsOn
  if (startsAt && !endsAt) return { startDate }
  return {
    startDate,
    endDate: endsAt ? `${endsOn}T${endsAt}:00+05:00` : endsOn,
  }
}

function monthLabel(iso: string): string {
  const date = parseIsoDate(iso)
  if (!date) return 'Ближайшие'
  return `${MONTHS_NOMINATIVE[date.month - 1]} ${date.year}`
}

function eventSearchText(event: PublicEventDto): string {
  return normalizeSearchText(
    [
      event.title,
      event.description,
      event.objectTitle,
      event.categoryTitle,
      event.address,
      event.districtName,
      event.venue,
      event.organizer,
      event.priceInfo,
    ]
      .filter(Boolean)
      .join(' ')
  )
}

/** Фильтр афиши относительно календарной даты Тюмени. */
export function filterPublicEventsByPeriod(
  events: PublicEventDto[],
  period: EventPeriod,
  todayIso: string
): PublicEventDto[] {
  if (period === 'all') return events
  const today = isoToUtc(todayIso)
  if (!today) return events

  let rangeStart = todayIso
  let rangeEnd = todayIso
  if (period === 'weekend') {
    const weekday = today.getUTCDay()
    const untilSaturday = weekday === 0 ? -1 : (6 - weekday + 7) % 7
    rangeStart = utcToIso(shiftUtcDate(today, untilSaturday))
    rangeEnd = utcToIso(shiftUtcDate(isoToUtc(rangeStart) ?? today, 1))
  } else if (period === 'month') {
    rangeStart = `${todayIso.slice(0, 7)}-01`
    rangeEnd = utcToIso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)))
  }

  return events.filter((event) => event.startsOn <= rangeEnd && event.endsOn >= rangeStart)
}

/** Поиск по мероприятию, памятнику, категории, округу и адресу. */
export function filterPublicEvents(events: PublicEventDto[], query: string): PublicEventDto[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return events
  return events.filter((event) => eventSearchText(event).includes(normalizedQuery))
}

function compareEvents(left: PublicEventDto, right: PublicEventDto): number {
  if (left.isToday !== right.isToday) return left.isToday ? -1 : 1
  return (
    left.startsOn.localeCompare(right.startsOn) ||
    (left.startsAt ?? '99:99').localeCompare(right.startsAt ?? '99:99') ||
    left.endsOn.localeCompare(right.endsOn) ||
    left.id.localeCompare(right.id)
  )
}

/** Группировка не зависит от порядка ответа и не мутирует исходный массив. */
export function groupPublicEvents(events: PublicEventDto[]): PublicEventGroup[] {
  const groups = new Map<string, PublicEventGroup>()
  for (const event of [...events].sort(compareEvents)) {
    const key = event.isToday ? 'today' : event.startsOn.slice(0, 7)
    const current = groups.get(key)
    if (current) {
      current.events.push(event)
      continue
    }
    groups.set(key, {
      key,
      title: event.isToday ? 'Сегодня' : monthLabel(event.startsOn),
      today: event.isToday,
      events: [event],
    })
  }
  return [...groups.values()]
}

export function eventsWord(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'мероприятий'
  if (mod10 === 1) return 'мероприятие'
  if (mod10 >= 2 && mod10 <= 4) return 'мероприятия'
  return 'мероприятий'
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isEventStatus(value: unknown): value is PublicEventDto['status'] {
  return value === 'scheduled' || value === 'postponed' || value === 'cancelled'
}

function isPublicEvent(value: unknown): value is PublicEventDto {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<Record<keyof PublicEventDto, unknown>>
  return (
    isString(event.id) &&
    isString(event.title) &&
    isNullableString(event.description) &&
    isString(event.startsOn) &&
    ISO_DATE_RE.test(event.startsOn) &&
    isString(event.endsOn) &&
    ISO_DATE_RE.test(event.endsOn) &&
    isNullableString(event.startsAt) &&
    isNullableString(event.endsAt) &&
    isString(event.timezone) &&
    isNullableString(event.venue) &&
    isNullableString(event.organizer) &&
    isNullableString(event.priceInfo) &&
    isNullableString(event.registrationUrl) &&
    isNullableString(event.accessibility) &&
    isEventStatus(event.status) &&
    typeof event.isToday === 'boolean' &&
    isString(event.objectId) &&
    isString(event.objectTitle) &&
    isString(event.categoryTitle) &&
    isString(event.categoryColor) &&
    isNullableString(event.address) &&
    isNullableString(event.districtName) &&
    isString(event.thumb)
  )
}

/** Runtime-проверка защищает UI от повреждённого или неожиданного ответа. */
export function parsePublicEventsResponse(value: unknown): PublicEventDto[] | null {
  if (!Array.isArray(value) || !value.every(isPublicEvent)) return null
  return value
}
