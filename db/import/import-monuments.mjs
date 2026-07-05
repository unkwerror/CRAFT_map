// Импорт объектов с рабочей доски КРАФТ (monuments.json) + фото.
//
//   node import/import-monuments.mjs [monuments.json] [папка с фото]
//
// По умолчанию: ../monuments.json и ../monument_photos/photos относительно корня репо.
// Идемпотентно: upsert по source_id (id записи в monuments.json). Координаты (geom),
// geocode_status и published при повторном запуске НЕ трогаются — их выставляют
// geocode.py и ручная проверка в админке. Фото пересобираются, только если
// webp-файлов ещё нет (пересборка принудительно: --force-photos).
//
// sharp берётся из app/node_modules — отдельная установка не нужна.
import { readFile, mkdir, access } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const require = createRequire(join(root, 'app', 'node_modules', 'x'))
const sharp = require('sharp')

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const forcePhotos = process.argv.includes('--force-photos')
const jsonPath = args[0] ?? join(root, 'monuments.json')
const photosDir = args[1] ?? join(root, 'monument_photos', 'photos')
const uploadsDir = process.env.UPLOADS_DIR ?? join(root, 'data', 'uploads')

const url = process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map'
const sql = postgres(url, { max: 1, onnotice: () => {} })

const monuments = JSON.parse(await readFile(jsonPath, 'utf8'))
if (!Array.isArray(monuments)) {
  console.error('Ожидается массив объектов monuments.json')
  process.exit(1)
}

const exists = (p) => access(p).then(() => true, () => false)

/** obj_001_1.jpg → [{original, thumb, alt}] в /uploads/objects/{source_id}/ */
async function processPhotos(m) {
  const photos = []
  const dir = join(uploadsDir, 'objects', String(m.id))
  for (const [i, file] of (m.photos ?? []).entries()) {
    const base = `photo_${i + 1}`
    const original = join(dir, `${base}.webp`)
    const thumb = join(dir, `${base}_thumb.webp`)
    if (forcePhotos || !(await exists(original)) || !(await exists(thumb))) {
      await mkdir(dir, { recursive: true })
      const img = sharp(await readFile(join(photosDir, file)), { failOn: 'error' }).rotate()
      await img
        .clone()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(original)
      await img
        .clone()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(thumb)
    }
    photos.push({
      original: `/uploads/objects/${m.id}/${base}.webp`,
      thumb: `/uploads/objects/${m.id}/${base}_thumb.webp`,
      alt: m.title,
    })
  }
  return photos
}

const known = new Set((await sql`select id from categories`).map((r) => r.id))
let created = 0
let updated = 0
let photosProcessed = 0

try {
  for (const m of monuments) {
    if (!known.has(m.category_id)) {
      console.error(`«${m.title}» (id ${m.id}): неизвестная категория «${m.category_id}»`)
      process.exit(1)
    }
    const photos = await processPhotos(m)
    photosProcessed += photos.length

    // округ с доски: «Центральный округ» → «Центральный» (имена в districts без слова «округ»)
    const importDistrict = m.district?.replace(/\s*округ\s*$/i, '') ?? null

    const rows = await sql`
      insert into objects (title, description, category_id, address, published,
                           source_id, import_district, import_flags,
                           geocode_status, geocode_query, photos)
      values (${m.title}, ${m.description ?? null}, ${m.category_id}, ${m.address_raw ?? null},
              false, ${m.id}, ${importDistrict}, ${sql.json(m.flags ?? [])},
              'pending', ${m.geocode_query ?? null}, ${sql.json(photos)})
      on conflict (source_id) do update
        set title = excluded.title, description = excluded.description,
            category_id = excluded.category_id, address = excluded.address,
            import_district = excluded.import_district, import_flags = excluded.import_flags,
            geocode_query = excluded.geocode_query, photos = excluded.photos
      returning (xmax = 0) as inserted`
    rows[0].inserted ? created++ : updated++
  }
  console.log(`objects: создано ${created}, обновлено ${updated}; фото: ${photosProcessed}`)
} finally {
  await sql.end()
}
