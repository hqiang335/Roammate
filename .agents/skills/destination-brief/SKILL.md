---
name: destination-brief
description: Create concise mainland China destination briefs covering overview, best season, weather risks, transport gateways, traveler fit, core experiences, cautions, and cited sources.
---

# Destination Brief

Use this nested skill for quick destination research before deeper itinerary work.

## Workflow

1. Parse destination, date/season, origin city, traveler type, and interests.
2. Read `references/source-priority.md`, `../roammate-travel-concierge/references/tool-priority.md`, `../roammate-travel-concierge/references/ai-search-playbook.md`, `../roammate-travel-concierge/references/web-rooter-playbook.md`, `../roammate-travel-concierge/references/research-ledger-schema.md`, and `../roammate-travel-concierge/references/data-flow.md`.
3. Use Amap first for weather windows, POI/transport gateways, and local movement facts when applicable.
4. Use FlyAI first for origin-destination flights/trains and travel-market references. If the user gives only a month/season/vague window, choose a reasonable representative date range that matches the requested duration, query normally, and mark flights, trains, hotels, tickets, packages, and prices as representative-date sample data.
5. Use FlyAI `ai-search` for scenic highlights, seasonal fit, preparation, must-play projects, family tips, likely queue/reservation friction, and package-style ideas; treat it as semantic reference.
6. Use Web-Rooter + Quark before Claude Code built-in Web Search for official pages, policy, opening, construction, festival dates, public web conflicts, and real-experience signals that affect the trip. For hotel-heavy, restaurant-heavy, amusement-park, family, or older-adult trips, Quark evidence should shape the initial stay-area/experience judgment even when Amap/FlyAI returned data.
7. Record accepted destination-level facts, assumptions, and discarded weak searches in `research-ledger.json`.
8. Summarize for a Chinese traveler. Keep it practical, decision-oriented, and source-labeled.

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
- 高铁/机场/自驾入口
- 市内或景区交通概览
- FlyAI 航班/火车参考（如已查询）

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

## 来源与可信度
- 已核实：
- 可能波动：
- Research conducted: {YYYY-MM-DD}
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
- Do not store whole tool outputs in `research-ledger.json`; store concise facts and source labels.
