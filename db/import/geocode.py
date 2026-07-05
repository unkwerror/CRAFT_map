#!/usr/bin/env python3
"""Геокодинг импортированных объектов (geocode_status = pending) через Nominatim.

Запуск (нужен psycopg, см. db/import/README.md):
    import/.venv/bin/python import/geocode.py

Правила (IMPORT_MONUMENTS.md, шаг 2):
- rate limit 1 req/sec, User-Agent проекта;
- результат обязан попадать в bbox Тюмени (57.05–57.25 N, 65.35–65.75 E);
- high   — памятник/мемориал или точный адрес с домом;
- medium — объект-контейнер (парк, сквер, площадь и т.п.): центр как первое приближение;
- failed — ничего валидного (geom не пишем).

Ошибки сети/HTTP не меняют статус — объект остаётся pending, перезапуск доберёт.
Отчёт: db/import/geocode_report.md (статусы + сверка округов + возможные дубли).
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    import psycopg
except ImportError:
    sys.exit("Нужен psycopg: python3 -m venv import/.venv && import/.venv/bin/pip install 'psycopg[binary]'")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://craft:craft@localhost:5433/craft_map")
NOMINATIM = "https://nominatim.openstreetmap.org/search"
# только ASCII — HTTP-заголовки кодируются latin-1
USER_AGENT = "CRAFT-map-import/1.0 (Tyumen memorial objects map, craft72.ru)"
BBOX = {"lat_min": 57.05, "lat_max": 57.25, "lon_min": 65.35, "lon_max": 65.75}
REPORT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geocode_report.md")

# Точечные типы: сам искомый объект — уверенность high
HIGH_TYPES = {
    ("historic", "memorial"), ("historic", "monument"), ("historic", "statue"),
    ("historic", "tank"), ("historic", "cannon"), ("historic", "locomotive"),
    ("historic", "aircraft"), ("historic", "vehicle"), ("historic", "wayside_cross"),
    ("tourism", "artwork"), ("tourism", "attraction"), ("man_made", "obelisk"),
}
# Контейнеры: центр допустим как первое приближение — medium
CONTAINER_TYPES = {
    ("leisure", "park"), ("leisure", "garden"), ("leisure", "common"),
    ("leisure", "recreation_ground"), ("leisure", "nature_reserve"),
    ("place", "square"), ("highway", "pedestrian"), ("landuse", "cemetery"),
    ("landuse", "recreation_ground"), ("landuse", "village_green"), ("landuse", "grass"),
}


def in_bbox(lat: float, lon: float) -> bool:
    return BBOX["lat_min"] <= lat <= BBOX["lat_max"] and BBOX["lon_min"] <= lon <= BBOX["lon_max"]


def fetch(query: str) -> list:
    params = urllib.parse.urlencode({
        "q": query,
        "format": "jsonv2",
        "limit": 3,
        "countrycodes": "ru",
        "addressdetails": 1,
        "accept-language": "ru",
    })
    req = urllib.request.Request(f"{NOMINATIM}?{params}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def classify(item: dict) -> str:
    """high | medium для валидного кандидата."""
    cat, typ = item.get("category"), item.get("type")
    if (cat, typ) in HIGH_TYPES:
        return "high"
    if item.get("address", {}).get("house_number"):
        return "high"
    return "medium"  # контейнер или иная неточная сущность — первое приближение


def describe(item: dict) -> str:
    name = item.get("display_name", "")
    short = ", ".join(name.split(", ")[:3])
    return f"{item.get('category')}/{item.get('type')}: {short}"


def pick(results: list):
    """Лучший кандидат: сперва high, иначе первый валидный (medium)."""
    valid = [r for r in results if in_bbox(float(r["lat"]), float(r["lon"]))]
    if not valid:
        return None, None
    for r in valid:
        if classify(r) == "high":
            return r, "high"
    return valid[0], classify(valid[0])


def write_report(cur) -> None:
    """Отчёт по текущему состоянию БД: статусы + сверка округов + возможные дубли.

    Вызывается и из geocode.py, и из geocode_overpass.py (второй проход).
    """
    cur.execute("""
        select source_id, title, coalesce(geocode_query, ''), geocode_status,
               coalesce(geocode_note, '—')
        from objects
        where source_id is not null
        order by array_position(
                   array['failed', 'pending', 'medium', 'high', 'verified'], geocode_status),
                 source_id""")
    rows = cur.fetchall()
    counts = {}
    for _, _, _, status, _ in rows:
        counts[status] = counts.get(status, 0) + 1

    cur.execute("""
        select o.source_id, o.title, o.import_district, coalesce(d.name, '— вне округов —')
        from objects o
        left join districts d on d.id = o.district_id
        where o.source_id is not null and o.geom is not null
          and o.import_district is distinct from d.name
        order by o.source_id""")
    mismatches = cur.fetchall()

    cur.execute("""
        select a.source_id, a.title, b.source_id, b.title,
               round(st_distance(a.geom::geography, b.geom::geography))
        from objects a
        join objects b on a.source_id < b.source_id
          and st_dwithin(a.geom::geography, b.geom::geography, 100)
        where a.source_id is not null and b.source_id is not null
        order by 5""")
    dupes = cur.fetchall()

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("# Отчёт геокодинга monuments.json\n\n")
        f.write(" · ".join(f"{k}: {v}" for k, v in sorted(counts.items())) + "\n\n")
        f.write("Статусы medium, failed и pending требуют ручной проверки в админке: "
                "`/admin/import-review`.\n\n")
        f.write("| id | Объект | Запрос | Статус | Что нашлось |\n|---|---|---|---|---|\n")
        for sid, title, query, status, note in rows:
            f.write(f"| {sid} | {title} | {query} | **{status}** | {note} |\n")

        f.write("\n## Расхождения округов (доска vs ST_Contains)\n\n")
        if mismatches:
            f.write("| id | Объект | На доске | По координате |\n|---|---|---|---|\n")
            for sid, title, declared, actual in mismatches:
                f.write(f"| {sid} | {title} | {declared} | {actual} |\n")
        else:
            f.write("Расхождений нет.\n")

        f.write("\n## Возможные дубли (ближе 100 м)\n\n")
        if dupes:
            f.write("| id A | Объект A | id B | Объект B | Дистанция, м |\n|---|---|---|---|---|\n")
            for sa, ta, sb, tb, dist in dupes:
                f.write(f"| {sa} | {ta} | {sb} | {tb} | {dist:.0f} |\n")
        else:
            f.write("Пар ближе 100 м не найдено.\n")
    print(f"отчёт: {REPORT_PATH}")


def main() -> None:
    conn = psycopg.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("""
        select id, source_id, title, coalesce(geocode_query, 'Тюмень, ' || title)
        from objects
        where geocode_status = 'pending' and source_id is not null
        order by source_id""")
    pending = cur.fetchall()
    print(f"pending: {len(pending)}")

    rows = []  # (source_id, title, query, status, note)
    counts = {"high": 0, "medium": 0, "failed": 0, "error": 0}

    for i, (oid, source_id, title, query) in enumerate(pending):
        if i:
            time.sleep(1.1)  # rate limit Nominatim
        try:
            results = fetch(query)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            counts["error"] += 1
            rows.append((source_id, title, query, "pending (ошибка сети)", str(e)))
            print(f"  [{source_id}] {title}: ошибка запроса — {e}", file=sys.stderr)
            continue

        item, status = pick(results)
        if item is None:
            counts["failed"] += 1
            note = "ничего валидного в bbox Тюмени" if results else "пустой ответ Nominatim"
            cur.execute(
                "update objects set geocode_status = 'failed', geocode_note = %s where id = %s",
                (note, oid))
            rows.append((source_id, title, query, "failed", note))
        else:
            counts[status] += 1
            note = describe(item)
            cur.execute("""
                update objects
                set geom = st_setsrid(st_makepoint(%s, %s), 4326),
                    geocode_status = %s, geocode_note = %s
                where id = %s""",
                (float(item["lon"]), float(item["lat"]), status, note, oid))
            rows.append((source_id, title, query, status, note))
        print(f"  [{source_id}] {title}: {rows[-1][3]}")

    write_report(cur)
    conn.close()
    print(f"итог: {counts}")


if __name__ == "__main__":
    main()
