#!/usr/bin/env python3
"""Build real Amap POIs/routes and FlyAI hotel results into map.html."""

from __future__ import annotations

import argparse
import html
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
            if key and key not in os.environ:
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
    def score(poi: dict[str, Any]) -> int:
        name = str(poi.get("name") or "")
        cityname = str(poi.get("cityname") or "")
        type_text = str(poi.get("type") or "")
        value = 0
        if original_name == name:
            value += 20
        if original_name in name or name in original_name:
            value += 12
        if city in cityname:
            value += 8
        if any(token in type_text for token in ["风景名胜", "旅游景点", "公园", "宗教"]):
            value += 5
        if poi.get("entr_location"):
            value += 3
        return value

    return max(pois, key=score)


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


def route_between(origin: list[float], destination: list[float], key: str) -> dict[str, Any]:
    params = {
        "key": key,
        "origin": f"{origin[0]},{origin[1]}",
        "destination": f"{destination[0]},{destination[1]}",
    }
    # Walking works best for compact scenic routes. Fall back to straight-line estimate.
    try:
        data = request_json(f"{AMAP_BASE}/direction/walking", params)
        route = (data.get("route") or {}).get("paths") or []
        if data.get("status") == "1" and route:
            path = route[0]
            return {
                "mode": "walking",
                "distance_m": int(float(path.get("distance", 0))),
                "duration_min": round(float(path.get("duration", 0)) / 60),
                "source": "amap_direction_walking",
            }
    except Exception:
        pass

    km = haversine_km(origin, destination)
    return {
        "mode": "estimated",
        "distance_m": round(km * 1000),
        "duration_min": round(km / 18 * 60),
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


def flyai_hotels(destination: str, poi_name: str, checkin: str, checkout: str) -> list[dict[str, Any]]:
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
        "--sort",
        "distance_asc",
    ]
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
    return (data.get("data") or {}).get("itemList") or []


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def render_map_html(title: str, js_key: str, payload: dict[str, Any]) -> str:
    safe_title = html.escape(title)
    data_json = json.dumps(payload, ensure_ascii=False)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title}路线地图</title>
  <style>
    html, body {{ margin: 0; height: 100%; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #25302b; }}
    .app {{ display: grid; grid-template-columns: 360px 1fr; height: 100vh; }}
    aside {{ overflow: auto; padding: 18px; background: #f7f3ea; border-right: 1px solid #e2d8c8; }}
    #map {{ min-height: 100vh; }}
    h1 {{ font-size: 20px; margin: 0 0 12px; }}
    h2 {{ font-size: 15px; margin: 20px 0 8px; color: #2f7d6e; }}
    .item {{ background: white; border: 1px solid #e8dfd2; border-radius: 8px; padding: 10px; margin: 8px 0; }}
    .meta {{ color: #69736d; font-size: 12px; line-height: 1.5; }}
    .price {{ color: #b45309; font-weight: 700; }}
    a {{ color: #2f7d6e; }}
    @media (max-width: 820px) {{ .app {{ grid-template-columns: 1fr; grid-template-rows: 45vh auto; }} aside {{ grid-row: 2; }} #map {{ min-height: 45vh; }} }}
  </style>
  <script src="https://webapi.amap.com/maps?v=2.0&key={html.escape(js_key)}"></script>
</head>
<body>
  <div class="app">
    <aside>
      <h1>{safe_title}</h1>
      <div id="summary"></div>
      <h2>路线</h2>
      <div id="pois"></div>
      <h2>酒店候选</h2>
      <div id="hotels"></div>
    </aside>
    <div id="map"></div>
  </div>
  <script>
    const data = {data_json};
    const validPois = data.pois.filter(p => Array.isArray(p.location));
    const center = validPois.length ? validPois[0].location : [120.1551, 30.2741];
    const map = new AMap.Map('map', {{ zoom: 12, center }});
    const bounds = [];
    validPois.forEach((poi, index) => {{
      const marker = new AMap.Marker({{
        position: poi.location,
        title: poi.name,
        label: {{ content: String(index + 1), direction: 'top' }}
      }});
      marker.setMap(map);
      marker.on('click', () => {{
        new AMap.InfoWindow({{ content: `<strong>${{poi.name}}</strong><br>${{poi.address || ''}}` }}).open(map, poi.location);
      }});
      bounds.push(poi.location);
    }});
    if (validPois.length > 1) {{
      const line = new AMap.Polyline({{
        path: validPois.map(p => p.location),
        strokeColor: '#2f7d6e',
        strokeWeight: 5,
        strokeOpacity: 0.85
      }});
      line.setMap(map);
    }}
    (data.hotels || []).filter(h => h.longitude && h.latitude).forEach(hotel => {{
      const position = [Number(hotel.longitude), Number(hotel.latitude)];
      const marker = new AMap.Marker({{ position, title: hotel.name, content: '<div style="background:#b45309;color:white;border-radius:12px;padding:3px 7px;font-size:12px;">住</div>' }});
      marker.setMap(map);
      marker.on('click', () => {{
        new AMap.InfoWindow({{ content: `<strong>${{hotel.name}}</strong><br>${{hotel.address || ''}}<br><span style="color:#b45309">${{hotel.price || ''}}</span><br><a href="${{hotel.detailUrl}}" target="_blank">飞猪查看</a>` }}).open(map, position);
      }});
      bounds.push(position);
    }});
    if (bounds.length) map.setFitView(null, false, [60, 60, 60, 60]);

    document.getElementById('summary').innerHTML = `<div class="meta">高德 POI：${{data.pois.length}} 个；路线段：${{data.routes.length}} 段；酒店：${{(data.hotels || []).filter(h => !h.error).length}} 个<br>生成时间：${{data.generated_at}}</div>`;
    document.getElementById('pois').innerHTML = data.pois.map((p, i) => `<div class="item"><strong>${{i + 1}}. ${{p.name}}</strong><div class="meta">${{p.address || '地址待核实'}}<br>${{p.confidence}} · ${{p.source}}</div></div>`).join('');
    document.getElementById('hotels').innerHTML = (data.hotels || []).map(h => h.error ? `<div class="item">${{h.error}}</div>` : `<div class="item"><strong>${{h.name}}</strong><div class="meta">${{h.address || ''}}<br><span class="price">${{h.price || '价格波动'}}</span> · ${{h.star || ''}}<br><a href="${{h.detailUrl}}" target="_blank">飞猪链接</a></div></div>`).join('');
  </script>
</body>
</html>
"""


def main() -> int:
    load_codex_env()
    parser = argparse.ArgumentParser(description="Build real Amap/FlyAI route map artifacts.")
    parser.add_argument("--destination", required=True, help="Destination city, e.g. 杭州")
    parser.add_argument("--city", help="Amap city hint; defaults to destination")
    parser.add_argument("--locations", help="Comma/newline separated POI names")
    parser.add_argument("--input", help="Input text, POI JSON, or itinerary JSON")
    parser.add_argument("--check-in-date", default=(date.today() + timedelta(days=1)).isoformat())
    parser.add_argument("--check-out-date", default=(date.today() + timedelta(days=3)).isoformat())
    parser.add_argument("--hotel-poi", help="POI name for hotel search; defaults to first location")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    args = parser.parse_args()

    amap_key = os.environ.get("AMAP_MAPS_API_KEY")
    js_key = os.environ.get("AMAP_WEB_JS_API_KEY")
    if not amap_key:
        print("Missing AMAP_MAPS_API_KEY.", file=sys.stderr)
        return 1
    if not js_key:
        print("Missing AMAP_WEB_JS_API_KEY.", file=sys.stderr)
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
    hotels = flyai_hotels(args.destination, args.hotel_poi or names[0], args.check_in_date, args.check_out_date)
    payload = {
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
    write_json(output_dir / "pois.json", payload)
    (output_dir / "map.html").write_text(
        render_map_html(f"{args.destination}旅行路线", js_key, payload),
        encoding="utf-8",
    )
    print(json.dumps({"pois_json": str(output_dir / "pois.json"), "map_html": str(output_dir / "map.html"), "poi_count": len(pois), "hotel_count": len([h for h in hotels if not h.get("error")])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
