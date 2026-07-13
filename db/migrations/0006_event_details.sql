-- Полноценная афиша: планирование визита, публикация и внешняя регистрация.
-- Все колонки nullable/defaulted, поэтому миграция совместима с существующими событиями.

alter table events add column if not exists starts_at time;
alter table events add column if not exists ends_at time;
alter table events add column if not exists timezone text not null default 'Asia/Yekaterinburg';
alter table events add column if not exists venue text;
alter table events add column if not exists organizer text;
alter table events add column if not exists price_info text;
alter table events add column if not exists registration_url text;
alter table events add column if not exists accessibility text;
alter table events add column if not exists status text not null default 'scheduled';
alter table events add column if not exists published boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_status_check'
      and conrelid = 'events'::regclass
  ) then
    alter table events
      add constraint events_status_check
      check (status in ('scheduled', 'postponed', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_time_order_check'
      and conrelid = 'events'::regclass
  ) then
    alter table events
      add constraint events_time_order_check
      check (
        (ends_at is null or starts_at is not null)
        and (starts_on <> ends_on or starts_at is null or ends_at is null or ends_at >= starts_at)
      );
  end if;
end $$;

create index if not exists events_public_dates_idx
  on events(published, ends_on, starts_on);
