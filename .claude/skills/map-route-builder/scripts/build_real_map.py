#!/usr/bin/env python3
"""Build accepted itinerary POIs/routes and hotel coordinates into map-data.json."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any


SPLIT_PATTERN = re.compile(r"[,，、;\n]+")
AMAP_BASE = os.environ.get("AMAP_REST_BASE", "http://restapi.amap.com/v3")


def load_codex_env() -> None:
    """Load simple KEY=\"VALUE\" entries from local env files if missing."""
    candidates = [
        Path.cwd() / ".env",
        Path.home() / ".codex" / ".env",
        Path.home() / ".flyai" / "config.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        if path.suffix == ".json":
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            for key, value in data.items():
                if isinstance(value, str) and key not in os.environ:
                    os.environ[key] = value
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and (path == Path.cwd() / ".env" or key not in os.environ):
                os.environ[key] = value


def request_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    last_data: dict[str, Any] = {}
    for attempt in range(3):
        with urllib.request.urlopen(f"{url}?{query}", timeout=15) as response:
            last_data = json.loads(response.read().decode("utf-8"))
        if last_data.get("infocode") not in {"10021", "10020"}:
            return last_data
        time.sleep(0.8 * (attempt + 1))
    return last_data


def split_locations(text: str) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for part in SPLIT_PATTERN.split(text):
        name = re.sub(r"\s+", " ", part.strip())
        if name and name not in seen:
            seen.add(name)
            output.append(name)
    return output


def strip_markdown(text: str) -> str:
    value = re.sub(r"\*\*(.*?)\*\*", r"\1", str(text or ""))
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", value)
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def split_markdown_row(line: str) -> list[str]:
    trimmed = line.strip()
    if not trimmed.startswith("|") or not trimmed.endswith("|"):
        return []
    return [strip_markdown(cell.strip()) for cell in trimmed[1:-1].split("|")]


def is_table_separator(line: str) -> bool:
    return bool(re.match(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", line or ""))


def markdown_tables(block: str) -> list[list[dict[str, str]]]:
    lines = block.splitlines()
    tables: list[list[dict[str, str]]] = []
    index = 0
    while index < len(lines) - 1:
        if not lines[index].strip().startswith("|") or not is_table_separator(lines[index + 1]):
            index += 1
            continue
        headers = split_markdown_row(lines[index])
        rows: list[dict[str, str]] = []
        cursor = index + 2
        while cursor < len(lines) and lines[cursor].strip().startswith("|"):
            if not is_table_separator(lines[cursor]):
                cells = split_markdown_row(lines[cursor])
                if len(cells) == len(headers):
                    rows.append(dict(zip(headers, cells)))
            cursor += 1
        if rows:
            tables.append(rows)
        index = cursor
    return tables


def is_generic_non_place(text: str) -> bool:
    return bool(
        re.search(
            r"^(早餐|午餐|晚餐|夜宵|餐食|休息|自由活动|返回酒店|酒店早餐|酒店入住|酒店退房|取行李|寄存行李|退房|办理入住|购物/其他|预算|预约|备注|午休|附近|基地附近|景区内|市区|成都市区|乌鲁木齐|继续|16:00)$",
            text,
        )
    )


def clean_place_candidate(text: str) -> str:
    value = strip_markdown(text)
    value = re.sub(r"[（(](?:可选|备选|若.*?|.*?样本价|.*?订票).*?[）)]", "", value)
    value = re.sub(r"\b[A-Z]{1,3}\d{3,5}\b", "", value)
    value = re.sub(r"[，,].*$", "", value)
    value = re.sub(r"^(抵达|前往|游览|参观|打卡|夜游|返回|出发前往|出发|办理入住)", "", value)
    value = re.sub(
        r"(出发|抵达|夜游|游览|参观|打卡|开园即入|购票入园|购票乘区间车|乘区间车.*|包车返回.*|返回市区|办理入住|休息|自由活动|逛街购物|午餐|晚餐|早餐).*$",
        "",
        value,
    )
    value = re.sub(r"\s+", " ", value).strip(" ，,、;；+-")
    return value


def place_candidates_from_activity(title: str) -> list[str]:
    raw = strip_markdown(title)
    if not raw:
        return []
    parts = re.split(r"→|到|至", raw) if "→" in raw else [raw]
    candidates: list[str] = []
    for part in parts:
        cleaned = clean_place_candidate(part)
        if not cleaned or len(cleaned) < 2 or is_generic_non_place(cleaned):
            continue
        if re.fullmatch(r"酒店|市区酒店|酒店附近|景区内午餐|自备干粮|游船体验|天池湖边|天鹅湖环湖徒步|照壁山/林间栈道|哈萨克毡房文化体验", cleaned):
            continue
        candidates.append(cleaned)
    return candidates


def locations_from_itinerary_markdown(text: str) -> list[str]:
    names: list[str] = []
    for table in markdown_tables(text):
        headers = set(table[0].keys()) if table else set()
        if "时间" in headers and "安排" in headers:
            for row in table:
                names.extend(place_candidates_from_activity(row.get("安排", "")))
        elif {"酒店", "位置"} & headers or {"酒店", "价格参考"} <= headers or {"酒店", "价格/晚"} <= headers:
            for row in table:
                hotel = row.get("酒店") or row.get("酒店名称") or row.get("候选酒店")
                if hotel:
                    names.append(strip_markdown(hotel))
    return split_locations(",".join(names))


def locations_from_input(args: argparse.Namespace) -> list[str]:
    if args.locations:
        return split_locations(args.locations)
    if args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
        if "## 每日行程" in raw or re.search(r"^###\s+Day\s+\d+", raw, re.M):
            names = locations_from_itinerary_markdown(raw)
            if names:
                return names
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return split_locations(raw)
        names: list[str] = []
        if isinstance(data, dict):
            if data.get("artifact_type") == "itinerary-structured":
                for day in data.get("days", []):
                    if not isinstance(day, dict):
                        continue
                    for row in day.get("timelineRows", []):
                        if not isinstance(row, dict):
                            continue
                        cells = row.get("cells") if isinstance(row.get("cells"), dict) else {}
                        title = cells.get("安排") or cells.get("活动") or cells.get("内容") or ""
                        names.extend(place_candidates_from_activity(str(title)))
                for hotel in data.get("hotelCandidates", []):
                    if isinstance(hotel, dict) and hotel.get("name"):
                        names.append(str(hotel.get("name")).strip())
            if isinstance(data.get("pois"), list):
                names.extend(str(p.get("name", "")).strip() for p in data["pois"] if isinstance(p, dict))
            for day in data.get("days", []):
                if not isinstance(day, dict):
                    continue
                names.extend(str(p.get("name", "")).strip() for p in day.get("pois", []) if isinstance(p, dict))
        elif isinstance(data, list):
            names.extend(str(p.get("name", "")).strip() for p in data if isinstance(p, dict))
        return split_locations(",".join(names))
    raise ValueError("Provide --locations or --input.")


def accepted_hotel_candidates_from_input(input_path: str | None) -> list[dict[str, Any]]:
    if not input_path:
        return []
    raw = Path(input_path).read_text(encoding="utf-8")
    candidates: list[dict[str, Any]] = []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = None

    if isinstance(data, dict) and data.get("artifact_type") == "itinerary-structured":
        for hotel in data.get("hotelCandidates", []):
            if not isinstance(hotel, dict) or not str(hotel.get("name") or "").strip():
                continue
            candidates.append(
                {
                    "name": str(hotel.get("name") or "").strip(),
                    "tier": str(hotel.get("tier") or "已接受候选").strip(),
                    "area": str(hotel.get("area") or "").strip(),
                    "price": str(hotel.get("priceReference") or hotel.get("price") or "").strip(),
                    "fit": str(hotel.get("fit") or "").strip(),
                    "tradeoffs": str(hotel.get("tradeoff") or hotel.get("tradeoffs") or "").strip(),
                    "booking_url": str(hotel.get("bookingUrl") or hotel.get("detailUrl") or hotel.get("jumpUrl") or hotel.get("url") or "").strip(),
                    "room_type_note": "按上游已接受酒店候选展示；房型以订票/查询链接实时页面为准。",
                    "source": "itinerary-structured accepted hotel candidate",
                }
            )
        return candidates

    for table in markdown_tables(raw):
        headers = set(table[0].keys()) if table else set()
        if not ({"酒店", "价格/晚"} <= headers or {"酒店", "价格参考"} <= headers or {"候选酒店", "价格"} <= headers):
            continue
        for row in table:
            name = row.get("酒店") or row.get("酒店名称") or row.get("候选酒店") or row.get("名称")
            if not name:
                continue
            booking_url = ""
            for value in row.values():
                match = re.search(r"https?://[^\s)）]+", str(value or ""))
                if match:
                    booking_url = match.group(0).rstrip("。。，，；;、")
                    break
            candidates.append(
                {
                    "name": strip_markdown(name),
                    "tier": strip_markdown(row.get("档次") or row.get("类型") or "已接受候选"),
                    "area": strip_markdown(row.get("位置/区域") or row.get("位置") or row.get("区域") or ""),
                    "price": strip_markdown(row.get("价格/晚") or row.get("价格参考") or row.get("价格") or ""),
                    "fit": strip_markdown(row.get("适合") or row.get("适合人群") or ""),
                    "tradeoffs": strip_markdown(row.get("取舍") or row.get("备注") or ""),
                    "booking_url": booking_url,
                    "room_type_note": "按上游已接受酒店候选展示；房型以订票/查询链接实时页面为准。",
                    "source": "itinerary.md accepted hotel candidate",
                }
            )
    return candidates


def amap_place_search(name: str, city: str, key: str) -> dict[str, Any] | None:
    attempts = [
        {"keywords": name, "citylimit": "true"},
        {"keywords": name, "citylimit": "false"},
        {"keywords": f"{city}{name}", "citylimit": "false"},
    ]
    for attempt in attempts:
        data = request_json(
            f"{AMAP_BASE}/place/text",
            {
                "key": key,
                "keywords": attempt["keywords"],
                "city": city,
                "citylimit": attempt["citylimit"],
                "offset": 5,
                "extensions": "all",
            },
        )
        pois = data.get("pois") or []
        if data.get("status") != "1" or not pois:
            continue
        poi = choose_best_poi(name, city, pois)
        loc = poi.get("entr_location") or poi.get("location", "")
        if "," not in loc:
            loc = poi.get("location", "")
        if "," in loc:
            lng, lat = loc.split(",", 1)
            return {
                "name": poi.get("name") or name,
                "original_name": name,
                "type": poi.get("type") or "",
                "address": poi.get("address") or "",
                "location": [float(lng), float(lat)],
                "tel": poi.get("tel") or "",
                "rating": (poi.get("biz_ext") or {}).get("rating") or "",
                "image": (((poi.get("photos") or [{}])[0]) or {}).get("url") or "",
                "photos": poi.get("photos") or [],
                "source": "amap_place_text",
                "confidence": "verified",
            }
    return None


def choose_best_poi(original_name: str, city: str, pois: list[dict[str, Any]]) -> dict[str, Any]:
    original_type = infer_query_type(original_name)

    def score(poi: dict[str, Any]) -> int:
        name = str(poi.get("name") or "")
        cityname = str(poi.get("cityname") or "")
        type_text = str(poi.get("type") or "")
        address = str(poi.get("address") or "")
        value = 0
        if original_name == name:
            value += 20
        if original_name in name or name in original_name:
            value += 12
        if city in cityname:
            value += 8
        if any(token in type_text for token in ["风景名胜", "旅游景点", "公园", "宗教"]):
            value += 5
        if original_type == "commercial" and any(token in type_text for token in ["商场", "购物中心", "特色商业街", "商业街", "步行街", "商圈", "热点地名", "城市广场"]):
            value += 10
        if original_type == "commercial" and any(token in type_text for token in ["家电电子卖场", "手机销售", "汽车销售", "公交车站"]):
            value -= 8
        if original_type == "museum" and any(token in type_text for token in ["科教文化", "博物馆", "展览馆", "科技馆"]):
            value += 8
        if original_type == "transport" and any(token in type_text for token in ["交通设施", "机场", "火车站", "地铁站"]):
            value += 8
        if original_type == "hotel" and "住宿服务" in type_text:
            value += 10
        if original_type != "hotel" and "住宿服务" in type_text:
            value -= 14
        if original_type != "restaurant" and "餐饮服务" in type_text:
            value -= 8
        if any(token in name for token in ["酒店", "宾馆", "公寓", "民宿"]) and original_type != "hotel":
            value -= 10
        if original_name in address:
            value += 2
        if poi.get("entr_location"):
            value += 3
        return value

    return max(pois, key=score)


def infer_query_type(name: str) -> str:
    if any(token in name for token in ["酒店", "民宿", "客栈", "宾馆", "住宿"]):
        return "hotel"
    if any(token in name for token in ["餐厅", "饭店", "小吃", "面馆", "咖啡", "茶", "火锅"]):
        return "restaurant"
    if any(token in name for token in ["机场", "车站", "火车站", "高铁站", "东站", "西站", "南站", "北站", "码头", "地铁"]):
        return "transport"
    if any(token in name for token in ["博物馆", "科技馆", "美术馆", "纪念馆", "展览馆"]):
        return "museum"
    if any(token in name for token in ["街", "巷", "太古里", "春熙路", "商圈", "步行街", "广场"]):
        return "commercial"
    return "attraction"


def amap_geocode(name: str, city: str, key: str) -> dict[str, Any] | None:
    data = request_json(
        f"{AMAP_BASE}/geocode/geo",
        {"key": key, "address": name, "city": city},
    )
    geocodes = data.get("geocodes") or []
    if data.get("status") == "1" and geocodes:
        geo = geocodes[0]
        loc = geo.get("location", "")
        if "," in loc:
            lng, lat = loc.split(",", 1)
            return {
                "name": name,
                "original_name": name,
                "type": "geocode",
                "address": geo.get("formatted_address") or "",
                "location": [float(lng), float(lat)],
                "tel": "",
                "rating": "",
                "source": "amap_geocode",
                "confidence": "approximate",
            }
    return None


def geocode_locations(names: list[str], city: str, key: str) -> list[dict[str, Any]]:
    pois: list[dict[str, Any]] = []
    for index, name in enumerate(names, start=1):
        poi = amap_place_search(name, city, key) or amap_geocode(name, city, key)
        if poi is None:
            poi = {
                "name": name,
                "original_name": name,
                "type": "unknown",
                "address": "",
                "location": None,
                "source": "unresolved",
                "confidence": "needs_verification",
            }
        poi["order"] = index
        pois.append(poi)
    return pois


def haversine_km(a: list[float], b: list[float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def amap_direction(origin: list[float], destination: list[float], key: str, mode: str) -> dict[str, Any] | None:
    params = {
        "key": key,
        "origin": f"{origin[0]},{origin[1]}",
        "destination": f"{destination[0]},{destination[1]}",
    }
    try:
        data = request_json(f"{AMAP_BASE}/direction/{mode}", params)
        route = (data.get("route") or {}).get("paths") or []
        if data.get("status") == "1" and route:
            path = route[0]
            return {
                "mode": mode,
                "distance_m": int(float(path.get("distance", 0))),
                "duration_min": round(float(path.get("duration", 0)) / 60),
                "source": f"amap_direction_{mode}",
            }
    except Exception:
        return None
    return None


def route_between(origin: list[float], destination: list[float], key: str) -> dict[str, Any]:
    km = haversine_km(origin, destination)
    # Only compact same-scenic-area hops should be treated as walking. Cross-city
    # legs are much less misleading as driving/taxi references unless itinerary
    # data later provides a better metro/transit segment.
    preferred_mode = "walking" if km <= 2.2 else "driving"
    segment = amap_direction(origin, destination, key, preferred_mode)
    if segment:
        return segment
    if preferred_mode != "driving":
        segment = amap_direction(origin, destination, key, "driving")
        if segment:
            return segment

    return {
        "mode": "estimated_driving" if km > 2.2 else "estimated_walking",
        "distance_m": round(km * 1000),
        "duration_min": round(km / (22 if km > 2.2 else 4.5) * 60),
        "source": "haversine_estimate",
    }


def build_routes(pois: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    routes: list[dict[str, Any]] = []
    usable = [poi for poi in pois if poi.get("location")]
    for previous, current in zip(usable, usable[1:]):
        segment = route_between(previous["location"], current["location"], key)
        segment.update({"from": previous["name"], "to": current["name"]})
        routes.append(segment)
    return routes

def compact_key(value: str) -> str:
    return re.sub(r"[（(].*?[）)]|[，,、\s/·.\-]", "", value or "").lower()


def is_hotel_like_poi(poi: dict[str, Any]) -> bool:
    type_text = str(poi.get("type") or "")
    name_text = str(poi.get("original_name") or "") + " " + str(poi.get("name") or "")
    return "住宿服务" in type_text or bool(re.search(r"酒店|宾馆|公寓|民宿|客栈|hotel", name_text, re.I))


def hotel_match_score(candidate_name: str, poi: dict[str, Any]) -> int:
    if not is_hotel_like_poi(poi):
        return 0
    target = compact_key(candidate_name)
    if not target:
        return 0
    keys = [
        compact_key(str(poi.get("original_name") or "")),
        compact_key(str(poi.get("name") or "")),
    ]
    if any(target == key for key in keys):
        return 100
    if any(target in key and len(target) >= 4 for key in keys):
        return 80
    if any(key in target and len(key) >= 4 for key in keys):
        return 70
    return 0


def enrich_accepted_hotels(candidates: list[dict[str, Any]], pois: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hotels: list[dict[str, Any]] = []
    for candidate in candidates:
        name = str(candidate.get("name") or "").strip()
        if not name:
            continue
        matches = [(hotel_match_score(name, poi), poi) for poi in pois]
        matched = max(matches, key=lambda item: item[0])[1] if matches and max(score for score, _ in matches) > 0 else {}
        location = matched.get("location") if isinstance(matched, dict) else None
        hotel = {
            **candidate,
            "name": name,
            "price": candidate.get("price") or "上游未提供价格，需实时复核",
            "tier": candidate.get("tier") or "已接受候选",
            "source": candidate.get("source") or "accepted hotel candidate",
        }
        if isinstance(location, list) and len(location) == 2:
            hotel["longitude"] = location[0]
            hotel["latitude"] = location[1]
            hotel["location"] = location
            hotel["coordinate_source"] = matched.get("source") or "amap"
        if matched.get("image"):
            hotel["image"] = matched["image"]
        hotels.append(hotel)
    return hotels


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    load_codex_env()
    parser = argparse.ArgumentParser(description="Build accepted itinerary POIs/routes into guidebook map data.")
    parser.add_argument("--destination", required=True, help="Destination city, e.g. 杭州")
    parser.add_argument("--city", help="Amap city hint; defaults to destination")
    parser.add_argument("--locations", help="Comma/newline separated POI names")
    parser.add_argument("--input", help="Input text, POI JSON, or itinerary JSON")
    parser.add_argument("--check-in-date", default=(date.today() + timedelta(days=1)).isoformat())
    parser.add_argument("--check-out-date", default=(date.today() + timedelta(days=3)).isoformat())
    parser.add_argument("--skip-hotels", action="store_true", help="Do not copy accepted hotel candidates into map-data.json")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    args = parser.parse_args()

    amap_key = os.environ.get("AMAP_MAPS_API_KEY")
    if not amap_key:
        print("Missing AMAP_MAPS_API_KEY.", file=sys.stderr)
        return 1

    names = locations_from_input(args)
    if not names:
        print("No locations found.", file=sys.stderr)
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    city = args.city or args.destination
    pois = geocode_locations(names, city, amap_key)
    routes = build_routes(pois, amap_key)
    accepted_hotels = [] if args.skip_hotels else accepted_hotel_candidates_from_input(args.input)
    hotels = enrich_accepted_hotels(accepted_hotels, pois)
    payload = {
        "schema_version": "1.1",
        "artifact_type": "map-data",
        "destination": args.destination,
        "city": city,
        "locations": names,
        "pois": pois,
        "routes": routes,
        "hotels": hotels,
        "check_in_date": args.check_in_date,
        "check_out_date": args.check_out_date,
        "generated_at": date.today().isoformat(),
    }
    write_json(output_dir / "map-data.json", payload)
    print(json.dumps({"map_data_json": str(output_dir / "map-data.json"), "poi_count": len(pois), "route_count": len(routes), "hotel_count": len([h for h in hotels if not h.get("error")])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
