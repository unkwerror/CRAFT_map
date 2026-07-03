import { z } from 'zod'

export const photoSchema = z.object({
  original: z.string().min(1).max(500),
  thumb: z.string().min(1).max(500),
  alt: z.string().max(300).optional(),
})

export const objectInputSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(300),
  description: z.string().max(10000).nullish(),
  categoryId: z.string().min(1, 'Укажите категорию'),
  address: z.string().max(500).nullish(),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  photos: z.array(photoSchema).max(20).default([]),
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
