import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { Photo } from './types'

// PostGIS geometry — пишем/читаем только через raw SQL (ST_*), тип нужен для описания таблиц
const geometry = customType<{ data: unknown }>({
  dataType() {
    return 'geometry'
  },
})

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  color: text('color').notNull(),
})

export const districts = pgTable('districts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  geom: geometry('geom').notNull(),
})

export const objects = pgTable('objects', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  categoryId: text('category_id').notNull(),
  districtId: integer('district_id'),
  address: text('address'),
  geom: geometry('geom').notNull(),
  photos: jsonb('photos').$type<Photo[]>().notNull().default([]),
  published: boolean('published').notNull().default(true),
  sortWeight: integer('sort_weight').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('editor'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
