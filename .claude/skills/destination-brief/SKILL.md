---
name: destination-brief
description: Create concise mainland China destination briefs covering overview, best season, weather risks, transport gateways, traveler fit, core experiences, cautions, and freshness notes.
---

# Destination Brief

Use this nested skill for quick destination research before deeper itinerary work.

## Contract

Consumes:

- User destination, travel window or duration, origin/arrival context, travelers, pace, and interests.
- Existing `research-ledger.json` if resuming.

Produces:

- `destination-brief.md`.
- `research-ledger.json` destination-level facts and assumptions.

Does not:

- Build detailed day-by-day schedules.
- Create hotel portfolios, map data, guidebook data, or HTML.
- Deep-dive every POI; leave reputation depth to `local-reputation-research`.

Exit gate:

- `destination-brief.md` includes destination fit, season/date risk, arrival/departure samples when queried, local movement overview, core experiences, and first-pass cautions.
- `node .claude/skills/roammate-travel-concierge/scripts/validate-stage-report.mjs brief "$TRIP_DIR"` passes.
- `research-ledger.json` validates if it was created or modified.

## Workflow

1. Parse destination, date/season, origin city, traveler type, and interests.
2. Read `references/source-priority.md` only when source choice is unclear. Before the first FlyAI or Web-Rooter call in this stage, read `../roammate-travel-concierge/references/tool-command-contract.md` once. If writing `research-ledger.json` fails validation, read `../roammate-travel-concierge/references/research-ledger-schema.md`.
3. Use Amap first for weather windows, POI/transport gateways, and local movement facts when applicable.
4. Use FlyAI first for origin-destination flights/trains and travel-market references. Preserve returned booking/query links (`url`, `bookingUrl`, `booking_url`, `ticketUrl`, `ticket_url`, `detailUrl`, `jumpUrl`) alongside flight/train number, time, duration, and price; do not reduce transport facts to plain text if a link exists. If the user gives only a month/season/vague window, choose a reasonable representative date range that matches the requested duration, query normally, and mark flights, trains, hotels, tickets, packages, and prices as representative-date sample data.
5. Use FlyAI `ai-search` for scenic highlights, seasonal fit, preparation, must-play projects, family tips, likely queue/reservation friction, and package-style ideas; treat it as semantic reference.
6. Use Web-Rooter + Quark through the project wrapper before Claude Code built-in Web Search for official pages, policy, opening, construction, festival dates, public web conflicts, and real-experience signals that affect the trip. For hotel-heavy, restaurant-heavy, amusement-park, family, or older-adult trips, Quark evidence should shape the initial stay-area/experience judgment even when Amap/FlyAI returned data.
7. Record accepted destination-level facts, assumptions, and discarded weak searches in `research-ledger.json`.
8. Summarize for a Chinese traveler. Keep it practical, decision-oriented, and compact; put uncertainty beside the affected fact instead of adding a long source section.

## Stage Boundary

This is stage 1, not the whole trip research phase. Stop once the brief can answer destination fit, season/weather risk, rough arrival/departure options, local movement overview, core experiences, and first-pass cautions.

Do not do stage-2/3 work here:

- no hotel inventory portfolios;
- no detailed day-by-day itinerary design;
- no per-POI deep reputation dossiers;
- no package/ticket marketplace sweep beyond one broad semantic reference;
- no crawling long web articles unless official/current policy is needed for the brief.

Default research budget for a normal city trip:

- 1 weather/season check;
- 1 outbound and 1 return FlyAI transport query, keeping only 2-3 best options each;
- 1 broad FlyAI `ai-search` for destination fit and core experiences;
- 1 Quark no-crawl search for public/official context, keeping only titles/URLs and 1-2 useful signals.

If the brief is still uncertain after this budget, write the uncertainty inline and let `local-reputation-research` or `itinerary-planner` deepen it later.

## Output

Write simplified Chinese unless the user asks otherwise.

```markdown
# {目的地}旅行简报

## 一句话判断
{适合/不适合谁，建议停留天数}

## 目的地概览
- 城市/景区定位
- 适合人群
- 旅行强度

## 最佳旅行时间
- 推荐月份
- 天气和旺季风险
- 用户指定日期的提醒

## 怎么到达
### 城际交通（代表性日期样例数据，若已查询）
| 方向 | 班次/车次 | 出发 | 到达 | 时长 | 价格参考 | 订票/查询 |
| --- | --- | --- | --- | --- | --- | --- |
| 去程 |  |  |  |  |  |  |
| 返程 |  |  |  |  |  |  |

### 市内及景区交通
- 机场/高铁站到核心住宿区：
- 核心住宿区到主要景点：
- 景区间移动建议：
- 打车/地铁/包车/自驾取舍：

## 核心体验
1. {体验}
2. {体验}
3. {体验}

## 体验情报初筛
- 重点景点：
- 首推项目/特色活动：
- 预计体验时长：
- 准备材料/亲子提醒：
- 预约/排队风险：

## 风险与注意
- 天气、闭园、预约、限流、交通、体力风险

```

## Rules

- Do not invent current prices, opening hours, or policies. Verify or mark as estimated.
- Do not use Claude Code built-in Web Search for weather or city-to-city transport before trying Amap/FlyAI where available.
- Do not use Claude Code built-in Web Search for official/current web evidence before trying Web-Rooter where available.
- If Amap weather does not cover the travel date, say so and switch to seasonal climate guidance.
- For attraction-heavy destinations, use `ai-search` to identify must-do projects and realistic stay duration before saying how many days are enough.
- If the destination is a scenic area, include nearest city and transport gateway.
- If information conflicts, prefer official notices and mention the conflict.
- Do not re-query a destination fact already present in `research-ledger.json` unless it is stale, low-confidence, or missing a field needed for the brief.
- Do not store whole tool outputs in `research-ledger.json`; store concise facts and only the source metadata needed for later validation.
- For FlyAI flight/train facts, store the booking/query URL when returned so itinerary and guidebook can display it later.
- `## 怎么到达` must keep city-to-city and local movement separated. Do not mix outbound, return, and local transport in one paragraph. If FlyAI returned flights/trains, write a table with direction, code, departure/arrival, duration, sample price, and booking/query link; then write local/city/scenic transport as a separate bullet group.
- Never print raw FlyAI/Web-Rooter JSON into the conversation. Project command results to compact rows before reading them, because `head` does not limit single-line JSON output.
- Use the shared tool command contract for FlyAI/Web-Rooter syntax; do not guess command names or options from memory.
