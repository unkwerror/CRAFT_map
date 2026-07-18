-- Фаза 2: маршруты и аудиопрогулки. Полностью расширяющая миграция.
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft'
    check (status in ('draft','review','changes_requested','approved','published','archived')),
  title text not null,
  summary text,
  description text,
  cover_url text,
  theme text,
  mode text not null default 'walking' check (mode in ('walking','bicycle','car')),
  estimated_duration_minutes int check (estimated_duration_minutes > 0),
  distance_meters int check (distance_meters >= 0),
  audio_duration_seconds int check (audio_duration_seconds >= 0),
  difficulty text,
  season text,
  recommended_time text,
  age_group text,
  accessibility_profile jsonb not null default '{}'::jsonb,
  start_geom geometry(Point, 4326),
  end_geom geometry(Point, 4326),
  geom geometry(LineString, 4326),
  locale text not null default 'ru',
  offline_package_version int not null default 1 check (offline_package_version > 0),
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routes_public_idx on routes(status, locale, updated_at desc);
create index if not exists routes_geom_idx on routes using gist(geom);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  object_id uuid not null references objects(id) on delete restrict,
  position int not null check (position > 0),
  arrival_radius_meters int not null default 40 check (arrival_radius_meters between 10 and 500),
  recommended_duration_minutes int check (recommended_duration_minutes > 0),
  intro_text text,
  directions_text text,
  short_audio_variant_id uuid references audio_variants(id) on delete set null,
  full_audio_variant_id uuid references audio_variants(id) on delete set null,
  gps_autoplay boolean not null default false,
  quiz jsonb,
  alternative_object_id uuid references objects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, position),
  unique (route_id, object_id)
);
create index if not exists route_stops_route_idx on route_stops(route_id, position);

create table if not exists route_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  route_id uuid not null references routes(id) on delete cascade,
  route_version int not null,
  reached_stop_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, route_id)
);

