-- Медиа-расширение карточки (видео, аудиогид, рейтинг, секции описания)
-- + мероприятия у памятников (ручной ввод администратором)

alter table objects add column if not exists videos jsonb not null default '[]';
alter table objects add column if not exists audio_url text;
alter table objects add column if not exists audio_text text;
alter table objects add column if not exists rating numeric(2,1)
  check (rating is null or (rating >= 0 and rating <= 5));
alter table objects add column if not exists sections jsonb not null default '[]';

-- videos:   [{src, poster?, alt?}]
-- sections: [{title, text}] — секции описания («Архитектура», «История», …)

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references objects(id) on delete cascade,
  title text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists events_object_idx on events(object_id);
create index if not exists events_dates_idx on events(starts_on, ends_on);
