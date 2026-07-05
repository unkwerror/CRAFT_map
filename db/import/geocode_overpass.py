#!/usr/bin/env python3
"""Второй проход геокодинга: Overpass API + нечёткое сопоставление названий.

Nominatim плохо ищет памятники по свободному тексту (см. geocode_report.md).
Здесь другой подход: одним запросом выгружаем ВСЕ поименованные мемориалы,
скульптуры, скверы и площади Тюмени из OSM и сопоставляем с нашими объектами
локально (difflib). Без API-ключей — в духе «Альтернатива/дополнение» шага 2
IMPORT_MONUMENTS.md.

Обрабатываются объекты со статусом failed и pending, а также medium
(попытка повысить точность: контейнер → сам памятник).

Запуск: import/.venv/bin/python import/geocode_overpass.py
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from difflib import SequenceMatcher

try:
    import psycopg
except ImportError:
    sys.exit("Нужен psycopg, см. db/import/README.md")

from geocode import BBOX, DATABASE_URL, USER_AGENT, write_report

OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX_STR = f"{BBOX['lat_min']},{BBOX['lon_min']},{BBOX['lat_max']},{BBOX['lon_max']}"

# Пороги схожести названий (после нормализации)
HIGH_RATIO = 0.86
MEDIUM_RATIO = 0.72

QUERY = f"""
[out:json][timeout:90];
(
  nwr["historic"]["name"]({BBOX_STR});
  nwr["memorial"]["name"]({BBOX_STR});
  nwr["tourism"~"artwork|attraction"]["name"]({BBOX_STR});
  nwr["man_made"~"obelisk|flagpole"]["name"]({BBOX_STR});
  nwr["leisure"~"park|garden|common|recreation_ground"]["name"]({BBOX_STR});
  nwr["place"="square"]["name"]({BBOX_STR});
  nwr["highway"="pedestrian"]["area"="yes"]["name"]({BBOX_STR});
  nwr["landuse"~"cemetery|village_green|recreation_ground"]["name"]({BBOX_STR});
);
out center tags;
"""

# Типы, где найден сам объект (уверенность high при хорошем совпадении имени)
POINT_KEYS = ("historic", "memorial", "tourism", "man_made")

STOPWORDS = {"им", "имени", "г", "гг", "год", "года", "лет"}

# Родовые слова не считаются значимым пересечением: у «Памятника Ленину» и
# «Памятника Федюнинскому» общее только слово «памятник» — это не совпадение.
GENERIC = {
    "памятник", "памятный", "памятная", "знак", "мемориал", "мемориальный",
    "монумент", "бюст", "стела", "обелиск", "скульптура", "камень", "плита",
    "сквер", "парк", "площадь", "аллея", "воинам", "войны", "войне", "великой",
    "отечественной", "погибшим", "павшим", "годы",
}


def normalize(s: str) -> str:
    s = s.lower().replace("ё", "е")
    s = re.sub(r"[«»\"'().,–—\-№/]", " ", s)
    tokens = [t for t in s.split() if t not in STOPWORDS]
    return " ".join(tokens)


def sig_overlap(a: str, b: str) -> bool:
    """Есть ли у строк общий значимый токен (с поправкой на падежные окончания)."""
    ta = [t for t in a.split() if len(t) >= 4 and t not in GENERIC]
    tb = [t for t in b.split() if len(t) >= 4 and t not in GENERIC]
    for x in ta:
        for y in tb:
            k = min(len(x), len(y)) - 2  # ленину/ленина, авиаторам/авиаторов
            if k >= 4 and x[:k] == y[:k]:
                return True
    return False


def similarity(a: str, b: str) -> float:
    """Схожесть нормализованных строк: ratio + бонус за вложенность."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # вложенность («сквер пограничников» ⊂ «сквер пограничников тюмень») —
    # только если строки сопоставимы по длине, иначе короткое общее место
    # «прилипает» к любому длинному названию
    if (a in b or b in a) and min(len(a), len(b)) >= 10 \
            and min(len(a), len(b)) >= 0.4 * max(len(a), len(b)):
        return 0.95
    return SequenceMatcher(None, a, b).ratio()


def fetch_osm() -> list[dict]:
    req = urllib.request.Request(
        OVERPASS,
        data=("data=" + urllib.parse.quote(QUERY)).encode(),
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        elements = json.loads(resp.read().decode())["elements"]

    out = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if not name or lat is None:
            continue
        is_point = any(k in tags for k in POINT_KEYS)
        kind = next((f"{k}/{tags[k]}" for k in
                     ("historic", "memorial", "tourism", "man_made", "leisure", "place",
                      "highway", "landuse") if k in tags), "?")
        out.append({"name": name, "norm": normalize(name), "lat": lat, "lon": lon,
                    "point": is_point, "kind": kind})
    return out


def best_match(candidates: list[dict], text: str | None):
    """Лучший кандидат по схожести названия; (кандидат, score) или (None, 0)."""
    if not text:
        return None, 0.0
    norm = normalize(text)
    best, best_score = None, 0.0
    for c in candidates:
        score = similarity(norm, c["norm"])
        # без общего значимого слова доверяем только почти дословному совпадению
        if score < 0.92 and not sig_overlap(norm, c["norm"]):
            continue
        # при равной схожести предпочитаем сам памятник, а не контейнер
        if score > best_score or (score == best_score and best and c["point"] and not best["point"]):
            best, best_score = c, score
    return best, best_score


def main() -> None:
    osm = fetch_osm()
    points = [c for c in osm if c["point"]]
    containers = [c for c in osm if not c["point"]]
    print(f"OSM-объекты Тюмени: {len(points)} памятников/арт-объектов, {len(containers)} контейнеров")

    conn = psycopg.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
        select id, source_id, title, address, geocode_status
        from objects
        where geocode_status in ('failed', 'pending', 'medium') and source_id is not null
        order by source_id""")
    todo = cur.fetchall()
    print(f"на втором проходе: {len(todo)}")

    upgraded = {"high": 0, "medium": 0}
    for oid, source_id, title, address, old_status in todo:
        # 1) сам памятник по названию
        cand, score = best_match(points, title)
        status, note = None, None
        if cand and score >= HIGH_RATIO:
            status = "high"
            note = f"overpass {cand['kind']}: {cand['name']} (совпадение {score:.2f})"
        elif cand and score >= MEDIUM_RATIO:
            status = "medium"
            note = f"overpass {cand['kind']}: {cand['name']} (похоже, {score:.2f}) — проверить"
        else:
            # 2) контейнер (сквер/парк/площадь) по адресу с доски
            cand2, score2 = best_match(containers, address)
            if cand2 and score2 >= HIGH_RATIO and old_status != "medium":
                status = "medium"
                note = f"overpass {cand2['kind']}: центр «{cand2['name']}» (первое приближение)"
                cand = cand2

        if status is None:
            continue
        # medium не понижаем и не дёргаем координату ради того же уровня
        if old_status == "medium" and status != "high":
            continue

        cur.execute("""
            update objects
            set geom = st_setsrid(st_makepoint(%s, %s), 4326),
                geocode_status = %s, geocode_note = %s
            where id = %s""",
            (cand["lon"], cand["lat"], status, note, oid))
        upgraded[status] += 1
        print(f"  [{source_id}] {title} ({old_status} → {status}): {note}")

    write_report(cur)
    conn.close()
    print(f"итог второго прохода: {upgraded}")


if __name__ == "__main__":
    main()
