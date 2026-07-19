-- Уличная геометрия сегментов маршрута (OSRM foot) и пешеходное время между точками.
-- path_to_next: {coordinates: [[lng,lat],...], seconds, meters, source} для перехода к следующей точке;
-- у последней точки маршрута — NULL. Считается при сохранении маршрута и лечится лениво при чтении.
alter table route_stops
  add column if not exists path_to_next jsonb,
  add column if not exists walk_seconds_to_next int,
  add column if not exists walk_meters_to_next int;
