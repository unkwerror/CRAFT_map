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

export const publishedPatchSchema = z.object({ published: z.boolean() })

export const userInputSchema = z.object({
  email: z.string().email('Некорректный email').max(300),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(200),
  role: z.enum(['admin', 'editor']).default('editor'),
})

export const uuidSchema = z.string().uuid()

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')

/** Мероприятие у памятника */
export const eventInputSchema = z
  .object({
    objectId: z.string().uuid('Выберите объект'),
    title: z.string().trim().min(1, 'Укажите название').max(300),
    description: z.string().max(5000).nullish(),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine((d) => d.endsOn >= d.startsOn, {
    message: 'Дата окончания раньше даты начала',
    path: ['endsOn'],
  })

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
