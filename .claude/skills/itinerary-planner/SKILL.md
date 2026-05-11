---
name: itinerary-planner
description: Plan mainland China multi-day trips with daily themes, timelines, transport, meals, budgets, reservation reminders, backup plans, and feasibility checks for families, older adults, self-driving, rail, and mixed travel.
---

# Itinerary Planner

Use this nested skill for day-by-day travel planning.

## Contract

Consumes:

- `destination-brief.md`, `reputation.md`, and `research-ledger.json` when they exist.
- User constraints for dates, origin, travelers, budget, pace, transport mode, and interests.

Produces:

- `itinerary.md` as the complete human-readable itinerary authority.
- `itinerary-structured.json` created by `scripts/extract-itinerary-structured.mjs` as a lossless machine index of `itinerary.md`.
- `research-ledger.json` updates for facts that shaped timing, hotels, transport, budgets, and warnings.

Does not:

- Call or load `destination-brief` or `local-reputation-research` during a full-package run.
- Generate `itinerary-data.json`.
- Generate `map-data.json`, `guidebook-data.json`, or `guidebook.html`.
- Compress the itinerary into summaries that drop table cells, notes, links, or daily detail fields.

Exit gate:

- `node .claude/skills/itinerary-planner/scripts/extract-itinerary-structured.mjs "$TRIP_DIR"`
- `node .claude/skills/itinerary-planner/scripts/validate-itinerary-structured.mjs "$TRIP_DIR"`

## Workflow

1. Parse destination, dates, duration, origin, transport mode, travelers, budget, interests, pace, and required outputs.
2. Read existing `destination-brief.md`, `reputation.md`, and `research-ledger.json` first. If a needed prerequisite is missing, write a concise `missing_facts` note for the router instead of loading another child skill yourself.
3. Reuse accepted POI, transport, weather, reservation, hotel-area, and family-fit facts before adding new scheduling-only queries.
4. Read `references/itinerary-rules.md` when planning density, timing, budget, or fixed Markdown labels are unclear. Before the first FlyAI or Web-Rooter call in this stage, read `../roammate-travel-concierge/references/tool-command-contract.md` once. If writing `research-ledger.json` fails validation, read `../roammate-travel-concierge/references/research-ledger-schema.md`.
5. Keep `itinerary.md` complete and explicit: do not rely on downstream scripts to infer missing transport, budget, daily details, hotel candidates, or POI timing rationale.
6. For each anchor POI, extract or reuse FlyAI `ai-search` experience intelligence: minimum/comfortable play time, must-play projects, reservation/queue friction, preparation, child/older-adult risk, meal/rest constraints, and ticket/package reference.
7. Use Amap `geo`, `distance`, and route tools before estimating local transfers; use public transit/driving/walking based on the user's mode.
8. Use FlyAI flights/trains for city-to-city arrival/departure options and FlyAI hotels for booking-market inventory. Preserve returned flight/train booking or query links (`url`, `bookingUrl`, `booking_url`, `ticketUrl`, `ticket_url`, `detailUrl`, `jumpUrl`) directly in `itinerary.md` transport tables/rows. Use Quark-cited hotel area and traveler experience evidence to decide whether those hotel results are actually suitable, and re-query/filter FlyAI if the first results are too cheap, poorly located, or mismatched to the travelers. If exact dates are missing but a month/season/vague window is present, choose a representative date range that matches the requested duration, query normally, and mark booking-market facts as representative-date sample data.
9. Build the itinerary around experience duration + Quark traveler tactics + Amap transfer time + meals/rest + reservations + physical effort. Do not allocate a short slot to an anchor attraction when `ai-search` or Quark evidence indicates it needs a half day or longer.
10. Write `itinerary.md` as the single complete itinerary report. Do not generate `itinerary-data.json` in new runs.
11. Run `scripts/extract-itinerary-structured.mjs "$TRIP_DIR"` to create `itinerary-structured.json`. This is a lossless extraction/index of `itinerary.md`, not a summarized replacement.
12. Run `scripts/validate-itinerary-structured.mjs "$TRIP_DIR"` and fix `itinerary.md` if any day, row, link, label, hotel, budget, or transport handoff is missing.
13. Update `research-ledger.json` accepted facts with `used_by: ["itinerary.md", "itinerary-structured.json"]` when those facts shaped timing, order, rest, or warnings.
14. Revise any day that is too dense, physically unrealistic, missing rest/meal blocks, or missing must-play project notes.
15. In a full-package run, treat itinerary completion as a handoff checkpoint only. Do not say the full trip is complete; immediately continue to `map-route-builder` and then `guidebook-maker`.

## Research Budget

Start from `destination-brief.md`, `reputation.md`, and `research-ledger.json`. Do not redo broad destination, weather, or reputation searches.

Only add missing scheduling facts:

- transport: keep 2-3 plausible outbound and return options, not full inventories;
- hotel: keep accepted candidates that match the reputation-derived area/tier strategy, not every FlyAI result;
- local movement: use Amap only for day-order feasibility and long transfers;
- POI details: only query a missing anchor POI if reputation data lacks duration/booking/friction.

Never print raw FlyAI/Amap/Web-Rooter JSON into the conversation. Project to compact rows before using the result. Use the shared tool command contract for FlyAI/Web-Rooter syntax; pipe FlyAI JSON through the project compactor instead of hand-writing parser snippets.

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
### 城际交通
| 方向 | 班次/车次 | 出发 | 到达 | 时长 | 价格参考 | 订票/查询 |
| --- | --- | --- | --- | --- | --- | --- |

### 市内交通
- 机场/车站接驳：
- 每日跨区移动：
- 打车/地铁/包车/自驾取舍：

### 住宿区域与候选
| 档次 | 酒店 | 位置/区域 | 价格/晚 | 适合 | 取舍 | 订票/查询 |
| --- | --- | --- | --- | --- | --- | --- |

## 出行前检查
- 预约：
- 证件：
- 装备：
- APP：

```

## Rules

- Each normal sightseeing day should have 3-5 activities, fewer for older adults, children, heat, rain, or high-altitude routes.
- Mark all volatile facts: prices, opening hours, reservation policy, traffic duration, weather.
- Do not auto-book anything.
- Do not use web search for local route duration before trying Amap.
- Do not pass unsupported FlyAI options such as `--max-results`; use the shared tool command contract for `search-flight`, `search-train`, `search-hotel`, `search-poi`, and `ai-search` option names.
- Do not create `itinerary-data.json` in new runs. The authoritative itinerary report is `itinerary.md`; downstream scripts should consume the generated `itinerary-structured.json` whenever it exists.
- `itinerary-structured.json` is allowed and expected. It must be generated by the extractor from `itinerary.md`, preserve raw Markdown rows/fields, and never be hand-written as a lossy summary.
- Keep `itinerary.md` machine-parseable: stable headings, one daily table per `### Day N`, explicit POI/hotel/airport/station names in the `安排` column, and fixed daily detail labels below each table.
- Do not invent exact flight/hotel prices for month-only or season-only requests. Query them with the assumed representative date range and label them as sample booking-market data, not confirmed final prices.
- Do not drop FlyAI flight/train links during summarization. If a queried option has a booking/query URL, keep it in structured transport fields and in the human-readable transport reference so the guidebook can render "订票/查询".
- In `itinerary.md`, every `### Day N` block must keep these exact daily detail labels after the timeline table: `今日餐食：`, `休息与补给：`, `核心体验/首推项目：`, `预算估算：`, `预约提醒：`, `雨天/疲劳备用：`. Fill them with source-derived content rather than leaving blank placeholders; guidebook-maker migrates these fields directly into the day cards.
- `## 预算汇总` must use traveler-facing Chinese labels and at least one amount column such as `经济` / `舒适`; do not output internal English budget keys.
- `## 交通与住宿参考` must separate `### 城际交通`, `### 市内交通`, and `### 住宿区域与候选`. This prevents guidebook transport cards from mixing outbound/return/local movement and prevents lodging strategy from being parsed as a POI.
- Keep the chosen outbound/return transport distinct from backup options. Do not rename rows just to dodge validation; if a validator treats an explicitly marked backup as the chosen return, fix the transport structure or validator logic rather than deleting useful alternatives.
- Every anchor POI should have a visible reason for its allocated duration: FlyAI semantic play time, Amap transfer time, queue/reservation friction, or rest/meal needs.
- Hotel advice must not be a cheapest-first FlyAI dump. Show the stay-area logic and, when evidence supports it, options across economy, comfortable/family, premium/location-first, or special-stay tiers.
- Include must-play projects or best viewing/show times in the schedule notes, not only attraction names.
- If Amap/FlyAI data is unavailable, use approximate values and mark them with `约` plus the failure reason.
