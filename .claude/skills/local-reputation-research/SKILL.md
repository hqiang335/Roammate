---
name: local-reputation-research
description: Research mainland China destination, attraction, restaurant, and hotel reputation using Amap/FlyAI structured facts plus Web-Rooter public evidence. Summarize recommendations, warnings, tourist traps, queues, reservation friction, food, and hotel-area convenience.
---

# Local Reputation Research

Use this nested skill when the user asks whether a place is worth visiting, what to avoid, which restaurants to trust, or how real travelers describe an attraction.

## Contract

Consumes:

- `destination-brief.md` and `research-ledger.json` when available.
- Candidate POIs, hotel areas, restaurants, traveler constraints, and decision questions.

Produces:

- `reputation.md`.
- `research-ledger.json` accepted facts for recommendation levels, avoid notes, hotel-area strategy, candidate hotel tradeoffs, food, queue/reservation friction, and preparation.

Does not:

- Build full daily itineraries.
- Create map coordinates/routes or guidebook HTML.
- Use social login, cookies, account actions, posting, comments, likes, or private user data.

Exit gate:

- `reputation.md` has recommendation levels and practical caveats for selected anchors.
- Hotel advice, when in scope, separates area/tier strategy from accepted hotel candidates.
- `node .claude/skills/roammate-travel-concierge/scripts/validate-stage-report.mjs reputation "$TRIP_DIR"` passes.
- `research-ledger.json` validates if it was created or modified.

## Workflow

1. Parse target POIs, destination, date/season, traveler type, and decision needed.
2. Read `references/reputation-search-patterns.md` only when deciding how much reputation evidence is needed. Before the first FlyAI or Web-Rooter call in this stage, read `../roammate-travel-concierge/references/tool-command-contract.md` once. If writing `research-ledger.json` fails validation, read `../roammate-travel-concierge/references/research-ledger-schema.md`.
3. Build a structured fact base first: Amap POI/detail/rating/location/around search; FlyAI search-poi, keyword-search, hotel inventory, filtered hotel queries, or package results where relevant.
4. Use FlyAI `ai-search` for scenic tips, must-play projects, queues, preparation, play time, reservation friction, family suitability, ticket reference, and avoid/skip choices. Treat it as semantic reference.
5. Use Web-Rooter + Quark through the project wrapper for cited visitor experience, restaurants/food, hotel-area convenience, hotel tier/type fit, detailed攻略, official/current notices, and avoidance. Prefer no-crawl `web` search with 3 results; use `deep` only for unresolved conflicts or explicit user requests.
6. For hotels, use Quark evidence to form the stay-area strategy and portfolio tiers before accepting FlyAI candidates. If Quark indicates a better area, higher/lower tier, family-friendly type, or recurring complaint, re-query/filter FlyAI instead of keeping the first low-price list.
7. Separate official/Amap/FlyAI facts, FlyAI semantic advice, and Web-Rooter cited public web evidence.
8. Record reusable facts in `research-ledger.json`: recommendation level, play time, must-do, queue/reservation, preparation, family fit, food, route tactics, hotel-area tips, hotel tier/type strategy, candidate hotel tradeoffs, avoidance, and discarded weak evidence.
9. Assign a recommendation level for each POI, restaurant, hotel area, or hotel candidate when in scope.

## Research Budget

Start from `destination-brief.md` and `research-ledger.json`; do not repeat stage-1 transport/weather collection.

For a normal full-package city trip:

- choose at most 5 anchor POIs/areas for the first pass;
- run at most 1 FlyAI `ai-search` per anchor POI/area;
- run at most 1 Quark/official targeted search per anchor when FlyAI is insufficient, conflicting, or reputation-sensitive;
- visit/crawl only selected URLs with useful titles, not every search result;
- hotel evidence should focus on area/tier fit first, then a small accepted candidate table.

Stop once each selected POI has recommendation level, recommended duration, must-do, queue/reservation, family fit, avoid notes, and source signal. More detail can be added only if the itinerary or guidebook validator shows a gap.

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

## 酒店区域与候选
- 区域判断：
- 推荐档次/类型：
- 适合：
- 不适合：
- FlyAI 库存/价格信号：
- Quark 经验信号：
- 降权或排除原因：

### 候选与取舍（FlyAI 代表性样例数据，若已查询）
| 档次 | 酒店 | 位置/区域 | 价格/晚 | 适合 | 取舍 | 订票/查询 |
| --- | --- | --- | --- | --- | --- | --- |

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
- Keep `## 逐项分析` limited to actual POIs/attractions/food objects that should become guidebook experience cards. Lodging strategy and hotel candidates must live under `## 酒店区域与候选`, not as a `###` subsection inside `逐项分析`; otherwise downstream guidebook generation may mistake lodging metadata for an attraction card.
- When hotels are in scope, the hotel candidate table must include accepted hotel names, tier, area, sample price, fit, tradeoff, and FlyAI/Feizhu query URL when returned. Do not let the later guidebook infer hotel names from unrelated map-data candidates.
- Preserve reusable facts in `research-ledger.json` when they materially affect itinerary or guidebook output; do not log long raw search text.
- Do not re-run `ai-search` for a POI if a fresh accepted fact already exists in `research-ledger.json` unless the user constraints changed.
- Never print raw FlyAI/Web-Rooter JSON or full article text into the conversation. Project to compact facts and citations before writing `reputation.md`.
- If only weak evidence exists, say so plainly and keep the recommendation conservative.
- Treat non-official Web-Rooter evidence as experiential or corroborating evidence, not official proof. Never use it as the sole source for ticket prices, opening hours, closures, exact release times, or current availability.
- Do not use Claude Code built-in Web Search as an automatic fallback; if Web-Rooter fails or returns no usable citations, record the failure and continue with Amap/FlyAI/estimates unless the user explicitly asks for another source.
- Use the shared tool command contract for FlyAI/Web-Rooter syntax; do not guess command names, hotel/POI options, or JSON field paths from memory.
