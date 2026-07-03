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
cd db && npm run import -- objects import/samples/objects.geojson import/mapping.example.json
```

Скрипт идемпотентен: повторный запуск обновляет существующие записи
(ключ — название + точная геометрия), а не создаёт дубли. `district_id`
проставляется триггером БД автоматически (ST_Contains).

## Тестовые данные

`samples/` — **тестовые** округа (упрощённые прямоугольники) и ~12 объектов с
примерными координатами: только для разработки, заменить реальными слоями из QGIS.
