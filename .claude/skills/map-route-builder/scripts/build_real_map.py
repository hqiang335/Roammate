#!/usr/bin/env python3
"""Build real Amap POIs/routes and FlyAI hotel results into reusable map data."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
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


def locations_from_input(args: argparse.Namespace) -> list[str]:
    if args.locations:
        return split_locations(args.locations)
    if args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return split_locations(raw)
        names: list[str] = []
        if isinstance(data, dict):
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


def hotel_text(item: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    info = item.get("info") if isinstance(item.get("info"), dict) else {}
    for key in keys:
        value = info.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def hotel_price(item: dict[str, Any]) -> str:
    value = hotel_text(item, "price", "ticketPrice")
    if not value:
        return ""
    return value if value.startswith("¥") else f"¥{value}"


def hotel_price_number(item: dict[str, Any]) -> float | None:
    text = hotel_price(item)
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def looks_like_budget_hostel(item: dict[str, Any]) -> bool:
    name = hotel_text(item, "name", "title")
    star = hotel_text(item, "star")
    price = hotel_price_number(item)
    hostel_tokens = ["青旅", "青年旅舍", "青年旅社", "背包", "床位", "多人间"]
    if any(token in name for token in hostel_tokens):
        return True
    return price is not None and price < 100 and star in {"", "经济型"}


def run_flyai_hotel_query(destination: str, poi_name: str, checkin: str, checkout: str, profile: dict[str, Any]) -> list[dict[str, Any]]:
    if not checkin or not checkout:
        return [{"error": "Hotel search skipped: check-in/check-out dates are required by FlyAI."}]
    cmd = [
        "flyai",
        "search-hotel",
        "--dest-name",
        destination,
        "--poi-name",
        poi_name,
        "--check-in-date",
        checkin,
        "--check-out-date",
        checkout,
    ]
    for flag, value in profile.get("options", []):
        if value is None or value == "":
            continue
        cmd.extend([flag, str(value)])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45, check=False)
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"FlyAI failed: {exc}"}]
    if result.returncode != 0:
        return [{"error": result.stderr.strip() or "FlyAI command failed"}]
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return [{"error": "FlyAI returned non-JSON output"}]
    items = (data.get("data") or {}).get("itemList") or []
    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        room_type = hotel_text(item, "roomType", "roomName", "hotelRoomName", "bedType", "room")
        booking_url = hotel_text(item, "detailUrl", "jumpUrl", "url")
        normalized.append(
            {
                **item,
                "tier": profile["tier"],
                "query_profile": profile["name"],
                "name": hotel_text(item, "name", "title"),
                "address": hotel_text(item, "address"),
                "area": hotel_text(item, "interestsPoi", "area"),
                "price": hotel_price(item),
                "star": hotel_text(item, "star"),
                "booking_url": booking_url,
                "detailUrl": booking_url or hotel_text(item, "detailUrl"),
                "room_type": room_type or "FlyAI未返回具体房型",
                "room_type_status": "confirmed" if room_type else "not_returned_by_flyai",
                "room_type_note": (
                    "FlyAI返回的真实房型/床型字段。"
                    if room_type
                    else "FlyAI search-hotel 仅返回酒店级价格，未返回具体房型；不得编造，需点击飞猪链接确认可订房型。"
                ),
                "source": "FlyAI booking reference",
                "fit": profile.get("fit", ""),
                "tradeoffs": profile.get("tradeoffs", ""),
            }
        )
    return normalized


def flyai_hotels(
    destination: str,
    poi_name: str,
    checkin: str,
    checkout: str,
    hotel_bed_types: str = "",
    include_budget_hostels: bool = False,
) -> list[dict[str, Any]]:
    common_bed_filter = [("--hotel-bed-types", hotel_bed_types)] if hotel_bed_types else []
    profiles = [
        {
            "name": "economy_price",
            "tier": "经济/交通优先",
            "fit": "预算敏感、只需要基础住宿和可接受交通。",
            "tradeoffs": "价格优先，需额外核实隔音、房间面积和亲子舒适度。",
            "limit": 1,
            "options": [("--sort", "price_asc"), ("--hotel-types", "hotel"), ("--max-price", 500), *common_bed_filter],
        },
        {
            "name": "comfort_family",
            "tier": "舒适/亲子优先",
            "fit": "带孩子、希望房间和早餐更稳妥、降低通勤和休息成本。",
            "tradeoffs": "价格通常高于经济型，热门日期需尽早确认房型。",
            "limit": 4,
            "options": [("--sort", "rate_desc"), ("--hotel-stars", "4,5"), *common_bed_filter],
        },
        {
            "name": "location_first",
            "tier": "位置优先",
            "fit": "晚间吃饭、返程、临时休息便利性优先。",
            "tradeoffs": "核心区可能更贵或房间偏小。",
            "limit": 2,
            "options": [("--sort", "distance_asc"), *common_bed_filter],
        },
        {
            "name": "special_stay",
            "tier": "特色/民宿备选",
            "fit": "想要公寓、民宿、客栈等不同住宿体验时备选。",
            "tradeoffs": "服务稳定性、前台、早餐和亲子设施需逐项核实。",
            "limit": 1,
            "options": [("--sort", "rate_desc"), ("--hotel-types", "homestay,inn"), ("--max-price", 800), *common_bed_filter],
        },
    ]
    hotels: list[dict[str, Any]] = []
    errors: list[str] = []
    seen: set[str] = set()
    for profile in profiles:
        results = run_flyai_hotel_query(destination, poi_name, checkin, checkout, profile)
        if len(results) == 1 and results[0].get("error"):
            errors.append(f"{profile['name']}: {results[0]['error']}")
            continue
        accepted_for_profile = 0
        for item in results:
            if not include_budget_hostels and looks_like_budget_hostel(item):
                continue
            key = item.get("shId") or item.get("booking_url") or item.get("name")
            if not key or key in seen:
                continue
            seen.add(str(key))
            hotels.append(item)
            accepted_for_profile += 1
            if accepted_for_profile >= int(profile.get("limit", 2)) or len(hotels) >= 8:
                break
        if len(hotels) >= 8:
            break
    if hotels:
        return hotels
    if errors:
        return [{"error": "FlyAI hotel queries failed: " + " | ".join(errors)}]
    return []


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    load_codex_env()
    parser = argparse.ArgumentParser(description="Build real Amap/FlyAI route map artifacts.")
    parser.add_argument("--destination", required=True, help="Destination city, e.g. 杭州")
    parser.add_argument("--city", help="Amap city hint; defaults to destination")
    parser.add_argument("--locations", help="Comma/newline separated POI names")
    parser.add_argument("--input", help="Input text, POI JSON, or itinerary JSON")
    parser.add_argument("--check-in-date", default=(date.today() + timedelta(days=1)).isoformat())
    parser.add_argument("--check-out-date", default=(date.today() + timedelta(days=3)).isoformat())
    parser.add_argument("--skip-hotels", action="store_true", help="Skip FlyAI hotel inventory when no plausible dates can be inferred or the user asks not to query hotels")
    parser.add_argument("--hotel-poi", help="POI name for hotel search; defaults to first location")
    parser.add_argument("--hotel-bed-types", default="", help="Optional FlyAI bed-type filter, e.g. twin,multi for family trips")
    parser.add_argument("--include-budget-hostels", action="store_true", help="Include very low-price hostels/dorm-like stays in hotel inventory")
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
    hotels = [] if args.skip_hotels else flyai_hotels(
        args.destination,
        args.hotel_poi or names[0],
        args.check_in_date,
        args.check_out_date,
        args.hotel_bed_types,
        args.include_budget_hostels,
    )
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
    write_json(output_dir / "pois.json", payload)
    print(json.dumps({"map_data_json": str(output_dir / "map-data.json"), "legacy_pois_json": str(output_dir / "pois.json"), "poi_count": len(pois), "route_count": len(routes), "hotel_count": len([h for h in hotels if not h.get("error")])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
