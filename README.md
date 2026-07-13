# Интерактивная карта памятных объектов Тюмени (КРАФТ)

Карта Тюмени с памятниками и значимыми точками четырёх категорий: патриотизм,
историческая память, достоинство и преемственность поколений.

Приложение работает на Next.js, MapLibre GL и PostgreSQL/PostGIS. Карта, данные,
PMTiles и пользовательские медиа в production self-hosted. Yandex SpeechKit —
необязательная внешняя интеграция только для генерации текста в админке; её ключ
хранится исключительно в серверном `.env`.

Подробное ТЗ и архитектурные решения — в `CLAUDE.md`.

## Структура

```text
/app            — Next.js: публичная карта, /admin и API
/db             — миграции, seed, импорт GeoJSON, backup.sh
/nginx          — reverse proxy, HTTPS и раздача статических данных
/scripts        — безопасные host-операции, включая renew сертификатов
/tiles          — инструкция по PMTiles/глифам; data/ не хранится в git
docker-compose.yml       — production: db, app, nginx и maintenance-профиль
docker-compose.dev.yml   — development: только PostGIS
```

## Разработка

```bash
# 1. Поднять PostGIS
docker compose -f docker-compose.dev.yml up -d

# 2. Применить миграции и создать первого администратора
cd db
npm install
ADMIN_EMAIL=admin@example.ru ADMIN_PASSWORD=admin12345 npm run migrate
ADMIN_EMAIL=admin@example.ru ADMIN_PASSWORD=admin12345 npm run seed

# 3. При необходимости загрузить тестовые данные
npm run import -- districts import/samples/districts.geojson
npm run import -- objects import/samples/objects.geojson

# 4. Запустить приложение
cd ../app
npm install
cp .env.local.example .env.local
npm run dev
```

Приложение будет доступно на <http://localhost:3000>, админка — на
<http://localhost:3000/admin>. Без `tiles/data/tyumen.pmtiles` в development
используется временная растровая подложка OSM. Подготовка production-подложки и
глифов описана в `tiles/README.md`.

## Production

### Первичная установка

```bash
git clone REPOSITORY_URL /opt/CRAFT_map
cd /opt/CRAFT_map
cp .env.example .env
nano .env
```

В `.env` обязательно замените пароли, `AUTH_SECRET`, `AUTH_URL` и данные
администратора. SpeechKit-переменные необязательны. Файл `.env` и содержимое
`tiles/data/` не должны попадать в git.

Nginx-конфигурация репозитория настроена для `xn--80ayho4cq.site` и
`www.xn--80ayho4cq.site`. Для другого домена замените оба `server_name`, пути
сертификата и `AUTH_URL`; оба DNS-имени должны указывать на сервер.

Если сертификата ещё нет, временно отключите HTTPS server block по комментарию в
`nginx/conf.d/craft.conf`, поднимите HTTP-конфигурацию и выпустите сертификат в
тех же Compose volumes:

```bash
docker compose up -d db app nginx
docker compose --profile maintenance run --rm --no-deps certbot \
  certonly --non-interactive --webroot --webroot-path /var/www/certbot \
  -d xn--80ayho4cq.site -d www.xn--80ayho4cq.site \
  --email admin@example.ru --agree-tos --no-eff-email
```

После выпуска верните HTTPS block и примените конфигурацию:

```bash
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
```

### Прямой деплой

GitHub Actions для деплоя не используется. После commit и push обновление
запускается вручную через SSH:

```bash
ssh root@SERVER
cd /opt/CRAFT_map
git fetch origin main
git pull --ff-only origin main
docker compose config --quiet
docker compose build app
docker compose up -d --remove-orphans
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
docker compose ps
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 \
  https://xn--80ayho4cq.site/api/health
```

`git pull --ff-only` намеренно не затирает локальные изменения на сервере. Если
он завершился ошибкой, сначала разберите расхождение; не заменяйте эту команду
безусловным `reset --hard`. Миграции и seed запускаются entrypoint-скриптом `app`.

Устаревшие GitHub secrets `DEPLOY_SSH_KEY` и `DEPLOY_KNOWN_HOSTS`, а также
соответствующий deploy key на сервере следует удалить после перехода на direct
deploy.

### Health и логи

`GET /api/health` проверяет подключение к БД, обязательные таблицы и миграции,
а также доступность uploads и tiles, не раскрывая пути или тексты внутренних
ошибок:

- `200 {"status":"ok"}` — все проверки успешны;
- `200 {"status":"degraded"}` — недоступна необязательная статика;
- `503 {"status":"unavailable"}` — не готова БД или схема.

Docker healthcheck приложения использует этот endpoint. Для `db`, `app` и
`nginx` действует `restart: unless-stopped`; json-file логи ограничены тремя
файлами по 10 МБ на сервис.

## Бэкапы

`db/backup.sh` создаёт согласованную пару архивов БД и uploads. Запись идёт через
временные файлы с атомарным переименованием, каталог получает режим `0700`, файлы
— `0600`. Скрипт проверяет gzip/tar, свежесть, SHA-256 и хранит по умолчанию
14 дней. Внутренний `flock` исключает параллельные запуски. Только после
успешной проверки скрипт запускает очистку неиспользуемых uploads.

Имена содержат UTC timestamp:

```text
db-20260713T030000Z.sql.gz
uploads-20260713T030000Z.tar.gz
backup-20260713T030000Z.sha256
```

Без `BACKUP_REMOTE` бэкап остаётся полностью локальным. Необязательные настройки
в `.env`:

```dotenv
# BACKUP_DIR=/var/backups/craft-map
# KEEP_DAYS=14
# BACKUP_MAX_AGE_SECONDS=600
# BACKUP_REMOTE=backup@example.ru:/srv/backups/craft-map
# UPLOAD_CLEANUP_GRACE_HOURS=24
```

Безопасный шаблон `/etc/cron.d/craft-map-backup`:

```cron
30 3 * * * root flock -n /run/lock/craft-map-backup.lock /opt/CRAFT_map/db/backup.sh >>/var/log/craft-map-backup.log 2>&1
```

У пользователя cron должны быть права на Docker и каталог бэкапа. Если настроен
`BACKUP_REMOTE`, заранее проверьте SSH host key и ограничьте ключ только каталогом
назначения. Внешняя копия рекомендуется, но не является условием работы скрипта.

### Проверка и восстановление

Восстановление регулярно репетируйте в отдельном окружении. Перед production
restore сначала запустите свежий safety backup. Затем выберите одну тройку файлов
с одинаковым timestamp и проверьте checksum:

```bash
STAMP=20260713T030000Z
BACKUP_DIR=/var/backups/craft-map
(cd "$BACKUP_DIR" && sha256sum -c "backup-$STAMP.sha256")
```

Следующие команды останавливают запись данных и пересоздают production БД,
поэтому выполняйте их только в согласованное окно:

```bash
cd /opt/CRAFT_map
set -a
. ./.env
set +a
: "${STAMP:?set the backup timestamp first}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/craft-map}"

docker compose stop nginx app
docker compose exec -T db dropdb --if-exists --force \
  -U "$POSTGRES_USER" "$POSTGRES_DB"
docker compose exec -T db createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
gzip -dc "$BACKUP_DIR/db-$STAMP.sql.gz" | \
  docker compose exec -T db psql -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Архив накладывается поверх uploads. Лишние файлы безопасно удалит cleanup
# после проверки восстановленного приложения.
gzip -dc "$BACKUP_DIR/uploads-$STAMP.tar.gz" | \
  docker compose run --rm --no-deps -T app tar xf - -C /data

docker compose up -d
curl -fsS https://xn--80ayho4cq.site/api/health
```

## Продление сертификатов

`scripts/renew-certificates.sh` запускает закреплённый Certbot из maintenance
profile с теми же `certbot_www` и `certbot_conf`, которые nginx монтирует
read-only. После успешного renew скрипт проверяет nginx-конфигурацию и выполняет
graceful reload.

Перед установкой cron один раз выполните staging-проверку:

```bash
cd /opt/CRAFT_map
./scripts/renew-certificates.sh --dry-run
```

Шаблон `/etc/cron.d/craft-map-certbot`:

```cron
17 3,15 * * * root flock -n /run/lock/craft-map-certbot.lock /opt/CRAFT_map/scripts/renew-certificates.sh >>/var/log/craft-map-certbot.log 2>&1
```

Cron не устанавливается репозиторием автоматически. Не используйте
`docker compose down -v`: эта команда удалит БД, uploads и сертификаты. Архивы из
`db/backup.sh` не включают `certbot_conf`; для disaster recovery храните отдельно
защищённую копию этого volume или будьте готовы безопасно перевыпустить сертификат.
