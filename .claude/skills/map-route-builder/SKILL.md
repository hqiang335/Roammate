---
name: map-route-builder
description: Convert mainland China place lists or itinerary POIs into normalized POI JSON, route summaries, lightweight map artifacts, and FlyAI hotel research using Amap MCP and FlyAI CLI when available.
---

# Map Route Builder

Use this nested skill for POI normalization, route mapping, Amap data, and FlyAI hotel support.

## Workflow

1. Parse input: comma-separated locations, itinerary markdown, or standard JSON.
2. Run `scripts/normalize_pois.py` when text or JSON needs normalization.
3. For real artifacts, run `scripts/build_real_map.py`. It uses Amap Web Service API for POIs/routes and FlyAI CLI for hotel results.
4. Read `references/amap-mcp.md` before using Amap MCP directly.
5. Read `references/flyai-cli.md` before using FlyAI CLI manually.
6. Generate `pois.json`, route summary, hotel candidates, and `map.html` when requested.

## Real Map Command

```bash
skills/map-route-builder/scripts/build_real_map.py \
  --destination 杭州 \
  --locations "西湖风景名胜区,灵隐寺,龙井村,九溪烟树,河坊街" \
  --check-in-date 2026-06-05 \
  --check-out-date 2026-06-07 \
  --hotel-poi 西湖 \
  --output-dir "TRAVEL/杭州-2026-06"
```

Required local secrets are read from environment or `~/.codex/.env`:

- `AMAP_MAPS_API_KEY`
- `AMAP_WEB_JS_API_KEY`
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
| 酒店 | 区域 | 价格参考 | 适合谁 | 来源 |
| --- | --- | --- | --- | --- |

## 降级说明
- 高德：
- FlyAI：
```

## Rules

- Amap and FlyAI are enhancements. Continue without them if unavailable.
- Never submit bookings or payment.
- Coordinates must be marked as verified or estimated.
- If the map cannot be generated, still output normalized POIs and route text.
