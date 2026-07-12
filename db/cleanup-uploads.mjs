// Удаляет файлы /uploads, на которые больше нет ссылок в objects.
// Свежие файлы не трогаются: пользователь мог загрузить их до сохранения формы.
import { readdir, stat, unlink } from 'node:fs/promises'
import { basename } from 'node:path'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map'
const uploadsDir = process.env.UPLOADS_DIR ?? '/data/uploads'
const graceHours = Number(process.env.UPLOAD_CLEANUP_GRACE_HOURS ?? 24)
const dryRun = process.argv.includes('--dry-run')
const cutoff = Date.now() - graceHours * 60 * 60 * 1000
const sql = postgres(url, { max: 1, onnotice: () => {} })

function collectUploadNames(value, used) {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) used.add(basename(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUploadNames(item, used)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectUploadNames(item, used)
  }
}

try {
  const rows = await sql`
    select photos, videos, audio_url, model_url
    from objects`
  const used = new Set()
  for (const row of rows) collectUploadNames(row, used)

  let removed = 0
  let reclaimed = 0
  for (const name of await readdir(uploadsDir).catch((e) => e.code === 'ENOENT' ? [] : Promise.reject(e))) {
    if (used.has(name)) continue
    const path = `${uploadsDir}/${name}`
    const info = await stat(path)
    if (!info.isFile() || info.mtimeMs > cutoff) continue
    if (!dryRun) await unlink(path)
    removed++
    reclaimed += info.size
    console.log(`${dryRun ? 'would remove' : 'removed'}: ${name}`)
  }
  console.log(`uploads cleanup: ${removed} files, ${Math.round(reclaimed / 1024)} KiB`)
} finally {
  await sql.end()
}
