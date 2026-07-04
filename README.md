# Интерактивная карта памятных объектов Тюмени (КРАФТ)

Веб-приложение: карта Тюмени с памятниками и значимыми точками четырёх категорий
(патриотизм, историческая память, достоинство, преемственность поколений).
Полностью self-hosted: Next.js + MapLibre GL + PostgreSQL/PostGIS + PMTiles, без внешних SaaS.

Подробное ТЗ и решения — в `CLAUDE.md`.

## Структура

```
/app            — Next.js (публичная карта + /admin + API)
/db             — миграции, seed, импорт GeoJSON из QGIS, backup.sh
/tiles          — README по сборке PMTiles-вырезки и глифов; data/ — сами файлы (не в git)
/nginx          — конфиг reverse-proxy
docker-compose.yml       — прод (db + app + nginx)
docker-compose.dev.yml   — dev (только PostGIS)
```

## Разработка

```bash
# 1. Поднять PostGIS
docker compose -f docker-compose.dev.yml up -d

# 2. Миграции + сид (категории, админ)
cd db && npm install
ADMIN_EMAIL=admin@example.ru ADMIN_PASSWORD=admin12345 npm run migrate && \
ADMIN_EMAIL=admin@example.ru ADMIN_PASSWORD=admin12345 npm run seed

# 3. Тестовые данные (округа + ~12 объектов)
npm run import -- districts import/samples/districts.geojson
npm run import -- objects import/samples/objects.geojson

# 4. Приложение
cd ../app && npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000, админка /admin
```

Без файла `tiles/data/tyumen.pmtiles` карта работает на временной растровой
подложке OSM (только dev). Сборка полноценной подложки и глифов — `tiles/README.md`.

## Прод (VPS, Docker Compose)

```bash
git clone <repo> /opt/CRAFT_map && cd /opt/CRAFT_map
cp .env.example .env && nano .env      # пароли, AUTH_SECRET, домен, админ

# Подложка и глифы (см. tiles/README.md) → tiles/data/

# Домен в nginx/conf.d/craft.conf (замените example.ru).
# Если сертификата ещё нет — временно закомментируйте блок `server { listen 443 … }`.
docker compose up -d --build

# Выпуск сертификата (webroot уже настроен):
docker run --rm -v craft_map_certbot_www:/var/www/certbot \
  -v craft_map_certbot_conf:/etc/letsencrypt certbot/certbot certonly \
  --webroot -w /var/www/certbot -d example.ru --email admin@example.ru --agree-tos
# вернуть блок 443 и перезапустить nginx:
docker compose restart nginx

# Данные:
docker compose exec app node /srv/db/import/import.mjs districts /srv/db/import/samples/districts.geojson
```

Миграции и сид выполняются автоматически при старте контейнера `app`.

### Бэкапы

`db/backup.sh` — pg_dump + архив загрузок, хранение 14 дней. Крон на хосте:

```
30 3 * * * cd /opt/CRAFT_map && ./db/backup.sh >> /var/log/craft-backup.log 2>&1
```

### CI/CD

Деплой автоматический: push в `main` на GitHub → workflow
`.github/workflows/deploy.yml` заходит по SSH на прод, делает
`git reset --hard origin/main`, пересобирает и перезапускает контейнер `app`.
Запустить вручную можно через вкладку Actions (workflow_dispatch).

Требуется секрет репозитория `DEPLOY_SSH_KEY` (приватный ed25519-ключ,
парный публичный лежит в `/root/.ssh/authorized_keys` на сервере).
Прямой rsync-деплой больше не нужен — код на сервере обновляется только
через git, локальные правки в `/opt/CRAFT_map` будут затёрты.

## Фазы (из ТЗ)

1. ✅ Каркас: compose, миграции, seed категорий и админа
2. ✅ Импорт GeoJSON (округа + объекты, идемпотентный)
3. ✅ Карта MVP: MapLibre, маркеры из API, fallback-подложка
4. ✅ Интерактив: фильтры, кластеры, карточки, статистика, mobile
5. ✅ Стиль подложки под палитру КРАФТ (`app/public/map-style.json`, правится в Maputnik);
      сборку `tyumen.pmtiles` выполнить по `tiles/README.md`
6. ✅ Админка: Auth.js, CRUD, фото (sharp), мини-карта координат, экспорт CSV/GeoJSON
7. ✅ Прод: nginx, https (инструкция), бэкапы

Открытые пункты: собрать реальную PMTiles-вырезку и глифы на сервере; заменить
тестовые округа/объекты реальными слоями из QGIS; уточнить цвета категорий по брендбуку.
