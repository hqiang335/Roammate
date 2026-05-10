---
name: map-route-builder
description: Convert mainland China place lists or itinerary POIs into normalized map-data JSON, route summaries, transport/hotel/ticket references, and Amap/FlyAI/Quark-backed travel data for guidebook rendering.
---

# Map Route Builder

Use this nested skill for POI normalization, route data, Amap data, FlyAI transport/hotel/ticket/package support, and Quark-backed hotel/route experience checks.

## Workflow

1. Parse input: comma-separated locations, itinerary markdown, or standard JSON.
2. Read `references/amap-mcp.md` and `references/flyai-cli.md`. In a full-package run, reuse any shared concierge references already loaded by the router; only reopen `tool-priority.md`, `web-rooter-playbook.md`, `research-ledger-schema.md`, or `data-flow.md` if they have not been read yet or a validator failure requires the exact contract.
3. Prefer `itinerary-data.json` as the POI source for full packages. Run `scripts/normalize_pois.py` only when text or JSON needs normalization.
4. For full-package map data, **must run** `scripts/build_real_map.py`. It uses Amap Web Service API for POIs/routes and FlyAI CLI for hotel inventory results.
5. Validate the generated `map-data.json` with `scripts/validate_map.mjs`.
6. Update `research-ledger.json` with Amap verified POI/route facts, FlyAI hotel inventory facts, and Quark hotel-area/hotel-tier facts that should be reused by the guidebook.
7. Use Amap MCP directly for weather, details, around search, route modes, and distance when richer data is needed than the script provides.
8. Use FlyAI CLI directly for flights, trains, hotels, attraction listings, tickets/packages, semantic scenic tips, and Marriott preferences. If exact dates are missing but a month/season/vague window is present, choose representative dates and run date-specific booking commands normally, labeling results as sample data.
9. For hotels, compare FlyAI inventory with Quark-cited stay-area and hotel-tier evidence from `research-ledger.json`. If missing and hotel advice matters, run Quark hotel queries before finalizing hotel candidates. Re-query/filter FlyAI by area, POI, star, hotel type, price band, or rating when Quark evidence shows the first FlyAI list is low-quality or too cheap-biased.
10. Generate `map-data.json` with route summary, hotel candidates, transport/ticket notes, and guidebook-ready map facts. Do not generate a standalone map page.

## Real Map Command

```bash
.claude/skills/map-route-builder/scripts/build_real_map.py \
  --destination 杭州 \
  --locations "西湖风景名胜区,灵隐寺,龙井村,九溪烟树,河坊街" \
  --check-in-date 2026-06-05 \
  --check-out-date 2026-06-07 \
  --hotel-bed-types twin,multi \
  --hotel-poi 西湖 \
  --output-dir "TRAVEL/杭州-2026-06-05"
```

When exact hotel dates are unknown, infer representative check-in/check-out dates from the trip assumptions and pass them to the command. Add `--skip-hotels` only if no plausible date range can be inferred or the user explicitly asks not to query hotel inventory.

Then validate:

```bash
node .claude/skills/map-route-builder/scripts/validate_map.mjs \
  TRAVEL/杭州-2026-06-05/map-data.json
```

Required local secrets are read from environment or `~/.codex/.env`:

- `AMAP_MAPS_API_KEY`
- `FLYAI_API_KEY` or `~/.flyai/config.json`

## Output

```markdown
# {目的地}路线与地图

## POI 表
| 天数 | 顺序 | 名称 | 类型 | 地址/区域 | 经纬度 | 可信度 |
| --- | --- | --- | --- | --- | --- | --- |

## 路线摘要
| 天数 | 路线 | 估计耗时 | 备注 |
| --- | --- | --- | --- |

## 酒店候选
| 档次/类型 | 酒店或区域 | 价格参考 | 适合谁 | 取舍 | 来源 |
| --- | --- | --- | --- | --- | --- |

## 城际交通与票务参考
| 类型 | 结果 | 价格/耗时 | 备注 | 来源 |
| --- | --- | --- | --- | --- |

## 降级说明
- 高德：
- FlyAI：
```

## Rules

- Amap and FlyAI are first-choice sources for covered structured facts. Quark is required for hotel-area/tier fit and real traveler route tactics when those choices affect recommendations. Continue without a tool only after noting failure/timeout/unavailable dates.
- Do not generate standalone map pages. The guidebook is the only visual map surface.
- If the real map data script fails because keys, network, Amap, or FlyAI are unavailable, write `map-error.md` plus route text instead of creating placeholder artifacts.
- `map-data.json` is the authoritative map data file. `guidebook-maker` reads `map-data.json` to build the main dashboard-style Travel Atlas.
- If an itinerary handoff is needed, read `itinerary-data.json`.
- Do not re-query Amap/FlyAI for POIs, routes, or hotels already fresh in `map-data.json` unless the itinerary changed, a validator fails, or Quark experience evidence indicates the existing hotel area/tier/candidates are a poor fit.
- If dates are month-only/season-only, run the map with the assumed representative check-in/check-out dates and label FlyAI hotel candidates/prices as representative-date sample data. Skip FlyAI hotel inventory only when no plausible date range can be inferred or the user explicitly asks not to query it.
- Do not present FlyAI hotel output as final hotel advice until Quark area/tier evidence has been considered for trips where lodging affects comfort, commute, family suitability, or budget tradeoffs.
- Accepted hotel candidates must keep Feizhu `detailUrl`/`jumpUrl` as a clickable booking URL, the displayed FlyAI price, tier/type, and room type if returned. If FlyAI does not return room type, record `FlyAI未返回具体房型` plus a note to verify on Feizhu; never invent a room name.
- Preserve FlyAI hotel longitude/latitude when returned so guidebook hotel cards can appear on the map. If coordinates are missing, geocode accepted hotel candidates before claiming hotel map coverage.
- Do not label long cross-city POI hops as walking routes. Walking routes are appropriate only for compact scenic-area hops; otherwise use itinerary transport, Amap driving/transit/taxi references, or clearly marked estimates.
- Do not use unsupported FlyAI flags such as `--max-results`.
- Never submit bookings or payment.
- Coordinates must be marked as verified or estimated.
- Booking-market prices and availability must be marked as volatile.
- If map data cannot be fully verified, still output normalized POIs and route text with clear `estimated` markers so the generated `guidebook.html` Travel Atlas can degrade gracefully.
