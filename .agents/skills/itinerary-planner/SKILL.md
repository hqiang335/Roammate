---
name: itinerary-planner
description: Plan mainland China multi-day trips with daily themes, timelines, transport, meals, budgets, reservation reminders, backup plans, and feasibility checks for families, older adults, self-driving, rail, and mixed travel.
---

# Itinerary Planner

Use this nested skill for day-by-day travel planning.

## Workflow

1. Parse destination, dates, duration, origin, transport mode, travelers, budget, interests, pace, and required outputs.
2. If the user has not provided destination context, use `../destination-brief/SKILL.md`.
3. If POI fit or reputation matters, use `../local-reputation-research/SKILL.md`.
4. Read `references/itinerary-rules.md`, `../roammate-travel-concierge/references/tool-priority.md`, `../roammate-travel-concierge/references/ai-search-playbook.md`, `../roammate-travel-concierge/references/research-ledger-schema.md`, and `../roammate-travel-concierge/references/data-flow.md`.
5. Read `research-ledger.json` first and reuse fresh accepted POI, transport, weather, reservation, and family-fit facts.
6. For each anchor POI, extract or reuse FlyAI `ai-search` experience intelligence: minimum/comfortable play time, must-play projects, reservation/queue friction, preparation, child/older-adult risk, meal/rest constraints, and ticket/package reference.
7. Use Amap `geo`, `distance`, and route tools before estimating local transfers; use public transit/driving/walking based on the user's mode.
8. Use FlyAI flights/trains for city-to-city arrival/departure options and FlyAI hotels for booking-market inventory. Use Quark-cited hotel area and traveler experience evidence to decide whether those hotel results are actually suitable, and re-query/filter FlyAI if the first results are too cheap, poorly located, or mismatched to the travelers. If exact dates are missing but a month/season/vague window is present, choose a representative date range that matches the requested duration, query normally, and mark booking-market facts as representative-date sample data.
9. Build the itinerary around experience duration + Quark traveler tactics + Amap transfer time + meals/rest + reservations + physical effort. Do not allocate a short slot to an anchor attraction when `ai-search` or Quark evidence indicates it needs a half day or longer.
10. Write both `itinerary.md` for humans and `itinerary-data.json` for downstream map/guidebook generation.
11. Update `research-ledger.json` accepted facts with `used_by: ["itinerary-data.json"]` when those facts shaped timing, order, rest, or warnings.
12. Run `scripts/validate_itinerary.py` against `itinerary-data.json`.
13. Revise any day that is too dense, physically unrealistic, missing rest/meal blocks, or missing must-play project notes.
14. In a full-package run, treat itinerary validation as a handoff checkpoint only. Do not say the full trip is complete; immediately continue to `map-route-builder` and then `guidebook-maker`.

## Output

```markdown
# {目的地}{天数}行程

## 行程参数
- 日期：
- 出发地：
- 同行人：
- 交通方式：
- 预算：
- 节奏：

## 总体安排
| 天数 | 主题 | 区域 | 强度 | 核心体验 | 重点提醒 |
| --- | --- | --- | --- | --- | --- |

## 每日行程
### Day 1 · {主题}
| 时间 | 安排 | 交通 | 费用 | 备注 |
| --- | --- | --- | --- | --- |

今日餐食：
休息与补给：
核心体验/首推项目：
预算估算：
预约提醒：
雨天/疲劳备用：

## 预算汇总
| 项目 | 经济 | 舒适 | 备注 |
| --- | --- | --- | --- |

## 交通与住宿参考
- 城际交通：FlyAI 航班/火车参考或降级说明
- 市内交通：Amap 路线/距离参考或降级说明
- 住宿区域：Quark 住宿区域/档次策略 + FlyAI 酒店库存/价格参考

## 出行前检查
- 预约：
- 证件：
- 装备：
- APP：

## 来源与可信度
- Research conducted: {YYYY-MM-DD}
- 可能波动：
```

## Rules

- Each normal sightseeing day should have 3-5 activities, fewer for older adults, children, heat, rain, or high-altitude routes.
- Mark all volatile facts: prices, opening hours, reservation policy, traffic duration, weather.
- Do not auto-book anything.
- Do not use web search for local route duration before trying Amap.
- Do not pass unsupported FlyAI options such as `--max-results`; `search-hotel` returns a capped result set and supports only the options documented in `flyai search-hotel --help`.
- When writing `itinerary-data.json`, keep it valid strict JSON. Use JSON serialization when possible; if editing manually, escape ASCII quotes inside strings or use Chinese quotation marks. Run the validator before any status update that says the itinerary step is done.
- Do not write itinerary data to `pois.json`; `pois.json` is a legacy map alias owned by `map-route-builder`.
- `itinerary-data.json` is the authoritative itinerary handoff file for map and guidebook steps.
- `itinerary-data.json` must include `destination`, `start_date` or `date_range`, `days`, and each anchor POI's `name`, `type`, `estimated_duration_minutes`, `comfortable_duration_minutes` when known, `must_do`, `reservation_required`, `queue_or_friction`, and `source`.
- Do not invent exact flight/hotel prices for month-only or season-only requests. Query them with the assumed representative date range and label them as sample booking-market data, not confirmed final prices.
- Every anchor POI should have a visible reason for its allocated duration: FlyAI semantic play time, Amap transfer time, queue/reservation friction, or rest/meal needs.
- Hotel advice must not be a cheapest-first FlyAI dump. Show the stay-area logic and, when evidence supports it, options across economy, comfortable/family, premium/location-first, or special-stay tiers.
- Include must-play projects or best viewing/show times in the schedule notes, not only attraction names.
- If Amap/FlyAI data is unavailable, use approximate values and mark them with `约` plus the failure reason.
