#!/usr/bin/env python3
"""Validate a lightweight Roammate itinerary JSON file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


MAX_STANDARD_POIS = 5
MAX_GENTLE_POIS = 4
MAX_SELF_DRIVE_POIS = 4


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Root JSON value must be an object.")
    return data


def get_trip_flags(data: dict[str, Any]) -> dict[str, bool]:
    text = json.dumps(data, ensure_ascii=False).lower()
    return {
        "gentle": any(token in text for token in ["老人", "父母", "爸妈", "长辈", "小孩", "亲子", "低强度", "轮椅", "孕"]),
        "self_drive": any(token in text for token in ["自驾", "停车", "租车", "开车"]),
    }


def validate_day(day: dict[str, Any], flags: dict[str, bool]) -> list[str]:
    issues: list[str] = []
    day_no = day.get("day", "?")
    pois = day.get("pois")

    if not day.get("theme"):
        issues.append(f"Day {day_no}: missing theme.")
    if not isinstance(pois, list) or not pois:
        issues.append(f"Day {day_no}: missing non-empty pois list.")
        return issues

    max_pois = MAX_STANDARD_POIS
    if flags["gentle"]:
        max_pois = min(max_pois, MAX_GENTLE_POIS)
    if flags["self_drive"]:
        max_pois = min(max_pois, MAX_SELF_DRIVE_POIS)

    if len(pois) > max_pois:
        issues.append(f"Day {day_no}: {len(pois)} POIs exceeds recommended maximum {max_pois}.")

    names_seen: set[str] = set()
    total_minutes = 0
    for index, poi in enumerate(pois, start=1):
        if not isinstance(poi, dict):
            issues.append(f"Day {day_no} POI {index}: must be an object.")
            continue

        name = str(poi.get("name", "")).strip()
        if not name:
            issues.append(f"Day {day_no} POI {index}: missing name.")
        elif name in names_seen:
            issues.append(f"Day {day_no}: duplicate POI name '{name}'.")
        names_seen.add(name)

        if not poi.get("type"):
            issues.append(f"Day {day_no} POI '{name or index}': missing type.")

        duration = poi.get("estimated_duration_minutes")
        if duration is None:
            issues.append(f"Day {day_no} POI '{name or index}': missing estimated_duration_minutes.")
        else:
            try:
                minutes = int(duration)
            except (TypeError, ValueError):
                issues.append(f"Day {day_no} POI '{name or index}': duration must be an integer.")
            else:
                if minutes <= 0:
                    issues.append(f"Day {day_no} POI '{name or index}': duration must be positive.")
                total_minutes += max(minutes, 0)

        if "reservation_required" not in poi:
            issues.append(f"Day {day_no} POI '{name or index}': missing reservation_required.")

    if total_minutes > 480:
        issues.append(f"Day {day_no}: planned POI duration is {total_minutes} minutes, likely too dense.")

    return issues


def validate(data: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if not data.get("destination"):
        issues.append("Trip: missing destination.")
    if not isinstance(data.get("days"), list) or not data["days"]:
        issues.append("Trip: missing non-empty days list.")
        return issues

    flags = get_trip_flags(data)
    for day in data["days"]:
        if not isinstance(day, dict):
            issues.append("Trip: each day must be an object.")
            continue
        issues.extend(validate_day(day, flags))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a Roammate itinerary JSON file.")
    parser.add_argument("input", type=Path, help="Path to itinerary JSON")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()

    try:
        data = load_json(args.input)
        issues = validate(data)
    except Exception as exc:  # noqa: BLE001
        issues = [f"Failed to validate: {exc}"]

    result = {"valid": not issues, "issues": issues}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif issues:
        print("Itinerary validation failed:")
        for issue in issues:
            print(f"- {issue}")
    else:
        print("Itinerary validation passed.")

    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main())
