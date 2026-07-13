import { z } from 'zod'

export const photoSchema = z.object({
  original: z.string().min(1).max(500),
  thumb: z.string().min(1).max(500),
  alt: z.string().max(300).optional(),
})

export const videoSchema = z.object({
  src: z.string().min(1).max(500),
  poster: z.string().max(500).optional(),
  alt: z.string().max(300).optional(),
  captions: z.string().max(500).optional(),
})

export const sectionSchema = z.object({
  title: z.string().trim().min(1, 'Укажите заголовок секции').max(200),
  text: z.string().trim().min(1, 'Заполните текст секции').max(10000),
})

export const objectInputSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(300),
  description: z.string().max(10000).nullish(),
  categoryId: z.string().min(1, 'Укажите категорию'),
  address: z.string().max(500).nullish(),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  photos: z.array(photoSchema).max(20).default([]),
  videos: z.array(videoSchema).max(10).default([]),
  audioUrl: z.string().max(500).nullish(),
  audioText: z.string().max(20000).nullish(),
  rating: z.number().min(0).max(5).nullish(),
  sections: z.array(sectionSchema).max(20).default([]),
  modelUrl: z.string().max(500).nullish(),
  published: z.boolean().default(true),
  sortWeight: z.number().int().min(-1000).max(1000).default(0),
})

export type ObjectInput = z.infer<typeof objectInputSchema>

/** Координаты из query string для определения округа через PostGIS. */
export const districtLookupQuerySchema = z.object({
  lng: z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(-180).max(180)),
  lat: z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(-90).max(90)),
})

export const publishedPatchSchema = z.object({ published: z.boolean() })

export const userInputSchema = z.object({
  email: z.string().email('Некорректный email').max(300),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(200),
  role: z.enum(['admin', 'editor']).default('editor'),
})

export const uuidSchema = z.string().uuid()

export const reportStatusSchema = z.enum(['new', 'resolved', 'rejected'])

export const contentReportInputSchema = z
  .object({
    objectId: uuidSchema,
    message: z
      .string()
      .trim()
      .refine((value) => Array.from(value).length >= 10, 'Опишите ошибку подробнее')
      .refine((value) => Array.from(value).length <= 2000, 'Слишком длинное сообщение'),
    contact: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((value) => value || null),
    website: z.string().max(500).default(''),
  })
  .strict()

export const reportStatusPatchSchema = z
  .object({ status: reportStatusSchema })
  .strict()

export function isContentReportHoneypotFilled(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { website?: unknown }).website === 'string' &&
      (value as { website: string }).website.trim()
  )
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Строгая календарная проверка без нормализации несуществующих дат JavaScript-ом. */
export function isValidCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (days[month - 1] ?? 0)
}

const dateSchema = z
  .string()
  .regex(DATE_PATTERN, 'Дата в формате ГГГГ-ММ-ДД')
  .refine(isValidCalendarDate, 'Несуществующая календарная дата')

const timeSchema = z.string().regex(TIME_PATTERN, 'Время в формате ЧЧ:ММ')
const registrationUrlSchema = z
  .string()
  .url('Некорректная ссылка на регистрацию')
  .max(1000)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }, 'Ссылка на регистрацию должна использовать HTTP или HTTPS')

/** Мероприятие у памятника */
export const eventInputSchema = z
  .object({
    objectId: z.string().uuid('Выберите объект'),
    title: z.string().trim().min(1, 'Укажите название').max(300),
    description: z.string().max(5000).nullish(),
    startsOn: dateSchema,
    endsOn: dateSchema,
    startsAt: timeSchema.nullable().default(null),
    endsAt: timeSchema.nullable().default(null),
    timezone: z.enum(['Asia/Yekaterinburg']).default('Asia/Yekaterinburg'),
    venue: z.string().trim().max(500).nullable().default(null),
    organizer: z.string().trim().max(300).nullable().default(null),
    priceInfo: z.string().trim().max(200).nullable().default(null),
    registrationUrl: registrationUrlSchema.nullable().default(null),
    accessibility: z.string().trim().max(2000).nullable().default(null),
    status: z.enum(['scheduled', 'postponed', 'cancelled']).default('scheduled'),
    published: z.boolean().default(true),
  })
  .refine((d) => d.endsOn >= d.startsOn, {
    message: 'Дата окончания раньше даты начала',
    path: ['endsOn'],
  })
  .refine(
    (d) => d.endsAt === null || d.startsAt !== null,
    {
      message: 'Укажите время начала',
      path: ['startsAt'],
    }
  )
  .refine(
    (d) =>
      d.startsOn !== d.endsOn ||
      d.startsAt === null ||
      d.endsAt === null ||
      d.endsAt >= d.startsAt,
    {
      message: 'Время окончания раньше времени начала',
      path: ['endsAt'],
    }
  )

export type EventInput = z.infer<typeof eventInputSchema>

/** Проверка импорта: установка координаты и/или подтверждение */
export const importReviewPatchSchema = z
  .object({
    lng: z.number().min(-180).max(180).optional(),
    lat: z.number().min(-90).max(90).optional(),
    verify: z.boolean().optional(),
  })
  .refine((d) => (d.lng === undefined) === (d.lat === undefined), {
    message: 'lng и lat передаются вместе',
  })
  .refine((d) => d.lng !== undefined || d.verify !== undefined, {
    message: 'Пустой запрос',
  })
