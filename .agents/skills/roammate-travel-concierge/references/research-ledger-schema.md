# Research Ledger Schema

`research-ledger.json` is the trip's information ledger. It records useful facts and tool runs once, then downstream files reference or summarize them. Do not paste whole raw tool outputs into it.

## Root Shape

```json
{
  "schema_version": "1.0",
  "artifact_type": "research-ledger",
  "trip": {
    "destination": "成都",
    "date_range": "2026-06-03 至 2026-06-06",
    "duration": "4天3夜",
    "origin": "广州",
    "travelers": "一家三口，含7岁小朋友",
    "assumptions": ["用户只说6月初，当前以6月3日至6月6日作为样例日期"]
  },
  "generated_at": "2026-05-09",
  "tool_runs": [],
  "facts": []
}
```

## Tool Run Shape

Use one `tool_runs` entry for every meaningful Amap, FlyAI, Web-Rooter, official/manual verification, or fallback estimate. Summarize results; store long raw outputs separately only if truly needed.

```json
{
  "id": "run_flyai_ai_panda_base_20260509",
  "tool": "flyai ai-search",
  "query": "成都大熊猫繁育研究基地 游玩时长 必玩项目 预约抢票 排队 避雷 门票 带小孩 准备材料",
  "status": "success",
  "ran_at": "2026-05-09",
  "summary": "建议早入园，游玩3-4小时，花花别墅排队长，儿童需证件。",
  "source_label": "FlyAI semantic reference"
}
```

Allowed `status`: `success`, `failed`, `discarded`, `sample`, `estimated`.

## Fact Shape

```json
{
  "id": "fact_panda_base_duration_20260509",
  "subject": "成都大熊猫繁育研究基地",
  "category": "experience_duration",
  "value": "建议游玩3-4小时，上午7:30开园即入体验最好。",
  "source_type": "FlyAI semantic reference",
  "source_run_id": "run_flyai_ai_panda_base_20260509",
  "confidence": "medium_high",
  "freshness": "2026-05-09",
  "applies_to": {
    "poi": "成都大熊猫繁育研究基地",
    "day": 2,
    "section": "poi_experience"
  },
  "used_by": ["reputation.md", "itinerary-data.json", "guidebook-data.json"],
  "status": "accepted"
}
```

Allowed `category` examples:

- `weather`, `seasonality`, `transport`, `hotel`, `hotel_area_strategy`, `hotel_tier_strategy`, `hotel_candidate`, `poi_identity`, `route`
- `experience_duration`, `must_do`, `reservation`, `queue`, `preparation`, `family_fit`
- `avoidance`, `food`, `budget`, `ticket_reference`, `official_policy`, `assumption`

Hotel facts should distinguish inventory from judgment:

- `hotel`: FlyAI or listing inventory/price facts.
- `hotel_area_strategy`: Quark-cited advice about which area to stay in and why.
- `hotel_tier_strategy`: Quark-cited advice about budget/comfort/premium/special-stay tradeoffs.
- `hotel_candidate`: a specific hotel candidate with source labels, fit, drawbacks, and volatility notes.

Hotel candidate facts should keep booking fields in the fact object when available:

```json
{
  "category": "hotel_candidate",
  "subject": "成都春熙路希尔顿欢朋酒店",
  "value": "舒适/亲子优先候选，代表性日期样例价以 FlyAI 返回为准。",
  "source_type": "FlyAI booking reference",
  "booking_url": "https://a.feizhu.com/...",
  "price_reference": "¥...",
  "room_type": "FlyAI未返回具体房型，需点击飞猪链接确认",
  "tier": "舒适/亲子优先"
}
```

For Web-Rooter facts, include `source_url`, `source_urls`, `citations`, or `references` so downstream `sources.md` can preserve the links.

Allowed `source_type` values:

- `Amap verified`
- `FlyAI booking reference`
- `FlyAI semantic reference`
- `Official verified`
- `Web-Rooter cited`
- `Estimated`

Allowed `confidence` values:

- `high`, `medium_high`, `medium`, `low`, `unknown`

## Discarded Facts

If a search result is irrelevant, stale, duplicated, or too weak, record it only when the failed/discarded query matters for auditability:

```json
{
  "id": "fact_wr_chengdu_family_bad_results_20260509",
  "subject": "成都亲子游 Web-Rooter search",
  "category": "discarded_search",
  "value": "Web-Rooter 搜索结果与成都亲子游无关或缺少可用引用，未采用。",
  "source_type": "Web-Rooter cited",
  "confidence": "low",
  "freshness": "2026-05-09",
  "used_by": [],
  "status": "discarded",
  "discard_reason": "results irrelevant"
}
```

## Final Gate

Before final delivery, run `scripts/validate-ledger.mjs --final TRAVEL/{目的地}-{日期}/research-ledger.json`.

In final mode:

- accepted facts must have `used_by`;
- discarded facts must have `discard_reason`;
- tool runs with `failed` or `discarded` status must not be cited as evidence;
- long raw outputs should not be stored in `summary`.
