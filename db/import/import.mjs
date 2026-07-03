// Импорт GeoJSON из QGIS.
//
//   node import.mjs districts <districts.geojson>
//   node import.mjs objects <objects.geojson> [mapping.json]
//
// Всё ожидается в EPSG:4326. Если исходник в EPSG:3857 — сначала:
//   ogr2ogr -f GeoJSON -t_srs EPSG:4326 out.geojson in.geojson
//
// Идемпотентно: округа — upsert по name, объекты — upsert по title + геометрии.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'

const here = dirname(fileURLToPath(import.meta.url))
const [mode, file, mappingFile] = process.argv.slice(2)

if (!mode || !file || !['districts', 'objects'].includes(mode)) {
  console.error('Использование: node import.mjs districts|objects <file.geojson> [mapping.json]')
  process.exit(1)
}

const url = process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map'
const sql = postgres(url, { max: 1, onnotice: () => {} })

const geojson = JSON.parse(await readFile(file, 'utf8'))
if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
  console.error('Ожидается GeoJSON FeatureCollection')
  process.exit(1)
}

// Маппинг атрибутов QGIS-слоя на поля БД (см. mapping.example.json)
const mapping = {
  title: 'title',
  description: 'description',
  category: 'category',
  address: 'address',
  published: 'published',
  categoryMap: {},
  ...(mappingFile ? JSON.parse(await readFile(join(process.cwd(), mappingFile), 'utf8')) : {}),
}

function firstCoord(geometry) {
  let c = geometry.coordinates
  while (Array.isArray(c[0])) c = c[0]
  return c
}

function checkCrs(geometry) {
  const [x, y] = firstCoord(geometry)
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    console.error(
      `Координаты (${x}, ${y}) вне диапазона EPSG:4326 — похоже на EPSG:3857.\n` +
        'Перепроецируйте: ogr2ogr -f GeoJSON -t_srs EPSG:4326 out.geojson in.geojson'
    )
    process.exit(1)
  }
}

try {
  if (mode === 'districts') {
    let n = 0
    for (const f of geojson.features) {
      const name = f.properties?.name ?? f.properties?.NAME
      if (!name || !f.geometry) {
        console.warn('пропуск: у фичи нет properties.name или geometry')
        continue
      }
      checkCrs(f.geometry)
      const g = JSON.stringify(f.geometry)
      await sql`
        insert into districts (name, geom)
        values (${name}, st_multi(st_setsrid(st_geomfromgeojson(${g}), 4326)))
        on conflict (name) do update set geom = excluded.geom`
      n++
    }
    console.log(`districts: импортировано/обновлено ${n}`)
  }

  if (mode === 'objects') {
    const known = new Set((await sql`select id from categories`).map((r) => r.id))
    let created = 0
    let updated = 0
    let skipped = 0

    for (const f of geojson.features) {
      const p = f.properties ?? {}
      const title = p[mapping.title]
      if (!title || f.geometry?.type !== 'Point') {
        console.warn(`пропуск: нет "${mapping.title}" или геометрия не Point`)
        skipped++
        continue
      }
      checkCrs(f.geometry)

      const rawCategory = p[mapping.category]
      const categoryId = mapping.categoryMap[rawCategory] ?? rawCategory
      if (!known.has(categoryId)) {
        console.warn(`пропуск «${title}»: неизвестная категория «${rawCategory}»`)
        skipped++
        continue
      }

      const g = JSON.stringify(f.geometry)
      const description = p[mapping.description] ?? null
      const address = p[mapping.address] ?? null
      const published = p[mapping.published] ?? true

      const existing = await sql`
        select id from objects
        where title = ${title}
          and st_equals(geom, st_setsrid(st_geomfromgeojson(${g}), 4326))
        limit 1`

      if (existing.length) {
        await sql`
          update objects
          set description = ${description}, category_id = ${categoryId},
              address = ${address}, published = ${published}
          where id = ${existing[0].id}`
        updated++
      } else {
        await sql`
          insert into objects (title, description, category_id, address, geom, published)
          values (${title}, ${description}, ${categoryId}, ${address},
                  st_setsrid(st_geomfromgeojson(${g}), 4326), ${published})`
        created++
      }
    }
    console.log(`objects: создано ${created}, обновлено ${updated}, пропущено ${skipped}`)
  }
} finally {
  await sql.end()
}
