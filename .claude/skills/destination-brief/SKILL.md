---
name: destination-brief
description: Create concise mainland China destination briefs covering overview, best season, weather risks, transport gateways, traveler fit, core experiences, cautions, and cited sources.
---

# Destination Brief

Use this nested skill for quick destination research before deeper itinerary work.

## Workflow

1. Parse destination, date/season, origin city, traveler type, and interests.
2. Read `references/source-priority.md` for source ranking.
3. Research live information when available. Prefer official and current sources.
4. Summarize for a Chinese traveler. Keep it practical and decision-oriented.
5. Mark uncertainty and data freshness.

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

## 核心体验
1. {体验}
2. {体验}
3. {体验}

## 风险与注意
- 天气、闭园、预约、限流、交通、体力风险

## 来源与可信度
- 已核实：
- 可能波动：
- Research conducted: {YYYY-MM-DD}
```

## Rules

- Do not invent current prices, opening hours, or policies. Verify or mark as estimated.
- If the destination is a scenic area, include nearest city and transport gateway.
- If information conflicts, prefer official notices and mention the conflict.
