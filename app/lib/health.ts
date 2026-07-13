import { constants } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pg } from './db'
import { TILES_DIR, UPLOADS_DIR } from './paths'

export interface HealthChecks {
  database: boolean
  schema: boolean
  uploads: boolean
  tiles: boolean
}

export interface HealthSummary {
  status: 'ok' | 'degraded' | 'unavailable'
  httpStatus: 200 | 503
}

interface TablesRow {
  categories: string | null
  districts: string | null
  objects: string | null
  events: string | null
  users: string | null
  audit: string | null
  reports: string | null
  migrations: string | null
}

const CACHE_MS = 10_000
let cached: { expiresAt: number; checks: HealthChecks } | null = null
let pending: Promise<HealthChecks> | null = null

export function summarizeHealth(checks: HealthChecks): HealthSummary {
  if (!checks.database || !checks.schema) {
    return { status: 'unavailable', httpStatus: 503 }
  }
  if (!checks.uploads || !checks.tiles) {
    return { status: 'degraded', httpStatus: 200 }
  }
  return { status: 'ok', httpStatus: 200 }
}

async function expectedMigrationNames(): Promise<string[]> {
  const candidates = process.env.MIGRATIONS_DIR
    ? [process.env.MIGRATIONS_DIR]
    : [join(process.cwd(), 'db', 'migrations'), join(process.cwd(), '..', 'db', 'migrations')]

  for (const directory of candidates) {
    try {
      const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()
      if (names.length > 0) return names
    } catch {
      // В dev и standalone рабочие каталоги различаются — пробуем следующий путь.
    }
  }
  return []
}

async function checkDatabaseAndSchema(): Promise<Pick<HealthChecks, 'database' | 'schema'>> {
  try {
    const [tables] = await pg<TablesRow[]>`
      select to_regclass('public.categories')::text as categories,
             to_regclass('public.districts')::text as districts,
             to_regclass('public.objects')::text as objects,
             to_regclass('public.events')::text as events,
             to_regclass('public.users')::text as users,
             to_regclass('public.admin_audit_log')::text as audit,
             to_regclass('public.content_reports')::text as reports,
             to_regclass('public.schema_migrations')::text as migrations`
    if (!tables) return { database: true, schema: false }

    const tablesReady = Object.values(tables).every((value) => value !== null)
    if (!tablesReady) return { database: true, schema: false }

    const [expected, appliedRows] = await Promise.all([
      expectedMigrationNames(),
      pg<{ name: string }[]>`select name from schema_migrations`,
    ])
    const applied = new Set(appliedRows.map((row) => row.name))
    const migrationsReady = expected.length > 0 && expected.every((name) => applied.has(name))
    return { database: true, schema: migrationsReady }
  } catch (error) {
    console.error('Health database check failed:', error)
    return { database: false, schema: false }
  }
}

async function checkUploads(): Promise<boolean> {
  try {
    const info = await stat(UPLOADS_DIR)
    if (!info.isDirectory()) return false
    await access(UPLOADS_DIR, constants.R_OK | constants.W_OK)
    return true
  } catch {
    return false
  }
}

async function checkTilesOnDisk(): Promise<boolean> {
  try {
    const path = join(TILES_DIR, 'tyumen.pmtiles')
    const info = await stat(path)
    await access(path, constants.R_OK)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

async function checkTiles(): Promise<boolean> {
  if (await checkTilesOnDisk()) return true

  const baseUrl = process.env.AUTH_URL
  if (!baseUrl) return false
  try {
    const url = new URL('/tiles/tyumen.pmtiles', baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(2_000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function runHealthChecks(): Promise<HealthChecks> {
  const [database, uploads, tiles] = await Promise.all([
    checkDatabaseAndSchema(),
    checkUploads(),
    checkTiles(),
  ])
  return { ...database, uploads, tiles }
}

/** Короткий in-process cache не позволяет публичному health endpoint нагружать зависимости. */
export async function getHealthChecks(): Promise<HealthChecks> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.checks
  if (pending) return pending

  pending = runHealthChecks()
    .then((checks) => {
      cached = { checks, expiresAt: Date.now() + CACHE_MS }
      return checks
    })
    .finally(() => {
      pending = null
    })
  return pending
}
