-- Точка на границе округа должна определяться детерминированно.
-- ST_Covers включает границу; при перекрытии выбирается меньший полигон, затем id.

create or replace function objects_set_district() returns trigger as $$
begin
  new.district_id := (
    select d.id
    from districts d
    where st_covers(d.geom, new.geom)
    order by st_area(d.geom) asc, d.id asc
    limit 1
  );
  return new;
end;
$$ language plpgsql;

create or replace function districts_reassign_objects() returns trigger
language plpgsql as $$
begin
  update objects o
  set district_id = (
    select d.id
    from districts d
    where st_covers(d.geom, o.geom)
    order by st_area(d.geom) asc, d.id asc
    limit 1
  )
  where o.district_id is distinct from (
    select d.id
    from districts d
    where st_covers(d.geom, o.geom)
    order by st_area(d.geom) asc, d.id asc
    limit 1
  );
  return null;
end;
$$;

update objects o
set district_id = (
  select d.id
  from districts d
  where st_covers(d.geom, o.geom)
  order by st_area(d.geom) asc, d.id asc
  limit 1
)
where o.district_id is distinct from (
  select d.id
  from districts d
  where st_covers(d.geom, o.geom)
  order by st_area(d.geom) asc, d.id asc
  limit 1
);
