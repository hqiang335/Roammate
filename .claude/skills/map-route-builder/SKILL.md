---
name: map-route-builder
description: Convert accepted mainland China itinerary POIs and hotel candidates into normalized map-data JSON with coordinates, route summaries, and map enrichment for guidebook rendering.
---

# Map Route Builder

Use this nested skill for deterministic POI normalization, Amap coordinates/routes, and accepted hotel coordinate enrichment.

## Contract

Consumes:

- `itinerary-structured.json` when present, otherwise `itinerary.md`.
- `reputation.md`, `research-ledger.json`, and accepted hotel candidates when available.

Produces:

- `map-data.json`.
- Optional `map-error.md` only when verified map generation cannot complete.
- `research-ledger.json` updates for verified coordinates, route estimates, and hotel coordinate/link enrichment.

Does not:

- Rewrite itinerary, reputation, or guidebook content.
- Invent new hotel recommendations that were absent from accepted Markdown candidates.
- Generate standalone map pages.

Exit gate:

- `node .claude/skills/map-route-builder/scripts/validate_map.mjs "$TRIP_DIR/map-data.json"` passes, or `map-error.md` clearly records the blocker.

## Workflow

1. Parse input: `itinerary-structured.json`, itinerary markdown, comma-separated locations, or standard JSON.
2. Read `references/amap-mcp.md` only when Amap command/tool usage is unclear. If writing `research-ledger.json` fails validation, read `../roammate-travel-concierge/references/research-ledger-schema.md`.
3. Prefer `itinerary-structured.json` as the POI source for full packages because it preserves `itinerary.md` rows losslessly. Fall back to `itinerary.md` only if the structured extractor has not run. Run `scripts/normalize_pois.py` only when free-form text or legacy JSON needs normalization.
4. For full-package map data, **must run** `scripts/build_real_map.py`. It uses Amap Web Service API for POIs/routes and copies accepted hotel candidates for coordinate enrichment.
5. Validate the generated `map-data.json` with `scripts/validate_map.mjs`.
6. Update `research-ledger.json` only with verified coordinates, route estimates, and hotel coordinate/link enrichment that should be reused by the guidebook.
7. Use Amap MCP directly for weather, details, around search, route modes, and distance when richer data is needed than the script provides.
8. Copy only accepted hotel candidates from `itinerary-structured.json` or `itinerary.md`, then geocode/enrich them by name. Do not discover new hotels in normal full-package runs.
9. Generate `map-data.json` with POIs, route summaries, accepted hotel map enrichment, and degradation notes. Do not generate a standalone map page.

## Research Budget

This stage is mostly deterministic transformation, not broad research.

- Do not run broad FlyAI `ai-search`, hotel/package discovery, or Quark searches. If accepted hotel candidates lack coordinates/photos, geocode them by name or mark the missing enrichment.
- Prefer `build_real_map.py --input itinerary-structured.json`; it should parse the already accepted itinerary rows and hotel table without summarizing them.
- If hotel data is already accepted in `reputation.md`/`itinerary.md`, query/geocode those names only. Do not create a new cheapest-first hotel portfolio.
- Never print raw Amap JSON into the conversation; use the script output summary and validators.

## Real Map Command

```bash
.claude/skills/map-route-builder/scripts/build_real_map.py \
  --destination 杭州 \
  --input "TRAVEL/杭州-2026-06-05/itinerary-structured.json" \
  --check-in-date 2026-06-05 \
  --check-out-date 2026-06-07 \
  --output-dir "TRAVEL/杭州-2026-06-05"
```

When exact hotel dates are unknown, infer representative check-in/check-out dates from the trip assumptions and pass them to the command for freshness labeling. The script copies accepted hotel candidates from the itinerary handoff; it does not search for new hotels.

Then validate:

```bash
node .claude/skills/map-route-builder/scripts/validate_map.mjs \
  TRAVEL/杭州-2026-06-05/map-data.json
```

Required local secrets are read from environment or `~/.codex/.env`:

- `AMAP_MAPS_API_KEY`

## Output

```markdown
# {目的地}路线与地图

## POI 表
| 天数 | 顺序 | 名称 | 类型 | 地址/区域 | 经纬度 | 可信度 |
| --- | --- | --- | --- | --- | --- | --- |

## 路线摘要
| 天数 | 路线 | 估计耗时 | 备注 |
| --- | --- | --- | --- |

## 已接受酒店坐标补全
| 档次/类型 | 酒店 | 坐标/区域 | 价格参考 | 来源 |
| --- | --- | --- | --- | --- |

## 降级说明
- 高德：
```

## Rules

- Amap is the first-choice source for coordinates and routes. Hotel/restaurant/POI recommendation judgement belongs upstream in reputation and itinerary stages.
- Do not generate standalone map pages. The guidebook is the only visual map surface.
- If the real map data script fails because keys, network, or Amap are unavailable, write `map-error.md` plus route text instead of creating placeholder artifacts.
- `map-data.json` is the authoritative map data file. `guidebook-maker` reads `map-data.json` to build the main dashboard-style Travel Atlas.
- If an itinerary handoff is needed, read `itinerary-structured.json` first and fall back to `itinerary.md`; do not require `itinerary-data.json` in new runs.
- Do not re-query Amap for POIs, routes, or hotel coordinates already fresh in `map-data.json` unless the itinerary changed or a validator fails.
- Accepted hotel candidates must keep upstream booking/query URLs and price text when present. If coordinates are missing, geocode accepted hotel candidates before claiming hotel map coverage.
- Do not label long cross-city POI hops as walking routes. Walking routes are appropriate only for compact scenic-area hops; otherwise use itinerary transport, Amap driving/transit/taxi references, or clearly marked estimates.
- Never submit bookings or payment.
- Coordinates must be marked as verified or estimated.
- Booking-market prices and availability must be marked as volatile.
- If map data cannot be fully verified, still output normalized POIs and route text with clear `estimated` markers so the generated `guidebook.html` Travel Atlas can degrade gracefully.
