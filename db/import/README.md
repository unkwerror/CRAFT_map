# Импорт данных из QGIS

Экспортируйте слои из QGIS в GeoJSON (EPSG:4326). Если слой в EPSG:3857:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 objects_4326.geojson objects_3857.geojson
```

## Округа (одноразово)

Ожидается `properties.name` (или `NAME`) с названием округа, геометрия Polygon/MultiPolygon:

```bash
cd db && npm run import -- districts import/samples/districts.geojson
```

## Объекты

Атрибуты слоя мапятся на поля БД через конфиг (см. `mapping.example.json`):
`title`, `description`, `category`, `address` — имена атрибутов QGIS-слоя,
`categoryMap` — соответствие значений атрибута категории id-шникам
(`patriotism | memory | dignity | continuity`).

```bash
cd db && npm run import -- objects <objects.geojson> import/mapping.example.json
```

Скрипт идемпотентен: повторный запуск обновляет существующие записи
(ключ — название + точная геометрия), а не создаёт дубли. `district_id`
проставляется триггером БД автоматически (ST_Contains).

## Импорт объектов с доски КРАФТ (monuments.json)

См. `IMPORT_MONUMENTS.md` в корне репозитория. Порядок:

```bash
cd db
node import/import-monuments.mjs           # объекты + фото (sharp, webp)
python3 import/geocode.py                  # проход 1: Nominatim, 1 req/sec
python3 import/geocode_overpass.py         # проход 2: Overpass + фаззи-матчинг названий
```

`geocode.py` требует psycopg: `python3 -m venv import/.venv && import/.venv/bin/pip install 'psycopg[binary]'`,
запускать `import/.venv/bin/python import/geocode.py`. Скрипт пишет отчёт
`db/import/geocode_report.md` (статусы, сверка округов, возможные дубли).
После геокодинга объекты проверяются вручную в админке: `/admin/import-review`.

## Тестовые данные

`samples/districts*.geojson` — границы округов: `districts-real.geojson` — реальные,
`districts.geojson` — упрощённые прямоугольники для разработки.
