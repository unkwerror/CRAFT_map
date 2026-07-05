-- Импорт объектов с доски КРАФТ (monuments.json): координаты появляются после
-- геокодинга и ручной проверки, поэтому geom становится nullable.

alter table objects alter column geom drop not null;

alter table objects
  add column source_id int unique,          -- id записи в monuments.json (идемпотентность импорта)
  add column import_district text,          -- округ, заявленный на доске (сверяется с ST_Contains)
  add column import_flags jsonb not null default '[]',
  add column geocode_status text not null default 'verified',
  add column geocode_query text,
  add column geocode_note text;             -- что нашёл геокодер (для отчёта и проверки)

alter table objects add constraint objects_geocode_status_check
  check (geocode_status in ('pending', 'high', 'medium', 'failed', 'verified'));

-- на публичную карту не должен попасть объект без координаты
alter table objects add constraint objects_published_needs_geom
  check (not published or geom is not null);
