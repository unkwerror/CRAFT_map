-- Фаза 3: типизированный граф городской памяти, хронология и архивные медиа.
create table if not exists people (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, aliases jsonb not null default '[]'::jsonb,
  birth_year int, death_year int, short_bio text, biography text, portrait_url text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','needs_review','verified')),
  editorial_status text not null default 'draft' check (editorial_status in ('draft','review','changes_requested','approved','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (death_year is null or birth_year is null or death_year >= birth_year)
);
create index if not exists people_public_idx on people(editorial_status,name);
create index if not exists people_aliases_idx on people using gin(aliases);

create table if not exists historical_events (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  date_from date, date_to date, approximate boolean not null default false,
  description text, geography text, verification_status text not null default 'unverified',
  editorial_status text not null default 'draft' check (editorial_status in ('draft','review','changes_requested','approved','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (date_to is null or date_from is null or date_to >= date_from)
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, website text, editorial_status text not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists archive_documents (
  id uuid primary key default gen_random_uuid(), title text not null, document_type text,
  document_date date, archive_code text, url text, rights_status text,
  editorial_status text not null default 'draft', created_at timestamptz not null default now()
);

create table if not exists object_people (
  object_id uuid not null references objects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  relation_type text not null, public_note text, primary key(object_id,person_id,relation_type)
);
create table if not exists object_historical_events (
  object_id uuid not null references objects(id) on delete cascade,
  event_id uuid not null references historical_events(id) on delete cascade,
  relation_type text not null, primary key(object_id,event_id,relation_type)
);
create table if not exists person_historical_events (
  person_id uuid not null references people(id) on delete cascade,
  event_id uuid not null references historical_events(id) on delete cascade,
  relation_type text not null, primary key(person_id,event_id,relation_type)
);

create table if not exists timeline_entries (
  id uuid primary key default gen_random_uuid(), object_id uuid not null references objects(id) on delete cascade,
  entry_type text not null check (entry_type in ('creation','opening','move','damage','restoration','commemoration','other')),
  date_from date, date_to date, approximate boolean not null default false,
  title text not null, description text, editorial_status text not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (date_to is null or date_from is null or date_to >= date_from)
);
create index if not exists timeline_entries_object_date_idx on timeline_entries(object_id,date_from);

create table if not exists archive_media (
  id uuid primary key default gen_random_uuid(), object_id uuid not null references objects(id) on delete cascade,
  timeline_entry_id uuid references timeline_entries(id) on delete set null,
  capture_from date, capture_to date, approximate boolean not null default false,
  file_url text not null, current_file_url text, source_id uuid references content_sources(id) on delete restrict,
  rights_status text not null, original_author text, alt_text text not null,
  camera_lat double precision, camera_lng double precision, camera_direction_degrees numeric(5,2),
  verification_status text not null default 'unverified', editorial_status text not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (capture_to is null or capture_from is null or capture_to >= capture_from),
  check (editorial_status <> 'published' or (source_id is not null and rights_status <> '' and alt_text <> ''))
);
alter table archive_media add column if not exists timeline_entry_id uuid references timeline_entries(id) on delete set null;
create index if not exists archive_media_timeline_idx on archive_media(timeline_entry_id);
