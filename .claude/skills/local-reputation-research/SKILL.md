---
name: local-reputation-research
description: Research mainland China destination, attraction, restaurant, and hotel reputation using web search instead of Xiaohongshu MCP or scraping. Summarize recommendations, warnings, tourist traps, queues, reservation friction, and source confidence.
---

# Local Reputation Research

Use this nested skill when the user asks whether a place is worth visiting, what to avoid, which restaurants to trust, or how real travelers describe an attraction.

## Workflow

1. Parse target POIs, destination, date/season, traveler type, and decision needed.
2. Read `references/reputation-search-patterns.md`.
3. Use web search with multiple query families. Do not scrape or log into platforms.
4. Separate official facts from traveler sentiment.
5. Assign a recommendation level for each POI.

## Recommendation Levels

- `必去`: iconic, consistently praised, fits the user's constraints.
- `值得`: good value or distinctive, with manageable downsides.
- `可选`: nice if nearby or time allows.
- `慎选`: common complaints, crowding, weak fit, or high friction.
- `不推荐`: poor fit, strong negative signals, safety/access issues, or likely tourist trap.

## Output

```markdown
# {对象}口碑与避雷研究

## 总体结论
| 对象 | 等级 | 适合谁 | 主要风险 | 可信度 |
| --- | --- | --- | --- | --- |

## 逐项分析
### {POI}
- 推荐理由：
- 常见差评：
- 避雷点：
- 适合：
- 不适合：
- 预约/排队/价格提醒：
- 来源信号：官方确认 / 多源一致 / 单源参考 / 可能过时

## 搜索与来源
- Research conducted: {YYYY-MM-DD}
- Queries used:
- Sources:
```

## Rules

- Never present one person's complaint as consensus.
- Watch for advertorial language, coupon pages, and copied SEO content.
- Prefer recent signals for crowding, reservation, price, and construction.
- If only weak evidence exists, say so plainly and keep the recommendation conservative.
