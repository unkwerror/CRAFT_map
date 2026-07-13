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

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
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
    ]
      .filter(Boolean)
      .join(' ')
  )
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
