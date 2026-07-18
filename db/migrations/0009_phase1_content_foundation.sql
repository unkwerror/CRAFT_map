-- Фаза 1: расширяющий фундамент контента. Старые URL/поля/флаги публикации не удаляются.

alter table objects
  add column if not exists editorial_status text not null default 'published',
  add column if not exists alternative_names jsonb not null default '[]'::jsonb,
  add column if not exists object_type text,
  add column if not exists creation_period text,
  add column if not exists opened_on date,
  add column if not exists authors jsonb not null default '[]'::jsonb,
  add column if not exists organizations jsonb not null default '[]'::jsonb,
  add column if not exists protection_status text,
  add column if not exists materials jsonb not null default '[]'::jsonb,
  add column if not exists access_info text,
  add column if not exists accessibility_attributes jsonb not null default '{}'::jsonb,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists media_rights_status text,
  add column if not exists last_verified_at timestamptz;

update objects set editorial_status = case when published then 'published' else 'draft' end
where editorial_status is null or editorial_status = 'published' and not published;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'objects_editorial_status_check') then
    alter table objects add constraint objects_editorial_status_check check
      (editorial_status in ('draft','review','changes_requested','approved','published','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'objects_verification_status_check') then
    alter table objects add constraint objects_verification_status_check check
      (verification_status in ('unverified','needs_review','verified'));
  end if;
end $$;

create table if not exists content_sources (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  author text,
  publisher text,
  publication_year int,
  url text,
  archive_code text,
  access_date date,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','needs_review','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entity_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  source_id uuid not null references content_sources(id) on delete restrict,
  statement text,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, source_id, statement)
);
create index if not exists entity_sources_entity_idx on entity_sources(entity_type, entity_id);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version int not null check (version > 0),
  payload jsonb not null,
  author_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);
create index if not exists content_versions_entity_idx
  on content_versions(entity_type, entity_id, version desc);

create table if not exists editorial_tasks (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft','review','changes_requested','approved','published','archived')),
  assignee_id uuid,
  reviewer_id uuid,
  deadline timestamptz,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editorial_tasks_status_idx on editorial_tasks(status, deadline);

create table if not exists audio_variants (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references objects(id) on delete cascade,
  variant text not null check (variant in
    ('short','full','child','easy_language','audio_description','route_intro','route_direction')),
  locale text not null default 'ru',
  script_text text,
  voice text,
  speed numeric(3,2),
  status text not null default 'empty'
    check (status in ('empty','stale','queued','processing','ready','failed')),
  audio_url text,
  text_hash text,
  version int not null default 1 check (version > 0),
  duration_seconds int,
  generated_at timestamptz,
  error_code text,
  error_message text,
  generation_provider text,
  manual_upload boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, variant, locale)
);
create index if not exists audio_variants_status_idx on audio_variants(status, updated_at);

insert into audio_variants (object_id, variant, locale, script_text, status, audio_url, manual_upload)
select id, 'full', 'ru', audio_text,
       case when audio_url is not null then 'ready' when audio_text is not null then 'stale' else 'empty' end,
       audio_url, audio_url is not null
from objects
where audio_url is not null or audio_text is not null
on conflict (object_id, variant, locale) do nothing;

create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{6,32}$'),
  target_type text not null check (target_type in ('object','event','route','person')),
  target_id uuid not null,
  locale text not null default 'ru',
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qr_campaigns (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid not null references short_links(id) on delete restrict,
  name text not null,
  placement_type text,
  placement_name text,
  organization_name text,
  print_batch text,
  active_from date,
  active_until date,
  tags jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_from is null or active_until >= active_from)
);

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  schema_version int not null default 1,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  session_id text not null,
  entity_type text,
  entity_id uuid,
  route_id uuid,
  campaign_id uuid,
  locale text not null default 'ru',
  device_category text,
  referrer_category text,
  outcome text
);
create index if not exists analytics_events_name_received_idx
  on analytics_events(event_name, received_at desc);
create index if not exists analytics_events_session_received_idx
  on analytics_events(session_id, received_at desc);

