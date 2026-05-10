---
name: local-reputation-research
description: Research mainland China destination, attraction, restaurant, and hotel reputation using Amap/FlyAI structured facts plus Web-Rooter public evidence. Summarize recommendations, warnings, tourist traps, queues, reservation friction, food, and hotel-area convenience.
---

# Local Reputation Research

Use this nested skill when the user asks whether a place is worth visiting, what to avoid, which restaurants to trust, or how real travelers describe an attraction.

## Workflow

1. Parse target POIs, destination, date/season, traveler type, and decision needed.
2. Read `references/reputation-search-patterns.md`. In a full-package run, reuse any shared concierge references already loaded by the router; only open `tool-priority.md`, `ai-search-playbook.md`, `web-rooter-playbook.md`, `research-ledger-schema.md`, or `data-flow.md` if they have not been read yet or a validator failure requires the exact contract.
3. Build a structured fact base first: Amap POI/detail/rating/location/around search; FlyAI search-poi, keyword-search, hotel inventory, filtered hotel queries, or package results where relevant.
4. Use FlyAI `ai-search` for scenic tips, must-play projects, queues, preparation, play time, reservation friction, family suitability, ticket reference, and avoid/skip choices. Treat it as semantic reference.
5. Use Web-Rooter + Quark with multiple query families for cited visitor experience, restaurants/food, hotel-area convenience, hotel tier/type fit, detailed攻略, official/current notices, and avoidance. Use `wr web --engine=quark` and `wr deep --engine=quark`; use `wr visit`/`wr html` for known pages; use `wr do-plan`/`wr do --strict` only for complex non-search tasks.
6. For hotels, use Quark evidence to form the stay-area strategy and portfolio tiers before accepting FlyAI candidates. If Quark indicates a better area, higher/lower tier, family-friendly type, or recurring complaint, re-query/filter FlyAI instead of keeping the first low-price list.
7. Separate official/Amap/FlyAI facts, FlyAI semantic advice, and Web-Rooter cited public web evidence.
8. Record reusable facts in `research-ledger.json`: recommendation level, play time, must-do, queue/reservation, preparation, family fit, food, route tactics, hotel-area tips, hotel tier/type strategy, candidate hotel tradeoffs, avoidance, and discarded weak evidence.
9. Assign a recommendation level for each POI, restaurant, hotel area, or hotel candidate when in scope.

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
- 首推体验：
- 建议时长：
- 常见差评：
- 避雷点：
- 适合：
- 不适合：
- 准备材料/亲子老人提醒：
- 预约/排队/价格提醒：
- 来源信号：官方确认 / Amap verified / FlyAI booking reference / FlyAI semantic reference / Web-Rooter cited / 多源一致 / 单源参考 / 可能过时

### {酒店区域/酒店候选，若适用}
- 区域判断：
- 推荐档次/类型：
- 候选与取舍：
- 适合：
- 不适合：
- FlyAI 库存/价格信号：
- Quark 经验信号：
- 降权或排除原因：

## 复核记录
- Research conducted: {YYYY-MM-DD}
- Key evidence:
```

## Rules

- Never present one person's complaint as consensus.
- Watch for advertorial language, coupon pages, and copied SEO content.
- Prefer recent signals for crowding, reservation, price, and construction.
- Do not rely on FlyAI `ai-search` for restaurant reviews or numeric ratings; use Amap around/detail first, then Web-Rooter cited public web evidence for lived food/restaurant experience.
- Do not rely on FlyAI hotel inventory alone for hotel advice. FlyAI can show price and availability, but Quark-cited public evidence should shape area choice, tier choice, family convenience, and down-ranking of weak candidates.
- Use Amap rating only as a weak signal, not a final recommendation by itself.
- Use FlyAI ticket/package results as booking-market reference, not guaranteed availability.
- Preserve useful `ai-search` experience facts so itinerary and guidebook can reuse them: play time, must-do, queue, preparation, family fit, rest/meal needs.
- Preserve reusable facts in `research-ledger.json` when they materially affect itinerary or guidebook output; do not log long raw search text.
- Do not re-run `ai-search` for a POI if a fresh accepted fact already exists in `research-ledger.json` unless the user constraints changed.
- If only weak evidence exists, say so plainly and keep the recommendation conservative.
- Treat non-official Web-Rooter evidence as experiential or corroborating evidence, not official proof. Never use it as the sole source for ticket prices, opening hours, closures, exact release times, or current availability.
- Do not use Claude Code built-in Web Search as an automatic fallback; if Web-Rooter fails or returns no usable citations, record the failure and continue with Amap/FlyAI/estimates unless the user explicitly asks for another source.
