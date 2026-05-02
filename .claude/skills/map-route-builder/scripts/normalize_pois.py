#!/usr/bin/env python3
"""Normalize text or itinerary JSON into Roammate POI JSON."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SPLIT_PATTERN = re.compile(r"[,，、;\n]+")


def clean_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip())


def infer_type(name: str) -> str:
    if any(token in name for token in ["酒店", "民宿", "客栈"]):
        return "hotel"
    if any(token in name for token in ["餐厅", "饭店", "小吃", "面馆", "咖啡", "茶"]):
        return "restaurant"
    if any(token in name for token in ["机场", "车站", "火车站", "高铁站", "东站", "西站", "南站", "北站", "码头", "地铁"]):
        return "transport"
    return "attraction"


def pois_from_text(text: str) -> list[dict[str, Any]]:
    names = [clean_name(part) for part in SPLIT_PATTERN.split(text) if clean_name(part)]
    seen: set[str] = set()
    pois: list[dict[str, Any]] = []
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        pois.append(
            {
                "name": name,
                "type": infer_type(name),
                "day": None,
                "order": len(pois) + 1,
                "source": "text",
                "confidence": "user-provided",
            }
        )
    return pois


def pois_from_itinerary(data: dict[str, Any]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()
    for day in data.get("days", []):
        day_no = int(day.get("day", len(output) + 1)) if isinstance(day, dict) else None
        if not isinstance(day, dict):
            continue
        for order, poi in enumerate(day.get("pois", []), start=1):
            if not isinstance(poi, dict):
                continue
            name = clean_name(str(poi.get("name", "")))
            if not name:
                continue
            key = (day_no or 0, name)
            if key in seen:
                continue
            seen.add(key)
            output.append(
                {
                    "name": name,
                    "type": poi.get("type") or infer_type(name),
                    "day": day_no,
                    "order": order,
                    "estimated_duration_minutes": poi.get("estimated_duration_minutes"),
                    "reservation_required": poi.get("reservation_required"),
                    "source": "itinerary",
                    "confidence": "planned",
                }
            )
    return output


def read_input(args: argparse.Namespace) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    metadata: dict[str, Any] = {}
    if args.text:
        return pois_from_text(args.text), metadata

    if args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return pois_from_text(raw), metadata
        if isinstance(data, dict):
            metadata = {key: data.get(key) for key in ["destination", "start_date"] if data.get(key)}
            if "days" in data:
                return pois_from_itinerary(data), metadata
            if isinstance(data.get("pois"), list):
                return pois_from_itinerary({"days": [{"day": 1, "pois": data["pois"]}]}), metadata
        if isinstance(data, list):
            return pois_from_itinerary({"days": [{"day": 1, "pois": data}]}), metadata

    raise ValueError("Provide --text or --input.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize place names into Roammate POI JSON.")
    parser.add_argument("--text", help="Comma/newline separated place names")
    parser.add_argument("--input", help="Input itinerary JSON or text file")
    parser.add_argument("--output", "-o", help="Output JSON path; stdout if omitted")
    args = parser.parse_args()

    try:
        pois, metadata = read_input(args)
    except Exception as exc:  # noqa: BLE001
        print(f"normalize_pois failed: {exc}", file=sys.stderr)
        return 1

    result = {"pois": pois, "count": len(pois), **metadata}
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
