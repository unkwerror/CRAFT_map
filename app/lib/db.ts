import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as typeof globalThis & { pgClient?: ReturnType<typeof postgres> }

/** Raw-клиент postgres-js — для гео-запросов (ST_*) и агрегатов */
export const pg =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map', {
    max: 10,
    onnotice: () => {},
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = pg

/** Drizzle — для простых типизированных запросов к таблицам без geometry */
export const db = drizzle(pg, { schema })
