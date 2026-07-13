export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startsOn: string
  endsOn: string
  startsAt: string | null
  endsAt: string | null
  timezone: string
  venue: string | null
  address: string | null
  organizer: string | null
  status: 'scheduled' | 'postponed' | 'cancelled'
  url: string
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function compactDate(value: string): string {
  return value.replaceAll('-', '')
}

function compactTime(value: string): string {
  return `${value.replace(':', '')}00`
}

function nextDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new Error('Invalid event date')
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10)
}

function utcStamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** RFC 5545 calendar document. DTEND для событий на весь день является исключающей датой. */
export function createEventCalendar(event: CalendarEvent, now = new Date()): string {
  const location = [event.venue, event.address].filter(Boolean).join(', ')
  const description = [event.description, event.organizer ? `Организатор: ${event.organizer}` : null]
    .filter(Boolean)
    .join('\n\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Карта памятных объектов Тюмени//Афиша//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@xn--80ayho4cq.site`,
    `DTSTAMP:${utcStamp(now)}`,
  ]

  if (event.startsAt) {
    lines.push(
      `DTSTART;TZID=${event.timezone}:${compactDate(event.startsOn)}T${compactTime(event.startsAt)}`
    )
    if (event.endsAt) {
      lines.push(
        `DTEND;TZID=${event.timezone}:${compactDate(event.endsOn)}T${compactTime(event.endsAt)}`
      )
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startsOn)}`)
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDate(event.endsOn))}`)
  }

  lines.push(`SUMMARY:${escapeIcs(event.title)}`)
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`)
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`)
  lines.push(`URL:${event.url}`)
  if (event.status === 'cancelled') lines.push('STATUS:CANCELLED')
  else if (event.status === 'postponed') lines.push('STATUS:TENTATIVE')
  else lines.push('STATUS:CONFIRMED')
  lines.push('END:VEVENT', 'END:VCALENDAR', '')
  return lines.join('\r\n')
}
