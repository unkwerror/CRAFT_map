// Применяет по порядку все db/migrations/*.sql, ещё не отмеченные в schema_migrations.
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map'
const sql = postgres(url, { max: 1, onnotice: () => {} })

try {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`

  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name))
  const files = (await readdir(join(here, 'migrations'))).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const body = await readFile(join(here, 'migrations', file), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`insert into schema_migrations (name) values (${file})`
    })
    console.log(`applied: ${file}`)
  }
  console.log('migrations: up to date')
} finally {
  await sql.end()
}
