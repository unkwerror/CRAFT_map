# Тайлы подложки (PMTiles)

Карта использует self-hosted векторную подложку в формате PMTiles (схема OpenMapTiles).
Файл `tiles/data/tyumen.pmtiles` не хранится в git (см. .gitignore) — его нужно собрать
один раз и класть на сервер рядом с репозиторием. nginx отдаёт его со сжатием и
Range-запросами (обязательно для PMTiles).

Пока файла нет, приложение автоматически использует временную растровую подложку OSM
(допустимо только для разработки, фаза 3).

## Сборка вырезки Тюмени (Planetiler)

Требуется Java 21+ и ~4 ГБ RAM.

```bash
cd tiles

# 1. Свежий OSM-экстракт (Geofabrik, Уральский ФО — Тюменская область входит в него)
wget https://download.geofabrik.de/russia/ural-fed-district-latest.osm.pbf

# 2. (опционально, ускоряет сборку) вырезать bbox Тюмени osmium-tool:
osmium extract -b 64.9,56.9,66.2,57.5 ural-fed-district-latest.osm.pbf -o tyumen.osm.pbf

# 3. Planetiler → PMTiles (схема OpenMapTiles, max zoom 14 — улицы полностью,
#    дальше overzoom на клиенте; геометрия на рабочих зумах не упрощается агрессивно)
wget https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar
java -Xmx4g -jar planetiler.jar \
  --osm-path=tyumen.osm.pbf \
  --output=data/tyumen.pmtiles \
  --bounds=64.9,56.9,66.2,57.5 \
  --languages=ru,name \
  --maxzoom=14
```

**Дата текущего экстракта:** 2026-07-03 (`ural-fed-district-260703.osm.pbf`, Geofabrik).
Для обновления подложки повторить шаги 1–3 и заменить файл, затем
`docker compose restart nginx` не требуется (статика).

## Кириллические глифы (обязательно)

Без них подписи улиц будут пустыми квадратами. Стиль `app/public/map-style.json`
ждёт шрифты **Noto Sans Regular** и **Noto Sans Bold** по пути `/glyphs/{fontstack}/{range}.pbf`.

Вариант 1 — готовые (быстро):

```bash
cd tiles && mkdir -p data/glyphs
wget https://github.com/openmaptiles/fonts/releases/download/v2.0/noto-sans.zip
unzip noto-sans.zip -d data/glyphs/
# должно получиться: data/glyphs/Noto Sans Regular/0-255.pbf … и Noto Sans Bold/…
```

Вариант 2 — сгенерировать самим: https://maplibre.org/font-maker/ (загрузить TTF
Noto Sans / PT Sans с кириллицей, скачать архив, распаковать в `tiles/data/glyphs/`).

## Проверка

```bash
curl -sI https://<домен>/tiles/tyumen.pmtiles | grep -i accept-ranges   # → bytes
curl -sI "https://<домен>/glyphs/Noto%20Sans%20Regular/0-255.pbf"        # → 200
```

В dev-режиме файлы из `tiles/data/` отдаёт сам Next.js (роуты `/tiles/*`, `/glyphs/*`
с поддержкой Range) — достаточно положить их в `tiles/data/`.
