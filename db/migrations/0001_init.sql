-- Карта памятных объектов Тюмени — начальная схема

create extension if not exists postgis;

create table categories (
  id text primary key,            -- 'patriotism' | 'memory' | 'dignity' | 'continuity'
  title text not null,
  color text not null             -- hex из брендбука
);

create table districts (
  id serial primary key,
  name text not null unique,      -- Калининский, Ленинский, Центральный, Восточный
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
  photos jsonb not null default '[]',   -- [{original, thumb, alt}]
  published boolean not null default true,
  sort_weight int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index objects_geom_idx on objects using gist(geom);
create index objects_category_idx on objects(category_id);
create index objects_district_idx on objects(district_id);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  constraint users_role_check check (role in ('admin', 'editor'))
);

-- district_id проставляется автоматически по ST_Contains
create or replace function objects_set_district() returns trigger
language plpgsql as $$
begin
  new.district_id := (select d.id from districts d where st_contains(d.geom, new.geom) limit 1);
  return new;
end;
$$;

create trigger objects_set_district_trg
  before insert or update of geom on objects
  for each row execute function objects_set_district();

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger objects_updated_at_trg
  before update on objects
  for each row execute function set_updated_at();

-- при изменении границ округов пересчитать привязку объектов
create or replace function districts_reassign_objects() returns trigger
language plpgsql as $$
begin
  update objects o
  set district_id = sub.did
  from (
    select o2.id as oid,
           (select d.id from districts d where st_contains(d.geom, o2.geom) limit 1) as did
    from objects o2
  ) sub
  where sub.oid = o.id and o.district_id is distinct from sub.did;
  return null;
end;
$$;

create trigger districts_reassign_trg
  after insert or update or delete on districts
  for each statement execute function districts_reassign_objects();

-- Статистика по округам — только из view, не руками (см. CLAUDE.md)
create view district_stats as
select d.name,
       count(o.id) as cnt,
       coalesce(round(100.0 * count(o.id) / nullif(sum(count(o.id)) over (), 0), 2), 0) as pct
from districts d
left join objects o on o.district_id = d.id and o.published
group by d.name
order by cnt desc, d.name;
