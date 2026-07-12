# Интерактивная карта памятных объектов Тюмени (КРАФТ)

## Контекст проекта

Веб-приложение: интерактивная карта города Тюмени с памятниками и значимыми точками, соответствующими ценностным положениям Указа Президента № 809. Заказчик — центр проектирования КРАФТ (craft72.ru). Референс дизайна — статичные карты, сделанные в QGIS: тёмно-синяя подложка, белые границы округов, цветные круглые маркеры 4 категорий.

Всё разворачивается self-hosted на одном VPS (российский IP, Ubuntu 24.04). Никаких внешних SaaS (Supabase, Mapbox, Firebase) — санкционные и географические риски. Все зависимости должны работать без API-ключей зарубежных сервисов.

## Стек (зафиксирован, не менять без согласования)

- **Frontend:** Next.js 14+ (App Router, TypeScript)
- **Карта:** MapLibre GL JS (не Mapbox GL — у него лицензия и токены)
- **БД:** PostgreSQL 16 + PostGIS (Docker)
- **ORM:** Drizzle ORM (или Prisma, если с geometry в Drizzle будут проблемы — тогда geometry хранить через raw SQL / кастомный тип)
- **Auth админки:** Auth.js (NextAuth v5), Credentials provider, пароли — bcrypt/argon2
- **Файлы (фото объектов):** локальная папка `/data/uploads` (Docker volume), отдаётся через nginx. Обработка изображений — sharp (ресайз до 1600px + превью 400px при загрузке)
- **Тайлы подложки:** PMTiles (вырезка Тюменской области) + библиотека `pmtiles` на клиенте. Файл лежит локально, отдаётся nginx с поддержкой Range-запросов
- **Reverse proxy:** nginx + certbot (Let's Encrypt)
- **Оркестрация:** Docker Compose

## Архитектура

```
[nginx :443]
  ├── / → next-app :3000 (публичная карта + /admin)
  ├── /uploads/ → static volume (фото)
  └── /tiles/tyumen.pmtiles → static, с Accept-Ranges
[postgres+postgis :5432] — только внутренняя docker-сеть
```

Один репозиторий, структура:

```
/app            — Next.js приложение
/db             — миграции, seed-скрипты, скрипт импорта GeoJSON
/tiles          — README как получить pmtiles-вырезку
/nginx          — конфиг
docker-compose.yml
docker-compose.dev.yml
```

## Схема БД

```sql
create extension if not exists postgis;

create table categories (
  id text primary key,            -- 'patriotism' | 'memory' | 'dignity' | 'continuity'
  title text not null,            -- Патриотизм / Историческая память / Достоинство / Преемственность поколений
  color text not null             -- hex из брендбука
);

create table districts (
  id serial primary key,
  name text not null,             -- Калининский, Ленинский, Центральный, Восточный
  geom geometry(MultiPolygon, 4326) not null
);

create table objects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id text not null references categories(id),
  district_id int references districts(id),
  address text,
  geom geometry(Point, 4326) not null,
  photos jsonb default '[]',      -- [{original, thumb, alt}]
  published boolean default true,
  sort_weight int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index objects_geom_idx on objects using gist(geom);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text default 'editor'      -- 'admin' | 'editor'
);
```

district_id проставлять автоматически триггером или при сохранении: `ST_Contains(districts.geom, objects.geom)`.

## Импорт данных из QGIS

В `/db/import/` положить скрипт (Node или bash с ogr2ogr):

- `districts.geojson` → таблица districts (одноразово)
- `objects.geojson` → таблица objects; маппинг атрибутов QGIS-слоя на поля БД описать в конфиге скрипта, категории смапить на id
- Всё в EPSG:4326. Если исходники в EPSG:3857 — перепроецировать через ogr2ogr `-t_srs EPSG:4326`
- Скрипт должен быть идемпотентным (upsert по title+координате или по внешнему id из QGIS, если есть)

## Публичная карта (главная страница)

API: `GET /api/objects` → GeoJSON FeatureCollection (только published, поля: id, title, category, thumb). `GET /api/objects/[id]` → полная карточка. `GET /api/districts` → полигоны.

Поведение карты:

1. Подложка — PMTiles + кастомный JSON-стиль в палитре референса: тёмно-синяя вода (#1b3a5c ориентировочно, уточнить пипеткой по скринам), приглушённо-синяя застройка, оливково-серая зелень. Стиль хранить в репо как `map-style.json`, редактировать можно в Maputnik.
   **Обязательно: карта должна быть полноценной и достоверной, а не декоративной иллюстрацией.** Требования к подложке:
   - **Подписи всех улиц** (symbol-слои с `text-field` по тегу name для дорожных слоёв), появляются по мере зума: магистрали с z12–13, все улицы с z14–15. Названия на русском (в OSM для Тюмени name — русский)
   - **Кириллические глифы обязательны:** self-hosted папка glyphs со шрифтом с кириллицей (Noto Sans / PT Sans; сгенерировать через maplibre font-maker или взять готовые openmaptiles fonts), отдавать через nginx. Без этого подписи будут пустыми квадратами
   - Дорожная сеть, кварталы, водоёмы — из свежего OSM-экстракта (Geofabrik, Тюменская область); геометрию не упрощать агрессивно на рабочих зумах. В README тайлов зафиксировать дату экстракта и команду пересборки для будущих обновлений
   - Контраст подписей на тёмно-синем фоне: светлый текст + halo в цвет фона (`text-halo-width` 1–1.5)
   - POI-подписи (магазины и т.п.) не выводить — не перегружать карту, объекты проекта важнее
2. Границы округов — белая линия 2px поверх подложки, названия округов — подписи
3. Объекты — круглые маркеры цвета категории с мягкой прозрачной обводкой (как на референсе). Кластеризация MapLibre (`cluster: true`), радиус кластера растёт с количеством точек
4. **Каждый объект интерактивен.** Клик/тап по маркеру → боковая панель (desktop) / bottom sheet (mobile): галерея фото (свайп/стрелки), название, категория с цветной меткой, полное описание, адрес, кнопка «Маршрут» (Яндекс.Карты `yandex.ru/maps/?rtext=~lat,lon`). При открытии карточки маркер подсвечивается и карта плавно центрируется (`flyTo` с offset под панель). Курсор pointer при наведении, зона тапа на мобильном ≥ 40px (hit area больше визуального маркера)
5. Компактные чипы категорий под поиском; отдельной панели фильтров и статистики нет
6. Выбор округа через поиск → fitBounds на его полигон
7. Mobile-first: карта на весь экран

Каждый объект также доступен по `/object/[id]` — серверный рендер для SEO и шаринга (OG-теги с фото).

## Админка `/admin`

За Auth.js, роли admin/editor. Функции:

- Таблица объектов: поиск по названию, фильтр категория/округ/published, сортировка
- Форма создания/редактирования: все поля + **мини-карта MapLibre, где координата ставится кликом** (обязательно), + drag-n-drop загрузка фото (sharp: оригинал ≤1600px, превью 400px, webp)
- Мягкое скрытие через published, физическое удаление — только admin с подтверждением
- Управление пользователями — только admin
- CSV/GeoJSON экспорт всех объектов (кнопка)

## Docker Compose

Сервисы: `db` (postgis/postgis:16), `app` (Next.js standalone build), `nginx`. Volumes: `pgdata`, `uploads`, `tiles`. Переменные — через `.env` (в репо только `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL/PASSWORD` для первичного seed. Порт 5432 наружу не пробрасывать.

Бэкапы: cron на хосте, `pg_dump` ежедневно + rsync/копия папки uploads, хранить 14 дней. Скрипт положить в `/db/backup.sh`.

## Порядок работы (фазы)

1. **Каркас:** docker-compose с postgres+postgis, Next.js hello-world, миграции, seed категорий и админ-юзера
2. **Импорт:** скрипт импорта GeoJSON, залить округа и тестовые объекты
3. **Карта MVP:** MapLibre с временной публичной подложкой (demotiles или OSM raster), маркеры из API, попапы. Стиль — потом
4. **Интерактив:** поиск, чипы категорий, кластеры, карточки объектов, mobile
5. **Подложка:** pmtiles-вырезка Тюмени, кастомный стиль под палитру КРАФТ
6. **Админка:** auth, CRUD, загрузка фото, мини-карта выбора координат
7. **Прод:** nginx, https, бэкапы, README по деплою

Каждую фазу завершать рабочим состоянием (можно запустить и посмотреть). Коммиты — по фазам или мельче.

## Требования к качеству

- TypeScript strict, без `any` в публичных интерфейсах
- Все строки интерфейса — на русском языке
- Валидация входных данных API через zod
- Не тянуть тяжёлые UI-библиотеки; Tailwind + минимум компонентов достаточно
- Карта должна работать в Chrome, Firefox, Safari, включая iOS
- Lighthouse mobile ≥ 85 по performance на публичной странице

## Чего НЕ делать

- Не подключать Mapbox, Google Maps, любые сервисы с токенами
- Не хранить фото в БД (только пути)
- Не выносить админку в отдельное приложение — это те же Next.js-роуты за auth
