# Аудит текущего состояния память.site

Дата аудита: 18 июля 2026 года. Основание: `PAMYAT_SITE_CODEX_IMPLEMENTATION_BRIEF.md`, Фаза 0. Аудит выполнен по состоянию commit `7268437`; production не изменялся и не проверялся. В репозитории нет `AGENTS.md`, поэтому применены `README.md`, `CLAUDE.md` и правила самого брифа.

## Резюме

Проект — единое self-hosted Next.js-приложение с публичной картой, SEO-страницами, REST route handlers и встроенной админкой. Базовая архитектура соответствует исходному ТЗ и пригодна для расширения без переписывания. Фаза 1 должна быть расширяющей: уже существующие аудит, сообщения пользователей, события, SpeechKit, локальный прогресс, PWA и Web Vitals нельзя заменять параллельными контурами.

Главные ограничения перед Фазой 1: роли сведены к `admin/editor`; workflow, версии и источники отсутствуют; паспорт объекта хранится в одной таблице и JSONB; SpeechKit синхронно создаёт один файл без job/status/version; продуктовая аналитика отсутствует; feature flags отсутствуют; API не версионирован и не имеет общего envelope/pagination/rate limiting. Это не мешает текущему продукту, но определяет порядок миграций.

## Фактический стек и модули

| Контур | Реализация |
|---|---|
| Web | Next.js 15.5 App Router, React 19.1, TypeScript 5.8 strict |
| UI | собственные React-компоненты, Tailwind CSS 4/PostCSS, без тяжёлой component library |
| Карта | MapLibre GL JS 5.6 + PMTiles 4.3; production-стиль в `public/map-style.json`, dev fallback на MapLibre demo raster/glyphs |
| Данные | PostgreSQL 16/PostGIS 3.4, `postgres-js`, Drizzle 0.45; PostGIS-запросы через tagged raw SQL |
| Авторизация | Auth.js v5 Credentials, bcryptjs, JWT-сессия на 8 часов |
| Файлы | Docker volume `/data/uploads`, обработка Sharp, выдача через nginx или Next route fallback |
| 3D | `<model-viewer>`, glTF Transform и meshoptimizer; загрузка по действию пользователя |
| Аудио | один `audio_url` + `audio_text` в `objects`; ручная загрузка либо синхронный backend-вызов Yandex SpeechKit v3 |
| Offline | manifest + service worker; cache shell, опубликованных API-ответов и уже открытых uploads; route packages отсутствуют |
| Эксплуатация | Docker Compose: PostGIS, Next standalone, nginx; Certbot maintenance profile; healthcheck, backup/restore и cleanup uploads |

Основные клиентские модули: `MapApp` координирует режимы и URL; `MapView` отвечает за MapLibre, кластеры, округа и geolocation; `PlacesListPanel`, `EventsPanel`, `ObjectCard` и SEO-страницы дают текстовый fallback. `AudioGuide` сохраняет позицию в localStorage. `usePlaceProgress` хранит избранное и посещения локально. Админка содержит CRUD объектов/событий, импорт-review, отчёты, пользователей и загрузки.

## База данных и миграции

Применяемая схема формируется последовательными SQL-миграциями `0001`–`0008`; собственная таблица учёта миграций создаётся runner-ом. Фактические сущности:

- `categories`: id, title, color;
- `districts`: PostGIS MultiPolygon; автоматическая детерминированная привязка объекта через `ST_Covers`;
- `objects`: UUID, основной текст, категория/округ/адрес/Point, JSONB photos/videos/sections, одно аудио, rating, model URL, published/sort, импортные/geocode-поля;
- `events`: принадлежит одному object, даты/время, IANA timezone, место/организатор/цена/регистрация/accessibility, status и published;
- `users`: email/password hash и только `admin|editor`;
- `admin_audit_log`: append-only административный журнал с actor/action/entity/metadata;
- `content_reports`: публичные сообщения об ошибке, контакт и модерационный статус.

Расхождение schema.ts с полной SQL-схемой намеренное, но рискованное: import/geocode-поля, `admin_audit_log` и `content_reports` в Drizzle schema не описаны и обслуживаются raw SQL. Внешние ключи `actor_user_id`/`resolved_by` не заданы, чтобы журнал и историческая запись переживали удаление пользователя; это следует сохранить и документировать.

## API и публичные URL

Публичные страницы: `/`, `/object/:uuid`, `/event/:uuid`, `/offline`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`. Состояние главного экрана шарится параметрами `view=map|list|events`, `object`, `categories`, `district`, `near`, `q`; Back/Forward обрабатываются клиентом. Стабильных slug пока нет — стабильность основана на UUID.

Публичное API:

- `GET /api/objects`, `GET /api/objects/:id`;
- `GET /api/categories`, `GET /api/districts`, `GET /api/districts/at`;
- `GET /api/events`, `GET /api/events/:id/calendar`;
- `POST /api/reports`, `POST /api/metrics/web-vitals`;
- `GET /api/health`;
- `/uploads/*`, `/tiles/*`, `/glyphs/*` как файловые fallback routes.

Admin API под `requireRole`: CRUD `/api/admin/objects`, `/events`, `/users`, `/reports`, import-review; export; upload фото/медиа/GLB; SpeechKit. CRUD пользователей и физическое удаление объекта требуют `admin`; остальные операции доступны editor. Guard перечитывает пользователя из БД на каждый запрос, поэтому удалённая/изменённая учётная запись не продолжает работать по старому JWT.

Публичные read endpoints используют `Cache-Control`/ETag helper выборочно. Формат ошибок обычно `{error: string}`, но централизованного versioned contract нет. Zod применяется к входам. Публичные записи имеют size limit и honeypot для reports, но общего rate limiter, idempotency key и CSRF-слоя для admin mutation API нет. Cookie same-site механика Auth.js снижает риск, но отдельный security review обязателен.

## Карта, медиа, аудио, поиск и аналитика

Карта использует self-hosted `tyumen.pmtiles`, русские glyph routes и OSM attribution. При отсутствии PMTiles dev-код переключается на внешний demo raster, поэтому полностью offline dev не гарантирован. Объекты кластеризуются; категории, округ, поиск, nearby, выбранный объект и режимы уже интегрированы. Точная геолокация не отправляется на сервер.

Фото и производные хранятся путями в JSONB; оригиналы ограничиваются/перекодируются Sharp. Видео, captions и GLB также локальные. Полноценной модели прав на медиа и EXIF/quarantine pipeline нет. Текущий upload-контур должен стать общей основой, а не заменяться.

SpeechKit вызывается только server-side и секрет не попадает в client bundle. Сейчас генерация синхронная, один текст даёт случайно именованный MP3; нет hash, блокировки дублей, очереди, retry/backoff, stale status, approval и вариантов. Ручная запись и сгенерированная запись не различаются в данных.

Поиск клиентский по загруженным объектам/округам и событиям. Полнотекстового серверного индекса, aliases и общего `/search` нет. Аналитика ограничена валидированными Web Vitals, которые пишутся структурированным JSON в stdout. Продуктовые события и pseudonymous session ID отсутствуют.

## Текущие критические сценарии

1. Открыть карту, переключить карта/список/мероприятия и использовать интерфейс без регистрации.
2. Искать объект/округ, фильтровать категории, включить «рядом», открыть карточку и восстановить её из URL/Back/Forward.
3. Открыть `/object/:id`, увидеть SEO/OG/JSON-LD, медиа, текст, аудио и мероприятия.
4. Добавить объект в избранное, отметить посещённым и восстановить localStorage после reload.
5. Запустить аудио, изменить скорость/позицию, открыть транскрипт и восстановить позицию.
6. Открыть афишу, фильтровать период, перейти к месту, открыть `/event/:id`, скачать ICS.
7. Поделиться объектом, открыть маршрут в Яндекс Картах, отправить сообщение об ошибке.
8. Войти в `/admin`, редактировать объект/событие, загрузить медиа/модель/аудио, выгрузить CSV/GeoJSON; admin управляет пользователями и удалением.
9. При потере сети использовать shell/offline page и ранее кешированные публичные данные/медиа.

Эти сценарии являются регрессионным контрактом для следующих фаз. Публичные UUID, URLs, localStorage keys, JSONB media и старые audio URLs должны сохраняться.

## Baseline качества

Запуски 18.07.2026:

| Проверка | Результат |
|---|---|
| `npm run typecheck` | успешно, 0 ошибок |
| `npm run lint` | успешно, 0 ошибок |
| `npm test` | 17 файлов, 97 тестов, все успешно |
| `npm run build` | успешно; Next.js собрал 9 static pages и все dynamic routes |
| `npm run test:e2e` | не запускался: локальная БД/fixtures в рамках аудита не поднимались, production запуск запрещён |

Playwright baseline выполняется на desktop 1440×1000 и Pixel 7. Он покрывает карту/поиск/карточку, URL и Back/Forward, афишу, три режима, избранное. В Фазе 0 добавлены smoke-тесты сохранения посещения и прямой страницы/транскрипта; сценарии корректно skip, если соответствующего опубликованного аудиотекста нет. Нужна стабильная non-production fixture DB, чтобы E2E не зависел от произвольного наполнения.

## Расхождения брифа с текущим кодом

- Бриф предлагает `audit_log`, но уже есть `admin_audit_log`; расширять его совместимо либо добавить связанную структуру metadata/before/after, не создавать дубль.
- `content_reports` уже реализует correction/report subset народного архива, но без consent/rights/files и полноценного workflow.
- Events уже имеют timezone, ICS, публикацию и связь с объектом; не хватает recurring, route, source/external ID, sync/moderation и dedupe.
- Audio уже встроено в `objects` и UI; `audio_variants` должен backfill-иться из `audio_url/audio_text`, а старые колонки временно остаться read-compatible.
- Избранное/посещения и audio progress существуют только локально; аккаунтов публичного пользователя нет.
- Offline shell есть, но offline package маршрута и quota/progress/delete UI отсутствуют.
- 3D есть, AR нет; это Фаза 7 и не должно влиять на ранние миграции.
- SEO есть для UUID объектов/событий; slug, locale/hreflang и routes/people отсутствуют.
- Доступность частично учтена (семантика, keyboard, captions, transcript, reduced motion), но WCAG 2.2 AA аудит не проводился.
- Система feature flags отсутствует. Для server/client согласованности предпочтительна typed env-конфигурация с build-time public flags только для публичного UI; DB-флаги нужны позже лишь для tenant overrides.
- Ролей брифа нет; нельзя расширять Auth.js session union до появления серверной permission matrix и миграции users.
- API сейчас unversioned. Существующие endpoints нельзя переносить; `/api/v1` добавлять как новые контракты либо thin compatible adapters.

## Адаптированный план Фазы 1

Перед кодом Фазы 1 план делится на независимые задачи с отдельной приёмкой.

1. **Конфигурация и флаги.** Добавить `lib/feature-flags.ts` с allowlist из брифа, false-by-default для новых публичных функций и тестами parsing/server exposure. На Фазе 1 реально используются `qr_campaigns_enabled`; расширенные фильтры, workflow и admin readiness могут быть включены отдельно внутренними server flags, если потребуется безопасный rollout.
2. **Расширяющая миграция 0009.** Создать `content_sources`, `entity_sources`, `content_versions`, `editorial_tasks`; расширить `objects` nullable-полями паспорта и `editorial_status default 'published'`. Backfill всех текущих объектов в `published`; constraints добавлять после backfill. Не менять `published boolean` и текущие UUID.
3. **RBAC.** Сначала permission matrix поверх текущих `admin/editor`; mapper: admin → system_admin, editor → author/editor для текущих операций. Новые роли добавить constraint-миграцией только вместе с реальными endpoints и server tests; UI hiding не считать защитой.
4. **Аудит/версии.** Переиспользовать `admin_audit_log`; добавить безопасные before/after либо version reference в metadata. Все mutations новых ресурсов выполняются транзакционно с audit append. Запрет append-only сохранить.
5. **Паспорт/readiness.** Расширить admin object form/API/types/validation; pure `calculateReadiness` с объяснимыми причинами. Старый public DTO остаётся совместимым; новые поля добавляются опционально.
6. **Audio variants.** Создать таблицу вариантов и явный status mapping. Backfill `full/ru`: `ready` при существующем URL, `empty` либо `stale` по данным. Старый UI сначала читает legacy columns; dual-read и затем dual-write вводятся до переключения. Синхронный SpeechKit endpoint не удалять; обернуть сервисом, hash/idempotency и DB-backed job только после отдельного решения о worker.
7. **QR/short links.** Таблицы `short_links`, `qr_campaigns`, случайные codes и allowlist internal target. Добавить `/r/:code` без произвольного redirect URL, admin CRUD/export и anonymized counters под flag.
8. **Аналитика.** Versioned allowlist событий, pseudonymous browser session ID, no PII schema, size/rate limits и retention decision. Существующий Web Vitals endpoint сохранить отдельно. Начать с map/search/place/audio/QR events.
9. **Расширенные фильтры.** Добавить только поля, присутствующие в паспорте; URL codec и unit tests, API query validation, нулевое состояние и list parity. Не отправлять отдельный запрос на каждый checkbox.
10. **Документация и контракты.** Описать migration/backfill, flags, API additions и обновить roadmap progress. OpenAPI вводить для новых `/api/v1`, не переписывая старые routes.

Предполагаемые файлы: новые `db/migrations/0009_*` и при необходимости последующие атомарные миграции; `app/lib/feature-flags.ts`, `permissions.ts`, `readiness.ts`, `analytics.ts`, audio service/repository; расширения `schema.ts`, `types.ts`, `validation.ts`; новые versioned/public/admin route handlers; точечные изменения admin object form, MapApp/SearchBar/CategoryChips; unit/integration/E2E tests. Точный список фиксируется перед каждой подзадачей после проверки актуального дерева.

## Риски и откат

- **Большая миграция:** разбивать DDL/backfill/index/constraints; использовать nullable/default, `IF NOT EXISTS`, транзакции и проверку на staging-копии. Для крупных индексов оценить `CREATE INDEX CONCURRENTLY` вне transaction runner.
- **Несогласованность `published` и workflow:** boolean остаётся источником публичной видимости до завершения dual-read; workflow не может сам раскрыть draft.
- **Аудио-регрессия:** legacy columns и URLs не удаляются; variants можно выключить flag и вернуться к старому чтению. Backfill повторяемый.
- **JWT роли:** permission checks сверяются с БД; при откате новых UI/endpoints старые `admin/editor` продолжают работать. Constraint не сужать до окончания миграции.
- **Analytics/privacy:** flag off прекращает client events; endpoint принимает только allowlist и не пишет free text/точные coordinates/IP в payload. Таблицу можно перестать заполнять без удаления данных.
- **QR:** short code неизменяем; выключение campaign не меняет target record, а даёт контролируемый disabled response. Никогда не принимать внешний redirect параметр.
- **Public API/UI:** все добавления additive; старые `/api/*`, `/object/:id`, query URL и localStorage остаются. Новый API можно выключить маршрутом/flag без rollback БД.

Общая стратегия: сначала выключить соответствующий feature flag, затем откатить приложение на предыдущий образ; расширяющие таблицы/колонки оставить на месте. Деструктивный down migration не выполнять в аварийном откате. Исправления схемы делать forward-fix после резервной копии. Production deploy и миграции требуют отдельной команды владельца.

## Что требуется перед стартом Фазы 1

- отдельное подтверждение перехода к Фазе 1;
- staging-копия актуальной production schema/data для rehearsal миграций;
- решение по retention аналитики и контактных данных;
- решение, какие новые роли реально нужны в первом релизе;
- согласование внешнего вида QR и canonical target;
- фикстурный E2E dataset минимум с объектом, аудиотекстом, аудиофайлом и событием.

